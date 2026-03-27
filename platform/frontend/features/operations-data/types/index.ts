/**
 * OperationsData 功能模块类型定义
 * 包含：列定义、表结构、视图上下文、数据质量等类型
 */

// === 基础列定义 ===

/** 列定义 */
export interface ColumnDef {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

/** 表 Schema */
export interface TableSchema {
  metrics: ColumnDef[];
  tags: ColumnDef[];
}

// === 视图上下文 ===

/** 视图上下文类型 */
export type ViewContextType = 'DB' | 'SUPER_TABLE' | 'CHILD_TABLE' | 'NONE';

/** 视图上下文 */
export interface ViewContext {
  type: ViewContextType;
  name: string;
  db?: string;
  st?: string;
  tags?: Record<string, any>;
}

// === 活动标签 ===

/** 活动标签类型 */
export type ActiveTab = 'preview' | 'schema' | 'quality' | 'tags';

// === 数据质量 ===

/** 数据质量数据 */
export interface QualityData {
  score: number;
  outOfOrder: number;
  nullRate: number;
  duplication: number;
  trend: number[];
  defaultSuggestion: string;
}

/** 数据质量分析模式 */
export type AnalysisMode = 'RULE' | 'AI';

// === 列管理 ===

/** 新列表单数据 */
export interface NewColumnForm {
  name: string;
  type: string;
  length: number;
  isTag: boolean;
}

/** 列类型选项 */
export const COLUMN_TYPES = [
  'INT',
  'BIGINT',
  'FLOAT',
  'DOUBLE',
  'BOOL',
  'TIMESTAMP',
  'BINARY',
  'NCHAR',
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

// === 数据库配置 ===

/** 数据库配置 */
export interface DatabaseConfig {
  name: string;
  keepDays: number;
  duration: number;
  replicaFactor: number;
  walLevel: number;
  vgroups: number;
}

// === 子表信息 ===

/** 子表信息 */
export interface SubTableInfo {
  name: string;
  tags: Record<string, any>;
}

// === 超级表信息 ===

/** 超级表信息 */
export interface SuperTableInfo {
  name: string;
  database: string;
  schema?: TableSchema;
}

// === 数据预览 ===

/** 数据预览行 */
export interface DataPreviewRow {
  ts: string;
  [key: string]: any;
}

/** 数据预览响应 */
export interface DataPreviewResponse {
  columns: string[];
  rows: DataPreviewRow[];
  total: number;
}

// === API 请求类型 ===

/** 添加列请求 */
export interface AddColumnRequest {
  name: string;
  type: string;
  length?: number;
  isTag: boolean;
}

/** 更新标签请求 */
export interface UpdateTagsRequest {
  tags: Record<string, any>;
}

/** 子表列表响应 */
export interface SubTableListResponse {
  subtables: SubTableInfo[];
  total: number;
}

/** 数据质量响应 */
export interface DataQualityResponse {
  score: number;
  outOfOrder: number;
  nullRate: number;
  duplication: number;
  trend: number[];
  suggestion: string;
}
