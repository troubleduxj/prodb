# ProDB 项目重构方案建议

**日期**: 2026-03-12  
**状态**: 建议方案  
**前提**: 项目处于开发阶段，可直接废弃旧前端

---

## 执行摘要

基于对现有项目和新设计的深入分析，我推荐采用**"保留后端 + 全新前端"**的方案：

```
┌─────────────────────────────────────────────────────────────┐
│                    推荐架构                                  │
├─────────────────────────────────────────────────────────────┤
│  前端层（全新）                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ AurasenseDB/ → 重命名为 platform/frontend/              ││
│  │ ├─ 45+ 现代化页面                                       ││
│  │ ├─ React 19 + React Router v7                           ││
│  │ ├─ 深色主题 + 流畅动画                                   ││
│  │ └─ Gemini AI 集成                                       ││
│  └─────────────────────────────────────────────────────────┘│
│  DataCollectorAgent/ → 重命名为 collector/frontend/         │
│  ├─ 采集器独立管理界面                                     │
│  └─ 8093 端口配置界面                                      │
├─────────────────────────────────────────────────────────────┤
│  后端层（保留现有）                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ platform/backend/ （保持不变）                           ││
│  │ ├─ Go + Gin + PostgreSQL + TDengine                     ││
│  │ ├─ 24+ 完整 API Handlers                                ││
│  │ ├─ JWT 认证 + RBAC                                      ││
│  │ ├─ + 新增流计算 API（约 5 个）                          ││
│  │ └─ + 新增 AI 代理 API（约 3 个）                        ││
│  └─────────────────────────────────────────────────────────┘│
│  collector/ （保留核心）                                     │
│  ├─ Go 采集器核心逻辑                                       │
│  ├─ 协议实现（OPC UA/MQTT/Modbus）                          │
│  └─ SQLite 本地缓存                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 方案对比分析

### 方案 A：全部废弃（不推荐）

| 方面 | 评估 |
|------|------|
| **工作量** | 🔴 极大（需重写后端、数据库、API） |
| **风险** | 🔴 极高（重新开发可能引入新问题） |
| **时间** | 🔴 至少 6 个月 |
| **质量** | ⚠️ 不确定（新后端未经测试） |

### 方案 B：渐进迁移（已提供，偏保守）

| 方面 | 评估 |
|------|------|
| **工作量** | 🟡 中等（需维护两套前端） |
| **风险** | 🟢 低（可回退） |
| **时间** | 🟡 8 周 |
| **适用性** | ⚠️ 适合已上线系统 |

### 方案 C：保留后端 + 全新前端（✅ 推荐）

| 方面 | 评估 |
|------|------|
| **工作量** | 🟢 较低（仅前端替换 + 少量 API） |
| **风险** | 🟢 低（后端已验证） |
| **时间** | 🟢 3-4 周 |
| **质量** | 🟢 高（复用稳定后端） |

---

## 详细分析

### 1. 为什么保留现有后端？

**现有后端（platform/backend）的优势：**

| 模块 | 状态 | 说明 |
|------|------|------|
| **API 设计** | ✅ 完整 | RESTful 规范，版本控制，24+ Handlers |
| **数据库** | ✅ 稳定 | PostgreSQL + TDengine 双库架构 |
| **认证授权** | ✅ 完善 | JWT + RBAC 完整实现 |
| **采集器管理** | ✅ 完整 | 注册、心跳、配置下发 |
| **TDengine 管理** | ✅ 完整 | 超级表/子表/查询全套 API |
| **告警系统** | ✅ 已集成 | 规则引擎 + 告警服务 |
| **性能监控** | ✅ 已集成 | 实时监控 + 可扩展性管理 |
| **测试覆盖** | 🟡 75% | 基础测试已具备 |

**重新开发后端的成本：**
- 开发时间：至少 3-4 个月
- 测试时间：至少 1-2 个月
- 风险：架构设计、性能调优、Bug 修复

### 2. 新前端（AurasenseDB）的优势

**功能覆盖度对比：**

| 功能模块 | 现有前端 | AurasenseDB | 提升 |
|---------|---------|-------------|------|
| 页面数量 | ~15 | ~45 | **+200%** |
| 采集器管理 | 基础 | 完整（3页面） | **+200%** |
| 数据查询 | 基础 | 工作台 + AI | **+300%** |
| 流计算 | ❌ 无 | Flink 作业管理 | **新增** |
| 多租户 | ❌ 无 | 完整支持 | **新增** |
| AI 能力 | ❌ 无 | Gemini 集成 | **新增** |
| 运维监控 | 基础 | 集群级监控 | **+200%** |

**技术亮点：**
- React 19 + TypeScript（与现有一致）
- 现代化深色 UI 设计
- Motion 动画库
- Recharts 专业图表
- Gemini AI 原生集成

### 3. 需要补充的后端工作

**新增 API 开发（预计 2-3 天）：**

```go
// 1. 流计算管理（5个API）
POST   /api/v1/streaming/jobs          // 创建作业
GET    /api/v1/streaming/jobs          // 列表
GET    /api/v1/streaming/jobs/:id      // 详情
POST   /api/v1/streaming/jobs/:id/stop // 停止
DELETE /api/v1/streaming/jobs/:id      // 删除

