/**
 * RealtimeLive 功能模块 - 类型定义
 * 包含所有接口定义和类型声明
 */

import React from 'react';
import { Zap, Activity, Thermometer, Droplets, Wind } from 'lucide-react';

// TDengine数据库接口
export interface Database {
  name: string;
  tables: number;
  vgroups: number;
  status: string;
}

// 超级表/子表接口
export interface SuperTable {
  name: string;
  stable_name?: string;
  database: string;
  columns?: TableColumn[];
}

// 表列定义
export interface TableColumn {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

// 查询结果数据
export interface QueryResult {
  columns: string[];
  data: any[];
  rows: number;
}

// 图表字段配置
export interface FieldConfig {
  key: string;
  label: string;
  color: string;
  icon: React.ElementType;
}

// 图表类型
export type ChartType = 'line' | 'bar' | 'area';

// 刷新频率 (毫秒)
export type RefreshRate = 1000 | 5000 | 10000;

// 数据点
export interface DataPoint {
  time: string;
  fullTime: string;
  [key: string]: any;
}

// 图标映射 - 使用直接的导入
export const iconMap: Record<string, React.ElementType> = {
  'current': Zap,
  'voltage': Activity,
  'temp': Thermometer,
  'temperature': Thermometer,
  'humidity': Droplets,
  'pressure': Wind,
  'default': Activity
};

// 颜色配置
export const colorPalette = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];
