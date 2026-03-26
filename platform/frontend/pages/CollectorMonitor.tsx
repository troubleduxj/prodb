import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Activity, Database, Server, Zap, AlertTriangle, ArrowUpRight, ArrowDownRight, FileText, CheckCircle, XCircle, RefreshCw, Clock, Send, RotateCcw } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const DATA_THROUGHPUT = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  ingress: Math.floor(Math.random() * 5000) + 2000,
  egress: Math.floor(Math.random() * 4500) + 1800,
}));

const ERROR_RATES = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  errors: Math.floor(Math.random() * 50),
  warnings: Math.floor(Math.random() * 150),
}));

// 配置下发状态统计
const CONFIG_DELIVERY_STATS = [
  { name: '已同步', value: 156, color: '#10b981' },
  { name: '同步中', value: 12, color: '#3b82f6' },
  { name: '待同步', value: 8, color: '#f59e0b' },
  { name: '失败', value: 6, color: '#ef4444' },
];

// 配置下发历史数据
const CONFIG_HISTORY = [
  { id: 'cfg_001', agentName: 'Factory-Gateway-01', version: 'v13', status: 'synced' as const, timestamp: '2024-01-15 14:32:05', duration: '2.3s' },
  { id: 'cfg_002', agentName: 'Factory-Gateway-02', version: 'v13', status: 'syncing' as const, timestamp: '2024-01-15 14:30:00', duration: '-' },
  { id: 'cfg_003', agentName: 'Warehouse-Edge-01', version: 'v12', status: 'pending' as const, timestamp: '2024-01-15 14:25:10', duration: '-' },
  { id: 'cfg_004', agentName: 'Logistics-Tracker-05', version: 'v11', status: 'failed' as const, timestamp: '2024-01-15 14:20:00', duration: '30.5s' },
  { id: 'cfg_005', agentName: 'HQ-Server-Monitor', version: 'v15', status: 'synced' as const, timestamp: '2024-01-15 14:15:20', duration: '1.8s' },
];

// 配置下发趋势数据
const CONFIG_TRENDS = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  delivered: Math.floor(Math.random() * 50) + 10,
  failed: Math.floor(Math.random() * 10),
  pending: Math.floor(Math.random() * 20),
}));

export const CollectorMonitor: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('collector.monitoring')}</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('collector.realTimeMetrics')}</p>
        </div>
        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400 bg-gray-800 border-gray-700' : 'text-gray-500 bg-white border-gray-200'} px-3 py-1.5 rounded-lg border`}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {t('collector.systemStatus')}: {t('collector.healthy')}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Zap className="w-24 h-24" />
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium uppercase`}>{t('collector.totalThroughput')}</p>
          <div className="flex items-end gap-2 mt-2">
            <h3 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>4.2 GB/s</h3>
            <span className="text-green-400 text-xs flex items-center mb-1"><ArrowUpRight className="w-3 h-3 mr-0.5" /> +12%</span>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Activity className="w-24 h-24" />
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium uppercase`}>{t('collector.eventsProcessed')}</p>
          <div className="flex items-end gap-2 mt-2">
            <h3 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>850K</h3>
            <span className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('collector.perSecond')}</span>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Server className="w-24 h-24" />
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium uppercase`}>{t('collector.activeAgents')}</p>
          <div className="flex items-end gap-2 mt-2">
            <h3 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>182</h3>
            <span className="text-green-400 text-xs flex items-center mb-1"><ArrowUpRight className="w-3 h-3 mr-0.5" /> +3</span>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <AlertTriangle className="w-24 h-24" />
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium uppercase`}>{t('collector.errorRate')}</p>
          <div className="flex items-end gap-2 mt-2">
            <h3 className="text-3xl font-bold text-green-400">0.02%</h3>
            <span className="text-green-400 text-xs flex items-center mb-1"><ArrowDownRight className="w-3 h-3 mr-0.5" /> -0.01%</span>
          </div>
        </div>
      </div>

      {/* 配置下发状态追踪 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 配置状态分布 */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-4`}>{t('collector.configDistribution', 'Config Sync Status')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={CONFIG_DELIVERY_STATS}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {CONFIG_DELIVERY_STATS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {CONFIG_DELIVERY_STATS.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }}></span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{stat.name}</span>
                </span>
                <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 配置下发趋势 */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} lg:col-span-2`}>
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-4`}>{t('collector.configTrends', 'Config Delivery Trends (24h)')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CONFIG_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="time" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937' }}
                  cursor={{fill: isDark ? '#374151' : '#e5e7eb', opacity: 0.4}}
                />
                <Legend />
                <Bar dataKey="delivered" name={t('collector.delivered', 'Delivered')} fill="#10b981" stackId="a" />
                <Bar dataKey="pending" name={t('collector.pending', 'Pending')} fill="#f59e0b" stackId="a" />
                <Bar dataKey="failed" name={t('collector.failed', 'Failed')} fill="#ef4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 最近配置下发事件 */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('collector.recentConfigEvents', 'Recent Configuration Events')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                <th className="px-6 py-4 font-semibold">{t('collector.agent', 'Agent')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.version', 'Version')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.status', 'Status')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.timestamp', 'Timestamp')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.duration', 'Duration')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('common.action', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {CONFIG_HISTORY.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <Server className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{event.agentName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{event.version}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      event.status === 'synced' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                      event.status === 'syncing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                      event.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                    }`}>
                      {event.status === 'synced' && <CheckCircle className="w-3 h-3" />}
                      {event.status === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {event.status === 'pending' && <Clock className="w-3 h-3" />}
                      {event.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {event.status === 'synced' && t('collector.synced', 'Synced')}
                      {event.status === 'syncing' && t('collector.syncing', 'Syncing')}
                      {event.status === 'pending' && t('collector.pending', 'Pending')}
                      {event.status === 'failed' && t('collector.failed', 'Failed')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{event.timestamp}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{event.duration}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {event.status === 'failed' && (
                        <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-500'}`} title={t('collector.retry', 'Retry')}>
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} title={t('collector.viewDetails', 'View Details')}>
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-6`}>{t('collector.networkThroughput')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DATA_THROUGHPUT}>
                <defs>
                  <linearGradient id="colorIngress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="time" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937' }}
                />
                <Legend />
                <Area type="monotone" dataKey="ingress" name={t('collector.ingress')} stroke="#3b82f6" fillOpacity={1} fill="url(#colorIngress)" />
                <Area type="monotone" dataKey="egress" name={t('collector.egress')} stroke="#10b981" fillOpacity={1} fill="url(#colorEgress)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-6`}>{t('collector.errorWarningDistribution')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ERROR_RATES}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="time" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937' }}
                  cursor={{fill: isDark ? '#374151' : '#e5e7eb', opacity: 0.4}}
                />
                <Legend />
                <Bar dataKey="errors" name={t('collector.errors')} fill="#ef4444" stackId="a" />
                <Bar dataKey="warnings" name={t('collector.warnings')} fill="#f59e0b" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
