import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { api, apiClient } from '../src/services/api';
import { toast } from '../src/hooks/use-toast';
import { 
  Database, Table, Layers, Eye, ChevronRight, ChevronDown, 
  Search, Terminal, Activity, Tag, Box, ArrowRight, MoreHorizontal, Loader2, RefreshCw,
  Plus, Trash2, Edit3, Save, X, Settings2, Play, FileJson
} from 'lucide-react';
import { Page } from '../types';

// --- Types ---
type NodeType = 'DB' | 'CATEGORY' | 'STABLE' | 'TABLE' | 'VIEW';

interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  children?: TreeNode[];
  expanded?: boolean;
  parentId?: string;
  dbName?: string;
  loading?: boolean;
  superTableName?: string;
  tags?: Record<string, any>;
}

interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

interface TagInfo {
  name: string;
  type: string;
  length?: number;
}

interface SchemaData {
  columns: ColumnInfo[];
  tags: TagInfo[];
}

interface QueryResult {
  columns: string[];
  data: any[];
  rows: number;
}

// SchemaEditor Sub-Component
interface SchemaEditorProps {
  columns: ColumnInfo[];
  tags: TagInfo[];
  tagValues?: Record<string, any>;
  isDark: boolean;
  readOnly?: boolean;
  onAddColumn?: () => void;
  onAddTag?: () => void;
  onDeleteColumn?: (name: string) => void;
  onDeleteTag?: (name: string) => void;
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({
  columns,
  tags,
  tagValues,
  isDark,
  readOnly = false,
  onAddColumn,
  onAddTag,
  onDeleteColumn,
  onDeleteTag
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-8">
      {/* Columns Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <Activity className="w-4 h-4 mr-2 text-blue-400" /> 
            {t("realtimeTables.dataColumns", "数据列 (Metrics)")}
          </h4>
          {!readOnly && onAddColumn && (
            <button 
              onClick={onAddColumn} 
              className="text-xs flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded transition-colors border border-blue-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加列")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("common.note", "备注")}</th>
                {!readOnly && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {columns.length > 0 ? columns.map((col) => (
                <tr key={col.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono ${isDark ? "text-gray-200" : "text-gray-900"}`}>{col.name}</td>
                  <td className="p-3 text-yellow-500 font-mono text-xs">{col.type}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.length || "-"}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.note || "-"}</td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      {col.name !== "ts" && onDeleteColumn && (
                        <button 
                          onClick={() => onDeleteColumn(col.name)}
                          className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-gray-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={readOnly ? 4 : 5} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                    {t("realtimeTables.noColumns", "暂无列信息")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <Tag className="w-4 h-4 mr-2 text-purple-400" /> 
            {t("realtimeTables.tags", "标签 (Tags)")}
          </h4>
          {!readOnly && onAddTag && (
            <button 
              onClick={onAddTag} 
              className="text-xs flex items-center bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-1.5 rounded transition-colors border border-purple-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加标签")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("realtimeTables.value", "值")}</th>
                {!readOnly && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {tags.length > 0 ? tags.map((tag) => (
                <tr key={tag.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono ${isDark ? "text-gray-200" : "text-gray-900"}`}>{tag.name}</td>
                  <td className="p-3 text-purple-400 font-mono text-xs">{tag.type}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{tag.length || "-"}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {tagValues && tagValues[tag.name] !== undefined ? String(tagValues[tag.name]) : "-"}
                  </td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      {onDeleteTag && (
                        <button
                          onClick={() => onDeleteTag(tag.name)}
                          className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-gray-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={readOnly ? 4 : 5} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                    {t("realtimeTables.noTags", "暂无标签")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Data Preview Table Component
interface DataPreviewTableProps {
  data: QueryResult;
  isDark: boolean;
  loading?: boolean;
}

const DataPreviewTable: React.FC<DataPreviewTableProps> = ({ data, isDark, loading }) => {
  const { t } = useTranslation();

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
        <Table className="w-12 h-12 mb-4 opacity-50" />
        <p>{t('realtimeTables.noData', '暂无数据')}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className="overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-left text-sm">
          <thead className={`sticky top-0 text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
            <tr>
              {data.columns.map((col) => (
                <th key={col} className="p-3 font-medium whitespace-nowrap">{col}</th>
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
                  {t('realtimeTables.noDataRows', '没有数据行')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data.rows > 0 && (
        <div className={`px-4 py-2 text-xs border-t ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-600'}`}>
          {t('realtimeTables.totalRows', '共 {{count}} 行', { count: data.rows })}
        </div>
      )}
    </div>
  );
};

// SQL Console Component
interface SQLConsoleProps {
  isDark: boolean;
  selectedNode: TreeNode | null;
}

const SQLConsole: React.FC<SQLConsoleProps> = ({ isDark, selectedNode }) => {
  const { t } = useTranslation();
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Generate default SQL based on selected node
  useEffect(() => {
    if (selectedNode) {
      let defaultSql = '';
      if (selectedNode.type === 'DB') {
        defaultSql = `-- Query database: ${selectedNode.name}\nUSE \`${selectedNode.name}\`;`;
      } else if (selectedNode.type === 'STABLE') {
        defaultSql = `SELECT * FROM \`${selectedNode.dbName}\`.\`${selectedNode.name}\` LIMIT 100;`;
      } else if (selectedNode.type === 'TABLE') {
        const tableName = selectedNode.name;
        const dbName = selectedNode.dbName || selectedNode.superTableName || '';
        defaultSql = `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT 100;`;
      }
      setSql(defaultSql);
    }
  }, [selectedNode]);

  const handleExecute = async () => {
    if (!sql.trim()) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.sqlEmpty', '请输入 SQL 语句'),
        variant: 'destructive',
      });
      return;
    }

    setExecuting(true);
    try {
      const response = await api.tdengine.query(sql);
      if (response.success && response.data) {
        // Handle different response formats
        const responseData = response.data.data || response.data;
        // Backend returns 'rows', frontend expects 'data'
        const columns = responseData.columns || [];
        const data = responseData.rows || responseData.data || [];
        if (columns.length > 0) {
          setResult({
            columns: columns,
            data: data,
            rows: data.length,
          });
          // Add to history
          if (!history.includes(sql.trim())) {
            setHistory(prev => [sql.trim(), ...prev].slice(0, 10));
          }
        } else {
          setResult({
            columns: ['Result'],
            data: [{ Result: '执行成功' }],
            rows: 1,
          });
        }
      } else {
        toast({
          title: t('common.error', 'Error'),
          description: response.error || t('realtimeTables.queryError', '查询失败'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.queryError', '查询执行失败'),
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleExecute();
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* SQL Input Area */}
      <div className={`rounded-lg border ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className={`px-4 py-2 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <Terminal className="w-4 h-4 inline mr-2" />
            {t('realtimeTables.sqlInput', 'SQL 输入')}
          </span>
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Ctrl+Enter {t('realtimeTables.toExecute', '执行')}
          </span>
        </div>
        <div className="p-4">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full h-32 p-3 font-mono text-sm rounded border outline-none focus:border-blue-500 resize-none ${
              isDark ? 'bg-gray-800 border-gray-600 text-green-400' : 'bg-white border-gray-300 text-green-600'
            }`}
            placeholder="-- Enter SQL query here...\n-- Example: SELECT * FROM db.table LIMIT 100;"
          />
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
              {history.length > 0 && (
                <select
                  onChange={(e) => e.target.value && setSql(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-700'}`}
                >
                  <option value="">{t('realtimeTables.history', '历史记录')}</option>
                  {history.map((h, i) => (
                    <option key={i} value={h}>{h.substring(0, 50)}{h.length > 50 ? '...' : ''}</option>
                  ))}
                </select>
              )}
            </div>
            <button 
              onClick={handleExecute}
              disabled={executing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.executing', '执行中...')}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {t('common.execute', '执行')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Query Result */}
      <div className="flex-1 min-h-0">
        <div className={`h-full rounded-lg border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <div className={`px-4 py-2 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <FileJson className="w-4 h-4 inline mr-2" />
              {t('realtimeTables.queryResult', '查询结果')}
            </span>
            {result && (
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t('realtimeTables.rowsReturned', '{{count}} 行', { count: result.rows })}
              </span>
            )}
          </div>
          <div className="p-4 overflow-auto max-h-[calc(100vh-32rem)]">
            <DataPreviewTable data={result || { columns: [], data: [], rows: 0 }} isDark={isDark} loading={executing} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Database Info Component
interface DatabaseInfoProps {
  dbName: string;
  isDark: boolean;
}

const DatabaseInfo: React.FC<DatabaseInfoProps> = ({ dbName, isDark }) => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDbInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.tdengine.getDatabase(dbName);
        
        if (!result.success) {
          setError(result.error || '获取数据库信息失败');
          setInfo(null);
          return;
        }

        // 提取数据库信息 - 支持多种数据结构
        let dbInfo = null;
        const data = result.data;

        if (data) {
          if (data.data?.name || data.data?.Name) {
            // 结构: { data: { name, created_time, ... } }
            dbInfo = data.data;
          } else if (data.name || data.Name) {
            // 结构: { name, created_time, ... }
            dbInfo = data;
          }
        }

        if (!dbInfo) {
          setError('数据格式错误');
          setInfo(null);
          return;
        }

        setInfo(dbInfo);
      } catch (error) {
        console.error('Error fetching database info:', error);
        setError('获取失败');
        setInfo(null);
      } finally {
        setLoading(false);
      }
    };

    if (dbName) {
      fetchDbInfo();
    }
  }, [dbName]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        {t('common.loading', '加载中...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border ${isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"}`}>
        <div className={`flex flex-col items-center justify-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          <Database className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm font-medium">{error}</p>
          <p className="text-xs mt-1 opacity-75">{dbName}</p>
        </div>
      </div>
    );
  }

  // Helper to format value
  const formatValue = (val: any, key?: string) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    // 格式化时间字段
    if (key === 'created_time' && val) {
      try {
        const date = new Date(val);
        return date.toLocaleString('zh-CN');
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  // 安全获取字段值（支持驼峰和下划线命名）
  const getValue = (obj: any, ...keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return undefined;
  };

  // Database parameters to display
  const dbParams = info ? [
    { label: t('realtimeTables.dbName', '数据库名称'), key: 'name', value: getValue(info, 'name', 'Name') || dbName },
    { label: t('realtimeTables.createdTime', '创建时间'), key: 'created_time', value: getValue(info, 'created_time', 'createdTime', 'CreatedTime') },
    { label: t('realtimeTables.ntables', '表数量'), key: 'ntables', value: getValue(info, 'ntables', 'nTables', 'NTables') },
    { label: t('realtimeTables.vgroups', '虚拟组数'), key: 'vgroups', value: getValue(info, 'vgroups', 'vGroups', 'VGroups') },
    { label: t('realtimeTables.replica', '副本数'), key: 'replica', value: getValue(info, 'replica', 'Replica') },
    { label: t('realtimeTables.quorum', '仲裁数'), key: 'quorum', value: getValue(info, 'quorum', 'Quorum') },
    { label: t('realtimeTables.duration', 'Duration'), key: 'duration', value: getValue(info, 'duration', 'Duration') },
    { label: t('realtimeTables.keep', '数据保留时长'), key: 'keep', value: getValue(info, 'keep', 'Keep') },
    { label: t('realtimeTables.buffer', 'Buffer'), key: 'buffer', value: getValue(info, 'buffer', 'Buffer') },
    { label: t('realtimeTables.pages', 'Pages'), key: 'pages', value: getValue(info, 'pages', 'Pages') },
    { label: t('realtimeTables.pagesize', 'PageSize'), key: 'pagesize', value: getValue(info, 'pagesize', 'PageSize') },
    { label: t('realtimeTables.minrows', '最小行数'), key: 'minrows', value: getValue(info, 'minrows', 'minRows', 'MinRows') },
    { label: t('realtimeTables.maxrows', '最大行数'), key: 'maxrows', value: getValue(info, 'maxrows', 'maxRows', 'MaxRows') },
    { label: t('realtimeTables.comp', '压缩级别'), key: 'comp', value: getValue(info, 'comp', 'Comp') },
    { label: t('realtimeTables.precision', '时间精度'), key: 'precision', value: getValue(info, 'precision', 'Precision') },
    { label: t('realtimeTables.wallevel', 'WAL级别'), key: 'wallevel', value: getValue(info, 'wallevel', 'walLevel', 'WalLevel') },
    { label: t('realtimeTables.wal_retention_period', 'WAL保留周期'), key: 'wal_retention_period', value: getValue(info, 'wal_retention_period', 'WalRetentionPeriod') },
    { label: t('realtimeTables.wal_fsync_period', 'WAL同步周期'), key: 'wal_fsync_period', value: getValue(info, 'wal_fsync_period', 'WalFsyncPeriod') },
    { label: t('realtimeTables.stt_trigger', 'STT触发器'), key: 'stt_trigger', value: getValue(info, 'stt_trigger', 'SttTrigger') },
    { label: t('realtimeTables.cachemodel', '缓存模型'), key: 'cachemodel', value: getValue(info, 'cachemodel', 'CacheModel') },
    { label: t('realtimeTables.cachesize', '缓存大小'), key: 'cachesize', value: getValue(info, 'cachesize', 'CacheSize') },
    { label: t('realtimeTables.strict', 'Strict'), key: 'strict', value: getValue(info, 'strict', 'Strict') },
    { label: t('realtimeTables.status', '状态'), key: 'status', value: getValue(info, 'status', 'Status') },
  ] : [];


  return (
    <div className={`p-6 rounded-lg border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
      <h4 className={`text-lg font-semibold mb-6 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
        <Database className="w-5 h-5 mr-2 text-yellow-500" />
        {dbName}
        <span className={`ml-3 text-xs px-2 py-1 rounded ${isDark ? 'bg-green-600/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
          {t('realtimeTables.database', '数据库')}
        </span>
      </h4>
      
      {info ? (
        <div className="space-y-6">
          {/* Basic Info Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.basicInfo', '基本信息')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(0, 4).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.configuration', '配置参数')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(4, 12).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.advancedSettings', '高级设置')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(12).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            {t('realtimeTables.dbInfoHint', '选择超级表或子表查看详细结构')}
          </div>
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center h-32 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Database className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">{t('realtimeTables.noDbInfo', '暂无数据库信息')}</p>
        </div>
      )}
    </div>
  );
};

export const RealtimeTables: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const navigate = useNavigate();

  // Tree state
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'manage' | 'sql'>('data');
  
  // Performance optimization: loading state and cache for tree nodes
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [loadedCache, setLoadedCache] = useState<Set<string>>(new Set());
  
  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [isEditingColumns, setIsEditingColumns] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newColumn, setNewColumn] = useState<Partial<ColumnInfo>>({
    name: '',
    type: 'FLOAT',
    length: undefined,
    note: ''
  });
  const [newTag, setNewTag] = useState<Partial<TagInfo>>({
    name: '',
    type: 'VARCHAR',
    length: 64
  });
  
  // Schema state - dynamic loading
  const [schema, setSchema] = useState<SchemaData>({ columns: [], tags: [] });
  const [schemaLoading, setSchemaLoading] = useState(false);
  
  // Sub-table tag values
  const [subTableTagValues, setSubTableTagValues] = useState<Record<string, any>>({});

  // Data preview state
  const [dataPreview, setDataPreview] = useState<QueryResult | null>(null);
  const [dataPreviewLoading, setDataPreviewLoading] = useState(false);

  // Fetch tree data
  const fetchTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.tdengine.listDatabases();
      if (result.success && result.data) {
        // Transform database list to tree nodes
        const dbData = result.data.data?.databases || result.data.databases || [];
        const dbNodes: TreeNode[] = dbData.map((db: any) => ({
          id: db.name || db.Name || db,
          name: db.name || db.Name || db,
          type: 'DB' as NodeType,
          expanded: false,
          children: [
            { id: `${db.name || db}_st`, name: 'Super Tables', type: 'CATEGORY' as NodeType, expanded: false, children: [] },
            { id: `${db.name || db}_t`, name: 'Tables', type: 'CATEGORY' as NodeType, expanded: false, children: [] },
          ]
        }));
        setTreeData(dbNodes);
      } else {
        setTreeData([]);
      }
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.fetchError', 'Failed to fetch database tree'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  // Load schema when selected node changes
  useEffect(() => {
    const loadSchema = async () => {
      if (!selectedNode) {
        setSchema({ columns: [], tags: [] });
        setSubTableTagValues({});
        return;
      }

      setSchemaLoading(true);
      try {
        if (selectedNode.type === 'STABLE' && selectedNode.dbName) {
          // Load super table schema
          const result = await api.tdengine.getSuperTableSchema(selectedNode.dbName, selectedNode.name);
          if (result.success && result.data) {
            const schemaData = result.data.data || result.data;
            setSchema({
              columns: schemaData.columns || [],
              tags: schemaData.tags || [],
            });
          }
          setSubTableTagValues({});
        } else if (selectedNode.type === 'TABLE') {
          // For sub-table, load parent super table schema and sub-table tag values
          const dbName = selectedNode.dbName;
          const superTableName = selectedNode.superTableName;
          if (dbName && superTableName) {
            const result = await api.tdengine.getSuperTableSchema(dbName, superTableName);
            if (result.success && result.data) {
              const schemaData = result.data.data || result.data;
              setSchema({
                columns: schemaData.columns || [],
                tags: schemaData.tags || [],
              });
            }
          } else if (dbName) {
            // Try to get table info directly
            const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
            if (result.success && result.data) {
              const info = result.data.data || result.data;
              setSchema({
                columns: info.schema?.columns || [],
                tags: info.schema?.tags || [],
              });
            }
          }
          
          // Load sub-table tag values
          if (dbName) {
            const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
            if (result.success && result.data) {
              const info = result.data.data || result.data;
              setSubTableTagValues(info.tags || {});
            } else {
              setSubTableTagValues({});
            }
          }
        } else {
          setSchema({ columns: [], tags: [] });
          setSubTableTagValues({});
        }
      } catch (error) {
        console.error('Failed to load schema:', error);
        setSchema({ columns: [], tags: [] });
        setSubTableTagValues({});
      } finally {
        setSchemaLoading(false);
      }
    };

    loadSchema();
  }, [selectedNode]);

  // Load data preview when selected node changes (for Data tab)
  useEffect(() => {
    const loadDataPreview = async () => {
      if (!selectedNode || (selectedNode.type !== 'STABLE' && selectedNode.type !== 'TABLE')) {
        setDataPreview(null);
        return;
      }

      setDataPreviewLoading(true);
      try {
        let sql = '';
        if (selectedNode.type === 'STABLE' && selectedNode.dbName) {
          sql = `SELECT * FROM \`${selectedNode.dbName}\`.\`${selectedNode.name}\` LIMIT 100`;
        } else if (selectedNode.type === 'TABLE') {
          const dbName = selectedNode.dbName;
          if (dbName) {
            sql = `SELECT * FROM \`${dbName}\`.\`${selectedNode.name}\` LIMIT 100`;
          }
        }

        if (sql) {
          const result = await api.tdengine.query(sql);
          if (result.success && result.data) {
            // Handle different response formats
            const responseData = result.data.data || result.data;
            // Backend returns 'rows', frontend expects 'data'
            const columns = responseData.columns || [];
            const data = responseData.rows || responseData.data || [];
            if (columns.length > 0) {
              setDataPreview({
                columns: columns,
                data: data,
                rows: data.length,
              });
            } else {
              setDataPreview({ columns: [], data: [], rows: 0 });
            }
          } else {
            setDataPreview({ columns: [], data: [], rows: 0 });
          }
        }
      } catch (error) {
        console.error('Failed to load data preview:', error);
        setDataPreview({ columns: [], data: [], rows: 0 });
      } finally {
        setDataPreviewLoading(false);
      }
    };

    loadDataPreview();
  }, [selectedNode]);

  // Handle add column
  const handleAddColumn = useCallback(() => {
    if (!newColumn.name) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.nameRequired', 'Column name is required'),
        variant: 'destructive',
      });
      return;
    }

    const column: ColumnInfo = {
      name: newColumn.name,
      type: newColumn.type || 'FLOAT',
      length: newColumn.length,
      note: newColumn.note,
    };

    setSchema(prev => ({ ...prev, columns: [...prev.columns, column] }));
    setNewColumn({ name: '', type: 'FLOAT', length: undefined, note: '' });
    setIsEditingColumns(false);
    
    toast({
      title: t('common.success', 'Success'),
      description: t('realtimeTables.columnAdded', 'Column added successfully'),
    });
  }, [newColumn, t]);

  // Handle delete column
  const handleDeleteColumn = useCallback((name: string) => {
    if (name === 'ts') {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.cannotDeleteTs', 'Cannot delete timestamp column'),
        variant: 'destructive',
      });
      return;
    }

    setSchema(prev => ({ ...prev, columns: prev.columns.filter(col => col.name !== name) }));
    
    toast({
      title: t('common.success', 'Success'),
      description: t('realtimeTables.columnDeleted', 'Column deleted successfully'),
    });
  }, [t]);

  // Handle add tag - opens the tag editing form
  const handleAddTag = useCallback(() => {
    if (!selectedNode || (selectedNode.type !== 'STABLE' && selectedNode.type !== 'TABLE')) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.selectSuperTable', '请先选择一个超级表'),
        variant: 'destructive',
      });
      return;
    }
    if (!editMode) {
      toast({
        title: t('common.info', 'Info'),
        description: t('realtimeTables.enableEditMode', '请先启用编辑模式'),
      });
      return;
    }
    setIsEditingTags(true);
  }, [editMode, selectedNode, t]);

  // Handle save tag to backend
  const handleSaveTag = useCallback(async () => {
    if (!newTag.name) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.tagNameRequired', '标签名称是必填项'),
        variant: 'destructive',
      });
      return;
    }

    // Check if tag already exists
    if (schema.tags.some(tag => tag.name === newTag.name)) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.tagExists', '标签已存在'),
        variant: 'destructive',
      });
      return;
    }

    if (!selectedNode || !selectedNode.dbName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noDatabase', '未选择数据库'),
        variant: 'destructive',
      });
      return;
    }

    const dbName = selectedNode.dbName;
    const superTableName = selectedNode.type === 'STABLE'
      ? selectedNode.name
      : selectedNode.superTableName;

    if (!superTableName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noSuperTable', '无法确定超级表'),
        variant: 'destructive',
      });
      return;
    }

    // Call backend API to add tag
    const result = await api.tdengine.alterSuperTable(dbName, superTableName, {
      action: 'ADD_TAG',
      tag: {
        name: newTag.name,
        type: newTag.type || 'VARCHAR',
        length: newTag.length,
      },
    });

    if (result.success) {
      // Add to local state
      const tag: TagInfo = {
        name: newTag.name,
        type: newTag.type || 'VARCHAR',
        length: newTag.length,
      };
      setSchema(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setNewTag({ name: '', type: 'VARCHAR', length: 64 });
      setIsEditingTags(false);
      
      toast({
        title: t('common.success', 'Success'),
        description: t('realtimeTables.tagAdded', '标签添加成功'),
      });
    } else {
      toast({
        title: t('common.error', 'Error'),
        description: result.error || t('realtimeTables.tagAddFailed', '标签添加失败'),
        variant: 'destructive',
      });
    }
  }, [newTag, schema.tags, selectedNode, t]);

  // Handle cancel tag editing
  const handleCancelTag = useCallback(() => {
    setIsEditingTags(false);
    setNewTag({ name: '', type: 'VARCHAR', length: 64 });
  }, []);

  // Handle delete tag
  const handleDeleteTag = useCallback(async (name: string) => {
    if (!editMode) {
      toast({
        title: t('common.info', 'Info'),
        description: t('realtimeTables.enableEditMode', '请先启用编辑模式'),
      });
      return;
    }

    if (!selectedNode || !selectedNode.dbName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noDatabase', '未选择数据库'),
        variant: 'destructive',
      });
      return;
    }

    const dbName = selectedNode.dbName;
    const superTableName = selectedNode.type === 'STABLE'
      ? selectedNode.name
      : selectedNode.superTableName;

    if (!superTableName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noSuperTable', '无法确定超级表'),
        variant: 'destructive',
      });
      return;
    }

    // Call backend API to delete tag
    const result = await api.tdengine.alterSuperTable(dbName, superTableName, {
      action: 'DROP_TAG',
      tag: {
        name: name,
        type: 'VARCHAR',
      },
    });

    if (result.success) {
      setSchema(prev => ({ ...prev, tags: prev.tags.filter(tag => tag.name !== name) }));
      toast({
        title: t('common.success', 'Success'),
        description: t('realtimeTables.tagDeleted', '标签删除成功'),
      });
    } else {
      toast({
        title: t('common.error', 'Error'),
        description: result.error || t('realtimeTables.tagDeleteFailed', '标签删除失败'),
        variant: 'destructive',
      });
    }
  }, [editMode, selectedNode, t]);

  // Toggle node expansion and lazy load children
  const toggleNode = async (node: TreeNode) => {
    const isExpanding = !node.expanded;
    
    // Update expansion state
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(n => {
        if (n.id === node.id) {
          return { ...n, expanded: isExpanding };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    };
    setTreeData(updateNode(treeData));
    
    // Lazy load children when expanding
    if (isExpanding) {
      if (loadedCache.has(node.id)) {
        return;
      }
      
      if (node.type === 'CATEGORY' && node.name === 'Super Tables') {
        const hasLoaded = node.children && node.children.length > 0 && node.children[0]?.type === 'STABLE';
        if (!hasLoaded) {
          const parentDb = findParentDatabase(treeData, node.id);
          if (parentDb) {
            await loadSuperTablesForDb(parentDb, node);
          }
        }
      } else if (node.type === 'STABLE') {
        const hasLoaded = node.children && node.children.length > 0;
        if (!hasLoaded) {
          await loadSubTables(node);
        }
      }
    }
  };
  
  // Find parent database for a category node
  const findParentDatabase = (nodes: TreeNode[], categoryId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.children?.some(child => child.id === categoryId)) {
        return node;
      }
      if (node.children) {
        const found = findParentDatabase(node.children, categoryId);
        if (found) return found;
      }
    }
    return null;
  };
  
  // Load super tables for a database
  const loadSuperTables = async (dbNode: TreeNode) => {
    try {
      const result = await api.tdengine.listSuperTables(dbNode.name);
      if (result.success && result.data) {
        const stData = result.data.supertables || result.data.data?.supertables || [];
        const stNodes: TreeNode[] = stData.map((st: any) => ({
          id: `${dbNode.name}_st_${st.name || st.Name}`,
          name: st.name || st.Name,
          type: 'STABLE' as NodeType,
          dbName: dbNode.name,
          expanded: false,
          children: []
        }));
        
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === dbNode.id) {
              return { ...n, children: stNodes };
            }
            return n;
          });
        };
        setTreeData(updateNode);
      }
    } catch (error) {
      console.error('Failed to load super tables:', error);
    }
  };
  
  // Load super tables for category
  const loadSuperTablesForDb = async (dbNode: TreeNode, categoryNode: TreeNode) => {
    if (loadedCache.has(categoryNode.id)) {
      return;
    }
    
    setLoadingNodeId(categoryNode.id);
    
    try {
      const result = await api.tdengine.listSuperTables(dbNode.name);
      if (result.success && result.data) {
        const stData = result.data.supertables || result.data.data?.supertables || [];
        const stNodes: TreeNode[] = stData.map((st: any) => ({
          id: `${dbNode.name}_st_${st.name || st.Name}`,
          name: st.name || st.Name,
          type: 'STABLE' as NodeType,
          dbName: dbNode.name,
          expanded: false,
          children: []
        }));
        
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === categoryNode.id) {
              return { ...n, children: stNodes };
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        setTreeData(prev => updateNode(prev));
        setLoadedCache(prev => new Set(prev).add(categoryNode.id));
      }
    } catch (error) {
      console.error('Failed to load super tables:', error);
    } finally {
      setLoadingNodeId(null);
    }
  };
  
  // Load sub-tables for a super table
  const loadSubTables = async (stNode: TreeNode) => {
    if (!stNode.dbName) return;
    
    if (loadedCache.has(stNode.id)) {
      return;
    }
    
    setLoadingNodeId(stNode.id);
    
    try {
      const result = await api.tdengine.listSubTables(stNode.dbName, stNode.name);
      if (result.success && result.data) {
        const subData = result.data.subtables || result.data.data?.subtables || [];
        const subNodes: TreeNode[] = subData.map((sub: any) => ({
          id: `${stNode.dbName}_sub_${sub.name || sub.table_name || sub}`,
          name: sub.name || sub.table_name || sub,
          type: 'TABLE' as NodeType,
          dbName: stNode.dbName,
          superTableName: stNode.name,
          expanded: false
        }));
        
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === stNode.id) {
              return { ...n, children: subNodes };
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        setTreeData(prev => updateNode(prev));
        setLoadedCache(prev => new Set(prev).add(stNode.id));
      }
    } catch (error) {
      console.error('Failed to load sub tables:', error);
    } finally {
      setLoadingNodeId(null);
    }
  };

  // Render tree node
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const canExpand = node.type === 'DB' || node.type === 'CATEGORY' || node.type === 'STABLE';
    const isLoading = loadingNodeId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors ${
            isSelected
              ? (isDark ? 'bg-blue-600/30 text-blue-200' : 'bg-blue-50 text-blue-700')
              : (isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            setSelectedNode(node);
            // Auto-switch tab based on node type
            if (node.type === 'TABLE') {
              setActiveTab('data');
            } else {
              setActiveTab('manage');
            }
          }}
        >
          {canExpand ? (
            isLoading ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-500" />
            ) : node.expanded ? (
              <ChevronDown
                className="w-4 h-4 shrink-0 cursor-pointer hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node);
                }}
              />
            ) : (
              <ChevronRight
                className="w-4 h-4 shrink-0 cursor-pointer hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node);
                }}
              />
            )
          ) : (
            <span className="w-4" />
          )}
          
          {node.type === 'DB' && <Database className="w-4 h-4 shrink-0 text-yellow-500" />}
          {node.type === 'STABLE' && <Layers className="w-4 h-4 shrink-0 text-blue-500" />}
          {node.type === 'TABLE' && <Table className="w-4 h-4 shrink-0 text-green-500" />}
          {node.type === 'VIEW' && <Eye className="w-4 h-4 shrink-0 text-purple-500" />}
          
          <span className="truncate text-sm">{node.name}</span>
        </div>
        
        {hasChildren && node.expanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render content based on selected node type for Manage tab
  const renderManageContent = () => {
    if (!selectedNode) {
      return (
        <div className={`flex flex-col items-center justify-center h-64 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Settings2 className="w-12 h-12 mb-4 opacity-50" />
          <p>{t('realtimeTables.selectNodeForManage', '请选择一个数据库、超级表或子表进行管理')}</p>
        </div>
      );
    }

    if (selectedNode.type === 'DB') {
      return <DatabaseInfo dbName={selectedNode.name} isDark={isDark} />;
    }

    if (schemaLoading) {
      return (
        <div className={`flex items-center justify-center h-64 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-2" />
          {t('common.loading', '加载中...')}
        </div>
      );
    }

    // For sub-tables, show tag values from the node
    const tagValues = selectedNode.type === 'TABLE' ? selectedNode.tags : undefined;

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              {selectedNode.name}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {selectedNode.type === 'STABLE'
                ? t('realtimeTables.superTableSchema', '超级表结构')
                : selectedNode.type === 'TABLE'
                ? t('realtimeTables.subTableSchema', '子表结构 (继承自超级表)')
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Action Buttons */}
            <button
              onClick={() => navigate('/realtime-history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {t('realtimeTables.realtimeDataStream', '实时数据流')}
            </button>
            <button
              onClick={() => navigate('/query-service')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              {t('realtimeTables.queryStudio', '查询工作室')}
            </button>
            {editMode && (
              <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-yellow-600/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                {t('realtimeTables.editMode', 'Edit Mode')}
              </span>
            )}
          </div>
        </div>

        <SchemaEditor
          columns={schema.columns}
          tags={schema.tags}
          tagValues={selectedNode.type === 'TABLE' ? subTableTagValues : undefined}
          isDark={isDark}
          readOnly={!editMode}
          onAddColumn={() => setIsEditingColumns(true)}
          onAddTag={handleAddTag}
          onDeleteColumn={handleDeleteColumn}
          onDeleteTag={handleDeleteTag}
        />

        {/* Add Tag Form */}
        {isEditingTags && editMode && (
          <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
            <h4 className={`text-sm font-medium mb-4 flex items-center ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              <Tag className="w-4 h-4 mr-2" />
              {t('realtimeTables.addNewTag', '添加新标签')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.name', '名称')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.tagName', '标签名称')}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.type', '类型')}
                </label>
                <select
                  value={newTag.type}
                  onChange={(e) => setNewTag({ ...newTag, type: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="VARCHAR">VARCHAR</option>
                  <option value="BINARY">BINARY</option>
                  <option value="NCHAR">NCHAR</option>
                  <option value="INT">INT</option>
                  <option value="BIGINT">BIGINT</option>
                  <option value="FLOAT">FLOAT</option>
                  <option value="DOUBLE">DOUBLE</option>
                  <option value="SMALLINT">SMALLINT</option>
                  <option value="TINYINT">TINYINT</option>
                  <option value="BOOL">BOOL</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.length', '长度')}
                </label>
                <input
                  type="number"
                  value={newTag.length || ''}
                  onChange={(e) => setNewTag({ ...newTag, length: e.target.value ? parseInt(e.target.value) : undefined })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.optional', '可选')}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveTag}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                {t('common.add', '添加')}
              </button>
              <button
                onClick={handleCancelTag}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <X className="w-4 h-4 inline mr-1" />
                {t('common.cancel', '取消')}
              </button>
            </div>
          </div>
        )}

        {/* Add Column Form */}
        {isEditingColumns && editMode && (
          <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('realtimeTables.addNewColumn', 'Add New Column')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.name', 'Name')}
                </label>
                <input
                  type="text"
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.columnName', 'Column name')}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.type', 'Type')}
                </label>
                <select
                  value={newColumn.type}
                  onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="FLOAT">FLOAT</option>
                  <option value="INT">INT</option>
                  <option value="BIGINT">BIGINT</option>
                  <option value="DOUBLE">DOUBLE</option>
                  <option value="BINARY">BINARY</option>
                  <option value="TIMESTAMP">TIMESTAMP</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.length', 'Length')}
                </label>
                <input
                  type="number"
                  value={newColumn.length || ''}
                  onChange={(e) => setNewColumn({ ...newColumn, length: e.target.value ? parseInt(e.target.value) : undefined })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.optional', 'Optional')}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.note', 'Note')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColumn.note || ''}
                    onChange={(e) => setNewColumn({ ...newColumn, note: e.target.value })}
                    className={`flex-1 px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                      isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder={t('realtimeTables.optional', 'Optional')}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddColumn}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                {t('common.add', 'Add')}
              </button>
              <button
                onClick={() => {
                  setIsEditingColumns(false);
                  setNewColumn({ name: '', type: 'FLOAT', length: undefined, note: '' });
                }}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <X className="w-4 h-4 inline mr-1" />
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Sidebar Tree */}
      <div className={`w-64 rounded-lg flex flex-col overflow-hidden shrink-0 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t('common.search', 'Search...')}
              className={`w-full pl-8 pr-3 py-1.5 text-sm rounded border outline-none focus:border-blue-500 ${
                isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            treeData.map(node => renderTreeNode(node))
          )}
        </div>
        
        <div className={`p-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={fetchTreeData}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className={`flex items-center gap-1 px-4 py-2 border-b rounded-t-lg ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'data'
                ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
            }`}
          >
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              {t('realtimeTables.data', 'Data')}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'manage'
                ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              {t('realtimeTables.manage', 'Manage')}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'sql'
                ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
            }`}
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              {t('realtimeTables.sql', 'SQL')}
            </div>
          </button>
          
          {/* Edit Mode Toggle */}
          {activeTab === 'manage' && selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                  editMode
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')
                }`}
              >
                {editMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                {editMode ? t('common.done', 'Done') : t('common.edit', 'Edit')}
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-auto rounded-b-lg p-6 ${isDark ? 'bg-gray-800 border-x border-b border-gray-700' : 'bg-white border-x border-b border-gray-200'}`}>
          {activeTab === 'data' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {selectedNode ? selectedNode.name : t('realtimeTables.selectNode', 'Select a node')}
                </h3>
                {selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') && (
                  <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                    {t('realtimeTables.previewLimit', '预览前 100 条')}
                  </span>
                )}
              </div>
              
              {selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') ? (
                <div className="flex-1 min-h-0">
                  <DataPreviewTable 
                    data={dataPreview || { columns: [], data: [], rows: 0 }} 
                    isDark={isDark} 
                    loading={dataPreviewLoading}
                  />
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center h-64 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Table className="w-12 h-12 mb-4 opacity-50" />
                  <p>{t('realtimeTables.selectTableForData', '请选择超级表或子表查看数据')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && renderManageContent()}

          {activeTab === 'sql' && (
            <div className="h-full">
              <SQLConsole isDark={isDark} selectedNode={selectedNode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeTables;
