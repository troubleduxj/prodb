# 迁移后架构优化清单

**版本**: 1.0  
**日期**: 2026-03-12  
**状态**: 待实施

---

## 执行摘要

目录重构和端口配置已完成，以下是系统架构层面的优化任务清单。

```
┌─────────────────────────────────────────────────────────────┐
│                    优化任务优先级矩阵                        │
├─────────────────────────────────────────────────────────────┤
│  🔴 P0 - 阻塞性 (必须立即完成)                               │
│     • API 适配层完善                                         │
│     • 认证系统集成验证                                       │
│     • 核心功能回归测试                                       │
├─────────────────────────────────────────────────────────────┤
│  🟡 P1 - 高优先级 (1-2周内完成)                              │
│     • 前端组件统一                                           │
│     • 性能优化                                               │
│     • 错误处理机制                                           │
├─────────────────────────────────────────────────────────────┤
│  🟢 P2 - 中优先级 (1月内完成)                                │
│     • 新增功能 API 开发                                      │
│     • 测试覆盖                                               │
│     • 监控和可观测性                                         │
├─────────────────────────────────────────────────────────────┤
│  ⚪ P3 - 低优先级 (持续优化)                                 │
│     • UI/UX 精细打磨                                         │
│     • 文档完善                                               │
│     • 安全加固                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## P0 - 阻塞性任务（立即执行）

### 1. API 适配层完善 ⏰ 2-3天

**现状**: API 框架已搭建，但需要完善实际调用逻辑

**待完成工作**:

```typescript
// platform/frontend/src/services/api.ts

// 1. 添加请求/响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: 统一错误处理
    // - 401: 跳转登录
    // - 403: 权限提示
    // - 500: 服务不可用提示
    // - 网络错误: 重试机制
    return Promise.reject(error);
  }
);

// 2. 实现 AI 功能的降级逻辑
export const ai = {
  generateSQL: async (prompt: string, schema?: string) => {
    try {
      const response = await apiClient.post('/ai/generate-sql', { prompt, schema });
      return response.data;
    } catch (error) {
      // TODO: 实现本地 SQL 模板库
      return {
        sql: getLocalSQLTemplate(prompt),
        fallback: true,
        message: '使用本地模板'
      };
    }
  }
};

// 3. 实现流计算 API 的 Mock 数据
export const streaming = {
  listJobs: async () => {
    // TODO: 后端开发完成后移除 Mock
    return mockStreamingJobs;
  }
};
```

**验收标准**:
- [ ] 所有 API 调用正常
- [ ] 错误处理完善
- [ ] AI 功能有降级方案
- [ ] 流计算功能显示 Mock 数据

---

### 2. 认证系统集成验证 ⏰ 1-2天

**现状**: 登录 API 已对接，需要验证全流程

**验证清单**:

```typescript
// platform/frontend/src/contexts/AuthContext.tsx

// TODO: 验证以下流程
const authFlows = [
  '1. 用户登录 - 获取 Token',
  '2. Token 存储 - localStorage',
  '3. 请求拦截 - 自动附加 Token',
  '4. Token 过期 - 401 处理',
  '5. 刷新 Token - 自动续期',
  '6. 登出操作 - 清除 Token'
];
```

**待修复问题**:
- [ ] 登录页面与现有后端字段对齐（username/email）
- [ ] Token 过期自动跳转
- [ ] 权限控制（RBAC）前端实现
- [ ] 登录状态持久化

**验收标准**:
- [ ] 登录成功跳转
- [ ] 刷新页面保持登录
- [ ] Token 过期自动跳转登录页
- [ ] 无权限操作显示提示

---

### 3. 核心功能回归测试 ⏰ 3-5天

**测试范围**:

| 功能模块 | 测试项 | 状态 |
|---------|--------|------|
| 采集器管理 | 列表/创建/编辑/删除 | 待验证 |
| TDengine | 数据库/超级表/查询 | 待验证 |
| 用户管理 | CRUD 操作 | 待验证 |
| 告警规则 | 创建/启用/禁用 | 待验证 |
| SQL 查询 | 执行/结果展示 | 待验证 |

**测试方法**:
1. 对比旧系统功能
2. 验证数据一致性
3. 检查页面跳转
4. 验证表单提交

---

## P1 - 高优先级任务（1-2周）

### 4. 前端组件统一 ⏰ 5-7天

**现状**: AurasenseDB 使用纯 Tailwind，需要与 shadcn/ui 统一

**统一策略**:

```
新前端组件架构
├── shadcn/ui 基础组件 (Button, Input, Dialog, Table)
├── 业务组件封装
│   ├── DataTable - 数据表格
│   ├── StatCard - 统计卡片
│   ├── ChartContainer - 图表容器
│   └── SqlEditor - SQL 编辑器
└── 页面级组件
    ├── CollectorList
    ├── QueryWorkbench
    └── DashboardWidgets
