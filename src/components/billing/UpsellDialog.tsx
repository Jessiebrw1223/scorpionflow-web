import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Check, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlan, type PremiumFeature, type PlanId } from "@/hooks/usePlan";
import { humanizeError, humanizeFunctionError } from "@/lib/humanize-error";

interface UpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: PremiumFeature;
  /** Forzar un plan específico a recomendar (override) — ignorado en beta */
  recommendedPlan?: PlanId;
  /** Razón mostrada en el header (ej: "Has alcanzado el límite de usuarios") */
  reason?: string;
}

const BUSINESS_BENEFITS = [
  "Visión financiera global multi-proyecto",
  "Dashboard ejecutivo y proyección financiera",
  "Reportes ejecutivos descargables",
  "Soporte prioritario",
];

const FEATURE_HEADLINES: Record<PremiumFeature, string> = {
  advanced_reports: "Los informes avanzados están en Business",
  resources_management: "La gestión avanzada de recursos está en Business",
  cost_intelligence: "La inteligencia de costos está en Business",
  smart_alerts: "Las alertas inteligentes están en Business",
  executive_dashboard: "El dashboard ejecutivo está en Business",
  financial_projection: "La proyección financiera está en Business",
};

const FEATURE_PITCHES: Record<PremiumFeature, string> = {
  advanced_reports: "Mide rentabilidad real, márgenes y desempeño por proyecto.",
  resources_management: "Controla personal, maquinaria y costos por recurso.",
  cost_intelligence: "Calcula automáticamente ganancia, ROI y margen por proyecto.",
  smart_alerts: "Recibe avisos cuando un proyecto pierde dinero o entra en riesgo.",
  executive_dashboard: "Visión consolidada multi-proyecto con KPIs estratégicos.",
  financial_projection: "Proyecta ingresos, costos y rentabilidad a futuro.",
};

export function UpsellDialog({
  open,
  onOpenChange,
  feature,
  reason,
}: UpsellDialogProps) {
  const navigate = useNavigate();
  usePlan();
  const [loading, setLoading] = useState(false);

  const headline = feature
    ? FEATURE_HEADLINES[feature]
    : "Desbloquea ScorpionFlow Business";
  const pitch = feature
    ? FEATURE_PITCHES[feature]
    : "Lleva tu negocio al siguiente nivel con control financiero real.";

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mercadopago-checkout", {
        body: {},
      });
      if (error || (data && (data as any).error)) {
        toast.error("No pudimos conectar con Mercado Pago", {
          description: humanizeFunctionError(error, data, "Intenta nuevamente en unos segundos."),
        });
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        onOpenChange(false);
      } else {
        toast.error("No pudimos conectar con Mercado Pago", {
          description: "Intenta nuevamente en unos segundos.",
        });
      }
    } catch (e) {
      toast.error("No pudimos conectar con Mercado Pago", {
        description: humanizeError(e, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-primary/30">
        <DialogTitle className="sr-only">{headline}</DialogTitle>
        <DialogDescription className="sr-only">{pitch}</DialogDescription>
        <div className="relative bg-gradient-to-br from-primary/15 via-background to-background p-6">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-sf"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative w-14 h-14 mb-4">
            <div className="absolute inset-0 rounded-2xl scorpion-gradient flex items-center justify-center fire-glow shadow-lg">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-primary animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" />
            Plan Business
          </div>

          {reason && (
            <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">
              {reason}
            </div>
          )}

          <h2 className="text-xl font-bold text-foreground mb-1 leading-tight">
            {headline}
          </h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            {pitch}
          </p>

          <div className="rounded-xl border border-primary/30 bg-card/60 p-4 mb-5">
            <div className="flex items-baseline gap-1 mb-3">
              <span className="font-mono-data text-3xl font-bold text-foreground">S/90</span>
              <span className="text-[12px] text-muted-foreground">/ mes</span>
            </div>

            <ul className="space-y-1.5">
              {BUSINESS_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12.5px] text-foreground/90">
                  <Check className="w-3.5 h-3.5 text-cost-positive shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings?tab=subscription");
              }}
            >
              Ver planes
            </Button>
            <Button
              className="flex-1 fire-button border-0 text-white h-10 font-semibold"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Activar Business"
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Pago seguro con Mercado Pago · Cancela cuando quieras
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
