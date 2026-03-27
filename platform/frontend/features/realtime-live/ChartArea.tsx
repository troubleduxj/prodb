/**
 * RealtimeLive 功能模块 - 图表区域组件
 * 包含图表渲染和工具栏
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play, Pause, RefreshCw, Database, Table,
  TrendingUp, Activity, BarChart2, AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import type { FieldConfig, DataPoint, ChartType, RefreshRate } from './types';

interface ChartAreaProps {
  // 数据状态
  dataPoints: DataPoint[];
  fieldConfigs: FieldConfig[];
  visibleFields: string[];
  selectedDb: string;
  selectedSubTable: string;
  dataLoading: boolean;

  // 图表配置
  chartType: ChartType;
  refreshRate: RefreshRate;
  isPaused: boolean;
  lastUpdateTime: Date | null;
  error: string | null;

  // 设置器
  setChartType: (type: ChartType) => void;
  setRefreshRate: (rate: RefreshRate) => void;
  setIsPaused: (paused: boolean) => void;
  setError: (error: string | null) => void;

  // 样式辅助
  isDark: boolean;
  getBgClass: () => string;
  getSubBgClass: () => string;
  getSubTextClass: () => string;
}

export const ChartArea: React.FC<ChartAreaProps> = ({
  dataPoints,
  fieldConfigs,
  visibleFields,
  selectedDb,
  selectedSubTable,
  dataLoading,
  chartType,
  refreshRate,
  isPaused,
  lastUpdateTime,
  error,
  setChartType,
  setRefreshRate,
  setIsPaused,
  setError,
  isDark,
  getBgClass,
  getSubBgClass,
  getSubTextClass
}) => {
  const { t } = useTranslation();

  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    color: isDark ? '#f3f4f6' : '#1f2937',
    fontSize: '12px'
  };

  const chartGridColor = isDark ? '#374151' : '#e5e7eb';
  const chartAxisColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      {/* 工具栏 */}
      <div className={"p-3 rounded-xl border flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm " + getBgClass()}>
        <div className="flex items-center gap-4">
          {/* 刷新频率 */}
          <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
            {[1000, 5000, 10000].map(rate => (
              <button
                key={rate}
                onClick={() => setRefreshRate(rate as RefreshRate)}
                className={"px-3 py-1 text-xs font-medium rounded transition-colors " + (refreshRate === rate
                  ? (isDark ? 'bg-gray-700 text-white shadow' : 'bg-white text-gray-900 shadow')
                  : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'))}
              >
                {rate / 1000}s
              </button>
            ))}
          </div>

          <div className={"h-6 w-px " + (isDark ? 'bg-gray-700' : 'bg-gray-300')}></div>

          {/* 图表类型 */}
          <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
            <button onClick={() => setChartType('line')} className={"p-1.5 rounded " + (chartType === 'line'
              ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow')
              : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.lineChart', 'Line Chart')}>
              <TrendingUp className="w-4 h-4"/>
            </button>
            <button onClick={() => setChartType('area')} className={"p-1.5 rounded " + (chartType === 'area'
              ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow')
              : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.areaChart', 'Area Chart')}>
              <Activity className="w-4 h-4"/>
            </button>
            <button onClick={() => setChartType('bar')} className={"p-1.5 rounded " + (chartType === 'bar'
              ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow')
              : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.barChart', 'Bar Chart')}>
              <BarChart2 className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* 状态和控制 */}
        <div className="flex items-center gap-3">
          {lastUpdateTime && (
            <span className={"text-xs " + getSubTextClass()}>
              {t('realtime.lastUpdate', 'Last update')}: {lastUpdateTime.toLocaleTimeString()}
            </span>
          )}
          <div className={"flex items-center gap-2 text-xs px-3 py-1.5 rounded border " + (isDark ? 'text-gray-400 bg-gray-900 border-gray-700' : 'text-gray-500 bg-gray-100 border-gray-300')}>
            <span className={"w-2 h-2 rounded-full " + (isPaused ? 'bg-yellow-500' : dataLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-pulse')}></span>
            {isPaused ? t('realtime.paused', 'Paused') : dataLoading ? t('realtime.loading', 'Loading...') : t('realtime.live', 'Live')}
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={"p-2 rounded-lg border transition-colors " + (isPaused
              ? 'bg-green-600 hover:bg-green-500 border-green-500 text-white'
              : 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400')}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={"p-3 rounded-lg border flex items-center gap-2 " + (isDark ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600')}>
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs underline hover:no-underline"
          >
            {t('common.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* 图表区域 */}
      <div className={"flex-1 min-h-[350px] rounded-xl border p-4 relative overflow-hidden flex flex-col " + getBgClass()}>
        {!selectedDb ? (
          <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
            <Database className="w-16 h-16 mb-4 opacity-20" />
            <p>{t('realtime.selectDatabaseHint', 'Select a database to view real-time data.')}</p>
          </div>
        ) : !selectedSubTable ? (
          <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
            <Table className="w-16 h-16 mb-4 opacity-20" />
            <p>{t('realtime.selectSubTableHint', 'Please select a sub-table to query data. Super tables cannot be queried directly.')}</p>
          </div>
        ) : dataPoints.length === 0 ? (
          <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
            <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
            <p>{dataLoading ? t('realtime.loadingData', 'Loading data...') : t('realtime.noData', 'No data available')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={dataPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={chartAxisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                {fieldConfigs
                  .filter(f => visibleFields.includes(f.key))
                  .map(field => (
                    <Bar
                      key={field.key}
                      dataKey={field.key}
                      name={field.label}
                      fill={field.color}
                      opacity={0.8}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
              </BarChart>
            ) : chartType === 'area' ? (
              <AreaChart data={dataPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={chartAxisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                {fieldConfigs
                  .filter(f => visibleFields.includes(f.key))
                  .map(field => (
                    <Area
                      key={field.key}
                      type="monotone"
                      dataKey={field.key}
                      name={field.label}
                      stroke={field.color}
                      fill={field.color}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  ))}
              </AreaChart>
            ) : (
              <LineChart data={dataPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={chartAxisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                {fieldConfigs
                  .filter(f => visibleFields.includes(f.key))
                  .map(field => (
                    <Line
                      key={field.key}
                      type="monotone"
                      dataKey={field.key}
                      name={field.label}
                      stroke={field.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
