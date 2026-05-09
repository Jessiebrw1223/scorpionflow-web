import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileBarChart2, Download, Filter, Lock, FileSpreadsheet, TrendingUp, AlertTriangle, Lightbulb, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useMoney } from "@/lib/format-money";
import { useUserSettings } from "@/hooks/useUserSettings";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  buildConsolidatedKPIs,
  buildExecutiveConclusion,
  buildExecutiveInsights,
  buildRecommendations,
  computeClientInsights,
  type BusinessReportData,
  type ExecutiveInsight,
  type InsightProject,
  type InsightQuotation,
  type InsightResource,
} from "@/lib/business-insights";
import { buildExecutiveRisks } from "@/lib/risk-engine";

const CATEGORY_LABEL: Record<string, string> = {
  financial: "Financiero", operational: "Operativo", technical: "Técnico",
  commercial: "Comercial", hr: "RRHH", legal: "Legal",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Abierto", in_treatment: "En mitigación", mitigated: "Mitigado", closed: "Cerrado",
};

export default function CorporateReportsPage() {
  const { user } = useAuth();
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const { isBusiness, loading: planLoading } = usePlan();
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: projectsRaw = [] } = useQuery({
    queryKey: ["corp-reports-projects"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, progress, budget, actual_cost, start_date, end_date, client_id, clients(name)");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: quotationsRaw = [] } = useQuery({
    queryKey: ["corp-reports-quotations"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, status, total, client_id");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: manualRisksRaw = [] } = useQuery({
    queryKey: ["corp-reports-risks"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("risks")
        .select("id, code, title, project_id, category, probability, impact, estimated_cost, owner_name, due_date, status, mitigation_plan, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasksRaw = [] } = useQuery({
    queryKey: ["corp-reports-tasks"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, assignee_name, blocks_project, blocked_reason, blocked_since, estimated_cost, actual_cost, node_type");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: quotationsFullRaw = [] } = useQuery({
    queryKey: ["corp-reports-quotations-full"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, title, status, total, close_probability, status_changed_at, client_id, clients(name)");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: resourcesRaw = [] } = useQuery({
    queryKey: ["corp-reports-resources"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_resources")
        .select("id, name, kind, total_cost, project_id");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filteredProjects = useMemo(
    () => projectsRaw.filter((p) => clientFilter === "all" || p.client_id === clientFilter),
    [projectsRaw, clientFilter],
  );

  const projects: InsightProject[] = useMemo(
    () => filteredProjects.map((p) => {
      const budget = Number(p.budget) || 0;
      const actual_cost = Number(p.actual_cost) || 0;
      const profit = budget - actual_cost;
      return {
        id: p.id,
        name: p.name,
        client_id: p.client_id,
        client_name: p.clients?.name ?? "Sin cliente",
        status: p.status,
        progress: Number(p.progress) || 0,
        budget,
        actual_cost,
        profit,
        margin: budget > 0 ? (profit / budget) * 100 : 0,
        start_date: p.start_date,
        end_date: p.end_date,
      };
    }),
    [filteredProjects],
  );

  const quotations: InsightQuotation[] = useMemo(
    () => quotationsRaw.map((q) => ({ id: q.id, status: q.status, total: Number(q.total) || 0, client_id: q.client_id })),
    [quotationsRaw],
  );

  // Riesgos unificados — misma fuente que UI Riesgos
  const risks = useMemo(
    () =>
      buildExecutiveRisks({
        projects: filteredProjects,
        tasks: tasksRaw,
        quotations: quotationsFullRaw,
        manualRisks: manualRisksRaw as any[],
        settings,
      }),
    [filteredProjects, tasksRaw, quotationsFullRaw, manualRisksRaw, settings],
  );

  const topResources: InsightResource[] = useMemo(
    () => [...resourcesRaw]
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, total_cost: Number(r.total_cost) || 0, project_id: r.project_id }))
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 10),
    [resourcesRaw],
  );

  const clientInsights = useMemo(() => computeClientInsights(projects), [projects]);
  const topClients = useMemo(() => [...clientInsights].sort((a, b) => b.total_billed - a.total_billed).slice(0, 5), [clientInsights]);
  const worstClients = useMemo(
    () => [...clientInsights].filter((c) => c.projects_count > 0).sort((a, b) => a.margin - b.margin).slice(0, 5),
    [clientInsights],
  );

  const kpis = useMemo(
    () => buildConsolidatedKPIs({
      projects, quotations, risks, clientInsights,
      targetMargin: settings.target_margin,
    }),
    [projects, quotations, risks, clientInsights, settings.target_margin],
  );

  const insights = useMemo(
    () => buildExecutiveInsights({ kpis, projects, clients: clientInsights, risks }),
    [kpis, projects, clientInsights, risks],
  );
  const recommendations = useMemo(() => buildRecommendations(insights, kpis), [insights, kpis]);
  const conclusion = useMemo(() => buildExecutiveConclusion(kpis), [kpis]);

  const clientsList = useMemo(() => {
    const m = new Map<string, string>();
    projectsRaw.forEach((p) => p.client_id && p.clients?.name && m.set(p.client_id, p.clients.name));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [projectsRaw]);

  function buildPayload(): BusinessReportData {
    return {
      companyName: user?.email?.split("@")[0] ?? "Mi empresa",
      generatedAt: new Date(),
      kpis,
      projects,
      topClients,
      worstClients,
      risks,
      topResources,
      teamLoad: [],
      insights,
      recommendations,
      conclusion,
    };
  }

  async function exportXlsx() {
    try {
      const { generateExcelReport } = await import("@/lib/exporters/excel-report");
      await generateExcelReport(buildPayload());
      toast.success("Informe Excel descargado");
    } catch (e: any) {
      toast.error("Error al generar Excel: " + (e?.message ?? ""));
    }
  }

  async function exportPdf() {
    try {
      const { generatePdfReport } = await import("@/lib/exporters/pdf-report");
      await generatePdfReport(buildPayload());
      toast.success("Informe PDF descargado");
    } catch (e: any) {
      toast.error("Error al generar PDF: " + (e?.message ?? ""));
    }
  }

  if (!planLoading && !isBusiness) {
    return (
      <div className="surface-card p-10 text-center max-w-2xl mx-auto">
        <Lock className="w-10 h-10 text-primary mx-auto mb-4 fire-icon" />
        <h1 className="text-xl font-bold mb-2 fire-text">Informes ejecutivos</h1>
        <p className="text-sm text-muted-foreground mb-6">
          El centro de inteligencia empresarial está disponible solo en el plan <strong>Business</strong>.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-sf"
        >
          Actualizar a Business
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <FileBarChart2 className="w-5 h-5 text-primary fire-icon" />
            Centro de Inteligencia Ejecutiva
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Consolidado de toda la operación · Project + Business Intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clientsList.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportXlsx} className="h-8 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button size="sm" onClick={exportPdf} className="h-8 text-xs">
            <Download className="w-3.5 h-3.5 mr-1" /> PDF Ejecutivo
          </Button>
        </div>
      </div>

      {/* Executive snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiBlock label="Facturación" value={PEN.format(kpis.finance.billed)} />
        <KpiBlock label="Utilidad neta" value={PEN.format(kpis.finance.profit)} tone={kpis.finance.profit >= 0 ? "positive" : "negative"} />
        <KpiBlock label="Margen" value={`${kpis.finance.margin.toFixed(1)}%`} tone={kpis.finance.margin >= kpis.finance.target_margin ? "positive" : kpis.finance.margin >= 0 ? "neutral" : "negative"} />
        <KpiBlock label="Riesgos críticos" value={String(kpis.risks.critical)} tone={kpis.risks.critical > 0 ? "negative" : "positive"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiBlock label="Proyectos activos" value={`${kpis.projects.active}/${kpis.projects.total}`} />
        <KpiBlock label="Sobrepresupuestados" value={String(kpis.projects.over_budget)} tone={kpis.projects.over_budget > 0 ? "negative" : "neutral"} />
        <KpiBlock label="Conversión comercial" value={`${kpis.quotations.conversion_rate}%`} tone={kpis.quotations.conversion_rate >= 50 ? "positive" : kpis.quotations.conversion_rate >= 30 ? "neutral" : "negative"} />
        <KpiBlock label="Pipeline activo" value={PEN.format(kpis.quotations.pipeline_value)} />
      </div>

      {/* Executive insights */}
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Lectura ejecutiva del negocio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{conclusion}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InsightsPanel title="Hallazgos del negocio" icon={<AlertTriangle className="w-4 h-4 text-primary" />} items={insights} />
        <InsightsPanel title="Acciones recomendadas" icon={<Lightbulb className="w-4 h-4 text-primary" />} items={recommendations} />
      </div>

      {/* Top clients */}
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Clientes más rentables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin datos suficientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Cliente</th>
                    <th className="pb-2 pr-3 text-right">Proyectos</th>
                    <th className="pb-2 pr-3 text-right">Facturado</th>
                    <th className="pb-2 pr-3 text-right">Utilidad</th>
                    <th className="pb-2 pr-3 text-right">Margen</th>
                    <th className="pb-2 text-right">% Cartera</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((c) => (
                    <tr key={c.client_id} className="border-b border-border/40">
                      <td className="py-2 pr-3">{c.client_name}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{c.projects_count}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(c.total_billed)}</td>
                      <td className={cn("py-2 pr-3 text-right font-mono-data font-semibold", c.profit >= 0 ? "text-cost-positive" : "text-cost-negative")}>{PEN.format(c.profit)}</td>
                      <td className={cn("py-2 pr-3 text-right font-mono-data", c.margin >= 20 ? "text-cost-positive" : c.margin >= 0 ? "text-amber-400" : "text-cost-negative")}>{c.margin.toFixed(1)}%</td>
                      <td className="py-2 text-right font-mono-data">{c.revenue_share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle proyectos */}
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalle por proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No hay proyectos con los filtros aplicados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Proyecto</th>
                    <th className="pb-2 pr-3">Cliente</th>
                    <th className="pb-2 pr-3 text-right">Avance</th>
                    <th className="pb-2 pr-3 text-right">Facturado</th>
                    <th className="pb-2 pr-3 text-right">Costo</th>
                    <th className="pb-2 pr-3 text-right">Utilidad</th>
                    <th className="pb-2 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pr-3 text-foreground">{r.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.client_name}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{r.progress}%</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(r.budget)}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(r.actual_cost)}</td>
                      <td className={cn("py-2 pr-3 text-right font-mono-data font-semibold", r.profit >= 0 ? "text-cost-positive" : "text-cost-negative")}>{PEN.format(r.profit)}</td>
                      <td className={cn("py-2 text-right font-mono-data", r.margin >= 20 ? "text-cost-positive" : r.margin >= 0 ? "text-amber-400" : "text-cost-negative")}>{r.margin.toFixed(0)}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 pr-3">Totales</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(kpis.finance.billed)}</td>
                    <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(kpis.finance.cost)}</td>
                    <td className={cn("py-2 pr-3 text-right font-mono-data", kpis.finance.profit >= 0 ? "text-cost-positive" : "text-cost-negative")}>{PEN.format(kpis.finance.profit)}</td>
                    <td className="py-2 text-right font-mono-data">{kpis.finance.margin.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiBlock({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "negative" | "positive" }) {
  const toneClass = tone === "negative" ? "text-cost-negative" : tone === "positive" ? "text-cost-positive" : "text-foreground";
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-base font-bold font-mono-data", toneClass)}>{value}</div>
    </div>
  );
}

function InsightsPanel({ title, icon, items }: { title: string; icon: React.ReactNode; items: ExecutiveInsight[] }) {
  return (
    <Card className="surface-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sin hallazgos en este período.</p>
        ) : items.map((it, i) => {
          const accent =
            it.type === "critical" ? "border-l-cost-negative" :
            it.type === "warning" ? "border-l-amber-500" :
            it.type === "positive" ? "border-l-cost-positive" : "border-l-muted-foreground";
          const badge =
            it.type === "critical" ? "destructive" :
            it.type === "warning" ? "secondary" :
            it.type === "positive" ? "default" : "outline";
          return (
            <div key={i} className={cn("border-l-2 pl-3 py-1.5 bg-muted/20 rounded-r", accent)}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[13px] font-semibold text-foreground">{it.title}</p>
                <Badge variant={badge as any} className="text-[9px] uppercase tracking-wider">{it.category}</Badge>
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-snug">{it.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
