/**
 * RealtimeLive 功能模块 - 主组件 (重构后)
 * 简化版：仅负责组装子组件和管理样式
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useRealtimeData } from './useRealtimeData';
import { ControlPanel } from './ControlPanel';
import { ChartArea } from './ChartArea';
import { DataTable } from './DataTable';
import type { ChartType, RefreshRate } from './types';

export const RealtimeLive: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // 本地状态（仅UI相关）
  const [chartType, setChartType] = useState<ChartType>('line');

  // 使用数据管理Hook
  const {
    // 状态
    databases,
    superTables,
    subTables,
    selectedDb,
    selectedSuperTable,
    selectedSubTable,
    dbLoading,
    tableLoading,
    dataLoading,
    columns,
    timestampColumn,
    refreshRate,
    isPaused,
    dataPoints,
    visibleFields,
    fieldConfigs,
    lastUpdateTime,
    error,

    // 设置器
    setSelectedDb,
    setSelectedSuperTable,
    setSelectedSubTable,
    setRefreshRate,
    setIsPaused,
    setError,
    setDataPoints,

    // 操作
    fetchRealtimeData,
    toggleField
  } = useRealtimeData();

  // 样式辅助函数
  const getBgClass = () => isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const getSubBgClass = () => isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-100 border-gray-300';
  const getTextClass = () => isDark ? 'text-gray-200' : 'text-gray-700';
  const getSubTextClass = () => isDark ? 'text-gray-400' : 'text-gray-500';
  const getBorderClass = () => isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-in fade-in duration-300">
      {/* 左侧控制面板 */}
      <ControlPanel
        databases={databases}
        superTables={superTables}
        subTables={subTables}
        fieldConfigs={fieldConfigs}
        visibleFields={visibleFields}
        selectedDb={selectedDb}
        selectedSuperTable={selectedSuperTable}
        selectedSubTable={selectedSubTable}
        dbLoading={dbLoading}
        tableLoading={tableLoading}
        dataLoading={dataLoading}
        isDark={isDark}
        setSelectedDb={setSelectedDb}
        setSelectedSuperTable={setSelectedSuperTable}
        setSelectedSubTable={setSelectedSubTable}
        onRefresh={fetchRealtimeData}
        onToggleField={toggleField}
        getBgClass={getBgClass}
        getSubBgClass={getSubBgClass}
        getTextClass={getTextClass}
        getSubTextClass={getSubTextClass}
        getBorderClass={getBorderClass}
      />

      {/* 右侧图表区域 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <ChartArea
          dataPoints={dataPoints}
          fieldConfigs={fieldConfigs}
          visibleFields={visibleFields}
          selectedDb={selectedDb}
          selectedSubTable={selectedSubTable}
          dataLoading={dataLoading}
          chartType={chartType}
          refreshRate={refreshRate}
          isPaused={isPaused}
          lastUpdateTime={lastUpdateTime}
          error={error}
          setChartType={setChartType}
          setRefreshRate={setRefreshRate}
          setIsPaused={setIsPaused}
          setError={setError}
          isDark={isDark}
          getBgClass={getBgClass}
          getSubBgClass={getSubBgClass}
          getSubTextClass={getSubTextClass}
        />

        {/* 数据表格 */}
        <DataTable
          dataPoints={dataPoints}
          fieldConfigs={fieldConfigs}
          visibleFields={visibleFields}
          isDark={isDark}
          getBgClass={getBgClass}
          getSubBgClass={getSubBgClass}
          getSubTextClass={getSubTextClass}
          getBorderClass={getBorderClass}
          onClear={() => setDataPoints([])}
        />
      </div>
    </div>
  );
};

export default RealtimeLive;
