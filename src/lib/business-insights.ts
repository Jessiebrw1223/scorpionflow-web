// Business Intelligence insights — consolidates clients, quotations, projects,
// resources, risks and team into executive KPIs and narrative recommendations.

import type { ExecutiveRisk } from "@/lib/risk-engine";
import { summarizeRisks } from "@/lib/risk-engine";

export interface InsightProject {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string;
  status: string;
  progress: number;
  budget: number;
  actual_cost: number;
  profit: number;
  margin: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface InsightRisk {
  id: string;
  code: string;
  title: string;
  category: string;
  probability: number;
  impact: number;
  estimated_cost: number;
  status: string;
  project_name: string;
  level: "Crítico" | "Alto" | "Medio" | "Bajo";
}

export interface InsightQuotation {
  id: string;
  status: string;
  total: number;
  client_id: string | null;
}

export interface InsightResource {
  id: string;
  name: string;
  kind: string;
  total_cost: number;
  project_id: string | null;
}

export interface InsightTeamLoad {
  user_id: string | null;
  name: string;
  active_tasks: number;
  blocked_tasks: number;
  completed_tasks: number;
}

export interface ClientInsight {
  client_id: string;
  client_name: string;
  projects_count: number;
  total_billed: number;
  total_cost: number;
  profit: number;
  margin: number;
  revenue_share: number; // % of total revenue
}

export interface ConsolidatedKPIs {
  projects: {
    total: number;
    active: number;
    delayed: number;
    over_budget: number;
    avg_progress: number;
  };
  finance: {
    billed: number;
    cost: number;
    profit: number;
    margin: number;
    target_margin: number;
  };
  quotations: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    conversion_rate: number;
    pipeline_value: number;
  };
  risks: {
    total: number;
    critical: number;
    open: number;
    financial_impact: number;
  };
  clients: {
    total: number;
    top_dependency_share: number; // % from top client
  };
}

export interface ExecutiveInsight {
  type: "positive" | "warning" | "critical" | "neutral";
  category: string;
  title: string;
  detail: string;
}

export interface BusinessReportData {
  companyName: string;
  generatedAt: Date;
  kpis: ConsolidatedKPIs;
  projects: InsightProject[];
  topClients: ClientInsight[];
  worstClients: ClientInsight[];
  risks: ExecutiveRisk[];
  topResources: InsightResource[];
  teamLoad: InsightTeamLoad[];
  insights: ExecutiveInsight[];
  recommendations: ExecutiveInsight[];
  conclusion: string;
}

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 }).format(n || 0);

export function computeClientInsights(projects: InsightProject[]): ClientInsight[] {
  const map = new Map<string, ClientInsight>();
  for (const p of projects) {
    if (!p.client_id) continue;
    const existing = map.get(p.client_id) ?? {
      client_id: p.client_id,
      client_name: p.client_name,
      projects_count: 0,
      total_billed: 0,
      total_cost: 0,
      profit: 0,
      margin: 0,
      revenue_share: 0,
    };
    existing.projects_count += 1;
    existing.total_billed += p.budget;
    existing.total_cost += p.actual_cost;
    map.set(p.client_id, existing);
  }
  const totalBilled = Array.from(map.values()).reduce((s, c) => s + c.total_billed, 0) || 1;
  return Array.from(map.values()).map((c) => ({
    ...c,
    profit: c.total_billed - c.total_cost,
    margin: c.total_billed > 0 ? ((c.total_billed - c.total_cost) / c.total_billed) * 100 : 0,
    revenue_share: (c.total_billed / totalBilled) * 100,
  }));
}

export function classifyRiskLevel(probability: number, impact: number): InsightRisk["level"] {
  const score = Math.round((probability * impact) / 100);
  if (score >= 76) return "Crítico";
  if (score >= 51) return "Alto";
  if (score >= 21) return "Medio";
  return "Bajo";
}

