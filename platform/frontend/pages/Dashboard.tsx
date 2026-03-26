import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Database, Server, Zap } from 'lucide-react';

const data = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  ingestion: Math.floor(Math.random() * 5000) + 2000,
  queries: Math.floor(Math.random() * 1000) + 100,
}));

const Card: React.FC<{ title: string; value: string; sub: string; icon: React.ElementType; color: string }> = ({ title, value, sub, icon: Icon, color }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div className={`relative isolate rounded-xl p-6 border shadow-sm overflow-hidden group transition-colors ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon className="w-24 h-24" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-medium text-sm uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
        <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'} ${color.replace('text-', 'text-opacity-100 ')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <div>
        <span className={`text-3xl font-bold block mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</span>
        <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</span>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    color: isDark ? '#f3f4f6' : '#1f2937',
  };

  const chartGridColor = isDark ? '#374151' : '#e5e7eb';
  const chartAxisColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard.title', 'System Overview')}</h1>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            {t('dashboard.clusterHealthy', 'Cluster Healthy')}
          </span>
          <span className="mx-2">|</span>
          <span>{t('dashboard.lastUpdated', 'Last updated: just now')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          title={t('dashboard.ingestionRate', 'Ingestion Rate')} 
          value="45.2K" 
          sub={t('dashboard.rowsPerSecond', 'Rows / Second')} 
          icon={Zap} 
          color="text-yellow-400" 
        />
        <Card 
          title={t('dashboard.totalStorage', 'Total Storage')} 
          value="12.8 TB" 
          sub={t('dashboard.compressedData', 'Compressed Data')} 
          icon={Database} 
          color="text-blue-400" 
        />
        <Card
          title={t('dashboard.activeNodes', 'Active Nodes')}
          value="4/4"
          sub={"100% " + t('dashboard.availability', 'Availability')}
          icon={Server}
          color="text-green-400"
        />
        <Card 
          title="QPS" 
          value="1,240" 
          sub={t('dashboard.queriesPerSecond', 'Queries / Second')} 
          icon={Activity} 
          color="text-purple-400" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 isolate bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6">{t('dashboard.trafficTrend', 'Traffic Trend (24h)')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorIngestion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="name" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: '#93c5fd' }}
                />
                <Area type="monotone" dataKey="ingestion" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIngestion)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="isolate bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6">{t('dashboard.resourceUsage', 'Resource Usage')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(18)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                <XAxis type="number" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} hide />
                <YAxis dataKey="name" type="category" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip 
                  cursor={{fill: isDark ? '#374151' : '#e5e7eb', opacity: 0.4}}
                  contentStyle={chartTooltipStyle}
                />
                <Bar dataKey="queries" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
