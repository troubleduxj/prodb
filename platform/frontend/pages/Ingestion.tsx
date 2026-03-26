import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { MOCK_DATA_SOURCES, MOCK_PLUGINS } from '../constants';
import { Plus, Wifi, WifiOff, AlertTriangle, Box, Settings, CheckCircle, ChevronRight, X, GitMerge, Radio, Pause, Play, Trash2, Download, FileJson, Binary, Search, ArrowDown } from 'lucide-react';
import * as Icons from 'lucide-react';
import { DataSource } from '../types';
import { DynamicForm } from '../components/DynamicForm';
import { Page } from '../types';

const IconComponent = ({ name, className }: { name: string, className?: string }) => {
  const Icon = (Icons as any)[name] || Box;
  return <Icon className={className} />;
};

interface Packet {
  id: number;
  ts: string;
  direction: 'IN' | 'OUT';
  protocol: string;
  size: number;
  payload: any;
  rawHex: string;
  info: string;
}

const LiveTapModal = ({ source, onClose }: { source: DataSource; onClose: () => void }) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [filter, setFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const packetIdCounter = useRef(1);

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [packets, isPaused]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const id = packetIdCounter.current++;
      const now = new Date();
      const ts = now.toISOString().split('T')[1].slice(0, -1);
      
      let protocol = 'TCP';
      let payload: any = {};
      let info = '';
      let rawHex = '';

      if (source.type.includes('MQTT')) {
          protocol = 'MQTT';
          const topics = ['factory/line1/temp', 'factory/line1/speed', 'sys/alerts'];
          const topic = topics[Math.floor(Math.random() * topics.length)];
          payload = { 
            topic, 
            qos: 1, 
            payload: { value: (Math.random() * 100).toFixed(2), ts: Date.now() } 
          };
          info = `PUBLISH [${topic}] (${JSON.stringify(payload.payload).length} bytes)`;
      } else if (source.type.includes('Kafka')) {
          protocol = 'Kafka';
          const offset = Math.floor(Math.random() * 1000000);
          payload = { 
            partition: 0, 
            offset, 
            key: `k-${id}`, 
            value: { vin: `VH_${Math.floor(Math.random()*500)}`, speed: Math.floor(Math.random()*120) } 
          };
          info = `Message: Partition 0, Offset ${offset}`;
      } else if (source.type.includes('HTTP')) {
          protocol = 'HTTP';
          payload = { 
            method: 'POST', 
            path: '/api/v1/telemetry', 
            headers: { 'Content-Type': 'application/json' },
            body: { temp: 24.5, humidity: 60 } 
          };
          info = 'POST /api/v1/telemetry 200 OK';
      } else {
          protocol = 'TCP';
          payload = { raw: 'binary_data', flags: [0x02, 0x10] };
          info = `Len: ${Math.floor(Math.random() * 100)}`;
      }

      const jsonStr = JSON.stringify(payload);
      rawHex = Array.from(jsonStr).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ').toUpperCase();
      if (rawHex.length > 100) rawHex = rawHex.substring(0, 100) + ' ...';

      const newPacket: Packet = {
          id,
          ts,
          direction: Math.random() > 0.1 ? 'IN' : 'OUT',
          protocol,
          size: jsonStr.length + 20,
          payload,
          rawHex,
          info
      };

      setPackets(prev => {
          const next = [...prev, newPacket];
          if (next.length > 100) return next.slice(next.length - 100);
          return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isPaused, source.type]);

  const filteredPackets = packets.filter(p => 
      p.info.toLowerCase().includes(filter.toLowerCase()) || 
      JSON.stringify(p.payload).toLowerCase().includes(filter.toLowerCase())
  );

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className={`${isDark ? 'bg-[#0a0a0a] border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-700'} rounded-xl border w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-sm`}>
            <div className={`flex items-center justify-between p-3 border-b ${isDark ? 'border-gray-800 bg-[#111]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        <span className="font-bold text-base">{t('ingestion.liveTap', 'Live Tap')}</span>
                    </div>
                    <div className={`h-4 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                    <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span className="text-blue-400 font-bold">{source.name}</span>
                        <span>•</span>
                        <span>{source.type}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="relative mr-2">
                        <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input 
                            type="text" 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder={t('ingestion.filterPackets', 'Filter packets...')}
                            className={`${isDark ? 'bg-gray-900 border-gray-700 text-gray-300 focus:border-blue-500' : 'bg-gray-100 border-gray-300 text-gray-700 focus:border-blue-500'} border rounded text-xs pl-7 pr-2 py-1 outline-none w-48`}
                        />
                    </div>
                    <button 
                        onClick={() => setPackets([])}
                        className={`p-1.5 ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'} rounded transition-colors`}
                        title={t('common.clear', 'Clear')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 transition-colors ${isPaused ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900'}`}
                    >
                        {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                        {isPaused ? t('common.resume', 'Resume') : t('common.pause', 'Pause')}
                    </button>
                    <div className={`h-4 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-300'} mx-1`}></div>
                    <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className={`flex-1 overflow-auto ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`} ref={scrollRef}>
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className={`sticky top-0 ${isDark ? 'bg-[#161616] text-gray-500' : 'bg-gray-100 text-gray-600'} font-medium z-10`}>
                            <tr>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} w-16`}>No.</th>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} w-24`}>Time</th>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} w-16 text-center`}>Dir</th>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} w-20`}>Protocol</th>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} w-16 text-right`}>Len</th>
                                <th className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>Info</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-800/50' : 'divide-gray-200'}`}>
                            {filteredPackets.map((p) => (
                                <tr 
                                    key={p.id} 
                                    onClick={() => setSelectedPacket(p)}
                                    className={`cursor-pointer transition-colors hover:${isDark ? 'bg-gray-800' : 'bg-gray-100'} ${
                                        selectedPacket?.id === p.id 
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-100' 
                                        : isDark ? 'text-gray-400' : 'text-gray-600'
                                    }`}
                                >
                                    <td className={`p-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{p.id}</td>
                                    <td className="p-2">{p.ts}</td>
                                    <td className="p-2 text-center">
                                        {p.direction === 'IN' ? (
                                            <span className="text-green-500 font-bold">IN</span>
                                        ) : (
                                            <span className="text-blue-500 font-bold">OUT</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-purple-400">{p.protocol}</td>
                                    <td className="p-2 text-right font-mono">{p.size}</td>
                                    <td className={`p-2 truncate max-w-lg font-mono ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.info}</td>
                                </tr>
                            ))}
                            <tr className="h-4"></tr>
                        </tbody>
                    </table>
                </div>

                <div className={`h-1 ${isDark ? 'bg-gray-800 hover:bg-blue-500' : 'bg-gray-200 hover:bg-blue-400'} cursor-row-resize transition-colors`}></div>

                <div className={`h-1/3 min-h-[200px] ${isDark ? 'bg-[#111]' : 'bg-gray-50'} border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} flex flex-col`}>
                    {selectedPacket ? (
                        <>
                            <div className={`flex border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                                <button className={`px-4 py-2 text-xs font-bold ${isDark ? 'text-gray-200 border-blue-500 bg-gray-800/50' : 'text-gray-700 border-blue-500 bg-gray-100'} border-b-2`}>
                                    {t('ingestion.parsedPayload', 'Parsed Payload (JSON)')}
                                </button>
                                <button className={`px-4 py-2 text-xs font-medium ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                                    {t('ingestion.hexView', 'Hex View')}
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex gap-4">
                                <div className="flex-1">
                                    <div className={`${isDark ? 'bg-[#0a0a0a] border-gray-700' : 'bg-white border-gray-200'} border rounded p-3 overflow-auto h-full`}>
                                        <pre className={`${isDark ? 'text-green-400' : 'text-green-600'} text-xs font-mono leading-relaxed`}>
                                            {JSON.stringify(selectedPacket.payload, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                                <div className={`w-1/3 space-y-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <div className={`flex justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} pb-1`}>
                                        <span>{t('ingestion.frameNumber', 'Frame Number')}</span>
                                        <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{selectedPacket.id}</span>
                                    </div>
                                    <div className={`flex justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} pb-1`}>
                                        <span>{t('ingestion.captureTime', 'Capture Time')}</span>
                                        <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{selectedPacket.ts}</span>
                                    </div>
                                    <div className={`flex justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} pb-1`}>
                                        <span>{t('ingestion.protocol', 'Protocol')}</span>
                                        <span className="text-purple-400">{selectedPacket.protocol}</span>
                                    </div>
                                    <div className={`flex justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} pb-1`}>
                                        <span>{t('ingestion.length', 'Length')}</span>
                                        <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{selectedPacket.size} bytes</span>
                                    </div>
                                    <div className="mt-2">
                                        <span className="block mb-1">{t('ingestion.rawHexPreview', 'Raw Hex Preview')}</span>
                                        <div className={`font-mono text-[10px] ${isDark ? 'text-gray-500 bg-gray-900' : 'text-gray-400 bg-gray-100'} p-2 rounded break-all`}>
                                            {selectedPacket.rawHex}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={`flex-1 flex flex-col items-center justify-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            <ArrowDown className="w-6 h-6 mb-2 opacity-50" />
                            <p>{t('ingestion.selectPacket', 'Select a packet to inspect details')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export const Ingestion: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [sources, setSources] = useState<DataSource[]>(MOCK_DATA_SOURCES);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<'SELECT_PLUGIN' | 'CONFIG' | 'MAPPING'>('SELECT_PLUGIN');
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [newSourceName, setNewSourceName] = useState('');
  const [tapSource, setTapSource] = useState<DataSource | null>(null);

  const selectedPlugin = MOCK_PLUGINS.find(p => p.id === selectedPluginId);
  const isDark = resolvedTheme === 'dark';

  const handleOpenWizard = () => {
    setSelectedPluginId(null);
    setNewSourceName('');
    setConfigValues({});
    setWizardStep('SELECT_PLUGIN');
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setSelectedPluginId(null);
  };

  const handleCreateSource = () => {
    if (!selectedPlugin) return;
    
    const newSource: DataSource = {
      id: `ds_${Date.now()}`,
      name: newSourceName,
      pluginId: selectedPlugin.id,
      type: selectedPlugin.name,
      status: 'Active',
      ingestionRate: 0,
      config: configValues
    };

    setSources([...sources, newSource]);
    handleCloseWizard();
  };

  const handleNavigateToMapping = (sourceId: string) => {
    navigate(`/${Page.INGESTION_MAPPING}?sourceId=${sourceId}`);
  };

  return (
    <div className="space-y-6 relative h-full">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('ingestion.dataSources', 'Data Sources')}</h1>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ingestion.manageChannels', 'Manage active data ingestion channels and gateways.')}</p>
        </div>
        <button 
           onClick={handleOpenWizard}
           className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
        >
           <Plus className="w-4 h-4 mr-2" /> {t('ingestion.deployNewSource', 'Deploy New Source')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sources.map((source) => (
          <div key={source.id} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-6 hover:border-blue-500/50 transition-colors group`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  source.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                  source.status === 'Inactive' ? (isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500') :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {source.status === 'Active' ? <Wifi className="w-6 h-6" /> : 
                   source.status === 'Inactive' ? <WifiOff className="w-6 h-6" /> :
                   <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{source.name}</h3>
                  <p className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{source.type}</p>
                </div>
              </div>
              <div className="relative">
                <button className={`${isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'} p-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                   <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t('ingestion.ingestionRate', 'Ingestion Rate')}</span>
                  <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{source.ingestionRate.toLocaleString()} rows/s</span>
                </div>
                <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-1.5 overflow-hidden`}>
                  <div 
                    className={`h-1.5 rounded-full ${source.status === 'Active' ? 'bg-blue-500' : (isDark ? 'bg-gray-600' : 'bg-gray-400')}`} 
                    style={{ width: `${Math.min((source.ingestionRate / 15000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className={`grid grid-cols-2 gap-4 pt-2 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                <div>
                   <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Source ID</span>
                   <span className={`block text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{source.id}</span>
                </div>
                <div>
                   <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('collector.uptime', 'Uptime')}</span>
                   <span className={`block text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>14d 2h</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                 <button 
                    onClick={() => setTapSource(source)}
                    className={`flex-1 py-2 text-xs font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'} rounded transition-colors flex items-center justify-center group/btn`}
                    title={t('ingestion.startLiveCapture', 'Start Live Packet Capture')}
                 >
                    <Radio className="w-3 h-3 mr-1.5 text-red-400 group-hover/btn:animate-pulse" />
                    {t('ingestion.liveTap', 'Live Tap')}
                 </button>
                 <button 
                    onClick={() => handleNavigateToMapping(source.id)}
                    className="flex-1 py-2 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded transition-colors flex items-center justify-center"
                 >
                    <GitMerge className="w-3 h-3 mr-1" />
                    {t('ingestion.mapping', 'Mapping')}
                 </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
               <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.deployNewSource', 'Deploy New Source')}</h2>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {wizardStep === 'SELECT_PLUGIN' ? t('ingestion.step1', 'Step 1: Select Protocol Plugin') : 
                     wizardStep === 'CONFIG' ? t('ingestion.step2', 'Step 2: Configure {{plugin}}', { plugin: selectedPlugin?.name }) : 
                     t('ingestion.step3', 'Step 3: Target Mapping')}
                  </p>
               </div>
               <button onClick={handleCloseWizard} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
                  <X className="w-6 h-6" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
               {wizardStep === 'SELECT_PLUGIN' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MOCK_PLUGINS.filter(p => p.status === 'Installed').map(plugin => (
                      <div 
                        key={plugin.id} 
                        onClick={() => { setSelectedPluginId(plugin.id); setWizardStep('CONFIG'); }}
                        className={`p-4 border ${isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'} rounded-xl hover:border-blue-500 cursor-pointer transition-all group`}
                      >
                         <div className="flex items-center gap-3 mb-2">
                             <div className={`p-2 ${isDark ? 'bg-gray-700 group-hover:bg-blue-500/20' : 'bg-gray-100 group-hover:bg-blue-100'} rounded-lg ${isDark ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-500 group-hover:text-blue-500'}`}>
                                <IconComponent name={plugin.icon} className="w-6 h-6" />
                             </div>
                             <h3 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{plugin.name}</h3>
                         </div>
                         <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} line-clamp-2`}>{plugin.description}</p>
                      </div>
                    ))}
                 </div>
               )}

               {wizardStep === 'CONFIG' && selectedPlugin && (
                 <div className="space-y-6">
                    <div className="space-y-1">
                       <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('ingestion.sourceName', 'Source Name')} <span className="text-red-400">*</span></label>
                       <input 
                          type="text" 
                          value={newSourceName} 
                          onChange={(e) => setNewSourceName(e.target.value)}
                          className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
                          placeholder={t('ingestion.sourceNamePlaceholder', 'e.g. Production Line 1 MQTT')}
                       />
                    </div>
                    <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} pt-4`}>
                        <DynamicForm 
                            fields={selectedPlugin.schema} 
                            values={configValues} 
                            onChange={(name, value) => setConfigValues(prev => ({...prev, [name]: value}))} 
                        />
                    </div>
                 </div>
               )}

               {wizardStep === 'MAPPING' && (
                 <div className="space-y-6">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4 flex gap-3">
                       <Box className="w-5 h-5 text-blue-400 flex-shrink-0" />
                       <div>
                           <h4 className="text-blue-400 font-medium text-sm mb-1">{t('ingestion.autoSchemaDetection', 'Auto-Schema Detection')}</h4>
                           <p className="text-xs text-blue-300/80">{t('ingestion.autoSchemaDesc', 'We will attempt to infer the schema from the first 10 messages. Any unmatched fields will be stored in a JSON column.')}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('ingestion.targetDatabase', 'Target Database')}</label>
                          <select className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 outline-none`}>
                             <option>power_db</option>
                             <option>factory_db</option>
                             <option>sys_db</option>
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('ingestion.targetSuperTable', 'Target Super Table')}</label>
                          <select className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 outline-none`}>
                             <option>meters</option>
                             <option>sensors</option>
                          </select>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className={`p-6 border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} flex justify-end gap-3`}>
               <button onClick={handleCloseWizard} className={`px-4 py-2 text-sm font-medium ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>{t('common.cancel', 'Cancel')}</button>
               {wizardStep === 'SELECT_PLUGIN' && (
                   <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} self-center`}>{t('ingestion.selectProtocolHint', 'Select a protocol to proceed')}</span>
               )}
               {wizardStep === 'CONFIG' && (
                  <div className="flex gap-2">
                     <button onClick={() => setWizardStep('SELECT_PLUGIN')} className={`px-4 py-2 text-sm font-medium ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>{t('common.back', 'Back')}</button>
                     <button 
                        onClick={() => setWizardStep('MAPPING')}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                     >
                        {t('common.next', 'Next Step')} <ChevronRight className="w-4 h-4 ml-1" />
                     </button>
                  </div>
               )}
               {wizardStep === 'MAPPING' && (
                  <div className="flex gap-2">
                     <button onClick={() => setWizardStep('CONFIG')} className={`px-4 py-2 text-sm font-medium ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>{t('common.back', 'Back')}</button>
                     <button 
                        onClick={handleCreateSource}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                     >
                        {t('ingestion.deploySource', 'Deploy Source')} <CheckCircle className="w-4 h-4 ml-2" />
                     </button>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {tapSource && (
          <LiveTapModal 
              source={tapSource} 
              onClose={() => setTapSource(null)} 
          />
      )}
    </div>
  );
};
