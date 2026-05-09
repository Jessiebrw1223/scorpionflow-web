// Devuelve el estado real (vivo) de la suscripción MP del usuario.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mpFetch, corsHeaders } from "../_shared/mercadopago.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await admin.from("account_subscriptions")
      .select("mp_preapproval_id, plan, status").eq("owner_id", userData.user.id).maybeSingle();

    if (!row?.mp_preapproval_id) {
      return new Response(JSON.stringify({ provider: "none", plan: row?.plan ?? "free", status: row?.status ?? "active" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pre = await mpFetch(`/preapproval/${row.mp_preapproval_id}`);
    return new Response(JSON.stringify({
      provider: "mercadopago",
      preapproval_id: pre?.id,
      mp_status: pre?.status,
      next_payment_date: pre?.next_payment_date ?? null,
      amount: pre?.auto_recurring?.transaction_amount ?? null,
      currency: pre?.auto_recurring?.currency_id ?? null,
      plan: row.plan,
      status: row.status,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
