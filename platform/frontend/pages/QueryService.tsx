import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { api } from '../src/services/api';
import { generateSqlFromNaturalLanguage } from '../services/geminiService';
import { SAMPLE_QUERIES } from '../constants';
import { toast } from '../src/hooks/use-toast';
import {
  Play,
  Sparkles,
  Save,
  Clock,
  Trash2,
  FileJson,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  Loader2,
  History,
  Bookmark,
  Search,
  MoreHorizontal,
  Download,
  Copy,
  Check
} from 'lucide-react';

// --- Types ---
interface QueryResult {
  columns: string[];
  data: any[];
  rows: number;
}

interface QueryHistory {
  id: string;
  sql: string;
  timestamp: number;
  duration: number;
}

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
}

// --- Query Result Table Component ---
interface QueryResultTableProps {
  data: QueryResult;
  isDark: boolean;
  loading?: boolean;
}

const QueryResultTable: React.FC<QueryResultTableProps> = ({ data, isDark, loading }) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-2" />
        {t('common.loading', '加载中...')}
      </div>
    );
  }

  if (!data || !data.columns || data.columns.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <FileJson className="w-12 h-12 mb-4 opacity-50" />
        <p>{t('queryService.noData', '执行查询以查看结果')}</p>
      </div>
    );
  }

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className="overflow-auto max-h-[calc(100vh-24rem)]">
        <table className="w-full text-left text-sm">
          <thead className={`sticky top-0 text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
            <tr>
              {data.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="p-3 font-medium whitespace-nowrap cursor-pointer hover:bg-opacity-80 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortColumn === col && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
            {data.data && data.data.length > 0 ? (
              data.data.map((row, index) => (
                <tr key={index} className={`${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  {data.columns.map((col) => (
                    <td key={col} className={`p-3 font-mono text-xs whitespace-nowrap ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={data.columns.length} className={`p-8 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                  {t('queryService.noDataRows', '没有数据行')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data.rows > 0 && (
        <div className={`px-4 py-2 text-xs border-t ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-600'}`}>
          {t('queryService.totalRows', '共 {{count}} 行', { count: data.rows })}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---
export const QueryService: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Editor state
  const [query, setQuery] = useState('SELECT * FROM device_db.Welding LIMIT 100;');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Assistant state
  const [prompt, setPrompt] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executionTime, setExecutionTime] = useState(0);

  // History and Saved Queries state
  const [history, setHistory] = useState<QueryHistory[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load history and saved queries from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('queryService_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }

    const saved = localStorage.getItem('queryService_saved');
    if (saved) {
      try {
        setSavedQueries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved queries:', e);
      }
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: QueryHistory[]) => {
    localStorage.setItem('queryService_history', JSON.stringify(newHistory));
    setHistory(newHistory);
  }, []);

  // Save queries to localStorage
  const saveQueries = useCallback((queries: SavedQuery[]) => {
    localStorage.setItem('queryService_saved', JSON.stringify(queries));
    setSavedQueries(queries);
  }, []);

  // AI Generate SQL
  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setLoadingAi(true);

    const schemaContext = `
      SuperTable device_db.Welding (ts TIMESTAMP, weldingCurrent DOUBLE, weldingVoltage DOUBLE, wireSpeed DOUBLE, gasFlow DOUBLE, arcLength DOUBLE) TAGS (deviceId BINARY(64), weldingMethod BINARY(32))
      SuperTable device_db.ThermalTreatment (ts TIMESTAMP, temperature DOUBLE, holdTime INT) TAGS (deviceId BINARY(64), processType BINARY(32))
      SuperTable device_db.Inspection (ts TIMESTAMP, defectType BINARY(32), confidence DOUBLE) TAGS (deviceId BINARY(64), inspectionType BINARY(32))
    `;

    try {
      const generatedSql = await generateSqlFromNaturalLanguage(prompt, schemaContext);
      setQuery(generatedSql);
      toast({
        title: t('queryService.aiGenerated', 'AI 生成成功'),
        description: t('queryService.sqlGeneratedDesc', 'SQL 已生成并填入编辑器'),
      });
    } catch (error) {
      toast({
        title: t('queryService.aiError', 'AI 生成失败'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setLoadingAi(false);
    }
  };

  // Execute Query
  const handleExecute = async () => {
    if (!query.trim()) {
      toast({
        title: t('queryService.emptyQuery', '查询为空'),
        description: t('queryService.pleaseEnterSql', '请输入 SQL 查询语句'),
        variant: 'destructive',
      });
      return;
    }

    setExecuting(true);
    const startTime = performance.now();

    try {
      const response = await api.tdengine.query(query);
      const duration = performance.now() - startTime;
      setExecutionTime(duration);

      if (response.success && response.data) {
        const queryData = response.data.data || {};
        const columns = queryData.columns || [];
        const data = queryData.data || [];
        const rows = data.length;

        const resultData: QueryResult = {
          columns,
          data,
          rows
        };

        setResult(resultData);

        // Add to history
        const newHistoryItem: QueryHistory = {
          id: Date.now().toString(),
          sql: query,
          timestamp: Date.now(),
          duration
        };
        const newHistory = [newHistoryItem, ...history].slice(0, 50); // Keep last 50
        saveHistory(newHistory);

        toast({
          title: t('queryService.executionSuccess', '执行成功'),
          description: t('queryService.executionSuccessDesc', '{{rows}} 行，{{time}}ms', {
            rows,
            time: duration.toFixed(2)
          }),
        });
      } else {
        setResult({ columns: [], data: [], rows: 0 });
        toast({
          title: t('queryService.executionError', '执行失败'),
          description: response.error || t('queryService.unknownError', '未知错误'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      setExecutionTime(duration);
      setResult({ columns: [], data: [], rows: 0 });

      toast({
        title: t('queryService.executionError', '执行失败'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  // Load query from history or saved
  const loadQuery = (sql: string) => {
    setQuery(sql);
    setShowHistory(false);
    setShowSaved(false);
  };

  // Save current query
  const handleSaveQuery = () => {
    if (!saveQueryName.trim()) return;

    const newSaved: SavedQuery = {
      id: Date.now().toString(),
      name: saveQueryName,
      sql: query,
      createdAt: Date.now()
    };

    saveQueries([newSaved, ...savedQueries]);
    setSaveQueryName('');
    setShowSaveDialog(false);

    toast({
      title: t('queryService.saved', '已保存'),
      description: t('queryService.querySaved', '查询已保存到收藏夹'),
    });
  };

  // Delete from history
  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    saveHistory(newHistory);
  };

  // Delete saved query
  const deleteSavedQuery = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSaved = savedQueries.filter(s => s.id !== id);
    saveQueries(newSaved);
  };

  // Clear query
  const clearQuery = () => {
    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Copy to clipboard
  const [copied, setCopied] = useState(false);
  const copyToClipboard = async () => {
    if (!result) return;
    try {
      const text = JSON.stringify(result.data, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: t('queryService.copyFailed', '复制失败'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {t('queryService.title', 'SQL 查询工作室')}
        </h1>
        <div className="flex items-center gap-2">
          <Database className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            TDengine
          </span>
        </div>
      </div>

      {/* AI Assistant Bar */}
      <div className={`rounded-lg p-4 flex gap-4 items-center border ${
        isDark
          ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30'
          : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
      }`}>
        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
          <Sparkles className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
          placeholder={t('queryService.aiPlaceholder', '输入自然语言描述，让 AI 生成 SQL（例如：查询最近一小时的焊接电流平均值）')}
          className={`flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm ${
            isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
          }`}
        />
        <button
          onClick={handleAiGenerate}
          disabled={loadingAi || !prompt.trim()}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            isDark
              ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white'
              : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white'
          }`}
        >
          {loadingAi ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('queryService.generating', '生成中...')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t('queryService.generateSQL', '生成 SQL')}
            </>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* SQL Editor */}
        <div className={`flex flex-col rounded-lg border overflow-hidden ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {/* Editor Toolbar */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${
            isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-4">
              {/* History Dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowHistory(!showHistory); setShowSaved(false); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
                    isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <History className="w-4 h-4" />
                  {t('queryService.history', '历史')}
                  {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showHistory && (
                  <div className={`absolute top-full left-0 mt-1 w-96 max-h-64 overflow-auto rounded-lg border shadow-lg z-20 ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    {history.length === 0 ? (
                      <div className={`p-4 text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('queryService.noHistory', '暂无历史记录')}
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => loadQuery(item.sql)}
                          className={`p-3 border-b cursor-pointer transition-colors ${
                            isDark
                              ? 'border-gray-700 hover:bg-gray-700/50'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <code className={`text-xs font-mono truncate flex-1 mr-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {item.sql.length > 50 ? item.sql.substring(0, 50) + '...' : item.sql}
                            </code>
                            <button
                              onClick={(e) => deleteFromHistory(item.id, e)}
                              className={`p-1 rounded hover:bg-red-500/20 hover:text-red-400 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className={`flex items-center gap-2 mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {formatTime(item.timestamp)}
                            <span>•</span>
                            <span>{item.duration.toFixed(2)}ms</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Saved Dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowSaved(!showSaved); setShowHistory(false); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
                    isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {t('queryService.saved', '已保存')}
                  {showSaved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showSaved && (
                  <div className={`absolute top-full left-0 mt-1 w-80 max-h-64 overflow-auto rounded-lg border shadow-lg z-20 ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    {savedQueries.length === 0 ? (
                      <div className={`p-4 text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('queryService.noSavedQueries', '暂无保存的查询')}
                      </div>
                    ) : (
                      savedQueries.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => loadQuery(item.sql)}
                          className={`p-3 border-b cursor-pointer transition-colors ${
                            isDark
                              ? 'border-gray-700 hover:bg-gray-700/50'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {item.name}
                            </span>
                            <button
                              onClick={(e) => deleteSavedQuery(item.id, e)}
                              className={`p-1 rounded hover:bg-red-500/20 hover:text-red-400 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <code className={`text-xs font-mono block mt-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.sql}
                          </code>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Clear Button */}
              <button
                onClick={clearQuery}
                className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {t('queryService.clear', '清空')}
              </button>
            </div>

            {/* Sample Queries */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t('queryService.samples', '示例')}:
              </span>
              {SAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => loadQuery(q)}
                  className={`text-xs px-2 py-1 rounded truncate max-w-[120px] transition-colors ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title={q}
                >
                  {t('queryService.queryN', '查询 {{n}}', { n: i + 1 })}
                </button>
              ))}
            </div>
          </div>

          {/* Editor Textarea */}
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('queryService.sqlPlaceholder', '输入 SQL 查询... (Ctrl+Enter 执行)')}
            className={`flex-1 min-h-[160px] p-4 font-mono text-sm resize-none focus:outline-none ${
              isDark
                ? 'bg-[#1e1e1e] text-gray-300 placeholder-gray-600'
                : 'bg-gray-50 text-gray-800 placeholder-gray-400'
            }`}
            spellCheck={false}
          />

          {/* Editor Footer */}
          <div className={`flex items-center justify-between px-4 py-3 border-t ${
            isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('queryService.shortcutHint', '按 Ctrl+Enter 执行查询')}
            </div>
            <div className="flex items-center gap-3">
              {/* Save Query Button */}
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={!query.trim()}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:text-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:text-gray-400'
                }`}
              >
                <Save className="w-4 h-4" />
                {t('queryService.saveQuery', '保存')}
              </button>

              {/* Execute Button */}
              <button
                onClick={handleExecute}
                disabled={executing || !query.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded font-medium transition-colors shadow-lg ${
                  isDark
                    ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white shadow-green-900/20'
                    : 'bg-green-600 hover:bg-green-500 disabled:bg-green-300 text-white shadow-green-200'
                }`}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('queryService.executing', '执行中...')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    {t('queryService.execute', '执行')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Query Results */}
        <div className={`flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden ${
          isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {/* Results Header */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <FileJson className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('queryService.queryResults', '查询结果')}
              </span>
              {result && result.rows > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                }`}>
                  {result.rows} {t('queryService.rows', '行')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {executionTime > 0 && (
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('queryService.executionTime', '耗时 {{time}}s', { time: (executionTime / 1000).toFixed(3) })}
                </span>
              )}
              {result && result.rows > 0 && (
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    copied
                      ? 'bg-green-500/20 text-green-400'
                      : isDark
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? t('queryService.copied', '已复制') : t('queryService.copy', '复制')}
                </button>
              )}
            </div>
          </div>

          {/* Results Table */}
          <div className="flex-1 p-4 overflow-hidden">
            <QueryResultTable data={result || { columns: [], data: [], rows: 0 }} isDark={isDark} loading={executing} />
          </div>
        </div>
      </div>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-96 rounded-lg border shadow-xl p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {t('queryService.saveQueryTitle', '保存查询')}
            </h3>
            <input
              type="text"
              value={saveQueryName}
              onChange={(e) => setSaveQueryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveQueryName.trim() && handleSaveQuery()}
              placeholder={t('queryService.queryNamePlaceholder', '输入查询名称...')}
              className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
              }`}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowSaveDialog(false); setSaveQueryName(''); }}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                onClick={handleSaveQuery}
                disabled={!saveQueryName.trim()}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white'
                }`}
              >
                {t('common.save', '保存')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryService;
