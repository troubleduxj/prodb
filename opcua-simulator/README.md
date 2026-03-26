# OPC UA 服务器模拟器

这是一个用于ProDB项目的OPC UA服务器模拟器，用于生成模拟的工业数据供采集器测试使用。

## 功能特性

### 模拟节点类型
- **温度传感器**: 3个节点，模拟不同的温度变化趋势
- **压力传感器**: 2个节点，模拟压力数据
- **流量传感器**: 2个节点，模拟流量数据
- **液位传感器**: 2个节点，模拟液位数据
- **电机状态**: 2个节点，模拟电机开关状态
- **电机转速**: 2个节点，模拟电机转速
- **阀门开度**: 2个节点，模拟阀门开度
- **设备运行时间**: 累计运行时间
- **报警状态**: 高温报警、低压报警等

### 数据变化模式
- **正弦波变化**: 按正弦函数规律变化
- **随机变化**: 在范围内随机波动
- **递增变化**: 持续递增，到达上限后重置
- **递减变化**: 持续递减，到达下限后重置

## 节点列表

| 节点ID | 节点名称 | 数据类型 | 变化模式 | 数值范围 |
|--------|----------|----------|----------|----------|
| Temperature_Sensor_01 | 温度传感器1 | Float | 正弦波 | 0-100°C |
| Temperature_Sensor_02 | 温度传感器2 | Float | 随机 | 0-100°C |
| Temperature_Sensor_03 | 温度传感器3 | Float | 递增 | 0-100°C |
| Pressure_Sensor_01 | 压力传感器1 | Float | 递减 | 0-10 Bar |
| Pressure_Sensor_02 | 压力传感器2 | Float | 正弦波 | 0-10 Bar |
| Flow_Sensor_01 | 流量传感器1 | Float | 随机 | 0-100 L/min |
| Flow_Sensor_02 | 流量传感器2 | Float | 正弦波 | 0-100 L/min |
| Level_Sensor_01 | 液位传感器1 | Float | 递减 | 0-100% |
| Level_Sensor_02 | 液位传感器2 | Float | 递增 | 0-100% |
| Motor_01_Status | 电机1状态 | Boolean | 随机 | true/false |
| Motor_02_Status | 电机2状态 | Boolean | 随机 | true/false |
| Motor_01_Speed | 电机1转速 | Int32 | 正弦波 | 0-3000 RPM |
| Motor_02_Speed | 电机2转速 | Int32 | 随机 | 0-3000 RPM |
| Valve_01_Opening | 阀门1开度 | Float | 正弦波 | 0-100% |
| Valve_02_Opening | 阀门2开度 | Float | 随机 | 0-100% |
| Device_Runtime | 设备运行时间 | Int32 | 递增 | 0-999999 秒 |
| Alarm_Temperature_High | 高温报警 | Boolean | 随机 | true/false |
| Alarm_Pressure_Low | 低压报警 | Boolean | 随机 | true/false |

## 安装和运行

### 方式一：直接运行

1. **安装依赖**
```bash
cd opcua-simulator
go mod tidy
```

2. **运行模拟器**
```bash
# 使用默认配置
go run main.go

# 或使用指定配置文件
go run main.go config.json

# 或使用启动脚本
./start.sh        # Linux/Mac
start.bat         # Windows
```

### 方式二：构建后运行

```bash
# 构建
go build -o opcua-simulator main.go

# 运行
./opcua-simulator config.json
```

### 方式三：使用 Docker

```bash
# 构建镜像
docker build -t opcua-simulator .

# 运行容器
docker run -p 8080:8080 -p 4840:4840 opcua-simulator

# 或使用 docker-compose
docker-compose up -d
```

### 方式四：使用 Makefile

```bash
make run      # 运行模拟器
make build    # 构建可执行文件
make test     # 运行测试
make clean    # 清理构建文件
make help     # 显示帮助
```

### 服务器信息
- **HTTP API**: `http://localhost:8080`
- **OPC UA 端点**: `opc.tcp://localhost:4840/opcua/simulator`
- **安全策略**: None (无安全策略)
- **认证模式**: Anonymous (匿名访问)

## 使用方法

### 启动模拟器
```bash
cd opcua-simulator
go run main.go config.json
```

