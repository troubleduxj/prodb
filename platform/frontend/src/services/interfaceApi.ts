/**
 * 接口管理 API 服务
 * 对接后端 /api/v1/collectors/{collector_id}/interfaces 接口
 */

import apiClient from './api';
import { showSuccess, showError } from './api';

// 接口协议类型
export type ProtocolType = 'modbus_tcp' | 'modbus_rtu' | 'opcua' | 'mqtt';

// 接口配置接口
export interface InterfaceConfig {
  id?: string;
  collector_id: string;
  name: string;
  protocol: ProtocolType;
  enabled: boolean;
  connection_config: ConnectionConfig;
  data_points: DataPointConfig[];
  edge_processing?: EdgeProcessingConfig;
  schedule_config?: ScheduleConfig;
  target_config?: TargetConfig;
}

// 连接配置
export interface ConnectionConfig {
  host?: string;
  port?: number;
  timeout_ms?: number;
  retry_count?: number;
  endpoint?: string;
  security_mode?: string;
  username?: string;
  password?: string;
  broker?: string;
  client_id?: string;
  keep_alive_interval?: number;
}

// 数据点配置
export interface DataPointConfig {
  name: string;
  address: string;
  data_type: string;
  scale?: number;
  offset?: number;
  unit?: string;
  sampling_interval_ms?: number;
  read_only?: boolean;
  description?: string;
}

// 边缘处理配置
export interface EdgeProcessingConfig {
  compression?: CompressionConfig;
  aggregation?: AggregationConfig;
  edge_alerts?: EdgeAlertConfig[];
}

// 压缩配置
export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'deadband' | 'swinging_door';
  threshold: number;
  min_interval?: number;
  max_interval?: number;
}

