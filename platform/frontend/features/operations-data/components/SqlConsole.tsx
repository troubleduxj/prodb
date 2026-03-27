import React from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, ChevronRight, ChevronDown, Settings2 } from 'lucide-react';

export interface SqlConsoleProps {
  /** 是否显示 */
  show: boolean;
  /** 切换回调 */
  onToggle: () => void;
  /** SQL 内容 */
  sql?: string;
  /** SQL 变化回调 */
  onSqlChange?: (sql: string) => void;
  /** 执行回调 */
  onExecute?: () => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * SQL 控制台组件
 * 可折叠的 SQL 输入区域
 */
export const SqlConsole: React.FC<SqlConsoleProps> = ({
  show,
  onToggle,
  sql = '',
  onSqlChange,
  onExecute,
  isDark,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`rounded-xl flex flex-col overflow-hidden shrink-0 transition-all duration-300 ${
        show ? 'h-48' : 'h-10'
      } ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-2 cursor-pointer ${
          isDark ? 'bg-gray-750 hover:bg-gray-700/50' : 'bg-gray-50 hover:bg-gray-100'
        }`}
        onClick={onToggle}
      >
        <h3
          className={`text-xs font-bold flex items-center uppercase tracking-wide ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          <Terminal className="w-3 h-3 mr-2 text-green-400" />
          {t('operations.data.advancedSqlConsole', 'Advanced: SQL Console')}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('operations.data.onlyForDDL', 'Only for DDL/DCL operations')}
          </span>
          {show ? (
            <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          )}
        </div>
      </div>

      {/* SQL Input Area */}
      {show && (
        <div className="flex-1 flex flex-col">
          <textarea
            className={`flex-1 font-mono p-4 text-sm resize-none focus:outline-none ${
              isDark
                ? 'bg-[#1e1e1e] text-green-100 placeholder-gray-600'
                : 'bg-gray-50 text-green-800 placeholder-gray-400'
            }`}
            placeholder="-- Enter SQL commands directly (CREATE, ALTER, DROP)..."
            spellCheck={false}
            value={sql}
            onChange={e => onSqlChange?.(e.target.value)}
          />
          <div
            className={`p-2 flex justify-end ${
              isDark
                ? 'border-t border-gray-700 bg-gray-800'
                : 'border-t border-gray-200 bg-gray-50'
            }`}
          >
            <button
              onClick={onExecute}
              className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center"
            >
              {t('common.execute', 'Execute')}
              <Settings2 className="w-3 h-3 ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlConsole;
