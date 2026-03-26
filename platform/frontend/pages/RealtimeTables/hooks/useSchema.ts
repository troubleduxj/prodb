import { useState, useEffect } from 'react';
import { api } from '../../../src/services/api';
import type { TreeNode, SchemaData } from '../types';

export const useSchema = (selectedNode: TreeNode | null) => {
  const [schema, setSchema] = useState<SchemaData>({ columns: [], tags: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSchema = async () => {
      if (!selectedNode) {
        setSchema({ columns: [], tags: [] });
        return;
      }

      setLoading(true);
      try {
        if (selectedNode.type === 'STABLE' && selectedNode.dbName) {
          const result = await api.tdengine.getSuperTableSchema(selectedNode.dbName, selectedNode.name);
          if (result.success && result.data) {
            const schemaData = result.data.data || result.data;
            setSchema({
              columns: schemaData.columns || [],
              tags: schemaData.tags || [],
            });
          }
        } else if (selectedNode.type === 'TABLE') {
          const dbName = selectedNode.dbName;
          const superTableName = selectedNode.superTableName;
          
          if (dbName && superTableName) {
            const result = await api.tdengine.getSuperTableSchema(dbName, superTableName);
            if (result.success && result.data) {
              const schemaData = result.data.data || result.data;
              setSchema({
                columns: schemaData.columns || [],
                tags: schemaData.tags || [],
              });
            }
          } else if (dbName) {
            const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
            if (result.success && result.data) {
              const info = result.data.data || result.data;
              setSchema({
                columns: info.schema?.columns || [],
                tags: info.schema?.tags || [],
              });
            }
          }
        } else {
          setSchema({ columns: [], tags: [] });
        }
      } catch (error) {
        console.error('Failed to load schema:', error);
        setSchema({ columns: [], tags: [] });
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [selectedNode]);

  return { schema, setSchema, loading };
};
