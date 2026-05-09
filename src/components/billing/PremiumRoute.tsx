import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan, type PremiumFeature } from "@/hooks/usePlan";

const TITLES: Record<PremiumFeature, string> = {
  advanced_reports: "Informes empresariales",
  resources_management: "Gestión de recursos",
  cost_intelligence: "Inteligencia de costos",
  smart_alerts: "Riesgos y alertas inteligentes",
  executive_dashboard: "Resumen ejecutivo",
  financial_projection: "Proyección financiera",
};

const DESCRIPTIONS: Record<PremiumFeature, string> = {
  advanced_reports: "Los reportes avanzados están reservados para Business.",
  resources_management: "Controla recursos, costos y carga de trabajo por proyecto desde Business.",
  cost_intelligence: "La inteligencia de costos calcula margen, ROI y ganancia real en Business.",
  smart_alerts: "Los riesgos ejecutivos y alertas inteligentes están en Business.",
  executive_dashboard: "La vista ejecutiva consolidada requiere Business.",
  financial_projection: "La proyección financiera multi-proyecto requiere Business.",
};

interface PremiumRouteProps {
  feature: PremiumFeature;
  children: React.ReactNode;
}

export function PremiumRoute({ feature, children }: PremiumRouteProps) {
  const { canAccess, loading } = usePlan();

  if (loading) {
    return (
      <div className="surface-card p-8 rounded-xl animate-pulse text-sm text-muted-foreground">
        Validando acceso…
      </div>
    );
  }

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[55vh] flex items-center justify-center p-4">
      <div className="surface-card max-w-xl w-full p-8 rounded-2xl text-center border-primary/30 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl scorpion-gradient fire-glow flex items-center justify-center">
          <Lock className="w-6 h-6 text-primary-foreground" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-3 h-3" />
          Plan Business
        </div>

        <h1 className="text-xl font-bold fire-text mb-2">{TITLES[feature]}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {DESCRIPTIONS[feature]} Puedes revisar los planes o volver al centro de control.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild className="fire-button border-0 text-white">
            <Link to="/settings?tab=subscription">Ver planes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Volver al Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
