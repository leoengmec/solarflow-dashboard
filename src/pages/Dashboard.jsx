import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { Sun, Zap, TrendingUp, Upload, BarChart2, Users } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import StatsCard from "../components/dashboard/StatsCard";
import PeriodSelector from "../components/dashboard/PeriodSelector";
import EnergyChart from "../components/dashboard/EnergyChart";
import MonthlyHeatmap from "../components/dashboard/MonthlyHeatmap";
import UploadHistory from "../components/dashboard/UploadHistory";
import CsvUploader from "../components/upload/CsvUploader";
import { useGrowattSync } from "@/hooks/useGrowattSync";  // Novo hook

function groupRecords(records, period) {
  const daysDiff = (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24);
  let groupBy = "day";
  if (daysDiff > 365) groupBy = "month";
  else if (daysDiff > 90) groupBy = "month";
  const groups = {};
  records.forEach(r => {
    let key = groupBy === "month" ? r.date.substring(0, 7) : r.date;
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

  const { mutate: syncGrowatt, isPending: syncLoading } = useGrowattSync();

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
    const co2Saved = totalEnergy * 0.4;
    return { totalEnergy, maxPower, avgDaily, co2Saved };
  }, [records]);

  const { data: chartData, groupBy } = useMemo(() => groupRecords(records, period), [records, period]);
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header igual ao original */}
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
          <div className="flex gap-2">
            <a href={createPageUrl("Unidades")} className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
              <Users className="w-4 h-4 mr-2" /> Unidades
            </a>
            <a href={createPageUrl("Relatorios")} className="inline-flex
