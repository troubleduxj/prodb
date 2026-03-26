# TDengine 设置指南

本指南将帮助您配置ProDB系统以连接到您的TDengine数据库。

## 📋 前提条件

- TDengine 服务器已安装并运行
- TDengine 服务器地址：`192.168.237.145:6030`
- 默认用户名：`root`
- 默认密码：`taosdata`

## 🚀 快速配置

### 方法1：使用配置工具（推荐）

1. 运行配置工具：
   ```bash
   configure-tdengine.bat
   ```

2. 按照提示输入TDengine连接信息：
   - 主机地址：`192.168.237.145`
   - 端口：`6030`
   - 用户名：`root`
   - 密码：`taosdata`
   - 数据库：`industrial_data`

3. 工具会自动测试连接并保存配置

### 方法2：手动配置

1. 创建配置目录（如果不存在）：
   ```bash
   mkdir -p platform/backend/config
   ```

2. 创建配置文件 `platform/backend/config/tdengine.json`：
   ```json
   {
     "host": "192.168.237.145",
     "port": 6030,
     "username": "root",
     "password": "taosdata",
     "database": "industrial_data",
     "max_open_conns": 20,
     "max_idle_conns": 10,
     "conn_timeout": "30s",
     "idle_timeout": "10m",
     "max_lifetime": "1h",
     "health_check_interval": "30s",
     "max_retries": 3,
     "retry_interval": "5s",
     "enable_auto_reconnect": true,
     "reconnect_interval": "10s",
     "max_reconnect_attempts": 5
   }
   ```

## 🔧 测试连接

运行连接测试：
```bash
test-tdengine-connection.bat
```

测试脚本会：
- 验证配置文件
- 测试TDengine连接
- 显示服务器版本信息
- 显示连接健康状态和指标

## 🏃‍♂️ 启动系统

配置完成后，启动后端服务：
```bash
start-backend.bat
```

后端服务启动时会：
- 自动加载TDengine配置
- 建立连接池
- 启动健康检查
- 提供TDengine相关API端点

## 📊 系统状态检查

运行系统状态检查：
```bash
check-system-status.bat
```

这会检查：
- TDengine连接状态
- 后端API服务状态
- 前端服务状态

## 🔍 故障排除

### 连接失败

如果连接失败，请检查：

1. **网络连接**：
   ```bash
   ping 192.168.237.145
   ```

2. **TDengine服务状态**：
   确保TDengine服务在目标服务器上运行

3. **端口访问**：
   确保端口6030可访问，检查防火墙设置

4. **认证信息**：
   验证用户名和密码是否正确

### 配置问题

1. **配置文件格式**：
   确保JSON格式正确，没有语法错误

2. **权限问题**：
   确保应用有读取配置文件的权限

3. **路径问题**：
   确保配置文件路径正确

### 性能优化

1. **连接池设置**：
   - `max_open_conns`: 根据并发需求调整
   - `max_idle_conns`: 通常设置为max_open_conns的一半

2. **超时设置**：
   - `conn_timeout`: 连接超时时间
   - `idle_timeout`: 空闲连接超时时间

3. **重连设置**：
   - `enable_auto_reconnect`: 启用自动重连
   - `max_reconnect_attempts`: 最大重连次数

## 📚 API端点

配置完成后，以下TDengine相关的API端点将可用：

- `GET /api/v1/tdengine/health` - 健康检查
- `GET /api/v1/tdengine/metrics` - 连接指标
- `GET /api/v1/tdengine/databases` - 数据库列表
- `POST /api/v1/tdengine/databases` - 创建数据库
- `GET /api/v1/tdengine/db/{database}/supertables` - 超级表列表
- `POST /api/v1/tdengine/query` - 执行查询

## 🔐 安全建议

1. **更改默认密码**：
   在生产环境中更改TDengine默认密码

2. **网络安全**：
   使用防火墙限制TDengine端口访问

3. **配置文件安全**：
   保护配置文件，避免密码泄露

4. **连接加密**：
   在生产环境中考虑使用TLS加密连接

## 📞 支持

如果遇到问题，请：

1. 检查日志输出
2. 运行系统状态检查
3. 查看TDengine服务器日志
4. 联系技术支持团队