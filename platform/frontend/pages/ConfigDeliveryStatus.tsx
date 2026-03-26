import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { useToast } from '../src/hooks/use-toast';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Wifi,
  WifiOff,
  ChevronRight,
  RotateCcw,
  Eye,
  Filter,
  Download,
  History,
  FileText,
  Zap,
  Layers,
  MoreHorizontal,
} from 'lucide-react';
import {
  getAllConfigStatus,
  redeliverConfig,
  getConfigHistory,
  getInterface,
  confirmConfigApplied,
  rollbackInterfaceConfig,
  CollectorConfigStatus,
  InterfaceStatus,
  ConfigHistoryItem,
} from '../src/services/interfaceApi';
import { showSuccess } from '../src/services/api';

// 本地类型定义（扩展自 interfaceApi）
interface CollectorConfigStatusLocal {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  latestVersion: number;
  appliedVersion: number;
  isSynced: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: string;
  interfaces: InterfaceStatusLocal[];
}

interface InterfaceStatusLocal {
  id: string;
  name: string;
  protocol: string;
  enabled: boolean;
  version: number;
  deliveryStatus: 'delivered' | 'pending' | 'failed' | 'applied';
  lastError?: string;
  lastSyncTime?: string;
}

interface ConfigHistoryItemLocal {
  id: string;
  collectorId: string;
  interfaceId: string;
  interfaceName: string;
  version: number;
  action: 'create' | 'update' | 'delete' | 'rollback';
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  error?: string;
  operator?: string;
}

// 过滤器类型
type StatusFilter = 'all' | 'online' | 'offline' | 'error' | 'pending' | 'failed';
type SyncFilter = 'all' | 'synced' | 'unsynced';

