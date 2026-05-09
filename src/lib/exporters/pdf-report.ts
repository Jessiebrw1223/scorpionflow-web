import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BusinessReportData, ExecutiveInsight } from "@/lib/business-insights";

const ORANGE: [number, number, number] = [234, 88, 12];
const DARK: [number, number, number] = [15, 23, 42];
const SLATE: [number, number, number] = [30, 41, 59];
const GREEN: [number, number, number] = [22, 163, 74];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const TEXT: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const BORDER: [number, number, number] = [229, 231, 235];

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(n || 0);
const PENk = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 }).format(n || 0);

export async function generatePdfReport(p: BusinessReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  // ===================== PORTADA =====================
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, pageW, 8, "F");

  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...ORANGE);
  doc.text("ScorpionFlow", M, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text("Project Intelligence · Business Intelligence · Executive Reporting", M, 118);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  doc.setTextColor(255, 255, 255);
  doc.text("Informe Ejecutivo", M, pageH / 2 - 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(220, 220, 220);
  doc.text(p.companyName, M, pageH / 2);

  // Stat strip
  const stripY = pageH / 2 + 50;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1);
  doc.line(M, stripY, pageW - M, stripY);

  const stats = [
    { label: "Facturación", value: PENk(p.kpis.finance.billed) },
    { label: "Utilidad", value: PENk(p.kpis.finance.profit) },
    { label: "Margen", value: `${p.kpis.finance.margin.toFixed(1)}%` },
    { label: "Riesgos", value: String(p.kpis.risks.total) },
  ];
  const colW = (pageW - M * 2) / stats.length;
  stats.forEach((s, i) => {
    const x = M + colW * i;
    doc.setFontSize(9);
    doc.setTextColor(160, 160, 160);
    doc.text(s.label.toUpperCase(), x, stripY + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(s.value, x, stripY + 42);
    doc.setFont("helvetica", "normal");
  });

  // Health badge
  const healthLabel = p.kpis.finance.profit < 0 ? "ESTADO CRÍTICO" : p.kpis.finance.margin < 10 ? "EN ATENCIÓN" : "SALUDABLE";
  const healthColor = p.kpis.finance.profit < 0 ? RED : p.kpis.finance.margin < 10 ? AMBER : GREEN;
  doc.setFillColor(...healthColor);
  doc.roundedRect(M, stripY + 70, 140, 26, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(healthLabel, M + 70, stripY + 87, { align: "center" });

  // Footer portada
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Generado el ${p.generatedAt.toLocaleDateString("es-PE")} a las ${p.generatedAt.toLocaleTimeString("es-PE")}`,
    M, pageH - 50,
  );
  doc.text("Confidencial · Documento ejecutivo", pageW - M, pageH - 50, { align: "right" });

  // ===================== PÁGINA: RESUMEN EJECUTIVO =====================
  doc.addPage();
  drawHeader(doc, p, "Resumen Ejecutivo");

  let y = 110;
  const cards = [
    { label: "Facturación total", value: PENk(p.kpis.finance.billed), color: TEXT as [number, number, number] },
    { label: "Costo operativo", value: PENk(p.kpis.finance.cost), color: TEXT as [number, number, number] },
    { label: "Utilidad neta", value: PENk(p.kpis.finance.profit), color: (p.kpis.finance.profit >= 0 ? GREEN : RED) as [number, number, number] },
    { label: "Margen consolidado", value: `${p.kpis.finance.margin.toFixed(1)}%`, color: (p.kpis.finance.margin >= p.kpis.finance.target_margin ? GREEN : p.kpis.finance.margin >= 0 ? AMBER : RED) as [number, number, number] },
    { label: "Proyectos activos", value: `${p.kpis.projects.active}/${p.kpis.projects.total}`, color: TEXT as [number, number, number] },
    { label: "Riesgos críticos", value: String(p.kpis.risks.critical), color: (p.kpis.risks.critical > 0 ? RED : GREEN) as [number, number, number] },
    { label: "Conversión comercial", value: `${p.kpis.quotations.conversion_rate}%`, color: (p.kpis.quotations.conversion_rate >= 50 ? GREEN : p.kpis.quotations.conversion_rate >= 30 ? AMBER : RED) as [number, number, number] },
    { label: "Pipeline activo", value: PENk(p.kpis.quotations.pipeline_value), color: TEXT as [number, number, number] },
    { label: "Concentración top cliente", value: `${p.kpis.clients.top_dependency_share.toFixed(0)}%`, color: (p.kpis.clients.top_dependency_share > 40 ? AMBER : GREEN) as [number, number, number] },
  ];
  const cardW = (pageW - M * 2 - 20) / 3;
  const cardH = 60;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M + col * (cardW + 10);
    const cy = y + row * (cardH + 10);
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(c.label.toUpperCase(), x + 12, cy + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...c.color);
    doc.text(c.value, x + 12, cy + 40);
    doc.setFont("helvetica", "normal");
  });
  y += cardH * 3 + 30;

  // Conclusión
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Lectura ejecutiva", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(p.conclusion, pageW - M * 2);
  doc.text(lines, M, y);

  drawFooter(doc);

  // ===================== PÁGINA: GRÁFICOS =====================
  doc.addPage();
  drawHeader(doc, p, "Indicadores Visuales");

  // Donut: facturación vs costo vs utilidad
  drawDonut(doc, {
    x: M + 90, y: 180, r: 70,
    segments: [
      { value: p.kpis.finance.cost, color: AMBER, label: "Costo" },
      { value: Math.max(p.kpis.finance.profit, 0), color: GREEN, label: "Utilidad" },
    ],
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Composición financiera", M, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Sobre ${PENk(p.kpis.finance.billed)} facturados`, M, 146);

  // Legend donut
  let lx = M + 200, ly = 150;
  legendItem(doc, lx, ly, AMBER, `Costo · ${PENk(p.kpis.finance.cost)}`); ly += 18;
  legendItem(doc, lx, ly, GREEN, `Utilidad · ${PENk(Math.max(p.kpis.finance.profit, 0))}`); ly += 18;
  if (p.kpis.finance.profit < 0) { legendItem(doc, lx, ly, RED, `Pérdida · ${PENk(Math.abs(p.kpis.finance.profit))}`); }

  // Bars: top proyectos por utilidad
  const topProjects = [...p.projects].map((pr) => ({ name: pr.name, value: pr.budget - pr.actual_cost }))
    .sort((a, b) => b.value - a.value).slice(0, 5);
  drawBars(doc, {
    x: M, y: 290, w: pageW - M * 2, h: 160,
    title: "Top 5 proyectos por utilidad",
    items: topProjects.map((t) => ({ label: t.name, value: t.value, color: t.value >= 0 ? GREEN : RED })),
    valueFormatter: PENk,
  });

  // Bars: distribución riesgos por nivel
  const levels: Array<{ key: "critical" | "high" | "medium" | "low"; label: string }> = [
    { key: "critical", label: "Crítico" }, { key: "high", label: "Alto" },
    { key: "medium", label: "Medio" }, { key: "low", label: "Bajo" },
  ];
  const levelColors: Record<string, [number, number, number]> = { "Crítico": RED, "Alto": AMBER, "Medio": [202, 138, 4], "Bajo": GREEN };
  const riskBars = levels.map((lv) => ({
    label: lv.label,
    value: p.risks.filter((r) => r.level === lv.key).length,
    color: levelColors[lv.label],
  }));
  drawBars(doc, {
    x: M, y: 490, w: pageW - M * 2, h: 160,
    title: "Distribución de riesgos por nivel",
    items: riskBars,
    valueFormatter: (n) => String(n),
  });

  drawFooter(doc);

  // ===================== PÁGINA: PROYECTOS =====================
  doc.addPage();
  drawHeader(doc, p, "Detalle de Proyectos");

  autoTable(doc, {
    startY: 110,
    head: [["Proyecto", "Cliente", "Avance", "Facturado", "Costo", "Utilidad", "Margen", "Salud"]],
    body: p.projects.map((r) => {
      const profit = r.budget - r.actual_cost;
      const margin = r.budget > 0 ? (profit / r.budget) * 100 : 0;
      const health = profit < 0 ? "Crítico" : margin < 10 ? "En riesgo" : margin >= p.kpis.finance.target_margin ? "Saludable" : "Aceptable";
      return [r.name, r.client_name, `${r.progress}%`, PEN(r.budget), PEN(r.actual_cost), PEN(profit), `${margin.toFixed(1)}%`, health];
    }),
    foot: [["TOTALES", "", "", PEN(p.kpis.finance.billed), PEN(p.kpis.finance.cost), PEN(p.kpis.finance.profit), `${p.kpis.finance.margin.toFixed(1)}%`, ""]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 5, textColor: TEXT, lineColor: BORDER },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body") {
        const row = p.projects[data.row.index];
        if (!row) return;
        const profit = row.budget - row.actual_cost;
        const margin = row.budget > 0 ? (profit / row.budget) * 100 : 0;
        if (data.column.index === 5) { data.cell.styles.textColor = profit >= 0 ? GREEN : RED; data.cell.styles.fontStyle = "bold"; }
        if (data.column.index === 6) { data.cell.styles.textColor = margin >= 20 ? GREEN : margin >= 0 ? AMBER : RED; }
        if (data.column.index === 7) {
          const txt = data.cell.text[0];
          data.cell.styles.textColor = txt === "Crítico" ? RED : txt === "En riesgo" ? AMBER : txt === "Saludable" ? GREEN : TEXT;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawPage: () => drawFooter(doc),
    margin: { left: M, right: M, bottom: 50 },
  });

  // ===================== PÁGINA: CLIENTES =====================
  if (p.topClients.length > 0) {
    doc.addPage();
    drawHeader(doc, p, "Inteligencia Comercial · Clientes");

    autoTable(doc, {
      startY: 110,
      head: [["Cliente", "Proyectos", "Facturado", "Utilidad", "Margen", "% Cartera"]],
      body: p.topClients.map((c) => [
        c.client_name, c.projects_count, PEN(c.total_billed), PEN(c.profit),
        `${c.margin.toFixed(1)}%`, `${c.revenue_share.toFixed(1)}%`,
      ]),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 6, textColor: TEXT, lineColor: BORDER },
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const c = p.topClients[data.row.index];
          if (c) data.cell.styles.textColor = c.profit >= 0 ? GREEN : RED;
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => drawFooter(doc),
      margin: { left: M, right: M, bottom: 50 },
    });
  }

  // ===================== PÁGINA: RIESGOS EMPRESARIALES =====================
  doc.addPage();
  drawHeader(doc, p, "Riesgos Empresariales");

  // Totales
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DARK);
  doc.text(`Riesgos críticos: ${p.kpis.risks.critical}`, M, 110);
  doc.text(`Impacto financiero total: ${PEN(p.kpis.risks.financial_impact)}`, M, 126);
  doc.text(`Total de riesgos: ${p.kpis.risks.total}  ·  Abiertos: ${p.kpis.risks.open}`, M, 142);

  if (p.risks.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...MUTED);
    doc.text("No se han identificado riesgos relevantes en este período.", M, 170);
    drawFooter(doc);
  } else {
    autoTable(doc, {
      startY: 160,
      head: [["Código", "Riesgo", "Proyecto", "Tipo", "Nivel", "Prob.", "Impacto", "Impacto S/", "Estado", "Responsable"]],
      body: p.risks.map((r) => [
        r.code, r.title, r.projectName, r.categoryLabel, r.levelLabel,
        `${r.probability}%`, `${r.impact}%`, PEN(r.financialImpact), r.statusLabel, r.owner,
      ]),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 3.5, textColor: TEXT, lineColor: BORDER },
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const lvl = data.cell.text[0];
          const color = lvl === "Crítico" ? RED : lvl === "Alto" ? AMBER : lvl === "Medio" ? [202, 138, 4] as [number, number, number] : GREEN;
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => drawFooter(doc),
      margin: { left: M, right: M, bottom: 50 },
    });
  }

  // ===================== PÁGINA: INSIGHTS Y RECOMENDACIONES =====================
  doc.addPage();
  drawHeader(doc, p, "Insights Ejecutivos");

  let iy = 110;
  iy = renderInsightBlocks(doc, "Hallazgos del negocio", p.insights, M, iy, pageW - M * 2);
  if (iy > pageH - 200) { doc.addPage(); drawHeader(doc, p, "Recomendaciones"); iy = 110; }
  iy += 12;
  renderInsightBlocks(doc, "Acciones recomendadas", p.recommendations, M, iy, pageW - M * 2);

  drawFooter(doc);

  const fileName = `scorpionflow-informe-ejecutivo-${p.generatedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ============== drawing helpers ==============

function drawHeader(doc: jsPDF, p: BusinessReportData, sectionTitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  doc.text("ScorpionFlow", 40, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(p.companyName, 40, 44);
  doc.text(p.generatedAt.toLocaleDateString("es-PE"), pageW - 40, 30, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.line(40, 60, pageW - 40, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text(sectionTitle, 40, 88);
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageNum = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("ScorpionFlow · Informe Ejecutivo", 40, pageH - 25);
  doc.text(`Página ${pageNum}`, pageW - 40, pageH - 25, { align: "right" });
}

function drawDonut(doc: jsPDF, opts: { x: number; y: number; r: number; segments: { value: number; color: [number, number, number]; label: string }[] }) {
  const { x, y, r, segments } = opts;
  const total = segments.reduce((s, sg) => s + Math.max(sg.value, 0), 0);
  if (total <= 0) {
    doc.setDrawColor(...BORDER); doc.setFillColor(245, 245, 245);
    doc.circle(x, y, r, "FD");
    return;
  }
  let startAngle = -Math.PI / 2;
  for (const sg of segments) {
    const v = Math.max(sg.value, 0);
    if (v <= 0) continue;
    const angle = (v / total) * Math.PI * 2;
    drawPieSlice(doc, x, y, r, startAngle, startAngle + angle, sg.color);
    startAngle += angle;
  }
  // Inner hole for donut
  doc.setFillColor(255, 255, 255);
  doc.circle(x, y, r * 0.55, "F");
}

function drawPieSlice(doc: jsPDF, cx: number, cy: number, r: number, a0: number, a1: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.setDrawColor(...color);
  // Approximate slice with triangles
  const steps = Math.max(8, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 64));
  const da = (a1 - a0) / steps;
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + da * i;
    const t1 = a0 + da * (i + 1);
    const x0 = cx + Math.cos(t0) * r;
    const y0 = cy + Math.sin(t0) * r;
    const x1 = cx + Math.cos(t1) * r;
    const y1 = cy + Math.sin(t1) * r;
    doc.triangle(cx, cy, x0, y0, x1, y1, "F");
  }
}

function drawBars(doc: jsPDF, opts: {
  x: number; y: number; w: number; h: number; title: string;
  items: { label: string; value: number; color: [number, number, number] }[];
  valueFormatter: (n: number) => string;
}) {
  const { x, y, w, h, title, items, valueFormatter } = opts;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(title, x, y);
  const chartTop = y + 16;
  const chartH = h - 30;
  if (items.length === 0) return;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const labelW = 110;
  const barAreaX = x + labelW;
  const barAreaW = w - labelW - 80;
  const rowH = chartH / items.length;
  items.forEach((it, idx) => {
    const ry = chartTop + idx * rowH + rowH / 2 - 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    const lbl = it.label.length > 24 ? it.label.slice(0, 22) + "…" : it.label;
    doc.text(lbl, x, ry + 8);
    const bw = (Math.abs(it.value) / max) * barAreaW;
    doc.setFillColor(...it.color);
    doc.roundedRect(barAreaX, ry, Math.max(bw, 1), 12, 2, 2, "F");
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(valueFormatter(it.value), barAreaX + bw + 6, ry + 9);
  });
}

function legendItem(doc: jsPDF, x: number, y: number, color: [number, number, number], text: string) {
  doc.setFillColor(...color);
  doc.rect(x, y - 8, 10, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text(text, x + 16, y);
}

function renderInsightBlocks(doc: jsPDF, sectionTitle: string, items: ExecutiveInsight[], x: number, y: number, w: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(sectionTitle, x, y);
  let cy = y + 16;
  for (const it of items) {
    const color = it.type === "critical" ? RED : it.type === "warning" ? AMBER : it.type === "positive" ? GREEN : MUTED;
    const detailLines = doc.splitTextToSize(it.detail, w - 24);
    const blockH = 22 + 6 + detailLines.length * 11 + 12;
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, cy, w, blockH, 4, 4, "FD");
    // accent bar
    doc.setFillColor(...color);
    doc.rect(x, cy, 4, blockH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(it.title, x + 14, cy + 16);
    // category badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...color);
    doc.text(it.category.toUpperCase(), x + w - 14, cy + 16, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(detailLines, x + 14, cy + 32);
    cy += blockH + 8;
  }
  return cy;
}
