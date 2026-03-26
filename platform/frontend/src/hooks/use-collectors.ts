import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { showSuccess } from '../services/api';
import { toast } from './use-toast';

const COLLECTORS_KEY = 'collectors';

const showErrorToast = (message: string) => {
  toast({
    variant: 'destructive',
    title: '错误',
    description: message,
  });
};

export const useCollectors = () => {
  return useQuery({
    queryKey: [COLLECTORS_KEY],
    queryFn: async () => {
      const result = await api.collectors.list();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 30000, // 30 seconds
  });
};

export const useCollector = (id: string) => {
  return useQuery({
    queryKey: [COLLECTORS_KEY, id],
    queryFn: async () => {
      const result = await api.collectors.get(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!id,
    staleTime: 60000, // 1 minute
  });
};

export const useCreateCollector = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const result = await api.collectors.create(data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTORS_KEY] });
      showSuccess('采集器创建成功');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || '创建失败');
    },
  });
};

export const useUpdateCollector = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const result = await api.collectors.update(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [COLLECTORS_KEY] });
      queryClient.invalidateQueries({ queryKey: [COLLECTORS_KEY, variables.id] });
      showSuccess('采集器更新成功');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || '更新失败');
    },
  });
};

export const useDeleteCollector = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.collectors.delete(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTORS_KEY] });
      showSuccess('采集器删除成功');
    },
    onError: (error: Error) => {
      showErrorToast(error.message || '删除失败');
    },
  });
};
