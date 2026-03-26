import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { FileText, Search, Download, Filter, Pause, Play, RefreshCw, X, ChevronDown, Terminal, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LogEntry {
    id: string;
    ts: Date;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    component: string;
    host: string;
    message: string;
    stackTrace?: string;
}

const COMPONENTS = ['mnode', 'dnode-1', 'dnode-2', 'gateway-api', 'flink-job-01'];
const MESSAGES = {
    INFO: ['Connection established from 192.168.1.50', 'Checkpoint completed in 45ms', 'Compaction started for vnode 102', 'Query executed successfully', 'Metrics flushed to storage'],
    WARN: ['High memory usage detected (85%)', 'Slow query log: duration > 500ms', 'Connection pool exhausted, waiting...', 'Retry attempt 2/5 for Kafka consumer', 'Disk usage approaching quota'],
    ERROR: ['OutOfMemoryError: Java heap space', 'Connection refused: target machine actively refused it', 'WAL sync failed: disk I/O error', 'Failed to parse JSON payload: unexpected token', 'Node heartbeat timeout: dnode-3'],
    DEBUG: ['Payload size: 1024 bytes', 'Parsing packet header: 0xAF01', 'Transaction ID: tx_99283 generated', 'Entering method: processBatch()', 'Cache miss for key: sensor_01_meta']
};

const generateLogs = (count: number): LogEntry[] => {
    return Array.from({ length: count }).map((_, i) => {
        const rand = Math.random();
        let level: LogEntry['level'] = 'INFO';
        if (rand > 0.95) level = 'ERROR';
        else if (rand > 0.85) level = 'WARN';
        else if (rand > 0.70) level = 'DEBUG';
        const msgIndex = Math.floor(Math.random() * MESSAGES[level].length);
        const timestamp = new Date(Date.now() - Math.floor(Math.random() * 3600000));
        return {
            id: `log_${Date.now()}_${i}`,
            ts: timestamp,
            level,
            component: COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)],
            host: '10.0.0.' + Math.floor(Math.random() * 5 + 10),
            message: MESSAGES[level][msgIndex] + (Math.random() > 0.5 ? ' [Details hidden]' : ''),
            stackTrace: level === 'ERROR' ? `java.lang.OutOfMemoryError: Java heap space\n\tat com.tdengine.adapter.BatchProcessor.run(BatchProcessor.java:120)` : undefined
        };
    }).sort((a, b) => b.ts.getTime() - a.ts.getTime());
};

