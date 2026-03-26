import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Play, Loader2, FileJson } from 'lucide-react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import DataPreviewTable from './DataPreviewTable';
import type { TreeNode, QueryResult } from '../types';

interface SQLConsoleProps {
  isDark: boolean;
  selectedNode: TreeNode | null;
}

export const SQLConsole: React.FC<SQLConsoleProps> = ({ isDark, selectedNode }) => {
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

export default SQLConsole;
