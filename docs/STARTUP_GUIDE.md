# ProDB 启动指南

**日期**: 2026-03-12  
**版本**: 1.0

---

## 服务清单

| 服务 | 端口 | 启动命令 | 访问地址 |
|------|------|----------|----------|
| 管理平台后端 | 9080 | `go run main.go` | http://localhost:9080 |
| 管理平台前端 | 9181 | `npm run dev` | http://localhost:9181 |
| 采集器前端 | 9083 | `npm run dev` | http://localhost:9083 |
| 采集器核心 | - | `go run main.go` | - |
| OPC UA 模拟器 | 9484 | `go run main.go` | opc.tcp://localhost:9484 |

---

## 启动步骤

### 步骤 1: 启动后端服务

**打开终端 1：**
```powershell
cd platform/backend
go run main.go
```

**验证**：访问 http://localhost:9080/ping  
应返回：`{"message":"pong","db_status":"connected"}`

---

### 步骤 2: 启动管理平台前端

**打开终端 2：**
```powershell
cd platform/frontend
npm run dev
```

**访问**：http://localhost:9181

---

### 步骤 3: 启动采集器前端

**打开终端 3：**
```powershell
cd collector/frontend
npm run dev
```

**访问**：http://localhost:9083

---

### 步骤 4: 启动采集器核心（可选）

**打开终端 4：**
```powershell
cd collector
go run main.go
```

---

### 步骤 5: 启动 OPC UA 模拟器（可选）

**打开终端 5：**
```powershell
cd opcua-simulator
go run main.go
```

---

## 快速启动脚本

创建 `start-all.bat`：
```batch
@echo off
echo Starting ProDB Services...

start "Backend" cmd /k "cd platform/backend && go run main.go"
timeout /t 2

start "Frontend" cmd /k "cd platform/frontend && npm run dev"
timeout /t 2

start "Collector UI" cmd /k "cd collector/frontend && npm run dev"
timeout /t 2

start "Collector" cmd /k "cd collector && go run main.go"

echo.
echo All services started!
echo - Frontend: http://localhost:9181
echo - Backend:  http://localhost:9080
echo - Collector UI: http://localhost:9083
pause
```

---

## 端口冲突解决

如果端口被占用：

### 检查端口占用
```powershell
# Windows
netstat -ano | findstr ":9080"
netstat -ano | findstr ":9181"
netstat -ano | findstr ":9083"
```

### 更换端口
编辑对应服务的配置文件：
- 后端: `platform/backend/main.go` 修改 `r.Run(":9080")`
- 前端: `platform/frontend/vite.config.ts` 修改 `port: 9181`
- 采集器: `collector/frontend/package.json` 修改 `--port=9083`

---

## 验证清单

启动后验证以下地址：

- [ ] http://localhost:9080/ping - 后端健康检查
- [ ] http://localhost:9181 - 管理平台前端
- [ ] http://localhost:9083 - 采集器配置界面
- [ ] http://localhost:9080/api/v1/collectors/list - API 测试

---

## 常见问题

### Q: 前端提示 "Port is already in use"
**A**: 更换端口或重启电脑

### Q: 后端提示数据库连接失败
**A**: 检查 PostgreSQL 和 TDengine 是否启动

### Q: API 请求 404
**A**: 确认后端服务已启动，且端口配置正确

---

## 下一步

启动成功后，请查看：
- [README.md](../README.md) - 项目说明
- [RECOMMENDED_APPROACH.md](RECOMMENDED_APPROACH.md) - 架构方案