export function buildConsolidatedKPIs(args: {
  projects: InsightProject[];
  quotations: InsightQuotation[];
  risks: ExecutiveRisk[];
  clientInsights: ClientInsight[];
  targetMargin: number;
}): ConsolidatedKPIs {
  const { projects, quotations, risks, clientInsights, targetMargin } = args;
  const billed = projects.reduce((s, p) => s + p.budget, 0);
  const cost = projects.reduce((s, p) => s + p.actual_cost, 0);
  const profit = billed - cost;
  const margin = billed > 0 ? (profit / billed) * 100 : 0;

  const won = quotations.filter((q) => q.status === "approved" || q.status === "won").length;
  const lost = quotations.filter((q) => q.status === "rejected" || q.status === "lost").length;
  const pending = quotations.filter((q) => q.status === "pending" || q.status === "sent").length;
  const totalQ = quotations.length;
  const closed = won + lost;
  const pipelineValue = quotations
    .filter((q) => q.status === "pending" || q.status === "sent")
    .reduce((s, q) => s + (Number(q.total) || 0), 0);

  const topClient = [...clientInsights].sort((a, b) => b.total_billed - a.total_billed)[0];
  const riskSummary = summarizeRisks(risks);

  return {
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length,
      delayed: projects.filter((p) => p.status === "delayed" || p.status === "at_risk").length,
      over_budget: projects.filter((p) => p.budget > 0 && p.actual_cost > p.budget).length,
      avg_progress:
        projects.length > 0
          ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
          : 0,
    },
    finance: { billed, cost, profit, margin, target_margin: targetMargin },
    quotations: {
      total: totalQ,
      won,
      lost,
      pending,
      conversion_rate: closed > 0 ? Math.round((won / closed) * 100) : 0,
      pipeline_value: pipelineValue,
    },
    risks: {
      total: riskSummary.total,
      critical: riskSummary.critical,
      open: riskSummary.open,
      financial_impact: riskSummary.financialImpact,
    },
    clients: {
      total: clientInsights.length,
      top_dependency_share: topClient ? topClient.revenue_share : 0,
    },
  };
}

export function buildExecutiveInsights(data: {
  kpis: ConsolidatedKPIs;
  projects: InsightProject[];
  clients: ClientInsight[];
  risks: ExecutiveRisk[];
}): ExecutiveInsight[] {
  const out: ExecutiveInsight[] = [];
  const { kpis, projects, clients, risks } = data;

  // Margen
  if (kpis.finance.margin < 0) {
    out.push({
      type: "critical",
      category: "Finanzas",
      title: "Operación en pérdida",
      detail: `El consolidado presenta pérdida neta de ${PEN(Math.abs(kpis.finance.profit))}. Revisión inmediata de costos y precios.`,
    });
  } else if (kpis.finance.margin < kpis.finance.target_margin) {
    out.push({
      type: "warning",
      category: "Finanzas",
      title: "Margen bajo el objetivo",
      detail: `Margen consolidado de ${kpis.finance.margin.toFixed(1)}% por debajo de la meta (${kpis.finance.target_margin}%).`,
    });
  } else {
    out.push({
      type: "positive",
      category: "Finanzas",
      title: "Margen saludable",
      detail: `El negocio supera la meta de rentabilidad con ${kpis.finance.margin.toFixed(1)}% de margen.`,
    });
  }

  // Proyectos destruyendo utilidad
  const losers = projects.filter((p) => p.profit < 0).sort((a, b) => a.profit - b.profit);
  if (losers.length > 0) {
    const top = losers.slice(0, 3).map((p) => p.name).join(", ");
    out.push({
      type: "critical",
      category: "Proyectos",
      title: `${losers.length} proyecto${losers.length > 1 ? "s" : ""} destruyendo utilidad`,
      detail: `Mayor pérdida: ${top}. Impacto total: ${PEN(losers.reduce((s, p) => s + p.profit, 0))}.`,
    });
  }

  // Sobrepresupuestados
  if (kpis.projects.over_budget > 0) {
    out.push({
      type: "warning",
      category: "Proyectos",
      title: `${kpis.projects.over_budget} proyecto${kpis.projects.over_budget > 1 ? "s" : ""} sobrepresupuestado${kpis.projects.over_budget > 1 ? "s" : ""}`,
      detail: "Costos reales superan el presupuesto. Renegociar alcance o controlar consumo.",
    });
  }

  // Concentración de ingresos
  if (kpis.clients.top_dependency_share > 40) {
    const top = [...clients].sort((a, b) => b.total_billed - a.total_billed)[0];
    out.push({
      type: "warning",
      category: "Comercial",
      title: "Dependencia comercial alta",
      detail: `${top?.client_name} concentra el ${kpis.clients.top_dependency_share.toFixed(0)}% de los ingresos. Diversificar la cartera.`,
    });
  }

  // Riesgos críticos
  if (kpis.risks.critical > 0) {
    out.push({
      type: "critical",
      category: "Riesgos",
      title: `${kpis.risks.critical} riesgo${kpis.risks.critical > 1 ? "s" : ""} crítico${kpis.risks.critical > 1 ? "s" : ""}`,
      detail: `Impacto financiero potencial: ${PEN(kpis.risks.financial_impact)}.`,
    });
  }

  // Conversión comercial
  if (kpis.quotations.total > 0) {
    if (kpis.quotations.conversion_rate < 30) {
      out.push({
        type: "warning",
        category: "Comercial",
        title: "Tasa de conversión baja",
        detail: `Solo ${kpis.quotations.conversion_rate}% de cotizaciones cerradas se ganaron. Revisar pricing y seguimiento.`,
      });
    } else if (kpis.quotations.conversion_rate >= 60) {
      out.push({
        type: "positive",
        category: "Comercial",
        title: "Conversión comercial fuerte",
        detail: `${kpis.quotations.conversion_rate}% de cotizaciones cerradas son ganadas.`,
      });
    }
    if (kpis.quotations.pipeline_value > 0) {
      out.push({
        type: "neutral",
        category: "Comercial",
        title: "Pipeline activo",
        detail: `${kpis.quotations.pending} cotizaciones pendientes representan ${PEN(kpis.quotations.pipeline_value)} en oportunidades.`,
      });
    }
  }

  // Cliente más rentable
  const bestClient = [...clients].sort((a, b) => b.profit - a.profit)[0];
  if (bestClient && bestClient.profit > 0) {
    out.push({
      type: "positive",
      category: "Comercial",
      title: "Cliente más rentable",
      detail: `${bestClient.client_name} aporta ${PEN(bestClient.profit)} con margen ${bestClient.margin.toFixed(1)}%.`,
    });
  }

  return out;
}

