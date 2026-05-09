import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  DollarSign,
  Search,
  Lock,
  Flame,
  Activity,
  TrendingDown,
  Plus,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useMoney } from "@/lib/format-money";
import { useUserSettings } from "@/hooks/useUserSettings";
import { cn } from "@/lib/utils";
import { buildExecutiveRisks } from "@/lib/risk-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UpsellDialog } from "@/components/billing/UpsellDialog";
import { NewRiskDialog } from "@/components/risks/NewRiskDialog";

/**
 * Centro de Riesgos Empresariales (Plan Business)
 * Lenguaje de negocio, no técnico. Responde en 30 segundos:
 * "¿Qué puede salir mal? ¿Cuánto costaría? ¿Quién lo resuelve? ¿Qué hago hoy?"
 *
 * Los riesgos se DERIVAN de datos reales (proyectos, tareas, cotizaciones).
 * No requiere tabla nueva: el negocio ya tiene las señales.
 */

type RiskLevel = "critical" | "high" | "medium" | "low";
type RiskStatus = "open" | "in_treatment" | "mitigated" | "closed";

interface Risk {
  id: string;
  code: string;
  title: string;
  projectId: string | null;
  projectName: string;
  area: string;
  owner: string;
  probability: number; // 0-100
  impact: number; // 0-100
  level: RiskLevel;
  dueDate: string | null;
  status: RiskStatus;
  response: string;
  estimatedCost: number;
  isOverdue: boolean;
  category: "financial" | "schedule" | "client" | "operational" | "supplier";
}

const LEVEL_META: Record<RiskLevel, { label: string; color: string; dot: string }> = {
  critical: { label: "Crítico", color: "text-status-blocked border-status-blocked/40 bg-status-blocked/10", dot: "bg-status-blocked" },
  high:     { label: "Alto",    color: "text-orange-400 border-orange-500/40 bg-orange-500/10", dot: "bg-orange-500" },
  medium:   { label: "Medio",   color: "text-status-review border-status-review/40 bg-status-review/10", dot: "bg-status-review" },
  low:      { label: "Bajo",    color: "text-status-completed border-status-completed/40 bg-status-completed/10", dot: "bg-status-completed" },
};

const STATUS_META: Record<RiskStatus, { label: string; color: string }> = {
  open:         { label: "Abierto",       color: "border-status-blocked/40 text-status-blocked bg-status-blocked/10" },
  in_treatment: { label: "En tratamiento", color: "border-status-review/40 text-status-review bg-status-review/10" },
  mitigated:    { label: "Mitigado",      color: "border-status-progress/40 text-status-progress bg-status-progress/10" },
  closed:       { label: "Cerrado",       color: "border-muted-foreground/40 text-muted-foreground bg-muted/20" },
};

function classifyLevel(probability: number, impact: number): RiskLevel {
  const score = (probability * impact) / 100; // 0-100
  if (score >= 60) return "critical";
  if (score >= 35) return "high";
  if (score >= 15) return "medium";
  return "low";
}

