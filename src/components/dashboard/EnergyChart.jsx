import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}:</span>
            <span className="font-bold">{Number(p.value).toFixed(2)} {p.unit || "kWh"}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function EnergyChart({ data, groupBy = "day" }) {
  const formatXAxis = (tick) => {
    try {
      const d = parseISO(tick);
      if (groupBy === "hour") return format(d, "HH:mm");
      if (groupBy === "day") return format(d, "dd/MM", { locale: ptBR });
      if (groupBy === "month") return format(d, "MMM/yy", { locale: ptBR });
      if (groupBy === "year") return format(d, "yyyy");
      return tick;
    } catch {
      return tick;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">Energia Gerada (kWh)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EAB308" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tickFormatter={formatXAxis} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="energy_kwh"
                name="Energia"
                stroke="#EAB308"
                strokeWidth={2.5}
                fill="url(#energyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">Potência Máxima (kW)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tickFormatter={formatXAxis} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="max_power_kw" name="Potência Máx." fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}