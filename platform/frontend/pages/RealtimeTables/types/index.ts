/**
 * RealtimeTables 类型定义
 */

export type NodeType = 'DB' | 'CATEGORY' | 'STABLE' | 'TABLE' | 'VIEW';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  children?: TreeNode[];
  expanded?: boolean;
  parentId?: string;
  dbName?: string;
  loading?: boolean;
  superTableName?: string;
  tags?: Record<string, any>;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

export interface TagInfo {
  name: string;
  type: string;
  length?: number;
}

export interface SchemaData {
  columns: ColumnInfo[];
  tags: TagInfo[];
}

export interface QueryResult {
  columns: string[];
  data: any[];
  rows: number;
}