export function buildRecommendations(insights: ExecutiveInsight[], kpis: ConsolidatedKPIs): ExecutiveInsight[] {
  const recs: ExecutiveInsight[] = [];
  if (kpis.finance.profit < 0) {
    recs.push({
      type: "critical",
      category: "Finanzas",
      title: "Plan de recuperación financiera",
      detail: "Convocar comité financiero esta semana. Auditar proyectos en pérdida y evaluar suspensión o renegociación.",
    });
  }
  if (kpis.risks.critical > 0) {
    recs.push({
      type: "critical",
      category: "Riesgos",
      title: "Atender riesgos críticos en 7 días",
      detail: "Asignar responsables y planes de mitigación con fecha límite a cada riesgo crítico abierto.",
    });
  }
  if (kpis.projects.over_budget > 0) {
    recs.push({
      type: "warning",
      category: "Operaciones",
      title: "Control de costos",
      detail: "Activar revisión semanal de avance vs presupuesto en los proyectos con sobrecosto.",
    });
  }
  if (kpis.clients.top_dependency_share > 40) {
    recs.push({
      type: "warning",
      category: "Comercial",
      title: "Diversificar cartera de clientes",
      detail: "Lanzar campaña de prospección para reducir dependencia del cliente principal por debajo del 30%.",
    });
  }
  if (kpis.quotations.conversion_rate < 30 && kpis.quotations.total > 3) {
    recs.push({
      type: "warning",
      category: "Comercial",
      title: "Mejorar tasa de cierre",
      detail: "Revisar propuestas perdidas, ajustar pricing y reforzar seguimiento comercial.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      type: "positive",
      category: "General",
      title: "Mantener disciplina operativa",
      detail: "Indicadores saludables. Continuar el monitoreo mensual e invertir en crecimiento.",
    });
  }
  return recs;
}

export function buildExecutiveConclusion(kpis: ConsolidatedKPIs): string {
  const parts: string[] = [];
  if (kpis.finance.profit < 0) {
    parts.push(`La empresa presenta pérdida neta de ${PEN(Math.abs(kpis.finance.profit))} sobre ${PEN(kpis.finance.billed)} facturados.`);
  } else if (kpis.finance.margin < 10) {
    parts.push(`El negocio mantiene rentabilidad ajustada (${kpis.finance.margin.toFixed(1)}%) sobre ${PEN(kpis.finance.billed)} facturados.`);
  } else if (kpis.finance.margin >= kpis.finance.target_margin) {
    parts.push(`El negocio supera la meta de rentabilidad con ${kpis.finance.margin.toFixed(1)}% de margen sobre ${PEN(kpis.finance.billed)} facturados.`);
  } else {
    parts.push(`Margen consolidado de ${kpis.finance.margin.toFixed(1)}% sobre ${PEN(kpis.finance.billed)} facturados.`);
  }
  if (kpis.risks.critical > 0) {
    parts.push(`Se identifican ${kpis.risks.critical} riesgo(s) crítico(s) con impacto potencial de ${PEN(kpis.risks.financial_impact)}.`);
  }
  if (kpis.clients.top_dependency_share > 40) {
    parts.push(`Existe dependencia comercial relevante: el cliente principal concentra ${kpis.clients.top_dependency_share.toFixed(0)}% de los ingresos.`);
  }
  if (kpis.quotations.total > 0) {
    parts.push(`La conversión comercial actual es de ${kpis.quotations.conversion_rate}% con ${PEN(kpis.quotations.pipeline_value)} en pipeline.`);
  }
  return parts.join(" ");
}
