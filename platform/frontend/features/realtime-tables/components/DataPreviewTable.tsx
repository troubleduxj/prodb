import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Loader2 } from 'lucide-react';
import type { QueryResult } from '../types';

interface DataPreviewTableProps {
  data: QueryResult;
  isDark: boolean;
  loading?: boolean;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({ data, isDark, loading }) => {
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

export default DataPreviewTable;
