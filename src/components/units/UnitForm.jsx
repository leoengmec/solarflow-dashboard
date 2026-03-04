import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

export default function UnitForm({ unit, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: unit?.name || "",
    code: unit?.code || "",
    is_main: unit?.is_main || false,
    quota_percent: unit?.quota_percent || "",
    tariff_kwh: unit?.tariff_kwh || "",
    address: unit?.address || "",
    notes: unit?.notes || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      quota_percent: parseFloat(form.quota_percent) || 0,
      tariff_kwh: parseFloat(form.tariff_kwh) || 0,
    });
  };

  return (
    <Card className="border-yellow-200 shadow-sm">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-700">{unit ? "Editar Unidade" : "Nova Unidade Consumidora"}</h3>
            <Button type="button" size="icon" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Nome da UC *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Fazenda Central" required />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Código / Nº UC</Label>
              <Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="Ex: 1234567-8" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Quota de Geração (%)</Label>
              <Input type="number" min="0" max="100" step="0.01" value={form.quota_percent} onChange={e => set("quota_percent", e.target.value)} placeholder="Ex: 50" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Tarifa (R$/kWh)</Label>
              <Input type="number" min="0" step="0.0001" value={form.tariff_kwh} onChange={e => set("tariff_kwh", e.target.value)} placeholder="Ex: 0.8965" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">Endereço</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Endereço da unidade" />
            </div>
          </div>

          <div className="flex items-center gap-3 py-2">
            <Switch checked={form.is_main} onCheckedChange={v => set("is_main", v)} id="is_main" />
            <Label htmlFor="is_main" className="text-sm text-gray-600 cursor-pointer">
              Esta é a <strong>Unidade Principal</strong> (unidade geradora / conexão com a distribuidora)
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-white">Salvar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}