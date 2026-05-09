import { Link, Navigate } from "react-router-dom";
import {
  Flame,
  ArrowRight,
  Users,
  Target,
  Activity,
  BarChart3,
  ShieldAlert,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AreaSection {
  id: string;
  icon: React.ElementType;
  label: string;
  title: string;
  steps: string[];
}

const AREAS: AreaSection[] = [
  {
    id: "comercial",
    icon: Users,
    label: "Área comercial",
    title: "Vende con orden, sin perder seguimiento.",
    steps: [
      "Crear cliente",
      "Crear cotización",
      "Enviar o registrar seguimiento",
      "Marcar como ganada",
      "Convertir en proyecto",
    ],
  },
  {
    id: "proyectos",
    icon: Target,
    label: "Área de proyectos",
    title: "Ejecuta sin perder el control del avance.",
    steps: [
      "Revisar proyectos",
      "Planificar en modo ágil o tradicional",
      "Crear tareas reales",
      "Asignar responsables",
      "Medir avance real",
    ],
  },
  {
    id: "costos",
    icon: Wallet,
    label: "Área de costos",
    title: "Sabe cuánto cuesta y cuánto deja cada proyecto.",
    steps: [
      "Registrar recursos",
      "Asignar costos",
      "Ver sobrecostos",
      "Revisar utilidad del proyecto",
    ],
  },
  {
    id: "riesgos",
    icon: ShieldAlert,
    label: "Área de riesgos",
    title: "Anticipa lo que puede salir mal.",
    steps: [
      "Registrar riesgo",
      "Medir probabilidad e impacto",
      "Asignar responsable",
      "Definir acción de mitigación",
    ],
  },
  {
    id: "gerencia",
    icon: BarChart3,
    label: "Área gerencial",
    title: "Decide con datos, no con intuición.",
    steps: [
      "Ver dashboard",
      "Revisar rentabilidad",
      "Detectar proyectos críticos",
      "Descargar informes",
      "Tomar decisiones rápidas",
    ],
  },
];

export default function ComoFuncionaPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center fire-glow">
              <Flame className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">
              Scorpion<span className="text-primary">Flow</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
            <Link to="/#problema" className="hover:text-foreground transition-colors">Problema</Link>
            <Link to="/#solucion" className="hover:text-foreground transition-colors">Solución</Link>
            <Link to="/como-funciona" className="text-foreground transition-colors">Cómo funciona</Link>
            <Link to="/#nosotros" className="hover:text-foreground transition-colors">Nosotros</Link>
            <Link to="/#precios" className="hover:text-foreground transition-colors">Precios</Link>
            <Link to="/#faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-[13px]">Ingresar</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="fire-button text-[13px] font-semibold">
                Empezar gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">
            Cómo funciona
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Cómo usar ScorpionFlow
            <span className="block text-primary">según tu área.</span>
          </h1>
          <p className="mt-5 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            No necesitas saber de gestión avanzada. Sigue el flujo natural: vende, ejecuta, controla y mejora.
          </p>
        </div>
      </section>

      {/* AREAS */}
      <section className="border-t border-border/60">
        <div className="max-w-5xl mx-auto px-5 py-16 space-y-10">
          {AREAS.map(({ id, icon: Icon, label, title, steps }, idx) => (
            <div
              key={id}
              id={id}
              className="rounded-2xl border border-border bg-card p-6 md:p-8 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">
                    {String.fromCharCode(65 + idx)}. {label}
                  </span>
                  <h2 className="mt-1 text-xl md:text-2xl font-bold tracking-tight">
                    {title}
                  </h2>
                </div>
              </div>
              <ol className="grid sm:grid-cols-2 gap-3">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-primary">{i + 1}</span>
                    </div>
                    <span className="text-sm pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-gradient-to-b from-background to-secondary/30 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="max-w-3xl mx-auto px-5 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Empieza gratis y prueba
            <span className="block text-primary">el flujo completo.</span>
          </h2>
          <p className="mt-5 text-muted-foreground">
            Sin tarjeta de crédito. Sin compromiso. Empiezas en minutos.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth/register">
              <Button size="lg" className="fire-button h-12 px-8 font-semibold gap-2">
                <Flame className="w-4 h-4" />
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="outline" className="h-12 px-8 gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Volver al inicio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-primary" />
            <span>© {new Date().getFullYear()} ScorpionFlow — Gestiona y entiende tu negocio.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/auth/login" className="hover:text-foreground transition-colors">Ingresar</Link>
            <Link to="/auth/register" className="hover:text-foreground transition-colors">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
