# TDengine连接类型完整指南

## 🎯 快速回答

**当前系统使用**: **REST连接 (HTTP)**
- **端口**: 6041
- **协议**: HTTP REST API
- **驱动**: `github.com/taosdata/driver-go/v3/taosRestful`

## 📊 连接类型对比

| 特性 | 原生连接 | REST连接 | WebSocket连接 |
|------|----------|----------|---------------|
| **端口** | 6030 | 6041 | 6041 |
| **协议** | TCP | HTTP | WebSocket |
| **驱动** | taosSql | taosRestful | taosWS |
| **性能** | 最高 | 中等 | 中等 |
| **部署** | 复杂 | 简单 | 中等 |
| **客户端库** | 需要 | 不需要 | 不需要 |
| **跨平台** | 困难 | 容易 | 容易 |
| **实时性** | 高 | 中 | 最高 |

## 🔧 当前配置详情

### 系统架构
```
前端 (React) 
    ↓ HTTP API
后端 (Go + Gin)
    ↓ REST连接 (HTTP)
TDengine服务器 (192.168.237.145:6041)
```

### 连接流程
1. 前端发送API请求到后端 (localhost:3001)
2. 后端通过REST连接访问TDengine (192.168.237.145:6041)
3. TDengine处理请求并返回结果
4. 后端将结果返回给前端

### DSN格式
```
root:taosdata@http(192.168.237.145:6041)/industrial_data
```

## 🚀 为什么选择REST连接？

### ✅ 优势
1. **部署简单**: 无需在后端服务器安装TDengine客户端库
2. **跨平台**: 可以在任何支持HTTP的环境中运行
3. **防火墙友好**: HTTP协议通常不会被防火墙阻止
4. **调试方便**: 可以直接用curl等工具测试
5. **负载均衡**: 可以通过HTTP负载均衡器分发请求

### ⚠️ 限制
1. **性能**: 比原生连接略慢 (通常差异<10%)
2. **功能**: 某些高级功能可能不支持
3. **连接开销**: 每次请求都有HTTP协议开销

## 🔍 如何验证连接类型

### 1. 检查端口
```bash
# 运行端口检查工具
check-tdengine-ports.bat
```

### 2. 查看代码
```go
// 在 connection_pool.go 中
import _ "github.com/taosdata/driver-go/v3/taosRestful"

// DSN格式显示使用HTTP
dsn := fmt.Sprintf("%s:%s@http(%s:%d)/%s", ...)
```

### 3. 测试连接
```bash
# 测试REST API
curl http://192.168.237.145:6041/rest/sql

# 测试连接
test-tdengine-connection.bat
```

## 🔄 如何切换连接类型

### 切换到原生连接
1. **修改导入**:
```go
import _ "github.com/taosdata/driver-go/v3/taosSql"
```

2. **修改DSN格式**:
```go
dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s", ...)
```

3. **修改端口**: 6041 → 6030

4. **安装客户端库**: 在部署服务器上安装TDengine客户端

### 切换到WebSocket连接
1. **修改导入**:
```go
import _ "github.com/taosdata/driver-go/v3/taosWS"
```

2. **修改DSN格式**:
```go
dsn := fmt.Sprintf("%s:%s@ws(%s:%d)/%s", ...)
```

3. **端口保持**: 6041

## 📈 性能优化建议

### 当前REST连接优化
1. **连接池**: 已实现，配置合理的连接数
2. **超时设置**: 根据网络情况调整
3. **重试机制**: 已实现自动重连
4. **批量操作**: 尽量使用批量插入

### 配置建议
```json
{
  "max_open_conns": 20,     // 根据并发需求调整
  "max_idle_conns": 10,     // 通常是max_open_conns的一半
  "conn_timeout": "30s",    // 根据网络延迟调整
  "health_check_interval": "30s"
}
```

## 🛠️ 故障排除

### 常见问题

1. **连接超时**
   - 检查网络连通性
   - 确认端口6041开放
   - 调整超时时间

2. **认证失败**
   - 验证用户名密码
   - 检查TDengine用户权限

3. **端口错误**
   - 确认使用6041而不是6030
   - 检查TDengine REST服务是否启动

### 调试工具
```bash
# 检查端口
check-tdengine-ports.bat

# 测试连接
test-tdengine-connection.bat

# 检查配置
configure-tdengine.bat
```

## 📝 最佳实践

1. **生产环境**: 使用REST连接 (当前配置)
2. **高性能场景**: 考虑原生连接
3. **实时数据**: 考虑WebSocket连接
4. **混合部署**: 可以同时支持多种连接类型

## 🎯 总结

当前系统使用REST连接是一个很好的选择，因为:
- 部署和维护简单
- 跨平台兼容性好
- 性能满足工业数据采集需求
- 网络友好，易于扩展

如果未来有特殊需求，可以考虑切换到其他连接类型，但对于大多数应用场景，REST连接是最佳选择。