export const OperationsLogs: React.FC = () => {
    const { t } = useTranslation();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filterText, setFilterText] = useState('');
    const [levelFilter, setLevelFilter] = useState<string>('ALL');
    const [componentFilter, setComponentFilter] = useState<string>('ALL');
    const [isLive, setIsLive] = useState(false);
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setLogs(generateLogs(500)); }, []);
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLive) {
            interval = setInterval(() => {
                const newLog = generateLogs(1)[0];
                newLog.ts = new Date();
                setLogs(prev => [newLog, ...prev].slice(0, 1000));
            }, 800);
        }
        return () => clearInterval(interval);
    }, [isLive]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
            if (componentFilter !== 'ALL' && log.component !== componentFilter) return false;
            if (filterText && !log.message.toLowerCase().includes(filterText.toLowerCase())) return false;
            return true;
        });
    }, [logs, levelFilter, componentFilter, filterText]);

    const histogramData = useMemo(() => {
        const buckets: Record<string, { time: string, count: number, errors: number }> = {};
        logs.forEach(log => {
            const key = new Date(Math.floor(log.ts.getTime() / 60000) * 60000).toISOString();
            if (!buckets[key]) buckets[key] = { time: new Date(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), count: 0, errors: 0 };
            buckets[key].count++;
            if (log.level === 'ERROR') buckets[key].errors++;
        });
        return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time)).slice(-20);
    }, [logs]);

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'ERROR': return 'text-red-400 bg-red-900/20 border-red-900/50';
            case 'WARN': return 'text-yellow-400 bg-yellow-900/20 border-yellow-900/50';
            case 'DEBUG': return isDark ? 'text-gray-400 bg-gray-700/50 border-gray-600' : 'text-gray-600 bg-gray-200 border-gray-300';
            default: return 'text-blue-400 bg-blue-900/20 border-blue-900/50';
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
            {/* Header / Toolbar */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            <FileText className={`w-6 h-6 mr-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            {t('logs.title', 'Log Center')}
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('logs.description', 'Centralized system, application, and audit logs.')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsLive(!isLive)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center border ${
                                isLive 
                                ? 'bg-red-900/20 text-red-400 border-red-500/50 hover:bg-red-900/30' 
                                : (isDark ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200')
                            }`}
                        >
                            {isLive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            {isLive ? t('logs.pauseLive', 'Pause Live') : t('logs.liveTail', 'Live Tail')}
                        </button>
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
                            <Download className="w-4 h-4 mr-2" /> {t('common.export', 'Export')}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input 
                            type="text" 
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder={t('logs.searchPlaceholder', 'Search logs (e.g. \'connection refused\')...')} 
                            className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                        />
                    </div>
                    
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                        <Filter className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <span className={`text-xs border-r pr-2 mr-2 ${isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>{t('common.level', 'Level')}</span>
                        <select 
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            className={`text-sm outline-none cursor-pointer ${isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}
                        >
                            <option value="ALL">{t('logs.allLevels', 'All Levels')}</option>
                            <option value="INFO">INFO</option>
                            <option value="WARN">WARN</option>
                            <option value="ERROR">ERROR</option>
                            <option value="DEBUG">DEBUG</option>
                        </select>
                    </div>

                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                        <Terminal className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <span className={`text-xs border-r pr-2 mr-2 ${isDark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>{t('logs.component', 'Component')}</span>
                        <select 
                            value={componentFilter}
                            onChange={(e) => setComponentFilter(e.target.value)}
                            className={`text-sm outline-none cursor-pointer ${isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}
                        >
                            <option value="ALL">{t('logs.allComponents', 'All Components')}</option>
                            {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Middle: Volume Chart */}
            <div className={`h-32 rounded-xl border p-4 shrink-0 relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-xs font-bold uppercase absolute top-4 left-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('logs.logVolume', 'Log Volume (Last 20m)')}</h3>
                <div className="w-full h-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogramData}>
                            <XAxis dataKey="time" hide />
                            <Tooltip 
                                cursor={{fill: isDark ? '#374151' : '#f3f4f6', opacity: 0.4}}
                                contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937', fontSize: '12px' }}
                            />
                            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]}>
                                {histogramData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.errors > 0 ? '#ef4444' : '#3b82f6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Main Log List */}
            <div className={`flex-1 rounded-xl border overflow-hidden flex relative ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar" ref={listRef}>
                    <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className={`sticky top-0 z-10 font-sans ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                            <tr>
                                <th className={`p-3 border-b w-40 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.timestamp', 'Timestamp')}</th>
                                <th className={`p-3 border-b w-24 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.level', 'Level')}</th>
                                <th className={`p-3 border-b w-32 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('logs.service', 'Service')}</th>
                                <th className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.message', 'Message')}</th>
                            </tr>
                        </thead>
                        <tbody className={isDark ? 'divide-y divide-gray-800' : 'divide-y divide-gray-100'}>
                            {filteredLogs.map(log => (
                                <tr 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className={`cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-blue-900/20' : (isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}`}
                                >
                                    <td className={`p-2 pl-3 whitespace-nowrap align-top ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {log.ts.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
                                        <span className="text-[10px] opacity-70">{log.ts.getMilliseconds()}</span>
                                    </td>
                                    <td className="p-2 text-center align-top">
                                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getLevelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className={`p-2 whitespace-nowrap align-top ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {log.component}
                                    </td>
                                    <td className={`p-2 break-all align-top ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {log.message}
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className={`p-12 text-center font-sans ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {t('logs.noLogsFound', 'No logs found matching your criteria.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Detail Drawer */}
                {selectedLog && (
                    <div className={`w-96 border-l flex flex-col shrink-0 shadow-2xl animate-in slide-in-from-right duration-200 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                            <h3 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('logs.logDetails', 'Log Details')}</h3>
                            <button onClick={() => setSelectedLog(null)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                                <label className={`text-xs uppercase font-bold block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('common.timestamp', 'Timestamp')}</label>
                                <span className={`text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.ts.toISOString()}</span>
                            </div>
                            <div>
                                <label className={`text-xs uppercase font-bold block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('logs.componentHost', 'Component / Host')}</label>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{selectedLog.component}</span>
                                    <span className={isDark ? 'text-gray-500 text-xs' : 'text-gray-400 text-xs'}>@</span>
                                    <span className={`text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.host}</span>
                                </div>
                            </div>
                            <div>
                                <label className={`text-xs uppercase font-bold block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('common.message', 'Message')}</label>
                                <div className={`p-3 rounded border text-sm font-mono break-words ${isDark ? 'bg-black/30 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                    {selectedLog.message}
                                </div>
                            </div>
                            
                            {selectedLog.stackTrace && (
                                <div>
                                    <label className={`text-xs uppercase font-bold block mb-1 flex items-center text-red-400`}>
                                        <AlertTriangle className="w-3 h-3 mr-1" /> {t('logs.stackTrace', 'Stack Trace')}
                                    </label>
                                    <div className="bg-red-900/10 border border-red-900/30 p-3 rounded overflow-x-auto">
                                        <pre className="text-[10px] text-red-300 font-mono whitespace-pre-wrap">
                                            {selectedLog.stackTrace}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
