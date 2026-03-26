# ProDB - 工业数据采集与管理平台

ProDB 是一个完整的工业数据采集与管理平台，包含OPC UA模拟器、数据采集器（Collector）、后端API服务（Platform）和前端管理界面。支持多协议数据采集、实时监控、配置下发、边缘告警、任务运行时监控等功能。

## 🏗️ 项目架构

```
ProDB 系统架构
├── opcua-simulator/    # OPC UA 模拟器 (提供模拟数据)
├── collector/          # 数据采集器 (多协议支持、配置同步、边缘告警)
│   ├── internal/       # 核心模块
│   │   ├── api/        # HTTP API 服务
│   │   ├── configsync/ # 配置同步服务
│   │   ├── auth/       # 认证管理
│   │   └── communication/  # 平台通信
│   └── frontend/       # Collector 管理界面 (React)
├── platform/
│   ├── backend/        # 后端API服务 (Go + Gin + PostgreSQL)
│   │   ├── handlers/   # API 处理器
│   │   ├── services/   # 业务服务
│   │   └── models/     # 数据模型
│   └── frontend/       # 前端管理界面 (React + TypeScript + Vite)
│       └── pages/      # 功能页面
├── docs/               # 文档
│   ├── OPTIMIZATION_TASK_LIST.md
│   └── design_document.md
└── 启动脚本/
    ├── start-all-services.bat     # 一键启动所有服务
    ├── start-backend.bat          # 启动后端服务
    ├── start-collector.bat        # 启动数据采集器
    └── start-opcua-simulator.bat  # 启动OPC UA模拟器
```

## ✨ 主要功能

- 🔌 **多协议支持**: OPC UA、MQTT、Modbus TCP/RTU
- 📊 **实时监控**: 实时数据采集与状态监控
- 🎛️ **采集器管理**: 采集器注册、配置、状态管理、Agent ID 绑定
- 🔧 **接口管理**: 通信接口配置（Modbus、OPC UA、MQTT）
- 📦 **配置下发**: 配置同步状态监控、增量同步、配置回滚
- 🚨 **边缘告警**: 边缘节点告警规则管理、实时告警处理
- ⚡ **任务运行时**: 数据采集任务实时监控、性能指标追踪
- 📈 **数据可视化**: 图表展示、仪表盘配置
- 🔐 **安全认证**: 采集器认证与权限管理、配置加密
- 💾 **数据存储**: TDengine时序数据库集成
- 🧬 **元数据管理**: Schema版本管理、数据血缘追踪、质量监控

## 🛠️ 环境要求

在开始之前，请确保您已安装以下软件：

- **Go**: 版本 1.19 或更高
- **Node.js**: 版本 18 或更高  
- **PostgreSQL**: 正在运行的实例
- **TDengine**: 时序数据库（可选，用于高性能数据存储）
- **Git**

## 📊 TDengine 配置

系统支持TDengine时序数据库用于高性能数据存储。

### 配置TDengine连接

1. **使用配置工具（推荐）**：
   ```bash
   # 运行配置工具
   configure-tdengine.bat
   ```

2. **手动配置**：
   编辑 `platform/backend/config/tdengine.json` 文件：
   ```json
   {
     "host": "192.168.237.145",
     "port": 6030,
     "username": "root",
     "password": "taosdata",
     "database": "industrial_data"
   }
   ```

3. **测试连接**：
   ```bash
   # 测试TDengine连接
   test-tdengine-connection.bat
   ```

### TDengine 功能特性

- ✅ 自动连接管理和重连
- ✅ 连接池优化
- ✅ 健康检查监控
- ✅ 数据库和超级表管理
- ✅ 高性能批量写入
- ✅ 查询优化和缓存

## 🚀 快速启动

### 方法1：一键启动（推荐）

直接双击 `start-all-services.bat` 文件，系统会自动按顺序启动所有服务：

1. OPC UA 模拟器
2. 后端API服务
3. 数据采集器

每个服务都会在独立的窗口中运行，窗口标题清楚标识服务类型。

### 方法2：手动启动

#### 1. 启动 OPC UA 模拟器
```bash
# 双击启动脚本
start-opcua-simulator.bat

# 或手动启动
cd opcua-simulator
go run main.go
```

#### 2. 启动后端服务
```bash
# 双击启动脚本  
start-backend.bat

# 或手动启动
cd platform/backend
go mod tidy
go run main.go
```

