# ProDB 前端目录结构规范

> 版本: 1.0  
> 日期: 2026-03-27  
> 适用范围: platform/frontend

---

## 📁 目录层级总览

```
platform/frontend/
├── docs/                           # 前端相关文档
├── pages/                          # 路由入口页面（仅重导出）
├── features/                       # 业务功能模块
├── src/                           # 基础共享代码
│   ├── components/ui/             # 基础UI组件库
│   ├── hooks/                     # 通用hooks
│   ├── services/                  # API服务
│   ├── contexts/                  # React Context
│   └── lib/                       # 工具函数
└── types.ts                       # 全局类型定义
```

---

## 📂 详细规范

### 1. pages/ 目录

**用途**: 仅作为路由入口，不包含业务逻辑

**规则**:
- 每个文件仅重导出对应的 feature 模块
- 禁止在此目录下编写组件逻辑
- 禁止创建子目录（除已存在的需要逐步迁移的）

**示例**:
```typescript
// pages/RealtimeTables.tsx
export { RealtimeTables, default } from '../features/realtime-tables';
```

**命名规范**:
| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | PascalCase | `RealtimeTables.tsx`, `QueryWorkbench.tsx` |

---

### 2. features/ 目录

**用途**: 存放所有业务功能模块

**结构**:
```
features/[feature-name]/           # kebab-case 命名
├── index.ts                       # 统一导出入口
├── [PageName].tsx                 # 主页面组件 (PascalCase)
├── hooks/                         # 页面专属hooks
│   ├── useXXX.ts
│   └── index.ts                   # hooks统一导出
├── components/                    # 页面专属组件
│   ├── ComponentA.tsx
│   └── index.ts                   # 组件统一导出
├── types/
│   └── index.ts                   # 类型定义
└── utils/                         # 页面专属工具函数 (可选)
    └── index.ts
```

**命名规范**:
| 类型 | 规范 | 示例 |
|------|------|------|
| 目录 | kebab-case | `realtime-tables`, `data-ingestion` |
| 组件文件 | PascalCase | `RealtimeTables.tsx`, `TreeView.tsx` |
| Hook文件 | camelCase | `useTreeData.ts`, `useSchema.ts` |
| 工具文件 | camelCase | `utils.ts`, `helpers.ts` |
| 类型文件 | camelCase | `types.ts` |

**统一导出示例**:
```typescript
// features/realtime-tables/index.ts
export { RealtimeTables } from './RealtimeTables';
export { useTreeData } from './hooks/useTreeData';
export { useSchema } from './hooks/useSchema';
export type { TreeNode, ColumnInfo } from './types';
export { default } from './RealtimeTables';
```

---

### 3. src/ 目录

**用途**: 存放全局共享的基础代码

**结构**:
```
src/
├── components/
│   └── ui/                        # shadcn/ui 基础组件
│       ├── button.tsx
│       ├── dialog.tsx
│       └── ...
├── hooks/                         # 通用hooks
│   ├── use-toast.ts
│   └── use-theme.ts
├── services/                      # API服务
│   ├── api.ts
│   └── interfaceApi.ts
├── contexts/                      # React Context
│   └── ThemeContext.tsx
└── lib/                          # 工具函数
    └── utils.ts
```

**规则**:
- 基础组件使用 kebab-case 命名（与 shadcn/ui 保持一致）
- 通用hooks使用 camelCase 命名，前缀为 `use`
- 工具函数使用 camelCase 命名

---

## 📝 文件大小规范

| 文件类型 | 建议最大行数 | 说明 |
|----------|-------------|------|
| 页面组件 | 300-400行 | 超过则拆分 |
| 子组件 | 200-300行 | 单一职责 |
| Hook | 150-250行 | 单一功能 |
| 工具函数 | 100-200行 | 保持简洁 |

**拆分时机**:
- 单一文件超过 400 行必须拆分
- 出现重复代码时考虑抽取组件
- 一个组件包含多个独立UI区域时拆分

---

## 🔄 迁移指南

### 从 pages/ 迁移到 features/

**步骤**:
1. 在 `features/` 下创建新目录（kebab-case）
2. 将原页面逻辑迁移到 `[PageName].tsx`
3. 拆分 hooks 到 `hooks/` 目录
4. 拆分组件到 `components/` 目录
5. 创建 `index.ts` 统一导出
6. 修改 `pages/[Page].tsx` 为重导出
7. 删除原文件或目录

**示例**:
```typescript
// 迁移前: pages/RealtimeTables.tsx (1723行)

// 迁移后:
// features/realtime-tables/RealtimeTables.tsx (300行)
// features/realtime-tables/hooks/useTreeData.ts
// features/realtime-tables/components/TreeView.tsx
// features/realtime-tables/index.ts
// pages/RealtimeTables.tsx (2行重导出)
```

---

## ✅ 检查清单

创建新页面时确认：
- [ ] 功能模块放在 `features/[feature-name]/` 下
- [ ] 目录使用 kebab-case 命名
- [ ] 组件文件使用 PascalCase 命名
- [ ] 创建了 `index.ts` 统一导出
- [ ] `pages/` 下仅保留重导出入口
- [ ] 单一文件不超过 400 行
- [ ] 类型定义放在 `types/index.ts`

---

## 📚 参考示例

### 完整 Feature 模块示例

```typescript
// features/realtime-tables/index.ts
export { RealtimeTables } from './RealtimeTables';
export { default } from './RealtimeTables';
export type { TreeNode, ColumnInfo } from './types';

// features/realtime-tables/RealtimeTables.tsx
import { useTreeData } from './hooks';
import { TreeView } from './components';
import type { TreeNode } from './types';

export const RealtimeTables: React.FC = () => {
  // 组件逻辑
};

// pages/RealtimeTables.tsx
export { RealtimeTables, default } from '../features/realtime-tables';
```

---

## 🚀 注意事项

1. **禁止在 pages/ 下创建子目录**（遗留目录需逐步迁移）
2. **禁止在 features/ 下直接放置文件**，必须放在子目录中
3. **导入路径** 优先使用相对路径 `../` 或绝对别名 `@/`
4. **循环依赖** 避免 hooks 与组件之间的循环引用

---

**规范维护**: 前端团队  
**最后更新**: 2026-03-27
