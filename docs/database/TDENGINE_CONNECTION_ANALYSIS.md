# TDengine连接类型分析报告

## 📋 当前连接配置

### 🔌 使用的驱动类型
**REST连接 (HTTP/HTTPS)**

### 📦 驱动信息
- **驱动包**: `github.com/taosdata/driver-go/v3 v3.5.1`
- **驱动类型**: `taosRestful`
- **连接协议**: HTTP REST API

### 🔗 连接字符串格式

#### 当前实现 (connection_pool.go)
```go
dsn := fmt.Sprintf("%s:%s@http(%s:%d)/%s",
    config.Username,
    config.Password,
    config.Host,
    config.Port,
    config.Database,
)
```

#### 配置文件中的DSN方法 (config.go)
```go
dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/", c.Username, c.Password, c.Host, c.Port)
```

**⚠️ 注意**: 存在不一致！连接池使用 `@http()` 而配置使用 `@tcp()`

## 🔍 TDengine Go驱动支持的连接类型

### 1. 原生连接 (cgo)
```go
import _ "github.com/taosdata/driver-go/v3/taosSql"

// DSN格式
dsn := "user:password@tcp(host:port)/database"
db, err := sql.Open("taosSql", dsn)
```

**特点**:
- ✅ 性能最高
- ✅ 支持所有TDengine功能
- ❌ 需要安装TDengine客户端库
- ❌ 需要cgo支持
- ❌ 跨平台部署复杂

### 2. REST连接 (HTTP)
```go
import _ "github.com/taosdata/driver-go/v3/taosRestful"

// DSN格式
dsn := "user:password@http(host:6041)/database"
db, err := sql.Open("taosRestful", dsn)
```

**特点**:
- ✅ 无需安装客户端库
- ✅ 跨平台兼容性好
- ✅ 部署简单
- ❌ 性能略低于原生连接
- ❌ 功能有限制

### 3. WebSocket连接
```go
import _ "github.com/taosdata/driver-go/v3/taosWS"

// DSN格式
dsn := "user:password@ws(host:6041)/database"
db, err := sql.Open("taosWS", dsn)
```

**特点**:
- ✅ 支持流式查询
- ✅ 实时数据推送
- ✅ 无需客户端库
- ❌ 连接管理复杂
- ❌ 网络要求高

## 📊 当前系统使用情况

### ✅ 正在使用: REST连接
- **端口**: 6030 (应该是6041)
- **协议**: HTTP REST API
- **驱动**: taosRestful

### ⚠️ 发现的问题

1. **端口配置错误**:
   - 当前配置使用端口6030 (原生连接端口)
   - REST连接应该使用端口6041

2. **DSN格式不一致**:
   - connection_pool.go: `@http(host:port)`
   - config.go: `@tcp(host:port)`

3. **默认配置混乱**:
   - 配置文件显示TCP格式
   - 实际使用HTTP格式

## 🔧 修复建议

### 1. 统一DSN格式
```go
// 修复config.go中的DSN方法
func (c *TDengineConfig) DSN() string {
    dsn := fmt.Sprintf("%s:%s@http(%s:%d)/", c.Username, c.Password, c.Host, c.Port)
    if c.Database != "" {
        dsn += c.Database
    }
    return dsn
}
```

### 2. 更新默认端口
```go
// 在DefaultTDengineConfig中
Port: 6041, // REST连接端口
```

### 3. 添加连接类型配置
```go
type TDengineConfig struct {
    // ... 现有字段
    ConnectionType string `json:"connection_type"` // "rest", "native", "websocket"
}
```

## 🚀 推荐的连接策略

### 生产环境推荐: REST连接
**原因**:
- 部署简单，无需安装TDengine客户端
- 跨平台兼容性好
- 维护成本低
- 性能对大多数应用场景足够

### 高性能场景: 原生连接
**适用于**:
- 大量数据写入
- 复杂查询操作
- 对延迟要求极高的场景

### 实时数据场景: WebSocket连接
**适用于**:
- 实时数据流
- 数据订阅
- 流式处理

## 📝 配置示例

### REST连接配置 (推荐)
```json
{
  "host": "192.168.237.145",
  "port": 6041,
  "username": "root",
  "password": "taosdata",
  "database": "industrial_data",
  "connection_type": "rest"
}
```

### 原生连接配置
```json
{
  "host": "192.168.237.145",
  "port": 6030,
  "username": "root",
  "password": "taosdata",
  "database": "industrial_data",
  "connection_type": "native"
}
```

### WebSocket连接配置
```json
{
  "host": "192.168.237.145",
  "port": 6041,
  "username": "root",
  "password": "taosdata",
  "database": "industrial_data",
  "connection_type": "websocket"
}
```

## 🔍 验证当前连接

运行以下命令检查TDengine服务端口:
```bash
# 检查原生连接端口
telnet 192.168.237.145 6030

# 检查REST连接端口
curl http://192.168.237.145:6041/rest/sql

# 检查WebSocket连接端口
curl http://192.168.237.145:6041/rest/ws
```

## 📈 性能对比

| 连接类型 | 性能 | 部署复杂度 | 功能完整性 | 推荐场景 |
|---------|------|-----------|-----------|----------|
| 原生连接 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | 高性能应用 |
| REST连接 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 通用应用 |
| WebSocket | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 实时应用 |

## 🎯 结论

当前系统使用的是 **REST连接**，这是一个很好的选择，因为:
1. 部署简单，无需安装TDengine客户端库
2. 跨平台兼容性好
3. 性能对工业数据采集场景足够
4. 维护成本低

但需要修复端口和DSN格式的不一致问题。