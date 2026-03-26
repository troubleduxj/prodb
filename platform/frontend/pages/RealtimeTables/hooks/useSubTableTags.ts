import { useState, useEffect } from 'react';
import { api } from '../../../src/services/api';
import type { TreeNode } from '../types';

export const useSubTableTags = (selectedNode: TreeNode | null) => {
  const [tagValues, setTagValues] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadTagValues = async () => {
      if (!selectedNode || selectedNode.type !== 'TABLE') {
        setTagValues({});
        return;
      }

      const dbName = selectedNode.dbName;
      if (!dbName) {
        setTagValues({});
        return;
      }

      try {
        const result = await api.tdengine.getSubTableInfo(dbName, selectedNode.name);
        if (result.success && result.data) {
          const info = result.data.data || result.data;
          setTagValues(info.tags || {});
        } else {
          setTagValues({});
        }
      } catch (error) {
        console.error('Failed to load sub-table tag values:', error);
        setTagValues({});
      }
    };

    loadTagValues();
  }, [selectedNode]);

  return { tagValues, setTagValues };
};
