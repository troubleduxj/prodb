import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Turtle, Fingerprint, Clock, User, Filter, AlertTriangle, ChevronRight, Activity, Search, RefreshCw, Sparkles, Monitor } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyzeSlowQueryPattern } from '../services/geminiService';

// --- Types & Interfaces ---
interface RawLog {
  id: string;
  ts: string;
  sql: string;
  duration: number;
  user: string;
  clientIp: string;
  db: string;
}

interface SqlPattern {
  id: string;
  patternHash: string;
  patternSql: string;
  count: number;
  avgDuration: number;
  totalDuration: number;
  maxDuration: number;
  users: Record<string, number>;
  ips: Record<string, number>;
  example: string;
}

// --- Mock Data Generation ---
const RAW_LOGS: RawLog[] = Array.from({ length: 50 }).map((_, i) => {
  const isScan = Math.random() > 0.7;
  const isAgg = Math.random() > 0.8;
  const db = Math.random() > 0.5 ? 'power_db' : 'fleet_db';
  
  let sql = '';
  if (isScan) {
      sql = `SELECT * FROM ${db}.meters WHERE ts > NOW - ${Math.floor(Math.random() * 30)}d`;
  } else if (isAgg) {
      sql = `SELECT avg(voltage) FROM ${db}.meters GROUP BY location_id = '${Math.floor(Math.random() * 1000)}'`;
  } else {
      sql = `SELECT last(*) FROM ${db}.sensors WHERE device_id = 'dev_${Math.floor(Math.random() * 500)}'`;
  }

  return {
    id: `log_${i}`,
    ts: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
    sql,
    duration: Math.floor(Math.random() * 2000) + 100,
    user: Math.random() > 0.6 ? 'data_analyst' : 'grafana_viewer',
    clientIp: Math.random() > 0.7 ? '192.168.1.50' : '10.0.0.8',
    db
  };
});

const fingerprintSql = (sql: string): string => {
  return sql
    .replace(/'[^']*'/g, "'?'")
    .replace(/\b\d+\b/g, "?")
    .replace(/\s+/g, ' ')
    .trim();
};

