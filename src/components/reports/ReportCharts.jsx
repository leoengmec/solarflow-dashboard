import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from "recharts";

const COLORS = ["#facc15", "#fb923c", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#f87171"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong> {p.unit || "kWh"}</p>
      ))}
    </div>
  );
};

export default function ReportCharts({ reportData, generation }) {
  const barData = reportData.map((u, i) => ({
    name: u.name.length > 12 ? u.name.substring(0, 12) + "…" : u.name,
    "Consumo": parseFloat(u.consumption.toFixed(2)),
    "Direito": parseFloat(u.right.toFixed(2)),
    "Compensado": parseFloat(u.compensated.toFixed(2)),
  }));

  const balanceData = reportData.map(u => ({
    name: u.name.length > 12 ? u.name.substring(0, 12) + "…" : u.name,
    "Saldo": parseFloat(u.balance.toFixed(2)),
    positive: u.balance >= 0,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Consumo vs Direito */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">Consumo vs. Direito por UC</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} unit=" kWh" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Consumo" fill="#fb923c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Direito" fill="#facc15" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Compensado" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Saldo de compensação */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">Saldo de Compensação por UC</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={balanceData} margin={{ top: 4, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} unit=" kWh" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Saldo" radius={[4, 4, 0, 0]}>
                {balanceData.map((entry, i) => (
                  <Cell key={i} fill={entry.positive ? "#34d399" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2 text-center">Verde = crédito | Vermelho = déficit</p>
        </CardContent>
      </Card>
    </div>
  );
}