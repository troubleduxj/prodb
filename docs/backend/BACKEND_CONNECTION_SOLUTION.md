# 后端连接问题解决方案

## 问题描述
前端显示 `ERR_CONNECTION_REFUSED` 错误，无法连接到后端API。

## 根本原因
后端服务器没有在预期的端口（8080）上运行。

## 解决步骤

### 1. 确认后端服务器状态
```bash
# 检查8080端口是否在监听
netstat -an | findstr :8080
```

### 2. 启动后端服务器
有三种方式启动后端：

#### 方式一：直接启动（前台运行）
```bash
cd platform/backend
go run main.go
```

#### 方式二：后台启动
```bash
cd platform/backend
Start-Process -WindowStyle Hidden -FilePath "go" -ArgumentList "run", "main.go"
```

#### 方式三：使用批处理文件
- `start-backend.bat` - 前台启动
- `start-backend-background.bat` - 后台启动

### 3. 验证服务器启动
```bash
# 检查端口监听
netstat -an | findstr :8080

# 测试API响应
curl http://localhost:8080/ping
```

## 配置文件

### 后端端口配置
**文件**: `platform/backend/main.go`
```go
r.Run(":8080") // listen and serve on 0.0.0.0:8080
```

### 前端API地址配置
**文件**: `platform/frontend/.env`
```properties
VITE_API_BASE_URL=http://localhost:8080
```

## 验证步骤

### 1. 后端健康检查
访问: `http://localhost:8080/ping`

预期响应:
```json
{
  "db_status": "connected",
  "message": "pong",
  "tdengine_status": {
    "healthy": true,
    "last_check": "2025-09-27T11:56:18.4389368+08:00",
    "uptime": 1234567
  }
}
```

### 2. 数据库连接API测试
访问: `http://localhost:8080/api/v1/database/connections`

预期响应:
```json
{
  "status": "success",
  "connections": [...],
  "total": 1
}
```

### 3. 前端连接测试
- 打开 `test-backend-connection.html` 进行自动化测试
- 或直接访问前端数据库配置页面

## 常见问题排查

### 问题1: 端口被占用
```bash
# 查找占用8080端口的进程
netstat -ano | findstr :8080

# 如果需要，可以更改端口
# 修改 main.go 中的端口号，同时更新 .env 文件
```

### 问题2: 数据库连接失败
检查以下配置：
- PostgreSQL是否运行（端口5432）
- TDengine是否运行（端口6041）
- 数据库连接字符串是否正确

### 问题3: CORS错误
后端已配置CORS，允许以下域名：
```go
config.AllowOrigins = []string{
  "http://localhost:3000", 
  "http://localhost:5173", 
  "http://localhost:5174", 
  "http://localhost:4173"
}
```

## 启动顺序建议

1. **启动数据库服务**
   - PostgreSQL (端口5432)
   - TDengine (端口6041)

2. **启动后端服务**
   ```bash
   cd platform/backend
   go run main.go
   ```

3. **启动前端服务**
   ```bash
   cd platform/frontend
   npm run dev
   ```

4. **验证连接**
   - 访问 `http://localhost:8080/ping`
   - 访问前端数据库配置页面

## 成功指标

当一切正常工作时，你应该看到：

### 后端日志
```
[GIN-debug] Listening and serving HTTP on :8080
Database connection successfully opened.
TDengine manager started successfully
```

### 前端页面
- 数据库配置页面正常加载
- 显示真实的连接列表
- 可以创建、编辑、测试连接
- 连接监控显示实时数据

### API响应
- `/ping` 返回JSON而不是HTML
- `/api/v1/database/connections` 返回连接数据
- 所有API端点正常响应

## 自动化脚本

已创建以下辅助文件：
- `start-backend.bat` - 启动后端服务
- `start-backend-background.bat` - 后台启动后端
- `test-backend-connection.html` - API连接测试页面

使用这些工具可以快速诊断和解决连接问题。