export const OperationsSlowQuery: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const patterns = useMemo(() => {
      const map = new Map<string, SqlPattern>();
      RAW_LOGS.forEach(log => {
          const fp = fingerprintSql(log.sql);
          const existing = map.get(fp);
          if (existing) {
              existing.count++;
              existing.totalDuration += log.duration;
              existing.avgDuration = Math.floor(existing.totalDuration / existing.count);
              existing.maxDuration = Math.max(existing.maxDuration, log.duration);
              existing.users[log.user] = (existing.users[log.user] || 0) + 1;
              existing.ips[log.clientIp] = (existing.ips[log.clientIp] || 0) + 1;
          } else {
              map.set(fp, {
                  id: `pat_${Math.random().toString(36).substr(2, 5)}`,
                  patternHash: fp,
                  patternSql: fp,
                  count: 1,
                  avgDuration: log.duration,
                  totalDuration: log.duration,
                  maxDuration: log.duration,
                  users: { [log.user]: 1 },
                  ips: { [log.clientIp]: 1 },
                  example: log.sql
              });
          }
      });
      return Array.from(map.values()).sort((a, b) => b.totalDuration - a.totalDuration);
  }, []);

  const selectedPattern = patterns.find(p => p.id === selectedPatternId) || patterns[0];

  const handleAiAnalyze = async () => {
      if (!selectedPattern) return;
      setIsAnalyzing(true);
      try {
          const result = await analyzeSlowQueryPattern(
              selectedPattern.patternSql, 
              selectedPattern.avgDuration, 
              selectedPattern.count
          );
          setAiAnalysis(result);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const chartData = patterns.slice(0, 5).map(p => ({
      name: p.id,
      impact: p.totalDuration,
      sql: p.patternSql.substring(0, 30) + '...'
  }));

  return (
    <div className={`space-y-6 h-[calc(100vh-7rem)] min-h-[750px] flex flex-col`}>
       <div className="flex items-center justify-between shrink-0">
          <div>
             <h1 className={`text-2xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                 <Turtle className="w-6 h-6 mr-3 text-yellow-500" />
                 {t('slowQuery.title', 'Slow Query Analysis')}
             </h1>
             <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('slowQuery.description', 'Fingerprint-based aggregation to identify high-impact performance bottlenecks.')}</p>
          </div>
          <div className="flex gap-3">
             <div className={`p-2 rounded-lg border flex items-center gap-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                 <Filter className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                 <select className={`text-sm outline-none ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}>
                     <option>{t('slowQuery.last1Hour', 'Last 1 Hour')}</option>
                     <option>{t('slowQuery.last24Hours', 'Last 24 Hours')}</option>
                 </select>
             </div>
             <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center border ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
                <RefreshCw className="w-4 h-4 mr-2" /> {t('common.refresh', 'Refresh Logs')}
             </button>
          </div>
       </div>

       {/* Top Metrics Grid */}
       <div className="grid grid-cols-4 gap-4 shrink-0">
           {[
               { label: t('slowQuery.totalSlowQueries', 'Total Slow Queries'), value: RAW_LOGS.length, icon: Activity, color: 'red' },
               { label: t('slowQuery.distinctPatterns', 'Distinct Patterns'), value: patterns.length, icon: Fingerprint, color: 'blue' },
               { label: t('slowQuery.p95Latency', 'P95 Latency'), value: '1,850 ms', icon: Clock, color: 'yellow' },
               { label: t('slowQuery.topOffenderIP', 'Top Offender IP'), value: '192.168.1.50', icon: Monitor, color: 'purple' },
           ].map((metric, i) => (
               <div key={i} className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                   <div className="flex justify-between items-start">
                       <div>
                           <p className={`text-xs uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{metric.label}</p>
                           <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{metric.value}</p>
                       </div>
                       <div className={`p-2 rounded-lg ${metric.color === 'red' ? 'bg-red-500/10 text-red-500' : metric.color === 'blue' ? 'bg-blue-500/10 text-blue-500' : metric.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-purple-500/10 text-purple-500'}`}>
                           <metric.icon className="w-5 h-5"/>
                       </div>
                   </div>
               </div>
           ))}
       </div>

       {/* Main Content Split */}
       <div className="flex-1 flex gap-6 min-h-0">
           
           {/* Left: Pattern List */}
           <div className={`w-3/5 rounded-xl border flex flex-col overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className={`p-3 border-b flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                   <h3 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('slowQuery.top10Patterns', 'Top 10 Resource Consuming Patterns')}</h3>
                   <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('slowQuery.sortedByImpact', 'Sorted by Total Impact (Duration × Count)')}</span>
               </div>
               <div className="flex-1 overflow-y-auto">
                   {patterns.slice(0, 10).map((pat, idx) => (
                       <div 
                           key={pat.id}
                           onClick={() => { setSelectedPatternId(pat.id); setAiAnalysis(null); }}
                           className={`p-3 border-b cursor-pointer transition-colors group ${
                               selectedPatternId === pat.id || (!selectedPatternId && idx === 0) 
                               ? 'bg-blue-600/10 border-l-4 border-l-blue-500' 
                               : (isDark ? 'border-gray-700 hover:bg-gray-700/50 border-l-4 border-l-transparent' : 'border-gray-200 hover:bg-gray-50 border-l-4 border-l-transparent')
                           }`}
                       >
                           <div className="flex justify-between items-start mb-1">
                               <div className="flex-1 mr-4 min-w-0">
                                   <code className={`text-xs font-mono line-clamp-2 leading-relaxed px-2 py-1 rounded border block ${isDark ? 'bg-gray-900/50 text-gray-300 border-gray-700/50' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                       {pat.patternSql}
                                   </code>
                               </div>
                               <div className="text-right shrink-0 ml-2">
                                    <span className={`block text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{pat.avgDuration} ms</span>
                                    <span className={`text-[10px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('slowQuery.avgTime', 'Avg Time')}</span>
                               </div>
                           </div>
                           <div className={`flex items-center justify-between text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                               <div className="flex gap-4 items-center">
                                   <span className="flex items-center text-blue-400"><Fingerprint className="w-3 h-3 mr-1"/> {pat.id}</span>
                                   <span>{t('slowQuery.count', 'Count')}: <span className={isDark ? 'text-gray-300 font-bold' : 'text-gray-800 font-bold'}>{pat.count}</span></span>
                                   <span>{t('slowQuery.impact', 'Impact')}: <span className="text-yellow-500 font-bold">{(pat.totalDuration / 1000).toFixed(1)}s</span></span>
                               </div>
                               <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'}`} />
                           </div>
                       </div>
                   ))}
               </div>
           </div>

           {/* Right: Detail View & Attribution */}
           <div className="flex-1 flex flex-col gap-6 min-w-0">
               {/* Impact Chart */}
               <div className={`h-1/3 rounded-xl border p-4 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                   <h4 className={`text-xs font-bold uppercase mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('slowQuery.loadDistribution', 'Total Load Distribution (Top 5)')}</h4>
                   <div className="flex-1 min-h-0">
                       <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
                               <XAxis type="number" hide />
                               <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280'}} />
                               <Tooltip 
                                   contentStyle={{backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937'}}
                                   cursor={{fill: isDark ? '#374151' : '#f3f4f6', opacity: 0.4}}
                               />
                               <Bar dataKey="impact" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#3b82f6'} />
                                    ))}
                               </Bar>
                           </BarChart>
                       </ResponsiveContainer>
                   </div>
               </div>

               {/* Attribution Details */}
               <div className={`flex-1 rounded-xl border p-5 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                   <div className="flex justify-between items-start mb-4">
                       <h3 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('slowQuery.patternAttribution', 'Pattern Attribution')}</h3>
                       <button 
                           onClick={handleAiAnalyze}
                           disabled={isAnalyzing}
                           className="text-xs flex items-center bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                       >
                           {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1"/>}
                           {aiAnalysis ? t('slowQuery.reAnalyze', 'Re-Analyze') : t('slowQuery.analyzeRootCause', 'Analyze Root Cause')}
                       </button>
                   </div>

                   {/* AI Insight Box */}
                   {aiAnalysis && (
                       <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-sm text-gray-300 animate-in fade-in slide-in-from-top-2">
                           <span className="font-bold text-purple-300 block mb-1 flex items-center">
                               <Sparkles className="w-3 h-3 mr-1" /> {t('slowQuery.recommendation', 'Recommendation')}
                           </span>
                           {aiAnalysis}
                       </div>
                   )}

                   {/* Source Tables */}
                   <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                       <div className={`rounded-lg p-3 border overflow-y-auto ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                           <h4 className={`text-xs font-bold uppercase mb-2 flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               <User className="w-3 h-3 mr-1" /> {t('slowQuery.topUsers', 'Top Users')}
                           </h4>
                           <div className="space-y-2">
                               {Object.entries(selectedPattern?.users || {} as Record<string, number>).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([u, count]) => (
                                   <div key={u} className="flex justify-between text-sm">
                                       <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{u}</span>
                                       <span className={isDark ? 'text-gray-500 font-mono' : 'text-gray-500 font-mono'}>{count}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                       <div className={`rounded-lg p-3 border overflow-y-auto ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                           <h4 className={`text-xs font-bold uppercase mb-2 flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               <Monitor className="w-3 h-3 mr-1" /> {t('slowQuery.topClientIPs', 'Top Client IPs')}
                           </h4>
                           <div className="space-y-2">
                               {Object.entries(selectedPattern?.ips || {} as Record<string, number>).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([ip, count]) => (
                                   <div key={ip} className="flex justify-between text-sm">
                                       <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{ip}</span>
                                       <span className={isDark ? 'text-gray-500 font-mono' : 'text-gray-500 font-mono'}>{count}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   </div>

                   <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                       <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('slowQuery.rawExample', 'Raw Example')}</p>
                       <code className={`block text-xs font-mono p-2 rounded truncate ${isDark ? 'text-gray-400 bg-black/30' : 'text-gray-600 bg-gray-100'}`}>
                           {selectedPattern?.example}
                       </code>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};
