import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = Deno.env.get('GROWATT_TOKEN');
    const sn = Deno.env.get('GROWATT_SN');

    if (!token || !sn) {
      return Response.json({ error: 'GROWATT_TOKEN e GROWATT_SN são obrigatórios' }, { status: 400 });
    }

    // Buscar lista de plantas
    const plantsRes = await fetch('https://server.growatt.com/v1/plant/getplantlistbypage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 50 }),
    });
    const plantsData = await plantsRes.json();
    const plants = plantsData.data || [];
    const plant = plants.find(p => p.plantName?.includes('Elias Alves')) || plants[0];

    if (!plant) {
      return Response.json({ error: 'Nenhuma planta encontrada. Verifique o token Growatt.' }, { status: 404 });
    }

    const plantId = plant.plantId;
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Buscar histórico de geração
    const historyRes = await fetch('https://server.growatt.com/v1/device/gethistorydata', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sn, plantId, startDate: start, endDate: end, dataType: 'daily' }),
    });
    const historyData = await historyRes.json();
    const records = historyData.data || [];

    if (records.length === 0) {
      return Response.json({ success: true, count: 0, message: 'Sem novos dados no período' });
    }

    // Buscar registros existentes para evitar duplicatas
    const existing = await base44.entities.EnergyRecord.filter({ date: { $gte: start, $lte: end } });
    const existingDates = new Set(existing.map(r => r.date));

    const toCreate = records
      .filter(rec => !existingDates.has(rec.date?.split(' ')[0]))
      .map(rec => ({
        date: rec.date?.split(' ')[0] || rec.date,
        timestamp: rec.date || `${rec.date}T00:00:00Z`,
        energy_kwh: parseFloat(rec.energy_kwh) || 0,
        power_kw: parseFloat(rec.power_kw) || 0,
        source_file: 'growatt_api',
      }));

    if (toCreate.length > 0) {
      await base44.entities.EnergyRecord.bulkCreate(toCreate);
    }

    return Response.json({ success: true, count: toCreate.length, plantId, plant: plant.plantName });
  } catch (error) {
    console.error('Growatt sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});