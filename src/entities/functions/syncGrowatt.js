const axios = require('axios');

module.exports = async function syncGrowatt(params) {
  const token = process.env.GROWATT_TOKEN || '11675vn9nf8q8m5uy57i3iuk53g1usyd';
  const sn = process.env.GROWATT_SN || 'PHE3A3301H';
  
  try {
    const plantsRes = await axios.post('https://server.growatt.com/v1/plant/getplantlistbypage', {
      page: 1, pageSize: 50
    }, { headers: { Authorization: `Bearer ${token}` } });
    const plants = plantsRes.data.data || [];
    const plantId = plants.find(p => p.plantName?.includes('Elias Alves'))?.plantId || plants[0]?.plantId;
    
    if (!plantId) throw new Error('Sem plantId - verifique token/planta "Elias Alves"');
    
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const historyRes = await axios.post('https://server.growatt.com/v1/device/gethistorydata', {
      sn, plantId, startDate: start, endDate: end, dataType: 'daily'
    }, { headers: { Authorization: `Bearer ${token}` } });
    
    const records = historyRes.data.data || [];
    
    if (records.length === 0) return { success: true, count: 0, message: 'Sem novos dados' };
    
    for (const rec of records) {
      await this.entities.EnergyRecord.upsert({
        date: rec.date.split(' ')[0],
        energy_kwh: rec.energy_kwh || 0,
        power_kw: rec.power_kw || 0
      });
    }
    
    return { success: true, count: records.length, plantId, sample: records[0] };
  } catch (error) {
    console.error('Growatt sync error:', error.response?.data || error.message);
    throw new Error(`Sync falhou: ${error.message}`);
  }
};
