
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { 
  History, Search, Filter, CheckCircle, XCircle, Clock, Database, 
  Play, Copy, ChevronRight, FileText, RefreshCw, AlertTriangle, 
  Terminal, User, Download, Calendar
} from 'lucide-react';
import { Page } from '../types';

interface QueryLog {
  id: string;
  ts: string;
  sql: string;
  status: 'SUCCESS' | 'ERROR';
  duration: number; // ms
  rows?: number;
  db: string;
  user: string;
  clientIp: string;
  errorMsg?: string;
}

const MOCK_HISTORY: QueryLog[] = Array.from({ length: 25 }).map((_, i) => {
    const isError = Math.random() > 0.9;
    const isSlow = Math.random() > 0.8;
    const db = i % 3 === 0 ? 'power_db' : i % 3 === 1 ? 'factory_db' : 'sys_db';
    
    let sql = '';
    if (i % 4 === 0) sql = `SELECT avg(voltage), max(current) FROM meters WHERE ts > NOW - 1h GROUP BY location`;
    else if (i % 4 === 1) sql = `SELECT * FROM sensors LIMIT 100`;
    else if (i % 4 === 2) sql = `INSERT INTO meters VALUES (NOW, ${Math.random()*10}, ${Math.floor(Math.random()*220)})`;
    else sql = `CREATE TABLE IF NOT EXISTS temp_analysis AS SELECT count(*) FROM logs`;

    return {
        id: `req_${Date.now() - i * 100000}_${i}`,
        ts: new Date(Date.now() - i * 300000).toLocaleString(),
        sql,
        status: isError ? 'ERROR' : 'SUCCESS',
        duration: isError ? 15 : (isSlow ? 1200 + Math.random() * 2000 : 10 + Math.random() * 50),
        rows: isError ? 0 : Math.floor(Math.random() * 5000),
        db,
        user: i % 5 === 0 ? 'admin' : 'grafana_bot',
        clientIp: '192.168.1.' + (10 + i),
        errorMsg: isError ? 'Syntax error near "GROUP BY": column not found' : undefined
    };
});

