# ProDB 采集器

ProDB 采集器是一个模块化的数据采集代理，支持多种工业协议，并提供可靠的数据采集以及存储转发功能。

## 架构

采集器采用可插拔架构构建，包含以下核心组件：

### 核心组件

- **采集器核心** (`internal/core`)：采集器的主要编排和生命周期管理
- **配置管理** (`internal/config`)：集中式配置加载和验证
- **日志系统** (`internal/logger`)：结构化日志记录，支持可配置的输出
- **协议管理器** (`internal/protocol`)：可插拔的协议实现
- **数据缓冲** (`internal/buffer`)：内存数据缓冲和批量处理
- **存储缓存** (`internal/storage`)：基于 SQLite 的存储转发机制
- **身份验证** (`internal/auth`)：基于 JWT 的平台身份验证
- **通信** (`internal/communication`)：用于平台通信的 HTTP 客户端

### 支持的协议

- **Modbus TCP**：基于工业以太网的 Modbus 通信
- **Modbus RTU**：基于串口的 Modbus 通信
- **OPC-UA**：OPC 统一架构协议
- **MQTT**：消息队列遥测传输协议

## 配置

采集器可以通过以下方式进行配置：

1. **JSON 配置文件**：包含所有选项的完整配置
2. **环境变量**：适用于容器化部署的基础配置
3. **平台同步**：来自管理平台的动态配置更新

### 环境变量

必需的环境变量：
- `COLLECTOR_ID`：采集器的唯一标识符
- `SECRET_KEY`：身份验证密钥
- `PLATFORM_API_ENDPOINT`：平台 API 端点 URL

可选的环境变量：
- `COLLECTOR_NAME`：采集器的可读名称
- `LOG_LEVEL`：日志级别（debug、info、warn、error）
- `LOCAL_DB_PATH`：SQLite 缓存数据库路径
- `HEARTBEAT_INTERVAL`：心跳间隔（秒）

### 配置文件

完整配置示例请参阅 `config.example.json`。

## 功能特性

### 存储转发
- 本地 SQLite 缓存，用于离线数据存储
- 自动重试，采用指数退避策略
- 可配置的保留策略
- 磁盘空间管理

### 身份验证与安全
- 基于 JWT 的身份验证
- 自动令牌刷新
- 使用 HTTPS 的安全通信
- 可配置的重试策略

### 数据采集
- 支持多协议的可插拔架构
- 可配置的采集间隔
- 数据验证和质量控制
- 批量处理以提高效率

### 监控与可观测性
- 支持多输出的结构化日志
- 性能指标收集
- 健康监控和心跳检测
- 实时状态报告

## 使用方法

### 基础用法

1. 设置必需的环境变量：
```bash
export COLLECTOR_ID="your-collector-id"
export SECRET_KEY="your-secret-key"
export PLATFORM_API_ENDPOINT="http://your-platform:8088"
```

2. 运行采集器：
```bash
./collector
```

### 使用配置文件

1. 基于 `config.example.json` 创建配置文件
2. 使用配置文件运行：
```bash
COLLECTOR_CONFIG="./config.json" ./collector
```

### Docker 用法

```bash
docker run -d \
  -e COLLECTOR_ID="collector-001" \
  -e SECRET_KEY="your-secret-key" \
  -e PLATFORM_API_ENDPOINT="http://platform:8088" \
  -v ./data:/data \
  prodb/collector
```

## 开发

### 构建

```bash
go build -o collector .
```

### 测试

```bash
go test ./...
```

### 添加新协议

1. 在 `internal/protocol` 中实现 `Protocol` 接口
2. 在 `registerBuiltinProtocols()` 中注册协议
3. 添加协议特定的配置验证

## API 端点

采集器在 8093 端口暴露 Web 接口用于配置管理：

- `GET /`：配置 Web 界面
- `POST /save`：保存配置
- `POST /shutdown`：优雅关闭

## 日志

采集器支持结构化日志，提供以下级别：
- `debug`：详细的调试信息
- `info`：一般信息消息
- `warn`：警告消息
- `error`：错误消息

日志可以输出到：
- `stdout`：标准输出（默认）
- `file`：支持轮转的日志文件

## 指标

采集器收集和报告各种指标：

### 系统指标
- CPU 使用率
- 内存使用率
- 磁盘使用率
- 网络统计

### 采集指标
- 每秒采集的数据点数
- 采集成功/失败率
- 协议连接状态
- 缓冲区利用率

### 存储指标
- 缓存大小和利用率
- 上传成功/失败率
- 重试次数
- 数据保留统计

## 故障排除

### 常见问题

1. **身份验证失败**
   - 验证 COLLECTOR_ID 和 SECRET_KEY
   - 检查平台连接
   - 查看身份验证日志

2. **协议连接问题**
   - 验证到设备的网络连接
   - 检查协议特定的配置
   - 检查防火墙设置

3. **存储问题**
   - 检查磁盘空间可用性
   - 验证数据库文件权限
   - 查看缓存配置

### 日志分析

启用调试日志以进行详细故障排除：
```bash
export LOG_LEVEL="debug"
./collector
```

## 许可证

本项目是 ProDB 平台的一部分。
