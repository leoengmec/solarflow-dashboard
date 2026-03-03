import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRESETS = [
  { label: "Hoje", getValue: () => ({ start: format(new Date(), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "7 dias", getValue: () => ({ start: format(subDays(new Date(), 6), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "30 dias", getValue: () => ({ start: format(subDays(new Date(), 29), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Este mês", getValue: () => ({ start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: format(endOfMonth(new Date()), "yyyy-MM-dd") }) },
  { label: "Mês passado", getValue: () => ({ start: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), end: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") }) },
  { label: "Este ano", getValue: () => ({ start: format(startOfYear(new Date()), "yyyy-MM-dd"), end: format(endOfYear(new Date()), "yyyy-MM-dd") }) },
  { label: "Ano passado", getValue: () => ({ start: format(startOfYear(subYears(new Date(), 1)), "yyyy-MM-dd"), end: format(endOfYear(subYears(new Date(), 1)), "yyyy-MM-dd") }) },
];

export default function PeriodSelector({ period, onPeriodChange }) {
  const [activePreset, setActivePreset] = useState("30 dias");

  const handlePreset = (preset) => {
    setActivePreset(preset.label);
    onPeriodChange(preset.getValue());
  };

  const handleCustomChange = (field, value) => {
    setActivePreset(null);
    onPeriodChange({ ...period, [field]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant={activePreset === preset.label ? "default" : "outline"}
            size="sm"
            onClick={() => handlePreset(preset)}
            className={activePreset === preset.label ? "bg-yellow-500 hover:bg-yellow-600 text-white border-0" : "text-gray-600"}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Calendar className="w-4 h-4 text-gray-400" />
        <Input
          type="date"
          value={period.start}
          onChange={(e) => handleCustomChange("start", e.target.value)}
          className="w-36 h-8 text-sm"
        />
        <span className="text-gray-400 text-sm">→</span>
        <Input
          type="date"
          value={period.end}
          onChange={(e) => handleCustomChange("end", e.target.value)}
          className="w-36 h-8 text-sm"
        />
      </div>
    </div>
  );
}