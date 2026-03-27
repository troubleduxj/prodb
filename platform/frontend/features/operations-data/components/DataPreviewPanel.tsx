import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Loader2 } from 'lucide-react';
import type { ViewContextType } from '../types';

export interface DataPreviewPanelProps {
  /** 视图类型 */
  viewType: ViewContextType;
  /** 表名 */
  tableName: string;
  /** 子表数量 */
  childTableCount?: number;
  /** 是否为暗黑模式 */
  isDark: boolean;
  /** 预览数据 */
  data?: Array<Record<string, any>>;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 数据预览面板组件
 * 显示数据预览表格
 */
export const DataPreviewPanel: React.FC<DataPreviewPanelProps> = ({
  viewType,
  tableName,
  childTableCount = 0,
  isDark,
  data,
  loading = false,
}) => {
  const { t } = useTranslation();

  // 生成模拟数据
  const mockData = React.useMemo(() => {
    if (data) return data;
    
    return Array.from({ length: 15 }).map((_, i) => ({
      ts: `2023-10-27 10:${10 + i}:00.000`,
      current: (Math.random() * 10).toFixed(2),
      voltage: (220 + Math.random() * 5).toFixed(1),
      phase: Math.random().toFixed(3),
      location: i % 2 === 0 ? 'California_DC_01' : 'Nevada_Site_B',
      group_id: 100 + (i % 3),
    }));
  }, [data]);

  const columns = ['ts', 'current', 'voltage', 'phase'];
  if (viewType === 'SUPER_TABLE') {
    columns.push('location', 'group_id');
  }

  if (loading) {
    return (
      <div className={`h-full flex flex-col items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        Loading preview data...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Super Table 提示 */}
      {viewType === 'SUPER_TABLE' && (
        <div
          className={`border-b px-4 py-2 text-xs flex items-center ${
            isDark
              ? 'bg-blue-900/10 border-blue-500/10 text-blue-300'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <Box className="w-3 h-3 mr-2" />
          {t('operations.data.showingAggregatedData', 'Showing aggregated data from all')}{' '}
          {childTableCount}{' '}
          {t('operations.data.childTables', 'child tables')}.
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className={`${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
              {columns.map(col => (
                <th
                  key={col}
                  className={`p-3 whitespace-nowrap sticky top-0 ${
                    isDark
                      ? 'bg-gray-700 border-b border-gray-600'
                      : 'bg-gray-100 border-b border-gray-300'
                  } ${
                    ['location', 'group_id'].includes(col)
                      ? isDark
                        ? 'text-blue-300'
                        : 'text-blue-600'
                      : ''
                  }`}
                >
                  {col}
                  {['location', 'group_id'].includes(col) && (
                    <span className="ml-1 text-[10px] opacity-70">
                      ({t('operations.data.tag', 'Tag')})
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isDark ? 'divide-gray-700 text-gray-300 font-mono' : 'divide-gray-200 text-gray-700 font-mono'
            }`}
          >
            {mockData.map((row, i) => (
              <tr key={i} className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                <td className={`p-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.ts}</td>
                <td className="p-3">{row.current}</td>
                <td className="p-3">{row.voltage}</td>
                <td className="p-3">{row.phase}</td>
                {viewType === 'SUPER_TABLE' && (
                  <>
                    <td className={`p-3 ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>
                      {row.location}
                    </td>
                    <td className={`p-3 ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>
                      {row.group_id}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataPreviewPanel;
