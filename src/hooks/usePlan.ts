import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanId = "free" | "starter" | "pro" | "business";
export type BillingCycle = "monthly" | "annual";
export type PaymentProvider = "manual" | "mercadopago" | "stripe" | string;

export type PremiumFeature =
  | "advanced_reports"
  | "resources_management"
  | "cost_intelligence"
  | "executive_dashboard"
  | "financial_projection"
  | "smart_alerts";

export interface PlanInfo {
  plan: PlanId;
  status: string;
  billingCycle: string;
  paymentProvider: PaymentProvider;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  pendingDowngradePlan: PlanId | null;
  pendingDowngradeBillingCycle: string | null;
  mpPreapprovalId: string | null;
  loading: boolean;
  // Helpers
  isPro: boolean;
  isBusiness: boolean;
  isPaid: boolean;
  hasActiveMercadoPagoSub: boolean;
  hasManualBusiness: boolean;
  canAccess: (feature: PremiumFeature) => boolean;
  refresh: () => Promise<void>;
  // Legacy fields kept to avoid breaking old components while Stripe is removed gradually.
  stripePriceId: string | null;
  hasActiveStripeSub: boolean;
}

// BETA: temporalmente Free/Starter/Pro se presentan como "Founder Access".
export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Founder Access",
  starter: "Founder Access",
  pro: "Founder Access",
  business: "Business",
};

// Durante beta el plan comercial real es Business. Founder/free mantiene el acceso base.
const FEATURE_REQUIREMENTS: Record<PremiumFeature, PlanId> = {
  advanced_reports: "pro",
  resources_management: "pro",
  cost_intelligence: "pro",
  smart_alerts: "pro",
  executive_dashboard: "business",
  financial_projection: "business",
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

function normalizePlan(value: unknown): PlanId {
  return value === "starter" || value === "pro" || value === "business" ? value : "free";
}

function isAccessActive(status: string) {
  return ["active", "trialing"].includes(status);
}

export function usePlan(): PlanInfo {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanId>("free");
  const [status, setStatus] = useState<string>("active");
  const [billingCycle, setBillingCycle] = useState<string>("monthly");
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("manual");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [pendingDowngradePlan, setPendingDowngradePlan] = useState<PlanId | null>(null);
  const [pendingDowngradeBillingCycle, setPendingDowngradeBillingCycle] = useState<string | null>(null);
  const [mpPreapprovalId, setMpPreapprovalId] = useState<string | null>(null);
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const resetToFree = useCallback(() => {
    setPlan("free");
    setStatus("active");
    setBillingCycle("monthly");
    setPaymentProvider("manual");
    setCancelAtPeriodEnd(false);
    setCurrentPeriodEnd(null);
    setPendingDowngradePlan(null);
    setPendingDowngradeBillingCycle(null);
    setMpPreapprovalId(null);
    setStripePriceId(null);
    setStripeSubscriptionId(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      resetToFree();
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("account_subscriptions")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[usePlan] subscription fetch error", error);
      resetToFree();
      setLoading(false);
      return;
    }

    if (data) {
      const row: any = data;
      setPlan(normalizePlan(row.plan));
      setStatus(row.status ?? "active");
      setBillingCycle(row.billing_cycle ?? "monthly");
      setPaymentProvider(row.payment_provider ?? "manual");
      setCancelAtPeriodEnd(row.cancel_at_period_end ?? false);
      setCurrentPeriodEnd(row.current_period_end ?? null);
      setPendingDowngradePlan(row.pending_downgrade_plan ? normalizePlan(row.pending_downgrade_plan) : null);
      setPendingDowngradeBillingCycle(row.pending_downgrade_billing_cycle ?? null);
      setMpPreapprovalId(row.mp_preapproval_id ?? null);
      setStripePriceId(row.stripe_price_id ?? null);
      setStripeSubscriptionId(row.stripe_subscription_id ?? null);
    } else {
      resetToFree();
    }

    setLoading(false);
  }, [user, resetToFree]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: suscribirse a cambios en mi suscripción.
  useEffect(() => {
    if (!user) return;
    const channelName = `subscription-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "account_subscriptions",
        filter: `owner_id=eq.${user.id}`,
      },
      () => {
        refresh();
      }
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return useMemo<PlanInfo>(() => {
    const rank = PLAN_RANK[plan];
    const isActive = isAccessActive(status);
    const hasActiveMercadoPagoSub =
      paymentProvider === "mercadopago" && Boolean(mpPreapprovalId) && plan === "business" && isActive;

    return {
      plan,
      status,
      billingCycle,
      paymentProvider,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      pendingDowngradePlan,
      pendingDowngradeBillingCycle,
      mpPreapprovalId,
      loading,
      isPro: rank >= PLAN_RANK.pro && isActive,
      isBusiness: rank >= PLAN_RANK.business && isActive,
      isPaid: rank >= PLAN_RANK.starter && isActive,
      hasActiveMercadoPagoSub,
      hasManualBusiness: paymentProvider === "manual" && plan === "business" && isActive,
      canAccess: (feature: PremiumFeature) => {
        if (!isActive) return false;
        return rank >= PLAN_RANK[FEATURE_REQUIREMENTS[feature]];
      },
      refresh,
      stripePriceId,
      hasActiveStripeSub: Boolean(stripeSubscriptionId) && isActive,
    };
  }, [
    plan,
    status,
    billingCycle,
    paymentProvider,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    pendingDowngradePlan,
    pendingDowngradeBillingCycle,
    mpPreapprovalId,
    stripePriceId,
    stripeSubscriptionId,
    loading,
    refresh,
  ]);
}

export function getRequiredPlan(feature: PremiumFeature): PlanId {
  return FEATURE_REQUIREMENTS[feature];
}
