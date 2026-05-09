// Motor central de riesgos — fuente única de verdad para UI Riesgos,
// página Informes, exportador PDF y exportador Excel.
// Combina riesgos manuales (tabla risks) + riesgos derivados automáticos
// (sobrecostos, atrasos, bloqueos críticos, cotizaciones que se enfrían).

import { getExecutionStatus, getFinancialHealth } from "@/lib/business-intelligence";

export type RiskLevelKey = "critical" | "high" | "medium" | "low";
export type RiskStatusKey = "open" | "in_treatment" | "mitigated" | "closed";
export type RiskCategoryKey = "financial" | "schedule" | "client" | "operational" | "supplier";

export interface ExecutiveRisk {
  id: string;
  code: string;
  title: string;
  projectId: string | null;
  projectName: string;
  area: string;
  owner: string;
  probability: number;
  impact: number;
  level: RiskLevelKey;
  levelLabel: string; // "Crítico" | "Alto" | "Medio" | "Bajo"
  dueDate: string | null;
  status: RiskStatusKey;
  statusLabel: string;
  response: string;            // plan / acción sugerida
  financialImpact: number;     // S/ — alias estimated_cost
  isOverdue: boolean;
  category: RiskCategoryKey;
  categoryLabel: string;
  source: "manual" | "auto";
}

const LEVEL_LABEL: Record<RiskLevelKey, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo",
};
const STATUS_LABEL: Record<RiskStatusKey, string> = {
  open: "Abierto", in_treatment: "En tratamiento", mitigated: "Mitigado", closed: "Cerrado",
};
const CATEGORY_LABEL: Record<string, string> = {
  financial: "Financiero", schedule: "Cronograma", client: "Comercial",
  operational: "Operativo", supplier: "Proveedores",
  technical: "Técnico", commercial: "Comercial", hr: "RRHH", legal: "Legal",
};
const MANUAL_CATEGORY_MAP: Record<string, RiskCategoryKey> = {
  financial: "financial", operational: "operational", technical: "operational",
  commercial: "client", hr: "operational", legal: "operational",
};

export function classifyLevel(probability: number, impact: number): RiskLevelKey {
  const score = (probability * impact) / 100; // 0-100
  if (score >= 60) return "critical";
  if (score >= 35) return "high";
  if (score >= 15) return "medium";
  return "low";
}

interface BuildArgs {
  projects: any[];
  tasks: any[];
  quotations: any[];
  manualRisks: any[];
  settings: any;
}

/**
 * Construye la lista UNIFICADA de riesgos del negocio.
 * Esta misma función alimenta UI, KPIs, PDF y Excel.
 */
