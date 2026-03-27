# OperationsData 前端拆分设计方案

> 版本: 1.0  
> 日期: 2026-03-27  
> 基于: docs/FRONTEND_DIRECTORY_STRUCTURE_GUIDE.md 规范

---

## 一、现状分析

### 1.1 文件信息
- **当前文件**: `platform/frontend/pages/OperationsData.tsx`
- **代码行数**: 791 行
- **问题**: 严重超出 400 行规范限制，包含多个独立功能模块

### 1.2 功能模块识别

```
OperationsData.tsx (791行)
├── Mock 数据生成器 (getQualityStats, generateChildTables)
├── Types 类型定义 (ColumnDef, TableSchema)
├── Sub-Components 子组件
│   ├── SchemaEditor (92行) - Schema 编辑器
│   ├── TagAttributesEditor (46行) - 标签属性编辑器
│   └── DatabaseSettings (66行) - 数据库设置面板
├── Main Component 主组件 (519行)
│   ├── State Management (11个 state)
│   ├── Event Handlers (5个 handler)
│   ├── Sidebar Tree (数据库树)
│   ├── SQL Console (SQL 控制台)
│   └── Content Panel (内容面板)
└── Modals 弹窗
    └── Add Column Modal (添加列弹窗)
```

### 1.3 状态管理分析

| State | 用途 | 归属 |
|-------|------|------|
| `expandedDb` | 展开的数据库 | DatabaseTree |
| `expandedSt` | 展开的超级表 | DatabaseTree |
| `viewContext` | 当前视图上下文 | ViewContext |
| `activeTab` | 当前活动标签 | ContentPanel |
| `showSqlConsole` | SQL 控制台显隐 | SqlConsole |
| `showAddColumnModal` | 添加列弹窗显隐 | AddColumnModal |
| `aiSuggestion` | AI 分析建议 | DataQualityPanel |
| `isAnalyzing` | AI 分析中状态 | DataQualityPanel |
| `analysisMode` | 分析模式 | DataQualityPanel |
| `newCol` | 新列表单数据 | AddColumnModal |

---

## 二、拆分设计

### 2.1 目标目录结构

```
platform/frontend/features/operations-data/
├── index.ts                          # 统一导出入口
├── OperationsData.tsx                # 主页面组件 (~250行)
├── types/
│   └── index.ts                      # 类型定义
├── hooks/
│   ├── index.ts                      # hooks 统一导出
│   ├── useDatabaseTree.ts            # 数据库树数据管理
│   ├── useViewContext.ts             # 视图上下文状态
│   ├── useDataQuality.ts             # 数据质量分析
│   └── useColumnManager.ts           # 列管理（添加/删除）
├── components/
│   ├── index.ts                      # 组件统一导出
│   ├── DatabaseTree.tsx              # 左侧数据库树
│   ├── SqlConsole.tsx                # SQL 控制台
│   ├── DatabaseSettings.tsx          # 数据库设置面板
│   ├── SuperTableDetail.tsx          # 超级表详情
│   ├── ChildTableDetail.tsx          # 子表详情
│   ├── DataPreviewPanel.tsx          # 数据预览面板
│   ├── SchemaEditor.tsx              # Schema 编辑器
│   ├── DataQualityPanel.tsx          # 数据质量面板
│   ├── TagAttributesEditor.tsx       # 标签属性编辑器
│   ├── Breadcrumbs.tsx               # 面包屑导航
│   └── AddColumnModal.tsx            # 添加列弹窗
└── utils/
    └── index.ts                      # 工具函数
```

### 2.2 文件拆分详情

#### 2.2.1 类型定义 (types/index.ts)

```typescript
// 列定义
export interface ColumnDef {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

// 表 Schema
export interface TableSchema {
  metrics: ColumnDef[];
  tags: ColumnDef[];
}

// 视图上下文类型
export type ViewContextType = 'DB' | 'SUPER_TABLE' | 'CHILD_TABLE' | 'NONE';

export interface ViewContext {
  type: ViewContextType;
  name: string;
  db?: string;
  st?: string;
  tags?: Record<string, any>;
}

// 活动标签类型
export type ActiveTab = 'preview' | 'schema' | 'quality' | 'tags';

// 数据质量数据
export interface QualityData {
  score: number;
  outOfOrder: number;
  nullRate: number;
  duplication: number;
  trend: number[];
  defaultSuggestion: string;
}

// 新列表单
export interface NewColumnForm {
  name: string;
  type: string;
  length: number;
  isTag: boolean;
}
```

#### 2.2.2 Hooks 拆分

