import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format, subDays, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sun, Zap, TrendingUp, Upload, BarChart2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import StatsCard from "../components/dashboard/StatsCard";
import PeriodSelector from "../components/dashboard/PeriodSelector";
import EnergyChart from "../components/dashboard/EnergyChart";
import MonthlyHeatmap from "../components/dashboard/MonthlyHeatmap";
import UploadHistory from "../components/dashboard/UploadHistory";
import CsvUploader from "../components/upload/CsvUploader";

function groupRecords(records, period) {
  const daysDiff = (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24);
  let groupBy = "day";
  if (daysDiff > 365) groupBy = "month";
  else if (daysDiff > 90) groupBy = "month";

  const groups = {};
  records.forEach(r => {
    let key;
    const d = r.date;
    if (groupBy === "month") key = d.substring(0, 7);
    else key = d;

    if (!groups[key]) groups[key] = { label: key, energy_kwh: 0, max_power_kw: 0, count: 0 };
    groups[key].energy_kwh += r.energy_kwh || 0;
    groups[key].max_power_kw = Math.max(groups[key].max_power_kw, r.power_kw || 0);
    groups[key].count++;
  });

  return { data: Object.values(groups).sort((a, b) => a.label.localeCompare(b.label)), groupBy };
}

export default function Dashboard() {
  const [period, setPeriod] = useState({
    start: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [recs, uploadLogs] = await Promise.all([
      base44.entities.EnergyRecord.list("-date", 5000),
      base44.entities.UploadLog.list("-created_date", 20),
    ]);
    setAllRecords(recs);
    setLogs(uploadLogs);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const filtered = allRecords.filter(r => r.date >= period.start && r.date <= period.end);
    setRecords(filtered);
  }, [allRecords, period]);

  const stats = useMemo(() => {
    const totalEnergy = records.reduce((s, r) => s + (r.energy_kwh || 0), 0);
    const maxPower = Math.max(...records.map(r => r.power_kw || 0), 0);
    const avgDaily = records.length > 0 ? totalEnergy / new Set(records.map(r => r.date)).size : 0;
    const co2Saved = totalEnergy * 0.4; // ~0.4 kg CO2 per kWh
    return { totalEnergy, maxPower, avgDaily, co2Saved };
  }, [records]);

  const { data: chartData, groupBy } = useMemo(() => groupRecords(records, period), [records, period]);
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400 rounded-xl">
              <Sun className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SolarBI</h1>
              <p className="text-xs text-gray-400">Monitoramento de Geração Solar</p>
            </div>
          </div>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            className={showUpload ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-yellow-400 hover:bg-yellow-500 text-white"}
          >
            <Upload className="w-4 h-4 mr-2" />
            {showUpload ? "Fechar Upload" : "Importar CSV"}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Upload Area */}
        {showUpload && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Importar Dados</h2>
              <CsvUploader onUploadComplete={() => { loadData(); setShowUpload(false); }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico</h2>
              <UploadHistory logs={logs} />
            </div>
          </div>
        )}

        {/* Period Selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <PeriodSelector period={period} onPeriodChange={setPeriod} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Energia Total"
            value={stats.totalEnergy.toFixed(2)}
            unit="kWh"
            icon={Zap}
            color="bg-yellow-400"
          />
          <StatsCard
            title="Média Diária"
            value={stats.avgDaily.toFixed(2)}
            unit="kWh/dia"
            icon={BarChart2}
            color="bg-orange-400"
          />
          <StatsCard
            title="Pico de Potência"
            value={stats.maxPower.toFixed(2)}
            unit="kW"
            icon={TrendingUp}
            color="bg-amber-400"
          />
          <StatsCard
            title="CO₂ Evitado"
            value={stats.co2Saved >= 1000 ? (stats.co2Saved / 1000).toFixed(2) : stats.co2Saved.toFixed(1)}
            unit={stats.co2Saved >= 1000 ? "t" : "kg"}
            icon={Sun}
            color="bg-green-400"
          />
        </div>

        {/* Charts */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <Sun className="w-12 h-12 mx-auto mb-3 animate-pulse text-yellow-300" />
              <p>Carregando dados...</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Sun className="w-12 h-12 mb-3 text-gray-200" />
            <p className="font-medium">Nenhum dado no período selecionado</p>
            <p className="text-sm mt-1">Importe um CSV ou altere o período</p>
            <Button className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-white" onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4 mr-2" /> Importar CSV
            </Button>
          </div>
        ) : (
          <>
            <EnergyChart data={chartData} groupBy={groupBy} />
            <MonthlyHeatmap records={allRecords.filter(r => r.date.startsWith(currentYear.toString()))} year={currentYear} />
          </>
        )}
      </div>
    </div>
  );
}