
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { 
  Search, ChevronRight, ChevronDown, Factory, Warehouse, Cpu, 
  Activity, Thermometer, Zap, Gauge, Clock, Tag, Settings, 
  MoreVertical, RefreshCw, AlertTriangle, CheckCircle, Wifi
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- Types ---
interface DeviceNode {
  id: string;
  name: string;
  type: 'FACTORY' | 'WORKSHOP' | 'DEVICE';
  status?: 'ONLINE' | 'OFFLINE' | 'WARNING';
  children?: DeviceNode[];
  // Device specific data
  model?: string;
  tags?: Record<string, string>;
}

// --- Mock Data ---
const MOCK_HIERARCHY: DeviceNode[] = [
  {
    id: 'f_1',
    name: 'Shanghai Gigafactory',
    type: 'FACTORY',
    children: [
      {
        id: 'ws_1_a',
        name: 'Assembly Shop A',
        type: 'WORKSHOP',
        children: [
          { id: 'd_101', name: 'Robotic Arm #101', type: 'DEVICE', status: 'ONLINE', model: 'KUKA-KR6', tags: { ip: '192.168.1.50', firmware: 'v2.1', install_date: '2022-05-12' } },
          { id: 'd_102', name: 'Robotic Arm #102', type: 'DEVICE', status: 'WARNING', model: 'KUKA-KR6', tags: { ip: '192.168.1.51', firmware: 'v2.0', install_date: '2022-05-12' } },
          { id: 'd_103', name: 'Conveyor Belt Main', type: 'DEVICE', status: 'ONLINE', model: 'Siemens-S7', tags: { ip: '192.168.1.60', firmware: 'v4.5', install_date: '2021-11-30' } },
        ]
      },
      {
        id: 'ws_1_b',
        name: 'Paint Shop B',
        type: 'WORKSHOP',
        children: [
          { id: 'd_201', name: 'Sprayer Unit Alpha', type: 'DEVICE', status: 'OFFLINE', model: 'ABB-IRB', tags: { ip: '192.168.2.10', firmware: 'v1.2', install_date: '2023-01-15' } },
          { id: 'd_202', name: 'Drying Oven Controller', type: 'DEVICE', status: 'ONLINE', model: 'Honeywell-HC', tags: { ip: '192.168.2.20', firmware: 'v3.0', install_date: '2023-02-01' } },
        ]
      }
    ]
  },
  {
    id: 'f_2',
    name: 'Austin Plant',
    type: 'FACTORY',
    children: [
      {
        id: 'ws_2_c',
        name: 'Battery Assembly',
        type: 'WORKSHOP',
        children: Array.from({ length: 5 }).map((_, i) => ({
            id: `d_austin_${i}`,
            name: `Cell Welder #${i+1}`,
            type: 'DEVICE',
            status: Math.random() > 0.8 ? 'WARNING' : 'ONLINE',
            model: 'Fanuc-M20',
            tags: { region: 'US-South', lane: `Lane-${i%2}` }
        }))
      }
    ]
  }
];

// --- Components ---

const StatusBadge = ({ status, isDark }: { status?: string; isDark: boolean }) => {
    const baseClasses = "flex items-center text-xs font-bold px-2 py-0.5 rounded border";
    
    if (status === 'ONLINE') {
        return (
            <span className={`${baseClasses} ${
                isDark 
                    ? 'text-green-400 bg-green-500/10 border-green-500/20' 
                    : 'text-green-600 bg-green-50 border-green-200'
            }`}>
                <Wifi className="w-3 h-3 mr-1" /> Online
            </span>
        );
    }
    if (status === 'WARNING') {
        return (
            <span className={`${baseClasses} ${
                isDark 
                    ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' 
                    : 'text-yellow-600 bg-yellow-50 border-yellow-200'
            }`}>
                <AlertTriangle className="w-3 h-3 mr-1" /> Warning
            </span>
        );
    }
    return (
        <span className={`${baseClasses} ${
            isDark 
                ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                : 'text-red-600 bg-red-50 border-red-200'
        }`}>
            <Wifi className="w-3 h-3 mr-1" /> Offline
        </span>
    );
};

const MetricCard = ({ 
    label, 
    value, 
    unit, 
    icon: Icon, 
    color, 
    history, 
    isDark 
}: { 
    label: string, 
    value: string, 
    unit: string, 
    icon: any, 
    color: string, 
    history: number[],
    isDark: boolean
}) => {
    // Mini sparkline data
    const data = history.map((val, i) => ({ i, val }));
    
    return (
        <div className={`rounded-xl border p-4 flex flex-col justify-between h-32 relative overflow-hidden group transition-colors ${
            isDark 
                ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
        }`}>
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-1 flex items-center ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                        <Icon className={`w-3.5 h-3.5 mr-1.5 ${color}`} /> {label}
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {value}
                        </span>
                        <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {unit}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Sparkline Background */}
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 group-hover:opacity-30 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <Area type="monotone" dataKey="val" stroke={color.replace('text-', '')} fill="currentColor" className={color} strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const RealtimeDevices: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [expandedNodes, setExpandedNodes] = useState<string[]>(['f_1', 'ws_1_a']);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('d_101');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'tags'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time Data State
  const [liveData, setLiveData] = useState({
      temp: 0,
      speed: 0,
      vibration: 0,
      power: 0,
      history: { temp: [], speed: [], vibration: [], power: [] } as Record<string, number[]>
  });

  // Flatten tree for searching
  const flattenNodes = (nodes: DeviceNode[]): DeviceNode[] => {
      let flat: DeviceNode[] = [];
      nodes.forEach(n => {
          flat.push(n);
          if (n.children) flat = flat.concat(flattenNodes(n.children));
      });
      return flat;
  };
  
  const allNodes = useMemo(() => flattenNodes(MOCK_HIERARCHY), []);
  const selectedNode = allNodes.find(n => n.id === selectedNodeId);

  // Simulation Effect
  useEffect(() => {
      // Reset history on node change
      setLiveData(prev => ({ ...prev, history: { temp: [], speed: [], vibration: [], power: [] } }));

      const interval = setInterval(() => {
          if (!selectedNode || selectedNode.type !== 'DEVICE') return;

          const now = new Date();
          const time = now.toLocaleTimeString();
          
          const newTemp = 40 + Math.random() * 20;
          const newSpeed = 1200 + Math.random() * 300;
          const newVib = Math.random() * 0.5;
          const newPower = 220 + Math.random() * 10;

          setLiveData(prev => {
              const updateHistory = (arr: any[], val: any) => [...arr.slice(-19), { time, val }]; // Keep last 20 points
              const updateScalarHistory = (arr: number[], val: number) => [...arr.slice(-19), val];

              return {
                  temp: newTemp,
                  speed: newSpeed,
                  vibration: newVib,
                  power: newPower,
                  history: {
                      temp: updateScalarHistory(prev.history.temp, newTemp),
                      speed: updateScalarHistory(prev.history.speed, newSpeed),
                      vibration: updateScalarHistory(prev.history.vibration, newVib),
                      power: updateScalarHistory(prev.history.power, newPower),
                      chart: updateHistory((prev.history as any).chart || [], { temp: newTemp, speed: newSpeed, vibration: newVib })
                  }
              };
          });
      }, 1000);

      return () => clearInterval(interval);
  }, [selectedNodeId]);

  const toggleExpand = (id: string) => {
      setExpandedNodes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const renderTree = (nodes: DeviceNode[], level = 0) => {
      return nodes.map(node => {
          if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase()) && node.type === 'DEVICE') return null;
          
          const isExpanded = expandedNodes.includes(node.id);
          const hasChildren = node.children && node.children.length > 0;
          const isSelected = selectedNodeId === node.id;

          const Icon = node.type === 'FACTORY' ? Factory : node.type === 'WORKSHOP' ? Warehouse : Cpu;
          const colorClass = node.type === 'FACTORY' 
              ? (isDark ? 'text-blue-400' : 'text-blue-600')
              : node.type === 'WORKSHOP' 
                  ? (isDark ? 'text-purple-400' : 'text-purple-600')
                  : (isDark ? 'text-green-400' : 'text-green-600');

          return (
              <div key={node.id}>
                  <div 
                      className={`flex items-center py-1.5 px-2 cursor-pointer text-sm transition-colors border-l-2 ${
                          isSelected 
                          ? (isDark 
                              ? 'bg-blue-600/20 text-blue-100 border-blue-500' 
                              : 'bg-blue-50 text-blue-900 border-blue-500')
                          : (isDark 
                              ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-transparent'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-transparent')
                      }`}
                      style={{ paddingLeft: `${level * 12 + 8}px` }}
                      onClick={() => {
                          if (hasChildren) toggleExpand(node.id);
                          if (node.type === 'DEVICE') setSelectedNodeId(node.id);
                      }}
                  >
                      <span className={`mr-1 w-4 flex justify-center ${isDark ? 'opacity-70' : 'opacity-60'}`}>
                          {hasChildren && (
                              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                          )}
                      </span>
                      <Icon className={`w-4 h-4 mr-2 ${colorClass}`} />
                      <span className="truncate">{node.name}</span>
                      {node.status && (
                          <div className={`ml-auto w-2 h-2 rounded-full ${
                              node.status === 'ONLINE' 
                                  ? 'bg-green-500' 
                                  : node.status === 'WARNING' 
                                      ? 'bg-yellow-500' 
                                      : 'bg-red-500'
                          }`}></div>
                      )}
                  </div>
                  {isExpanded && node.children && (
                      <div>{renderTree(node.children, level + 1)}</div>
                  )}
              </div>
          );
      });
  };

  // Chart theme colors
  const chartColors = {
      grid: isDark ? '#374151' : '#e5e7eb',
      axis: isDark ? '#6b7280' : '#9ca3af',
      tooltipBg: isDark ? '#1f2937' : '#ffffff',
      tooltipBorder: isDark ? '#374151' : '#e5e7eb',
      tooltipText: isDark ? '#f3f4f6' : '#1f2937',
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
        {/* Sidebar */}
        <div className={`w-72 rounded-xl border flex flex-col overflow-hidden shrink-0 ${
            isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200 shadow-sm'
        }`}>
            <div className={`p-3 border-b ${
                isDark 
                    ? 'border-gray-700 bg-gray-750' 
                    : 'border-gray-200 bg-gray-50'
            }`}>
                <div className="relative">
                    <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('Filter assets...') || "Filter assets..."} 
                        className={`w-full border rounded pl-7 pr-2 py-1.5 text-xs outline-none transition-colors ${
                            isDark 
                                ? 'bg-gray-900 border-gray-600 text-gray-200 focus:border-blue-500' 
                                : 'bg-white border-gray-300 text-gray-700 focus:border-blue-500'
                        }`}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {renderTree(MOCK_HIERARCHY)}
            </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 rounded-xl border flex flex-col overflow-hidden min-w-0 ${
            isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200 shadow-sm'
        }`}>
            {selectedNode && selectedNode.type === 'DEVICE' ? (
                <>
                    {/* Header */}
                    <div className={`px-6 py-4 border-b shrink-0 ${
                        isDark 
                            ? 'border-gray-700 bg-gray-750' 
                            : 'border-gray-200 bg-gray-50'
                    }`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className={`flex items-center gap-2 text-xs mb-1 ${
                                    isDark ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                    <Factory className="w-3 h-3" /> {t('Factory')}
                                    <ChevronRight className="w-3 h-3" />
                                    <Warehouse className="w-3 h-3" /> {t('Workshop')}
                                </div>
                                <h2 className={`text-2xl font-bold flex items-center gap-3 ${
                                    isDark ? 'text-gray-100' : 'text-gray-900'
                                }`}>
                                    {selectedNode.name}
                                    <StatusBadge status={selectedNode.status} isDark={isDark} />
                                </h2>
                                <p className={`text-sm mt-1 font-mono ${
                                    isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                    ID: {selectedNode.id} • {t('Model')}: {selectedNode.model}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button className={`p-2 rounded-lg transition-colors ${
                                    isDark 
                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                }`} title="Settings">
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button className={`p-2 rounded-lg transition-colors ${
                                    isDark 
                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                }`}>
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={`flex border-b px-6 gap-6 shrink-0 ${
                        isDark 
                            ? 'border-gray-700 bg-gray-800' 
                            : 'border-gray-200 bg-white'
                    }`}>
                        <button 
                            onClick={() => setActiveTab('overview')} 
                            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                                activeTab === 'overview' 
                                    ? 'border-blue-500 text-blue-500' 
                                    : (isDark 
                                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                                        : 'border-transparent text-gray-500 hover:text-gray-700')
                            }`}
                        >
                            <Gauge className="w-4 h-4 mr-2" /> {t('Overview')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('trends')} 
                            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                                activeTab === 'trends' 
                                    ? 'border-blue-500 text-blue-500' 
                                    : (isDark 
                                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                                        : 'border-transparent text-gray-500 hover:text-gray-700')
                            }`}
                        >
                            <Activity className="w-4 h-4 mr-2" /> {t('Live Trends')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('tags')} 
                            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${
                                activeTab === 'tags' 
                                    ? 'border-blue-500 text-blue-500' 
                                    : (isDark 
                                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                                        : 'border-transparent text-gray-500 hover:text-gray-700')
                            }`}
                        >
                            <Tag className="w-4 h-4 mr-2" /> {t('Attributes')}
                        </button>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 overflow-y-auto p-6 ${
                        isDark ? 'bg-[#0B1120]' : 'bg-gray-50'
                    }`}>
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricCard 
                                        label={t('Temperature') || "Temperature"} 
                                        value={liveData.temp.toFixed(1)} 
                                        unit="°C" 
                                        icon={Thermometer} 
                                        color="text-red-400" 
                                        history={liveData.history.temp}
                                        isDark={isDark}
                                    />
                                    <MetricCard 
                                        label={t('Motor Speed') || "Motor Speed"} 
                                        value={liveData.speed.toFixed(0)} 
                                        unit="RPM" 
                                        icon={RefreshCw} 
                                        color="text-blue-400" 
                                        history={liveData.history.speed}
                                        isDark={isDark}
                                    />
                                    <MetricCard 
                                        label={t('Vibration') || "Vibration"} 
                                        value={liveData.vibration.toFixed(3)} 
                                        unit="G" 
                                        icon={Activity} 
                                        color="text-yellow-400" 
                                        history={liveData.history.vibration}
                                        isDark={isDark}
                                    />
                                    <MetricCard 
                                        label={t('Power Input') || "Power Input"} 
                                        value={liveData.power.toFixed(1)} 
                                        unit="V" 
                                        icon={Zap} 
                                        color="text-purple-400" 
                                        history={liveData.history.power}
                                        isDark={isDark}
                                    />
                                </div>

                                <div className={`rounded-xl border p-6 ${
                                    isDark 
                                        ? 'bg-gray-800 border-gray-700' 
                                        : 'bg-white border-gray-200 shadow-sm'
                                }`}>
                                    <h3 className={`font-bold mb-4 flex items-center ${
                                        isDark ? 'text-gray-200' : 'text-gray-800'
                                    }`}>
                                        <Activity className="w-4 h-4 mr-2 text-green-400" /> {t('Real-time Performance')}
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={(liveData.history as any).chart || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                                                <XAxis dataKey="time" stroke={chartColors.axis} fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        backgroundColor: chartColors.tooltipBg, 
                                                        borderColor: chartColors.tooltipBorder, 
                                                        color: chartColors.tooltipText 
                                                    }} 
                                                />
                                                <Line type="monotone" dataKey="val.temp" name="Temp" stroke="#f87171" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="val.vibration" name="Vibration" stroke="#facc15" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'trends' && (
                            <div className={`rounded-xl border p-6 h-full flex flex-col ${
                                isDark 
                                    ? 'bg-gray-800 border-gray-700' 
                                    : 'bg-white border-gray-200 shadow-sm'
                            }`}>
                                <div className="flex justify-between mb-4">
                                    <h3 className={`font-bold ${
                                        isDark ? 'text-gray-200' : 'text-gray-800'
                                    }`}>{t('Historical Trends (1 Hour)')}</h3>
                                    <select className={`border rounded px-3 py-1 text-sm outline-none ${
                                        isDark 
                                            ? 'bg-gray-900 border-gray-600 text-gray-200' 
                                            : 'bg-white border-gray-300 text-gray-700'
                                    }`}>
                                        <option>{t('All Metrics')}</option>
                                        <option>{t('Temperature Only')}</option>
                                        <option>{t('Speed Only')}</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={(liveData.history as any).chart || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                            <XAxis dataKey="time" stroke={chartColors.axis} fontSize={12} />
                                            <YAxis stroke={chartColors.axis} fontSize={12} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: chartColors.tooltipBg, 
                                                    borderColor: chartColors.tooltipBorder, 
                                                    color: chartColors.tooltipText 
                                                }} 
                                            />
                                            <Line type="monotone" dataKey="val.speed" name="Speed" stroke="#60a5fa" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="val.power" name="Power" stroke="#c084fc" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tags' && (
                            <div className={`rounded-xl border overflow-hidden ${
                                isDark 
                                    ? 'bg-gray-800 border-gray-700' 
                                    : 'bg-white border-gray-200 shadow-sm'
                            }`}>
                                <table className="w-full text-left text-sm">
                                    <thead className={`font-medium ${
                                        isDark 
                                            ? 'bg-gray-750 text-gray-400' 
                                            : 'bg-gray-50 text-gray-600'
                                    }`}>
                                        <tr>
                                            <th className={`p-4 border-b ${
                                                isDark ? 'border-gray-700' : 'border-gray-200'
                                            }`}>{t('Tag Name')}</th>
                                            <th className={`p-4 border-b ${
                                                isDark ? 'border-gray-700' : 'border-gray-200'
                                            }`}>{t('Value')}</th>
                                            <th className={`p-4 border-b text-right ${
                                                isDark ? 'border-gray-700' : 'border-gray-200'
                                            }`}>{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${
                                        isDark ? 'divide-gray-700' : 'divide-gray-200'
                                    }`}>
                                        {Object.entries(selectedNode.tags || {}).map(([key, val]) => (
                                            <tr key={key} className={
                                                isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                            }>
                                                <td className={`p-4 font-mono ${
                                                    isDark ? 'text-blue-300' : 'text-blue-600'
                                                }`}>{key}</td>
                                                <td className={`p-4 ${
                                                    isDark ? 'text-gray-200' : 'text-gray-700'
                                                }`}>{val}</td>
                                                <td className="p-4 text-right">
                                                    <button className={`text-xs transition-colors ${
                                                        isDark 
                                                            ? 'text-gray-500 hover:text-blue-400' 
                                                            : 'text-gray-400 hover:text-blue-600'
                                                    }`}>
                                                        {t('Edit')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className={`flex flex-col items-center justify-center h-full ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                    <Cpu className="w-16 h-16 mb-4 opacity-20" />
                    <p className={`text-lg font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{t('Select a Device')}</p>
                    <p className="text-xs mt-1">
                        {t('Choose a device from the hierarchy to view live telemetry.')}
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};