**useDatabaseTree.ts** (~100行)
- 管理数据库树展开状态
- 获取数据库/超级表/子表列表
- 处理树节点点击事件

**useViewContext.ts** (~80行)
- 管理当前视图上下文
- 处理视图切换逻辑
- 维护面包屑导航状态

**useDataQuality.ts** (~120行)
- 数据质量分析状态
- AI 分析调用
- 质量指标计算

**useColumnManager.ts** (~80行)
- 添加列弹窗状态
- 表单数据管理
- 列添加/删除操作

#### 2.2.3 组件拆分

**DatabaseTree.tsx** (~150行)
- 左侧树形结构
- 三级层级：Database → SuperTable → ChildTable
- 展开/折叠逻辑

**SqlConsole.tsx** (~80行)
- 可折叠 SQL 控制台
- SQL 输入区域
- 执行按钮

**DatabaseSettings.tsx** (~120行)
- 数据库配置表单
- 保留策略设置
- 性能参数设置

**SuperTableDetail.tsx** (~180行)
- 超级表详情容器
- 标签切换逻辑
- 子组件组合

**ChildTableDetail.tsx** (~150行)
- 子表详情容器
- 标签切换逻辑
- 子组件组合

**DataPreviewPanel.tsx** (~100行)
- 数据预览表格
- 列头渲染
- 模拟数据生成

**SchemaEditor.tsx** (~120行)
- Schema 编辑界面
- Metrics/Tabs 分区
- 添加/删除列按钮

**DataQualityPanel.tsx** (~200行)
- 质量分数环形图
- 健康评估面板
- AI 分析按钮
- 指标网格

**TagAttributesEditor.tsx** (~100行)
- 标签值编辑表格
- 保存按钮
- 提示信息

**Breadcrumbs.tsx** (~60行)
- 面包屑导航
- 点击跳转逻辑

**AddColumnModal.tsx** (~150行)
- 添加列弹窗
- 表单验证
- 类型选择

---

## 三、主组件重构 (OperationsData.tsx)

### 3.1 重构后主组件结构 (~250行)

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useDatabaseTree, useViewContext } from './hooks';
import {
  DatabaseTree,
  SqlConsole,
  DatabaseSettings,
  SuperTableDetail,
  ChildTableDetail,
  Breadcrumbs
} from './components';
import type { ViewContextType } from './types';

