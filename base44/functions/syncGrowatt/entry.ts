import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE = 'https://openapi.growatt.com';

// Growatt OpenAPI V1 usa GET com query string e token no header
async function growattGet(path, token, params = {}) {
  const url = new URL(`${BASE}/v1/${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== '') url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), {
    headers: { 'token': token },
  });
  return res.json();
}

async function growattPost(path, token, formData = {}) {
  const body = new URLSearchParams(formData).toString();
  const res = await fetch(`${BASE}/v1/${path}`, {
    method: 'POST',
    headers: { 'token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = Deno.env.get('GROWATT_TOKEN')?.trim();
    const sn = Deno.env.get('GROWATT_SN')?.trim();
    console.log('Token len:', token?.length, 'SN:', sn);

    if (!token || !sn) return Response.json({ error: 'GROWATT_TOKEN e GROWATT_SN são obrigatórios' }, { status: 400 });

    // 1. Listar plantas
    const plantsData = await growattGet('plant/list', token, { page: '', perpage: '' });
    console.log('Plants response:', JSON.stringify(plantsData));

    const plants = plantsData.data?.plants || plantsData.data || [];
    const plantsArr = Array.isArray(plants) ? plants : [];
    const plant = plantsArr.find(p => (p.name || p.plantName || '').includes('Elias Alves')) || plantsArr[0];

    if (!plant) return Response.json({ error: 'Nenhuma planta encontrada', raw: plantsData }, { status: 404 });

    const plantId = plant.plant_id || plant.plantId || plant.id;

    // 2. Buscar histórico de geração por planta (energy history mensal)
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const historyData = await growattGet('plant/energy', token, {
      plant_id: plantId,
      start_date: start,
      end_date: end,
      time_unit: 'day',
    });
    console.log('History response:', JSON.stringify(historyData).substring(0, 600));

    const energies = historyData.data?.energies || historyData.data?.datas || historyData.data || [];
    if (!Array.isArray(energies) || energies.length === 0) {
      return Response.json({ success: true, count: 0, message: 'Sem dados no período', raw: historyData });
    }

    // 3. Evitar duplicatas
    const existing = await base44.asServiceRole.entities.EnergyRecord.filter({ source_file: 'growatt_api' });
    const existingDates = new Set(existing.map(r => r.date));

    const toCreate = energies
      .map(rec => ({
        date: (rec.date || rec.time || '').split(' ')[0],
        timestamp: rec.date || rec.time || new Date().toISOString(),
        energy_kwh: parseFloat(rec.energy || rec.energy_kwh || rec.eTotal || 0),
        power_kw: parseFloat(rec.power || rec.power_kw || rec.pac || 0),
        source_file: 'growatt_api',
      }))
      .filter(r => r.date && !existingDates.has(r.date));

    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.EnergyRecord.bulkCreate(toCreate);
    }

    return Response.json({ success: true, count: toCreate.length, plantId, plant: plant.name || plant.plantName });
  } catch (error) {
    console.error('Growatt sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});