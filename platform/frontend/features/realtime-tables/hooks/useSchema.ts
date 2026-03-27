import { useState, useEffect, useRef } from 'react';
import { api } from '../../../src/services/api';
import type { TreeNode, SchemaData } from '../types';

// Simple cache for schema data
const schemaCache = new Map<string, SchemaData>();

export const useSchema = (selectedNode: TreeNode | null) => {
  const [schema, setSchema] = useState<SchemaData>({ columns: [], tags: [] });
  const [loading, setLoading] = useState(false);
  const lastLoadedNode = useRef<string | null>(null);

  useEffect(() => {
    const loadSchema = async () => {
      if (!selectedNode) {
        setSchema({ columns: [], tags: [] });
        lastLoadedNode.current = null;
        return;
      }

      // Create cache key
      const cacheKey = selectedNode.type === 'STABLE' 
        ? `${selectedNode.dbName}:${selectedNode.name}`
        : selectedNode.superTableName 
          ? `${selectedNode.dbName}:${selectedNode.superTableName}` // Sub-table inherits super-table schema
          : `${selectedNode.dbName}:${selectedNode.name}`;

      // Skip if already loading same node
      const nodeId = `${selectedNode.type}:${selectedNode.id}`;
      if (lastLoadedNode.current === nodeId && !loading) {
        return;
      }

      lastLoadedNode.current = nodeId;

      // Check cache first
      if (schemaCache.has(cacheKey)) {
        setSchema(schemaCache.get(cacheKey)!);
        return;
      }

      setLoading(true);
      try {
        let resultSchema: SchemaData = { columns: [], tags: [] };

        if (selectedNode.type === 'STABLE' && selectedNode.dbName) {
          // Direct super-table schema load
          const result = await api.tdengine.getSuperTableSchema(selectedNode.dbName, selectedNode.name);
          if (result.success && result.data) {
            const schemaData = result.data.data || result.data;
            resultSchema = {
              columns: schemaData.columns || [],
              tags: schemaData.tags || [],
            };
          }
        } else if (selectedNode.type === 'TABLE') {
          const dbName = selectedNode.dbName;
          const superTableName = selectedNode.superTableName;
          
          if (dbName && superTableName) {
            // Try cache first for super-table schema
            const superTableCacheKey = `${dbName}:${superTableName}`;
            if (schemaCache.has(superTableCacheKey)) {
              resultSchema = schemaCache.get(superTableCacheKey)!;
            } else {
              // Load super-table schema (sub-table inherits from super-table)
              const result = await api.tdengine.getSuperTableSchema(dbName, superTableName);
              if (result.success && result.data) {
                const schemaData = result.data.data || result.data;
                resultSchema = {
                  columns: schemaData.columns || [],
                  tags: schemaData.tags || [],
                };
                // Cache super-table schema
                schemaCache.set(superTableCacheKey, resultSchema);
              }
            }
          } else if (dbName) {
            // Fallback: load from sub-table info
            const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
            if (result.success && result.data) {
              const info = result.data.data || result.data;
              resultSchema = {
                columns: info.schema?.columns || [],
                tags: info.schema?.tags || [],
              };
            }
          }
        }

        // Cache and set result
        if (cacheKey) {
          schemaCache.set(cacheKey, resultSchema);
        }
        setSchema(resultSchema);
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
