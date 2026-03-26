import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { MOCK_SUPER_TABLES } from '../constants';
import { Database, Layers, Table, Tag, Search, Filter, AlertTriangle, CheckCircle, HelpCircle, ArrowUpRight, Sparkles, ShieldAlert, RefreshCw } from 'lucide-react';
import { analyzeTagSchema } from '../services/geminiService';

// Initial Mock Data
const INITIAL_TAG_DATA = [
    { id: 1, table: 'meters', tag: 'region', count: 12, status: 'OK', advice: 'Low cardinality, ideal for grouping.' },
    { id: 2, table: 'meters', tag: 'model_ver', count: 45, status: 'OK', advice: 'Good distribution.' },
    { id: 3, table: 'vehicles', tag: 'fleet_id', count: 120, status: 'OK', advice: 'Within healthy limits.' },
    { id: 4, table: 'sensors', tag: 'device_sn', count: 45000, status: 'WARNING', advice: null },
    { id: 5, table: 'logs', tag: 'request_id', count: 2500000, status: 'CRITICAL', advice: null },
    { id: 6, table: 'logs', tag: 'client_timestamp', count: 15000000, status: 'CRITICAL', advice: null },
];

export const MetadataMap: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [filter, setFilter] = useState('');
  const [tagData, setTagData] = useState(INITIAL_TAG_DATA);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'NONE' | 'AI' | 'RULE'>('NONE');

  const formatNumber = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
  };

  // --- 核心降级策略: 规则引擎 ---
  const getHeuristicAdvice = (item: typeof INITIAL_TAG_DATA[0]) => {
      const lowerTag = item.tag.toLowerCase();
      if (item.count > 1000000) return "Rule: Extremely high cardinality (>1M). Immediate OOM risk. Move to Column.";
      if (lowerTag.includes('time') || lowerTag.includes('date')) return "Rule: Time fields must be Metrics or primary Timestamp, never Tags.";
      if ((lowerTag.includes('id') || lowerTag.includes('uuid')) && item.count > 10000) return "Rule: Unique IDs misused as Tags. High memory consumption.";
      if (item.status === 'WARNING') return "Rule: Cardinality is elevated. Monitor memory usage.";
      return "Rule: Check schema design.";
  };

  const handleRunDiagnosis = async () => {
      setIsAnalyzing(true);
      setAnalysisMode('AI'); // Optimistically try AI

      const updatedData = await Promise.all(tagData.map(async (item) => {
          if (item.status === 'OK') return item;

          try {
              // Try AI Diagnosis
              const aiAdvice = await analyzeTagSchema(item.table, item.tag, item.count);
              return { ...item, advice: aiAdvice, source: 'AI' };
          } catch (error) {
              // Fallback to Rule Engine immediately on error
              console.warn("AI unavailable, switching to Heuristics for", item.tag);
              const ruleAdvice = getHeuristicAdvice(item);
              return { ...item, advice: ruleAdvice, source: 'RULE' };
          }
      }));

      // Check if any actually used AI (to update UI indicator)
      const usedAi = updatedData.some((d: any) => d.source === 'AI');
      setAnalysisMode(usedAi ? 'AI' : 'RULE');
      
      setTagData(updatedData);
      setIsAnalyzing(false);
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('metadata.map.dataMapSchemaAnalysis', 'Data Map & Schema Analysis')}</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('metadata.map.exploreDataAssetTopology', 'Explore data asset topology and analyze schema health.')}</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input 
                    type="text" 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('metadata.map.searchTablesTags', 'Search tables, tags...')}
                    className={`pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 border'}`}
                />
             </div>
             <button className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 border'}`}>
                <Filter className="w-4 h-4 mr-2" /> {t('common.filter', 'Filter')}
             </button>
          </div>
       </div>

       {/* Top Section: Topology & Cardinality Analysis */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Left: Storage Topology */}
           <div className={`rounded-xl p-6 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <h3 className={`text-lg font-semibold mb-4 flex items-center justify-between ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                   <div className="flex items-center">
                       <Database className="w-5 h-5 mr-2 text-blue-400" />
                       {t('metadata.map.storageTopology', 'Storage Topology')}
                   </div>
                   <span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('metadata.map.liveDiskUsage', 'Live Disk Usage')}</span>
               </h3>
               {/* Mock Visualization */}
               <div className="flex-1 flex gap-4 items-center">
                  <div className={`flex-1 rounded-lg border p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors h-48 relative group ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                     <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Database className="w-8 h-8 text-blue-400" />
                     </div>
                     <span className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>power_db</span>
                     <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>2.4 TB</span>
                     <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                  <div className={`flex-1 rounded-lg border p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors h-48 relative group ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                     <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Database className="w-8 h-8 text-green-400" />
                     </div>
                     <span className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>factory_db</span>
                     <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>850 GB</span>
                     <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                  <div className={`flex-1 rounded-lg border p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors h-48 relative group ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                     <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Database className="w-8 h-8 text-purple-400" />
                     </div>
                     <span className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>fleet_db</span>
                     <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>5.1 TB</span>
                     <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
               </div>
           </div>
           
           {/* Right: Tag Cardinality Analysis (New Feature) */}
           <div className={`rounded-xl p-6 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="flex items-center justify-between mb-4">
                   <h3 className={`text-lg font-semibold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                       <Tag className="w-5 h-5 mr-2 text-yellow-400" />
                       {t('metadata.map.tagCardinalityAnalysis', 'Tag Cardinality Analysis')}
                   </h3>
                   
                   <div className="flex gap-2">
                       {analysisMode !== 'NONE' && (
                           <div className={`flex items-center text-xs px-2 py-1 rounded border ${
                               analysisMode === 'AI' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : (isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300')
                           }`}>
                               {analysisMode === 'AI' ? <Sparkles className="w-3 h-3 mr-1" /> : <ShieldAlert className="w-3 h-3 mr-1" />}
                               {analysisMode === 'AI' ? t('metadata.map.aiEnhanced', 'AI Enhanced') : t('metadata.map.ruleBased', 'Rule Based')}
                           </div>
                       )}
                       <button 
                           onClick={handleRunDiagnosis}
                           disabled={isAnalyzing}
                           className="flex items-center text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
                       >
                           {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                           {isAnalyzing ? t('metadata.map.diagnosing', 'Diagnosing...') : t('metadata.map.runDiagnosis', 'Run Diagnosis')}
                       </button>
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto max-h-48 pr-1 custom-scrollbar space-y-2">
                    {tagData.sort((a,b) => b.count - a.count).map((item) => (
                        <div key={item.id} className={`p-3 rounded-lg border flex items-start justify-between group transition-all ${
                            item.status === 'CRITICAL' ? 'bg-red-900/10 border-red-500/30' : 
                            item.status === 'WARNING' ? 'bg-yellow-900/10 border-yellow-500/30' : 
                            (isDark ? 'bg-gray-700/30 border-gray-700 hover:bg-gray-700/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-200')
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-mono text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{item.tag}</span>
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('common.in', 'in')} {item.table}</span>
                                </div>
                                
                                {/* Advice Section */}
                                {item.advice ? (
                                    <p className={`text-xs flex items-start mt-1 ${item.status === 'OK' ? (isDark ? 'text-gray-500' : 'text-gray-600') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>
                                        {(item as any).source === 'AI' && <Sparkles className="w-3 h-3 mr-1.5 mt-0.5 text-purple-400 shrink-0" />}
                                        {(item as any).source === 'RULE' && <ShieldAlert className={`w-3 h-3 mr-1.5 mt-0.5 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />}
                                        {item.advice}
                                    </p>
                                ) : (
                                    // Placeholder for unanalyzed items
                                    (item.status !== 'OK') && <p className={`text-xs italic mt-1 ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('metadata.map.clickRunDiagnosis', 'Click "Run Diagnosis" for advice.')}</p>
                                )}
                            </div>

                            <div className="text-right">
                                <div className={`text-sm font-bold font-mono ${
                                    item.status === 'CRITICAL' ? 'text-red-400' : 
                                    item.status === 'WARNING' ? 'text-yellow-400' : 'text-green-400'
                                }`}>
                                    {formatNumber(item.count)}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('metadata.map.cardinality', 'Cardinality')}</span>
                            </div>
                        </div>
                    ))}
               </div>
               
               {/* Summary Alert */}
               {tagData.some(t => t.status === 'CRITICAL') && (
                   <div className={`mt-4 p-3 border rounded text-xs flex items-start gap-2 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                       <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                       <div>
                           <span className="font-bold block mb-0.5">{t('metadata.map.schemaOptimizationRequired', 'Schema Optimization Required')}</span>
                           <p>{t('metadata.map.foundTagsExtremelyHighCardinality', 'Found tags with extremely high cardinality. This causes excessive metadata memory usage on MNodes.')}</p>
                       </div>
                   </div>
               )}
           </div>
       </div>

       {/* Bottom: Asset Catalog */}
       <div className="grid grid-cols-1 gap-4">
          <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
             <div className={`p-4 flex justify-between items-center ${isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'}`}>
                <h3 className={`font-semibold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    <Table className="w-4 h-4 mr-2 text-gray-400" />
                    {t('metadata.map.assetCatalog', 'Asset Catalog')} ({t('metadata.map.superTables', 'Super Tables')})
                </h3>
                <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                    {t('metadata.map.viewFullSchema', 'View Full Schema')} <ArrowUpRight className="w-3 h-3 ml-1" />
                </button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className={`text-sm ${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                   <tr>
                     <th className="p-4 font-medium">{t('common.name', 'Name')}</th>
                     <th className="p-4 font-medium">{t('common.database', 'Database')}</th>
                     <th className="p-4 font-medium text-center">{t('metadata.map.childTables', 'Child Tables')}</th>
                     <th className="p-4 font-medium text-center">{t('metadata.map.metrics', 'Metrics')}</th>
                     <th className="p-4 font-medium text-center">{t('metadata.map.tags', 'Tags')}</th>
                     <th className="p-4 font-medium text-right">{t('metadata.map.dataOwner', 'Data Owner')}</th>
                   </tr>
                 </thead>
                 <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                   {MOCK_SUPER_TABLES.map((st) => (
                     <tr key={st.name} className={`transition-colors group ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                       <td className="p-4">
                         <div className="flex items-center">
                           <Layers className="w-5 h-5 text-blue-500 mr-3" />
                           <div>
                               <span className={`font-semibold block ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{st.name}</span>
                               <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('common.updated', 'Updated')}: 10m {t('common.ago', 'ago')}</span>
                           </div>
                         </div>
                       </td>
                       <td className="p-4">
                         <div className={`flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Database className="w-4 h-4 mr-2" />
                            {st.database}
                         </div>
                       </td>
                       <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                            {st.tables.toLocaleString()}
                          </span>
                       </td>
                       <td className={`p-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{st.columns}</td>
                       <td className={`p-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{st.tags}</td>
                       <td className={`p-4 text-right text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                         {t('metadata.map.dataEngTeam', 'Data Eng. Team')}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
       </div>
    </div>
  );
};
