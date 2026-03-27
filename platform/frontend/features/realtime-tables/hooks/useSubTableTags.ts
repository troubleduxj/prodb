import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../src/services/api';
import type { TreeNode } from '../types';

// Cache for sub-table tag values
const tagValuesCache = new Map<string, Record<string, any>>();

export const useSubTableTags = (selectedNode: TreeNode | null) => {
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const lastLoadedNode = useRef<string | null>(null);

  useEffect(() => {
    const loadTagValues = async () => {
      if (!selectedNode || selectedNode.type !== 'TABLE') {
        setOriginalValues({});
        setPendingChanges({});
        lastLoadedNode.current = null;
        return;
      }

      const dbName = selectedNode.dbName;
      if (!dbName) {
        setOriginalValues({});
        setPendingChanges({});
        return;
      }

      // Create cache key
      const cacheKey = `${dbName}:${selectedNode.name}`;
      const nodeId = `${selectedNode.type}:${selectedNode.id}`;

      // Skip if already loading same node
      if (lastLoadedNode.current === nodeId && !loading) {
        return;
      }

      lastLoadedNode.current = nodeId;

      // Check cache first
      if (tagValuesCache.has(cacheKey)) {
        const cached = tagValuesCache.get(cacheKey)!;
        setOriginalValues(cached);
        setPendingChanges({});
        return;
      }

      setLoading(true);
      try {
        const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
        if (result.success && result.data) {
          const info = result.data.data || result.data;
          const values = info.tags || {};
          
          // Cache and set
          tagValuesCache.set(cacheKey, values);
          setOriginalValues(values);
          setPendingChanges({});
        } else {
          setOriginalValues({});
          setPendingChanges({});
        }
      } catch (error) {
        console.error('Failed to load sub-table tag values:', error);
        setOriginalValues({});
        setPendingChanges({});
      } finally {
        setLoading(false);
      }
    };

    loadTagValues();
  }, [selectedNode]);

  // Stage a tag value change (only updates pending changes, not backend)
  const stageTagValueChange = useCallback((tagName: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [tagName]: value }));
  }, []);

  // Commit pending changes - updates original values and cache (called after successful backend save)
  const commitPendingChanges = useCallback(() => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    const newOriginalValues = { ...originalValues, ...pendingChanges };
    setOriginalValues(newOriginalValues);
    
    // Update cache
    if (selectedNode && selectedNode.type === 'TABLE' && selectedNode.dbName) {
      const cacheKey = `${selectedNode.dbName}:${selectedNode.name}`;
      tagValuesCache.set(cacheKey, newOriginalValues);
    }
    
    setPendingChanges({});
  }, [pendingChanges, originalValues, selectedNode]);

  // Clear pending changes without committing (called when canceling edit)
  const clearPendingChanges = useCallback(() => {
    setPendingChanges({});
  }, []);

  // Get the effective tag values (original + pending changes)
  const effectiveTagValues = { ...originalValues, ...pendingChanges };

  // Get only the tags that have been modified
  const getModifiedTags = useCallback((): Array<{ name: string; value: any }> => {
    return Object.entries(pendingChanges).map(([name, value]) => ({ name, value }));
  }, [pendingChanges]);

  // Check if there are pending changes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return { 
    originalValues,
    effectiveTagValues,
    pendingChanges,
    loading, 
    hasPendingChanges,
    stageTagValueChange,
    commitPendingChanges,
    clearPendingChanges,
    getModifiedTags,
  };
};
