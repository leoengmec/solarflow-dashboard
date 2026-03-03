import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  success: { label: "Sucesso", color: "bg-green-100 text-green-700", Icon: CheckCircle },
  partial: { label: "Parcial", color: "bg-yellow-100 text-yellow-700", Icon: Clock },
  error: { label: "Erro", color: "bg-red-100 text-red-700", Icon: AlertCircle },
};

export default function UploadHistory({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">Histórico de Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 text-center py-4">Nenhum upload realizado ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-700">Histórico de Uploads</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {logs.map((log) => {
            const cfg = statusConfig[log.status] || statusConfig.success;
            const Icon = cfg.Icon;
            return (
              <div key={log.id} className="flex items-center gap-3 px-6 py-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{log.filename}</p>
                  <p className="text-xs text-gray-400">
                    {log.upload_date
                      ? format(parseISO(log.upload_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : format(parseISO(log.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {log.records_imported != null && ` • ${log.records_imported} registros`}
                  </p>
                </div>
                <Badge className={`text-xs ${cfg.color} flex items-center gap-1`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}