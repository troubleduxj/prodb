# 真实后端API集成指南

## 概述
本文档说明如何将前端从使用模拟数据切换到使用真实的后端API数据。

## 问题分析
之前使用简化版组件和模拟数据是为了避免API调用错误，但现在需要显示真实的后端数据库信息。

## 已完成的修改

### 1. 路由配置恢复
**文件**: `platform/frontend/src/routes/_authenticated/database/connection/index.tsx`

```typescript
// 恢复使用原始的数据库连接页面
import { DatabaseConnectionPage } from '@/features/database/pages/database-connection-page'

export const Route = createFileRoute('/_authenticated/database/connection/')({
  component: DatabaseConnectionPage,
})
```

### 2. 连接表单组件恢复
**文件**: `platform/frontend/src/features/database/components/connection-form.tsx`

```typescript
// 恢复使用原始的hooks和API
import { useTDengineConnections } from '../hooks/use-tdengine-connections'
import { tdengineApi } from '../services/tdengine-api'

// 恢复使用API调用进行连接测试
const result = await tdengineApi.testConnection({
  name: formData.name,
  host: formData.host,
  port: formData.port,
  username: formData.username,
  password: formData.password,
  database: formData.database,
  timeout: formData.timeout,
  maxConnections: formData.maxConnections,
})
```

### 3. 后端端口配置
**问题**: 端口3001被前端开发服务器占用
**解决方案**: 更改后端端口到8080

**文件**: `platform/backend/main.go`
```go
r.Run(":8080") // listen and serve on 0.0.0.0:8080
```

**文件**: `platform/frontend/.env`
```properties
VITE_API_BASE_URL=http://localhost:8080
```

## 后端API端点验证

### 数据库连接管理API
- `GET /api/v1/database/connections` - 获取连接列表
- `POST /api/v1/database/connections` - 创建新连接
- `GET /api/v1/database/connections/:id` - 获取特定连接
- `PUT /api/v1/database/connections/:id` - 更新连接
- `DELETE /api/v1/database/connections/:id` - 删除连接
- `POST /api/v1/database/connections/test` - 测试连接
- `POST /api/v1/database/connections/:id/test` - 测试特定连接
- `GET /api/v1/database/connections/status` - 获取所有连接状态
- `GET /api/v1/database/connections/:id/status` - 获取特定连接状态

### 批量操作API
- `POST /api/v1/database/connections/batch-test` - 批量测试连接
- `DELETE /api/v1/database/connections/batch` - 批量删除连接

## 前端组件状态

### 已恢复使用真实API的组件
- ✅ `DatabaseConnectionPage` - 主连接管理页面
- ✅ `ConnectionForm` - 连接表单组件
- ✅ `ConnectionList` - 连接列表组件
- ✅ `ConnectionMonitoring` - 连接监控组件

### 使用的Hooks和服务
- ✅ `useTDengineConnections` - 连接管理hooks
- ✅ `tdengineApi` - API服务层
- ✅ `ConnectionTestResult` - 连接测试结果类型

## 启动步骤

### 1. 启动后端服务
```bash
cd platform/backend
go run main.go
```

后端将在端口8080启动，输出类似：
```
[GIN-debug] Listening and serving HTTP on :8080
```

### 2. 启动前端服务
```bash
cd platform/frontend
npm run dev
```

前端将使用环境变量中配置的API地址 `http://localhost:8080`

### 3. 验证API连接
访问 `http://localhost:8080/ping` 应该返回JSON响应而不是HTML页面。

## 数据流程

### 连接列表加载
1. 前端组件 `ConnectionList` 使用 `useTDengineConnections` hooks
2. Hooks调用 `tdengineApi.getConnections()`
3. API发送GET请求到 `/api/v1/database/connections`
4. 后端从PostgreSQL数据库查询连接配置
5. 返回真实的连接数据给前端显示

### 连接测试流程
1. 用户在连接表单中点击"测试连接"
2. 前端调用 `tdengineApi.testConnection()`
3. API发送POST请求到 `/api/v1/database/connections/test`
4. 后端尝试连接到TDengine数据库
5. 返回连接测试结果（成功/失败、延迟、服务器版本等）

### 连接监控数据
1. `ConnectionMonitoring` 组件调用 `tdengineApi.getAllConnectionStatuses()`
2. API获取所有连接的实时状态
3. 显示真实的连接状态、延迟、运行时间等指标

## 数据库配置要求

### TDengine连接信息
后端需要能够连接到TDengine数据库，默认配置：
- 主机: localhost 或配置的IP地址
- 端口: 6041 (TDengine默认端口)
- 用户名: root
- 密码: taosdata (或配置的密码)

### PostgreSQL配置
后端使用PostgreSQL存储连接配置信息：
- 连接配置表: `tdengine_connections`
- 存储连接名称、主机、端口、凭据等信息

## 故障排除

### 1. 端口冲突
如果8080端口也被占用，可以更改为其他端口：
```go
// main.go
r.Run(":9090")
```
```properties
# .env
VITE_API_BASE_URL=http://localhost:9090
```

### 2. CORS问题
后端已配置CORS允许前端域名：
```go
config.AllowOrigins = []string{
  "http://localhost:3000", 
  "http://localhost:5173", 
  "http://localhost:5174", 
  "http://localhost:4173"
}
```

### 3. API响应格式
确保后端返回正确的JSON格式而不是HTML页面。如果返回HTML，检查：
- 后端服务是否正确启动
- 端口是否被其他服务占用
- 路由配置是否正确

## 测试验证

### 手动测试API
```bash
# 测试ping端点
curl http://localhost:8080/ping

# 测试连接列表
curl http://localhost:8080/api/v1/database/connections

# 测试连接创建
curl -X POST http://localhost:8080/api/v1/database/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试连接",
    "host": "localhost",
    "port": 6041,
    "username": "root",
    "password": "taosdata"
  }'
```

### 前端功能测试
1. 访问数据库配置页面
2. 查看连接列表（应显示真实数据）
3. 点击"新建连接"创建连接
4. 测试连接功能
5. 查看连接监控数据

## 预期结果

成功集成后，用户应该能够：
- 查看从后端数据库加载的真实连接配置
- 创建、编辑、删除连接配置
- 测试连接到TDengine数据库
- 查看真实的连接状态和性能指标
- 进行批量操作（测试、删除等）

所有数据将从后端API获取，而不是使用模拟数据。