export default function CorporateRisksPage() {
  const { user } = useAuth();
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const { isBusiness, loading: planLoading } = usePlan();

  const [upsellOpen, setUpsellOpen] = useState(false);
  const [newRiskOpen, setNewRiskOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: manualRisks = [] } = useQuery({
    queryKey: ["manual-risks"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("risks")
        .select("id, code, title, project_id, category, probability, impact, estimated_cost, owner_name, due_date, status, mitigation_plan, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // === Data fetching (solo si Business) ===
  const { data: projects = [] } = useQuery({
    queryKey: ["risks-projects"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, status, progress, budget, actual_cost, currency, start_date, end_date, client_id, clients(name), created_at"
        );
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["risks-tasks"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, status, due_date, project_id, assignee_name, blocks_project, blocked_reason, blocked_since, estimated_cost, actual_cost, node_type"
        );
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["risks-quotations"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, title, status, total, close_probability, status_changed_at, client_id, clients(name)");
      if (error) throw error;
      return data as any[];
    },
  });

  // === Riesgos UNIFICADOS — misma fuente que Informes / PDF / Excel ===
  const risks: Risk[] = useMemo(() => {
    if (!isBusiness) return [];
    const exec = buildExecutiveRisks({
      projects, tasks, quotations,
      manualRisks: manualRisks as any[],
      settings,
    });
    return exec.map<Risk>((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      projectId: r.projectId,
      projectName: r.projectName,
      area: r.area,
      owner: r.owner,
      probability: r.probability,
      impact: r.impact,
      level: r.level,
      dueDate: r.dueDate,
      status: r.status,
      response: r.response,
      estimatedCost: r.financialImpact,
      isOverdue: r.isOverdue,
      category: r.category,
    }));
  }, [projects, tasks, quotations, settings, isBusiness, manualRisks]);

  // === Resumen ===
  const summary = useMemo(() => {
    const critical = risks.filter((r) => r.level === "critical" && r.status !== "mitigated" && r.status !== "closed").length;
    const high = risks.filter((r) => r.level === "high" && r.status !== "mitigated" && r.status !== "closed").length;
    const mitigated = risks.filter((r) => r.status === "mitigated" || r.status === "closed").length;
    const overdue = risks.filter((r) => r.isOverdue).length;
    const totalImpact = risks
      .filter((r) => r.status !== "mitigated" && r.status !== "closed")
      .reduce((acc, r) => acc + r.estimatedCost, 0);
    return { critical, high, mitigated, overdue, totalImpact };
  }, [risks]);

  // === Riesgo financiero específico ===
  const financialRisk = useMemo(() => {
    const overruns = risks
      .filter((r) => r.category === "financial" && r.status !== "closed")
      .reduce((acc, r) => acc + r.estimatedCost, 0);
    const delays = risks
      .filter((r) => r.category === "schedule" && r.status !== "closed")
      .reduce((acc, r) => acc + r.estimatedCost, 0);
    const commercial = risks
      .filter((r) => r.category === "client" && r.status !== "closed")
      .reduce((acc, r) => acc + r.estimatedCost, 0);
    const operational = risks
      .filter((r) => r.category === "operational" && r.status !== "closed")
      .reduce((acc, r) => acc + r.estimatedCost, 0);
    return { overruns, delays, commercial, operational };
  }, [risks]);

  // === Alertas ejecutivas ===
  const alerts = useMemo(() => {
    const list: { icon: any; text: string; tone: string }[] = [];
    if (summary.critical > 0) {
      list.push({
        icon: Flame,
        text: `Tienes ${summary.critical} riesgo${summary.critical > 1 ? "s" : ""} crítico${summary.critical > 1 ? "s" : ""} sin resolver`,
        tone: "border-status-blocked/40 bg-status-blocked/10 text-status-blocked",
      });
    }
    if (financialRisk.commercial > 0) {
      list.push({
        icon: AlertTriangle,
        text: `Hay ${PEN.format(financialRisk.commercial)} en cotizaciones que podrías perder este mes`,
        tone: "border-orange-500/40 bg-orange-500/10 text-orange-400",
      });
    }
    if (summary.overdue > 0) {
      list.push({
        icon: Clock,
        text: `${summary.overdue} riesgo${summary.overdue > 1 ? "s" : ""} con fecha límite vencida`,
        tone: "border-status-blocked/40 bg-status-blocked/10 text-status-blocked",
      });
    }
    if (financialRisk.overruns > 0) {
      list.push({
        icon: TrendingDown,
        text: `Caja comprometida: posibles sobrecostos por ${PEN.format(financialRisk.overruns)}`,
        tone: "border-status-review/40 bg-status-review/10 text-status-review",
      });
    }
    if (list.length === 0) {
      list.push({
        icon: ShieldCheck,
        text: "Tu negocio no muestra alertas críticas hoy. Buen momento para planificar.",
        tone: "border-status-completed/40 bg-status-completed/10 text-status-completed",
      });
    }
    return list;
  }, [summary, financialRisk, PEN]);

  // === Filtros ===
  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter === "critical" && r.level !== "critical") return false;
      if (categoryFilter === "financial" && r.category !== "financial") return false;
      if (categoryFilter === "operational" && r.category !== "operational" && r.category !== "schedule") return false;
      if (categoryFilter === "closed" && r.status !== "closed" && r.status !== "mitigated") return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.title.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [risks, levelFilter, statusFilter, categoryFilter, search]);

  // === Plan gate ===
  if (!planLoading && !isBusiness) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-3xl mx-auto mt-12">
          <Card className="bg-card/40 border-primary/30">
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Centro de Riesgos Empresariales</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Vista ejecutiva de todo lo que puede impactar tu negocio: sobrecostos,
                bloqueos, atrasos y oportunidades en peligro. Disponible en el plan{" "}
                <span className="text-primary font-semibold">Business</span>.
              </p>
              <button
                onClick={() => setUpsellOpen(true)}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-sf"
              >
                Conocer plan Business
              </button>
            </CardContent>
          </Card>
        </div>
        <UpsellDialog
          open={upsellOpen}
          onOpenChange={setUpsellOpen}
          feature="executive_dashboard"
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground p-6 space-y-6">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-status-blocked/15 border border-status-blocked/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-status-blocked" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Centro de Riesgos Empresariales</h1>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Anticipa problemas, protege utilidad y toma acción antes de perder dinero.
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewRiskOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-sf"
            >
              <Plus className="w-4 h-4" /> Nuevo riesgo
            </button>
            <NewRiskDialog open={newRiskOpen} onOpenChange={setNewRiskOpen} />
          </div>

          {/* Filtros rápidos por categoría */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: "all", label: "Todos" },
              { id: "critical", label: "Críticos" },
              { id: "financial", label: "Financieros" },
              { id: "operational", label: "Operativos" },
              { id: "closed", label: "Cerrados" },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-sf",
                  categoryFilter === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card/40 text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                )}
              >
                {c.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="w-3 h-3" />
              {filteredRisks.length} riesgo{filteredRisks.length === 1 ? "" : "s"} en vista
            </div>
          </div>
        </header>

        {/* SECCIÓN 1: RESUMEN */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard
            label="Riesgos críticos"
            value={summary.critical}
            icon={Flame}
            tone="text-status-blocked"
            bg="bg-status-blocked/10 border-status-blocked/30"
          />
          <SummaryCard
            label="Riesgos altos"
            value={summary.high}
            icon={AlertTriangle}
            tone="text-orange-400"
            bg="bg-orange-500/10 border-orange-500/30"
          />
          <SummaryCard
            label="Mitigados"
            value={summary.mitigated}
            icon={ShieldCheck}
            tone="text-status-completed"
            bg="bg-status-completed/10 border-status-completed/30"
          />
          <SummaryCard
            label="Vencidos"
            value={summary.overdue}
            icon={Clock}
            tone="text-status-review"
            bg="bg-status-review/10 border-status-review/30"
          />
          <SummaryCard
            label="Impacto financiero"
            value={PEN.format(summary.totalImpact)}
            icon={DollarSign}
            tone="text-primary"
            bg="bg-primary/10 border-primary/30"
            isCurrency
          />
        </section>

        {/* SECCIÓN 5: ALERTAS (subida arriba para visibilidad ejecutiva) */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            Alertas que necesitan tu atención
          </h2>
          <div className="grid gap-2">
            {alerts.map((a, i) => {
              const Icon = a.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border text-sm",
                    a.tone
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{a.text}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN 2: MATRIZ DE RIESGO */}
        <section>
          <Card className="bg-card/40 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Matriz de riesgo
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Probabilidad de que ocurra (eje X) vs cuánto te dolería (eje Y).
                Mientras más arriba a la derecha, más urgente.
              </p>
            </CardHeader>
            <CardContent>
              <RiskMatrix risks={risks.filter((r) => r.status !== "mitigated" && r.status !== "closed")} formatMoney={(n) => PEN.format(n)} />
            </CardContent>
          </Card>
        </section>

        {/* SECCIÓN 4: RIESGO FINANCIERO */}
        <section>
          <Card className="bg-card/40 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Riesgo financiero del negocio
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Cuánto dinero está en juego si los riesgos no se controlan.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FinancialBlock
                  label="Sobrecostos potenciales"
                  hint="Proyectos que pueden gastar más de lo presupuestado."
                  value={PEN.format(financialRisk.overruns)}
                  tone="text-status-blocked"
                />
                <FinancialBlock
                  label="Multas o retrasos"
                  hint="Pérdidas por no cumplir fechas comprometidas."
                  value={PEN.format(financialRisk.delays)}
                  tone="text-orange-400"
                />
                <FinancialBlock
                  label="Cobros en riesgo"
                  hint="Cotizaciones grandes que pueden enfriarse."
                  value={PEN.format(financialRisk.commercial)}
                  tone="text-status-review"
                />
                <FinancialBlock
                  label="Operación bloqueada"
                  hint="Costo estimado de tareas críticas frenadas."
                  value={PEN.format(financialRisk.operational)}
                  tone="text-primary"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SECCIÓN 3: REGISTRO DE RIESGOS */}
        <section>
          <Card className="bg-card/40 border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Registro de riesgos</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Detalle completo. Filtra por nivel, estado o búsqueda libre.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 w-44 text-xs"
                    />
                  </div>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="low">Bajo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="open">Abierto</SelectItem>
                      <SelectItem value="in_treatment">En tratamiento</SelectItem>
                      <SelectItem value="mitigated">Mitigado</SelectItem>
                      <SelectItem value="closed">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRisks.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No hay riesgos que coincidan con los filtros.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60">
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Riesgo</TableHead>
                        <TableHead className="text-xs">Proyecto</TableHead>
                        <TableHead className="text-xs">Área</TableHead>
                        <TableHead className="text-xs">Responsable</TableHead>
                        <TableHead className="text-xs text-right">Prob.</TableHead>
                        <TableHead className="text-xs text-right">Impacto</TableHead>
                        <TableHead className="text-xs">Nivel</TableHead>
                        <TableHead className="text-xs">Fecha límite</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Plan de respuesta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRisks.map((r) => {
                        const lvl = LEVEL_META[r.level];
                        const st = STATUS_META[r.status];
                        return (
                          <TableRow key={r.id} className="border-border/40 hover:bg-muted/20">
                            <TableCell className="text-xs font-mono text-muted-foreground">{r.code}</TableCell>
                            <TableCell className="text-xs font-medium max-w-[240px]">{r.title}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.projectName}</TableCell>
                            <TableCell className="text-xs">{r.area}</TableCell>
                            <TableCell className="text-xs">{r.owner}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.probability}%</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.impact}%</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px] uppercase", lvl.color)}>
                                {lvl.label}
                              </Badge>
                            </TableCell>
                            <TableCell className={cn("text-xs", r.isOverdue && "text-status-blocked font-medium")}>
                              {r.dueDate ? new Date(r.dueDate).toLocaleDateString("es-PE") : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px]", st.color)}>
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px]">{r.response}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

// =========================
// Subcomponentes
// =========================

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  bg,
  isCurrency,
}: {
  label: string;
  value: number | string;
  icon: any;
  tone: string;
  bg: string;
  isCurrency?: boolean;
}) {
  return (
    <Card className={cn("border", bg)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </span>
          <Icon className={cn("w-4 h-4", tone)} />
        </div>
        <div className={cn("mt-2 font-bold tabular-nums", isCurrency ? "text-xl" : "text-3xl", tone)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialBlock({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("mt-2 text-xl font-bold tabular-nums", tone)}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</div>
    </div>
  );
}

function RiskMatrix({
  risks,
  formatMoney,
}: {
  risks: Risk[];
  formatMoney: (n: number) => string;
}) {
  // Cuadrícula 5x5 (impact rows arriba→abajo: 5..1, prob cols 1..5)
  const cellRisks = (probBucket: number, impactBucket: number) =>
    risks.filter((r) => {
      const pb = Math.min(5, Math.max(1, Math.ceil(r.probability / 20)));
      const ib = Math.min(5, Math.max(1, Math.ceil(r.impact / 20)));
      return pb === probBucket && ib === impactBucket;
    });

  const cellTone = (probBucket: number, impactBucket: number) => {
    const score = probBucket * impactBucket;
    if (score >= 16) return "bg-status-blocked/15 border-status-blocked/30";
    if (score >= 9) return "bg-orange-500/10 border-orange-500/25";
    if (score >= 4) return "bg-status-review/10 border-status-review/25";
    return "bg-status-completed/10 border-status-completed/25";
  };

  return (
    <div className="flex gap-3">
      {/* Eje Y label */}
      <div className="flex flex-col justify-between text-[10px] text-muted-foreground uppercase tracking-wider py-1">
        <span>Alto impacto</span>
        <span className="rotate-180" style={{ writingMode: "vertical-rl" as any }}>
          Impacto al negocio
        </span>
        <span>Bajo</span>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-5 gap-1">
          {[5, 4, 3, 2, 1].flatMap((impactBucket) =>
            [1, 2, 3, 4, 5].map((probBucket) => {
              const cell = cellRisks(probBucket, impactBucket);
              return (
                <Tooltip key={`${probBucket}-${impactBucket}`} delayDuration={150}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square rounded-md border flex items-center justify-center relative cursor-default transition-sf",
                        cellTone(probBucket, impactBucket),
                        cell.length > 0 && "ring-1 ring-foreground/10"
                      )}
                    >
                      {cell.length > 0 && (
                        <span className="text-sm font-bold text-foreground">
                          {cell.length}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  {cell.length > 0 && (
                    <TooltipContent side="top" className="max-w-xs p-0 overflow-hidden">
                      <div className="p-3 space-y-2">
                        {cell.slice(0, 4).map((r) => (
                          <div key={r.id} className="text-xs space-y-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                            <div className="font-semibold text-foreground">{r.title}</div>
                            <div className="text-muted-foreground">{r.projectName} · {r.owner}</div>
                            <div className="text-muted-foreground">
                              Costo estimado: <span className="text-foreground font-medium">{formatMoney(r.estimatedCost)}</span>
                            </div>
                            <div className="text-primary text-[11px]">→ {r.response}</div>
                          </div>
                        ))}
                        {cell.length > 4 && (
                          <div className="text-[11px] text-muted-foreground">
                            +{cell.length - 4} más en este cuadrante
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })
          )}
        </div>

        {/* Eje X label */}
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider mt-2 px-1">
          <span>Baja probabilidad</span>
          <span>Probabilidad de que ocurra</span>
          <span>Alta</span>
        </div>
      </div>
    </div>
  );
}
