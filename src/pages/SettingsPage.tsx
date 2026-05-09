import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CreditCard,
  Bell,
  Check,
  Sparkles,
  Star,
  TrendingUp,
  Briefcase,
  AlertTriangle,
  Zap,
  DollarSign,
  Target,
  Wand2,
  Loader2,
  X,
} from "lucide-react";
import {
  useUserSettings,
  type Currency,
  type CostModel,
  type Channel,
} from "@/hooks/useUserSettings";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { humanizeError, humanizeFunctionError } from "@/lib/humanize-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PlanId = "free" | "starter" | "pro" | "business";

const BUSINESS_PRICE_PEN = 90;

const PLANS: Array<{
  id: PlanId;
  name: string;
  tagline: string;
  icon: typeof Sparkles;
  accent: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
}> = [
  {
    id: "free",
    name: "Founder Access",
    badge: "Beta",
    tagline: "Acceso beta para usuarios fundadores",
    icon: Sparkles,
    accent: "text-primary",
    highlight: true,
    features: [
      "Cotizaciones, clientes y proyectos",
      "Recursos, costos y riesgos",
      "Dashboard, informes y Learn Center",
      "Colaboración básica",
      "Branding ScorpionFlow visible",
      "Construido junto a nuestros primeros usuarios",
    ],
    cta: "Empezar gratis",
  },
  {
    id: "business",
    name: "Business",
    tagline: "Visión estratégica y control corporativo",
    icon: TrendingUp,
    accent: "text-cost-warning",
    features: [
      "Visión financiera global",
      "Dashboards ejecutivos",
      "Analítica avanzada",
      "Colaboración empresarial",
      "Exportaciones completas",
      "Soporte prioritario",
    ],
    cta: "Solicitar acceso Business",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  const { settings, save, saving, isLoading } = useUserSettings();

  const {
    plan: realPlan,
    status: planStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    refresh: refreshPlan,
  } = usePlan();

  const [searchParams, setSearchParams] = useSearchParams();

  const [actionLoading, setActionLoading] = useState<PlanId | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
    destructive?: boolean;
  } | null>(null);

  const [currency, setCurrency] = useState<Currency>(settings.currency);
  const [costModel, setCostModel] = useState<CostModel>(settings.cost_model);
  const [targetMargin, setTargetMargin] = useState<number>(
    settings.target_margin
  );
  const [autoAlerts, setAutoAlerts] = useState(settings.auto_alerts);
  const [autoBehavior, setAutoBehavior] = useState(settings.auto_behavior);
  const [alerts, setAlerts] = useState(settings.alerts);
  const [channel, setChannel] = useState<Channel>(settings.channel);

  useEffect(() => {
    setCurrency(settings.currency);
    setCostModel(settings.cost_model);
    setTargetMargin(settings.target_margin);
    setAutoAlerts(settings.auto_alerts);
    setAutoBehavior(settings.auto_behavior);
    setAlerts(settings.alerts);
    setChannel(settings.channel);
  }, [settings]);

  const initialTab =
    searchParams.get("tab") === "subscription"
      ? "subscriptions"
      : searchParams.get("tab") === "alerts"
        ? "alerts"
        : "work";

  useEffect(() => {
    const mp = searchParams.get("mp");

    if (mp === "return") {
      toast.info("Estamos confirmando tu pago.", {
        description:
          "Activaremos Business en cuanto Mercado Pago confirme la suscripción.",
      });

      let attempts = 0;
      const maxAttempts = 12;

      const interval = setInterval(async () => {
        attempts++;
        await refreshPlan();

        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 2000);

      refreshPlan();

      searchParams.delete("mp");
      setSearchParams(searchParams, { replace: true });

      return () => clearInterval(interval);
    }
  }, [searchParams, setSearchParams, refreshPlan]);

  const openMpCheckout = async () => {
    setActionLoading("business");

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-mercadopago-checkout",
        {
          body: {},
        }
      );

      if (error || (data && (data as any).error)) {
        toast.error("No pudimos conectar con Mercado Pago", {
          description: humanizeFunctionError(
            error,
            data,
            "Intenta nuevamente en unos segundos."
          ),
        });
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("No pudimos conectar con Mercado Pago", {
          description: "Intenta nuevamente en unos segundos.",
        });
      }
    } catch (e: any) {
      toast.error("No pudimos conectar con Mercado Pago", {
        description: humanizeError(e, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);

    try {
      await openMpCheckout();
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) {
      toast.error("No hay usuario autenticado");
      return;
    }

    setCancelLoading(true);

    try {
      const { data: subscription, error: subError } = await supabase
        .from("account_subscriptions")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (subError) {
        throw subError;
      }

      const sub: any = subscription ?? {};
      const mpPreapprovalId =
        sub.mp_preapproval_id ||
        sub.mercadopago_preapproval_id ||
        sub.preapproval_id ||
        sub.mercadopago_subscription_id ||
        sub.mercado_pago_subscription_id ||
        sub.mp_subscription_id;

      const isRealMercadoPagoBusiness =
        sub.payment_provider === "mercadopago" &&
        sub.plan === "business" &&
        sub.status === "active" &&
        !!mpPreapprovalId;

      const resetLocalSubscription = async () => {
        const { error: upsertError } = await supabase
          .from("account_subscriptions")
          .upsert(
            {
              owner_id: user.id,
              plan: "free",
              status: "active",
              billing_cycle: "monthly",
              payment_provider: "manual",
              mp_preapproval_id: null,
              mp_customer_email: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "owner_id" }
          );

        if (upsertError) {
          throw upsertError;
        }
      };

      // CASO 1:
      // Business manual, Stripe viejo, intento pendiente o cualquier estado que NO sea
      // una suscripción real activa de Mercado Pago.
      if (!isRealMercadoPagoBusiness) {
        await resetLocalSubscription();
        await refreshPlan();

        toast.success("Volviste a Founder Access", {
          description:
            "Se limpió la suscripción local porque no había una suscripción activa real de Mercado Pago.",
        });

        setTimeout(() => {
          window.location.href = "/settings?tab=subscription";
        }, 700);

        return;
      }

      // CASO 2:
      // Business real creado por Mercado Pago. Se cancela en Mercado Pago y luego
      // se limpia localmente para que la UI refleje Founder Access de inmediato.
      const { data, error } = await supabase.functions.invoke(
        "cancel-mercadopago-subscription",
        {
          body: {
            subscription_id: mpPreapprovalId,
            preapproval_id: mpPreapprovalId,
          },
        }
      );

      if (error || (data && (data as any).error)) {
        toast.error("No pudimos cancelar tu suscripción", {
          description: humanizeFunctionError(
            error,
            data,
            "Para cambios avanzados, contacta soporte."
          ),
        });
        return;
      }

      await resetLocalSubscription();
      await refreshPlan();

      toast.success("Cancelación registrada", {
        description:
          "Mercado Pago dejará de cobrarte. Tu cuenta volvió a Founder Access.",
      });

      setTimeout(() => {
        window.location.href = "/settings?tab=subscription";
      }, 700);
    } catch (e: any) {
      toast.error("No pudimos cancelar tu suscripción", {
        description: humanizeError(
          e,
          "Para cambios avanzados, contacta soporte."
        ),
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handlePlanAction = async (planId: PlanId) => {
    if (planId === "business") {
      if (realPlan === "business" && cancelAtPeriodEnd) {
        return handleReactivate();
      }

      if (realPlan !== "business") {
        return openMpCheckout();
      }

      return;
    }

    if (realPlan === "business" && !cancelAtPeriodEnd) {
      setConfirmDialog({
        title: "Volver a Founder Access",
        description:
          "Si tu Business fue activado manualmente, volverás a Founder Access de inmediato. Si tienes una suscripción real en Mercado Pago, se intentará cancelar desde Mercado Pago.",
        confirmLabel: "Confirmar cambio",
        destructive: true,
        onConfirm: handleCancelSubscription,
      });
    }
  };

  const handleSaveWork = async () => {
    try {
      await save({
        currency,
        cost_model: costModel,
        target_margin: targetMargin,
        auto_alerts: autoAlerts,
        auto_behavior: autoBehavior,
      });

      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error("No se pudo guardar", {
        description: e?.message,
      });
    }
  };

  const handleSaveAlerts = async () => {
    try {
      await save({
        alerts,
        channel,
      });

      toast.success("Alertas actualizadas");
    } catch (e: any) {
      toast.error("No se pudo guardar", {
        description: e?.message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-foreground">
          Configuración
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Define cómo funciona tu negocio en ScorpionFlow
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="bg-secondary border border-border h-9">
          <TabsTrigger
            value="work"
            className="text-[12px] gap-1.5 data-[state=active]:bg-card"
          >
            <Briefcase className="w-3.5 h-3.5" /> Trabajo
          </TabsTrigger>

          <TabsTrigger
            value="alerts"
            className="text-[12px] gap-1.5 data-[state=active]:bg-card"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Alertas inteligentes
          </TabsTrigger>

          <TabsTrigger
            value="subscriptions"
            className="text-[12px] gap-1.5 data-[state=active]:bg-card"
          >
            <CreditCard className="w-3.5 h-3.5" /> Suscripciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work">
          <div className="space-y-4 max-w-3xl">
            <div className="surface-card p-4 rounded-lg flex items-center gap-3 bg-primary/5 border-primary/20">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>

              <div className="text-[12px] text-muted-foreground">
                <span className="text-foreground font-medium">
                  Cada opción aquí cambia cómo se calculan tus costos, márgenes
                  y alertas.
                </span>{" "}
                No es decorativo: impacta directamente en tu negocio.
              </div>
            </div>

            <SectionCard
              icon={DollarSign}
              title="Moneda principal"
              hint="Afecta cotizaciones, costos y reportes"
            >
              <div className="grid grid-cols-2 gap-3">
                <RadioOption
                  active={currency === "PEN"}
                  onClick={() => setCurrency("PEN")}
                  label="S/ Soles peruanos"
                  desc="Mostrar todos los montos en PEN"
                />
                <RadioOption
                  active={currency === "USD"}
                  onClick={() => setCurrency("USD")}
                  label="$ Dólares"
                  desc="Mostrar todos los montos en USD"
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={Briefcase}
              title="Modelo de costos"
              hint="Define cómo calcula el sistema tus recursos y proyectos"
            >
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      id: "hourly",
                      label: "Por horas",
                      desc: "Tarifa por hora trabajada",
                    },
                    {
                      id: "monthly",
                      label: "Por meses",
                      desc: "Pago mensual fijo",
                    },
                    {
                      id: "fixed",
                      label: "Costos fijos",
                      desc: "Monto único por entregable",
                    },
                    {
                      id: "mixed",
                      label: "Mixto",
                      desc: "Combina horas, meses y fijos",
                    },
                  ] as const
                ).map((opt) => (
                  <RadioOption
                    key={opt.id}
                    active={costModel === opt.id}
                    onClick={() => setCostModel(opt.id)}
                    label={opt.label}
                    desc={opt.desc}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              icon={Target}
              title="Margen objetivo mínimo"
              hint="Si tus proyectos bajan de este margen, el sistema te alerta"
            >
              <div className="flex items-center gap-3 max-w-xs">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={targetMargin}
                  onChange={(e) =>
                    setTargetMargin(Number(e.target.value) || 0)
                  }
                  className="h-9 text-[13px] bg-secondary border-border font-mono-data"
                />

                <span className="text-[13px] font-semibold text-foreground">
                  %
                </span>

                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[11px]",
                    targetMargin >= 30
                      ? "text-cost-positive"
                      : targetMargin >= 15
                        ? "text-cost-warning"
                        : "text-destructive"
                  )}
                >
                  {targetMargin >= 30
                    ? "Saludable"
                    : targetMargin >= 15
                      ? "Aceptable"
                      : "Riesgoso"}
                </Badge>
              </div>
            </SectionCard>

            <SectionCard
              icon={AlertTriangle}
              title="Alertas automáticas"
              hint="El sistema te avisa cuando algo pone en riesgo tu rentabilidad"
            >
              <div className="space-y-3">
                <ToggleRow
                  label="Costos superan el 80% del presupuesto"
                  desc="Aviso temprano antes de excederte"
                  checked={autoAlerts.budgetOver80}
                  onChange={(v) =>
                    setAutoAlerts({ ...autoAlerts, budgetOver80: v })
                  }
                />

                <ToggleRow
                  label={`Margen baja del ${Math.min(15, targetMargin)}%`}
                  desc="Detecta proyectos poco rentables"
                  checked={autoAlerts.marginBelow15}
                  onChange={(v) =>
                    setAutoAlerts({ ...autoAlerts, marginBelow15: v })
                  }
                />

                <ToggleRow
                  label="Proyecto entra en pérdida"
                  desc="Notifica cuando el costo supera el ingreso"
                  checked={autoAlerts.projectInLoss}
                  onChange={(v) =>
                    setAutoAlerts({ ...autoAlerts, projectInLoss: v })
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={Wand2}
              title="Automatización"
              hint="Reduce el trabajo manual: deja que el sistema calcule por ti"
            >
              <div className="space-y-3">
                <ToggleRow
                  label="Calcular costos desde los recursos"
                  desc="El costo del proyecto se actualiza automáticamente"
                  checked={autoBehavior.autoCostFromResources}
                  onChange={(v) =>
                    setAutoBehavior({
                      ...autoBehavior,
                      autoCostFromResources: v,
                    })
                  }
                />

                <ToggleRow
                  label="Actualizar progreso por tareas completadas"
                  desc="El % de avance se calcula solo"
                  checked={autoBehavior.autoProgressFromTasks}
                  onChange={(v) =>
                    setAutoBehavior({
                      ...autoBehavior,
                      autoProgressFromTasks: v,
                    })
                  }
                />

                <ToggleRow
                  label="Inferir cronograma si no existe"
                  desc="Usa las fechas de tus tareas para estimar inicio y fin"
                  checked={autoBehavior.inferSchedule}
                  onChange={(v) =>
                    setAutoBehavior({ ...autoBehavior, inferSchedule: v })
                  }
                />
              </div>
            </SectionCard>

            <div className="flex justify-end">
              <Button
                className="h-9 text-[13px]"
                onClick={handleSaveWork}
                disabled={saving || isLoading}
              >
                {saving ? "Guardando..." : "Guardar configuración"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="space-y-4 max-w-2xl">
            <div className="surface-card p-4 rounded-lg flex items-center gap-3 bg-secondary/30">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-primary" />
              </div>

              <div className="text-[12px] text-muted-foreground">
                <span className="text-foreground font-medium">
                  Solo alertas que importan.
                </span>{" "}
                Te avisamos cuando hay algo que decidir, no por cada acción.
              </div>
            </div>

            <SectionCard
              icon={Bell}
              title="Recibir alertas cuando…"
              hint="Cada alerta requiere una decisión tuya"
            >
              <div className="space-y-3">
                <ToggleRow
                  label="El proyecto está perdiendo dinero"
                  desc="Costos > ingresos esperados"
                  checked={alerts.losingMoney}
                  onChange={(v) => setAlerts({ ...alerts, losingMoney: v })}
                />

                <ToggleRow
                  label="Hay retrasos críticos"
                  desc="Tareas vencidas o atraso > 15% del cronograma"
                  checked={alerts.criticalDelays}
                  onChange={(v) =>
                    setAlerts({ ...alerts, criticalDelays: v })
                  }
                />

                <ToggleRow
                  label="Se supera el presupuesto"
                  desc="Total gastado mayor al presupuesto del proyecto"
                  checked={alerts.budgetExceeded}
                  onChange={(v) =>
                    setAlerts({ ...alerts, budgetExceeded: v })
                  }
                />

                <ToggleRow
                  label="Una tarea bloquea el avance"
                  desc="Tarea bloqueada por más de 24 horas"
                  checked={alerts.blockingTask}
                  onChange={(v) => setAlerts({ ...alerts, blockingTask: v })}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={Zap}
              title="Canal de alertas"
              hint="Dónde quieres recibirlas"
            >
              <div className="grid grid-cols-2 gap-3">
                <RadioOption
                  active={channel === "system"}
                  onClick={() => setChannel("system")}
                  label="Sistema"
                  desc="Campana de notificaciones en la app"
                />

                <RadioOption
                  active={channel === "email"}
                  onClick={() => setChannel("email")}
                  label="Correo electrónico"
                  desc="Recibe un email por cada alerta crítica"
                />
              </div>
            </SectionCard>

            <div className="flex justify-end">
              <Button
                className="h-9 text-[13px]"
                onClick={handleSaveAlerts}
                disabled={saving || isLoading}
              >
                {saving ? "Guardando..." : "Guardar alertas"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="space-y-5">
            <div className="surface-card p-4 rounded-lg flex items-start gap-3 bg-primary/5 border border-primary/30">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>

              <div className="text-[12.5px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-semibold">
                    Acceso beta para usuarios fundadores.
                  </span>

                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider border-primary/40 text-primary"
                  >
                    Beta · Early Access
                  </Badge>
                </div>

                <p className="text-muted-foreground mt-0.5">
                  Estamos construyendo ScorpionFlow junto a nuestros primeros
                  usuarios. Mientras dure la beta tienes acceso casi completo
                  sin tarjeta.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground">
                Founder Access o Business
              </h3>

              <p className="text-[13px] text-muted-foreground">
                Empieza con Founder Access. Activa Business cuando necesites
                visión empresarial completa. Pago mensual con Mercado Pago.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
              {PLANS.map((plan) => {
                const Icon = plan.icon;
                const isFounderCard = plan.id === "free";
                const isCurrent = isFounderCard
                  ? realPlan !== "business"
                  : realPlan === "business";
                const isFree = plan.id === "free";
                const isLoadingThis = actionLoading === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "surface-card p-5 rounded-xl border-2 transition-sf relative flex flex-col",
                      plan.highlight
                        ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_8px_30px_-8px_hsl(var(--primary)/0.4)] md:scale-[1.02]"
                        : isCurrent
                          ? "border-primary/60"
                          : "border-border hover:border-primary/40"
                    )}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 scorpion-gradient text-[10px] font-bold uppercase tracking-wider text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                        <Star className="w-3 h-3 fill-current" />
                        Más popular
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn("w-4 h-4", plan.accent)} />
                      <h4 className="text-[14px] font-semibold text-foreground">
                        {plan.name}
                      </h4>
                    </div>

                    <p className="text-[12px] text-muted-foreground mb-4 min-h-[32px]">
                      {plan.tagline}
                    </p>

                    <div className="mb-4 pb-4 border-b border-border">
                      {isFree ? (
                        <div>
                          <span className="font-mono-data text-3xl font-bold text-foreground">
                            Gratis
                          </span>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Durante la beta
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono-data text-3xl font-bold text-foreground">
                              S/{BUSINESS_PRICE_PEN}
                            </span>
                            <span className="text-[12px] text-muted-foreground">
                              / mes
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-1">
                            Precio beta · Pago mensual con Mercado Pago
                          </p>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2 text-[12px] text-foreground/85 mb-5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check
                            className={cn(
                              "w-3.5 h-3.5 mt-0.5 shrink-0",
                              plan.highlight
                                ? "text-primary"
                                : "text-cost-positive"
                            )}
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="space-y-2">
                        <Badge
                          variant="secondary"
                          className="w-full justify-center py-2 text-[12px] flex flex-col gap-0.5"
                        >
                          <span>
                            {cancelAtPeriodEnd
                              ? "Cancelando al final del período"
                              : "Plan actual"}
                          </span>

                          {currentPeriodEnd && (
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {cancelAtPeriodEnd ? "Termina el " : "Renueva el "}
                              {new Date(currentPeriodEnd).toLocaleDateString(
                                "es-PE",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          )}
                        </Badge>

                        {!isFree && (
                          <div className="space-y-2">
                            {cancelAtPeriodEnd ? (
                              <Button
                                variant="outline"
                                className="w-full h-9 text-[12px] gap-1.5"
                                onClick={() => handlePlanAction("business")}
                                disabled={
                                  reactivateLoading || actionLoading !== null
                                }
                              >
                                {reactivateLoading && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                )}
                                Reactivar Business
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                className="w-full h-9 text-[12px] gap-1.5 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setConfirmDialog({
                                    title: "Cancelar suscripción Business",
                                    description:
                                      "Si tu Business fue activado manualmente, volverás a Founder Access de inmediato. Si tienes una suscripción real en Mercado Pago, se intentará cancelar desde Mercado Pago.",
                                    confirmLabel: "Sí, cancelar",
                                    destructive: true,
                                    onConfirm: handleCancelSubscription,
                                  })
                                }
                                disabled={cancelLoading}
                              >
                                {cancelLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                Cancelar suscripción
                              </Button>
                            )}

                            <p className="text-[10.5px] text-muted-foreground text-center pt-1">
                              Para cambios avanzados, contacta soporte.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : isFree ? (
                      <Badge
                        variant="outline"
                        className="w-full justify-center py-2 text-[12px] text-muted-foreground"
                      >
                        Disponible al cancelar
                      </Badge>
                    ) : (
                      <Button
                        variant={plan.highlight ? "default" : "outline"}
                        className={cn(
                          "w-full h-9 text-[12px] gap-1.5",
                          plan.highlight && "fire-button text-white border-0"
                        )}
                        onClick={() => handlePlanAction(plan.id)}
                        disabled={isLoadingThis}
                      >
                        {isLoadingThis && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        Activar Business
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {planStatus === "pending" && (
              <div className="surface-card p-4 rounded-lg flex items-center gap-3 bg-cost-warning/5 border border-cost-warning/30">
                <div className="w-8 h-8 rounded-full bg-cost-warning/10 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 text-cost-warning animate-spin" />
                </div>

                <div className="flex-1 text-[12px]">
                  <span className="text-foreground font-medium">
                    Estamos confirmando tu pago.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    Recibirás acceso a Business en cuanto Mercado Pago confirme
                    la suscripción.
                  </span>
                </div>
              </div>
            )}

            {(planStatus === "rejected" || planStatus === "expired") && (
              <div className="surface-card p-4 rounded-lg flex items-center gap-3 bg-destructive/5 border border-destructive/30">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>

                <div className="flex-1 text-[12px]">
                  <span className="text-foreground font-medium">
                    Tu pago no pudo procesarse.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    Puedes volver a intentarlo cuando quieras.
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[12px]"
                  onClick={openMpCheckout}
                  disabled={actionLoading !== null}
                >
                  Reintentar
                </Button>
              </div>
            )}

            <div className="surface-card p-4 rounded-lg flex items-center gap-3 bg-secondary/30">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>

              <div className="text-[12px] text-muted-foreground">
                <span className="text-foreground font-medium">
                  Cancela cuando quieras.
                </span>{" "}
                Puedes cambiar o cancelar tu plan en cualquier momento. Sin
                permanencia ni costos ocultos.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                actionLoading !== null || reactivateLoading || cancelLoading
              }
            >
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              className={cn(
                confirmDialog?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              disabled={
                actionLoading !== null || reactivateLoading || cancelLoading
              }
              onClick={async (e) => {
                e.preventDefault();

                const action = confirmDialog?.onConfirm;

                if (action) {
                  await action();
                }

                setConfirmDialog(null);
              }}
            >
              {(actionLoading !== null || reactivateLoading || cancelLoading) && (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              )}

              {confirmDialog?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5 rounded-lg space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1">
          <h3 className="text-[13px] font-semibold text-foreground">
            {title}
          </h3>

          {hint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hint}
            </p>
          )}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}

function RadioOption({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-lg border-2 transition-sf bg-secondary/40",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
            active ? "border-primary" : "border-muted-foreground"
          )}
        >
          {active && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>

        <span className="text-[12px] font-medium text-foreground">
          {label}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground pl-5">{desc}</p>
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex-1 min-w-0">
        <span className="text-[12.5px] font-medium text-foreground block">
          {label}
        </span>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>

      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}