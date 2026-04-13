import { useState, useMemo, Suspense, lazy } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { Sun, Zap, TrendingUp, Upload, BarChart2, Users } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import StatsCard from "../components/dashboard/StatsCard";
import PeriodSelector from "../components/dashboard/PeriodSelector";
import { useGrowattData } from "@/hooks/useGrowattData";

// Lazy components (perf)
const EnergyChart = lazy(() => import("../components/dashboard/EnergyChart"));
const MonthlyHeatmap = lazy(() => import("../components/dashboard/MonthlyHeatmap"));
const UploadHistory = lazy(() => import("../components/dashboard/UploadHistory"));
const CsvUploader = lazy(() => import("../components/upload/CsvUploader"));

interface EnergyRecord {
  date: string;
  energy_kwh: number;
  power_kw: number;
}

interface Period {
  start: string;
  end: string;
}

interface GroupedData {
  data: Array<{ label: string; energy_kwh: number; max_power_kw: number; count: number }>;
  groupBy: "day" | "month";
}

function groupRecords(records: EnergyRecord[], period: Period): GroupedData {
  const daysDiff = (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24);
  let groupBy: "day" | "month" = "day";
  if (daysDiff > 365 || daysDiff > 90) groupBy = "month";
  const groups: Record<string, { label: string; energy_kwh: number; max_power_kw: number; count: number }> = {};
  records.forEach((r) => {
    const key = groupBy === "month" ? r.date.substring(0, 7) : r.date;
    if (!groups[key]) groups[key] = { label: key, energy_kwh: 0, max_power_kw: 0, count: 0 };
    groups[key].energy_kwh += r.energy_kwh || 0;
    groups[key].max_power_kw = Math.max(groups[key].max_power_kw, r.power_kw || 0);
    groups[key].count++;
  });
  return { data: Object.values(groups).sort((a, b) => a.label.localeCompare(b.label)), groupBy };
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>({
    start: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();

  // TanStack queries
  const { data: allRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["energyRecords"],
    queryFn: () => base44.entities.EnergyRecord.list("-date", 5000) as Promise<EnergyRecord[]>,
    staleTime: 5 * 60 * 1000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["uploadLogs"],
    queryFn: () => base44.entities.UploadLog.list("-created_date", 20),
    staleTime: 60 * 1000,
  });

  const { records: growattRecords, isLoading: growattLoading, sync: syncGrowatt } = useGrowattData(period);

  const records = useMemo(() => allRecords.filter((r) => r.date >= period.start && r.date <= period.end), [allRecords, period]);

  const stats = useMemo(() => {
    const totalEnergy = records.reduce((s, r) => s + (r.energy_kwh || 0), 0);
    const maxPower = Math.max(...records.map((r) => r.power_kw || 0), 0);
    const avgDaily = records.length > 0 ? totalEnergy / new Set(records.map((r) => r.date)).size : 0;
    const co2Saved = totalEnergy * 0.4;
    return { totalEnergy, maxPower, avgDaily, co2Saved };
  }, [records]);

  const { data: chartData, groupBy } = useMemo(() => groupRecords(records, period), [records, period]);
  const currentYear = new Date().getFullYear();
  const loading = recordsLoading || logsLoading;

  const refreshData = () => queryClient.invalidateQueries({ queryKey: ["energyRecords", "uploadLogs"] });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header igual anterior */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
        {/* ... header JSX igual ... */}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {showUpload && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Importar Dados</h2>
              <Suspense fallback={<div>Carregando uploader...</div>}>
                <CsvUploader onUploadComplete={() => { refreshData(); setShowUpload(false); }} />
              </Suspense>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico</h2>
              <Suspense fallback={<div>Carregando histórico...</div>}>
                <UploadHistory logs={logs} />
              </Suspense>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <PeriodSelector period={period} onPeriodChange={setPeriod} />
          <Button
            onClick={() => syncGrowatt(growattRecords || [])}
            disabled={growattLoading || !growattRecords}
            className="bg-blue-500 hover:bg-blue-600 ml-4 mt-2"
          >
            {growattLoading ? "⏳ Sync..." : "🔄 Sync Growatt"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Energia Total" value={stats.totalEnergy.toFixed(2)} unit="kWh" icon={Zap} color="bg-yellow-400" />
          <StatsCard title="Média Diária" value={stats.avgDaily.toFixed(2)} unit="kWh/dia" icon={BarChart2} color="bg-orange-400" />
          <StatsCard title="Pico de Potência" value={stats.maxPower.toFixed(2)} unit="kW" icon={TrendingUp} color="bg-amber-400" />
          <StatsCard title="CO₂ Evitado" value={stats.co2Saved >= 1000 ? (stats.co2Saved / 1000).toFixed(2) : stats.co2Saved.toFixed(1)} unit={stats.co2Saved >= 1000 ? "t" : "kg"} icon={Sun} color="bg-green-400" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
            Nenhum dado. Sync Growatt ou importe CSV.
            <Button className="mt-4 bg-yellow-400 hover:bg-yellow-500" onClick={() => setShowUpload(true)}>
              Importar CSV
            </Button>
          </div>
        ) : (
          <Suspense fallback={<div>Carregando charts...</div>}>
            <EnergyChart data={chartData} groupBy={groupBy} />
            <MonthlyHeatmap records={allRecords.filter((r) => r.date.startsWith(currentYear.toString()))} year={currentYear} />
          </Suspense>
        )}
      </div>
    </div>
  );
}