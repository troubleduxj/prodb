/**
 * RealtimeTables 功能模块 - 统一导出
 * 实时数据表结构浏览与管理
 */

// 主组件
export { RealtimeTables } from './RealtimeTables';
export { RealtimeTables as default } from './RealtimeTables';

// Hooks
export { useTreeData } from './hooks/useTreeData';
export { useSchema } from './hooks/useSchema';
export { useDataPreview } from './hooks/useDataPreview';
export { useSubTableTags } from './hooks/useSubTableTags';

// 组件
export { default as TreeView } from './components/TreeView';
export { default as SchemaEditor } from './components/SchemaEditor';
export { default as DatabaseInfo } from './components/DatabaseInfo';
export { default as DataPreviewTable } from './components/DataPreviewTable';
export { default as TagEditor } from './components/TagEditor';
export { default as SQLConsole } from './components/SQLConsole';

// 类型
export type { TreeNode, ColumnInfo, TagInfo, NodeType } from './types';
