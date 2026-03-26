import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Wifi,
  WifiOff,
  RotateCcw,
  Download,
  ChevronRight,
  Layers,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

interface InterfaceConfig {
  id: string;
  name: string;
  protocol: string;
  enabled: boolean;
  version: number;
  deliveryStatus: 'delivered' | 'pending' | 'failed' | 'applied';
  lastError?: string;
  lastSyncTime?: string;
}

interface ConfigStatus {
  collectorId: string;
  collectorName: string;
  status: 'online' | 'offline' | 'error';
  latestVersion: number;
  appliedVersion: number;
  isSynced: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: string;
  interfaces: InterfaceConfig[];
}

const mockConfigStatus: ConfigStatus = {
  collectorId: 'collector-1',
  collectorName: 'Factory-A-Gateway-01',
  status: 'online',
  latestVersion: 12,
  appliedVersion: 12,
  isSynced: true,
  pendingCount: 0,
  failedCount: 0,
  lastSyncTime: '2026-03-13 10:30:45',
  interfaces: [
    {
      id: 'iface-1',
      name: '产线1-ModbusTCP',
      protocol: 'modbus_tcp',
      enabled: true,
      version: 5,
      deliveryStatus: 'applied',
      lastSyncTime: '2026-03-13 10:30:45',
    },
    {
      id: 'iface-2',
      name: '产线2-OPCUA',
      protocol: 'opcua',
      enabled: true,
      version: 3,
      deliveryStatus: 'applied',
      lastSyncTime: '2026-03-13 10:30:42',
    },
    {
      id: 'iface-3',
      name: 'MQTT-Broker',
      protocol: 'mqtt',
      enabled: true,
      version: 2,
      deliveryStatus: 'pending',
    },
  ],
};

export default function ConfigStatus() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(mockConfigStatus);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setConfigStatus(mockConfigStatus);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'applied':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'offline':
        return <WifiOff className="w-5 h-5 text-zinc-500" />;
      case 'error':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-zinc-500" />;
    }
  };

  const handleRedeliver = async (interfaceId: string) => {
    // 模拟重新下发
    alert(`重新下发配置: ${interfaceId}`);
  };

  const exportStatus = () => {
    const report = {
      timestamp: new Date().toISOString(),
      ...configStatus,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-status-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  if (!configStatus) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">配置下发状态</h1>
          <p className="text-zinc-400 mt-1">监控配置同步状态</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            同步设置
          </button>
          <button
            onClick={exportStatus}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-sm">采集器状态</div>
              <div className={cn(
                "text-lg font-bold mt-1",
                configStatus.status === 'online' ? "text-emerald-500" :
                configStatus.status === 'error' ? "text-red-500" : "text-zinc-500"
              )}>
                {configStatus.status === 'online' ? '在线' : 
                 configStatus.status === 'error' ? '错误' : '离线'}
              </div>
            </div>
            {getStatusIcon(configStatus.status)}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-sm">配置版本</div>
              <div className="text-lg font-bold text-white mt-1">
                v{configStatus.appliedVersion}
              </div>
            </div>
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-sm">同步状态</div>
              <div className={cn(
                "text-lg font-bold mt-1",
                configStatus.isSynced ? "text-emerald-500" : "text-yellow-500"
              )}>
                {configStatus.isSynced ? '已同步' : '待同步'}
              </div>
            </div>
            <CheckCircle className={cn("w-8 h-8", configStatus.isSynced ? "text-emerald-500" : "text-yellow-500")} />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-sm">待下发</div>
              <div className="text-lg font-bold text-yellow-500 mt-1">{configStatus.pendingCount}</div>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-sm">下发失败</div>
              <div className="text-lg font-bold text-red-500 mt-1">{configStatus.failedCount}</div>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4">
            {getStatusIcon(configStatus.status)}
            <div>
              <h3 className="font-medium text-white">{configStatus.collectorName}</h3>
              <p className="text-sm text-zinc-500">{configStatus.collectorId}</p>
            </div>
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              configStatus.isSynced ? "bg-emerald-500/20 text-emerald-500" : "bg-yellow-500/20 text-yellow-500"
            )}>
              {configStatus.isSynced ? '配置已同步' : '同步中...'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-zinc-500">配置版本</p>
              <p className="text-white">Platform: v{configStatus.latestVersion} | Local: v{configStatus.appliedVersion}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">最后同步</p>
              <p className="text-sm text-zinc-300">{configStatus.lastSyncTime}</p>
            </div>
            <ChevronRight className={cn("w-5 h-5 text-zinc-500 transition-transform", expanded && "rotate-90")} />
          </div>
        </div>

        {/* Expanded Interface List */}
        {expanded && (
          <div className="border-t border-zinc-800 p-4">
            <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              接口配置状态 ({configStatus.interfaces.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-400">接口名称</th>
                    <th className="px-4 py-2 text-left text-zinc-400">协议</th>
                    <th className="px-4 py-2 text-left text-zinc-400">版本</th>
                    <th className="px-4 py-2 text-left text-zinc-400">下发状态</th>
                    <th className="px-4 py-2 text-left text-zinc-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {configStatus.interfaces.map((iface) => (
                    <tr key={iface.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            iface.enabled ? "bg-emerald-500" : "bg-zinc-500"
                          )} />
                          <span className="text-white">{iface.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">
                          {iface.protocol}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">v{iface.version}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(iface.deliveryStatus)}
                          <span className={cn(
                            "text-xs",
                            iface.deliveryStatus === 'applied' ? "text-emerald-500" :
                            iface.deliveryStatus === 'pending' ? "text-yellow-500" :
                            iface.deliveryStatus === 'failed' ? "text-red-500" :
                            "text-blue-500"
                          )}>
                            {iface.deliveryStatus === 'applied' && '已应用'}
                            {iface.deliveryStatus === 'pending' && '待下发'}
                            {iface.deliveryStatus === 'failed' && '失败'}
                            {iface.deliveryStatus === 'delivered' && '已下发'}
                          </span>
                        </div>
                        {iface.lastError && (
                          <p className="text-xs text-red-400 mt-1">{iface.lastError}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {iface.deliveryStatus === 'failed' && (
                            <button
                              onClick={() => handleRedeliver(iface.id)}
                              className="p-1.5 text-orange-500 hover:bg-orange-500/20 rounded"
                              title="重新下发"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sync Log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-lg font-medium text-white mb-4">同步日志</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-zinc-400">10:30:45</span>
            <span className="text-white">配置同步成功</span>
            <span className="text-zinc-500">版本: v12</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-zinc-400">10:25:12</span>
            <span className="text-white">接口配置已应用</span>
            <span className="text-zinc-500">产线1-ModbusTCP</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-zinc-400">10:20:00</span>
            <span className="text-white">配置下发中...</span>
            <span className="text-zinc-500">等待采集器确认</span>
          </div>
        </div>
      </div>
    </div>
  );
}