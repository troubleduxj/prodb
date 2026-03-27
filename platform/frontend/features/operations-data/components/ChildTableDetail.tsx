import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Settings2, Tag, Loader2 } from 'lucide-react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import type { ViewContext, TableSchema } from '../types';
import { DataPreviewPanel } from './DataPreviewPanel';
import { SchemaEditor } from './SchemaEditor';
import { TagAttributesEditor } from './TagAttributesEditor';

export interface ChildTableDetailProps {
  /** 视图上下文 */
  viewContext: ViewContext;
  /** 面包屑组件 */
  breadcrumbs: React.ReactNode;
  /** 当前活动标签 */
  activeTab: 'preview' | 'schema' | 'tags';
  /** 标签切换回调 */
  onTabChange: (tab: 'preview' | 'schema' | 'tags') => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * 子表详情组件
 * 包含数据预览、标签属性和 Schema 查看标签页
 */
export const ChildTableDetail: React.FC<ChildTableDetailProps> = ({
  viewContext,
  breadcrumbs,
  activeTab,
  onTabChange,
  isDark,
}) => {
  const { t } = useTranslation();
  const [schema, setSchema] = useState<TableSchema>({ metrics: [], tags: [] });
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Array<Record<string, any>>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tags, setTags] = useState<Record<string, any>>(viewContext.tags || {});
  const [tagsLoading, setTagsLoading] = useState(false);

  // 获取子表 Schema
  const fetchSchema = useCallback(async () => {
    if (!viewContext.db || !viewContext.name) return;

    try {
      setSchemaLoading(true);
      const result = await api.tdengine.getSubTableInfo(viewContext.db, viewContext.name);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        // 从子表信息中提取 Schema
        const metrics = data.columns || [];
        const tags = data.tags || [];
        setSchema({ metrics, tags });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load schema',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load schema',
        variant: 'destructive',
      });
    } finally {
      setSchemaLoading(false);
    }
  }, [viewContext.db, viewContext.name]);

  // 获取子表数据预览
  const fetchPreviewData = useCallback(async () => {
    if (!viewContext.db || !viewContext.name) return;

    try {
      setPreviewLoading(true);
      const result = await api.tdengine.getSubTablePreview(viewContext.db, viewContext.name, 100);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        setPreviewData(data.rows || data);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load preview data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load preview data',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [viewContext.db, viewContext.name]);

  // 获取子表标签
  const fetchTags = useCallback(async () => {
    if (!viewContext.db || !viewContext.name) return;

    try {
      setTagsLoading(true);
      const result = await api.tdengine.getSubTableInfo(viewContext.db, viewContext.name);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        setTags(data.tags || {});
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load tags',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load tags',
        variant: 'destructive',
      });
    } finally {
      setTagsLoading(false);
    }
  }, [viewContext.db, viewContext.name]);

  // 保存标签
  const handleSaveTags = useCallback(
    async (updatedTags: Record<string, any>) => {
      if (!viewContext.db || !viewContext.name) return;

      try {
        setTagsLoading(true);
        const result = await api.tdengine.bulkUpdateSubTableTags(
          viewContext.db,
          viewContext.name,
          updatedTags
        );

        if (result.success) {
          setTags(updatedTags);
          toast({
            title: 'Success',
            description: 'Tags updated successfully',
            variant: 'success',
          });
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Failed to update tags',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update tags',
          variant: 'destructive',
        });
      } finally {
        setTagsLoading(false);
      }
    },
    [viewContext.db, viewContext.name]
  );

  // 当切换到 Schema 标签时加载 Schema
  useEffect(() => {
    if (activeTab === 'schema') {
      fetchSchema();
    }
  }, [activeTab, fetchSchema]);

  // 当切换到 Preview 标签时加载预览数据
  useEffect(() => {
    if (activeTab === 'preview') {
      fetchPreviewData();
    }
  }, [activeTab, fetchPreviewData]);

  // 当切换到 Tags 标签时加载标签
  useEffect(() => {
    if (activeTab === 'tags') {
      fetchTags();
    }
  }, [activeTab, fetchTags]);

  return (
    <>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 shrink-0 ${
          isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            {breadcrumbs}
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {viewContext.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-purple-500/10 text-purple-300 border-purple-500/20">
                {t('operations.data.childTable', 'Child Table')}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`flex rounded-lg p-1 ${
            isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200 border'
          }`}
        >
          <button
            onClick={() => onTabChange('preview')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? isDark
                  ? 'bg-gray-700 text-white'
                  : 'bg-white text-gray-900 shadow'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('operations.data.dataPreview', 'Data Preview')}
          </button>
          <button
            onClick={() => onTabChange('tags')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center ${
              activeTab === 'tags'
                ? 'bg-purple-600/20 text-purple-300'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-3 h-3 mr-1.5" />
            {t('operations.data.attributes', 'Attributes (Tags)')}
          </button>
          <button
            onClick={() => onTabChange('schema')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center ${
              activeTab === 'schema'
                ? isDark
                  ? 'bg-gray-700 text-white'
                  : 'bg-white text-gray-900 shadow'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings2 className="w-3 h-3 mr-1.5" />
            {t('operations.data.viewSchema', 'View Schema')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto p-0 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50/50'}`}>
        {activeTab === 'preview' && (
          <DataPreviewPanel
            viewType="CHILD_TABLE"
            tableName={viewContext.name}
            isDark={isDark}
            data={previewData}
            loading={previewLoading}
          />
        )}

        {activeTab === 'tags' && (
          <div className="relative">
            {tagsLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <TagAttributesEditor
              tableName={viewContext.name}
              initialTags={tags}
              isDark={isDark}
              onSave={handleSaveTags}
            />
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="relative">
            {schemaLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <SchemaEditor schema={schema} onAdd={() => {}} readOnly={true} isDark={isDark} />
          </div>
        )}
      </div>
    </>
  );
};

export default ChildTableDetail;