启动后会看到类似输出：
```
2024/01/01 10:00:00 Loaded configuration with 17 nodes
2024/01/01 10:00:00 Added node: Temperature_Sensor_01 (温度传感器1) - Initial value: 20
2024/01/01 10:00:00 Added node: Temperature_Sensor_02 (温度传感器2) - Initial value: 25
...
2024/01/01 10:00:00 Starting OPC UA simulator HTTP interface on port 8080
2024/01/01 10:00:00 OPC UA endpoint simulation: opc.tcp://localhost:4840/opcua/simulator
2024/01/01 10:00:00 OPC UA simulator started successfully
=== OPC UA Simulator Started ===
HTTP API: http://localhost:8080
OPC UA Endpoint: opc.tcp://localhost:4840/opcua/simulator
Available endpoints:
  GET  /opcua/status   - Server status
  GET  /opcua/nodes    - List all nodes
  GET  /opcua/node/{id} - Get specific node
  GET  /opcua/browse   - Browse nodes
  POST /opcua/read     - Read node values
Press Ctrl+C to stop...
```

### HTTP API 使用

#### 1. 获取服务器状态
```bash
curl http://localhost:8080/opcua/status
```

#### 2. 获取所有节点
```bash
curl http://localhost:8080/opcua/nodes
```

#### 3. 获取单个节点
```bash
curl http://localhost:8080/opcua/node/Temperature_Sensor_01
```

#### 4. 浏览节点
```bash
curl http://localhost:8080/opcua/browse
```

#### 5. 读取多个节点值
```bash
curl -X POST http://localhost:8080/opcua/read \
  -H "Content-Type: application/json" \
  -d '{
    "nodeIds": [
      "ns=2;s=Temperature_Sensor_01",
      "ns=2;s=Pressure_Sensor_01",
      "ns=2;s=Motor_01_Status"
    ]
  }'
```

### 状态监控
模拟器每10秒会打印一次当前状态：
```
=== OPC UA Simulator Status ===
Running: true
Total Nodes: 17

Node Values:
  Temperature_Sensor_01     | 温度传感器1            | 23.45
  Temperature_Sensor_02     | 温度传感器2            | 28.12
  Pressure_Sensor_01        | 压力传感器1            | 1.85
  ...
================================
```

### 客户端示例
运行客户端示例：
```bash
go run examples/client_example.go
```

### 测试
运行测试脚本：
```bash
# Linux/Mac
go run test_simulator.go

# Windows
test.bat
```

### 停止模拟器
使用 `Ctrl+C` 停止模拟器。

## 采集器配置

要让ProDB采集器连接到此模拟器，请使用以下配置：

```json
{
  "collector_id": "test-collector-001",
  "protocols": {
    "opcua": {
      "enabled": true,
      "endpoint": "opc.tcp://localhost:4840/opcua/simulator",
      "security_policy": "None",
      "security_mode": "None",
      "username": "",
      "password": "",
      "nodes": [
        {
          "node_id": "ns=2;s=Temperature_Sensor_01",
          "name": "温度传感器1",
          "data_type": "float",
          "collection_interval": 1000
        },
        {
          "node_id": "ns=2;s=Pressure_Sensor_01",
          "name": "压力传感器1",
          "data_type": "float",
          "collection_interval": 1000
        },
        {
          "node_id": "ns=2;s=Motor_01_Status",
          "name": "电机1状态",
          "data_type": "boolean",
          "collection_interval": 2000
        }
      ]
    }
  }
}
```

## 扩展功能

### 添加新节点
在 `initializeNodes()` 函数中添加新的模拟节点：

```go
sim.addNode("New_Sensor", "新传感器", ua.TypeIDFloat, 50.0, 0.0, 100.0, 1.0, "sine")
```

### 自定义变化模式
在 `calculateNewFloatValue()` 函数中添加新的变化模式：

```go
case "custom":
    // 自定义变化逻辑
    newVal = customCalculation(currentVal, elapsed)
```

### 修改更新频率
修改 `dataUpdateLoop()` 中的ticker间隔：

```go
ticker := time.NewTicker(500 * time.Millisecond) // 500ms更新一次
```

## 故障排查

### 常见问题

1. **端口被占用**
   ```
   Error: listen tcp :4840: bind: address already in use
   ```
   解决方案：修改main.go中的端口号或停止占用4840端口的程序

2. **依赖包下载失败**
   ```
   Error: go: github.com/gopcua/opcua@v0.5.3: Get "https://proxy.golang.org/...": dial tcp: i/o timeout
   ```
   解决方案：配置Go代理或使用国内镜像

3. **采集器连接失败**
   - 检查端点地址是否正确
   - 确认模拟器正在运行
   - 检查防火墙设置

### 调试模式
启用详细日志输出：
```bash
GOLOG_LEVEL=debug go run main.go
```

## 性能说明

- **节点数量**: 17个模拟节点
- **更新频率**: 每秒更新一次
- **内存使用**: 约10-20MB
- **CPU使用**: 低于1%
- **网络带宽**: 每个连接约1-5KB/s

## 许可证

本项目遵循MIT许可证。