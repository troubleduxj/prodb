# ProDB 端口配置规划

**版本**: 1.0  
**日期**: 2026-03-12  
**状态**: 已实施  

---

## 端口分配表

| 服务 | 原端口 | 新端口 | 说明 |
|------|--------|--------|------|
| **管理平台后端** | 8080 | **9080** | Go Gin API |
| **管理平台前端** | 5173 | **9081** | Vite/React |
| **采集器后端** | - | **9082** | Collector Core |
| **采集器前端** | 8093 | **9083** | Agent Config UI |
| **OPC UA 模拟器** | 4840 | **9484** | 避免与标准 OPC UA 冲突 |
| **TDengine** | 6030 | 6030 | 保持不变（外部服务） |
| **PostgreSQL** | 5432 | 5432 | 保持不变（外部服务） |

**端口范围**: 9000-9499  
**设计原则**: 避开常用端口（80, 443, 3000, 3306, 5432, 6379, 8080, 9200 等）

---

## 端口使用矩阵

```
┌─────────────────────────────────────────────────────────────┐
│                      端口使用图                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   用户浏览器                                                │
│      │                                                      │
│      ├─► http://localhost:9081  ──► 管理平台前端           │
│      │                            (AurasenseDB)            │
│      │                                     │               │
│      │                                     ▼               │
│      │                            http://localhost:9080    │
│      │                            (API 调用)               │
│      │                                     │               │
│      ▼                                     ▼               │
│   ┌──────────────┐              ┌──────────────────┐      │
│   │  Collector   │◄─────────────│ Platform Backend │      │
│   │  Frontend    │  http://9082 │     (Go/Gin)     │      │
│   │  (:9083)     │              │      (:9080)     │      │
│   └──────────────┘              └──────────────────┘      │
│         │                            │                     │
│         │                            ├─► PostgreSQL (:5432)│
│         │                            └─► TDengine (:6030)  │
│         │                                                  │
│         └─► OPC UA Simulator (:9484)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 配置文件更新清单

### 1. 管理平台前端配置

#### platform/frontend/.env
```env
# API 基础地址
VITE_API_BASE_URL=http://localhost:9080/api/v1

# 前端运行端口
PORT=9081

# Gemini AI API Key（可选）
VITE_GEMINI_API_KEY=your-api-key-here

# 应用信息
VITE_APP_TITLE=ProDB Manager
VITE_APP_VERSION=2.0.0
```

#### platform/frontend/vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9081,           // 开发服务器端口
    host: '0.0.0.0',      // 允许外部访问
    strictPort: true,     // 端口被占用时直接退出
    proxy: {
      '/api': {
        target: 'http://localhost:9080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 9081,           // 预览服务器端口
  },
});
```

#### platform/frontend/src/services/api.ts
```typescript
// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9080/api/v1';
```

---

### 2. 管理平台后端配置

#### platform/backend/main.go
```go
// 修改端口为 9080
r.Run(":9080")
```

#### platform/backend/config/cors.go (如存在)
```go
config.AllowOrigins = []string{
    "http://localhost:9081",
    "http://localhost:9082",
    "http://localhost:9083",
}
```

---

### 3. 采集器配置

#### collector/.env
```env
# 采集器配置
PLATFORM_API_ENDPOINT=http://localhost:9080/api/v1
LOCAL_DB_PATH=./collector_cache.db

# 采集器前端端口
COLLECTOR_UI_PORT=9083

# 采集器服务端口（用于内部通信）
COLLECTOR_SERVICE_PORT=9082
```

#### collector/main.go
```go
// Web 服务器端口改为 9083
log.Println("Starting configuration server on http://localhost:9083")
if err := http.ListenAndServe(":9083", mux); err != nil {
    log.Fatalf("Failed to start web server: %v", err)
}
```

#### collector/config.json
```json
{
  "server": {
    "port": 9082,
    "host": "0.0.0.0"
  },
  "platform": {
    "endpoint": "http://localhost:9080/api/v1"
  }
}
```

---

### 4. 采集器前端配置

#### collector/frontend/.env
```env
VITE_API_BASE_URL=http://localhost:9082
VITE_PLATFORM_API_URL=http://localhost:9080/api/v1
PORT=9083
```