// 聚合配置
export interface AggregationConfig {
  enabled: boolean;
  window: number;
  function: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

// 边缘告警配置
export interface EdgeAlertConfig {
  name: string;
  point_name: string;
  condition: '>' | '<' | '=' | '!=' | '>=' | '<=';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

// 调度配置
export interface ScheduleConfig {
  mode: 'interval' | 'cron';
  interval_ms: number;
  cron_expr?: string;
  timezone?: string;
}

// 目标配置
export interface TargetConfig {
  database: string;
  super_table: string;
  tags: Record<string, string>;
  auto_create: boolean;
}

// 接口响应类型
export interface InterfaceListResponse {
  interfaces: InterfaceConfig[];
  total: number;
}

// 配置历史
export interface ConfigHistory {
  id: string;
  interface_id: string;
  version: number;
  action: 'create' | 'update' | 'delete' | 'rollback';
  created_by?: string;
  created_at: string;
}

// 配置历史项（API返回格式）
export interface ConfigHistoryItem {
  id: string;
  interface_id: string;
  version: number;
  action: 'create' | 'update' | 'delete' | 'rollback';
  created_by?: string;
  created_at: string;
}

// 下发状态
export interface DeliveryStatus {
  collector_id: string;
  latest_version: number;
  applied_version: number;
  is_synced: boolean;
  pending_count: number;
  failed_count: number;
}

// 接口状态
export interface InterfaceStatus {
  id: string;
  name: string;
  protocol: string;
  enabled: boolean;
  version: number;
  delivery_status: 'delivered' | 'pending' | 'failed' | 'applied';
  last_error?: string;
  last_sync_time?: string;
}

// 采集器配置状态
export interface CollectorConfigStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  latest_version: number;
  applied_version: number;
  is_synced: boolean;
  pending_count: number;
  failed_count: number;
  last_sync_time: string;
  interfaces: InterfaceStatus[];
}

// 配置历史项
export interface ConfigHistoryItem {
  id: string;
  interface_id: string;
  version: number;
  action: 'create' | 'update' | 'delete' | 'rollback';
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  error?: string;
  operator?: string;
}

/**
 * 获取采集器的所有接口
 */
export const getInterfaces = async (collectorId: string): Promise<InterfaceConfig[]> => {
  try {
    const response = await apiClient.get(`/collectors/${collectorId}/interfaces`);
    return response.data.interfaces || [];
  } catch (error) {
    console.error('Failed to fetch interfaces:', error);
    return [];
  }
};

/**
 * 获取单个接口详情
 */
export const getInterface = async (collectorId: string, interfaceId: string): Promise<InterfaceConfig | null> => {
  try {
    const response = await apiClient.get(`/collectors/${collectorId}/interfaces/${interfaceId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch interface:', error);
    return null;
  }
};

/**
 * 创建接口
 */
export const createInterface = async (collectorId: string, data: Omit<InterfaceConfig, 'id'>): Promise<InterfaceConfig | null> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces`, data);
    showSuccess('接口创建成功');
    return response.data;
  } catch (error: any) {
    showError(error.response?.data?.error || '接口创建失败');
    return null;
  }
};

/**
 * 更新接口
 */
export const updateInterface = async (collectorId: string, interfaceId: string, data: Partial<InterfaceConfig>): Promise<InterfaceConfig | null> => {
  try {
    const response = await apiClient.put(`/collectors/${collectorId}/interfaces/${interfaceId}`, data);
    showSuccess('接口更新成功');
    return response.data;
  } catch (error: any) {
    showError(error.response?.data?.error || '接口更新失败');
    return null;
  }
};

/**
 * 删除接口
 */
export const deleteInterface = async (collectorId: string, interfaceId: string): Promise<boolean> => {
  try {
    await apiClient.delete(`/collectors/${collectorId}/interfaces/${interfaceId}`);
    showSuccess('接口删除成功');
    return true;
  } catch (error: any) {
    showError(error.response?.data?.error || '接口删除失败');
    return false;
  }
};

/**
 * 获取配置历史
 */
export const getInterfaceHistory = async (collectorId: string, interfaceId: string): Promise<ConfigHistory[]> => {
  try {
    const response = await apiClient.get(`/collectors/${collectorId}/interfaces/${interfaceId}/history`);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return [];
  }
};

/**
 * 回滚接口配置
 */
export const rollbackInterface = async (collectorId: string, interfaceId: string, targetVersion: number): Promise<InterfaceConfig | null> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces/${interfaceId}/rollback`, {
      target_version: targetVersion,
    });
    showSuccess('配置回滚成功');
    return response.data;
  } catch (error: any) {
    showError(error.response?.data?.error || '配置回滚失败');
    return null;
  }
};

/**
 * 获取配置下发状态
 */
export const getConfigStatus = async (collectorId: string): Promise<DeliveryStatus | null> => {
  try {
    const response = await apiClient.get(`/collectors/${collectorId}/config/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch config status:', error);
    return null;
  }
};

/**
 * 获取所有采集器的配置状态
 */
export const getAllConfigStatus = async (): Promise<CollectorConfigStatus[]> => {
  try {
    const response = await apiClient.get('/collectors/config/status');
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch all config status:', error);
    return [];
  }
};

/**
 * 重新下发配置
 */
export const redeliverConfig = async (collectorId: string, interfaceId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces/${interfaceId}/redeliver`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || '重新下发失败' };
  }
};

/**
 * 获取配置历史
 */
export const getConfigHistory = async (collectorId: string, interfaceId: string): Promise<ConfigHistoryItem[]> => {
  try {
    const response = await apiClient.get(`/collectors/${collectorId}/interfaces/${interfaceId}/history`);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch config history:', error);
    return [];
  }
};

/**
 * 确认配置已应用
 */
export const confirmConfigApplied = async (collectorId: string, interfaceId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces/${interfaceId}/confirm`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || '确认失败' };
  }
};

/**
 * 回滚接口配置
 */
export const rollbackInterfaceConfig = async (collectorId: string, interfaceId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces/${interfaceId}/rollback`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || '回滚失败' };
  }
};

/**
 * 测试连接
 */
export const testConnection = async (collectorId: string, interfaceId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/collectors/${collectorId}/interfaces/${interfaceId}/test`);
    return { success: true, message: '连接测试成功' };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.error || '连接测试失败' };
  }
};