export const RealtimeHistory: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');
  const [selectedLog, setSelectedLog] = useState<QueryLog | null>(null);

  const filteredLogs = useMemo(() => {
      return MOCK_HISTORY.filter(log => {
          if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
          if (searchTerm && !log.sql.toLowerCase().includes(searchTerm.toLowerCase()) && !log.id.includes(searchTerm)) return false;
          return true;
      });
  }, [searchTerm, statusFilter]);

  const handleOpenInWorkbench = (sql: string) => {
      navigate(`/${Page.QUERY_WORKBENCH}`, { state: { sql } });
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      // Ideally show toast here
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between shrink-0">
          <div>
             <h1 className={`text-2xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                 <History className="w-6 h-6 mr-3 text-blue-400" />
                 {t('query.history.title', 'Query Execution History')}
             </h1>
             <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('query.history.description', 'Audit log of all SQL statements executed against the cluster.')}</p>
          </div>
          <div className="flex gap-2">
             <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center border ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
                <Download className="w-4 h-4 mr-2" /> {t('common.exportCSV', 'Export CSV')}
             </button>
             <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
                <RefreshCw className="w-4 h-4 mr-2" /> {t('common.refresh', 'Refresh')}
             </button>
          </div>
       </div>

       {/* Toolbar */}
       <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 shrink-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
           <div className="relative flex-1 min-w-[240px]">
               <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
               <input 
                   type="text" 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder={t('query.history.searchPlaceholder', 'Search by SQL content or Request ID...')} 
                   className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
               />
           </div>
           
           <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
               <Filter className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
               <span className={`text-xs border-r pr-2 mr-2 ${isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>{t('common.status', 'Status')}</span>
               <select 
                   value={statusFilter}
                   onChange={(e) => setStatusFilter(e.target.value as any)}
                   className={`text-sm outline-none cursor-pointer ${isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}
               >
                   <option value="ALL">{t('common.allStatus', 'All Status')}</option>
                   <option value="SUCCESS">{t('common.successOnly', 'Success Only')}</option>
                   <option value="ERROR">{t('common.failedOnly', 'Failed Only')}</option>
               </select>
           </div>

           <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
               <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
               <span className={`text-xs border-r pr-2 mr-2 ${isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>{t('common.range', 'Range')}</span>
               <select className={`text-sm outline-none cursor-pointer ${isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
                   <option value="1h">{t('common.last1Hour', 'Last 1 Hour')}</option>
                   <option value="24h">{t('common.last24Hours', 'Last 24 Hours')}</option>
                   <option value="7d">{t('common.last7Days', 'Last 7 Days')}</option>
               </select>
           </div>
       </div>

       {/* Main Content Split */}
       <div className="flex-1 flex gap-6 min-h-0">
           
           {/* List */}
           <div className={`flex-1 rounded-xl border overflow-hidden flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <table className="w-full text-left border-collapse">
                       <thead className={`text-xs uppercase sticky top-0 z-10 shadow-sm ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                           <tr>
                               <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.status', 'Status')}</th>
                               <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.timeId', 'Time / ID')}</th>
                               <th className={`p-4 border-b font-medium w-1/3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('query.history.querySnippet', 'Query Snippet')}</th>
                               <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.duration', 'Duration')}</th>
                               <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.rows', 'Rows')}</th>
                               <th className={`p-4 border-b font-medium text-right ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.actions', 'Actions')}</th>
                           </tr>
                       </thead>
                       <tbody className={`divide-y text-sm ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
                           {filteredLogs.map(log => (
                               <tr 
                                   key={log.id} 
                                   onClick={() => setSelectedLog(log)}
                                   className={`transition-colors cursor-pointer group ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} ${selectedLog?.id === log.id ? 'bg-blue-900/10' : ''}`}
                               >
                                   <td className="p-4">
                                       {log.status === 'SUCCESS' ? (
                                           <CheckCircle className="w-5 h-5 text-green-500" />
                                       ) : (
                                           <XCircle className="w-5 h-5 text-red-500" />
                                       )}
                                   </td>
                                   <td className="p-4">
                                       <div className="flex flex-col">
                                           <span className={`text-xs ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.ts}</span>
                                           <span className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{log.id}</span>
                                       </div>
                                   </td>
                                   <td className="p-4">
                                       <div className="flex flex-col gap-1">
                                           <code className="text-xs text-blue-300 font-mono truncate max-w-md block">
                                               {log.sql}
                                           </code>
                                           <div className="flex items-center gap-2">
                                               <span className={`text-[10px] px-1.5 rounded flex items-center ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                                   <Database className="w-2.5 h-2.5 mr-1" /> {log.db}
                                               </span>
                                               <span className={`text-[10px] flex items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                   <User className="w-2.5 h-2.5 mr-1" /> {log.user}
                                               </span>
                                           </div>
                                       </div>
                                   </td>
                                   <td className="p-4">
                                       <span className={`font-mono text-xs ${log.duration > 1000 ? 'text-yellow-400 font-bold' : isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                           {log.duration.toFixed(2)} ms
                                       </span>
                                   </td>
                                   <td className={`p-4 text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                       {log.rows?.toLocaleString()}
                                   </td>
                                   <td className="p-4 text-right">
                                       <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button 
                                               onClick={(e) => { e.stopPropagation(); copyToClipboard(log.sql); }}
                                               className={`p-1.5 rounded ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`} 
                                               title={t('query.history.copySQL', 'Copy SQL')}
                                           >
                                               <Copy className="w-4 h-4" />
                                           </button>
                                           <button 
                                               onClick={(e) => { e.stopPropagation(); handleOpenInWorkbench(log.sql); }}
                                               className={`p-1.5 rounded ${isDark ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'}`} 
                                               title={t('query.history.runInWorkbench', 'Run in Workbench')}
                                           >
                                               <Play className="w-4 h-4" />
                                           </button>
                                       </div>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
               <div className={`p-2 text-center ${isDark ? 'border-t border-gray-700 bg-gray-750' : 'border-t border-gray-200 bg-gray-50'}`}>
                   <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{t('common.loadMore', 'Load more records...')}</button>
               </div>
           </div>

           {/* Detail Drawer */}
           {selectedLog && (
               <div className={`w-96 rounded-xl border flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-200 shadow-xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                   <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                       <h3 className={`font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                           <FileText className="w-4 h-4 mr-2 text-purple-400" /> {t('query.history.queryDetails', 'Query Details')}
                       </h3>
                       <button onClick={() => setSelectedLog(null)} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}><XCircle className="w-5 h-5"/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-4 space-y-6">
                       {selectedLog.status === 'ERROR' && (
                           <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                               <h4 className="text-xs font-bold text-red-400 flex items-center mb-1">
                                   <AlertTriangle className="w-3 h-3 mr-1.5" /> {t('query.history.executionFailed', 'Execution Failed')}
                               </h4>
                               <p className="text-xs text-red-200 font-mono break-words">{selectedLog.errorMsg}</p>
                           </div>
                       )}

                       <div>
                           <div className="flex justify-between items-center mb-2">
                               <label className={`text-xs font-bold uppercase ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('query.history.sqlStatement', 'SQL Statement')}</label>
                               <button 
                                   onClick={() => copyToClipboard(selectedLog.sql)}
                                   className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center"
                               >
                                   <Copy className="w-3 h-3 mr-1" /> {t('common.copy', 'Copy')}
                               </button>
                           </div>
                           <div className={`p-3 rounded-lg border overflow-x-auto ${isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                               <code className={`text-xs font-mono leading-relaxed whitespace-pre-wrap ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                                   {selectedLog.sql}
                               </code>
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div className={`p-3 rounded border ${isDark ? 'bg-gray-700/20 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                               <label className={`text-[10px] uppercase block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('common.duration', 'Duration')}</label>
                               <span className={`font-mono text-sm font-bold ${selectedLog.duration > 1000 ? 'text-yellow-400' : isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                   {selectedLog.duration.toFixed(3)} ms
                               </span>
                           </div>
                           <div className={`p-3 rounded border ${isDark ? 'bg-gray-700/20 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                               <label className={`text-[10px] uppercase block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('query.history.affectedRows', 'Affected Rows')}</label>
                               <span className={`font-mono text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedLog.rows?.toLocaleString()}</span>
                           </div>
                       </div>

                       <div>
                           <label className={`text-xs font-bold uppercase mb-2 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('query.history.contextMetadata', 'Context Metadata')}</label>
                           <div className="space-y-2 text-xs">
                               <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                   <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('common.requestId', 'Request ID')}</span>
                                   <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.id}</span>
                               </div>
                               <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                   <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('common.clientIp', 'Client IP')}</span>
                                   <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.clientIp}</span>
                               </div>
                               <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                   <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('common.user', 'User')}</span>
                                   <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.user}</span>
                               </div>
                               <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                   <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('common.database', 'Database')}</span>
                                   <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.db}</span>
                               </div>
                           </div>
                       </div>
                   </div>

                   <div className={`p-4 border-t ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                       <button 
                           onClick={() => handleOpenInWorkbench(selectedLog.sql)}
                           className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center shadow-lg shadow-blue-900/20"
                       >
                           <Terminal className="w-4 h-4 mr-2" /> {t('query.history.openInWorkbench', 'Open in Workbench')}
                       </button>
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};
