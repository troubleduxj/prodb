import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { ViewContext } from '../types';

export interface BreadcrumbsProps {
  /** 视图上下文 */
  viewContext: ViewContext;
  /** 导航到数据库回调 */
  onNavigateToDb: (dbName: string) => void;
  /** 导航到超级表回调 */
  onNavigateToSt: (dbName: string, stName: string) => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * 面包屑导航组件
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  viewContext,
  onNavigateToDb,
  onNavigateToSt,
  isDark,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
      {/* Database */}
      <span
        className={`cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
        onClick={() => {
          if (viewContext.db) onNavigateToDb(viewContext.db);
        }}
      >
        {viewContext.db || t('operations.data.cluster', 'Cluster')}
      </span>

      {/* Super Table */}
      {viewContext.st && (
        <>
          <ChevronRight className="w-3 h-3 mx-1" />
          <span
            className={`cursor-pointer ${
              viewContext.type === 'SUPER_TABLE'
                ? isDark
                  ? 'text-gray-100 font-bold'
                  : 'text-gray-900 font-bold'
                : isDark
                  ? 'hover:text-white'
                  : 'hover:text-gray-900'
            }`}
            onClick={() => {
              if (viewContext.db && viewContext.st) {
                onNavigateToSt(viewContext.db, viewContext.st);
              }
            }}
          >
            {viewContext.st}
          </span>
        </>
      )}

      {/* Child Table */}
      {viewContext.type === 'CHILD_TABLE' && (
        <>
          <ChevronRight className="w-3 h-3 mx-1" />
          <span className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {viewContext.name}
          </span>
        </>
      )}
    </div>
  );
};

export default Breadcrumbs;