#### collector/frontend/vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9083,
    host: '0.0.0.0',
    strictPort: true,
  },
  preview: {
    port: 9083,
  },
});
```

---

### 5. OPC UA 模拟器配置

#### opcua-simulator/config.json
```json
{
  "endpoint": "opc.tcp://localhost:9484/opcua/simulator",
  "port": 9484,
  "security": {
    "policy": "None",
    "mode": "None"
  }
}
```

#### opcua-simulator/main.go (如有硬编码端口)
```go
// 修改为 9484
endpoint := "opc.tcp://localhost:9484/opcua/simulator"
```

---

### 6. 测试脚本更新

#### tests/test-api-endpoints.go
```go
const baseURL = "http://localhost:9080/api/v1"
```

#### tests/check-backend-status.go
```go
const backendURL = "http://localhost:9080"
```

---

## 启动命令更新

### 快速启动脚本

#### start-all-services.bat (更新)
```batch
@echo off
echo Starting ProDB Services...

echo 1. Starting OPC UA Simulator on port 9484...
start "OPC UA Simulator" cmd /k "cd opcua-simulator && go run main.go"

timeout /t 2

echo 2. Starting Platform Backend on port 9080...
start "Platform Backend" cmd /k "cd platform/backend && go run main.go"

timeout /t 3

echo 3. Starting Platform Frontend on port 9081...
start "Platform Frontend" cmd /k "cd platform/frontend && npm run dev"

timeout /t 2

echo 4. Starting Collector on port 9082/9083...
start "Collector" cmd /k "cd collector && go run main.go"

echo.
echo All services started!
echo.
echo Access URLs:
echo - Platform Frontend: http://localhost:9081
echo - Platform Backend:  http://localhost:9080
echo - Collector UI:      http://localhost:9083
echo - OPC UA Endpoint:   opc.tcp://localhost:9484
echo.
pause
```

---

## 端口冲突检查

### Windows 检查命令
```powershell
# 检查端口是否被占用
netstat -ano | findstr ":9080"
netstat -ano | findstr ":9081"
netstat -ano | findstr ":9082"
netstat -ano | findstr ":9083"
netstat -ano | findstr ":9484"
```

### 释放被占用端口
```powershell
# 1. 找到占用端口的进程 PID
netstat -ano | findstr ":9080"

# 2. 结束进程
taskkill /PID <PID> /F
```

---

## 防火墙配置

如需外部访问，请开放以下端口：

| 端口 | 用途 | 建议 |
|------|------|------|
| 9080 | API 服务 | 内部网络或 VPN |
| 9081 | 管理界面 | 可对外开放（需认证） |
| 9083 | 采集器配置 | 仅内部网络 |
| 9484 | OPC UA | 设备网络 |

**Windows 防火墙添加规则**：
```powershell
# 添加入站规则
New-NetFirewallRule -DisplayName "ProDB-9080" -Direction Inbound -LocalPort 9080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ProDB-9081" -Direction Inbound -LocalPort 9081 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ProDB-9083" -Direction Inbound -LocalPort 9083 -Protocol TCP -Action Allow
```

---

## 验证清单

启动服务后，验证以下地址可访问：

- [ ] http://localhost:9080/ping (后端健康检查)
- [ ] http://localhost:9081 (前端界面)
- [ ] http://localhost:9083 (采集器配置)
- [ ] opc.tcp://localhost:9484 (OPC UA)

---

## 环境变量模板

### .env.example (项目根目录)

```env
# ============================================
# ProDB 端口配置
# ============================================

# 管理平台后端
PLATFORM_BACKEND_PORT=9080
PLATFORM_BACKEND_URL=http://localhost:9080

# 管理平台前端
PLATFORM_FRONTEND_PORT=9081
PLATFORM_FRONTEND_URL=http://localhost:9081

# 采集器服务
COLLECTOR_SERVICE_PORT=9082
COLLECTOR_UI_PORT=9083
COLLECTOR_UI_URL=http://localhost:9083

# OPC UA 模拟器
OPCUA_SIMULATOR_PORT=9484
OPCUA_ENDPOINT=opc.tcp://localhost:9484/opcua/simulator

# 外部服务（保持不变）
POSTGRES_PORT=5432
TDENGINE_PORT=6030

# ============================================
# 数据库配置
# ============================================

DATABASE_URL=postgres://user:password@localhost:5432/prodb
TDENGINE_URL=http://localhost:6030

# ============================================
# AI 配置（可选）
# ============================================

GEMINI_API_KEY=your-api-key-here
```

---

## 更新记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-03-12 | 1.0 | 初始版本，端口重新规划 |