import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import type { TreeNode, NodeType } from '../types';

export const useTreeData = () => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [loadedCache, setLoadedCache] = useState<Set<string>>(new Set());

  // Fetch initial tree data (databases)
  const fetchTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.tdengine.listDatabases();
      if (result.success && result.data) {
        const dbData = result.data.data?.databases || result.data.databases || [];
        const dbNodes: TreeNode[] = dbData.map((db: any) => ({
          id: db.name || db.Name || db,
          name: db.name || db.Name || db,
          type: 'DB' as NodeType,
          expanded: false,
          children: [
            { id: `${db.name || db}_st`, name: 'Super Tables', type: 'CATEGORY' as NodeType, expanded: false, children: [] },
            { id: `${db.name || db}_t`, name: 'Tables', type: 'CATEGORY' as NodeType, expanded: false, children: [] },
          ]
        }));
        setTreeData(dbNodes);
      } else {
        setTreeData([]);
      }
    } catch (error) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.fetchError', 'Failed to fetch database tree'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  // Find parent database for a category node
  const findParentDatabase = useCallback((nodes: TreeNode[], categoryId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.children?.some(child => child.id === categoryId)) {
        return node;
      }
      if (node.children) {
        const found = findParentDatabase(node.children, categoryId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Load super tables for a database
  const loadSuperTables = useCallback(async (dbNode: TreeNode) => {
    try {
      const result = await api.tdengine.listSuperTables(dbNode.name);
      if (result.success && result.data) {
        const stData = result.data.supertables || result.data.data?.supertables || [];
        const stNodes: TreeNode[] = stData.map((st: any) => ({
          id: `${dbNode.name}_st_${st.name || st.Name}`,
          name: st.name || st.Name,
          type: 'STABLE' as NodeType,
          dbName: dbNode.name,
          expanded: false,
          children: []
        }));
        
        setTreeData(prev => prev.map(n => {
          if (n.id === dbNode.id) {
            return { ...n, children: stNodes };
          }
          return n;
        }));
      }
    } catch (error) {
      console.error('Failed to load super tables:', error);
    }
  }, []);

  // Load super tables for category
  const loadSuperTablesForDb = useCallback(async (dbNode: TreeNode, categoryNode: TreeNode) => {
    if (loadedCache.has(categoryNode.id)) {
      return;
    }
    
    setLoadingNodeId(categoryNode.id);
    
    try {
      const result = await api.tdengine.listSuperTables(dbNode.name);
      if (result.success && result.data) {
        const stData = result.data.supertables || result.data.data?.supertables || [];
        const stNodes: TreeNode[] = stData.map((st: any) => ({
          id: `${dbNode.name}_st_${st.name || st.Name}`,
          name: st.name || st.Name,
          type: 'STABLE' as NodeType,
          dbName: dbNode.name,
          expanded: false,
          children: []
        }));
        
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === categoryNode.id) {
              return { ...n, children: stNodes };
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        setTreeData(prev => updateNode(prev));
        setLoadedCache(prev => new Set(prev).add(categoryNode.id));
      }
    } catch (error) {
      console.error('Failed to load super tables:', error);
    } finally {
      setLoadingNodeId(null);
    }
  }, [loadedCache]);

  // Load sub-tables for a super table
  const loadSubTables = useCallback(async (stNode: TreeNode) => {
    if (!stNode.dbName) return;
    
    if (loadedCache.has(stNode.id)) {
      return;
    }
    
    setLoadingNodeId(stNode.id);
    
    try {
      const result = await api.tdengine.listSubTables(stNode.dbName, stNode.name);
      if (result.success && result.data) {
        const subData = result.data.subtables || result.data.data?.subtables || [];
        const subNodes: TreeNode[] = subData.map((sub: any) => ({
          id: `${stNode.dbName}_sub_${sub.name || sub.table_name || sub}`,
          name: sub.name || sub.table_name || sub,
          type: 'TABLE' as NodeType,
          dbName: stNode.dbName,
          superTableName: stNode.name,
          expanded: false
        }));
        
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === stNode.id) {
              return { ...n, children: subNodes };
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        setTreeData(prev => updateNode(prev));
        setLoadedCache(prev => new Set(prev).add(stNode.id));
      }
    } catch (error) {
      console.error('Failed to load sub tables:', error);
    } finally {
      setLoadingNodeId(null);
    }
  }, [loadedCache]);

  // Toggle node expansion and lazy load children
  const toggleNode = useCallback(async (node: TreeNode) => {
    const isExpanding = !node.expanded;
    
    // Update expansion state
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(n => {
        if (n.id === node.id) {
          return { ...n, expanded: isExpanding };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    };
    setTreeData(updateNode(treeData));
    
    // Lazy load children when expanding
    if (isExpanding) {
      if (loadedCache.has(node.id)) {
        return;
      }
      
      if (node.type === 'CATEGORY' && node.name === 'Super Tables') {
        const hasLoaded = node.children && node.children.length > 0 && node.children[0]?.type === 'STABLE';
        if (!hasLoaded) {
          const parentDb = findParentDatabase(treeData, node.id);
          if (parentDb) {
            await loadSuperTablesForDb(parentDb, node);
          }
        }
      } else if (node.type === 'STABLE') {
        const hasLoaded = node.children && node.children.length > 0;
        if (!hasLoaded) {
          await loadSubTables(node);
        }
      }
    }
  }, [treeData, loadedCache, findParentDatabase, loadSuperTablesForDb, loadSubTables]);

  return {
    treeData,
    setTreeData,
    loading,
    loadingNodeId,
    loadedCache,
    fetchTreeData,
    toggleNode,
    findParentDatabase,
    loadSuperTables,
    loadSuperTablesForDb,
    loadSubTables,
  };
};
