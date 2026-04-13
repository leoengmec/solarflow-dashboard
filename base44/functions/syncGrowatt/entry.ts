import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import SparkMD5 from 'npm:spark-md5@3.0.2';

const BASE = 'https://server.growatt.com';

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

    // 1. Login via login.do (full web session)
    const loginRes = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': `${BASE}/login`,
      },
      body: new URLSearchParams({
        account: username,
        password: hashPassword(password),
        validateCode: '',
        isReadPact: '0',
        hasRememberMe: '1',
      }).toString(),
      redirect: 'manual',
    });

    // Properly parse multiple Set-Cookie headers
    const setCookieRaw = loginRes.headers.get('set-cookie') || '';
    const cookiePairs = setCookieRaw.split(/,(?=\s*[\w-]+=)/).map(c => c.split(';')[0].trim()).filter(Boolean);
    const cookieHeader = cookiePairs.join('; ');
    console.log('Cookie header:', cookieHeader.substring(0, 300));
    console.log('Login status:', loginRes.status, loginRes.headers.get('location'));

    if (loginRes.status !== 302 && loginRes.status !== 200) {
      return Response.json({ error: 'Login falhou', status: loginRes.status }, { status: 401 });
    }

    // 1b. Get user info via API after session login
    const meRes = await fetch(`${BASE}/newTwoPlantAPI.do?op=getAllPlantList&userId=0&type=0`, {
      headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' }
    });
    const meText = await meRes.text();
    console.log('Me/Plants:', meText.substring(0, 500));

    let userId = null;

    // 2. Parse plants from session response
    let plantId = null;
    try {
      const meData = JSON.parse(meText);
      const plants = meData.back?.data || meData.data || meData.obj?.datas || [];
      console.log('Parsed plants:', JSON.stringify(plants).substring(0, 300));
      if (Array.isArray(plants) && plants.length > 0) {
        plantId = plants[0].plantId || plants[0].id;
        userId = plants[0].userId;
      }
    } catch(e) {
      console.log('Parse error:', e.message);
    }

    // Fallback: use PlantListAPI.do
    if (!plantId) {
      const plantsRes = await fetch(`${BASE}/PlantListAPI.do`, {
        headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' },
      });
      const plantsData = await plantsRes.json();
      console.log('Plants fallback:', JSON.stringify(plantsData).substring(0, 400));
      const plantsArr = plantsData.back?.data || plantsData.back || [];
      if (!Array.isArray(plantsArr) || plantsArr.length === 0) {
        return Response.json({ error: 'Nenhuma planta encontrada', raw: plantsData }, { status: 404 });
      }
      plantId = plantsArr[0].plantId || plantsArr[0].id;
    }

    // 3. Histórico mensal via newTwoInverterAPI.do usando número de série
    const sn = Deno.env.get('GROWATT_SN')?.trim();
    const now = new Date();
    const allToCreate = [];

    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = `${year}-${month}`;

      // Use newTwoPlantDetailAPI for end-user monthly data
      const detailRes = await fetch(
        `${BASE}/newTwoPlantDetailAPI.do?plantId=${plantId}&type=1&date=${dateStr}`,
        { headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } }
      );
      const detailText = await detailRes.text();
      console.log(`Detail ${dateStr} [${detailRes.status}]:`, detailText.substring(0, 800));
      if (!detailText || detailText.trim().startsWith('<') || detailText.trim() === 'error') {
        console.log(`Skipping ${dateStr}: invalid response`);
        continue;
      }
      const detailData = JSON.parse(detailText);
      if (!detailData.back?.success) {
        console.log(`Skipping ${dateStr}: errCode`, detailData.back?.errCode);
        continue;
      }

      // Try all known energy array paths
      const energies =
        detailData.back?.data?.energy ||
        detailData.back?.data?.ppv ||
        detailData.back?.obj?.eMonth ||
        detailData.back?.energyList ||
        [];

      console.log(`Energies ${dateStr}:`, JSON.stringify(energies).substring(0, 300));

      if (Array.isArray(energies)) {
        energies.forEach((val, i) => {
          const day = String(i + 1).padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          const kwh = parseFloat(val) || 0;
          if (kwh > 0) {
            allToCreate.push({ date, timestamp: `${date}T12:00:00Z`, energy_kwh: kwh, source_file: 'growatt_api' });
          }
        });
      } else if (typeof energies === 'object') {
        // Sometimes it's a map of day -> value
        Object.entries(energies).forEach(([key, val]) => {
          const kwh = parseFloat(val) || 0;
          if (kwh > 0) {
            const day = String(parseInt(key)).padStart(2, '0');
            const date = `${year}-${month}-${day}`;
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