export const ConfigDeliveryStatus: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const isDark = resolvedTheme === 'dark';

  const [collectors, setCollectors] = useState<CollectorConfigStatusLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
  const [selectedInterface, setSelectedInterface] = useState<InterfaceStatusLocal | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SyncFilter>('all');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configHistory, setConfigHistory] = useState<ConfigHistoryItemLocal[]>([]);
  const [interfaceConfig, setInterfaceConfig] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [redelivering, setRedelivering] = useState<Set<string>>(new Set());

  // 加载配置状态
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllConfigStatus();
      // 转换数据格式
      const convertedData: CollectorConfigStatusLocal[] = data.map(item => ({
        id: item.id,
        name: item.name,
        status: item.status,
        latestVersion: item.latest_version,
        appliedVersion: item.applied_version,
        isSynced: item.is_synced,
        pendingCount: item.pending_count,
        failedCount: item.failed_count,
        lastSyncTime: item.last_sync_time,
        interfaces: item.interfaces.map(iface => ({
          id: iface.id,
          name: iface.name,
          protocol: iface.protocol,
          enabled: iface.enabled,
          version: iface.version,
          deliveryStatus: iface.delivery_status,
          lastError: iface.last_error,
          lastSyncTime: iface.last_sync_time,
        })),
      }));
      setCollectors(convertedData);
    } catch (error) {
      console.error('Failed to load config status:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load config status",
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  // 加载配置历史
  const loadConfigHistory = async (collectorId: string, interfaceId: string) => {
    setHistoryLoading(true);
    try {
      const data = await getConfigHistory(collectorId, interfaceId);
      // 转换数据格式
      const convertedData: ConfigHistoryItemLocal[] = data.map((item: any) => ({
        id: item.id,
        collectorId: collectorId,
        interfaceId: item.interface_id || '',
        interfaceName: '',
        version: item.version || 0,
        action: item.action || 'update',
        status: 'success', // 默认状态
        timestamp: item.created_at || new Date().toISOString(),
        operator: item.created_by || 'system',
      }));
      setConfigHistory(convertedData);
    } catch (error) {
      console.error('Failed to load config history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 查看接口配置
  const viewInterfaceConfig = async (collectorId: string, interfaceId: string) => {
    try {
      const data = await getInterface(collectorId, interfaceId);
      if (data) {
        setInterfaceConfig(data);
        setConfigModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to load interface config:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load config",
        variant: 'destructive',
      });
    }
  };

  // 重新下发配置
  const handleRedeliver = async (collectorId: string, interfaceId: string) => {
    const key = `${collectorId}-${interfaceId}`;
    setRedelivering(prev => new Set(prev).add(key));
    try {
      const result = await redeliverConfig(collectorId, interfaceId);
      if (result.success) {
        showSuccess("Redeliver successful");
        loadStatus();
      } else {
        toast({
          title: "Redeliver Failed",
          description: result.error || "Please try again later",
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to redeliver config:', error);
      toast({
        title: "Redeliver Failed",
        description: "Please check network connection",
        variant: 'destructive',
      });
    } finally {
      setRedelivering(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // 确认配置已应用
  const handleConfirmApplied = async (collectorId: string, interfaceId: string) => {
    try {
      const result = await confirmConfigApplied(collectorId, interfaceId);
      if (result.success) {
        showSuccess("Confirm successful");
        loadStatus();
      } else {
        toast({
          title: "Confirm Failed",
          description: result.error || "Please try again later",
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to confirm config:', error);
      toast({
        title: "Confirm Failed",
        description: "Please check network connection",
        variant: 'destructive',
      });
    }
  };

  // 回滚配置
  const handleRollback = async (collectorId: string, interfaceId: string) => {
    if (!window.confirm("Are you sure you want to rollback this configuration?")) return;
    try {
      const result = await rollbackInterfaceConfig(collectorId, interfaceId);
      if (result.success) {
        showSuccess("Rollback successful");
        loadStatus();
      } else {
        toast({
          title: "Rollback Failed",
          description: result.error || "Please try again later",
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to rollback config:', error);
      toast({
        title: "Rollback Failed",
        description: "Please check network connection",
        variant: 'destructive',
      });
    }
  };

  // 导出状态报告
  const exportStatusReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      collectors: collectors.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        synced: c.isSynced,
        pendingCount: c.pendingCount,
        failedCount: c.failedCount,
        interfaces: c.interfaces.map(i => ({
          name: i.name,
          status: i.deliveryStatus,
          version: i.version,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-status-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("Export successful");
  };

  // 自动刷新
  useEffect(() => {
    loadStatus();
    if (!autoRefresh) return;
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadStatus]);

  // 过滤采集器
  const filteredCollectors = collectors.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (syncFilter === 'synced' && !c.isSynced) return false;
    if (syncFilter === 'unsynced' && c.isSynced) return false;
    return true;
  });

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'applied':
      case 'success':
        return isDark ? 'text-green-400 bg-green-400/20' : 'text-green-600 bg-green-100';
      case 'offline':
        return isDark ? 'text-gray-400 bg-gray-400/20' : 'text-gray-600 bg-gray-100';
      case 'error':
      case 'failed':
        return isDark ? 'text-red-400 bg-red-400/20' : 'text-red-600 bg-red-100';
      case 'pending':
        return isDark ? 'text-yellow-400 bg-yellow-400/20' : 'text-yellow-600 bg-yellow-100';
      case 'delivered':
        return isDark ? 'text-blue-400 bg-blue-400/20' : 'text-blue-600 bg-blue-100';
      default:
        return isDark ? 'text-gray-400 bg-gray-400/20' : 'text-gray-600 bg-gray-100';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'applied':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-5 h-5 text-gray-500" />;
      case 'error':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'delivered':
        return <Zap className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  // 获取同步状态文本
  const getSyncStatusText = (collector: CollectorConfigStatusLocal) => {
    if (collector.status === 'offline') {
      return "Collector Offline";
    }
    if (collector.failedCount > 0) {
      return `${collector.failedCount} interfaces failed`;
    }
    if (collector.pendingCount > 0) {
      return `${collector.pendingCount} interfaces pending`;
    }
    if (collector.isSynced) {
      return "Config Synced";
    }
    return "Syncing...";
  };

  // 统计
  const stats = {
    total: collectors.length,
    online: collectors.filter(c => c.status === 'online').length,
    offline: collectors.filter(c => c.status === 'offline').length,
    error: collectors.filter(c => c.status === 'error').length,
    synced: collectors.filter(c => c.isSynced).length,
    pending: collectors.reduce((sum, c) => sum + c.pendingCount, 0),
    failed: collectors.reduce((sum, c) => sum + c.failedCount, 0),
  };

  return (
    <div className="space-y-6 relative">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('configDelivery.title')}
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('configDelivery.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">Auto Refresh</span>
          </label>
          <button
            onClick={exportStatusReport}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button
            onClick={loadStatus}
            disabled={loading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
            </div>
            <Server className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Online</p>
              <p className="text-2xl font-bold text-green-500">{stats.online}</p>
            </div>
            <Wifi className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Offline</p>
              <p className="text-2xl font-bold text-gray-500">{stats.offline}</p>
            </div>
            <WifiOff className="w-8 h-8 text-gray-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Error</p>
              <p className="text-2xl font-bold text-red-500">{stats.error}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Synced</p>
              <p className="text-2xl font-bold text-green-500">{stats.synced}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Failed</p>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status Filter</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value as SyncFilter)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Sync Status</option>
            <option value="synced">Synced</option>
            <option value="unsynced">Unsynced</option>
          </select>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Showing {filteredCollectors.length} collectors
          </span>
        </div>
      </div>

      {/* 采集器列表 */}
      <div className="space-y-4">
        {filteredCollectors.length === 0 ? (
          <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
            <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No collectors found</p>
          </div>
        ) : (
          filteredCollectors.map((collector) => (
            <div
              key={collector.id}
              className={`border rounded-xl overflow-hidden transition-all ${
                isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
              }`}
            >
              {/* 采集器头部 */}
              <div
                className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedCollector(
                  selectedCollector === collector.id ? null : collector.id
                )}
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(collector.status)}
                  <div>
                    <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {collector.name}
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      ID: {collector.id}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(collector.status)}`}>
                    {collector.status === 'online' ? "Online" : collector.status === 'offline' ? "Offline" : "Error"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-6 lg:gap-8">
                  <div className="text-left lg:text-right">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Config Version</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Platform: v{collector.latestVersion} | Collector: v{collector.appliedVersion}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sync Status</p>
                    <p className={`text-sm font-medium ${collector.isSynced ? 'text-green-500' : 'text-yellow-500'}`}>
                      {getSyncStatusText(collector)}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Last Sync</p>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {collector.lastSyncTime}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 transition-transform ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    } ${selectedCollector === collector.id ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              {/* 展开的接口列表 */}
              {selectedCollector === collector.id && (
                <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Layers className="w-4 h-4" />
                        Interfaces ({collector.interfaces.length})
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name</th>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Protocol</th>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Version</th>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Delivery Status</th>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Last Sync</th>
                            <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                          {collector.interfaces.map((iface) => (
                            <tr key={iface.id} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${iface.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{iface.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                  {iface.protocol}
                                </span>
                              </td>
                              <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>v{iface.version}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(iface.deliveryStatus)}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(iface.deliveryStatus)}`}>
                                    {iface.deliveryStatus === 'applied' && "Applied"}
                                    {iface.deliveryStatus === 'pending' && "Pending"}
                                    {iface.deliveryStatus === 'failed' && "Failed"}
                                    {iface.deliveryStatus === 'delivered' && "Delivered"}
                                  </span>
                                </div>
                                {iface.lastError && (
                                  <p className="text-xs text-red-500 mt-1">{iface.lastError}</p>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {iface.lastSyncTime || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => viewInterfaceConfig(collector.id, iface.id)}
                                    className={`p-1.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                    title="View Config"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedInterface(iface);
                                      loadConfigHistory(collector.id, iface.id);
                                      setHistoryModalOpen(true);
                                    }}
                                    className={`p-1.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                    title="History"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                  {iface.deliveryStatus === 'failed' && (
                                    <button
                                      onClick={() => handleRedeliver(collector.id, iface.id)}
                                      disabled={redelivering.has(`${collector.id}-${iface.id}`)}
                                      className={`p-1.5 rounded transition-colors ${
                                        isDark ? 'hover:bg-orange-900/30 text-orange-400' : 'hover:bg-orange-50 text-orange-600'
                                      } disabled:opacity-50`}
                                      title="Redeliver"
                                    >
                                      <RotateCcw className={`w-4 h-4 ${redelivering.has(`${collector.id}-${iface.id}`) ? 'animate-spin' : ''}`} />
                                    </button>
                                  )}
                                  {iface.deliveryStatus === 'delivered' && (
                                    <button
                                      onClick={() => handleConfirmApplied(collector.id, iface.id)}
                                      className={`p-1.5 rounded transition-colors ${
                                        isDark ? 'hover:bg-green-900/30 text-green-400' : 'hover:bg-green-50 text-green-600'
                                      }`}
                                      title="Confirm Applied"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRollback(collector.id, iface.id)}
                                    className={`p-1.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'
                                    }`}
                                    title="Rollback"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 配置历史弹窗 */}
      {historyModalOpen && selectedInterface && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-3xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Config History - {selectedInterface.name}
              </h3>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : configHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No history records</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {configHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                            Version {item.version}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(item.action)}`}>
                            {item.action === 'create' && "Create"}
                            {item.action === 'update' && "Update"}
                            {item.action === 'delete' && "Delete"}
                            {item.action === 'rollback' && "Rollback"}
                          </span>
                        </div>
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.timestamp}
                        </span>
                      </div>
                      {item.error && (
                        <p className="text-sm text-red-500 mt-2">{item.error}</p>
                      )}
                      {item.operator && (
                        <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Operator: {item.operator}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 配置详情弹窗 */}
      {configModalOpen && interfaceConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-4xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Interface Config
              </h3>
              <button
                onClick={() => setConfigModalOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className={`p-4 rounded-lg text-sm overflow-x-auto ${isDark ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                {JSON.stringify(interfaceConfig, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