// 2. AI 服务代理（3个API）
POST   /api/v1/ai/generate-sql         // 自然语言转SQL
POST   /api/v1/ai/analyze-cluster      // 集群健康分析
POST   /api/v1/ai/explain-query        // 查询优化建议

// 3. 多租户管理（4个API）
GET    /api/v1/tenants                 // 租户列表
POST   /api/v1/tenants                 // 创建租户
PUT    /api/v1/tenants/:id             // 更新配额
DELETE /api/v1/tenants/:id             // 删除租户
```

---

## 实施步骤（3-4周）

### Week 1: 环境准备与基础替换

#### Day 1-2: 目录重构

```bash
# 1. 备份现有前端（可选）
mv platform/frontend platform/frontend-legacy

# 2. 移动新前端
mv AurasenseDB platform/frontend

# 3. 调整配置文件
cd platform/frontend

# 4. 安装依赖
npm install

# 5. 验证启动
npm run dev
```

#### Day 3-4: API 对接层开发

```typescript
// platform/frontend/src/services/api.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8080/api/v1',  // 指向现有后端
  timeout: 30000,
});

// 请求拦截器 - 添加 Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 导出 API 服务
export const api = {
  // 复用现有后端 API
  auth: {
    login: (creds: any) => apiClient.post('/auth/login', creds),
    me: () => apiClient.get('/users/me'),
  },
  collectors: {
    list: () => apiClient.get('/collectors/list'),
    // ... 其他方法
  },
  tdengine: {
    databases: () => apiClient.get('/tdengine/databases'),
    query: (sql: string) => apiClient.post('/tdengine/query', { sql }),
  },
  
  // 新增 API（先做 Mock）
  ai: {
    generateSQL: (prompt: string) => 
      Promise.resolve({ 
        data: { 
          sql: `-- Mock: ${prompt}\nSELECT * FROM meters LIMIT 10;`,
          fallback: true 
        } 
      }),
  },
};

export default api;
```

#### Day 5: 认证集成

```typescript
// platform/frontend/src/contexts/AuthContext.tsx

import { createContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      api.auth.me().then(res => setUser(res.data));
    }
  }, [token]);

  const login = async (credentials) => {
    const { data } = await api.auth.login(credentials);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Week 2: 核心功能对接

#### 主要任务：

1. **采集器管理页面** (`pages/CollectorAgents.tsx`)
   - 对接 `GET /api/v1/collectors/list`
   - 对接 `POST /api/v1/collectors`
   - 对接心跳监控 API

2. **TDengine 管理页面** (`pages/RealtimeTables.tsx`)
   - 对接 `GET /api/v1/tdengine/databases`
   - 对接 `GET /api/v1/tdengine/db/:db/supertables`
   - 对接查询 API

3. **SQL 工作台** (`pages/QueryWorkbench.tsx`)
   - 集成查询执行
   - 结果表格展示
   - 历史记录

#### 验证清单：

- [ ] 用户登录成功，Token 正确存储
- [ ] 采集器列表正常显示
- [ ] SQL 查询能正常执行
- [ ] 页面切换流畅，无报错

### Week 3: 高级功能开发

#### 任务 1: 新增后端 API（2 天）

```go
// platform/backend/handlers/streaming_handler.go

package handlers

import "github.com/gin-gonic/gin"

type StreamingHandler struct{}

func (h *StreamingHandler) RegisterRoutes(r *gin.RouterGroup) {
    streaming := r.Group("/streaming")
    {
        streaming.GET("/jobs", h.ListJobs)
        streaming.POST("/jobs", h.CreateJob)
        streaming.GET("/jobs/:id", h.GetJob)
        streaming.POST("/jobs/:id/stop", h.StopJob)
        streaming.DELETE("/jobs/:id", h.DeleteJob)
    }
}

// 实现方法...
```

```go
// platform/backend/handlers/ai_handler.go

type AIHandler struct {
    geminiAPIKey string
}

func (h *AIHandler) GenerateSQL(c *gin.Context) {
    var req struct {
        Prompt string `json:"prompt"`
        Schema string `json:"schema"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 调用 Gemini API
    sql, err := h.callGemini(req.Prompt, req.Schema)
    if err != nil {
        // 降级处理
        c.JSON(200, gin.H{
            "sql": "-- AI服务暂时不可用\nSELECT * FROM meters LIMIT 10;",
            "fallback": true,
        })
        return
    }
    
    c.JSON(200, gin.H{"sql": sql})
}
```

#### 任务 2: AI 功能集成（2 天）

```typescript
// platform/frontend/src/services/gemini.ts

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const generateSQL = async (prompt: string, schema?: string) => {
  if (!API_KEY) {
    // 本地降级
    return `-- 请输入 Gemini API Key 以启用 AI 功能
-- 您的查询: ${prompt}
SELECT * FROM meters LIMIT 10;`;
  }

  const response = await fetch('/api/v1/ai/generate-sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, schema }),
  });

  const data = await response.json();
  return data.sql;
};
```

#### 任务 3: DataCollectorAgent 集成（1 天）

```bash
# 替换 collector 前端
mv collector/frontend collector/frontend-legacy
cp -r DataCollectorAgent/* collector/

# 调整端口配置
# collector 原配置界面在 8093 端口
# 新设计保持一致
```

### Week 4: 测试与优化

#### 测试计划：

| 测试项 | 方法 | 通过标准 |
|--------|------|---------|
| 功能测试 | 手动 + 自动化 | 核心功能 100% 可用 |
| API 兼容性 | 对比测试 | 与旧系统响应一致 |
| 性能测试 | Lighthouse | 首屏 < 2s |
| 集成测试 | E2E | 主要用户路径通过 |

#### 优化项：

1. **代码分割**
```typescript
// 路由懒加载
const CollectorAgents = lazy(() => import('./pages/CollectorAgents'));
const QueryWorkbench = lazy(() => import('./pages/QueryWorkbench'));
```

2. **API 缓存**
```typescript
import { useQuery } from '@tanstack/react-query';

const { data: collectors } = useQuery({
  queryKey: ['collectors'],
  queryFn: api.collectors.list,
  staleTime: 30000, // 30s 缓存
});
```

3. **错误处理**
```typescript
// 全局错误边界
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

---

## 文件结构（最终）

```
ProDB/
├── platform/
│   ├── backend/              # 保留现有后端（不变）
│   │   ├── main.go
│   │   ├── handlers/         # + streaming_handler.go
│   │   │                 # + ai_handler.go
│   │   └── ...
│   └── frontend/             # 全新 AurasenseDB
│       ├── src/
│       │   ├── pages/        # 45+ 页面
│       │   ├── components/
│       │   ├── services/
│       │   │   └── api.ts    # API 对接层
│       │   └── ...
│       └── package.json
├── collector/
│   ├── main.go               # 保留现有核心
│   ├── internal/
│   └── frontend/             # 全新 DataCollectorAgent
│       ├── src/
│       │   ├── pages/
│       │   └── ...
│       └── package.json
└── docs/
    ├── MIGRATION_PLAN_AURASENSE.md  # 保守方案
    └── RECOMMENDED_APPROACH.md      # 本方案
```

---

## 关键决策点

### 决策 1：后端是否保留？

**建议：✅ 保留现有后端**

理由：
- 后端功能完整，API 设计良好
- 已集成 TDengine、告警、监控等复杂功能
- 重新开发成本高、风险大
- 仅需新增少量 API（约 12 个）

### 决策 2：前端如何整合？

**建议：✅ 直接替换**

操作：
1. `platform/frontend` → 用 AurasenseDB 替换
2. `collector/frontend` → 用 DataCollectorAgent 替换
3. 保持现有 `collector/main.go` 核心逻辑

### 决策 3：AI 功能是否必须？

**建议：⚠️ 可选启用**

方案：
- 有 Gemini API Key：启用完整 AI 功能
- 无 API Key：提供本地 SQL 模板，界面正常显示

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 新前端与后端 API 不匹配 | 中 | 高 | 提前验证所有 API，建立 Mock 数据 |
| 路由切换问题 | 低 | 中 | 使用 HashRouter，避免服务器配置 |
| Tailwind 版本差异 | 低 | 低 | 测试样式兼容性，必要时调整 |
| AI 功能不可用 | 中 | 低 | 完善降级逻辑，提供替代方案 |

---

## 预期成果

### 功能提升

| 指标 | 现状 | 目标 | 提升 |
|------|------|------|------|
| 管理页面 | 15 | 45 | **+200%** |
| 采集器功能 | 基础 | 完整 | **+200%** |
| 数据查询 | 基础 SQL | AI 辅助 | **+300%** |
| 实时监控 | 心跳监控 | 集群级监控 | **+200%** |
| 流计算 | ❌ | ✅ Flink | **新增** |

### 质量指标

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 2s |
| API 响应 | < 200ms |
| 功能可用率 | > 95% |
| 代码测试覆盖 | > 70% |

### 时间成本

| 项目 | 预计时间 |
|------|---------|
| 环境搭建 | 1 天 |
| API 对接 | 3 天 |
| 核心功能验证 | 5 天 |
| 新增 API 开发 | 3 天 |
| AI 功能集成 | 2 天 |
| 测试优化 | 3 天 |
| **总计** | **~3-4 周** |

---

## 下一步行动

1. **立即执行**：
   - [ ] 审批本方案
   - [ ] 创建 feature 分支
   - [ ] 开始目录重构

2. **本周完成**：
   - [ ] 新前端环境搭建
   - [ ] API 对接层开发
   - [ ] 用户登录验证

3. **关键检查点**：
   - [ ] Day 3：API 对接完成
   - [ ] Day 7：核心功能可用
   - [ ] Day 14：高级功能开发
   - [ ] Day 21：测试通过，准备上线

---

**方案建议人**: 项目架构团队  
**最后更新**: 2026-03-12