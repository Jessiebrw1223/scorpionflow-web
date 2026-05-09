// Crea una suscripción mensual (preapproval) en Mercado Pago para el plan Business — S/90/mes.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mpFetch, corsHeaders, BUSINESS_PLAN } from "../_shared/mercadopago.ts";

const log = (message: string, details?: unknown) =>
  console.log(`[create-mp-checkout] ${message}${details ? " " + JSON.stringify(details) : ""}`);

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

function getFrontendUrl() {
  return (Deno.env.get("FRONTEND_URL") ?? "https://scorpion-flow.com").replace(/\/$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await sb.auth.getUser(token);

    if (userErr || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    log("user", { userId, userEmail });

    const frontendUrl = getFrontendUrl();
    const backUrl = `${frontendUrl}/settings?tab=subscription&mp=return`;

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];
    const notificationUrl = projectRef
      ? `https://${projectRef}.supabase.co/functions/v1/mercadopago-webhook`
      : undefined;

    const preapproval = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: BUSINESS_PLAN.reason,
        external_reference: userId,
        payer_email: userEmail,
        back_url: backUrl,
        notification_url: notificationUrl,
        status: "pending",
        auto_recurring: {
          frequency: BUSINESS_PLAN.frequency,
          frequency_type: BUSINESS_PLAN.frequency_type,
          transaction_amount: BUSINESS_PLAN.amount,
          currency_id: BUSINESS_PLAN.currency,
        },
      }),
    });

    if (!preapproval?.id) {
      console.error("[create-mp-checkout] MP RESPONSE WITHOUT ID", preapproval);
      throw new Error("Mercado Pago no devolvió un preapproval_id");
    }

    const checkoutUrl = preapproval.init_point ?? preapproval.sandbox_init_point;

    if (!checkoutUrl) {
      console.error("[create-mp-checkout] MP RESPONSE WITHOUT URL", preapproval);
      throw new Error("Mercado Pago no devolvió URL de checkout");
    }

    log("preapproval created", { id: preapproval.id, hasUrl: Boolean(checkoutUrl) });

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: upsertError } = await admin
      .from("account_subscriptions")
      .upsert(
        {
          owner_id: userId,
          plan: "free",
          payment_provider: "mercadopago",
          mp_preapproval_id: preapproval.id,
          mp_customer_email: userEmail,
          status: "pending",
          billing_cycle: "monthly",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      );

    if (upsertError) {
      console.error("[create-mp-checkout] UPSERT ERROR", upsertError);
      throw new Error(upsertError.message);
    }

    return new Response(
      JSON.stringify({ url: checkoutUrl, preapproval_id: preapproval.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[create-mp-checkout] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
