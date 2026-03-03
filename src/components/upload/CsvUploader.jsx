import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Parsers ────────────────────────────────────────────────────────────────────

function parseCsvText(text) {
  const lines = text.trim().split(/\r?\n/);
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

function parseTsvText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split("\t").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "json") {
    const text = await file.text();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }

  if (ext === "xls" || ext === "xlsx") {
    // Use ExtractDataFromUploadedFile integration for Excel files
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      }
    });
    if (result.status !== "success") throw new Error(result.details || "Erro ao processar Excel");
    const rows = result.output?.rows || result.output;
    return Array.isArray(rows) ? rows : [];
  }

  // csv / txt
  const text = await file.text();
  if (text.includes("\t")) return parseTsvText(text);
  return parseCsvText(text);
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function mapRow(row) {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  const rawRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  const find = (candidates) => keys.find(k => candidates.some(c => k.includes(c)));

  const dateKey = find(["date", "data", "dia", "datetime", "timestamp", "time", "hora"]);
  const energyKey = find(["energy", "energia", "kwh", "e_day", "eday", "yield", "geracao"]);
  const powerKey = find(["power", "potencia", "kw", "pac", "ppv"]);
  const voltageKey = find(["voltage", "tensao", "volt", "vac", "vpv"]);
  const currentKey = find(["current", "corrente", "amp", "iac", "ipv"]);
  const tempKey = find(["temp", "temperatura", "celsius"]);

  const rawDate = dateKey ? rawRow[dateKey] : null;
  if (!rawDate) return null;

  let timestamp, date;
  try {
    const parsed = new Date(String(rawDate).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(parsed.getTime())) return null;
    timestamp = parsed.toISOString();
    date = parsed.toISOString().split("T")[0];
  } catch { return null; }

  return {
    timestamp, date,
    energy_kwh: energyKey ? parseFloat(rawRow[energyKey]) || 0 : 0,
    power_kw: powerKey ? parseFloat(rawRow[powerKey]) || null : null,
    voltage_v: voltageKey ? parseFloat(rawRow[voltageKey]) || null : null,
    current_a: currentKey ? parseFloat(rawRow[currentKey]) || null : null,
    temperature_c: tempKey ? parseFloat(rawRow[tempKey]) || null : null,
  };
}

// ── Import logic ───────────────────────────────────────────────────────────────

async function importFile(file, existingTs) {
  const rows = await parseFile(file);
  const mapped = rows.map(mapRow).filter(Boolean);

  if (mapped.length === 0) {
    return { status: "error", message: "Nenhum dado válido encontrado.", imported: 0, skipped: 0 };
  }

  const newRecords = mapped.filter(r => !existingTs.has(r.timestamp)).map(r => ({ ...r, source_file: file.name }));
  newRecords.forEach(r => existingTs.add(r.timestamp)); // prevent cross-file dupes

  let imported = 0;
  for (let i = 0; i < newRecords.length; i += 100) {
    await base44.entities.EnergyRecord.bulkCreate(newRecords.slice(i, i + 100));
    imported += newRecords.slice(i, i + 100).length;
  }

  const skipped = mapped.length - newRecords.length;
  await base44.entities.UploadLog.create({
    filename: file.name,
    records_imported: imported,
    status: "success",
    notes: skipped > 0 ? `${skipped} duplicatas ignoradas` : "",
    upload_date: new Date().toISOString()
  });

  return { status: "success", imported, skipped };
}

// ── Component ──────────────────────────────────────────────────────────────────

const ACCEPTED = ".csv,.xls,.xlsx,.txt,.json";

export default function CsvUploader({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false);
  const [fileStates, setFileStates] = useState([]); // [{name, status, result}]
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef();

  const setFileStatus = (name, update) => {
    setFileStates(prev => prev.map(f => f.name === name ? { ...f, ...update } : f));
  };

  const processFiles = async (files) => {
    const list = Array.from(files).filter(f => /\.(csv|xls|xlsx|txt|json)$/i.test(f.name));
    if (!list.length) return;

    setProcessing(true);
    setFileStates(list.map(f => ({ name: f.name, status: "loading", result: null })));

    // Load existing timestamps once
    const existing = await base44.entities.EnergyRecord.list("-timestamp", 5000);
    const existingTs = new Set(existing.map(r => r.timestamp));

    // Process sequentially to share existingTs set (avoid cross-file duplicates)
    for (const file of list) {
      const res = await importFile(file, existingTs).catch(err => ({
        status: "error", message: err.message, imported: 0, skipped: 0
      }));
      setFileStatus(file.name, { status: res.status, result: res });
    }

    setProcessing(false);
    onUploadComplete?.();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    processFiles(e.target.files);
    e.target.value = "";
  };

  const reset = () => { setFileStates([]); setProcessing(false); };

  const allDone = fileStates.length > 0 && fileStates.every(f => f.status !== "loading");

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        dragging ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:border-yellow-300"
      } shadow-none`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={handleFileSelect} />

        {fileStates.length === 0 && (
          <div
            className="text-center cursor-pointer py-4"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
            <p className="font-semibold text-gray-700">Arraste arquivos aqui ou clique para selecionar</p>
            <p className="text-sm text-gray-400 mt-1">CSV, XLS, XLSX, TXT, JSON • múltiplos arquivos</p>
          </div>
        )}

        {fileStates.length > 0 && (
          <div className="space-y-3">
            {fileStates.map(({ name, status, result }) => (
              <div key={name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{name}</p>
                  {result?.message && <p className="text-xs text-gray-400 mt-0.5">{result.message}</p>}
                  {result && result.status === "success" && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge className="bg-green-100 text-green-700 text-xs">{result.imported} importados</Badge>
                      {result.skipped > 0 && <Badge variant="outline" className="text-xs">{result.skipped} duplicatas</Badge>}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {status === "loading" && <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />}
                  {status === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {status === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
                </div>
              </div>
            ))}

            {allDone && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={reset} className="flex-1">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
                <Button size="sm" className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-white" onClick={() => inputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Mais arquivos
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}