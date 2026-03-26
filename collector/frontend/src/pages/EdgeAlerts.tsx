import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Activity,
  Database,
  Shield
} from 'lucide-react';
import { cn } from '../lib/utils';

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'pending' | 'acknowledged' | 'cleared';

interface EdgeAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  pointName: string;
  threshold: number;
  currentValue: number;
  createdAt: string;
  acknowledgedAt?: string;
}

interface AlertRule {
  id: string;
  name: string;
  pointName: string;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

const mockAlerts: EdgeAlert[] = [
  {
    id: 'alert-1',
    title: '温度超限',
    message: '产线1温度传感器读数超过阈值',
    severity: 'critical',
    status: 'pending',
    pointName: 'line1_temp_01',
    threshold: 80,
    currentValue: 85.5,
    createdAt: '2026-03-13 10:30:45',
  },
  {
    id: 'alert-2',
    title: '压力异常',
    message: '产线2压力传感器读数偏低',
    severity: 'warning',
    status: 'acknowledged',
    pointName: 'line2_pressure_01',
    threshold: 10,
    currentValue: 8.2,
    createdAt: '2026-03-13 10:25:12',
    acknowledgedAt: '2026-03-13 10:28:30',
  },
  {
    id: 'alert-3',
    title: '设备离线',
    message: 'MQTT broker连接断开',
    severity: 'critical',
    status: 'cleared',
    pointName: 'mqtt_connection',
    threshold: 0,
    currentValue: 0,
    createdAt: '2026-03-13 10:15:00',
  },
];

const mockRules: AlertRule[] = [
  {
    id: 'rule-1',
    name: '温度告警',
    pointName: 'line1_temp_01',
    condition: '>',
    threshold: 80,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'rule-2',
    name: '压力告警',
    pointName: 'line2_pressure_01',
    condition: '<',
    threshold: 10,
    severity: 'warning',
    enabled: true,
  },
];

export default function EdgeAlerts() {
  const [alerts, setAlerts] = useState<EdgeAlert[]>(mockAlerts);
  const [rules, setRules] = useState<AlertRule[]>(mockRules);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');

  const loadData = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setAlerts(mockAlerts);
    setRules(mockRules);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAck = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { ...alert, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() }
        : alert
    ));
  };

  const handleClear = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: 'cleared' as AlertStatus } : alert
    ));
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'pending':
        return 'text-red-400';
      case 'acknowledged':
        return 'text-yellow-400';
      case 'cleared':
        return 'text-emerald-400';
    }
  };

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    pending: alerts.filter(a => a.status === 'pending').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
  };

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">边缘告警</h1>
          <p className="text-zinc-400 mt-1">管理边缘采集器的实时告警</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">总告警数</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">严重</div>
          <div className="text-2xl font-bold text-red-500 mt-1">{stats.critical}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">警告</div>
          <div className="text-2xl font-bold text-yellow-500 mt-1">{stats.warning}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">信息</div>
          <div className="text-2xl font-bold text-blue-500 mt-1">{stats.info}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">待确认</div>
          <div className="text-2xl font-bold text-orange-500 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">已确认</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.acknowledged}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'alerts'
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Bell className="w-4 h-4 inline-block mr-2" />
          实时告警
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'rules'
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Shield className="w-4 h-4 inline-block mr-2" />
          告警规则
        </button>
      </div>

      {activeTab === 'alerts' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">全部级别</option>
              <option value="critical">严重</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'all')}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">全部状态</option>
              <option value="pending">待确认</option>
              <option value="acknowledged">已确认</option>
              <option value="cleared">已清除</option>
            </select>
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "bg-zinc-900 border rounded-xl p-4",
                  alert.severity === 'critical' ? "border-red-500/30" :
                  alert.severity === 'warning' ? "border-yellow-500/30" :
                  "border-zinc-800"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <h3 className="font-medium text-white">{alert.title}</h3>
                      <p className="text-sm text-zinc-400 mt-1">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-zinc-500">数据点: {alert.pointName}</span>
                        <span className="text-zinc-500">
                          阈值: {alert.threshold} | 当前: {alert.currentValue}
                        </span>
                        <span className="text-zinc-500">{alert.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", getStatusColor(alert.status))}>
                      {alert.status === 'pending' ? '待确认' :
                       alert.status === 'acknowledged' ? '已确认' : '已清除'}
                    </span>
                    {alert.status === 'pending' && (
                      <button
                        onClick={() => handleAck(alert.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg text-sm hover:bg-emerald-500/30"
                      >
                        <CheckCircle className="w-4 h-4" />
                        确认
                      </button>
                    )}
                    {alert.status !== 'cleared' && (
                      <button
                        onClick={() => handleClear(alert.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg text-sm hover:bg-zinc-700"
                      >
                        <XCircle className="w-4 h-4" />
                        清除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'rules' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">告警规则 ({rules.length})</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
              <Plus className="w-4 h-4" />
              新建规则
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-zinc-400">规则名称</th>
                  <th className="px-4 py-3 text-left text-zinc-400">数据点</th>
                  <th className="px-4 py-3 text-left text-zinc-400">条件</th>
                  <th className="px-4 py-3 text-left text-zinc-400">级别</th>
                  <th className="px-4 py-3 text-left text-zinc-400">状态</th>
                  <th className="px-4 py-3 text-left text-zinc-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white">{rule.name}</p>
                        <p className="text-xs text-zinc-500">{rule.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{rule.pointName}</td>
                    <td className="px-4 py-3 text-zinc-300">{rule.condition} {rule.threshold}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs",
                        rule.severity === 'critical' ? "bg-red-500/20 text-red-400" :
                        rule.severity === 'warning' ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        {rule.severity === 'critical' ? '严重' : rule.severity === 'warning' ? '警告' : '信息'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-sm",
                        rule.enabled ? "text-emerald-500" : "text-zinc-500"
                      )}>
                        {rule.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-zinc-400 hover:text-white">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}