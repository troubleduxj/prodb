import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Play, 
  Square, 
  RefreshCw,
  Settings,
  Database,
  Wifi,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Interface {
  id: string;
  name: string;
  protocol: 'modbus_tcp' | 'modbus_rtu' | 'opcua' | 'mqtt';
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  host?: string;
  port?: number;
  lastError?: string;
  dataPoints: number;
  collectedPoints: number;
  lastCollectTime?: string;
}

const mockInterfaces: Interface[] = [
  {
    id: 'iface-1',
    name: '产线1-ModbusTCP',
    protocol: 'modbus_tcp',
    enabled: true,
    status: 'connected',
    host: '192.168.1.100',
    port: 502,
    dataPoints: 50,
    collectedPoints: 48,
    lastCollectTime: '2026-03-13 10:30:45',
  },
  {
    id: 'iface-2',
    name: '产线2-OPCUA',
    protocol: 'opcua',
    enabled: true,
    status: 'connected',
    host: '192.168.1.101',
    port: 4840,
    dataPoints: 30,
    collectedPoints: 30,
    lastCollectTime: '2026-03-13 10:30:42',
  },
  {
    id: 'iface-3',
    name: 'MQTT-Broker',
    protocol: 'mqtt',
    enabled: false,
    status: 'disconnected',
    host: '192.168.1.200',
    port: 1883,
    dataPoints: 20,
    collectedPoints: 0,
  },
  {
    id: 'iface-4',
    name: 'Backup-Modbus',
    protocol: 'modbus_tcp',
    enabled: true,
    status: 'error',
    host: '192.168.1.102',
    port: 502,
    lastError: '连接超时',
    dataPoints: 25,
    collectedPoints: 0,
  },
];

export default function Interfaces() {
  const [interfaces, setInterfaces] = useState<Interface[]>(mockInterfaces);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInterface, setEditingInterface] = useState<Interface | null>(null);

  const loadInterfaces = async () => {
    setLoading(true);
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500));
    setInterfaces(mockInterfaces);
    setLoading(false);
  };

  useEffect(() => {
    loadInterfaces();
  }, []);

  const handleToggle = (id: string) => {
    setInterfaces(prev => prev.map(iface => 
      iface.id === id ? { ...iface, enabled: !iface.enabled } : iface
    ));
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除此接口吗？')) return;
    setInterfaces(prev => prev.filter(iface => iface.id !== id));
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'modbus_tcp':
      case 'modbus_rtu':
        return <Database className="w-4 h-4" />;
      case 'opcua':
        return <Wifi className="w-4 h-4" />;
      case 'mqtt':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-500" />;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">接口管理</h1>
          <p className="text-zinc-400 mt-1">管理采集器的通信接口配置</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadInterfaces}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            刷新
          </button>
          <button
            onClick={() => { setEditingInterface(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建接口
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">接口总数</div>
          <div className="text-2xl font-bold text-white mt-1">{interfaces.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">已连接</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">
            {interfaces.filter(i => i.status === 'connected').length}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">已启用</div>
          <div className="text-2xl font-bold text-blue-500 mt-1">
            {interfaces.filter(i => i.enabled).length}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">错误</div>
          <div className="text-2xl font-bold text-red-500 mt-1">
            {interfaces.filter(i => i.status === 'error').length}
          </div>
        </div>
      </div>

      {/* Interface List */}
      <div className="space-y-4">
        {interfaces.map((iface) => (
          <div
            key={iface.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            {/* Header Row */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50"
              onClick={() => setExpandedId(expandedId === iface.id ? null : iface.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                  {getProtocolIcon(iface.protocol)}
                </div>
                <div>
                  <h3 className="font-medium text-white">{iface.name}</h3>
                  <p className="text-sm text-zinc-500">{iface.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    iface.enabled 
                      ? "bg-emerald-500/20 text-emerald-500" 
                      : "bg-zinc-700 text-zinc-400"
                  )}>
                    {iface.enabled ? '已启用' : '已禁用'}
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
                    iface.status === 'connected' ? "bg-emerald-500/20 text-emerald-500" :
                    iface.status === 'error' ? "bg-red-500/20 text-red-500" :
                    "bg-zinc-700 text-zinc-400"
                  )}>
                    {getStatusIcon(iface.status)}
                    {iface.status === 'connected' ? '已连接' : 
                     iface.status === 'error' ? '错误' : '未连接'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-zinc-400">数据点</p>
                  <p className="font-medium text-white">
                    {iface.collectedPoints}/{iface.dataPoints}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">最后采集</p>
                  <p className="text-sm text-zinc-300">
                    {iface.lastCollectTime || '-'}
                  </p>
                </div>
                <button className="p-1 text-zinc-500 hover:text-white">
                  {expandedId === iface.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === iface.id && (
              <div className="border-t border-zinc-800 p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-sm text-zinc-500">协议类型</label>
                    <p className="text-white">{iface.protocol}</p>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-500">连接地址</label>
                    <p className="text-white">{iface.host}:{iface.port}</p>
                  </div>
                </div>
                
                {iface.lastError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{iface.lastError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(iface.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      iface.enabled
                        ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                        : "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                    )}
                  >
                    {iface.enabled ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {iface.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => { setEditingInterface(iface); setShowModal(true); }}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(iface.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}