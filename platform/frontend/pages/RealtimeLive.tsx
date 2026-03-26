import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { api } from '../src/services/api';
import { toast } from '../src/hooks/use-toast';
import { 
  Play, Pause, RefreshCw, Database, Table, Server, 
  Search, Check, Activity, Zap, Thermometer, 
  BarChart2, TrendingUp, GitCommit
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';

// 设备/采集器接口
interface Device {
  id: string;
  name: string;
  group: string;
  status: 'Online' | 'Offline';
  collectorId?: string;
}

// 数据点接口
interface DataPoint {
  collector_id: string;
  node_id: string;
  node_name: string;
  name: string;
  value: number;
  data_type: string;
  quality: string;
  timestamp: string;
  unit: string;
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

// 实时数据响应接口
interface RealtimeDataResponse {
  success: boolean;
  data: DataPoint[];
  count: number;
  timestamp: string;
}

const FIELDS = [
  { key: 'current', label: 'Current (A)', color: '#3b82f6', icon: Zap },
  { key: 'voltage', label: 'Voltage (V)', color: '#eab308', icon: Activity },
  { key: 'temp', label: 'Temp (°C)', color: '#ef4444', icon: Thermometer },
  { key: 'status_val', label: 'Status', color: '#10b981', icon: GitCommit },
];

// 模拟设备数据（当后端不可用时使用）
const MOCK_DEVICES: Device[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `dev_${100 + i}`,
  name: `Meter_${100 + i}`,
  group: i < 10 ? 'Zone A' : 'Zone B',
  status: Math.random() > 0.1 ? 'Online' : 'Offline'
}));

