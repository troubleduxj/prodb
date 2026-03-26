import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Play, Sparkles, Save, Clock, Trash2, Box, Wand2, Database, AlertCircle, Search, Gauge, ArrowRight, Scan, Filter, Calculator, Network, RefreshCw } from 'lucide-react';
import { generateSqlFromNaturalLanguage, explainQueryPlan } from '../services/geminiService';

const SAMPLE_TEMPLATES = [
  { name: 'Last Hour Avg', sql: 'SELECT avg(current) FROM meters WHERE ts > NOW - 1h GROUP BY $interval(5m);' },
  { name: 'Device Status', sql: 'SELECT last(*) FROM meters WHERE device_id = "{{deviceId}}";' },
];

interface ExplainNode {
    id: number;
    name: string;
    type: 'SCAN' | 'FILTER' | 'AGGREGATE' | 'PROJECT' | 'EXCHANGE';
    cost: number;
    rows: number;
    info: string;
    children?: ExplainNode[];
    warning?: boolean;
}

export const QueryWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const [query, setQuery] = useState(location.state?.sql || 'SELECT avg(voltage) FROM meters \nWHERE $last_24h \nAND device_group = {{groupId}} \nGROUP BY $interval(1h);');
  const [prompt, setPrompt] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [logs, setLogs] = useState<string[]>([t('query.systemReady', 'System ready. TD-SQL+ Syntax enabled.')]);
  const [params, setParams] = useState<Record<string, string>>({ groupId: '101' });
  const [detectedParams, setDetectedParams] = useState<string[]>(['groupId']);
  
  const [activeTab, setActiveTab] = useState<'LOGS' | 'EXPLAIN' | 'MACROS'>('LOGS');
  const [explainResult, setExplainResult] = useState<ExplainNode | null>(null);
  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [analyzingPlan, setAnalyzingPlan] = useState(false);

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
      if (location.state?.sql) {
          setQuery(location.state.sql);
      }
  }, [location.state]);

  useEffect(() => {
    const regex = /{{(\w+)}}/g;
    const found = [];
    let match;
    while ((match = regex.exec(query)) !== null) {
      found.push(match[1]);
    }
    setDetectedParams([...new Set(found)]);
  }, [query]);

  const handleRun = () => {
    setActiveTab('LOGS');
    const timestamp = new Date().toLocaleTimeString();
    
    let effectiveQuery = query
        .replace('$last_24h', 'ts >= NOW - 24h')
        .replace(/\$interval\((\w+)\)/g, 'INTERVAL($1) SLIDING($1) FILL(PREV)');
    
    detectedParams.forEach(p => {
        effectiveQuery = effectiveQuery.replace(new RegExp(`{{${p}}}`, 'g'), params[p] || '?');
    });

    setLogs(prev => [
        `[${timestamp}] ${t('query.executingNativeSql', 'Executing Native SQL')}: ${effectiveQuery}`,
        `[${timestamp}] ----------------------------------------`,
        ...prev
    ]);
    
    setTimeout(() => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${t('query.queryExecuted', 'Query executed successfully (12 rows, 0.045s)')}`, ...prev]);
    }, 500);
  };

  const handleExplain = () => {
      setActiveTab('EXPLAIN');
      setAiExplain(null);
      
      const mockPlan: ExplainNode = {
          id: 1, name: 'Project', type: 'PROJECT', cost: 120, rows: 24, info: 'Output: ts, avg(voltage)',
          children: [
              {
                  id: 2, name: 'Exchange', type: 'EXCHANGE', cost: 110, rows: 24, info: 'Gather from 4 DNodes',
                  children: [
                       {
                           id: 3, name: 'Aggregate', type: 'AGGREGATE', cost: 100, rows: 24, info: 'Group By: Interval(1h)',
                           children: [
                               {
                                   id: 4, name: 'Filter', type: 'FILTER', cost: 80, rows: 150000, info: 'Filter: device_group = 101',
                                   children: [
                                       {
                                           id: 5, name: 'Table Scan', type: 'SCAN', cost: 60, rows: 5000000, info: 'Table: meters (Full Scan)', warning: true
                                       }
                                   ]
                               }
                           ]
                       }
                  ]
              }
          ]
      };
      setExplainResult(mockPlan);
  };

  const handleAiPlanAnalysis = async () => {
      if (!explainResult) return;
      setAnalyzingPlan(true);
      try {
          const result = await explainQueryPlan(query, explainResult);
          setAiExplain(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAnalyzingPlan(false);
      }
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setLoadingAi(true);
    const schemaContext = `SuperTable meters (ts TIMESTAMP, current FLOAT, voltage INT) TAGS (location BINARY, groupId INT)`;
    const generatedSql = await generateSqlFromNaturalLanguage(prompt, schemaContext);
    setQuery(generatedSql);
    setLoadingAi(false);
  };

  const renderExplainNode = (node: ExplainNode, depth = 0) => {
      const getIcon = (type: string) => {
          switch(type) {
              case 'SCAN': return <Scan className="w-4 h-4 text-blue-400"/>;
              case 'FILTER': return <Filter className="w-4 h-4 text-yellow-400"/>;
              case 'AGGREGATE': return <Calculator className="w-4 h-4 text-purple-400"/>;
              case 'EXCHANGE': return <Network className="w-4 h-4 text-gray-400"/>;
              default: return <Box className="w-4 h-4 text-gray-400"/>;
          }
      };

      return (
          <div key={node.id} className="relative">
              <div className={`
                  flex items-start p-3 mb-2 rounded border transition-all
                  ${node.warning ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/50' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'}
              `} style={{ marginLeft: `${depth * 20}px` }}>
                  <div className={`mt-0.5 mr-3 p-1.5 rounded ${node.warning ? 'bg-red-100 dark:bg-red-500/20' : 'bg-white dark:bg-gray-800'}`}>
                      {getIcon(node.type)}
                  </div>
                  <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                          <span className={`font-bold text-sm ${node.warning ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                              {node.name}
                              {node.warning && <span className="ml-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">SLOW</span>}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">Cost: {node.cost}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{node.info}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Rows: {node.rows.toLocaleString()}</p>
                  </div>
              </div>
              {node.children && node.children.map(child => renderExplainNode(child, depth + 1))}
          </div>
      );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {t('query.sqlWorkbench', 'SQL Workbench')}
                <span className="text-xs bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded flex items-center">
                    <Wand2 className="w-3 h-3 mr-1" /> {t('query.tdSqlEnabled', 'TD-SQL+ Enabled')}
                </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('query.smartEditorDescription', 'Smart editor with Syntax Sugar macros and parameterization support.')}</p>
        </div>
        <div className="flex space-x-2">
           <button className="flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition">
              <Clock className="w-4 h-4 mr-2" /> {t('query.history', 'History')}
           </button>
           <button className="flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition">
              <Save className="w-4 h-4 mr-2" /> {t('query.saveAsSnippet', 'Save as Snippet')}
           </button>
        </div>
      </div>

      {/* AI Assistant Bar */}
      <div className="bg-gradient-to-r from-blue-100 dark:from-blue-900/30 to-purple-100 dark:to-purple-900/30 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 flex gap-4 items-center">
        <div className="bg-blue-200 dark:bg-blue-500/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
        </div>
        <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('query.aiPlaceholder', "Ask AI to write SQL (e.g., 'Find average voltage for group 5 in the last hour')")}
            className="flex-1 bg-transparent border-none text-gray-700 dark:text-gray-200 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
        />
        <button 
            onClick={handleAiGenerate}
            disabled={loadingAi}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-md text-sm font-medium transition-colors flex items-center"
        >
            {loadingAi ? t('query.generating', 'Generating...') : t('query.generateSql', 'Generate SQL')}
        </button>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Editor Pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center">
                    <Database className="w-3 h-3 mr-2" /> power_db
                </span>
                <div className="flex gap-2">
                    <button className="p-1 hover:text-red-400 text-gray-400" onClick={() => setQuery('')}><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
            
            <div className="flex flex-1 min-h-0">
                <div className="flex-1 relative">
                    <textarea 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-full bg-gray-50 dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 font-mono p-4 text-sm resize-none focus:outline-none leading-relaxed"
                        spellCheck={false}
                    />
                </div>
                
                {/* Parameters Panel */}
                {detectedParams.length > 0 && (
                    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center">
                            <Box className="w-3 h-3 mr-1" /> {t('query.parameters', 'Parameters')}
                        </h3>
                        <div className="space-y-3">
                            {detectedParams.map(param => (
                                <div key={param}>
                                    <label className="block text-xs text-blue-500 dark:text-blue-400 font-mono mb-1">{`{{${param}}}`}</label>
                                    <input 
                                        type="text" 
                                        value={params[param] || ''}
                                        onChange={(e) => setParams(prev => ({...prev, [param]: e.target.value}))}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div className="flex gap-2">
                    {SAMPLE_TEMPLATES.map((template, i) => (
                        <button key={i} onClick={() => setQuery(template.sql)} className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded truncate max-w-[120px]">
                            {template.name}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExplain} className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded font-medium transition border border-gray-200 dark:border-gray-600">
                        <Gauge className="w-4 h-4 mr-2" />
                        {t('query.explain', 'Explain')}
                    </button>
                    <button onClick={handleRun} className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition shadow-lg shadow-green-900/20">
                        <Play className="w-4 h-4 mr-2 fill-current" />
                        {t('query.runQuery', 'Run Query')}
                    </button>
                </div>
            </div>
        </div>

        {/* Results/Logs/Profiler Pane */}
        <div className="w-1/3 flex flex-col gap-4">
             <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <div className="px-1 pt-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex gap-1">
                    <button 
                        onClick={() => setActiveTab('LOGS')}
                        className={`flex-1 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeTab === 'LOGS' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-700' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t('query.executionLog', 'Execution Log')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('EXPLAIN')}
                        className={`flex-1 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeTab === 'EXPLAIN' ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border-t border-l border-r border-gray-200 dark:border-gray-700' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t('query.profilerExplain', 'Profiler / Explain')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('MACROS')}
                        className={`flex-1 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeTab === 'MACROS' ? 'bg-white dark:bg-gray-800 text-yellow-600 dark:text-yellow-400 border-t border-l border-r border-gray-200 dark:border-gray-700' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t('query.schemaHelper', 'Schema Helper')}
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
                    {/* LOGS TAB */}
                    {activeTab === 'LOGS' && (
                        <div className="p-4 font-mono text-xs space-y-2">
                             {logs.map((log, i) => (
                                <div key={i} className={`break-all ${log.includes('Native SQL') ? 'text-blue-600 dark:text-blue-300' : 'text-green-600 dark:text-green-400'}`}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* EXPLAIN TAB */}
                    {activeTab === 'EXPLAIN' && (
                        <div className="p-4 h-full flex flex-col">
                             {explainResult ? (
                                 <div className="flex-1 overflow-y-auto space-y-4">
                                     <div className="flex justify-between items-center mb-2">
                                         <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('query.queryExecutionPlan', 'Query Execution Plan')}</h4>
                                         <button 
                                            onClick={handleAiPlanAnalysis}
                                            disabled={analyzingPlan}
                                            className="text-[10px] flex items-center bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded"
                                         >
                                             {analyzingPlan ? <RefreshCw className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1"/>}
                                             {t('query.analyzePlan', 'Analyze Plan')}
                                         </button>
                                     </div>
                                     
                                     {/* AI Suggestion Box */}
                                     {aiExplain && (
                                         <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/30 rounded-lg text-xs animate-in fade-in slide-in-from-top-2">
                                             <div className="flex items-center text-purple-600 dark:text-purple-300 font-bold mb-1">
                                                 <Sparkles className="w-3 h-3 mr-1"/> {t('query.optimizationSuggestion', 'Optimization Suggestion')}
                                             </div>
                                             <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{aiExplain}</p>
                                         </div>
                                     )}

                                     {/* Tree View */}
                                     <div className="space-y-2">
                                         {renderExplainNode(explainResult)}
                                     </div>

                                     <div className="p-3 bg-gray-100 dark:bg-gray-700/20 rounded border border-gray-200 dark:border-gray-700/50 mt-4 text-[10px] text-gray-500 dark:text-gray-400">
                                         <p>{t('query.totalEstimatedCost', 'Total Estimated Cost')}: <span className="text-gray-700 dark:text-gray-300 font-mono">{explainResult.cost}</span></p>
                                         <p>{t('query.planEstimationNote', 'This plan is an estimation. Actual execution runtime may vary based on cache hits.')}</p>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                                     <Gauge className="w-8 h-8 mb-2 opacity-20"/>
                                     <p className="text-xs text-center">{t('query.clickExplainHint', 'Click "Explain" to visualize query performance.')}</p>
                                 </div>
                             )}
                        </div>
                    )}

                    {/* MACROS TAB */}
                    {activeTab === 'MACROS' && (
                         <div className="p-4 space-y-4">
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('query.availableMacros', 'Available Macros')}</h3>
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700/50">
                                       <span className="text-purple-600 dark:text-purple-400 font-mono block mb-0.5">$interval(1m)</span>
                                       {t('query.intervalMacroDesc', 'Expands to: INTERVAL(1m) SLIDING(1m) FILL(PREV)')}
                                    </div>
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700/50">
                                       <span className="text-purple-600 dark:text-purple-400 font-mono block mb-0.5">$last_24h</span>
                                       {t('query.last24hMacroDesc', "Expands to: WHERE ts >= NOW - 24h")}
                                    </div>
                                </div>
                            </div>
                         </div>
                    )}
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};