export const OperationsData: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  // 使用自定义 hooks 管理状态
  const { 
    expandedDb, 
    expandedSt, 
    childTablesMap,
    handleDbClick, 
    handleStClick, 
    handleCtClick 
  } = useDatabaseTree();
  
  const { viewContext, setViewContext, navigateToDb, navigateToSt } = useViewContext();
  
  // SQL 控制台显隐状态
  const [showSqlConsole, setShowSqlConsole] = React.useState(false);
  
  // 渲染面包屑
  const breadcrumbs = React.useMemo(() => (
    <Breadcrumbs 
      viewContext={viewContext}
      onNavigateToDb={navigateToDb}
      onNavigateToSt={navigateToSt}
      isDark={isDark}
    />
  ), [viewContext, isDark]);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* 左侧树形结构 */}
      <DatabaseTree
        databases={['power_db', 'factory_db', 'fleet_db', 'sys_db']}
        expandedDb={expandedDb}
        expandedSt={expandedSt}
        viewContext={viewContext}
        childTablesMap={childTablesMap}
        onDbClick={handleDbClick}
        onStClick={handleStClick}
        onCtClick={handleCtClick}
        isDark={isDark}
      />

      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* SQL 控制台 */}
        <SqlConsole
          show={showSqlConsole}
          onToggle={() => setShowSqlConsole(!showSqlConsole)}
          isDark={isDark}
        />

        {/* 内容面板 */}
        <div className="flex-1 rounded-xl flex flex-col overflow-hidden min-h-0 relative ...">
          {viewContext.type === 'DB' && (
            <DatabaseSettings dbName={viewContext.name} isDark={isDark} />
          )}
          
          {viewContext.type === 'SUPER_TABLE' && (
            <SuperTableDetail
              viewContext={viewContext}
              breadcrumbs={breadcrumbs}
              childTablesMap={childTablesMap}
              isDark={isDark}
            />
          )}
          
          {viewContext.type === 'CHILD_TABLE' && (
            <ChildTableDetail
              viewContext={viewContext}
              breadcrumbs={breadcrumbs}
              isDark={isDark}
            />
          )}
          
          {viewContext.type === 'NONE' && (
            <EmptyState isDark={isDark} />
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationsData;
```

---

## 四、API 集成规划

### 4.1 API 服务封装

创建 `platform/frontend/src/services/operationsDataApi.ts`：

```typescript
import { api } from './api';
import type { 
  DatabaseConfig, 
  DataPreviewResponse, 
  DataQualityResponse,
  SubTableListResponse,
  AddColumnRequest,
  UpdateTagsRequest
} from '../../features/operations-data/types';

export const operationsDataApi = {
  // 数据库配置
  getDatabaseConfig: (dbName: string) => 
    api.get<{ data: DatabaseConfig }>(`/tdengine/databases/${dbName}/config`),
  
  updateDatabaseConfig: (dbName: string, config: Partial<DatabaseConfig>) =>
    api.put(`/tdengine/databases/${dbName}/config`, config),
  
  // 超级表数据预览
  getSuperTablePreview: (dbName: string, stName: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ data: DataPreviewResponse }>(`/tdengine/db/${dbName}/supertables/${stName}/preview`, { params }),
  
  // Schema 编辑
  addColumn: (dbName: string, stName: string, data: AddColumnRequest) =>
    api.post(`/tdengine/db/${dbName}/supertables/${stName}/columns`, data),
  
  removeColumn: (dbName: string, stName: string, columnName: string) =>
    api.delete(`/tdengine/db/${dbName}/supertables/${stName}/columns/${columnName}`),
  
  // 数据质量
  getDataQuality: (dbName: string, stName: string) =>
    api.get<{ data: DataQualityResponse }>(`/tdengine/db/${dbName}/supertables/${stName}/quality`),
  
  analyzeWithAI: (dbName: string, stName: string, metrics: any) =>
    api.post(`/tdengine/db/${dbName}/supertables/${stName}/quality/analyze`, { metrics }),
  
  // 子表管理
  listSubTables: (dbName: string, stName: string, params?: { limit?: number; offset?: number; filter?: string }) =>
    api.get<{ data: SubTableListResponse }>(`/tdengine/db/${dbName}/supertables/${stName}/subtables`, { params }),
  
  getSubTableTags: (dbName: string, subTableName: string) =>
    api.get<{ data: { tags: Record<string, any> } }>(`/tdengine/db/${dbName}/subtables/${subTableName}/tags`),
  
  updateSubTableTags: (dbName: string, subTableName: string, data: UpdateTagsRequest) =>
    api.put(`/tdengine/db/${dbName}/subtables/${subTableName}/tags`, data),
  
  getSubTablePreview: (dbName: string, subTableName: string, params?: { limit?: number; start_time?: string; end_time?: string }) =>
    api.get<{ data: DataPreviewResponse }>(`/tdengine/db/${dbName}/subtables/${subTableName}/preview`, { params }),
};
```

### 4.2 Hooks 与 API 集成

**useDatabaseTree.ts** 集成 API：

```typescript
import { useState, useEffect, useCallback } from 'react';
import { operationsDataApi } from '../../src/services/operationsDataApi';
import type { SubTableInfo } from '../types';

export const useDatabaseTree = () => {
  const [expandedDb, setExpandedDb] = useState<string | null>('power_db');
  const [expandedSt, setExpandedSt] = useState<string | null>(null);
  const [subTablesMap, setSubTablesMap] = useState<Record<string, SubTableInfo[]>>({});
  const [loading, setLoading] = useState(false);

  // 获取子表列表
  const fetchSubTables = useCallback(async (dbName: string, stName: string) => {
    try {
      setLoading(true);
      const { data } = await operationsDataApi.listSubTables(dbName, stName, { limit: 100 });
      setSubTablesMap(prev => ({
        ...prev,
        [stName]: data.subtables
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDbClick = (dbName: string) => {
    setExpandedDb(expandedDb === dbName ? null : dbName);
  };

  const handleStClick = (dbName: string, stName: string) => {
    const newExpandedSt = expandedSt === stName ? null : stName;
    setExpandedSt(newExpandedSt);
    if (newExpandedSt && !subTablesMap[stName]) {
      fetchSubTables(dbName, stName);
    }
  };

  return {
    expandedDb,
    expandedSt,
    subTablesMap,
    loading,
    handleDbClick,
    handleStClick
  };
};
```

---

## 五、实施步骤

### 5.1 阶段一：基础结构搭建

1. 创建目录结构
   ```bash
   mkdir -p platform/frontend/features/operations-data/{types,hooks,components,utils}
   ```

2. 创建 `types/index.ts`
3. 创建 `utils/index.ts`
4. 创建 `hooks/index.ts`

### 5.2 阶段二：Hooks 迁移

1. 实现 `useDatabaseTree.ts`
2. 实现 `useViewContext.ts`
3. 实现 `useDataQuality.ts`
4. 实现 `useColumnManager.ts`

### 5.3 阶段三：组件拆分

1. 迁移 `SchemaEditor.tsx`（已存在于 realtime-tables，考虑复用或复制）
2. 实现 `DatabaseTree.tsx`
3. 实现 `SqlConsole.tsx`
4. 实现 `DatabaseSettings.tsx`
5. 实现 `DataPreviewPanel.tsx`
6. 实现 `DataQualityPanel.tsx`
7. 实现 `TagAttributesEditor.tsx`
8. 实现 `Breadcrumbs.tsx`
9. 实现 `AddColumnModal.tsx`
10. 实现 `SuperTableDetail.tsx`
11. 实现 `ChildTableDetail.tsx`

### 5.4 阶段四：主组件重构

1. 重写 `OperationsData.tsx`
2. 创建 `index.ts` 统一导出
3. 更新 `pages/OperationsData.tsx` 为重导出

### 5.5 阶段五：API 集成

1. 创建 `services/operationsDataApi.ts`
2. 更新 hooks 集成真实 API
3. 添加错误处理和 loading 状态

---

## 六、注意事项

### 6.1 已有组件复用

`SchemaEditor.tsx` 已存在于 `features/realtime-tables/components/SchemaEditor.tsx`，需要评估：
- 复用：如果功能一致，从 realtime-tables 导出复用
- 复制：如果需求有差异，复制并修改

### 6.2 依赖关系

```
OperationsData.tsx
├── hooks/useDatabaseTree
│   └── services/operationsDataApi
├── hooks/useViewContext
├── hooks/useDataQuality
│   └── services/operationsDataApi
├── components/DatabaseTree
├── components/SqlConsole
├── components/DatabaseSettings
│   └── hooks/useDatabaseConfig (新建)
├── components/SuperTableDetail
│   ├── components/DataPreviewPanel
│   ├── components/SchemaEditor
│   └── components/DataQualityPanel
└── components/ChildTableDetail
    ├── components/DataPreviewPanel
    └── components/TagAttributesEditor
```

### 6.3 Mock 数据过渡

在 API 未完全实现前，保留 Mock 数据逻辑：
- 创建 `utils/mockData.ts`
- Hooks 优先使用 API，失败时降级到 Mock

---

## 七、文件变更清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `features/operations-data/types/index.ts` | 新增 | 类型定义 |
| `features/operations-data/utils/index.ts` | 新增 | 工具函数 |
| `features/operations-data/hooks/index.ts` | 新增 | Hooks 导出 |
| `features/operations-data/hooks/useDatabaseTree.ts` | 新增 | 数据库树 Hook |
| `features/operations-data/hooks/useViewContext.ts` | 新增 | 视图上下文 Hook |
| `features/operations-data/hooks/useDataQuality.ts` | 新增 | 数据质量 Hook |
| `features/operations-data/hooks/useColumnManager.ts` | 新增 | 列管理 Hook |
| `features/operations-data/components/index.ts` | 新增 | 组件导出 |
| `features/operations-data/components/DatabaseTree.tsx` | 新增 | 数据库树组件 |
| `features/operations-data/components/SqlConsole.tsx` | 新增 | SQL 控制台 |
| `features/operations-data/components/DatabaseSettings.tsx` | 新增 | 数据库设置 |
| `features/operations-data/components/SuperTableDetail.tsx` | 新增 | 超级表详情 |
| `features/operations-data/components/ChildTableDetail.tsx` | 新增 | 子表详情 |
| `features/operations-data/components/DataPreviewPanel.tsx` | 新增 | 数据预览 |
| `features/operations-data/components/DataQualityPanel.tsx` | 新增 | 数据质量 |
| `features/operations-data/components/TagAttributesEditor.tsx` | 新增 | 标签编辑器 |
| `features/operations-data/components/Breadcrumbs.tsx` | 新增 | 面包屑 |
| `features/operations-data/components/AddColumnModal.tsx` | 新增 | 添加列弹窗 |
| `features/operations-data/OperationsData.tsx` | 新增 | 主组件 |
| `features/operations-data/index.ts` | 新增 | 统一导出 |
| `pages/OperationsData.tsx` | 修改 | 改为重导出 |
| `src/services/operationsDataApi.ts` | 新增 | API 服务 |

---

## 八、检查清单

- [ ] 所有子组件行数 < 200 行
- [ ] 主组件行数 < 300 行
- [ ] 所有 hooks 行数 < 150 行
- [ ] 类型定义集中管理
- [ ] 组件职责单一
- [ ] 无循环依赖
- [ ] 统一导出配置正确
- [ ] pages/ 下仅保留重导出
