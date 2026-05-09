import * as XLSX from "xlsx";
import type { BusinessReportData } from "@/lib/business-insights";

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(n || 0);

// Backwards compatibility re-exports (legacy types used elsewhere)
export type ReportRow = {
  name: string; client: string; status: string; progress: number;
  billed: number; cost: number; profit: number; margin: number; health: string;
};
export type ReportRisk = {
  code: string; title: string; project: string; category: string; level: string;
  probability: number; impact: number; estimatedCost: number; owner: string; status: string;
};
export type ReportTotals = { billed: number; cost: number; profit: number; margin: number };
export type ReportPayload = {
  companyName: string; generatedAt: Date;
  rows: ReportRow[]; risks: ReportRisk[]; totals: ReportTotals;
  conclusion: string; currency: string;
};

export async function generateExcelReport(p: BusinessReportData) {
  const wb = XLSX.utils.book_new();

  // ============ HOJA 1: Dashboard Ejecutivo ============
  const dash: any[][] = [
    ["SCORPIONFLOW · INFORME EJECUTIVO"],
    [p.companyName],
    [`Generado: ${p.generatedAt.toLocaleDateString("es-PE")} ${p.generatedAt.toLocaleTimeString("es-PE")}`],
    [],
    ["INDICADORES FINANCIEROS"],
    ["Concepto", "Valor"],
    ["Facturación total", PEN(p.kpis.finance.billed)],
    ["Costo operativo", PEN(p.kpis.finance.cost)],
    ["Utilidad neta", PEN(p.kpis.finance.profit)],
    ["Margen consolidado", `${p.kpis.finance.margin.toFixed(1)}%`],
    ["Margen objetivo", `${p.kpis.finance.target_margin}%`],
    [],
    ["INDICADORES OPERATIVOS"],
    ["Concepto", "Valor"],
    ["Proyectos totales", p.kpis.projects.total],
    ["Proyectos activos", p.kpis.projects.active],
    ["Proyectos atrasados", p.kpis.projects.delayed],
    ["Proyectos sobrepresupuestados", p.kpis.projects.over_budget],
    ["Avance promedio", `${p.kpis.projects.avg_progress}%`],
    [],
    ["INDICADORES COMERCIALES"],
    ["Concepto", "Valor"],
    ["Cotizaciones totales", p.kpis.quotations.total],
    ["Tasa de conversión", `${p.kpis.quotations.conversion_rate}%`],
    ["Valor en pipeline", PEN(p.kpis.quotations.pipeline_value)],
    ["Clientes activos", p.kpis.clients.total],
    ["Concentración del top cliente", `${p.kpis.clients.top_dependency_share.toFixed(0)}%`],
    [],
    ["INDICADORES DE RIESGO"],
    ["Concepto", "Valor"],
    ["Riesgos identificados", p.kpis.risks.total],
    ["Riesgos críticos", p.kpis.risks.critical],
    ["Riesgos abiertos", p.kpis.risks.open],
    ["Impacto financiero potencial", PEN(p.kpis.risks.financial_impact)],
    [],
    ["RESUMEN EJECUTIVO"],
    [p.conclusion],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(dash);
  ws1["!cols"] = [{ wch: 36 }, { wch: 32 }];
  ws1["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: dash.length - 2, c: 0 }, e: { r: dash.length - 2, c: 1 } },
    { s: { r: dash.length - 1, c: 0 }, e: { r: dash.length - 1, c: 1 } },
  ];
  bigHeader(ws1, "A1");
  subHeader(ws1, "A5"); subHeader(ws1, "A13"); subHeader(ws1, "A21"); subHeader(ws1, "A29"); subHeader(ws1, dashLast(dash));
  tableHeader(ws1, "A6:B6"); tableHeader(ws1, "A14:B14"); tableHeader(ws1, "A22:B22"); tableHeader(ws1, "A30:B30");
  ws1["!freeze"] = { xSplit: 0, ySplit: 4 } as any;
  XLSX.utils.book_append_sheet(wb, ws1, "Dashboard");

  // ============ HOJA 2: Proyectos ============
  const projHeader = ["Proyecto", "Cliente", "Estado", "Avance %", "Facturado", "Costo", "Utilidad", "Margen %", "Salud"];
  const projRows = p.projects.map((r) => {
    const profit = r.budget - r.actual_cost;
    const margin = r.budget > 0 ? (profit / r.budget) * 100 : 0;
    const health = profit < 0 ? "Crítico" : margin < 10 ? "En riesgo" : margin >= p.kpis.finance.target_margin ? "Saludable" : "Aceptable";
    return [r.name, r.client_name, r.status, r.progress, num(r.budget), num(r.actual_cost), num(profit), num(margin), health];
  });
  const projTotal = ["TOTALES", "", "", "", num(p.kpis.finance.billed), num(p.kpis.finance.cost), num(p.kpis.finance.profit), num(p.kpis.finance.margin), ""];
  const ws2 = XLSX.utils.aoa_to_sheet([projHeader, ...projRows, [], projTotal]);
  ws2["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  tableHeader(ws2, `A1:I1`);
  for (let i = 0; i < projRows.length; i++) {
    const r = i + 2;
    ["E", "F", "G"].forEach((c) => { const x = ws2[`${c}${r}`]; if (x) x.z = '"S/" #,##0.00'; });
    const m = ws2[`H${r}`]; if (m) m.z = "0.00\\%";
    const profit = projRows[i][6] as number;
    const margin = projRows[i][7] as number;
    const profitCell = ws2[`G${r}`];
    if (profitCell) profitCell.s = { font: { color: { rgb: profit >= 0 ? "16A34A" : "DC2626" }, bold: true } };
    const marginCell = ws2[`H${r}`];
    if (marginCell) marginCell.s = { font: { color: { rgb: margin >= 20 ? "16A34A" : margin >= 0 ? "D97706" : "DC2626" }, bold: true } };
    if (i % 2 === 1) {
      ["A", "B", "C", "D", "E", "F", "G", "H", "I"].forEach((c) => {
        const cell = ws2[`${c}${r}`];
        if (cell) cell.s = { ...(cell.s || {}), fill: { fgColor: { rgb: "F8FAFC" } } };
      });
    }
  }
  const totalIdx = projRows.length + 3;
  ["A", "E", "F", "G", "H"].forEach((c) => {
    const cell = ws2[`${c}${totalIdx}`];
    if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F2937" } } };
    if (cell && (c === "E" || c === "F" || c === "G")) cell.z = '"S/" #,##0.00';
    if (cell && c === "H") cell.z = "0.00\\%";
  });
  ws2["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  XLSX.utils.book_append_sheet(wb, ws2, "Proyectos");

  // ============ HOJA 3: Riesgos ============
  const rHeader = ["Código", "Riesgo", "Proyecto", "Tipo", "Nivel", "Prob. %", "Impacto %", "Impacto S/", "Estado", "Responsable", "Acción sugerida"];
  const rRows = p.risks.map((r) => [
    r.code, r.title, r.projectName, r.categoryLabel, r.levelLabel,
    r.probability, r.impact, num(r.financialImpact), r.statusLabel, r.owner, r.response,
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([rHeader, ...rRows]);
  ws3["!cols"] = [{ wch: 10 }, { wch: 36 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 9 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 50 }];
  tableHeader(ws3, `A1:K1`);
  for (let i = 0; i < rRows.length; i++) {
    const r = i + 2;
    const c = ws3[`H${r}`]; if (c) c.z = '"S/" #,##0.00';
    const lvl = rRows[i][4] as string;
    const lvlCell = ws3[`E${r}`];
    if (lvlCell) {
      const color = lvl === "Crítico" ? "DC2626" : lvl === "Alto" ? "EA580C" : lvl === "Medio" ? "D97706" : "16A34A";
      lvlCell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: color } }, alignment: { horizontal: "center" } };
    }
  }
  ws3["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  XLSX.utils.book_append_sheet(wb, ws3, "Riesgos");

  // ============ HOJA 4: Finanzas ============
  const finAoa: any[][] = [
    ["FINANZAS CONSOLIDADAS"],
    [],
    ["INGRESOS"],
    ["Concepto", "Monto"],
    ["Facturación", PEN(p.kpis.finance.billed)],
    ["Pipeline pendiente", PEN(p.kpis.quotations.pipeline_value)],
    [],
    ["EGRESOS"],
    ["Concepto", "Monto"],
    ["Costo de proyectos", PEN(p.kpis.finance.cost)],
    [],
    ["RESULTADO"],
    ["Concepto", "Monto"],
    ["Utilidad neta", PEN(p.kpis.finance.profit)],
    ["Margen", `${p.kpis.finance.margin.toFixed(1)}%`],
    [],
    ["TOP CLIENTES POR INGRESO"],
    ["Cliente", "Proyectos", "Facturado", "Utilidad", "Margen %", "% Cartera"],
    ...p.topClients.map((c) => [c.client_name, c.projects_count, num(c.total_billed), num(c.profit), num(c.margin), num(c.revenue_share)]),
    [],
    ["CLIENTES CON MENOR RENTABILIDAD"],
    ["Cliente", "Proyectos", "Facturado", "Utilidad", "Margen %"],
    ...p.worstClients.map((c) => [c.client_name, c.projects_count, num(c.total_billed), num(c.profit), num(c.margin)]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(finAoa);
  ws4["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  bigHeader(ws4, "A1");
  subHeader(ws4, "A3"); subHeader(ws4, "A8"); subHeader(ws4, "A12"); subHeader(ws4, "A17"); subHeader(ws4, `A${17 + 2 + p.topClients.length + 1}`);
  XLSX.utils.book_append_sheet(wb, ws4, "Finanzas");

  // ============ HOJA 5: Recomendaciones ============
  const recAoa: any[][] = [
    ["INSIGHTS Y RECOMENDACIONES EJECUTIVAS"],
    [],
    ["INSIGHTS DEL NEGOCIO"],
    ["Categoría", "Tipo", "Hallazgo", "Detalle"],
    ...p.insights.map((i) => [i.category, labelType(i.type), i.title, i.detail]),
    [],
    ["RECOMENDACIONES PRIORITARIAS"],
    ["Categoría", "Prioridad", "Acción", "Detalle"],
    ...p.recommendations.map((r) => [r.category, labelType(r.type), r.title, r.detail]),
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(recAoa);
  ws5["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 38 }, { wch: 70 }];
  bigHeader(ws5, "A1");
  subHeader(ws5, "A3");
  subHeader(ws5, `A${5 + p.insights.length + 1}`);
  tableHeader(ws5, "A4:D4");
  tableHeader(ws5, `A${5 + p.insights.length + 2}:D${5 + p.insights.length + 2}`);
  // Color rows by type
  for (let i = 0; i < p.insights.length; i++) {
    const r = i + 5;
    const color = colorForType(p.insights[i].type);
    const cell = ws5[`B${r}`];
    if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: color } }, alignment: { horizontal: "center" } };
  }
  for (let i = 0; i < p.recommendations.length; i++) {
    const r = 5 + p.insights.length + 2 + 1 + i;
    const color = colorForType(p.recommendations[i].type);
    const cell = ws5[`B${r}`];
    if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: color } }, alignment: { horizontal: "center" } };
  }
  XLSX.utils.book_append_sheet(wb, ws5, "Recomendaciones");

  const fileName = `scorpionflow-informe-ejecutivo-${p.generatedAt.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function num(n: number) { return Number((n || 0).toFixed(2)); }
function dashLast(dash: any[][]) { return `A${dash.length - 1}`; }
function labelType(t: string) {
  return t === "critical" ? "Crítico" : t === "warning" ? "Atención" : t === "positive" ? "Positivo" : "Informativo";
}
function colorForType(t: string) {
  return t === "critical" ? "DC2626" : t === "warning" ? "D97706" : t === "positive" ? "16A34A" : "6B7280";
}
function bigHeader(ws: XLSX.WorkSheet, addr: string) {
  if (!ws[addr]) return;
  ws[addr].s = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" } };
}
function subHeader(ws: XLSX.WorkSheet, addr: string) {
  if (!ws[addr]) return;
  ws[addr].s = { font: { bold: true, sz: 12, color: { rgb: "EA580C" } } };
}
function tableHeader(ws: XLSX.WorkSheet, range: string) {
  const decoded = XLSX.utils.decode_range(range);
  for (let c = decoded.s.c; c <= decoded.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: decoded.s.r, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1F2937" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };
  }
}
