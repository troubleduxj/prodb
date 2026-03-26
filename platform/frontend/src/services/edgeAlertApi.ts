/**
 * 边缘告警 API 服务
 * 对接后端 /api/v1/alerts 和 /api/v1/collectors/{id}/edge-alerts 接口
 */

import { apiClient } from './api';

// 边缘告警配置
export interface EdgeAlertConfig {
  id?: string;
  collector_id: string;
  interface_id?: string;
  name: string;
  description?: string;
  point_name: string;
  condition: '>' | '<' | '=' | '!=' | '>=' | '<=';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  duration?: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// 边缘告警
export interface EdgeAlert {
  id: string;
  config_id: string;
  collector_id: string;
  interface_id?: string;
  collector_name?: string;
  interface_name?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'acknowledged' | 'cleared';
  raw_data?: any;
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  cleared_at?: string;
}

// 告警统计
export interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  pending: number;
  acknowledged: number;
  cleared: number;
  today: number;
  thisWeek: number;
}

// 获取告警规则列表
export const getEdgeAlertConfigs = async (collectorId?: string): Promise<EdgeAlertConfig[]> => {
  try {
    const url = collectorId 
      ? `/collectors/${collectorId}/edge-alerts/configs`
      : '/edge-alerts/configs';
    const response = await apiClient.get(url);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch edge alert configs:', error);
    return [];
  }
};

// 获取单个告警规则
export const getEdgeAlertConfig = async (id: string): Promise<EdgeAlertConfig | null> => {
  try {
    const response = await apiClient.get(`/edge-alerts/configs/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch edge alert config:', error);
    return null;
  }
};

// 创建告警规则
export const createEdgeAlertConfig = async (data: Omit<EdgeAlertConfig, 'id'>): Promise<EdgeAlertConfig | null> => {
  try {
    const response = await apiClient.post('/edge-alerts/configs', data);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create edge alert config:', error);
    throw new Error(error.response?.data?.error || '创建告警规则失败');
  }
};

// 更新告警规则
export const updateEdgeAlertConfig = async (id: string, data: Partial<EdgeAlertConfig>): Promise<EdgeAlertConfig | null> => {
  try {
    const response = await apiClient.put(`/edge-alerts/configs/${id}`, data);
    return response.data;
  } catch (error: any) {
    console.error('Failed to update edge alert config:', error);
    throw new Error(error.response?.data?.error || '更新告警规则失败');
  }
};

// 删除告警规则
export const deleteEdgeAlertConfig = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/edge-alerts/configs/${id}`);
  } catch (error: any) {
    console.error('Failed to delete edge alert config:', error);
    throw new Error(error.response?.data?.error || '删除告警规则失败');
  }
};

// 启用告警规则
export const enableEdgeAlertConfig = async (id: string): Promise<void> => {
  try {
    await apiClient.post(`/edge-alerts/configs/${id}/enable`);
  } catch (error: any) {
    console.error('Failed to enable edge alert config:', error);
    throw new Error(error.response?.data?.error || '启用告警规则失败');
  }
};

// 禁用告警规则
export const disableEdgeAlertConfig = async (id: string): Promise<void> => {
  try {
    await apiClient.post(`/edge-alerts/configs/${id}/disable`);
  } catch (error: any) {
    console.error('Failed to disable edge alert config:', error);
    throw new Error(error.response?.data?.error || '禁用告警规则失败');
  }
};

// 获取告警列表
export const getEdgeAlerts = async (params?: {
  collectorId?: string;
  severity?: string;
  status?: string;
  timeRange?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<EdgeAlert[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.collectorId) queryParams.append('collector_id', params.collectorId);
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.timeRange) queryParams.append('time_range', params.timeRange);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `/edge-alerts?${queryParams.toString()}`;
    const response = await apiClient.get(url);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch edge alerts:', error);
    return [];
  }
};

// 获取单个告警
export const getEdgeAlert = async (id: string): Promise<EdgeAlert | null> => {
  try {
    const response = await apiClient.get(`/edge-alerts/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch edge alert:', error);
    return null;
  }
};

// 确认告警
export const ackEdgeAlert = async (id: string): Promise<void> => {
  try {
    await apiClient.post(`/edge-alerts/${id}/ack`);
  } catch (error: any) {
    console.error('Failed to ack edge alert:', error);
    throw new Error(error.response?.data?.error || '确认告警失败');
  }
};

// 批量确认告警
export const batchAckEdgeAlerts = async (ids: string[]): Promise<void> => {
  try {
    await apiClient.post('/edge-alerts/batch-ack', { ids });
  } catch (error: any) {
    console.error('Failed to batch ack edge alerts:', error);
    throw new Error(error.response?.data?.error || '批量确认告警失败');
  }
};

// 清除告警
export const clearEdgeAlert = async (id: string): Promise<void> => {
  try {
    await apiClient.post(`/edge-alerts/${id}/clear`);
  } catch (error: any) {
    console.error('Failed to clear edge alert:', error);
    throw new Error(error.response?.data?.error || '清除告警失败');
  }
};

// 清除所有已确认的告警
export const clearEdgeAlerts = async (): Promise<void> => {
  try {
    await apiClient.post('/edge-alerts/clear-all');
  } catch (error: any) {
    console.error('Failed to clear edge alerts:', error);
    throw new Error(error.response?.data?.error || '清除告警失败');
  }
};

// 获取告警统计
export const getAlertStats = async (collectorId?: string): Promise<AlertStats> => {
  try {
    const url = collectorId 
      ? `/collectors/${collectorId}/alerts/stats`
      : '/alerts/stats';
    const response = await apiClient.get(url);
    return response.data || {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      pending: 0,
      acknowledged: 0,
      cleared: 0,
      today: 0,
      thisWeek: 0,
    };
  } catch (error) {
    console.error('Failed to fetch alert stats:', error);
    return {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      pending: 0,
      acknowledged: 0,
      cleared: 0,
      today: 0,
      thisWeek: 0,
    };
  }
};

// 导出告警
export const exportEdgeAlerts = async (params?: {
  severity?: string;
  status?: string;
  timeRange?: string;
  format?: 'json' | 'csv';
}): Promise<Blob> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.timeRange) queryParams.append('time_range', params.timeRange);
    if (params?.format) queryParams.append('format', params.format);

    const url = `/edge-alerts/export?${queryParams.toString()}`;
    const response = await apiClient.get(url, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error: any) {
    console.error('Failed to export edge alerts:', error);
    throw new Error(error.response?.data?.error || '导出告警失败');
  }
};

// 获取告警趋势
export const getAlertTrends = async (params?: {
  timeRange?: string;
  groupBy?: 'hour' | 'day' | 'week';
}): Promise<{ timestamp: string; count: number; severity: string }[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('time_range', params.timeRange);
    if (params?.groupBy) queryParams.append('group_by', params.groupBy);

    const url = `/alerts/trends?${queryParams.toString()}`;
    const response = await apiClient.get(url);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch alert trends:', error);
    return [];
  }
};

// 获取采集器告警统计
export const getCollectorAlertStats = async (): Promise<{ collector_id: string; collector_name: string; count: number }[]> => {
  try {
    const response = await apiClient.get('/alerts/collector-stats');
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch collector alert stats:', error);
    return [];
  }
};