```

**待迁移组件**:

| 组件 | 来源 | 目标 |
|------|------|------|
| Button | 纯 Tailwind | shadcn/ui Button |
| Input | 纯 Tailwind | shadcn/ui Input |
| Table | 纯 Tailwind | shadcn/ui Table |
| Dialog | 纯 Tailwind | shadcn/ui Dialog |
| Card | 纯 Tailwind | shadcn/ui Card |

**主题统一**:
```typescript
// platform/frontend/src/styles/theme.ts
export const theme = {
  colors: {
    // 保持 AurasenseDB 深色主题
    background: '#0f172a',
    foreground: '#f8fafc',
    primary: '#10b981',
    // ... 映射到 shadcn/ui 变量
  }
};
```

---

### 5. 性能优化 ⏰ 3-5天

#### 5.1 代码分割

```typescript
// platform/frontend/src/router/index.tsx
import { lazy, Suspense } from 'react';

// 按需加载页面
const CollectorAgents = lazy(() => import('./pages/CollectorAgents'));
const QueryWorkbench = lazy(() => import('./pages/QueryWorkbench'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// 添加 Loading 边界
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/collectors" element={<CollectorAgents />} />
    <Route path="/query" element={<QueryWorkbench />} />
  </Routes>
</Suspense>
```

#### 5.2 数据缓存

```typescript
// 使用 TanStack Query 缓存 API 数据
import { useQuery } from '@tanstack/react-query';

export const useCollectors = () => {
  return useQuery({
    queryKey: ['collectors'],
    queryFn: api.collectors.list,
    staleTime: 30000, // 30s 内不重新请求
    cacheTime: 60000, // 缓存 1 分钟
  });
};
```

#### 5.3 虚拟列表

```typescript
// 大数据表格使用虚拟滚动
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={data.length}
  itemSize={50}
>
  {Row}
</FixedSizeList>
```

---

### 6. 错误处理机制 ⏰ 2-3天

#### 6.1 全局错误边界

```typescript
// platform/frontend/src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: 发送错误到监控服务
    console.error('Global Error:', error);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

#### 6.2 API 错误处理

```typescript
// 统一错误提示
const errorMessages = {
  401: '登录已过期，请重新登录',
  403: '权限不足',
  404: '请求的资源不存在',
  500: '服务器内部错误',
  NETWORK_ERROR: '网络连接失败，请检查网络',
};
```

---

## P2 - 中优先级任务（1月内）

### 7. 新增功能 API 开发 ⏰ 10-15天

#### 7.1 AI 服务代理

```go
// platform/backend/handlers/ai_handler.go

package handlers

type AIHandler struct {
    geminiAPIKey string
}

func (h *AIHandler) GenerateSQL(c *gin.Context) {
    var req struct {
        Prompt string `json:"prompt"`
        Schema string `json:"schema"`
    }
    
    // 调用 Gemini API
    sql, err := h.callGemini(req.Prompt, req.Schema)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"sql": sql})
}

// 注册路由
func RegisterAIRoutes(r *gin.RouterGroup) {
    ai := r.Group("/ai")
    {
        ai.POST("/generate-sql", handler.GenerateSQL)
        ai.POST("/analyze-cluster", handler.AnalyzeCluster)
        ai.POST("/explain-query", handler.ExplainQuery)
    }
}
```

#### 7.2 流计算管理

```go
// platform/backend/handlers/streaming_handler.go

func (h *StreamingHandler) ListJobs(c *gin.Context) {
    jobs, err := h.flinkService.ListJobs()
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, jobs)
}

func (h *StreamingHandler) CreateJob(c *gin.Context) {
    var config FlinkJobConfig
    if err := c.ShouldBindJSON(&config); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    job, err := h.flinkService.CreateJob(config)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(201, job)
}
```

#### 7.3 多租户管理

```go
// platform/backend/handlers/tenant_handler.go

func (h *TenantHandler) CreateTenant(c *gin.Context) {
    var req struct {
        Name   string `json:"name" binding:"required"`
        Quota  Quota  `json:"quota"`
    }
    
    // 创建租户数据库
    err := h.tdengine.CreateDatabase(req.Name)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(201, gin.H{"message": "Tenant created"})
}
```

---

### 8. 测试覆盖 ⏰ 7-10天

#### 8.1 单元测试

```typescript
// platform/frontend/src/services/api.test.ts
import { api } from './api';

describe('API Service', () => {
  it('should login successfully', async () => {
    const result = await api.auth.login({
      username: 'admin',
      password: 'admin'
    });
    expect(result.data.token).toBeDefined();
  });
});
```

#### 8.2 E2E 测试

```typescript
// e2e/collectors.spec.ts
test('should create collector', async ({ page }) => {
  await page.goto('http://localhost:9181/collectors');
  await page.click('[data-testid="create-collector"]');
  await page.fill('[name="name"]', 'Test Collector');
  await page.click('[type="submit"]');
  await expect(page.locator('text=创建成功')).toBeVisible();
});
```

---

### 9. 监控和可观测性 ⏰ 5-7天

#### 9.1 前端监控

```typescript
// platform/frontend/src/utils/monitor.ts

// 性能监控
export const reportWebVitals = (metric: WebVitals) => {
  // 发送到监控系统
  fetch('/api/v1/metrics/web-vitals', {
    method: 'POST',
    body: JSON.stringify(metric)
  });
};

// 错误监控
window.addEventListener('error', (event) => {
  reportError({
    message: event.message,
    source: event.filename,
    line: event.lineno
  });
});
```

#### 9.2 后端监控

```go
// platform/backend/middleware/metrics.go

func MetricsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        
        duration := time.Since(start)
        status := c.Writer.Status()
        
        // 记录请求指标
        metrics.RecordRequest(c.Request.Method, c.Request.Path, status, duration)
    }
}
```

---

## P3 - 低优先级任务（持续优化）

### 10. UI/UX 精细打磨

- [ ] 响应式布局优化（移动端适配）
- [ ] 暗黑/亮色主题切换
- [ ] 动画效果优化
- [ ] 加载状态统一
- [ ] 空状态页面设计

### 11. 文档完善

- [ ] API 文档（Swagger/OpenAPI）
- [ ] 部署文档（Docker/K8s）
- [ ] 用户手册
- [ ] 开发指南
- [ ] 故障排查手册

### 12. 安全加固

- [ ] HTTPS 配置
- [ ] 密钥管理（Vault）
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] CSRF 防护
- [ ] 审计日志

---

## 实施路线图

```
Week 1: P0 任务
├── Day 1-2: API 适配层完善
├── Day 3-4: 认证系统集成
└── Day 5-7: 核心功能回归测试

Week 2-3: P1 任务
├── Week 2: 前端组件统一
└── Week 3: 性能优化 + 错误处理

Week 4-6: P2 任务
├── Week 4: AI API 开发
├── Week 5: 流计算 API 开发
└── Week 6: 测试覆盖 + 监控

Week 7+: P3 任务
├── UI/UX 优化（持续）
├── 文档完善（持续）
└── 安全加固（持续）
```

---

## 关键成功指标

| 指标 | 目标 | 当前 | 差距 |
|------|------|------|------|
| 功能可用率 | > 95% | - | 待测试 |
| API 响应时间 | < 200ms | - | 待测试 |
| 首屏加载时间 | < 2s | - | 待优化 |
| 测试覆盖率 | > 70% | - | 待补充 |
| 文档完整度 | > 80% | - | 待完善 |

---

## 资源需求

| 角色 | 人数 | 时间 | 任务 |
|------|------|------|------|
| 前端开发 | 2 | 4周 | P0 + P1 |
| 后端开发 | 1 | 4周 | P0 + P2 API |
| 测试工程师 | 1 | 2周 | 回归测试 |
| DevOps | 0.5 | 1周 | 监控部署 |

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| API 不兼容 | 中 | 高 | 逐步验证，保留回退方案 |
| 性能不达标 | 中 | 中 | 提前进行性能测试 |
| 进度延迟 | 低 | 中 | 优先级管理，分阶段交付 |
| 团队学习成本 | 低 | 低 | 技术栈一致，文档完善 |

---

**下一步行动**: 立即开始 P0 任务中的 API 适配层完善