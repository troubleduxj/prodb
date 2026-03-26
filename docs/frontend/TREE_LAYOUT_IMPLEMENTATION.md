# 表结构管理树状图布局实现

## 🎯 目标
在表结构管理页面中实现树状图布局，左侧显示数据库结构树，右侧显示选中节点的详细信息。

## 🏗️ 架构设计

### 布局结构
```
┌─────────────────────────────────────────────────────────┐
│                    页面标题栏                              │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│   左侧树状图      │         右侧详情面板                    │
│                 │                                       │
│  📁 连接         │    选中节点的详细信息                    │
│  └─ 📊 数据库    │    - 连接信息                          │
│     ├─ 🏗️ 超级表 │    - 统计数据                          │
│     │  └─ 📋 子表│    - 操作按钮                          │
│     └─ 📄 普通表 │                                       │
│                 │                                       │
└─────────────────┴───────────────────────────────────────┘
```

## 📁 文件结构

### 新增文件
```
platform/frontend/src/features/database/
├── types/
│   └── database-tree.ts          # 树节点类型定义
├── components/
│   ├── database-tree.tsx         # 左侧树状图组件
│   └── node-details-panel.tsx    # 右侧详情面板组件
└── routes/_authenticated/database/tables/
    └── index.tsx                 # 更新的表管理页面
```

## 🔧 技术实现

### 1. 类型定义 (`database-tree.ts`)

#### 树节点类型
```typescript
export type TreeNodeType = 'connection' | 'database' | 'super_table' | 'child_table' | 'normal_table'

export interface TreeNode {
  id: string
  name: string
  type: TreeNodeType
  icon?: string
  children?: TreeNode[]
  expanded?: boolean
  loading?: boolean
  metadata?: Record<string, any>
}
```

#### 专用节点接口
- `ConnectionNode` - 连接节点
- `DatabaseNode` - 数据库节点  
- `SuperTableNode` - 超级表节点
- `ChildTableNode` - 子表节点
- `NormalTableNode` - 普通表节点

### 2. 树状图组件 (`database-tree.tsx`)

#### 核心功能
- **层级展示**: 连接 → 数据库 → 表
- **懒加载**: 按需加载子节点数据
- **交互操作**: 展开/折叠、选择节点
- **状态管理**: 展开状态、加载状态、选中状态

#### 关键方法
```typescript
const toggleNode = async (nodeId: string) => {
  // 切换节点展开/折叠状态
  // 懒加载子节点数据
}

const loadTables = async (database: string, connectionId: string) => {
  // 加载数据库中的表列表
  // 合并超级表、子表、普通表
}
```

### 3. 详情面板组件 (`node-details-panel.tsx`)

#### 显示内容
- **连接详情**: 主机、端口、状态、操作按钮
- **数据库详情**: 表数量、虚拟组、副本数、创建时间
- **超级表详情**: 列数、标签数、子表数、数据大小
- **表详情**: 列数、行数、大小、标签信息（子表）

#### 布局设计
```typescript
const renderConnectionDetails = () => {
  // 连接信息卡片
  // 统计信息卡片  
  // 操作按钮组
}
```

### 4. 页面布局 (`index.tsx`)

#### 响应式设计
```typescript
return (
  <div className="h-screen flex flex-col">
    {/* 固定头部 */}
    <div className="flex-shrink-0 bg-white border-b">
      <Header />
    </div>
    
    {/* 主要内容区 */}
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧树状图 - 固定宽度 */}
      <div className="w-80 flex-shrink-0">
        <DatabaseTree />
      </div>
      
      {/* 右侧详情面板 - 自适应宽度 */}
      <div className="flex-1 overflow-hidden">
        <NodeDetailsPanel />
      </div>
    </div>
  </div>
)
```

## 🎨 UI/UX 设计

### 视觉层次
1. **图标系统**: 不同节点类型使用不同图标
   - 🖥️ 连接 (Server)
   - 🗄️ 数据库 (Database)  
   - 🏗️ 超级表 (Layers)
   - 📋 子表 (Table2)
   - 📄 普通表 (Table)

2. **颜色编码**: 
   - 蓝色: 连接和系统级
   - 绿色: 数据库
   - 紫色: 超级表
   - 橙色: 普通表

3. **交互反馈**:
   - 悬停效果
   - 选中高亮
   - 加载动画
   - 展开/折叠动画

### 响应式适配
- 左侧树状图固定宽度 320px
- 右侧详情面板自适应剩余空间
- 移动端可考虑折叠树状图

## 🔄 数据流

### 初始化流程
```
1. 获取默认连接
2. 创建连接节点
3. 加载数据库列表
4. 构建初始树结构
```

### 交互流程
```
用户点击数据库节点
    ↓
检查是否已加载表数据
    ↓
如果未加载，调用API获取表列表
    ↓
合并超级表和普通表数据
    ↓
更新树结构并展开节点
    ↓
显示节点详情
```

## 🚀 功能特性

### 已实现功能
- ✅ 树状图结构展示
- ✅ 懒加载数据
- ✅ 节点选择和详情显示
- ✅ 展开/折叠交互
- ✅ 加载状态指示
- ✅ 错误处理
- ✅ 响应式布局

### 扩展功能（可选）
- 🔄 右键菜单操作
- 🔍 树节点搜索过滤
- 📊 节点统计信息气泡
- 🎨 主题切换支持
- 📱 移动端适配
- 🔄 实时数据更新

## 🧪 测试验证

### 测试页面
- `test-tree-layout.html` - 静态布局测试
- 可以验证：
  - 树状图层级结构
  - 节点选择交互
  - 详情面板切换
  - 响应式布局

### 集成测试
1. 启动前端开发服务器
2. 访问 `/database/tables` 页面
3. 验证树状图加载
4. 测试节点展开/选择
5. 检查详情面板显示

## 📋 使用说明

### 开发者使用
```typescript
// 在页面中使用树状图组件
<DatabaseTree 
  onNodeSelect={handleNodeSelect}
  selectedNodeId={selectedNode?.id}
/>

// 在页面中使用详情面板
<NodeDetailsPanel 
  selectedNode={selectedNode} 
/>
```

### 用户操作
1. **浏览结构**: 在左侧树中查看数据库层级结构
2. **展开节点**: 点击箭头图标展开/折叠数据库节点
3. **选择节点**: 点击节点名称查看详细信息
4. **查看详情**: 在右侧面板查看选中节点的详细信息
5. **执行操作**: 使用详情面板中的操作按钮

## 🔧 配置选项

### 树状图配置
```typescript
interface TreeConfig {
  autoExpand?: boolean      // 自动展开第一级节点
  lazyLoad?: boolean       // 启用懒加载
  showNodeCount?: boolean  // 显示节点计数
  maxDepth?: number        // 最大展开深度
}
```

### 详情面板配置
```typescript
interface DetailsConfig {
  showOperations?: boolean  // 显示操作按钮
  compactMode?: boolean    // 紧凑模式
  customActions?: Action[] // 自定义操作
}
```

## 🎯 优势特点

1. **直观性**: 树状结构清晰展示数据库层级关系
2. **高效性**: 懒加载机制减少不必要的API调用
3. **交互性**: 丰富的交互操作和即时反馈
4. **扩展性**: 模块化设计便于功能扩展
5. **响应式**: 适配不同屏幕尺寸
6. **性能**: 虚拟化和优化渲染提升性能

这个树状图布局为用户提供了更加直观和高效的数据库结构管理体验。