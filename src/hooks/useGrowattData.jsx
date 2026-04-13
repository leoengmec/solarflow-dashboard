import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export const useGrowattSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => base44.functions.syncGrowatt.invoke({}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['energyRecords'] });
      toast.success(`Sync OK: ${data.count} registros!`);
    },
    onError: (err) => toast.error(`Sync falhou: ${err.message}`),
  });
};