import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

export function exportToCsv(reportData, month) {
  const headers = ["Unidade", "Código", "Principal", "Quota (%)", "Direito (kWh)", "Consumo (kWh)", "Compensado (kWh)", "Saldo (kWh)", "Tarifa (R$/kWh)", "Economia (R$)"];
  const rows = reportData.map(u => [
    u.name,
    u.code,
    u.is_main ? "Sim" : "Não",
    u.quota.toFixed(2),
    u.right.toFixed(2),
    u.consumption.toFixed(2),
    u.compensated.toFixed(2),
    u.balance.toFixed(2),
    u.tariff > 0 ? u.tariff.toFixed(4) : "",
    u.savings > 0 ? u.savings.toFixed(2) : "",
  ]);

  const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio_${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPdf(reportData, month, generation, totalConsumption) {
  const doc = new jsPDF({ orientation: "landscape" });
  let monthLabel = month;
  try { monthLabel = format(new Date(month + "-01"), "MMMM yyyy", { locale: ptBR }); } catch {}

  const totalSavings = reportData.reduce((s, r) => s + (r.savings || 0), 0);

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SolarBI \u2014 Relat\u00f3rio Mensal", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Per\u00edodo: ${monthLabel}`, 14, 27);

  // Summary row
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Gera\u00e7\u00e3o: ${generation.toFixed(2)} kWh`, 14, 36);
  doc.text(`Consumo: ${totalConsumption.toFixed(2)} kWh`, 100, 36);
  doc.text(`Economia: R$ ${totalSavings.toFixed(2)}`, 200, 36);
  doc.setFont("helvetica", "normal");

  // Table header
  const cols = ["Unidade", "C\u00f3d.", "Quota%", "Direito kWh", "Consumo kWh", "Compens. kWh", "Saldo kWh", "Tarifa R$", "Economia R$"];
  const colWidths = [52, 22, 18, 28, 28, 28, 24, 24, 28];
  const startX = 14;
  let y = 46;
  const rowH = 8;

  // Header bg
  doc.setFillColor(250, 204, 21);
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let x = startX;
  cols.forEach((col, i) => {
    doc.text(col, x + 2, y + 5.5);
    x += colWidths[i];
  });
  y += rowH;

  // Rows
  doc.setFont("helvetica", "normal");
  reportData.forEach((u, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
    }
    const rowData = [
      u.name.substring(0, 18) + (u.is_main ? " \u2605" : ""),
      u.code || "-",
      u.quota.toFixed(1) + "%",
      u.right.toFixed(2),
      u.consumption.toFixed(2),
      u.compensated.toFixed(2),
      (u.balance >= 0 ? "+" : "") + u.balance.toFixed(2),
      u.tariff > 0 ? u.tariff.toFixed(4) : "-",
      u.savings > 0 ? u.savings.toFixed(2) : "-",
    ];
    x = startX;
    rowData.forEach((val, i) => {
      // Color balance column
      if (i === 6) {
        doc.setTextColor(u.balance >= 0 ? 22 : 220, u.balance >= 0 ? 163 : 38, u.balance >= 0 ? 74 : 38);
      } else {
        doc.setTextColor(40, 40, 40);
      }
      doc.text(String(val), x + 2, y + 5.5);
      x += colWidths[i];
    });
    y += rowH;
    if (y > 190) { doc.addPage(); y = 20; }
  });

  doc.setTextColor(40, 40, 40);
  doc.save(`relatorio_${month}.pdf`);
}