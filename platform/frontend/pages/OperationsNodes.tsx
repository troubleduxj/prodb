import React, { useEffect, useState } from 'react';
import { MOCK_NODES } from '../constants';
import { Server, Activity, HardDrive, Cpu, MoreVertical, Terminal } from 'lucide-react';
import { analyzeClusterHealth } from '../services/geminiService';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export const OperationsNodes: React.FC = () => {
  const [analysis, setAnalysis] = useState<string>('Analyzing node telemetry...');
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const runAnalysis = async () => {
        const result = await analyzeClusterHealth(JSON.stringify(MOCK_NODES));
        setAnalysis(result);
    };
    runAnalysis();
  }, []);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
             <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('nodes.nodeMonitor')}</h1>
             <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('nodes.realTimeResourceUsage')}</p>
          </div>
       </div>

       {/* AI Insight */}
       <div className={`bg-gradient-to-r ${isDark ? 'from-gray-800 to-gray-800' : 'from-gray-100 to-gray-100'} border border-purple-500/30 rounded-xl p-6 shadow-lg relative overflow-hidden flex items-start gap-4`}>
           <div className="p-2 bg-purple-500/20 rounded-lg shrink-0 mt-1">
               <Activity className="w-6 h-6 text-purple-400" />
           </div>
           <div>
               <h3 className="text-purple-400 font-bold mb-1">{t('nodes.aiDiagnostic')}</h3>
               <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm leading-relaxed`}>{analysis}</p>
           </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
         {MOCK_NODES.map((node) => (
             <div key={node.id} className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6 flex flex-col relative group hover:border-blue-500/30 transition-all`}>
                 <div className="absolute top-4 right-4">
                     <button className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}><MoreVertical className="w-5 h-5" /></button>
                 </div>

                 <div className="flex items-center gap-4 mb-6">
                     <div className={`p-3 rounded-xl ${node.role === 'MNODE' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        <Server className="w-8 h-8" />
                     </div>
                     <div>
                         <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Node {node.id}</h3>
                         <div className="flex items-center gap-2">
                             <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-mono`}>{node.ip}</span>
                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                 node.role === 'MNODE' ? 'border-yellow-500/30 text-yellow-400' : 'border-blue-500/30 text-blue-400'
                             }`}>
                                 {node.role}
                             </span>
                         </div>
                     </div>
                 </div>

                 <div className="space-y-4 flex-1">
                    {/* CPU */}
                    <div>
                        <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                            <span className="flex items-center"><Cpu className="w-3 h-3 mr-1"/> CPU</span>
                            <span>{node.cpu}%</span>
                        </div>
                        <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} h-1.5 rounded-full overflow-hidden`}>
                            <div className={`h-full rounded-full ${node.cpu > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${node.cpu}%`}}></div>
                        </div>
                    </div>
                    {/* RAM */}
                    <div>
                        <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                            <span className="flex items-center"><Activity className="w-3 h-3 mr-1"/> Memory</span>
                            <span>{node.memory}%</span>
                        </div>
                        <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} h-1.5 rounded-full overflow-hidden`}>
                            <div className="h-full rounded-full bg-purple-500" style={{width: `${node.memory}%`}}></div>
                        </div>
                    </div>
                    {/* Disk / WAL */}
                    <div className={`grid grid-cols-2 gap-2 mt-4 pt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                        <div className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} p-2 rounded border ${isDark ? 'border-gray-700/50' : 'border-gray-200'} text-center`}>
                            <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>WAL Delay</p>
                            <p className={`text-sm font-mono font-bold ${node.status === 'Syncing' ? 'text-yellow-400' : 'text-green-400'}`}>
                                {node.status === 'Syncing' ? '145ms' : '2ms'}
                            </p>
                        </div>
                        <div className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} p-2 rounded border ${isDark ? 'border-gray-700/50' : 'border-gray-200'} text-center`}>
                            <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>Disk Usage</p>
                            <p className={`text-sm font-mono font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>45%</p>
                        </div>
                    </div>
                 </div>

                 <div className="mt-6">
                     <button className={`w-full py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded text-sm font-medium flex items-center justify-center transition-colors`}>
                         <Terminal className="w-4 h-4 mr-2" /> {t('nodes.sshConsole')}
                     </button>
                 </div>

                 {/* Status Indicator */}
                 <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-xl ${
                     node.status === 'Ready' ? 'bg-green-500' : node.status === 'Syncing' ? 'bg-yellow-500' : 'bg-red-500'
                 }`}></div>
             </div>
         ))}
       </div>
    </div>
  );
};
