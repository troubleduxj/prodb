import { useState, useCallback } from 'react';
import type { ViewContext, ViewContextType } from '../types';

export interface UseViewContextReturn {
  /** 当前视图上下文 */
  viewContext: ViewContext;
  /** 当前活动标签 */
  activeTab: 'preview' | 'schema' | 'quality' | 'tags';
  /** SQL 控制台显隐状态 */
  showSqlConsole: boolean;
  /** 设置视图上下文 */
  setViewContext: (context: ViewContext) => void;
  /** 设置活动标签 */
  setActiveTab: (tab: 'preview' | 'schema' | 'quality' | 'tags') => void;
  /** 切换 SQL 控制台显隐 */
  toggleSqlConsole: () => void;
  /** 导航到数据库视图 */
  navigateToDb: (dbName: string) => void;
  /** 导航到超级表视图 */
  navigateToSt: (dbName: string, stName: string) => void;
  /** 导航到子表视图 */
  navigateToCt: (dbName: string, stName: string, ctName: string, tags?: Record<string, any>) => void;
  /** 重置视图 */
  resetView: () => void;
}

/**
 * 视图上下文状态管理 Hook
 * 管理当前选中的视图上下文和导航逻辑
 */
export const useViewContext = (): UseViewContextReturn => {
  const [viewContext, setViewContext] = useState<ViewContext>({
    type: 'DB',
    name: 'power_db'
  });
  
  const [activeTab, setActiveTab] = useState<'preview' | 'schema' | 'quality' | 'tags'>('preview');
  const [showSqlConsole, setShowSqlConsole] = useState(false);

  // 切换 SQL 控制台
  const toggleSqlConsole = useCallback(() => {
    setShowSqlConsole(prev => !prev);
  }, []);

  // 导航到数据库视图
  const navigateToDb = useCallback((dbName: string) => {
    setViewContext({
      type: 'DB',
      name: dbName
    });
    setActiveTab('preview');
  }, []);

  // 导航到超级表视图
  const navigateToSt = useCallback((dbName: string, stName: string) => {
    setViewContext({
      type: 'SUPER_TABLE',
      name: stName,
      db: dbName,
      st: stName
    });
    setActiveTab('preview');
  }, []);

  // 导航到子表视图
  const navigateToCt = useCallback((dbName: string, stName: string, ctName: string, tags?: Record<string, any>) => {
    setViewContext({
      type: 'CHILD_TABLE',
      name: ctName,
      db: dbName,
      st: stName,
      tags
    });
    setActiveTab('preview');
  }, []);

  // 重置视图
  const resetView = useCallback(() => {
    setViewContext({
      type: 'NONE',
      name: ''
    });
    setActiveTab('preview');
  }, []);

  return {
    viewContext,
    activeTab,
    showSqlConsole,
    setViewContext,
    setActiveTab,
    toggleSqlConsole,
    navigateToDb,
    navigateToSt,
    navigateToCt,
    resetView,
  };
};

export default useViewContext;
