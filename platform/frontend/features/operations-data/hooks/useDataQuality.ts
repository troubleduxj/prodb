import { useState, useMemo, useCallback } from 'react';
import { api } from '../../../src/services/api';
import { analyzeDataQuality as analyzeWithGemini } from '../../../services/geminiService';
import type { QualityData, AnalysisMode } from '../types';

export interface UseDataQualityReturn {
  /** 质量数据 */
  qualityData: QualityData | null;
  /** AI 建议 */
  aiSuggestion: string | null;
  /** 是否分析中 */
  isAnalyzing: boolean;
  /** 分析模式 */
  analysisMode: AnalysisMode;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 获取数据质量 */
  fetchDataQuality: (database: string, tableName: string) => Promise<void>;
  /** 运行 AI 分析 */
  runAiAnalysis: (tableName: string) => Promise<void>;
  /** 重置分析状态 */
  resetAnalysis: () => void;
  /** 重新生成建议 */
  regenerateInsight: (tableName: string) => Promise<void>;
}

/**
 * 数据质量分析 Hook
 * 管理数据质量分析和 AI 建议
 */
export const useDataQuality = (database?: string, tableName?: string): UseDataQualityReturn => {
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('RULE');
  const [qualityData, setQualityData] = useState<QualityData | null>(null);

  // 获取数据质量
  const fetchDataQuality = useCallback(async (db: string, table: string) => {
    if (!db || !table) return;

    try {
      setLoading(true);
      setError(null);
      const result = await api.tdengine.analyzeDataQuality(db, table);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        setQualityData({
          score: data.score || 0,
          outOfOrder: data.outOfOrder || 0,
          nullRate: data.nullRate || 0,
          duplication: data.duplication || 0,
          trend: data.trend || [],
          defaultSuggestion: data.suggestion || data.defaultSuggestion || 'No suggestion available',
        });
      } else {
        const errorMsg = result.error || 'Failed to analyze data quality';
        setError(errorMsg);
        // 如果 API 失败，设置默认值
        setQualityData({
          score: 0,
          outOfOrder: 0,
          nullRate: 0,
          duplication: 0,
          trend: [],
          defaultSuggestion: 'Unable to analyze data quality at this time.',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setQualityData({
        score: 0,
        outOfOrder: 0,
        nullRate: 0,
        duplication: 0,
        trend: [],
        defaultSuggestion: 'Error analyzing data quality.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // 运行 AI 分析
  const runAiAnalysis = useCallback(async (targetTableName: string) => {
    if (!qualityData) return;

    setIsAnalyzing(true);
    try {
      const suggestion = await analyzeWithGemini(targetTableName, {
        outOfOrder: qualityData.outOfOrder,
        nullRate: qualityData.nullRate,
        duplication: qualityData.duplication,
      });
      setAiSuggestion(suggestion);
      setAnalysisMode('AI');
    } catch (error) {
      console.error('AI 分析失败:', error);
      // 降级到规则模式
      setAiSuggestion(null);
      setAnalysisMode('RULE');
    } finally {
      setIsAnalyzing(false);
    }
  }, [qualityData]);

  // 重新生成建议
  const regenerateInsight = useCallback(async (targetTableName: string) => {
    await runAiAnalysis(targetTableName);
  }, [runAiAnalysis]);

  // 重置分析状态
  const resetAnalysis = useCallback(() => {
    setAiSuggestion(null);
    setAnalysisMode('RULE');
    setIsAnalyzing(false);
    setQualityData(null);
    setError(null);
  }, []);

  return {
    qualityData,
    aiSuggestion,
    isAnalyzing,
    analysisMode,
    loading,
    error,
    fetchDataQuality,
    runAiAnalysis,
    resetAnalysis,
    regenerateInsight,
  };
};

export default useDataQuality;
