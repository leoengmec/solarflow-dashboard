import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Zap, Plus, Trash2, Upload, Sun, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatMonth(m) {
  try { return format(new Date(m + "-01"), "MMM yyyy", { locale: ptBR }); } catch { return m; }
}

export default function Tarifas() {
  const [units, setUnits] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [form, setForm] = useState({ consumer_unit_id: "", effective_month: format(new Date(), "yyyy-MM"), tariff_kwh: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const csvRef = useRef();

  const load = async () => {
    setLoading(true);
    const [u, t] = await Promise.all([
      base44.entities.ConsumerUnit.list("name", 100),
      base44.entities.TariffRecord.list("-effective_month", 1000),
    ]);
    setUnits(u);
    setTariffs(t);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.consumer_unit_id || !form.effective_month || !form.tariff_kwh) return;
    setSaving(true);
    const unit = units.find(u => u.id === form.consumer_unit_id);
    await base44.entities.TariffRecord.create({
      ...form,
      tariff_kwh: parseFloat(form.tariff_kwh),
      consumer_unit_name: unit?.name || "",
    });
    setForm(f => ({ ...f, tariff_kwh: "", notes: "" }));
    setSaving(false);
    load();
  };

  const handleDelete = async (id) => {
    if (confirm("Excluir este registro de tarifa?")) {
      await base44.entities.TariffRecord.delete(id);
      load();
    }
  };

  // CSV Import: columns: consumer_unit_code OR consumer_unit_name, effective_month (YYYY-MM), tariff_kwh
  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvStatus("loading");
    const text = await file.text();
    const sep = text.includes(";") ? ";" : ",";
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return obj;
    }).filter(r => Object.values(r).some(v => v));

    const getKey = (r) => headers.find(h => ["codigo", "code", "consumer_unit_code"].includes(h));
    const getNameKey = (r) => headers.find(h => ["nome", "name", "unidade", "consumer_unit_name"].includes(h));
    const getMonthKey = () => headers.find(h => ["mes", "month", "effective_month", "vigencia"].includes(h));
    const getTariffKey = () => headers.find(h => ["tarifa", "tariff", "tariff_kwh", "valor", "value"].includes(h));

    const monthKey = getMonthKey();
    const tariffKey = getTariffKey();
    if (!monthKey || !tariffKey) {
      setCsvStatus("error");
      e.target.value = "";
      return;
    }

    let imported = 0;
    const records = [];
    for (const row of rows) {
      const codeKey = getKey(row);
      const nameKey = getNameKey(row);
      const unitCode = codeKey ? row[codeKey] : null;
      const unitName = nameKey ? row[nameKey] : null;
      const unit = units.find(u => (unitCode && u.code === unitCode) || (unitName && u.name === unitName));
      if (!unit) continue;
      const tariff = parseFloat(row[tariffKey]);
      if (!tariff || !row[monthKey]) continue;
      records.push({
        consumer_unit_id: unit.id,
        consumer_unit_name: unit.name,
        effective_month: row[monthKey].trim(),
        tariff_kwh: tariff,
        notes: row["notes"] || row["observacoes"] || "",
      });
      imported++;
    }

    if (records.length > 0) {
      await base44.entities.TariffRecord.bulkCreate(records);
    }
    setCsvStatus(imported > 0 ? "success" : "error");
    setTimeout(() => setCsvStatus(null), 3000);
    e.target.value = "";
    load();
  };

  const filtered = selectedUnit === "all" ? tariffs : tariffs.filter(t => t.consumer_unit_id === selectedUnit);

  // Group by unit for display
  const grouped = {};
  filtered.forEach(t => {
    const key = t.consumer_unit_id;
    if (!grouped[key]) grouped[key] = { name: t.consumer_unit_name, records: [] };
    grouped[key].records.push(t);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Histórico de Tarifas</h1>
              <p className="text-xs text-gray-400">R$/kWh por unidade consumidora ao longo do tempo</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvImport} />
            <Button variant="outline" onClick={() => csvRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Importar CSV
            </Button>
            {csvStatus === "success" && <Badge className="bg-green-100 text-green-700 self-center">Importado!</Badge>}
            {csvStatus === "error" && <Badge className="bg-red-100 text-red-700 self-center">Erro no CSV</Badge>}
            {csvStatus === "loading" && <Badge className="bg-gray-100 text-gray-600 self-center">Importando...</Badge>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* CSV format hint */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
          <FileText className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Formato do CSV para importação: <code className="font-mono bg-blue-100 px-1 rounded">consumer_unit_code</code> (ou <code className="font-mono bg-blue-100 px-1 rounded">consumer_unit_name</code>), <code className="font-mono bg-blue-100 px-1 rounded">effective_month</code> (YYYY-MM), <code className="font-mono bg-blue-100 px-1 rounded">tariff_kwh</code>
          </span>
        </div>

        {/* Add form */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Registrar Tarifa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Unidade Consumidora</Label>
                <Select value={form.consumer_unit_id} onValueChange={v => setForm(f => ({ ...f, consumer_unit_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Mês de Vigência</Label>
                <Input type="month" value={form.effective_month} onChange={e => setForm(f => ({ ...f, effective_month: e.target.value }))} required />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Tarifa (R$/kWh)</Label>
                <Input type="number" step="0.0001" min="0" placeholder="0.8965" value={form.tariff_kwh} onChange={e => setForm(f => ({ ...f, tariff_kwh: e.target.value }))} required />
              </div>
              <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white" disabled={saving}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Filtrar por UC:</span>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todas as UCs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as UCs</SelectItem>
              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* History */}
        {loading ? (
          <div className="flex justify-center py-16"><Sun className="w-8 h-8 animate-pulse text-yellow-300" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Zap className="w-8 h-8 mb-2 text-gray-200" />
            <p className="text-sm">Nenhum registro de tarifa encontrado</p>
          </div>
        ) : (
          Object.entries(grouped).map(([unitId, group]) => (
            <Card key={unitId} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-800">{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Mês de Vigência</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Tarifa (R$/kWh)</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Observações</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.sort((a, b) => b.effective_month.localeCompare(a.effective_month)).map((t, i) => (
                        <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="px-4 py-2 font-medium text-gray-700">{formatMonth(t.effective_month)}</td>
                          <td className="px-4 py-2 text-right font-bold text-blue-600">R$ {t.tariff_kwh.toFixed(4)}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{t.notes || "-"}</td>
                          <td className="px-4 py-2 text-right">
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}