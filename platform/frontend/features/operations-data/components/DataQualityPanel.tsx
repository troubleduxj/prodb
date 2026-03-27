import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckCircle, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import type { QualityData, AnalysisMode } from '../types';

export interface DataQualityPanelProps {
  /** 质量数据 */
  qualityData: QualityData;
  /** AI 建议 */
  aiSuggestion: string | null;
  /** 是否分析中 */
  isAnalyzing: boolean;
  /** 分析模式 */
  analysisMode: AnalysisMode;
  /** AI 分析回调 */
  onAnalyzeWithAI: () => void;
  /** 重新生成建议回调 */
  onRegenerateInsight: () => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * 数据质量面板组件
 * 显示质量分数、健康评估和 AI 分析
 */
export const DataQualityPanel: React.FC<DataQualityPanelProps> = ({
  qualityData,
  aiSuggestion,
  isAnalyzing,
  analysisMode,
  onAnalyzeWithAI,
  onRegenerateInsight,
  isDark,
}) => {
  const { t } = useTranslation();

  // 根据分数获取颜色
  const getScoreColor = (score: number) => {
    if (score > 90) return 'text-green-500';
    if (score > 75) return 'text-yellow-500';
    return 'text-red-500';
  };

  // 渲染指标卡片
  const renderMetricCard = (
    title: string,
    value: string | number,
    unit: string,
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <div
      className={`p-4 rounded-xl border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {title}
        </span>
        <div className={colorClass}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
        {value}
        <span className="text-sm font-normal ml-1 text-gray-500">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Overall Score Banner */}
      <div
        className={`flex items-center gap-8 p-6 rounded-xl border ${
          isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        {/* Circular Progress */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className={isDark ? 'text-gray-700' : 'text-gray-300'}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className={getScoreColor(qualityData.score)}
              strokeDasharray={`${qualityData.score}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {qualityData.score}
            </span>
            <span className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              {t('operations.data.qualityScore', 'Quality Score')}
            </span>
          </div>
        </div>

        {/* Health Assessment */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className={`font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              <Activity className="w-5 h-5 mr-2 text-blue-400" />
              {t('operations.data.healthAssessment', 'Health Assessment')}
            </h4>
            <button
              onClick={analysisMode === 'AI' ? onRegenerateInsight : onAnalyzeWithAI}
              disabled={isAnalyzing}
              className={`flex items-center text-xs px-3 py-1.5 rounded-lg border transition-all ${
                analysisMode === 'AI'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 border-gray-300 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isAnalyzing ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-3 h-3 mr-2" />
              )}
              {analysisMode === 'AI'
                ? t('operations.data.regenerateInsight', 'Regenerate Insight')
                : t('operations.data.analyzeWithAI', 'Analyze with AI')}
            </button>
          </div>

          {/* Suggestion Box */}
          <div
            className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
              analysisMode === 'AI'
                ? 'bg-purple-900/10 border-purple-500/30'
                : isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
            }`}
          >
            <div className="mt-0.5">
              {analysisMode === 'AI' ? (
                <Sparkles className="w-5 h-5 text-purple-400" />
              ) : qualityData.score > 90 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <ShieldAlert className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              )}
            </div>
            <div>
              <p
                className={`text-sm font-medium mb-1 ${
                  analysisMode === 'AI'
                    ? 'text-purple-300'
                    : isDark
                      ? 'text-gray-300'
                      : 'text-gray-700'
                }`}
              >
                {analysisMode === 'AI'
                  ? t('operations.data.aiReliabilityInsight', 'AI Reliability Insight')
                  : t('operations.data.ruleBasedSuggestion', 'Rule-Based Suggestion')}
              </p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {aiSuggestion || qualityData.defaultSuggestion}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderMetricCard(
          t('operations.data.outOfOrder', 'Out of Order'),
          qualityData.outOfOrder,
          '%',
          <Activity className="w-4 h-4" />,
          qualityData.outOfOrder > 1 ? 'text-red-400' : 'text-green-400'
        )}
        {renderMetricCard(
          t('operations.data.nullRate', 'Null Rate'),
          qualityData.nullRate,
          '%',
          <ShieldAlert className="w-4 h-4" />,
          qualityData.nullRate > 2 ? 'text-yellow-400' : 'text-green-400'
        )}
        {renderMetricCard(
          t('operations.data.duplication', 'Duplication'),
          qualityData.duplication,
          '%',
          <CheckCircle className="w-4 h-4" />,
          qualityData.duplication > 0.5 ? 'text-red-400' : 'text-green-400'
        )}
      </div>
    </div>
  );
};

export default DataQualityPanel;
