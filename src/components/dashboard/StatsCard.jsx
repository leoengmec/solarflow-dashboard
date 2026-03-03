import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function StatsCard({ title, value, unit, icon: Icon, color, trend, trendLabel }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-400";

  return (
    <Card className="relative overflow-hidden border-0 shadow-md">
      <div className={`absolute inset-0 opacity-5 ${color}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">{value}</span>
              <span className="text-sm text-gray-500 font-medium">{unit}</span>
            </div>
            {trendLabel && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span>{trendLabel}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color} bg-opacity-15`}>
            <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}