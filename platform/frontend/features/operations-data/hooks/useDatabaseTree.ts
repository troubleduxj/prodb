import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import type { SubTableInfo, SuperTableInfo } from '../types';

export interface UseDatabaseTreeReturn {
  /** 展开的数据库 */
  expandedDb: string | null;
  /** 展开的超级表 */
  expandedSt: string | null;
  /** 子表映射 (超级表名 -> 子表列表) */
  childTablesMap: Record<string, SubTableInfo[]>;
  /** 超级表列表 */
  superTables: SuperTableInfo[];
  /** 数据库列表 */
  databases: string[];
  /** 加载状态 */
  loading: boolean;
  /** 错误状态 */
  error: string | null;
  /** 切换数据库展开状态 */
  handleDbClick: (dbName: string) => void;
  /** 切换超级表展开状态 */
  handleStClick: (dbName: string, stName: string) => void;
  /** 处理子表点击 */
  handleCtClick: (dbName: string, stName: string, ct: SubTableInfo) => void;
  /** 获取指定数据库的超级表 */
  getSuperTablesByDb: (dbName: string) => SuperTableInfo[];
  /** 刷新数据库列表 */
  refreshDatabases: () => Promise<void>;
}

/**
 * 数据库树形数据管理 Hook
 * 管理左侧树形结构的展开状态和子表数据
 */
export const useDatabaseTree = (): UseDatabaseTreeReturn => {
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [expandedSt, setExpandedSt] = useState<string | null>(null);
  const [childTablesMap, setChildTablesMap] = useState<Record<string, SubTableInfo[]>>({});
  const [databases, setDatabases] = useState<string[]>([]);
  const [superTables, setSuperTables] = useState<SuperTableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取数据库列表
  const fetchDatabases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.tdengine.listDatabases();

      if (result.success && result.data) {
        const responseData = result.data.data || result.data;
        let dbList: string[] = [];

        if (responseData.databases && Array.isArray(responseData.databases)) {
          dbList = responseData.databases.map((db: any) => db.name || db);
        } else if (Array.isArray(responseData)) {
          dbList = responseData.map((db: any) => db.name || db);
        }

        setDatabases(dbList);

        // 如果有数据库且没有展开的，默认展开第一个
        if (dbList.length > 0 && !expandedDb) {
          setExpandedDb(dbList[0]);
        }
      } else {
        const errorMsg = result.error || 'Failed to load databases';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to load databases: ' + errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [expandedDb]);

  // 获取超级表列表
  const fetchSuperTables = useCallback(async (dbName: string) => {
    try {
      setLoading(true);
      const result = await api.tdengine.listSuperTables(dbName);

      if (result.success && result.data) {
        const stList = result.data.data || result.data;
        const mappedSuperTables: SuperTableInfo[] = stList.map((st: any) => ({
          name: st.name || st,
          database: dbName,
          description: st.description || '',
        }));

        setSuperTables(prev => {
          // 过滤掉当前数据库的旧超级表
          const filtered = prev.filter(st => st.database !== dbName);
          return [...filtered, ...mappedSuperTables];
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || `Failed to load super tables for ${dbName}`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load super tables',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取子表列表
  const fetchSubTables = useCallback(async (dbName: string, stName: string) => {
    // 如果已加载过，不再重复加载
    if (childTablesMap[stName]) {
      return;
    }

    try {
      setLoading(true);
      const result = await api.tdengine.listSubTables(dbName, stName);

      if (result.success && result.data) {
        const subTables = result.data.data || result.data;
        const mappedSubTables: SubTableInfo[] = subTables.map((st: any) => ({
          name: st.name || st,
          tags: st.tags || {},
        }));

        setChildTablesMap(prev => ({
          ...prev,
          [stName]: mappedSubTables,
        }));
      } else {
        toast({
          title: 'Error',
          description: result.error || `Failed to load sub tables for ${stName}`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load sub tables',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [childTablesMap]);

  // 初始加载数据库列表
  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  // 当数据库展开时，加载该数据库的超级表
  useEffect(() => {
    if (expandedDb) {
      fetchSuperTables(expandedDb);
    }
  }, [expandedDb, fetchSuperTables]);

  // 获取指定数据库的超级表
  const getSuperTablesByDb = useCallback((dbName: string) => {
    return superTables.filter(st => st.database === dbName);
  }, [superTables]);

  // 切换数据库展开
  const handleDbClick = useCallback((dbName: string) => {
    setExpandedDb(prev => prev === dbName ? null : dbName);
    setExpandedSt(null);
  }, []);

  // 切换超级表展开
  const handleStClick = useCallback((dbName: string, stName: string) => {
    const newExpandedSt = expandedSt === stName ? null : stName;
    setExpandedSt(newExpandedSt);

    if (newExpandedSt) {
      fetchSubTables(dbName, stName);
    }
  }, [expandedSt, fetchSubTables]);

  // 处理子表点击 (用于外部回调)
  const handleCtClick = useCallback((dbName: string, stName: string, ct: SubTableInfo) => {
    // 此函数主要用于回调，实际逻辑由调用方处理
    console.log('Child table clicked:', { dbName, stName, ct });
  }, []);

  return {
    expandedDb,
    expandedSt,
    childTablesMap,
    superTables,
    databases,
    loading,
    error,
    handleDbClick,
    handleStClick,
    handleCtClick,
    getSuperTablesByDb,
    refreshDatabases: fetchDatabases,
  };
};

export default useDatabaseTree;