export const RealtimeLive: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  
  // 设备列表状态
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  
  // 选择和搜索状态
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  
  // 刷新和图表状态
  const [refreshRate, setRefreshRate] = useState<1000 | 5000 | 10000>(1000);
  const [isPaused, setIsPaused] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'status'>('line');
  const [visibleFields, setVisibleFields] = useState<string[]>(['current', 'voltage', 'temp']);
  
  // 数据点状态
  const [dataPoints, setDataPoints] = useState<any[]>([]);
  const [realtimeData, setRealtimeData] = useState<Record<string, DataPoint[]>>({});

  const isDark = resolvedTheme === 'dark';
  const maxPoints = 50;

  // 获取采集器列表
  const fetchCollectors = useCallback(async () => {
    try {
      setDevicesLoading(true);
      const result = await api.collectors.list();
      
      if (result.success && result.data) {
        // 将采集器数据转换为设备列表
        const collectorList = Array.isArray(result.data) ? result.data : 
                             (result.data.collectors || result.data.data || []);
        
        if (collectorList.length > 0) {
          const mappedDevices: Device[] = collectorList.map((collector: any, index: number) => ({
            id: collector.collector_id || collector.id || `collector_${index}`,
            name: collector.name || `Collector_${index + 1}`,
            group: collector.location || 'Default Zone',
            status: collector.status === 'online' ? 'Online' : 'Offline',
            collectorId: collector.collector_id || collector.id,
          }));
          setDevices(mappedDevices);
          setUseMockData(false);
          
          // 默认选择第一个设备
          if (mappedDevices.length > 0 && selectedDevices.length === 0) {
            setSelectedDevices([mappedDevices[0].id]);
          }
        } else {
          // 没有采集器时使用模拟数据
          setDevices(MOCK_DEVICES);
          setUseMockData(true);
          if (selectedDevices.length === 0) {
            setSelectedDevices([MOCK_DEVICES[0].id]);
          }
        }
      } else {
        // API调用失败时使用模拟数据
        setDevices(MOCK_DEVICES);
        setUseMockData(true);
        if (selectedDevices.length === 0) {
          setSelectedDevices([MOCK_DEVICES[0].id]);
        }
      }
    } catch (error) {
      console.warn('[RealtimeLive] Using mock devices:', error);
      setDevices(MOCK_DEVICES);
      setUseMockData(true);
      if (selectedDevices.length === 0) {
        setSelectedDevices([MOCK_DEVICES[0].id]);
      }
    } finally {
      setDevicesLoading(false);
    }
  }, [selectedDevices.length]);

  // 获取实时数据
  const fetchRealtimeData = useCallback(async (deviceId: string) => {
    if (useMockData) return null;
    
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device?.collectorId) return null;
      
      const result = await api.data.getRealtime(device.collectorId);
      if (result.success && result.data) {
        return result.data.data || [];
      }
      return null;
    } catch (error) {
      console.warn(`[RealtimeLive] Failed to fetch data for ${deviceId}:`, error);
      return null;
    }
  }, [devices, useMockData]);

  // 初始化：获取设备列表
  useEffect(() => {
    fetchCollectors();
  }, [fetchCollectors]);

  // 定时刷新数据
  useEffect(() => {
    if (isPaused || selectedDevices.length === 0) return;
    
    const interval = setInterval(async () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false });
      
      const newPoint: any = { time: timeStr, fullTime: now.toISOString() };
      
      if (useMockData) {
        // 使用模拟数据生成
        selectedDevices.forEach(devId => {
          const base = now.getTime() / 1000;
          const offset = parseInt(devId.split('_')[1]) || 0;
          newPoint[`${devId}.current`] = Number((10 + Math.sin(base + offset) * 5 + Math.random()).toFixed(2));
          newPoint[`${devId}.voltage`] = Number((220 + Math.cos(base * 0.5) * 10 + Math.random() * 2).toFixed(1));
          newPoint[`${devId}.temp`] = Number((45 + Math.sin(base * 0.2) * 15).toFixed(1));
          const rand = Math.random();
          newPoint[`${devId}.status_val`] = rand > 0.1 ? 2 : rand > 0.05 ? 1 : 0;
          newPoint[`${devId}.status_txt`] = rand > 0.1 ? 'OK' : rand > 0.05 ? 'WARN' : 'ERR';
        });
      } else {
        // 尝试从后端获取数据
        for (const devId of selectedDevices) {
          const backendData = await fetchRealtimeData(devId);
          
          if (backendData && backendData.length > 0) {
            // 使用后端数据
            const latestPoint = backendData[backendData.length - 1];
            newPoint[`${devId}.current`] = latestPoint.value || 0;
            newPoint[`${devId}.voltage`] = 220 + Math.random() * 10; // 如果没有电压数据
            newPoint[`${devId}.temp`] = 45 + Math.random() * 15; // 如果没有温度数据
            newPoint[`${devId}.status_val`] = latestPoint.quality === 'good' ? 2 : 1;
            newPoint[`${devId}.status_txt`] = latestPoint.quality === 'good' ? 'OK' : 'WARN';
            
            // 更新实时数据缓存
            setRealtimeData(prev => ({
              ...prev,
              [devId]: backendData
            }));
          } else {
            // 后端没有数据，使用模拟数据作为后备
            const base = now.getTime() / 1000;
            const offset = parseInt(devId.split('_')[1]) || 0;
            newPoint[`${devId}.current`] = Number((10 + Math.sin(base + offset) * 5 + Math.random()).toFixed(2));
            newPoint[`${devId}.voltage`] = Number((220 + Math.cos(base * 0.5) * 10 + Math.random() * 2).toFixed(1));
            newPoint[`${devId}.temp`] = Number((45 + Math.sin(base * 0.2) * 15).toFixed(1));
            const rand = Math.random();
            newPoint[`${devId}.status_val`] = rand > 0.1 ? 2 : rand > 0.05 ? 1 : 0;
            newPoint[`${devId}.status_txt`] = rand > 0.1 ? 'OK' : rand > 0.05 ? 'WARN' : 'ERR';
          }
        }
      }
      
      setDataPoints(prev => [...prev, newPoint].slice(-maxPoints));
    }, refreshRate);
    
    return () => clearInterval(interval);
  }, [refreshRate, isPaused, selectedDevices, useMockData, fetchRealtimeData]);

  const toggleDevice = (id: string) => {
    setSelectedDevices(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const toggleField = (fieldKey: string) => {
    setVisibleFields(prev => prev.includes(fieldKey) ? prev.filter(f => f !== f) : [...prev, fieldKey]);
  };

  const filteredDevices = devices.filter(d => d.name.toLowerCase().includes(deviceSearch.toLowerCase()));

  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    color: isDark ? '#f3f4f6' : '#1f2937',
    fontSize: '12px'
  };

  const chartGridColor = isDark ? '#374151' : '#e5e7eb';
  const chartAxisColor = isDark ? '#9ca3af' : '#6b7280';

  const getBgClass = () => isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const getSubBgClass = () => isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-100 border-gray-300';
  const getTextClass = () => isDark ? 'text-gray-200' : 'text-gray-700';
  const getSubTextClass = () => isDark ? 'text-gray-400' : 'text-gray-500';
  const getBorderClass = () => isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-in fade-in duration-300">
      <div className={"w-72 rounded-xl border flex flex-col shrink-0 overflow-hidden " + getBgClass()}>
        <div className={"p-4 border-b space-y-3 " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
          <div className="space-y-1">
            <label className={("text-xs uppercase font-bold flex items-center ") + getSubTextClass()}>
              <Server className="w-3 h-3 mr-1" /> {t('realtime.dataSource', 'Data Source')}
            </label>
            <select className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}>
              <option value="backend">Backend API (Live)</option>
              <option value="mock">Mock Data</option>
            </select>
          </div>
          {useMockData && (
            <div className={"text-xs px-2 py-1 rounded " + (isDark ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-700")}>
              {t('realtime.usingMockData', 'Using mock data - backend unavailable')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={("text-xs uppercase font-bold flex items-center ") + getSubTextClass()}>
                <Database className="w-3 h-3 mr-1" /> DB
              </label>
              <select className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}>
                <option>power_db</option>
                <option>test_db</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={("text-xs uppercase font-bold flex items-center ") + getSubTextClass()}>
                <Table className="w-3 h-3 mr-1" /> Table
              </label>
              <select className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}>
                <option>meters</option>
                <option>sensors</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className={"p-3 border-b " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <div className="relative">
              <Search className={("absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ") + (isDark ? "text-gray-500" : "text-gray-400")} />
              <input 
                type="text" 
                placeholder={t('realtime.searchDevices', 'Search devices...')}
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className={"w-full border rounded pl-7 pr-2 py-1.5 text-xs outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200 focus:border-blue-500" : "bg-white border-gray-300 text-gray-700 focus:border-blue-500")}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className={("text-xs font-medium ") + getSubTextClass()}>{t('realtime.selectDevices', 'Select Devices for Compare')}</span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                {selectedDevices.length} {t('realtime.selected', 'Selected')}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {devicesLoading ? (
              <div className={"flex items-center justify-center h-20 " + getSubTextClass()}>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                {t('realtime.loading', 'Loading...')}
              </div>
            ) : (
              filteredDevices.map(device => {
                const isSelected = selectedDevices.includes(device.id);
                const itemBg = isSelected 
                  ? (isDark ? 'bg-blue-600/10 border-blue-500/50' : 'bg-blue-50 border-blue-200')
                  : ('border-transparent ' + (isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'));
                const checkClass = isSelected 
                  ? 'bg-blue-600 border-blue-500' 
                  : (isDark ? 'border-gray-500 bg-gray-800' : 'border-gray-300 bg-white');
                const textClass = isSelected 
                  ? (isDark ? 'text-blue-200' : 'text-blue-700') 
                  : (isDark ? 'text-gray-300' : 'text-gray-700');
                return (
                  <div
                    key={device.id}
                    onClick={() => toggleDevice(device.id)}
                    className={"flex items-center justify-between p-2 rounded cursor-pointer border transition-all " + itemBg}
                  >
                    <div className="flex items-center gap-2">
                      <div className={"w-4 h-4 rounded border flex items-center justify-center transition-colors " + checkClass}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <div className={"text-sm font-medium " + textClass}>{device.name}</div>
                        <div className={"text-[10px] " + (isDark ? 'text-gray-500' : 'text-gray-400')}>{device.group} • {device.id}</div>
                      </div>
                    </div>
                    <div className={"w-2 h-2 rounded-full " + (device.status === 'Online' ? 'bg-green-500' : (isDark ? 'bg-gray-600' : 'bg-gray-400'))}></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className={"p-3 rounded-xl border flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm " + getBgClass()}>
          <div className="flex items-center gap-4">
            <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
              {[1000, 5000, 10000].map(rate => (
                <button
                  key={rate}
                  onClick={() => setRefreshRate(rate as any)}
                  className={"px-3 py-1 text-xs font-medium rounded transition-colors " + (refreshRate === rate 
                    ? (isDark ? 'bg-gray-700 text-white shadow' : 'bg-white text-gray-900 shadow')
                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'))}
                >
                  {rate / 1000}s
                </button>
              ))}
            </div>

            <div className={"h-6 w-px " + (isDark ? 'bg-gray-700' : 'bg-gray-300')}></div>

            <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
              <button onClick={() => setChartType('line')} className={"p-1.5 rounded " + (chartType === 'line' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.lineChart', 'Line Chart')}><TrendingUp className="w-4 h-4"/></button>
              <button onClick={() => setChartType('bar')} className={"p-1.5 rounded " + (chartType === 'bar' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.barChart', 'Bar Chart')}><BarChart2 className="w-4 h-4"/></button>
              <button onClick={() => setChartType('status')} className={"p-1.5 rounded " + (chartType === 'status' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.statusTimeline', 'Status Timeline')}><GitCommit className="w-4 h-4"/></button>
            </div>

            <div className={"h-6 w-px " + (isDark ? 'bg-gray-700' : 'bg-gray-300')}></div>

            <div className="flex items-center gap-2">
              {FIELDS.map(f => (
                f.key !== 'status_val' && (
                  <button 
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={"flex items-center px-2 py-1 rounded text-xs border transition-colors " + (
                      visibleFields.includes(f.key) 
                        ? (isDark ? 'text-gray-200' : 'text-gray-700')
                        : (isDark ? 'bg-gray-800 border-gray-600 text-gray-500 opacity-60' : 'bg-gray-100 border-gray-300 text-gray-400 opacity-60'))}
                    style={visibleFields.includes(f.key) ? { borderColor: f.color, backgroundColor: isDark ? f.color + '20' : f.color + '15' } : {}}
                  >
                    <f.icon className="w-3 h-3 mr-1.5" style={{ color: visibleFields.includes(f.key) ? f.color : undefined }} />
                    {f.label}
                  </button>
                )
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={"flex items-center gap-2 text-xs px-3 py-1.5 rounded border " + (isDark ? 'text-gray-400 bg-gray-900 border-gray-700' : 'text-gray-500 bg-gray-100 border-gray-300')}>
              <span className={"w-2 h-2 rounded-full " + (isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse')}></span>
              {isPaused ? t('realtime.paused', 'Paused') : t('realtime.liveStreaming', 'Live Streaming')}
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

        <div className={"flex-1 min-h-[350px] rounded-xl border p-4 relative overflow-hidden flex flex-col " + getBgClass()}>
          {selectedDevices.length === 0 ? (
            <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
              <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
              <p>{t('realtime.selectDeviceHint', 'Select a device from the left to view real-time data.')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis dataKey="time" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ padding: 0 }} />
                  <Legend />
                  {selectedDevices.map(devId => visibleFields.map(field => (
                    <Bar 
                      key={`${devId}-${field}`}
                      dataKey={`${devId}.${field}`}
                      name={`${devices.find(d => d.id === devId)?.name || devId} ${field}`}
                      fill={FIELDS.find(f => f.key === field)?.color}
                      opacity={0.8}
                      radius={[2, 2, 0, 0]}
                    />
                  )))}
                </BarChart>
              ) : chartType === 'status' ? (
                <LineChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis dataKey="time" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={v => v === 2 ? 'OK' : v === 1 ? 'WARN' : 'ERR'} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {selectedDevices.map((devId, i) => (
                    <Line 
                      key={`${devId}-status`}
                      type="stepAfter"
                      dataKey={`${devId}.status_val`}
                      name={`${devices.find(d => d.id === devId)?.name || devId} Status`}
                      stroke={`hsl(${i * 60}, 70%, 50%)`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis dataKey="time" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {selectedDevices.map((devId, i) => visibleFields.map(field => {
                    const baseColor = FIELDS.find(f => f.key === field)?.color || '#fff';
                    return (
                      <Line 
                        key={`${devId}-${field}`}
                        type="monotone"
                        dataKey={`${devId}.${field}`}
                        name={`${devices.find(d => d.id === devId)?.name || devId} ${field}`}
                        stroke={baseColor}
                        strokeWidth={2}
                        strokeDasharray={selectedDevices.length > 1 && i > 0 ? (i === 1 ? '5 5' : '3 3') : ''}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    );
                  }))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div className={"h-64 rounded-xl border flex flex-col overflow-hidden shrink-0 " + getBgClass()}>
          <div className={"px-4 py-2 border-b flex justify-between items-center " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <h3 className={"text-xs font-bold uppercase " + getSubTextClass()}>{t('realtime.liveDataFeed', 'Live Data Feed')}</h3>
            <button onClick={() => setDataPoints([])} className={("text-[10px] flex items-center ") + (isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
              <RefreshCw className="w-3 h-3 mr-1" /> {t('realtime.clearBuffer', 'Clear Buffer')}
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className={"font-medium sticky top-0 z-10 " + (isDark ? "bg-gray-800 text-gray-500" : "bg-gray-50 text-gray-500")}>
                <tr>
                  <th className={"p-3 border-b w-32 " + getBorderClass()}>Timestamp</th>
                  <th className={"p-3 border-b w-32 " + getBorderClass()}>Device</th>
                  {FIELDS.map(f => (
                    <th key={f.key} className={"p-3 border-b " + getBorderClass()} style={{color: f.color}}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={"divide-y font-mono " + (isDark ? "divide-gray-700" : "divide-gray-200")}>
                {[...dataPoints].reverse().map((pt, idx) => selectedDevices.map(devId => (
                  <tr key={`${idx}-${devId}`} className={isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-50"}>
                    <td className={"p-2 pl-3 " + (isDark ? "text-gray-400" : "text-gray-500")}>{pt.time}</td>
                    <td className={"p-2 " + (isDark ? "text-blue-200" : "text-blue-600")}>{devices.find(d => d.id === devId)?.name || devId}</td>
                    <td className="p-2">{pt[`${devId}.current`]}</td>
                    <td className="p-2">{pt[`${devId}.voltage`]}</td>
                    <td className="p-2">{pt[`${devId}.temp`]}</td>
                    <td className="p-2">
                      <span className={"px-1.5 py-0.5 rounded text-[10px] font-bold " + (
                        pt[`${devId}.status_txt`] === 'OK' ? 'bg-green-500/20 text-green-400' :
                        pt[`${devId}.status_txt`] === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400')}
                      >
                        {pt[`${devId}.status_txt`]}
                      </span>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeLive;
