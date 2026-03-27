import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../src/services/api';
import type { TreeNode, QueryResult } from '../types';

export const useDataPreview = (selectedNode: TreeNode | null) => {
  const [dataPreview, setDataPreview] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDataPreview = useCallback(async () => {
    if (!selectedNode || (selectedNode.type !== 'STABLE' && selectedNode.type !== 'TABLE')) {
      setDataPreview(null);
      return;
    }

    setLoading(true);
    try {
      let sql = '';
      if (selectedNode.type === 'STABLE' && selectedNode.dbName) {
        // Super table: query with ORDER BY ts DESC to get latest data
        sql = `SELECT * FROM \`${selectedNode.dbName}\`.\`${selectedNode.name}\` ORDER BY ts DESC LIMIT 100`;
      } else if (selectedNode.type === 'TABLE') {
        const dbName = selectedNode.dbName;
        if (dbName) {
          // Sub table: query with ORDER BY ts DESC to get latest data
          sql = `SELECT * FROM \`${dbName}\`.\`${selectedNode.name}\` ORDER BY ts DESC LIMIT 100`;
        }
      }

      if (sql) {
        const result = await api.tdengine.query(sql);
        if (result.success && result.data) {
          // Handle different response formats
          const responseData = result.data.data || result.data;
          // Backend returns 'rows', frontend expects 'data'
          const columns = responseData.columns || [];
          const data = responseData.rows || responseData.data || [];
          if (columns.length > 0) {
            setDataPreview({
              columns: columns,
              data: data,
              rows: data.length,
            });
          } else {
            setDataPreview({ columns: [], data: [], rows: 0 });
          }
        } else {
          setDataPreview({ columns: [], data: [], rows: 0 });
        }
      }
    } catch (error) {
      console.error('Failed to load data preview:', error);
      setDataPreview({ columns: [], data: [], rows: 0 });
    } finally {
      setLoading(false);
    }
  }, [selectedNode]);

  // Load data preview when selected node changes
  useEffect(() => {
    loadDataPreview();
  }, [loadDataPreview]);

  return {
    dataPreview,
    loading,
    refresh: loadDataPreview,
  };
};
