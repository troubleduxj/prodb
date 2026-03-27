/**
 * RealtimeLive 功能模块 - 控制面板组件
 * 包含数据库/表选择器和字段选择器
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, RefreshCw, LayoutGrid } from 'lucide-react';
import type { Database as DbType, SuperTable, FieldConfig } from './types';

interface ControlPanelProps {
  // 数据和状态
  databases: DbType[];
  superTables: SuperTable[];
  subTables: SuperTable[];
  fieldConfigs: FieldConfig[];
  visibleFields: string[];
  selectedDb: string;
  selectedSuperTable: string;
  selectedSubTable: string;
  dbLoading: boolean;
  tableLoading: boolean;
  dataLoading: boolean;
  isDark: boolean;

  // 设置器
  setSelectedDb: (db: string) => void;
  setSelectedSuperTable: (st: string) => void;
  setSelectedSubTable: (st: string) => void;

  // 操作
  onRefresh: () => void;
  onToggleField: (fieldKey: string) => void;

  // 样式辅助函数
  getBgClass: () => string;
  getSubBgClass: () => string;
  getTextClass: () => string;
  getSubTextClass: () => string;
  getBorderClass: () => string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  databases,
  superTables,
  subTables,
  fieldConfigs,
  visibleFields,
  selectedDb,
  selectedSuperTable,
  selectedSubTable,
  dbLoading,
  tableLoading,
  dataLoading,
  isDark,
  setSelectedDb,
  setSelectedSuperTable,
  setSelectedSubTable,
  onRefresh,
  onToggleField,
  getBgClass,
  getSubBgClass,
  getTextClass,
  getSubTextClass,
  getBorderClass
}) => {
  const { t } = useTranslation();

  return (
    <div className={"w-80 rounded-xl border flex flex-col shrink-0 overflow-hidden " + getBgClass()}>
      {/* 数据库和表选择 */}
      <div className={"p-4 border-b space-y-4 " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-blue-500" />
          <span className={"font-semibold " + getTextClass()}>{t('realtime.tdengineConnection', 'TDengine Connection')}</span>
        </div>

        {/* 数据库选择 */}
        <div className="space-y-1">
          <label className={"text-xs font-medium " + getSubTextClass()}>
            {t('realtime.database', 'Database')}
          </label>
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            disabled={dbLoading}
            className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
          >
            <option value="">{t('realtime.selectDatabase', '-- Select Database --')}</option>
            {databases.map(db => (
              <option key={db.name} value={db.name}>{db.name}</option>
            ))}
          </select>
          {dbLoading && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {t('realtime.loadingDatabases', 'Loading databases...')}
            </div>
          )}
          {!dbLoading && databases.length === 0 && (
            <div className={"text-xs " + (isDark ? "text-yellow-400" : "text-yellow-600")}>
              {t('realtime.noDatabases', 'No databases found')}
            </div>
          )}
        </div>

        {/* 超级表选择 */}
        <div className="space-y-1">
          <label className={"text-xs font-medium " + getSubTextClass()}>
            {t('realtime.superTable', 'Super Table')}
          </label>
          <select
            value={selectedSuperTable}
            onChange={(e) => setSelectedSuperTable(e.target.value)}
            disabled={tableLoading || !selectedDb}
            className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
          >
            <option value="">{t('realtime.selectSuperTable', 'Select Super Table')}</option>
            {superTables.map(st => (
              <option key={st.name} value={st.name}>{st.name}</option>
            ))}
          </select>
        </div>

        {/* 子表选择 */}
        {selectedSuperTable && (
          <div className="space-y-1">
            <label className={"text-xs font-medium " + getSubTextClass()}>
              {t('realtime.subTable', 'Sub Table')} <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubTable}
              onChange={(e) => setSelectedSubTable(e.target.value)}
              disabled={tableLoading}
              className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
            >
              <option value="">{t('realtime.selectSubTable', '-- Select Sub Table --')}</option>
              {subTables.map(st => (
                <option key={st.name} value={st.name}>{st.name}</option>
              ))}
            </select>
            {tableLoading && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t('realtime.loadingSubTables', 'Loading sub tables...')}
              </div>
            )}
            {!tableLoading && subTables.length === 0 && (
              <div className={"text-xs " + (isDark ? "text-yellow-400" : "text-yellow-600")}>
                {t('realtime.noSubTables', 'No sub tables found for this super table')}
              </div>
            )}
          </div>
        )}

        {/* 刷新按钮 */}
        <button
          onClick={onRefresh}
          disabled={dataLoading || !selectedDb || !selectedSuperTable}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {dataLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {t('realtime.refreshNow', 'Refresh Now')}
        </button>
      </div>

      {/* 字段选择 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={"p-3 border-b " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
          <div className="flex items-center justify-between">
            <span className={"text-xs font-medium " + getSubTextClass()}>
              {t('realtime.selectFields', 'Select Fields to Display')}
            </span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
              {visibleFields.length} / {fieldConfigs.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {fieldConfigs.map(field => {
            const isSelected = visibleFields.includes(field.key);
            const Icon = field.icon;
            return (
              <button
                key={field.key}
                onClick={() => onToggleField(field.key)}
                className={"w-full flex items-center gap-2 p-2 rounded text-left transition-all " + (
                  isSelected
                    ? (isDark ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200')
                    : (isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100')
                )}
              >
                <div
                  className={"w-4 h-4 rounded border flex items-center justify-center transition-colors " + (
                    isSelected ? 'bg-blue-600 border-blue-500' : (isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white')
                  )}
                >
                  {isSelected && <LayoutGrid className="w-3 h-3 text-white" />}
                </div>
                <Icon className="w-4 h-4" style={{ color: isSelected ? field.color : undefined }} />
                <span className={"text-sm flex-1 " + (isSelected ? (isDark ? 'text-blue-200' : 'text-blue-700') : (isDark ? 'text-gray-300' : 'text-gray-700'))}>
                  {field.label}
                </span>
              </button>
            );
          })}

          {fieldConfigs.length === 0 && (
            <div className={"text-center py-8 text-sm " + getSubTextClass()}>
              {t('realtime.noFields', 'Select a table to see available fields')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
