import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Box, Plus, Trash2 } from 'lucide-react';
import type { TableSchema, ColumnDef } from '../types';

export interface SchemaEditorProps {
  /** Schema 数据 */
  schema: TableSchema;
  /** 添加列回调 */
  onAdd: (type: 'metric' | 'tag') => void;
  /** 删除列回调 */
  onRemove?: (type: 'metric' | 'tag', columnName: string) => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * Schema 编辑器组件
 * 显示和编辑 Metrics/Tabs 分区
 */
export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schema,
  onAdd,
  onRemove,
  readOnly = false,
  isDark,
}) => {
  const { t } = useTranslation();

  const renderColumnRow = (col: ColumnDef, type: 'metric' | 'tag') => (
    <tr
      key={col.name}
      className={`group ${isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
    >
      <td className={`p-3 font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
        {col.name}
      </td>
      <td
        className={`p-3 font-mono text-xs ${
          type === 'metric' ? 'text-yellow-500' : 'text-purple-400'
        }`}
      >
        {col.type}
      </td>
      <td className={`p-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
        {col.length || '-'}
      </td>
      {!readOnly && (
        <td className="p-3 text-right">
          {col.name !== 'ts' && (
            <button
              onClick={() => onRemove?.(type, col.name)}
              className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      )}
    </tr>
  );

  return (
    <div className="p-6 space-y-8">
      {/* Metrics Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4
            className={`text-sm font-bold uppercase tracking-wider flex items-center ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4 mr-2 text-blue-400" />
            {t('operations.data.metricsColumns', 'Data Columns (Metrics)')}
          </h4>
          {!readOnly && (
            <button
              onClick={() => onAdd('metric')}
              className="text-xs flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded transition-colors border border-blue-600/30"
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('common.add', 'Add Column')}
            </button>
          )}
        </div>
        <div
          className={`rounded-lg overflow-hidden ${
            isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <table className="w-full text-left text-sm">
            <thead
              className={`text-xs uppercase ${
                isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <tr>
                <th className="p-3 font-medium">{t('common.name', 'Name')}</th>
                <th className="p-3 font-medium">{t('common.dataType', 'Data Type')}</th>
                <th className="p-3 font-medium">{t('common.length', 'Length')}</th>
                {!readOnly && (
                  <th className="p-3 font-medium text-right">{t('common.actions', 'Actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {schema.metrics.map(col => renderColumnRow(col, 'metric'))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4
            className={`text-sm font-bold uppercase tracking-wider flex items-center ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            <Box className="w-4 h-4 mr-2 text-purple-400" />
            {t('operations.data.tags', 'Tags (Metadata)')}
          </h4>
          {!readOnly && (
            <button
              onClick={() => onAdd('tag')}
              className="text-xs flex items-center bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-1.5 rounded transition-colors border border-purple-600/30"
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('common.add', 'Add Tag')}
            </button>
          )}
        </div>
        <div
          className={`rounded-lg overflow-hidden ${
            isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <table className="w-full text-left text-sm">
            <thead
              className={`text-xs uppercase ${
                isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <tr>
                <th className="p-3 font-medium">{t('common.name', 'Name')}</th>
                <th className="p-3 font-medium">{t('common.dataType', 'Data Type')}</th>
                <th className="p-3 font-medium">{t('common.length', 'Length')}</th>
                {!readOnly && (
                  <th className="p-3 font-medium text-right">{t('common.actions', 'Actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {schema.tags.map(col => renderColumnRow(col, 'tag'))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchemaEditor;
