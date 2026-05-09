// Webhook de Mercado Pago. Sincroniza el plan Business según el estado real del preapproval/pago.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mpFetch, corsHeaders } from "../_shared/mercadopago.ts";

const log = (message: string, details?: unknown) =>
  console.log(`[mp-webhook] ${message}${details ? " " + JSON.stringify(details) : ""}`);

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

function normalizeType(value: unknown) {
  return (value ?? "").toString();
}

function mapPreapprovalStatus(mpStatus: string | null) {
  switch (mpStatus) {
    case "authorized":
      return {
        plan: "business" as const,
        status: "active",
        paymentProvider: "mercadopago",
        keepMpPreapproval: true,
        cancelAtPeriodEnd: false,
      };
    case "pending":
      return {
        plan: "free" as const,
        status: "pending",
        paymentProvider: "mercadopago",
        keepMpPreapproval: true,
        cancelAtPeriodEnd: false,
      };
    case "paused":
      return {
        plan: "business" as const,
        status: "paused",
        paymentProvider: "mercadopago",
        keepMpPreapproval: true,
        cancelAtPeriodEnd: true,
      };
    case "cancelled":
    case "rejected":
    case "expired":
      return {
        plan: "free" as const,
        status: "active",
        paymentProvider: "manual",
        keepMpPreapproval: false,
        cancelAtPeriodEnd: false,
      };
    default:
      return {
        plan: "free" as const,
        status: mpStatus ?? "pending",
        paymentProvider: "mercadopago",
        keepMpPreapproval: Boolean(mpStatus),
        cancelAtPeriodEnd: false,
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const type = normalizeType(body?.type ?? url.searchParams.get("type"));
    const id = normalizeType(body?.data?.id ?? url.searchParams.get("id"));

    log("received", { type, id });

    if (!id) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    let preapprovalId: string | null = null;
    let preapprovalStatus: string | null = null;
    let lastPaymentId: string | null = null;
    let externalReference: string | null = null;

    if (type === "preapproval" || type === "subscription_preapproval") {
      const pre = await mpFetch(`/preapproval/${id}`);
      preapprovalId = pre?.id ?? null;
      preapprovalStatus = pre?.status ?? null;
      externalReference = pre?.external_reference ?? null;
    } else if (type === "payment") {
      const pay = await mpFetch(`/v1/payments/${id}`);
      lastPaymentId = pay?.id ? String(pay.id) : null;
      preapprovalId = pay?.metadata?.preapproval_id ?? pay?.preapproval_id ?? null;
      externalReference = pay?.external_reference ?? null;

      if (preapprovalId) {
        const pre = await mpFetch(`/preapproval/${preapprovalId}`);
        preapprovalStatus = pre?.status ?? null;
        externalReference = externalReference ?? pre?.external_reference ?? null;
      } else {
        preapprovalStatus = pay?.status === "approved" ? "authorized" : pay?.status ?? null;
      }
    } else {
      log("ignored type", { type });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!externalReference && preapprovalId) {
      const { data: row, error: lookupError } = await admin
        .from("account_subscriptions")
        .select("owner_id")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (lookupError) {
        console.error("[mp-webhook] lookup error", lookupError);
      }

      externalReference = row?.owner_id ?? null;
    }

    if (!externalReference) {
      log("no owner", { preapprovalId, preapprovalStatus });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const mapped = mapPreapprovalStatus(preapprovalStatus);
    const update: Record<string, unknown> = {
      plan: mapped.plan,
      status: mapped.status,
      payment_provider: mapped.paymentProvider,
      billing_cycle: "monthly",
      cancel_at_period_end: mapped.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    };

    if (mapped.keepMpPreapproval && preapprovalId) {
      update.mp_preapproval_id = preapprovalId;
    } else {
      update.mp_preapproval_id = null;
      update.mp_customer_email = null;
    }

    if (lastPaymentId) {
      update.mp_last_payment_id = lastPaymentId;
    }

    const { error: upsertError } = await admin
      .from("account_subscriptions")
      .upsert({ owner_id: externalReference, ...update }, { onConflict: "owner_id" });

    if (upsertError) {
      console.error("[mp-webhook] upsert error", upsertError);
      throw new Error(upsertError.message);
    }

    const { error: eventError } = await admin.from("subscription_events").insert({
      owner_id: externalReference,
      event_type: `mp.${type}.${preapprovalStatus ?? "unknown"}`,
      to_plan: mapped.plan,
      billing_cycle: "monthly",
      metadata: { preapprovalId, lastPaymentId, mpStatus: preapprovalStatus },
    });

    if (eventError) {
      console.error("[mp-webhook] subscription_events insert error", eventError);
    }

    log("updated", {
      externalReference,
      plan: mapped.plan,
      status: mapped.status,
      paymentProvider: mapped.paymentProvider,
    });

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mp-webhook] ERROR", msg);
    // 200 evita reintentos infinitos de Mercado Pago durante piloto; revisar logs en producción.
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