#### 3. 启动前端服务
```bash
cd platform/frontend
npm install
npm run dev
```

#### 4. 注册采集器
```bash
# 双击注册脚本
register-collector.bat

# 或手动注册
go run register-opcua-collector.go
```

#### 5. 启动数据采集器
```bash
# 双击启动脚本
start-collector.bat

# 或手动启动
go run start-opcua-collector.go
```

## 🌐 服务端口配置

| 服务 | 端口 | 访问地址 |
|------|------|----------|
| **Platform 前端** | 9181 | http://localhost:9181/ |
| **Platform 后端** | 9080 | http://localhost:9080 |
| **Collector 前端** | 9083 | http://localhost:9083/ |
| **Collector 后端** | 9082 | http://localhost:9082 |
| **OPC UA 模拟器** | 4840 | opc.tcp://localhost:4840/opcua/simulator |

### 访问地址

启动完成后，您可以通过以下地址访问系统：

- **Platform 管理界面**: http://localhost:9181/
- **Platform API 文档**: http://localhost:9080/swagger/index.html
- **Collector 管理界面**: http://localhost:9083/
- **Collector API**: http://localhost:9082/api/v1

### OPC UA 模拟器
- **OPC UA Endpoint**: opc.tcp://localhost:4840/opcua/simulator

## 🔧 Agent ID 配置说明

