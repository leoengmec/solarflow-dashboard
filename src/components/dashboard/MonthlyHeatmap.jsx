import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, eachDayOfInterval, startOfYear, endOfYear, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getColor(value, max) {
  if (!value || value === 0) return "bg-gray-100";
  const ratio = value / max;
  if (ratio < 0.2) return "bg-yellow-100";
  if (ratio < 0.4) return "bg-yellow-200";
  if (ratio < 0.6) return "bg-yellow-300";
  if (ratio < 0.8) return "bg-yellow-400";
  return "bg-yellow-500";
}

export default function MonthlyHeatmap({ records, year }) {
  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = 0;
    byDate[r.date] += r.energy_kwh || 0;
  });

  const maxVal = Math.max(...Object.values(byDate), 1);
  const startYear = new Date(year, 0, 1);
  const endYear = new Date(year, 11, 31);
  const days = eachDayOfInterval({ start: startYear, end: endYear });

  // Build weeks
  const firstDayOfWeek = getDay(startYear);
  const paddedDays = [...Array(firstDayOfWeek).fill(null), ...days];

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-700">Mapa de Calor — Geração Diária {year}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-4">
        <div className="flex gap-1 mb-2">
          {MONTHS.map((m, i) => {
            const monthStart = new Date(year, i, 1);
            const weekIndex = Math.floor((getDay(new Date(year, 0, 1)) + eachDayOfInterval({ start: new Date(year, 0, 1), end: monthStart }).length - 1) / 7);
            return <div key={m} style={{ minWidth: 40, flex: 1 }} className="text-xs text-gray-400 text-center">{m}</div>;
          })}
        </div>
        <TooltipProvider>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(paddedDays.length / 7) }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = paddedDays[weekIdx * 7 + dayIdx];
                  if (!day) return <div key={dayIdx} className="w-3 h-3" />;
                  const dateStr = format(day, "yyyy-MM-dd");
                  const val = byDate[dateStr] || 0;
                  return (
                    <Tooltip key={dayIdx}>
                      <TooltipTrigger asChild>
                        <div className={`w-3 h-3 rounded-sm cursor-pointer ${getColor(val, maxVal)}`} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{format(day, "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p className="text-xs font-bold">{val.toFixed(2)} kWh</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-400">Menos</span>
          {["bg-gray-100", "bg-yellow-100", "bg-yellow-200", "bg-yellow-300", "bg-yellow-400", "bg-yellow-500"].map(c => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-xs text-gray-400">Mais</span>
        </div>
      </CardContent>
    </Card>
  );
}