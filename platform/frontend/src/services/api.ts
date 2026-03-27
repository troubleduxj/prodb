/**
 * API 服务层 - 对接现有后端
 * 复用 platform/backend 的 RESTful API
 * 版本: 2.0 - 完善错误处理和降级逻辑
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { toast } from '../hooks/use-toast';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9080/api/v1';

// 创建 axios 实例
// 创建 axios 实例
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ==================== 错误处理工具 ====================

/**
 * 错误消息映射
 */
const ERROR_MESSAGES: Record<number | string, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '权限不足，无法访问该资源',
  404: '请求的资源不存在',
  409: '资源冲突，可能已存在',
  422: '请求数据验证失败',
  500: '服务器内部错误，请稍后重试',
  502: '网关错误，服务暂时不可用',
  503: '服务维护中，请稍后重试',
  504: '网关超时，请检查网络连接',
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  TIMEOUT: '请求超时，请稍后重试',
  UNKNOWN: '未知错误，请稍后重试',
};

/**
 * 获取错误消息
 */
const getErrorMessage = (error: AxiosError): string => {
  if (error.code === 'ECONNABORTED') {
    return ERROR_MESSAGES.TIMEOUT;
  }
  if (error.code === 'ERR_NETWORK') {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as any;
    // 优先使用后端返回的错误消息
    if (data?.message || data?.error) {
      return data.message || data.error;
    }
    return ERROR_MESSAGES[status] || ERROR_MESSAGES.UNKNOWN;
  }
  return ERROR_MESSAGES.UNKNOWN;
};

/**
 * 显示错误提示
 */
export const showError = (message: string) => {
  toast({
    variant: 'destructive',
    title: '错误',
    description: message,
  });
};

/**
 * 显示成功提示
 */
export const showSuccess = (message: string) => {
  toast({
    variant: 'success',
    title: '成功',
    description: message,
  });
};

/**
 * 显示警告提示
 */
export const showWarning = (message: string) => {
  toast({
    variant: 'warning',
    title: '警告',
    description: message,
  });
};

/**
 * 显示信息提示
 */
export const showInfo = (message: string) => {
  toast({
    title: '提示',
    description: message,
  });
};

// ==================== 请求拦截器 ====================

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 添加请求时间戳，用于调试
    config.headers['X-Request-Time'] = new Date().toISOString();
    return config;
  },
  (error) => {
    console.error('[Request Error]', error);
    return Promise.reject(error);
  }
);

// ==================== 响应拦截器 ====================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 记录响应时间
    const requestTime = response.config.headers['X-Request-Time'];
    if (requestTime) {
      const duration = Date.now() - new Date(requestTime).getTime();
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }
    return response;
  },
  (error: AxiosError) => {
    const message = getErrorMessage(error);
    
    // 处理特定状态码
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
          // Token 过期，清除认证状态并跳转
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          showError(message);
          // 延迟跳转，让用户看到错误提示
          setTimeout(() => {
            window.location.href = '/login?expired=true';
          }, 1500);
          break;
          
        case 403:
          showError(message);
          // 可以记录到权限错误日志
          console.warn('[Permission Denied]', error.config?.url);
          break;
          
        case 500:
        case 502:
        case 503:
        case 504:
          showError(message);
          // 服务端错误，可以发送监控
          console.error('[Server Error]', {
            url: error.config?.url,
            status: status,
            message: message,
            time: new Date().toISOString(),
          });
          break;
          
        default:
          showError(message);
      }
    } else {
      // 网络错误
      showError(message);
    }
    
    return Promise.reject(error);
  }
);

// ==================== 类型定义 ====================

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Collector {
  id: string;
  name: string;
  collectorId: string;
  status: 'active' | 'inactive' | 'offline' | 'pending';
  protocol: string;
  version: string;
  lastHeartbeat: string;
  tags?: Record<string, string>;
  config?: any;
}

export interface TDengineDatabase {
  name: string;
  tables: number;
  vgroups: number;
  replica: number;
  createdAt: string;
}

export interface SuperTable {
  name: string;
  database: string;
  columns: Column[];
  tags: Tag[];
  createdAt: string;
}

export interface Column {
  name: string;
  type: string;
  length?: number;
}

export interface Tag {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: string[];
  data: any[][];
  rows: number;
  duration: number;
}

export interface SQLGenerationResult {
  sql: string;
  explanation?: string;
  fallback?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  createdAt: string;
}

// ==================== API 服务 ====================