### Platform 端创建 Agent
1. 访问 Platform 前端 (http://localhost:9181)
2. 进入「采集器管理」→「代理」
3. 点击「部署 Agent」
4. 填写 Agent 信息：
   - **Agent ID**: 必填，格式如 `collector-001`（小写字母、数字、连字符）
   - **Agent 名称**: 如 "生产线采集器"
   - **Agent Key**: 系统自动生成，用于认证

### Collector 端配置
编辑 `collector/config.json`：
```json
{
    "collector_id": "collector-001",
    "platform": {
        "url": "http://localhost:9080",
        "api_key": "your-agent-key-from-platform"
    }
}
```

### 配置要求
- `collector_id` 必须与 Platform 中创建的 **Agent ID** 完全一致
- `api_key` 必须使用 Platform 生成的 **Agent Key**
- `platform.url` 必须是 Platform 后端地址

## 📋 服务说明

### 窗口标识
启动后您会看到以下窗口：
- **"OPC UA Simulator"** = OPC UA 模拟器（提供18个模拟数据点）
- **"Backend Server"** = 后端API服务（处理数据和管理）
- **"OPC UA Collector"** = 数据采集器（采集并发送数据到平台）

### 数据点说明
OPC UA模拟器提供以下数据点：
- 温度传感器 (3个): 模拟车间温度数据
- 压力传感器 (2个): 模拟管道压力数据  
- 流量传感器 (2个): 模拟流量数据
- 液位传感器 (2个): 模拟储罐液位数据
- 电机状态 (4个): 模拟电机运行状态和转速
- 阀门开度 (2个): 模拟阀门控制数据
- 系统信息 (3个): 运行时间和报警状态

## 🧪 测试系统

### 测试API连接
```bash
# 双击测试脚本
test-system.bat

# 或手动测试
go run test-routes.go
```

### 验证功能
1. **采集器管理**: 在前端查看已注册的采集器
2. **协议显示**: 确认采集器显示OPC UA协议标签
3. **实时数据**: 查看数据采集状态和实时数值
4. **数据可视化**: 在监控面板查看图表和仪表盘

## 🔧 故障排除

### 常见问题

1. **端口占用**
   ```bash
   # 检查端口占用
   netstat -ano | findstr "3000\|3001\|4840"
   
   # 停止相关进程
   taskkill /F /PID <进程ID>
   ```

2. **数据库连接失败**
   - 确保PostgreSQL服务正在运行
   - 检查数据库连接配置
   - 验证数据库用户权限

3. **采集器无法连接**
   - 确认OPC UA模拟器正在运行
   - 检查防火墙设置
   - 验证网络连接

4. **前端无法访问后端**
   - 检查后端服务是否启动
   - 确认API地址配置正确
   - 查看浏览器控制台错误信息

### 日志查看
- **后端日志**: 在"Backend Server"窗口查看
- **采集器日志**: 在"OPC UA Collector"窗口查看  
- **模拟器日志**: 在"OPC UA Simulator"窗口查看

## 📋 项目优化和架构升级

本项目已完成系统性架构优化和功能完善。主要优化包括：

### 架构优化 (已完成)
- ✅ **Interface 模型**: 新增采集器通信接口配置管理
- ✅ **配置下发服务**: 支持配置同步、增量更新、配置回滚
- ✅ **配置同步模块**: Collector 端配置同步、确认、回滚机制
- ✅ **边缘预处理模块**: 边缘告警管理、数据预处理

### 前端页面 (已完成)
- ✅ **Collector Interfaces**: 接口管理页面（Modbus/OPC UA/MQTT）
- ✅ **Config Delivery Status**: 配置下发状态监控页面
- ✅ **Edge Alert Manager**: 边缘告警管理页面
- ✅ **Task Runtime Status**: 任务运行时状态监控页面
- ✅ **国际化支持**: 页面标题支持中英文切换
- ✅ **布局统一**: 所有页面布局风格一致

### 当前状态
- **项目完成度**: 95%
- **核心功能**: ✅ 已完成
- **架构优化**: ✅ 已完成
- **前端页面**: ✅ 已完成
- **生产就绪**: 📅 预计1个月

### 文档
- **[优化任务清单](docs/OPTIMIZATION_TASK_LIST.md)** - 详细的任务列表和实施计划
- **[架构优化方案](docs/ARCHITECTURE_OPTIMIZATION_PLAN.md)** - 架构设计文档

## 📚 开发指南

### 项目结构
```
ProDB/
├── opcua-simulator/           # OPC UA模拟器
│   ├── main.go               # 模拟器主程序
│   └── config.json           # 模拟器配置
├── platform/
│   ├── backend/              # 后端服务
│   │   ├── main.go          # 主程序入口
│   │   ├── handlers/        # API处理器
│   │   ├── models/          # 数据模型
│   │   └── services/        # 业务服务
│   └── frontend/            # 前端应用
│       ├── src/
│       │   ├── features/    # 功能模块
│       │   ├── components/  # 通用组件
│       │   └── routes/      # 路由配置
│       └── package.json
├── collector/               # 数据采集器
│   ├── internal/           # 内部模块
│   └── main.go            # 采集器主程序
└── 启动脚本/               # 便捷启动脚本
```

### API文档
后端提供RESTful API，主要端点：

#### 采集器管理
- `GET /api/v1/collectors` - 获取采集器列表
- `POST /api/v1/collectors` - 注册新采集器（支持 Agent ID）
- `GET /api/v1/collectors/:id` - 获取采集器详情
- `PUT /api/v1/collectors/:id` - 更新采集器信息

#### 接口管理
- `GET /api/v1/collectors/:id/interfaces` - 获取采集器接口列表
- `POST /api/v1/collectors/:id/interfaces` - 创建接口配置
- `PUT /api/v1/collectors/:id/interfaces/:interface_id` - 更新接口配置
- `DELETE /api/v1/collectors/:id/interfaces/:interface_id` - 删除接口配置
- `POST /api/v1/collectors/:id/interfaces/:interface_id/test` - 测试接口连接

#### 配置下发
- `GET /api/v1/collectors/:id/config` - 获取采集器配置
- `POST /api/v1/collectors/:id/config/deliver` - 下发配置
- `POST /api/v1/collectors/:id/config/confirm` - 确认配置已应用
- `POST /api/v1/collectors/:id/config/rollback` - 回滚配置
- `GET /api/v1/collectors/:id/config/status` - 获取配置同步状态

#### 数据摄取
- `POST /api/v1/data/ingest` - 数据摄取
- `GET /api/v1/data/realtime/:collector_id` - 获取实时数据

#### Collector 本地 API
- `GET /api/v1/config` - 读取本地配置
- `POST /api/v1/config` - 保存本地配置
- `POST /api/v1/config/test` - 测试与 Platform 连接
- `GET /api/v1/health` - 健康检查

### 扩展开发
1. **添加新协议**: 在`collector/internal/protocol/`目录下添加新协议实现
2. **自定义数据源**: 修改`opcua-simulator/config.json`配置文件
3. **前端功能**: 在`platform/frontend/src/features/`目录下添加新功能模块

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您遇到问题或有疑问，请：
1. 查看故障排除部分
2. 检查项目Issues
3. 创建新的Issue描述问题

---

**ProDB** - 让工业数据采集变得简单高效！ 🚀
