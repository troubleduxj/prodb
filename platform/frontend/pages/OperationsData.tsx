/**
 * OperationsData 页面入口
 *
 * 此文件为重导出文件，实际实现位于 features/operations-data/OperationsData.tsx
 * 重构后的模块遵循前端目录结构规范，将 791 行代码拆分为多个独立文件：
 *
 * - types/index.ts: 类型定义
 * - hooks/: 自定义 Hooks (useDatabaseTree, useViewContext, useDataQuality, useColumnManager)
 * - components/: UI 组件 (DatabaseTree, SqlConsole, DatabaseSettings, SuperTableDetail, ChildTableDetail, etc.)
 * - OperationsData.tsx: 主组件 (~180 行)
 */

export { OperationsData as default, OperationsData } from '../features/operations-data';
