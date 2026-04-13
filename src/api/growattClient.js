import axios from 'axios';
import { z } from 'zod';

const HistoryDataSchema = z.array(z.object({
  date: z.string(),
  energy_kwh: z.number(),
  power_kw: z.number().optional(),
}));

export const growattClient = axios.create({
  baseURL: import.meta.env.VITE_GROWATT_BASE_URL || 'https://server.growatt.com/v1',
  timeout: 15000,
  headers: { 'Authorization': `Bearer ${import.meta.env.VITE_GROWATT_TOKEN}` },
});

export const getPlants = async () => {
  const { data } = await growattClient.post('/plant/getplantlistbypage', { page: 1, pageSize: 50 });
  return data.data || [];
};

export const fetchGrowattData = async (sn, plantId, start, end) => {
  const { data } = await growattClient.post('/device/gethistorydata', {
    sn, plantId, startDate: start, endDate: end, dataType: 'daily'
  });
  return HistoryDataSchema.parse(data.data || []);
};
