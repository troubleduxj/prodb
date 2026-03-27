/**
 * RealtimeLive 功能模块 - 数据预览表格组件
 * 显示实时数据的表格预览
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { FieldConfig, DataPoint } from './types';

interface DataTableProps {
  dataPoints: DataPoint[];
  fieldConfigs: FieldConfig[];
  visibleFields: string[];
  isDark: boolean;
  getBgClass: () => string;
  getSubBgClass: () => string;
  getSubTextClass: () => string;
  getBorderClass: () => string;
  onClear: () => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  dataPoints,
  fieldConfigs,
  visibleFields,
  isDark,
  getBgClass,
  getSubBgClass,
  getSubTextClass,
  getBorderClass,
  onClear
}) => {
  const { t } = useTranslation();

  if (dataPoints.length === 0) return null;

  return (
    <div className={"h-64 rounded-xl border flex flex-col overflow-hidden shrink-0 " + getBgClass()}>
      <div className={"px-4 py-2 border-b flex justify-between items-center " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
        <h3 className={"text-xs font-bold uppercase " + getSubTextClass()}>
          {t('realtime.dataPreview', 'Data Preview')} ({dataPoints.length} {t('realtime.rows', 'rows')})
        </h3>
        <button
          onClick={onClear}
          className={"text-[10px] flex items-center " + (isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}
        >
          <RefreshCw className="w-3 h-3 mr-1" /> {t('realtime.clear', 'Clear')}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className={"font-medium sticky top-0 z-10 " + (isDark ? "bg-gray-800 text-gray-500" : "bg-gray-50 text-gray-500")}>
            <tr>
              <th className={"p-3 border-b whitespace-nowrap " + getBorderClass()}>Time</th>
              {fieldConfigs
                .filter(f => visibleFields.includes(f.key))
                .map(field => (
                  <th
                    key={field.key}
                    className={"p-3 border-b whitespace-nowrap " + getBorderClass()}
                    style={{color: field.color}}
                  >
                    {field.key}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className={"divide-y font-mono " + (isDark ? "divide-gray-700" : "divide-gray-200")}>
            {[...dataPoints].reverse().slice(0, 20).map((pt, idx) => (
              <tr key={idx} className={isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-50"}>
                <td className={"p-2 pl-3 whitespace-nowrap " + (isDark ? "text-gray-400" : "text-gray-500")}>
                  {pt.time}
                </td>
                {fieldConfigs
                  .filter(f => visibleFields.includes(f.key))
                  .map(field => (
                    <td key={field.key} className="p-2 whitespace-nowrap">
                      {pt[field.key] !== undefined ? pt[field.key] : '-'}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
