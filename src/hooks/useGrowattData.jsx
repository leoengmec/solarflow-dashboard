import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export const useGrowattSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => base44.functions.invoke('syncGrowatt', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['energyRecords'] });
      toast.success(`Sync OK: ${data.data?.count ?? 0} registros importados!`);
    },
    onError: (err) => toast.error(`Sync falhou: ${err.message}`),
  });
};