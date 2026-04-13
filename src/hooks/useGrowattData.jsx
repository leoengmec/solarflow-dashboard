import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchGrowattData, getPlants } from '@/api/growattClient';
import { toast } from 'sonner';

export const useGrowattData = (period) => {
  const queryClient = useQueryClient();
  const sn = import.meta.env.VITE_GROWATT_DEVICE_SN || 'PHE3A3301H'; // Da imagem

  const { data: plants = [] } = useQuery({
    queryKey: ['growattPlants'],
    queryFn: getPlants,
  });

  const plantId = plants.find(p => p.plantName?.includes('Elias Alves'))?.plantId;

  const { data: records, isLoading, error } = useQuery({
    queryKey: ['growattData', period, plantId],
    queryFn: () => fetchGrowattData(sn, plantId, period.start, period.end),
    enabled: !!plantId && !!period.start,
    staleTime: 30 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: async (data) => {
      for (const rec of data) {
        await base44.entities.EnergyRecord.upsert({
          date: rec.date.split(' ')[0],
          energy_kwh: rec.energy_kwh,
          power_kw: rec.power_kw || 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['energyRecords'] });
      toast.success('Sync Growatt OK!');
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return { records, isLoading, error, sync: syncMutation.mutate };
};
