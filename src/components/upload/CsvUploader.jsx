import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function parseCsvText(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

function mapRow(row) {
  // Flexible column mapping
  const keys = Object.keys(row);
  const find = (candidates) => keys.find(k => candidates.some(c => k.includes(c)));

  const dateKey = find(["date", "data", "dia", "datetime", "timestamp", "time", "hora"]);
  const energyKey = find(["energy", "energia", "kwh", "e_day", "eday", "yield", "geracao"]);
  const powerKey = find(["power", "potencia", "kw", "pac", "ppv"]);
  const voltageKey = find(["voltage", "tensao", "volt", "vac", "vpv"]);
  const currentKey = find(["current", "corrente", "amp", "iac", "ipv"]);
  const tempKey = find(["temp", "temperatura", "celsius"]);

  const rawDate = dateKey ? row[dateKey] : null;
  if (!rawDate) return null;

  let timestamp, date;
  try {
    const parsed = new Date(rawDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(parsed.getTime())) return null;
    timestamp = parsed.toISOString();
    date = parsed.toISOString().split("T")[0];
  } catch {
    return null;
  }

  return {
    timestamp,
    date,
    energy_kwh: energyKey ? parseFloat(row[energyKey]) || 0 : 0,
    power_kw: powerKey ? parseFloat(row[powerKey]) || null : null,
    voltage_v: voltageKey ? parseFloat(row[voltageKey]) || null : null,
    current_a: currentKey ? parseFloat(row[currentKey]) || null : null,
    temperature_c: tempKey ? parseFloat(row[tempKey]) || null : null,
  };
}

export default function CsvUploader({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); // null | loading | success | error
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  const processFile = async (f) => {
    setFile(f);
    setStatus("loading");
    setResult(null);

    const text = await f.text();
    const rows = parseCsvText(text);
    const mapped = rows.map(mapRow).filter(Boolean);

    if (mapped.length === 0) {
      setStatus("error");
      setResult({ message: "Nenhum dado válido encontrado no arquivo. Verifique o formato do CSV." });
      return;
    }

    // Get existing timestamps to avoid duplicates
    const existing = await base44.entities.EnergyRecord.list("-timestamp", 5000);
    const existingTs = new Set(existing.map(r => r.timestamp));
    const newRecords = mapped.filter(r => !existingTs.has(r.timestamp)).map(r => ({ ...r, source_file: f.name }));

    if (newRecords.length === 0) {
      setStatus("success");
      setResult({ imported: 0, skipped: mapped.length, message: "Todos os registros já existem no banco." });
      await base44.entities.UploadLog.create({ filename: f.name, records_imported: 0, status: "success", notes: "Duplicatas ignoradas" });
      onUploadComplete?.();
      return;
    }

    // Bulk create in batches of 100
    let imported = 0;
    for (let i = 0; i < newRecords.length; i += 100) {
      const batch = newRecords.slice(i, i + 100);
      await base44.entities.EnergyRecord.bulkCreate(batch);
      imported += batch.length;
    }

    await base44.entities.UploadLog.create({
      filename: f.name,
      records_imported: imported,
      status: "success",
      notes: `${mapped.length - newRecords.length} duplicatas ignoradas`,
      upload_date: new Date().toISOString()
    });

    setStatus("success");
    setResult({ imported, skipped: mapped.length - newRecords.length });
    onUploadComplete?.();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) processFile(f);
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  const reset = () => { setFile(null); setStatus(null); setResult(null); };

  return (
    <Card
      className={`border-2 border-dashed transition-colors cursor-pointer ${
        dragging ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:border-yellow-300"
      } shadow-none`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !status && inputRef.current?.click()}
    >
      <CardContent className="p-8 text-center">
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />

        {!status && (
          <>
            <Upload className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
            <p className="font-semibold text-gray-700">Arraste o CSV aqui ou clique para selecionar</p>
            <p className="text-sm text-gray-400 mt-1">Arquivo .csv gerado pelo inversor</p>
          </>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
            <p className="font-medium text-gray-600">Processando <span className="font-bold">{file?.name}</span>...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-gray-700">{file?.name}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Badge className="bg-green-100 text-green-700">{result.imported} registros importados</Badge>
              {result.skipped > 0 && <Badge variant="outline">{result.skipped} duplicatas ignoradas</Badge>}
            </div>
            {result.message && <p className="text-sm text-gray-500">{result.message}</p>}
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); reset(); }}>
              <X className="w-4 h-4 mr-1" /> Novo upload
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="font-semibold text-gray-700">Erro ao processar arquivo</p>
            <p className="text-sm text-gray-500">{result?.message}</p>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); reset(); }}>
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}