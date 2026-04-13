import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import SparkMD5 from 'npm:spark-md5@3.0.2';

const BASE = 'https://openapi.growatt.com';

// Growatt password hash: MD5 then replace '0' at even positions with 'c'
function hashPassword(pass) {
  let hashed = SparkMD5.hash(pass);
  for (let i = 0; i < hashed.length; i += 2) {
    if (hashed[i] === '0') {
      hashed = hashed.substring(0, i) + 'c' + hashed.substring(i + 1);
    }
  }
  return hashed;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const username = Deno.env.get('GROWATT_USER')?.trim();
    const password = Deno.env.get('GROWATT_PASS')?.trim();

    if (!username || !password) {
      return Response.json({ error: 'GROWATT_USER e GROWATT_PASS são obrigatórios' }, { status: 400 });
    }

    // 1. Login via newTwoLoginAPI.do
    const loginRes = await fetch(`${BASE}/newTwoLoginAPI.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
      },
      body: new URLSearchParams({
        userName: username,
        password: hashPassword(password),
      }).toString(),
    });

    const setCookies = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(',') || [];
    const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
    const loginData = await loginRes.json();
    console.log('Login result:', JSON.stringify(loginData).substring(0, 300));

    if (!loginData.back?.success) {
      return Response.json({ error: 'Login falhou', raw: loginData }, { status: 401 });
    }

    const userId = loginData.back.user?.id;

    // 2. Listar plantas
    const plantsRes = await fetch(`${BASE}/PlantListAPI.do?userId=${userId}`, {
      headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' },
    });
    const plantsData = await plantsRes.json();
    console.log('Plants:', JSON.stringify(plantsData).substring(0, 400));

    const plantsArr = plantsData.back?.data || plantsData.back || [];
    if (!Array.isArray(plantsArr) || plantsArr.length === 0) {
      return Response.json({ error: 'Nenhuma planta encontrada', raw: plantsData }, { status: 404 });
    }
    const plantId = plantsArr[0].plantId || plantsArr[0].id;

    // 3. Histórico mensal via newTwoPlantAPI.do
    const now = new Date();
    const allToCreate = [];

    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = `${year}-${month}`;

      const detailRes = await fetch(
        `${BASE}/PlantDetailAPI.do?plantId=${plantId}&type=1&date=${dateStr}`,
        { headers: { Cookie: cookieHeader, 'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12)' } }
      );
      const detailText = await detailRes.text();
      console.log(`Detail ${dateStr} [${detailRes.status}]:`, detailText.substring(0, 500));
      const detailData = JSON.parse(detailText);

      // energy list is array of daily values
      const energies = detailData.back?.data?.ppv ||
        detailData.back?.plantMonthChart?.ppvs ||
        detailData.back?.energyList ||
        detailData.obj?.pPVArr || [];

      if (Array.isArray(energies)) {
        energies.forEach((val, i) => {
          const day = String(i + 1).padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          const kwh = parseFloat(val) || 0;
          if (kwh > 0) {
            allToCreate.push({ date, timestamp: `${date}T12:00:00Z`, energy_kwh: kwh, source_file: 'growatt_api' });
          }
        });
      }
    }

    // 4. Evitar duplicatas
    const existing = await base44.asServiceRole.entities.EnergyRecord.filter({ source_file: 'growatt_api' });
    const existingDates = new Set(existing.map(r => r.date));
    const newRecords = allToCreate.filter(r => !existingDates.has(r.date));

    if (newRecords.length > 0) {
      await base44.asServiceRole.entities.EnergyRecord.bulkCreate(newRecords);
    }

    return Response.json({ success: true, count: newRecords.length, plantId });
  } catch (error) {
    console.error('Growatt sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});