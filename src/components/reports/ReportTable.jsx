import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ReportTable({ reportData }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-700">Detalhamento por Unidade Consumidora</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Unidade", "Código", "Quota (%)", "Direito (kWh)", "Consumo (kWh)", "Compensado (kWh)", "Saldo (kWh)", "Tarifa (R$/kWh)", "Economia (R$)"].map(h => (
                <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportData.map((u, i) => (
              <tr key={u.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <td className="py-3 px-3 font-medium text-gray-800 flex items-center gap-2">
                  {u.name}
                  {u.is_main && <Badge className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0">Principal</Badge>}
                </td>
                <td className="py-3 px-3 text-gray-500">{u.code}</td>
                <td className="py-3 px-3 text-gray-700">{u.quota.toFixed(1)}%</td>
                <td className="py-3 px-3 text-yellow-600 font-medium">{u.right.toFixed(2)}</td>
                <td className="py-3 px-3 text-orange-600 font-medium">{u.consumption.toFixed(2)}</td>
                <td className="py-3 px-3 text-green-600 font-medium">{u.compensated.toFixed(2)}</td>
                <td className="py-3 px-3">
                  <span className={`font-semibold ${u.balance >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {u.balance >= 0 ? "+" : ""}{u.balance.toFixed(2)}
                  </span>
                </td>
                <td className="py-3 px-3 text-gray-500">{u.tariff > 0 ? `R$ ${u.tariff.toFixed(4)}` : "-"}</td>
                <td className="py-3 px-3 text-blue-600 font-semibold">{u.savings > 0 ? `R$ ${u.savings.toFixed(2)}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportData.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nenhum dado para o mês selecionado</p>
        )}
      </CardContent>
    </Card>
  );
}