export function buildExecutiveRisks(args: BuildArgs): ExecutiveRisk[] {
  const { projects, tasks, quotations, manualRisks, settings } = args;
  const targetMargin = settings?.target_margin ?? 20;
  const out: ExecutiveRisk[] = [];
  let n = 1;
  const code = () => `R-${String(n++).padStart(3, "0")}`;
  const today = new Date();

  const push = (r: Omit<ExecutiveRisk, "levelLabel" | "statusLabel" | "categoryLabel">) => {
    out.push({
      ...r,
      levelLabel: LEVEL_LABEL[r.level],
      statusLabel: STATUS_LABEL[r.status],
      categoryLabel: CATEGORY_LABEL[r.category] ?? r.category,
    });
  };

  // 1) Riesgos derivados de proyectos
  for (const p of projects) {
    const projectTasks = tasks.filter((t) => t.project_id === p.id);
    const taskDates = projectTasks.map((t) => t.due_date);
    const overdueTasks = projectTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < today && t.status !== "done" && t.status !== "cancelled"
    );

    const exec = getExecutionStatus({
      status: p.status,
      startDate: p.start_date,
      endDate: p.end_date,
      progress: p.progress ?? 0,
      hasOverdueTasks: overdueTasks.length > 0,
      taskDates,
      inferSchedule: settings?.auto_behavior?.inferSchedule !== false,
    });
    const fin = getFinancialHealth({
      budget: Number(p.budget ?? 0),
      actualCost: Number(p.actual_cost ?? 0),
      targetMargin,
    });

    const clientName = p.clients?.name ?? "Cliente";
    const budget = Number(p.budget ?? 0);
    const actual = Number(p.actual_cost ?? 0);
    const overrun = Math.max(0, actual - budget);

    if (budget > 0 && actual > budget * 0.85) {
      const ratio = actual / budget;
      const probability = Math.min(95, Math.round(ratio * 70));
      const impact = Math.min(95, Math.round((overrun / Math.max(budget, 1)) * 100) + 30);
      push({
        id: `over-${p.id}`, code: code(),
        title: ratio > 1 ? "Proyecto excede el presupuesto" : "Presupuesto a punto de agotarse",
        projectId: p.id, projectName: p.name,
        area: "Finanzas", owner: clientName,
        probability, impact, level: classifyLevel(probability, impact),
        dueDate: p.end_date, status: ratio > 1 ? "open" : "in_treatment",
        response: ratio > 1
          ? "Renegociar alcance o cobrar adicionales al cliente."
          : "Revisar gastos pendientes y frenar costos no esenciales.",
        financialImpact: overrun > 0 ? overrun : Math.round(budget * 0.15),
        isOverdue: !!p.end_date && new Date(p.end_date) < today && p.status !== "completed",
        category: "financial", source: "auto",
      });
    }

    if (fin.key === "critical" && budget > 0) {
      push({
        id: `loss-${p.id}`, code: code(),
        title: "Proyecto está generando pérdida",
        projectId: p.id, projectName: p.name,
        area: "Rentabilidad", owner: clientName,
        probability: 90, impact: 85, level: "critical",
        dueDate: p.end_date, status: "open",
        response: "Reunión urgente con cliente: ajustar alcance, plazo o precio.",
        financialImpact: Math.max(overrun, Math.round(budget * 0.2)),
        isOverdue: false, category: "financial", source: "auto",
      });
    }

    if (exec.key === "delayed" && p.status !== "completed") {
      push({
        id: `late-${p.id}`, code: code(),
        title: "Proyecto va atrasado en su entrega",
        projectId: p.id, projectName: p.name,
        area: "Operaciones", owner: clientName,
        probability: 80, impact: 60, level: classifyLevel(80, 60),
        dueDate: p.end_date, status: "in_treatment",
        response: "Reorganizar prioridades y comunicar nueva fecha al cliente.",
        financialImpact: Math.round(budget * 0.1),
        isOverdue: !!p.end_date && new Date(p.end_date) < today,
        category: "schedule", source: "auto",
      });
    } else if (exec.key === "at_risk" && p.status !== "completed") {
      push({
        id: `risk-${p.id}`, code: code(),
        title: "Proyecto en riesgo de retraso",
        projectId: p.id, projectName: p.name,
        area: "Operaciones", owner: clientName,
        probability: 55, impact: 45, level: classifyLevel(55, 45),
        dueDate: p.end_date, status: "open",
        response: "Revisar tareas pendientes y reasignar recursos.",
        financialImpact: Math.round(budget * 0.05),
        isOverdue: false, category: "schedule", source: "auto",
      });
    }
  }

  // 2) Tareas bloqueadas que frenan proyecto
  const blockingTasks = tasks.filter((t) => t.blocks_project && t.status === "blocked");
  for (const t of blockingTasks) {
    const p = projects.find((pp) => pp.id === t.project_id);
    const projectName = p?.name ?? "Proyecto";
    const daysBlocked = t.blocked_since
      ? Math.floor((today.getTime() - new Date(t.blocked_since).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const probability = Math.min(95, 60 + daysBlocked * 3);
    const impact = 75;
    push({
      id: `block-${t.id}`, code: code(),
      title: `Bloqueo crítico: ${t.title}`,
      projectId: t.project_id, projectName,
      area: "Operaciones", owner: t.assignee_name ?? "Sin responsable",
      probability, impact, level: classifyLevel(probability, impact),
      dueDate: t.due_date, status: "open",
      response: t.blocked_reason ? `Resolver: ${t.blocked_reason}` : "Identificar causa del bloqueo y desbloquear hoy.",
      financialImpact: Number(t.estimated_cost ?? 0) || (p ? Math.round(Number(p.budget ?? 0) * 0.05) : 0),
      isOverdue: !!t.due_date && new Date(t.due_date) < today,
      category: "operational", source: "auto",
    });
  }

  // 3) Cotizaciones grandes que se enfrían
  const staleQuotations = quotations.filter((q) => {
    if (q.status !== "pending") return false;
    const days = Math.floor((today.getTime() - new Date(q.status_changed_at).getTime()) / (1000 * 60 * 60 * 24));
    return days > 14 && Number(q.total ?? 0) > 5000;
  });
  for (const q of staleQuotations.slice(0, 5)) {
    const total = Number(q.total ?? 0);
    const prob = Math.max(20, 80 - (q.close_probability ?? 50));
    const impact = Math.min(85, Math.round((total / 50000) * 100));
    push({
      id: `quot-${q.id}`, code: code(),
      title: `Cliente puede cancelar: ${q.title}`,
      projectId: null, projectName: q.clients?.name ?? "Cliente",
      area: "Comercial", owner: q.clients?.name ?? "Cliente",
      probability: prob, impact, level: classifyLevel(prob, impact),
      dueDate: null, status: "open",
      response: "Llamar al cliente esta semana y cerrar la propuesta.",
      financialImpact: total, isOverdue: false,
      category: "client", source: "auto",
    });
  }

  // 4) Riesgos manuales persistidos en BD
  for (const m of manualRisks as any[]) {
    const probability = Number(m.probability) || 0;
    const impact = Number(m.impact) || 0;
    const lvl = classifyLevel(probability, impact);
    const status = (m.status as RiskStatusKey) ?? "open";
    push({
      id: `manual-${m.id}`, code: m.code ?? "—",
      title: m.title, projectId: m.project_id,
      projectName: m.projects?.name ?? "Sin proyecto",
      area: CATEGORY_LABEL[m.category] ?? m.category,
      owner: m.owner_name ?? "Sin responsable",
      probability, impact, level: lvl,
      dueDate: m.due_date, status,
      response: m.mitigation_plan ?? "Sin plan de mitigación.",
      financialImpact: Number(m.estimated_cost) || 0,
      isOverdue: !!m.due_date && new Date(m.due_date) < today && status !== "mitigated" && status !== "closed",
      category: MANUAL_CATEGORY_MAP[m.category] ?? "operational",
      source: "manual",
    });
  }

  return out;
}

/** Resumen consistente — usado por UI, PDF y Excel. */
export function summarizeRisks(risks: ExecutiveRisk[]) {
  const active = risks.filter((r) => r.status !== "mitigated" && r.status !== "closed");
  return {
    total: risks.length,
    critical: active.filter((r) => r.level === "critical").length,
    high: active.filter((r) => r.level === "high").length,
    medium: active.filter((r) => r.level === "medium").length,
    low: active.filter((r) => r.level === "low").length,
    open: active.filter((r) => r.status === "open" || r.status === "in_treatment").length,
    mitigated: risks.filter((r) => r.status === "mitigated" || r.status === "closed").length,
    overdue: risks.filter((r) => r.isOverdue).length,
    financialImpact: active.reduce((s, r) => s + (r.financialImpact || 0), 0),
  };
}
