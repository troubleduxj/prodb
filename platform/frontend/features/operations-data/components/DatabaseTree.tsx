import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Search, ChevronRight, ChevronDown, Plus, MoreHorizontal, Layers, Cpu } from 'lucide-react';
import type { ViewContext, SubTableInfo } from '../types';

export interface DatabaseTreeProps {
  /** 数据库列表 */
  databases: string[];
  /** 展开的数据库 */
  expandedDb: string | null;
  /** 展开的超级表 */
  expandedSt: string | null;
  /** 当前视图上下文 */
  viewContext: ViewContext;
  /** 子表映射 */
  childTablesMap: Record<string, SubTableInfo[]>;
  /** 超级表列表 */
  superTables: Array<{ name: string; database: string; description?: string }>;
  /** 数据库点击回调 */
  onDbClick: (dbName: string) => void;
  /** 超级表点击回调 */
  onStClick: (dbName: string, stName: string) => void;
  /** 子表点击回调 */
  onCtClick: (dbName: string, stName: string, ct: SubTableInfo) => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 数据库树形组件
 * 左侧三级层级：Database → SuperTable → ChildTable
 */
export const DatabaseTree: React.FC<DatabaseTreeProps> = ({
  databases,
  expandedDb,
  expandedSt,
  viewContext,
  childTablesMap,
  superTables,
  onDbClick,
  onStClick,
  onCtClick,
  isDark,
  loading = false,
}) => {
  const { t } = useTranslation();

  // 获取指定数据库的超级表
  const getSuperTablesByDb = (dbName: string) => {
    return superTables.filter(st => st.database === dbName);
  };

  return (
    <div className={`w-72 rounded-xl flex flex-col overflow-hidden shrink-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
      {/* Header */}
      <div className={`p-3 flex items-center justify-between gap-2 ${isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'}`}>
        <div className="relative flex-1">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t('common.filter', 'Filter...')}
            className={`w-full border rounded pl-7 pr-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>
        <button
          className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
          title={t('operations.data.newDatabase', 'New Database')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {databases.map(db => (
          <div key={db} className="mb-1">
            {/* Level 1: Database */}
            <div
              className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-sm font-medium group transition-colors ${
                viewContext.type === 'DB' && viewContext.name === db
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : isDark
                    ? 'text-gray-200 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div
                className="flex items-center w-full"
                onClick={() => onDbClick(db)}
              >
                {expandedDb === db ? (
                  <ChevronDown className={`w-3 h-3 mr-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                ) : (
                  <ChevronRight className={`w-3 h-3 mr-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                )}
                <Database className="w-3 h-3 mr-2 text-yellow-500" />
                <span className="truncate">{db}</span>
              </div>
              <button
                className={`opacity-0 group-hover:opacity-100 ${
                  isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>

            {/* Level 2: Super Tables */}
            {expandedDb === db && (
              <div className={`pl-2 mt-0.5 space-y-0.5 ml-2 border-l ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                {getSuperTablesByDb(db).map(st => (
                  <div key={st.name}>
                    <div
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs group transition-colors ${
                        viewContext.name === st.name && viewContext.type === 'SUPER_TABLE'
                          ? 'bg-blue-600/20 text-blue-300'
                          : isDark
                            ? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <div
                        className="flex items-center w-full"
                        onClick={() => onStClick(db, st.name)}
                      >
                        {expandedSt === st.name ? (
                          <ChevronDown className="w-3 h-3 mr-1.5 opacity-70" />
                        ) : (
                          <ChevronRight className="w-3 h-3 mr-1.5 opacity-70" />
                        )}
                        <Layers className="w-3 h-3 mr-2 text-blue-400" />
                        <span className="truncate">{st.name}</span>
                      </div>
                    </div>

                    {/* Level 3: Child Tables */}
                    {expandedSt === st.name && (
                      <div className={`pl-3 mt-0.5 mb-1 space-y-0.5 ml-2 border-l ${isDark ? 'border-gray-700/30' : 'border-gray-200'}`}>
                        {childTablesMap[st.name]?.map((ct: SubTableInfo) => (
                          <div
                            key={ct.name}
                            onClick={() => onCtClick(db, st.name, ct)}
                            className={`flex items-center p-1.5 rounded cursor-pointer text-xs pl-2 ${
                              viewContext.name === ct.name && viewContext.type === 'CHILD_TABLE'
                                ? 'bg-purple-600/20 text-purple-300'
                                : isDark
                                  ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                          >
                            <Cpu className="w-3 h-3 mr-2 opacity-70" />
                            <span className="truncate">{ct.name.replace(st.name + '_', '')}</span>
                          </div>
                        ))}
                        <button
                          className={`flex items-center p-1.5 text-[10px] w-full rounded mt-1 pl-2 ${
                            isDark
                              ? 'text-gray-600 hover:text-blue-400 hover:bg-gray-800'
                              : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'
                          }`}
                        >
                          <Plus className="w-2.5 h-2.5 mr-1.5" />
                          {t('operations.data.createChildTable', 'Create Child Table')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  className={`flex items-center p-1.5 text-xs w-full rounded mt-1 ${
                    isDark
                      ? 'text-gray-500 hover:text-blue-400 hover:bg-gray-700/50'
                      : 'text-gray-600 hover:text-blue-500 hover:bg-gray-100'
                  }`}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {t('operations.data.newSuperTable', 'New Super Table')}
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className={`p-4 text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('common.loading', 'Loading...')}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseTree;
