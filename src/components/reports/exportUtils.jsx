import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";

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

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SolarBI — Relatório Mensal", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${monthLabel}`, 14, 26);

  // Summary
  doc.setFontSize(10);
  doc.text(`Geração Total: ${generation.toFixed(2)} kWh`, 14, 34);
  doc.text(`Consumo Total: ${totalConsumption.toFixed(2)} kWh`, 90, 34);
  const totalSavings = reportData.reduce((s, r) => s + (r.savings || 0), 0);
  doc.text(`Economia Total: R$ ${totalSavings.toFixed(2)}`, 180, 34);

  // Table
  doc.autoTable({
    startY: 42,
    head: [["Unidade", "Cód.", "Quota%", "Direito kWh", "Consumo kWh", "Compensado kWh", "Saldo kWh", "Tarifa R$/kWh", "Economia R$"]],
    body: reportData.map(u => [
      u.name + (u.is_main ? " ★" : ""),
      u.code,
      u.quota.toFixed(1) + "%",
      u.right.toFixed(2),
      u.consumption.toFixed(2),
      u.compensated.toFixed(2),
      (u.balance >= 0 ? "+" : "") + u.balance.toFixed(2),
      u.tariff > 0 ? u.tariff.toFixed(4) : "-",
      u.savings > 0 ? u.savings.toFixed(2) : "-",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [250, 204, 21], textColor: [30, 30, 30], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell(data) {
      // Color balance column
      if (data.section === "body" && data.column.index === 6) {
        const val = parseFloat(data.cell.text[0]);
        data.cell.styles.textColor = val >= 0 ? [22, 163, 74] : [220, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  doc.save(`relatorio_${month}.pdf`);
}