import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Settings2, Activity, Loader2 } from 'lucide-react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import type { ViewContext, SubTableInfo, TableSchema } from '../types';
import { DataPreviewPanel } from './DataPreviewPanel';
import { SchemaEditor } from './SchemaEditor';
import { DataQualityPanel } from './DataQualityPanel';
import type { UseDataQualityReturn } from '../hooks/useDataQuality';
import type { UseColumnManagerReturn } from '../hooks/useColumnManager';

export interface SuperTableDetailProps {
  /** 视图上下文 */
  viewContext: ViewContext;
  /** 面包屑组件 */
  breadcrumbs: React.ReactNode;
  /** 子表映射 */
  childTablesMap: Record<string, SubTableInfo[]>;
  /** 当前活动标签 */
  activeTab: 'preview' | 'schema' | 'quality';
  /** 标签切换回调 */
  onTabChange: (tab: 'preview' | 'schema' | 'quality') => void;
  /** 数据质量 hook 返回值 */
  dataQuality: UseDataQualityReturn;
  /** 列管理 hook 返回值 */
  columnManager: UseColumnManagerReturn;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * 超级表详情组件
 * 包含数据预览、Schema 编辑和数据质量标签页
 */
export const SuperTableDetail: React.FC<SuperTableDetailProps> = ({
  viewContext,
  breadcrumbs,
  childTablesMap,
  activeTab,
  onTabChange,
  dataQuality,
  columnManager,
  isDark,
}) => {
  const { t } = useTranslation();
  const [schema, setSchema] = useState<TableSchema>({ metrics: [], tags: [] });
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Array<Record<string, any>>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const childTableCount = childTablesMap[viewContext.name]?.length || 0;

  // 获取超级表 Schema
  const fetchSchema = useCallback(async () => {
    if (!viewContext.db || !viewContext.name) return;

    try {
      setSchemaLoading(true);
      const result = await api.tdengine.getSuperTableSchema(viewContext.db, viewContext.name);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        // 转换后端返回的 Schema 格式
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

  // 获取超级表数据预览
  const fetchPreviewData = useCallback(async () => {
    if (!viewContext.db || !viewContext.name) return;

    try {
      setPreviewLoading(true);
      const result = await api.tdengine.getSuperTablePreview(viewContext.db, viewContext.name, 100);

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

  // 当切换到 Quality 标签时加载数据质量
  useEffect(() => {
    if (activeTab === 'quality' && viewContext.db && viewContext.name) {
      dataQuality.fetchDataQuality(viewContext.db, viewContext.name);
    }
  }, [activeTab, viewContext.db, viewContext.name, dataQuality.fetchDataQuality]);

  // 处理添加列
  const handleAddColumn = useCallback(
    async (type: 'metric' | 'tag') => {
      if (!viewContext.db || !viewContext.name) return;

      const success = await columnManager.handleAddColumn(viewContext.db, viewContext.name);
      if (success) {
        // 刷新 Schema
        fetchSchema();
      }
    },
    [viewContext.db, viewContext.name, columnManager, fetchSchema]
  );

  return (
    <>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 shrink-0 ${
          isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            {breadcrumbs}
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {viewContext.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-blue-500/10 text-blue-300 border-blue-500/20">
                {t('operations.data.superTable', 'Super Table')}
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
            {t('operations.data.schema', 'Schema')}
          </button>
          <button
            onClick={() => onTabChange('quality')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center ${
              activeTab === 'quality'
                ? 'bg-blue-600/20 text-blue-400'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="w-3 h-3 mr-1.5" />
            {t('operations.data.dataQuality', 'Data Quality')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto p-0 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50/50'}`}>
        {activeTab === 'preview' && (
          <DataPreviewPanel
            viewType="SUPER_TABLE"
            tableName={viewContext.name}
            childTableCount={childTableCount}
            isDark={isDark}
            data={previewData}
            loading={previewLoading}
          />
        )}

        {activeTab === 'schema' && (
          <div className="relative">
            {schemaLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <SchemaEditor
              schema={schema}
              onAdd={handleAddColumn}
              readOnly={false}
              isDark={isDark}
            />
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="relative">
            {(dataQuality.loading || dataQuality.isAnalyzing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            {dataQuality.qualityData && (
              <DataQualityPanel
                qualityData={dataQuality.qualityData}
                aiSuggestion={dataQuality.aiSuggestion}
                isAnalyzing={dataQuality.isAnalyzing}
                analysisMode={dataQuality.analysisMode}
                onAnalyzeWithAI={() => dataQuality.runAiAnalysis(viewContext.name)}
                onRegenerateInsight={() => dataQuality.regenerateInsight(viewContext.name)}
                isDark={isDark}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SuperTableDetail;
