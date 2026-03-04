import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Plus, Pencil, Trash2, Star, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UnitForm from "../components/units/UnitForm";

export default function Unidades() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ConsumerUnit.list("name", 100);
    setUnits(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.ConsumerUnit.update(editing.id, data);
    } else {
      await base44.entities.ConsumerUnit.create(data);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta unidade?")) {
      await base44.entities.ConsumerUnit.delete(id);
      load();
    }
  };

  const totalQuota = units.reduce((s, u) => s + (u.quota_percent || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Unidades Consumidoras</h1>
              <p className="text-xs text-gray-400">Cadastro e quotas de distribuição</p>
            </div>
          </div>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova UC
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {totalQuota > 0 && (
          <div className={`text-sm px-4 py-2 rounded-xl ${Math.abs(totalQuota - 100) < 0.1 ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
            Soma das quotas: <strong>{totalQuota.toFixed(1)}%</strong>
            {Math.abs(totalQuota - 100) >= 0.1 && " — a soma deve ser 100% para distribuição completa"}
          </div>
        )}

        {showForm && (
          <UnitForm
            unit={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Sun className="w-8 h-8 animate-pulse text-yellow-300" />
          </div>
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Users className="w-10 h-10 mb-3 text-gray-200" />
            <p className="font-medium">Nenhuma unidade cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova UC" para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {units.map(unit => (
              <Card key={unit.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  <div className={`p-2 rounded-xl ${unit.is_main ? "bg-yellow-400" : "bg-gray-100"}`}>
                    {unit.is_main ? <Star className="w-5 h-5 text-white" /> : <Users className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{unit.name}</p>
                      {unit.is_main && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Unidade Principal</Badge>}
                      {unit.code && <span className="text-xs text-gray-400">Cód: {unit.code}</span>}
                    </div>
                    {unit.address && <p className="text-xs text-gray-400 mt-0.5">{unit.address}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-yellow-600">{(unit.quota_percent || 0).toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">Quota</p>
                    </div>
                    {unit.tariff_kwh > 0 && (
                      <div className="text-center">
                        <p className="font-bold text-blue-600">R$ {unit.tariff_kwh.toFixed(4)}</p>
                        <p className="text-xs text-gray-400">Tarifa</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(unit); setShowForm(true); }}>
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(unit.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}