export const api = {
  // ========== 认证管理 ==========
  auth: {
    /**
     * 用户登录
     */
    login: async (credentials: { username: string; password: string }) => {
      try {
        const response = await apiClient.post('/auth/login', credentials);
        const { token, user, refreshToken } = response.data;
        
        // 存储认证信息
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        
        return { success: true, data: { token, user } };
      } catch (error) {
        return { 
          success: false, 
          error: getErrorMessage(error as AxiosError) 
        };
      }
    },

    /**
     * 刷新 Token
     */
    refresh: async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        return { success: false, error: 'No refresh token' };
      }
      
      try {
        const response = await apiClient.post('/auth/refresh', { refreshToken });
        const { token } = response.data;
        localStorage.setItem('token', token);
        return { success: true, data: { token } };
      } catch (error) {
        return { 
          success: false, 
          error: getErrorMessage(error as AxiosError) 
        };
      }
    },

    /**
     * 获取当前用户信息
     */
    me: async () => {
      try {
        const response = await apiClient.get('/users/me');
        return { success: true, data: response.data };
      } catch (error) {
        return { 
          success: false, 
          error: getErrorMessage(error as AxiosError) 
        };
      }
    },

    /**
     * 登出
     */
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    },

    /**
     * 检查是否已登录
     */
    isAuthenticated: () => {
      return !!localStorage.getItem('token');
    },

    /**
     * 获取存储的用户信息
     */
    getUser: () => {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    },
  },

  // ========== 用户管理 ==========
  users: {
    list: async () => {
      try {
        const response = await apiClient.get('/users');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    create: async (data: Partial<User>) => {
      try {
        const response = await apiClient.post('/users', data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    update: async (id: string, data: Partial<User>) => {
      try {
        const response = await apiClient.put(`/users/${id}`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    delete: async (id: string) => {
      try {
        await apiClient.delete(`/users/${id}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 采集器管理 ==========
  collectors: {
    list: async () => {
      try {
        const response = await apiClient.get('/collectors/list');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    get: async (id: string) => {
      try {
        const response = await apiClient.get(`/collectors/${id}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    create: async (data: Partial<Collector>) => {
      try {
        const response = await apiClient.post('/collectors', data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    update: async (id: string, data: Partial<Collector>) => {
      try {
        const response = await apiClient.put(`/collectors/${id}`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    delete: async (id: string) => {
      try {
        await apiClient.delete(`/collectors/${id}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getConfig: async (id: string) => {
      try {
        const response = await apiClient.get(`/collectors/${id}/config/active`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    updateStatus: async (id: string, status: string) => {
      try {
        const response = await apiClient.put(`/collectors/${id}/status`, { status });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    heartbeat: async (id: string, data: any) => {
      try {
        const response = await apiClient.post(`/collectors/${id}/heartbeat`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== TDengine 管理 ==========
  tdengine: {
    listDatabases: async () => {
      try {
        const response = await apiClient.get('/tdengine/databases');
        console.log('[API] listDatabases response:', response.data);
        return { success: true, data: response.data };
      } catch (error) {
        console.error('[API] listDatabases error:', error);
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    createDatabase: async (name: string, options?: any) => {
      try {
        const response = await apiClient.post('/tdengine/databases', { name, ...options });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    dropDatabase: async (name: string) => {
      try {
        await apiClient.delete(`/tdengine/databases/${name}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getDatabase: async (name: string) => {
      try {
        const response = await apiClient.get(`/tdengine/databases/${encodeURIComponent(name)}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    listSuperTables: async (database: string) => {
      try {
        // Try the database connection API first (more reliable)
        // Backend route: /database/supertables?database=xxx
        const response = await apiClient.get(`/database/supertables?database=${encodeURIComponent(database)}`, {
          timeout: 60000, // 60 seconds timeout for TDengine operations
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getSuperTable: async (database: string, name: string) => {
      try {
        const response = await apiClient.get(`/database/supertables/${name}?database=${encodeURIComponent(database)}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getSuperTableSchema: async (database: string, name: string) => {
      try {
        // Backend route: /tdengine/db/:database/supertables/:supertable/schema
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/supertables/${name}/schema`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    listSubTables: async (database: string, supertable: string) => {
      try {
        // Backend route: /tdengine/db/:database/supertables/:supertable/subtables
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/supertables/${encodeURIComponent(supertable)}/subtables`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    listTables: async (database: string, supertable?: string) => {
      try {
        const params = supertable ? `?database=${encodeURIComponent(database)}&supertable=${encodeURIComponent(supertable)}` : `?database=${encodeURIComponent(database)}`;
        const response = await apiClient.get(`/database/tables${params}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    createSuperTable: async (database: string, data: any) => {
      try {
        const response = await apiClient.post(`/tdengine/db/${database}/supertables`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getSubTableInfo: async (database: string, subTableName: string) => {
      try {
        // Backend route: /tdengine/db/:database/subtables/:subtable
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/subtables/${encodeURIComponent(subTableName)}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    dropSuperTable: async (database: string, name: string) => {
      try {
        await apiClient.delete(`/tdengine/db/${database}/supertables/${name}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    query: async (sql: string) => {
      try {
        const response = await apiClient.post('/tdengine/query', { sql });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    health: async () => {
      try {
        const response = await apiClient.get('/tdengine/health');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    alterSuperTable: async (database: string, supertable: string, data: { action: string; tag?: { name: string; type: string; length?: number }; column?: { name: string; type: string; length?: number } }) => {
      try {
        const response = await apiClient.put(`/tdengine/db/${encodeURIComponent(database)}/supertables/${encodeURIComponent(supertable)}`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    updateSubTableTag: async (database: string, subTableName: string, tagName: string, value: any) => {
      try {
        // Backend route: PUT /tdengine/db/:database/subtables/:subtable/tags/:tag
        const response = await apiClient.put(
          `/tdengine/db/${encodeURIComponent(database)}/subtables/${encodeURIComponent(subTableName)}/tags/${encodeURIComponent(tagName)}`,
          { value }
        );
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Database Config
    getDatabaseConfig: async (database: string) => {
      try {
        const response = await apiClient.get(`/tdengine/databases/${encodeURIComponent(database)}/config`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    updateDatabaseConfig: async (database: string, config: any) => {
      try {
        const response = await apiClient.put(`/tdengine/databases/${encodeURIComponent(database)}/config`, config);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Super Table Preview
    getSuperTablePreview: async (database: string, supertable: string, limit: number = 100) => {
      try {
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/supertables/${encodeURIComponent(supertable)}/preview?limit=${limit}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Sub Table Preview
    getSubTablePreview: async (database: string, subtable: string, limit: number = 100) => {
      try {
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/subtables/${encodeURIComponent(subtable)}/preview?limit=${limit}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Bulk Update Tags
    bulkUpdateSubTableTags: async (database: string, subtable: string, tags: Record<string, any>) => {
      try {
        const response = await apiClient.put(`/tdengine/db/${encodeURIComponent(database)}/subtables/${encodeURIComponent(subtable)}/tags`, { tags });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Alter Super Table Schema
    alterSuperTableSchema: async (database: string, supertable: string, data: { action: string; column?: { name: string; type: string; length?: number }; tag?: { name: string; type: string; length?: number } }) => {
      try {
        const response = await apiClient.post(`/tdengine/db/${encodeURIComponent(database)}/supertables/${encodeURIComponent(supertable)}/schema`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    // OperationsData API - Data Quality Analysis
    analyzeDataQuality: async (database: string, table: string) => {
      try {
        const response = await apiClient.get(`/tdengine/db/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/quality`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 告警规则 ==========
  alerts: {
    listRules: async () => {
      try {
        const response = await apiClient.get('/alert-rules');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    createRule: async (data: Partial<AlertRule>) => {
      try {
        const response = await apiClient.post('/alert-rules', data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    updateRule: async (id: string, data: Partial<AlertRule>) => {
      try {
        const response = await apiClient.put(`/alert-rules/${id}`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    deleteRule: async (id: string) => {
      try {
        await apiClient.delete(`/alert-rules/${id}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    enableRule: async (id: string) => {
      try {
        await apiClient.post(`/alert-rules/${id}/enable`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    disableRule: async (id: string) => {
      try {
        await apiClient.post(`/alert-rules/${id}/disable`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    listActive: async () => {
      try {
        const response = await apiClient.get('/alerts/active');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 新增：AI 功能（带降级处理）==========
  ai: {
    /**
     * 自然语言转 SQL
     * 降级方案：使用本地 SQL 模板库
     */
    generateSQL: async (prompt: string, schema?: string): Promise<SQLGenerationResult> => {
      try {
        const response = await apiClient.post('/ai/generate-sql', { prompt, schema });
        return {
          sql: response.data.sql,
          explanation: response.data.explanation,
          fallback: false,
        };
      } catch (error) {
        console.warn('[AI Service] Fallback to local templates', error);
        
        // 降级处理 - 本地 SQL 模板库
        return getLocalSQLTemplate(prompt, schema);
      }
    },

    /**
     * 分析集群健康状态
     */
    analyzeCluster: async (nodeData: any): Promise<string> => {
      try {
        const response = await apiClient.post('/ai/analyze-cluster', nodeData);
        return response.data.analysis;
      } catch (error) {
        console.warn('[AI Service] Cluster analysis unavailable');
        return generateLocalClusterAnalysis(nodeData);
      }
    },

    /**
     * 查询优化建议
     */
    explainQuery: async (sql: string, plan?: any): Promise<string> => {
      try {
        const response = await apiClient.post('/ai/explain-query', { sql, plan });
        return response.data.suggestion;
      } catch (error) {
        console.warn('[AI Service] Query explanation unavailable');
        return generateLocalQueryAdvice(sql);
      }
    },
  },

  // ========== 新增：流计算（带 Mock 数据）==========
  streaming: {
    listJobs: async () => {
      try {
        const response = await apiClient.get('/streaming/jobs');
        return { success: true, data: response.data };
      } catch (error) {
        // 后端未实现时返回 Mock 数据
        console.warn('[Streaming] Using mock data');
        return { success: true, data: getMockStreamingJobs() };
      }
    },

    createJob: async (config: any) => {
      try {
        const response = await apiClient.post('/streaming/jobs', config);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getJob: async (id: string) => {
      try {
        const response = await apiClient.get(`/streaming/jobs/${id}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    startJob: async (id: string) => {
      try {
        await apiClient.post(`/streaming/jobs/${id}/start`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    stopJob: async (id: string) => {
      try {
        await apiClient.post(`/streaming/jobs/${id}/stop`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    deleteJob: async (id: string) => {
      try {
        await apiClient.delete(`/streaming/jobs/${id}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 新增：多租户（带 Mock 数据）==========
  tenants: {
    list: async () => {
      try {
        const response = await apiClient.get('/tenants');
        return { success: true, data: response.data };
      } catch (error) {
        console.warn('[Tenants] Using mock data');
        return { success: true, data: getMockTenants() };
      }
    },

    create: async (data: any) => {
      try {
        const response = await apiClient.post('/tenants', data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    update: async (id: string, data: any) => {
      try {
        const response = await apiClient.put(`/tenants/${id}`, data);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    delete: async (id: string) => {
      try {
        await apiClient.delete(`/tenants/${id}`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 系统健康 ==========
  system: {
    ping: async () => {
      try {
        const response = await apiClient.get('/ping');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getPerformanceStats: async () => {
      try {
        const response = await apiClient.get('/performance/monitoring/stats');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    getHealthSummary: async () => {
      try {
        const response = await apiClient.get('/health/summary');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 数据库连接管理 ==========
  connections: {
    /**
     * 获取所有数据库连接
     */
    list: async () => {
      try {
        const response = await apiClient.get('/database/connections');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取单个连接详情
     */
    get: async (id: string) => {
      try {
        const response = await apiClient.get(`/database/connections/${id}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 创建新连接
     */
    create: async (data: any) => {
      try {
        const response = await apiClient.post('/database/connections', data);
        showSuccess('连接创建成功');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 更新连接
     */
    update: async (id: string, data: any) => {
      try {
        const response = await apiClient.put(`/database/connections/${id}`, data);
        showSuccess('连接更新成功');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 删除连接
     */
    delete: async (id: string) => {
      try {
        await apiClient.delete(`/database/connections/${id}`);
        showSuccess('连接删除成功');
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 测试连接（新配置）
     */
    test: async (data: any) => {
      try {
        // 连接测试可能需要较长时间，设置 15 秒超时
        const response = await apiClient.post('/database/connections/test', data, {
          timeout: 15000,
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 测试已有连接
     */
    testById: async (id: string) => {
      try {
        // 连接测试可能需要较长时间，设置 15 秒超时
        const response = await apiClient.post(`/database/connections/${id}/test`, {}, {
          timeout: 15000,
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取连接状态
     */
    getStatus: async (id: string) => {
      try {
        const response = await apiClient.get(`/database/connections/${id}/status`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取所有连接状态
     */
    getAllStatuses: async () => {
      try {
        const response = await apiClient.get('/database/connections/status');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 批量测试连接
     */
    batchTest: async (ids: string[]) => {
      try {
        const response = await apiClient.post('/database/connections/batch-test', { ids });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 批量删除连接
     */
    batchDelete: async (ids: string[]) => {
      try {
        await apiClient.delete('/database/connections/batch', { data: { ids } });
        showSuccess(`成功删除 ${ids.length} 个连接`);
        return { success: true };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },

  // ========== 数据摄取 ==========
  data: {
    /**
     * 接收单个数据点
     */
    receive: async (dataPoint: any) => {
      try {
        const response = await apiClient.post('/data/receive', dataPoint);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 接收批量数据
     */
    receiveBatch: async (batch: any) => {
      try {
        const response = await apiClient.post('/data/batch', batch);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取接收的数据
     */
    getReceived: async () => {
      try {
        const response = await apiClient.get('/data/received');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取实时数据
     */
    getRealtime: async (collectorId: string) => {
      try {
        const response = await apiClient.get(`/data/realtime/${collectorId}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },

    /**
     * 获取数据统计
     */
    getStatistics: async () => {
      try {
        const response = await apiClient.get('/data/statistics');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: getErrorMessage(error as AxiosError) };
      }
    },
  },
};

// ==================== 降级处理工具函数 ====================

/**
 * 本地 SQL 模板库
 */
const getLocalSQLTemplate = (prompt: string, schema?: string): SQLGenerationResult => {
  const templates: Record<string, string> = {
    '最近一小时': 'SELECT * FROM meters WHERE ts > NOW - 1h LIMIT 100;',
    '最近一天': 'SELECT * FROM meters WHERE ts > NOW - 1d LIMIT 1000;',
    '平均值': 'SELECT AVG(value) FROM meters WHERE ts > NOW - 1h;',
    '最大值': 'SELECT MAX(value) FROM meters WHERE ts > NOW - 1h;',
    '最小值': 'SELECT MIN(value) FROM meters WHERE ts > NOW - 1h;',
    '计数': 'SELECT COUNT(*) FROM meters WHERE ts > NOW - 1h;',
  };

  // 关键词匹配
  for (const [key, sql] of Object.entries(templates)) {
    if (prompt.includes(key)) {
      return {
        sql: `-- AI 服务暂时不可用，使用本地模板\n-- 查询意图: ${prompt}\n${sql}`,
        fallback: true,
      };
    }
  }

  // 默认模板
  return {
    sql: `-- AI 服务暂时不可用\n-- 您的查询: ${prompt}\n-- 请手动编写 SQL\nSELECT * FROM meters LIMIT 10;`,
    fallback: true,
  };
};

/**
 * 本地集群分析
 */
const generateLocalClusterAnalysis = (nodeData: any): string => {
  // 简单的本地分析逻辑
  return '集群健康状态分析服务暂时不可用。请查看监控面板获取节点状态信息。';
};

/**
 * 本地查询建议
 */
const generateLocalQueryAdvice = (sql: string): string => {
  const advice: string[] = [];
  
  if (sql.includes('SELECT *')) {
    advice.push('建议: 避免使用 SELECT *，只查询需要的字段');
  }
  if (!sql.toLowerCase().includes('where')) {
    advice.push('建议: 添加 WHERE 条件限制查询范围');
  }
  if (!sql.toLowerCase().includes('limit')) {
    advice.push('建议: 添加 LIMIT 限制返回结果数量');
  }
  
  return advice.length > 0 
    ? advice.join('\n') 
    : '查询优化建议服务暂时不可用。';
};

/**
 * Mock 流计算作业数据
 */
const getMockStreamingJobs = () => {
  return [
    {
      id: 'mock-1',
      name: '温度数据实时聚合',
      status: 'running',
      sql: 'SELECT device_id, AVG(temperature) FROM sensors GROUP BY device_id',
      parallelism: 2,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mock-2',
      name: '异常检测作业',
      status: 'stopped',
      sql: 'SELECT * FROM sensors WHERE value > 100',
      parallelism: 1,
      createdAt: new Date().toISOString(),
    },
  ];
};

/**
 * Mock 租户数据
 */
const getMockTenants = () => {
  return [
    {
      id: 'mock-tenant-1',
      name: '生产环境',
      quota: {
        storage: '500GB',
        connections: 100,
        tables: 10000,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mock-tenant-2',
      name: '测试环境',
      quota: {
        storage: '100GB',
        connections: 50,
        tables: 5000,
      },
      createdAt: new Date().toISOString(),
    },
  ];
};

// 默认导出
export default api;

// 辅助函数导出
export { getErrorMessage, ERROR_MESSAGES };