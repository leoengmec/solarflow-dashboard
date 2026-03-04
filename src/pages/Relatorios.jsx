import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sun, Download, FileText, BarChart2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import MonthlyReportSummary from "../components/reports/MonthlyReportSummary";
import ReportCharts from "../components/reports/ReportCharts";
import ReportTable from "../components/reports/ReportTable";
import { exportToCsv, exportToPdf } from "../components/reports/exportUtils";

export default function Relatorios() {
  const [units, setUnits] = useState([]);
  const [energyRecords, setEnergyRecords] = useState([]);
  const [consumptionRecords, setConsumptionRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default to current month
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [u, e, c] = await Promise.all([
        base44.entities.ConsumerUnit.list("name", 100),
        base44.entities.EnergyRecord.list("-date", 5000),
        base44.entities.ConsumptionRecord.list("-month", 500),
      ]);
      setUnits(u);
      setEnergyRecords(e);
      setConsumptionRecords(c);
      setLoading(false);
    };
    load();
  }, []);

  // Generate last 12 months for selector
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
    });
  }, []);

  // Generation for selected month
  const monthGeneration = useMemo(() => {
    return energyRecords
      .filter(r => r.date && r.date.startsWith(selectedMonth))
      .reduce((s, r) => s + (r.energy_kwh || 0), 0);
  }, [energyRecords, selectedMonth]);

  // Consumption records for selected month
  const monthConsumption = useMemo(() => {
    return consumptionRecords.filter(r => r.month === selectedMonth);
  }, [consumptionRecords, selectedMonth]);

  // Total consumption
  const totalConsumption = useMemo(() =>
    monthConsumption.reduce((s, r) => s + (r.consumption_kwh || 0), 0),
    [monthConsumption]
  );

  // Build per-unit report data
  const reportData = useMemo(() => {
    return units.map(unit => {
      const quota = unit.quota_percent || 0;
      const right = (monthGeneration * quota) / 100;
      const cons = monthConsumption.find(c => c.consumer_unit_id === unit.id);
      const consumption = cons?.consumption_kwh || 0;
      const tariff = cons?.tariff_kwh || unit.tariff_kwh || 0;
      const compensated = Math.min(right, consumption);
      const balance = right - consumption;
      const savings = compensated * tariff;
      return {
        id: unit.id,
        name: unit.name,
        code: unit.code || "-",
        is_main: unit.is_main,
        quota,
        right: right,
        consumption,
        compensated,
        balance,
        tariff,
        savings,
      };
    });
  }, [units, monthGeneration, monthConsumption]);

  const handleExportCsv = () => exportToCsv(reportData, selectedMonth);
  const handleExportPdf = () => exportToPdf(reportData, selectedMonth, monthGeneration, totalConsumption);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Sun className="w-10 h-10 animate-pulse text-yellow-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400 rounded-xl">
              <BarChart2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-xs text-gray-400">Consumo, Geração e Compensação por UC</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportCsv}>
              <FileText className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button className="bg-yellow-400 hover:bg-yellow-500 text-white" onClick={handleExportPdf}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {units.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Users className="w-12 h-12 mb-3 text-gray-200" />
            <p className="font-medium">Nenhuma unidade consumidora cadastrada</p>
            <p className="text-sm mt-1">Cadastre unidades na página de Unidades</p>
          </div>
        ) : (
          <>
            <MonthlyReportSummary
              month={selectedMonth}
              generation={monthGeneration}
              totalConsumption={totalConsumption}
              unitCount={units.length}
              reportData={reportData}
            />
            <ReportCharts reportData={reportData} generation={monthGeneration} />
            <ReportTable reportData={reportData} />
          </>
        )}
      </div>
    </div>
  );
}