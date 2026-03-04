import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Zap, Users, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function StatBox({ label, value, unit, IconComp, color }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <IconComp className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className="text-xl font-bold text-gray-800">{value} <span className="text-sm font-normal text-gray-500">{unit}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonthlyReportSummary({ month, generation, totalConsumption, unitCount, reportData }) {
  const monthLabel = (() => {
    try { return format(new Date(month + "-01"), "MMMM yyyy", { locale: ptBR }); }
    catch { return month; }
  })();

  const totalSavings = reportData.reduce((s, r) => s + (r.savings || 0), 0);
  const totalCompensated = reportData.reduce((s, r) => s + (r.compensated || 0), 0);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">{monthLabel}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Geração Total" value={generation.toFixed(2)} unit="kWh" IconComp={Zap} color="bg-yellow-400" />
        <StatBox label="Consumo Total" value={totalConsumption.toFixed(2)} unit="kWh" IconComp={TrendingUp} color="bg-orange-400" />
        <StatBox label="Energia Compensada" value={totalCompensated.toFixed(2)} unit="kWh" IconComp={Zap} color="bg-green-400" />
        <StatBox label="Economia Total" value={`R$ ${totalSavings.toFixed(2)}`} unit="" IconComp={DollarSign} color="bg-blue-400" />
      </div>
    </div>
  );
}