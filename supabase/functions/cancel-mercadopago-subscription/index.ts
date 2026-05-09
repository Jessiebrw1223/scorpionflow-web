// Cancela una suscripción Mercado Pago del usuario autenticado.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mpFetch, corsHeaders } from "../_shared/mercadopago.ts";

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const requestedPreapprovalId = body?.subscription_id ?? body?.preapproval_id ?? null;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: row, error: rowError } = await admin
      .from("account_subscriptions")
      .select("plan, status, payment_provider, mp_preapproval_id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (rowError) throw new Error(rowError.message);

    const preapprovalId = requestedPreapprovalId ?? row?.mp_preapproval_id;
    const isRealMercadoPagoBusiness =
      row?.payment_provider === "mercadopago" &&
      row?.plan === "business" &&
      row?.status === "active" &&
      Boolean(row?.mp_preapproval_id) &&
      (!requestedPreapprovalId || requestedPreapprovalId === row?.mp_preapproval_id);

    if (!isRealMercadoPagoBusiness || !preapprovalId) {
      const { error: updateError } = await admin
        .from("account_subscriptions")
        .update({
          plan: "free",
          status: "active",
          billing_cycle: "monthly",
          payment_provider: "manual",
          mp_preapproval_id: null,
          mp_customer_email: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("owner_id", userId);

      if (updateError) throw new Error(updateError.message);

      return new Response(JSON.stringify({ ok: true, local_only: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await mpFetch(`/preapproval/${preapprovalId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });

    const { error: updateError } = await admin
      .from("account_subscriptions")
      .update({
        plan: "free",
        status: "active",
        billing_cycle: "monthly",
        payment_provider: "manual",
        mp_preapproval_id: null,
        mp_customer_email: null,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", userId);

    if (updateError) throw new Error(updateError.message);

    return new Response(JSON.stringify({ ok: true, cancelled: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[cancel-mp] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
