import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useDatabaseTree, useViewContext, useDataQuality, useColumnManager } from './hooks';
import {
  DatabaseTree,
  SqlConsole,
  DatabaseSettings,
  SuperTableDetail,
  ChildTableDetail,
  Breadcrumbs,
  AddColumnModal,
} from './components';

/**
 * 空状态组件
 */
const EmptyState: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <Database className="w-16 h-16 mb-4 opacity-20" />
      <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t('operations.data.noAssetSelected', 'No Asset Selected')}
      </p>
      <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        {t('operations.data.selectDatabaseOrTable', 'Select a database or table from the sidebar to manage.')}
      </p>
    </div>
  );
};

/**
 * OperationsData 主组件
 * 重构后的主页面，使用自定义 hooks 和拆分后的子组件
 */
export const OperationsData: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // 自定义 Hooks
  const {
    expandedDb,
    expandedSt,
    childTablesMap,
    superTables,
    databases,
    loading,
    handleDbClick,
    handleStClick,
  } = useDatabaseTree();

  const {
    viewContext,
    activeTab,
    showSqlConsole,
    setViewContext,
    setActiveTab,
    toggleSqlConsole,
    navigateToDb,
    navigateToSt,
    navigateToCt,
  } = useViewContext();

  const dataQuality = useDataQuality(
    viewContext.type === 'SUPER_TABLE' ? viewContext.name : undefined
  );

  const columnManager = useColumnManager();

  // 处理子表点击
  const handleCtClick = React.useCallback(
    (dbName: string, stName: string, ct: { name: string; tags: Record<string, any> }) => {
      navigateToCt(dbName, stName, ct.name, ct.tags);
    },
    [navigateToCt]
  );

  // 处理数据库点击 - 同时更新视图上下文
  const handleDbClickWithContext = React.useCallback(
    (dbName: string) => {
      handleDbClick(dbName);
      setViewContext({ type: 'DB', name: dbName });
    },
    [handleDbClick, setViewContext]
  );

  // 处理超级表点击 - 同时更新视图上下文
  const handleStClickWithContext = React.useCallback(
    (dbName: string, stName: string) => {
      handleStClick(dbName, stName);
      setViewContext({ type: 'SUPER_TABLE', name: stName, db: dbName, st: stName });
      setActiveTab('preview');
    },
    [handleStClick, setViewContext, setActiveTab]
  );

  // 面包屑组件
  const breadcrumbs = useMemo(
    () => (
      <Breadcrumbs
        viewContext={viewContext}
        onNavigateToDb={navigateToDb}
        onNavigateToSt={navigateToSt}
        isDark={isDark}
      />
    ),
    [viewContext, navigateToDb, navigateToSt, isDark]
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* 左侧树形结构 */}
      <DatabaseTree
        databases={databases}
        expandedDb={expandedDb}
        expandedSt={expandedSt}
        viewContext={viewContext}
        childTablesMap={childTablesMap}
        superTables={superTables}
        onDbClick={handleDbClickWithContext}
        onStClick={handleStClickWithContext}
        onCtClick={handleCtClick}
        isDark={isDark}
        loading={loading}
      />

      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* SQL 控制台 */}
        <SqlConsole show={showSqlConsole} onToggle={toggleSqlConsole} isDark={isDark} />

        {/* 内容面板 */}
        <div
          className={`flex-1 rounded-xl flex flex-col overflow-hidden min-h-0 relative ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'
          }`}
        >
          {/* 数据库设置 */}
          {viewContext.type === 'DB' && <DatabaseSettings dbName={viewContext.name} isDark={isDark} />}

          {/* 超级表详情 */}
          {viewContext.type === 'SUPER_TABLE' && (
            <SuperTableDetail
              viewContext={viewContext}
              breadcrumbs={breadcrumbs}
              childTablesMap={childTablesMap}
              activeTab={activeTab as 'preview' | 'schema' | 'quality'}
              onTabChange={tab => setActiveTab(tab)}
              dataQuality={dataQuality}
              columnManager={columnManager}
              isDark={isDark}
            />
          )}

          {/* 子表详情 */}
          {viewContext.type === 'CHILD_TABLE' && (
            <ChildTableDetail
              viewContext={viewContext}
              breadcrumbs={breadcrumbs}
              activeTab={activeTab as 'preview' | 'schema' | 'tags'}
              onTabChange={tab => setActiveTab(tab)}
              isDark={isDark}
            />
          )}

          {/* 空状态 */}
          {viewContext.type === 'NONE' && <EmptyState isDark={isDark} />}
        </div>
      </div>

      {/* 添加列弹窗 */}
      <AddColumnModal
        show={columnManager.showAddColumnModal}
        form={columnManager.newCol}
        columnTypes={columnManager.columnTypes}
        isValid={columnManager.isFormValid}
        showLengthInput={columnManager.showLengthInput}
        onClose={columnManager.closeAddColumnModal}
        onAdd={columnManager.handleAddColumn}
        onNameChange={columnManager.setColumnName}
        onTypeChange={columnManager.setColumnType}
        onLengthChange={columnManager.setColumnLength}
        isDark={isDark}
      />
    </div>
  );
};

export default OperationsData;
