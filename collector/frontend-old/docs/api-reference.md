# ProDB Collector API 接口文档

## 目录

1. [API概述](#api概述)
2. [认证和授权](#认证和授权)
3. [系统状态API](#系统状态api)
4. [接口管理API](#接口管理api)
5. [协议测试API](#协议测试api)
6. [驱动管理API](#驱动管理api)
7. [配置管理API](#配置管理api)
8. [数据查询API](#数据查询api)
9. [错误处理](#错误处理)
10. [SDK和示例](#sdk和示例)

## API概述

ProDB Collector 提供RESTful API接口，支持JSON格式的数据交换。所有API端点都以 `/api/v1` 为前缀。

### 基本信息

- **Base URL**: `http://localhost:8080/api/v1`
- **协议**: HTTP/HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API版本**: v1

### 通用响应格式

#### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### HTTP状态码

- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未授权
- `403 Forbidden` - 权限不足
- `404 Not Found` - 资源不存在
- `409 Conflict` - 资源冲突
- `422 Unprocessable Entity` - 数据验证失败
- `500 Internal Server Error` - 服务器内部错误
- `503 Service Unavailable` - 服务不可用

## 认证和授权

### API密钥认证

```http
GET /api/v1/status
Authorization: Bearer YOUR_API_KEY
```

### 基本认证

```http
GET /api/v1/status
Authorization: Basic base64(username:password)
```

### 获取API密钥

```http
POST /api/v1/auth/token
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

## 系统状态API

### 获取系统状态

获取采集器的整体运行状态。

```http
GET /api/v1/status
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "collector-001",
    "name": "ProDB Collector",
    "status": "running",
    "uptime": 86400,
    "version": "1.0.0",
    "dataPoints": 1250,
    "errorCount": 3,
    "lastUpdate": "2024-01-15T10:30:00Z",
    "performance": {
      "memoryUsage": 45.2,
      "cpuUsage": 12.8,
      "diskUsage": 23.1
    },
    "network": {
      "bytesReceived": 1048576,
      "bytesSent": 524288,
      "packetsReceived": 1024,
      "packetsSent": 512
    }
  }
}
```

### 获取系统信息

获取系统的详细信息。

```http
GET /api/v1/system/info
```

**响应**:
```json
{
  "success": true,
  "data": {
    "hostname": "collector-server",
    "platform": "linux",
    "architecture": "x64",
    "nodeVersion": "18.17.0",
    "totalMemory": 8589934592,
    "freeMemory": 4294967296,
    "loadAverage": [0.5, 0.3, 0.2],
    "networkInterfaces": {
      "eth0": {
        "address": "192.168.1.100",
        "netmask": "255.255.255.0",
        "family": "IPv4"
      }
    }
  }
}
```

### 获取性能指标

获取实时性能指标。

```http
GET /api/v1/metrics
```

**查询参数**:
- `interval` (可选): 时间间隔，默认为 `1m`
- `duration` (可选): 时间范围，默认为 `1h`

**响应**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00Z",
    "metrics": {
      "cpu": {
        "usage": 12.8,
        "cores": 4,
        "loadAverage": [0.5, 0.3, 0.2]
      },
      "memory": {
        "total": 8589934592,
        "used": 3865470976,
        "free": 4724463616,
        "usage": 45.2
      },
      "disk": {
        "total": 107374182400,
        "used": 24802508800,
        "free": 82571673600,
        "usage": 23.1
      },
      "network": {
        "bytesPerSecond": 1024,
        "packetsPerSecond": 10,
        "connections": 25
      }
    }
  }
}
```

## 接口管理API

### 获取接口列表

获取所有配置的接口列表。

```http
GET /api/v1/interfaces
```

**查询参数**:
- `status` (可选): 过滤状态 (`connected`, `disconnected`, `error`)
- `protocol` (可选): 过滤协议类型
- `page` (可选): 页码，默认为 1
- `limit` (可选): 每页数量，默认为 20

**响应**:
```json
{
  "success": true,
  "data": {
    "interfaces": [
      {
        "id": "opc-ua-001",
        "name": "生产线OPC UA服务器",
        "protocol": "OPC_UA",
        "status": "connected",
        "config": {
          "endpoint": "opc.tcp://192.168.1.100:4840",
          "securityPolicy": "None",
          "username": "",
          "password": ""
        },
        "statistics": {
          "dataRate": 50.5,
          "errorRate": 0.1,
          "lastData": "2024-01-15T10:29:55Z",
          "totalPoints": 125,
          "activePoints": 120
        },
        "created": "2024-01-10T08:00:00Z",
        "modified": "2024-01-15T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### 获取接口详情

获取指定接口的详细信息。

```http
GET /api/v1/interfaces/{id}
```

**路径参数**:
- `id`: 接口ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "opc-ua-001",
    "name": "生产线OPC UA服务器",
    "protocol": "OPC_UA",
    "status": "connected",
    "config": {
      "endpoint": "opc.tcp://192.168.1.100:4840",
      "securityPolicy": "None",
      "username": "",
      "password": "",
      "subscriptionInterval": 1000,
      "maxReconnectAttempts": 5,
      "timeout": 5000
    },
    "dataPoints": [
      {
        "id": "ns=2;s=Temperature",
        "name": "温度",
        "dataType": "Double",
        "value": 25.6,
        "quality": "Good",
        "timestamp": "2024-01-15T10:29:55Z"
      }
    ],
    "statistics": {
      "dataRate": 50.5,
      "errorRate": 0.1,
      "lastData": "2024-01-15T10:29:55Z",
      "totalPoints": 125,
      "activePoints": 120,
      "bytesReceived": 1048576,
      "bytesSent": 524288
    },
    "logs": [
      {
        "timestamp": "2024-01-15T10:29:55Z",
        "level": "info",
        "message": "Data received successfully"
      }
    ]
  }
}
```

### 创建接口

创建新的接口配置。

```http
POST /api/v1/interfaces
Content-Type: application/json

{
  "name": "新OPC UA接口",
  "protocol": "OPC_UA",
  "config": {
    "endpoint": "opc.tcp://192.168.1.101:4840",
    "securityPolicy": "None",
    "username": "",
    "password": "",
    "subscriptionInterval": 1000,
    "timeout": 5000
  },
  "dataPoints": [
    {
      "nodeId": "ns=2;s=Temperature",
      "name": "温度",
      "enabled": true
    }
  ],
  "autoStart": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "opc-ua-002",
    "name": "新OPC UA接口",
    "protocol": "OPC_UA",
    "status": "connecting",
    "created": "2024-01-15T10:30:00Z"
  }
}
```

### 更新接口

更新现有接口配置。

```http
PUT /api/v1/interfaces/{id}
Content-Type: application/json

{
  "name": "更新的接口名称",
  "config": {
    "subscriptionInterval": 2000,
    "timeout": 10000
  }
}
```

### 删除接口

删除指定接口。

```http
DELETE /api/v1/interfaces/{id}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "接口删除成功"
  }
}
```

### 控制接口状态

启动、停止或重启接口。

```http
POST /api/v1/interfaces/{id}/control
Content-Type: application/json

{
  "action": "start" // "start", "stop", "restart"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "opc-ua-001",
    "status": "starting",
    "message": "接口启动中..."
  }
}
```

## 协议测试API

### 测试协议连接

测试指定协议的连接。

```http
POST /api/v1/test/protocol
Content-Type: application/json

{
  "protocol": "OPC_UA",
  "config": {
    "endpoint": "opc.tcp://192.168.1.100:4840",
    "securityPolicy": "None",
    "username": "",
    "password": ""
  },
  "testType": "connect", // "connect", "read", "write", "browse"
  "timeout": 5000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "testId": "test-001",
    "protocol": "OPC_UA",
    "testType": "connect",
    "result": "success",
    "duration": 1250,
    "data": {
      "serverInfo": {
        "productName": "Prosys OPC UA Server",
        "softwareVersion": "5.4.0",
        "buildNumber": "2023-10-15"
      },
      "endpoints": [
        {
          "endpointUrl": "opc.tcp://192.168.1.100:4840",
          "securityMode": "None",
          "securityPolicy": "None"
        }
      ]
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 设备扫描

扫描网络中的设备。

```http
POST /api/v1/scan/devices
Content-Type: application/json

{
  "ipRange": "192.168.1.0/24",
  "protocols": ["OPC_UA", "MODBUS_TCP"],
  "timeout": 5000,
  "concurrent": 10
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "scanId": "scan-001",
    "devices": [
      {
        "ip": "192.168.1.100",
        "hostname": "plc-server-01",
        "protocols": ["OPC_UA"],
        "services": [
          {
            "port": 4840,
            "protocol": "OPC_UA",
            "info": "Prosys OPC UA Server",
            "version": "5.4.0"
          }
        ],
        "responseTime": 45,
        "lastSeen": "2024-01-15T10:30:00Z"
      }
    ],
    "summary": {
      "totalScanned": 254,
      "devicesFound": 1,
      "duration": 30000
    }
  }
}
```

### 批量测试

批量测试多个设备或接口。

```http
POST /api/v1/test/batch
Content-Type: application/json

{
  "tests": [
    {
      "name": "OPC UA Server 1",
      "protocol": "OPC_UA",
      "config": {
        "endpoint": "opc.tcp://192.168.1.100:4840"
      }
    },
    {
      "name": "Modbus Device 1",
      "protocol": "MODBUS_TCP",
      "config": {
        "host": "192.168.1.101",
        "port": 502,
        "slaveId": 1
      }
    }
  ],
  "testType": "connect",
  "timeout": 5000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "batchId": "batch-001",
    "results": [
      {
        "name": "OPC UA Server 1",
        "success": true,
        "duration": 1250,
        "data": { /* 测试结果数据 */ }
      },
      {
        "name": "Modbus Device 1",
        "success": false,
        "error": "Connection timeout",
        "duration": 5000
      }
    ],
    "summary": {
      "total": 2,
      "success": 1,
      "failed": 1,
      "duration": 5250
    }
  }
}
```

### 获取测试报告

生成和获取测试报告。

```http
GET /api/v1/test/report/{testId}
```

**查询参数**:
- `format` (可选): 报告格式 (`json`, `pdf`, `excel`)

**响应**:
```json
{
  "success": true,
  "data": {
    "reportId": "report-001",
    "testId": "test-001",
    "format": "json",
    "downloadUrl": "/api/v1/test/report/report-001/download",
    "generated": "2024-01-15T10:30:00Z",
    "expires": "2024-01-16T10:30:00Z"
  }
}
```

## 驱动管理API

### 获取驱动列表

获取已安装的驱动列表。

```http
GET /api/v1/drivers
```

**响应**:
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "id": "opcua-driver-v1",
        "name": "OPC UA Driver",
        "version": "1.2.3",
        "protocol": "OPC_UA",
        "status": "loaded",
        "description": "标准OPC UA协议驱动",
        "author": "ProDB Team",
        "supportedFeatures": ["read", "write", "subscribe", "browse"],
        "configSchema": {
          "type": "object",
          "properties": {
            "endpoint": {
              "type": "string",
              "description": "OPC UA服务器端点"
            },
            "securityPolicy": {
              "type": "string",
              "enum": ["None", "Basic128Rsa15", "Basic256"],
              "default": "None"
            }
          },
          "required": ["endpoint"]
        },
        "lastUpdated": "2024-01-10T08:00:00Z",
        "filePath": "/drivers/opcua-driver.js"
      }
    ]
  }
}
```

### 获取驱动详情

获取指定驱动的详细信息。

```http
GET /api/v1/drivers/{id}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "opcua-driver-v1",
    "name": "OPC UA Driver",
    "version": "1.2.3",
    "protocol": "OPC_UA",
    "status": "loaded",
    "description": "标准OPC UA协议驱动",
    "author": "ProDB Team",
    "license": "MIT",
    "homepage": "https://github.com/prodb/opcua-driver",
    "supportedFeatures": ["read", "write", "subscribe", "browse"],
    "dependencies": {
      "node-opcua": "^2.74.0"
    },
    "configSchema": { /* JSON Schema */ },
    "documentation": "https://docs.prodb.com/drivers/opcua",
    "changelog": [
      {
        "version": "1.2.3",
        "date": "2024-01-10",
        "changes": ["修复连接稳定性问题", "优化性能"]
      }
    ],
    "statistics": {
      "installations": 1250,
      "activeConnections": 45,
      "totalDataPoints": 5000
    }
  }
}
```

### 安装驱动

安装新的驱动。

```http
POST /api/v1/drivers/install
Content-Type: multipart/form-data

{
  "file": "driver-file.zip", // 驱动文件
  "autoLoad": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "driverId": "custom-driver-v1",
    "name": "Custom Protocol Driver",
    "version": "1.0.0",
    "status": "installed",
    "message": "驱动安装成功"
  }
}
```

### 加载/卸载驱动

控制驱动的加载状态。

```http
POST /api/v1/drivers/{id}/control
Content-Type: application/json

{
  "action": "load" // "load", "unload", "reload"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "driverId": "opcua-driver-v1",
    "status": "loaded",
    "message": "驱动加载成功"
  }
}
```

### 更新驱动

更新现有驱动。

```http
PUT /api/v1/drivers/{id}
Content-Type: multipart/form-data

{
  "file": "updated-driver.zip",
  "autoReload": true
}
```

### 删除驱动

删除指定驱动。

```http
DELETE /api/v1/drivers/{id}
```

**查询参数**:
- `force` (可选): 强制删除，即使有活跃连接

## 配置管理API

### 获取配置模板

获取可用的配置模板。

```http
GET /api/v1/config/templates
```

**查询参数**:
- `protocol` (可选): 过滤协议类型

**响应**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "opcua-basic",
        "name": "OPC UA 基础配置",
        "protocol": "OPC_UA",
        "description": "适用于大多数OPC UA服务器的基础配置",
        "config": {
          "endpoint": "opc.tcp://localhost:4840",
          "securityPolicy": "None",
          "subscriptionInterval": 1000,
          "timeout": 5000
        },
        "dataPoints": [
          {
            "nodeId": "ns=2;s=Temperature",
            "name": "温度",
            "enabled": true
          }
        ],
        "tags": ["basic", "temperature", "monitoring"],
        "created": "2024-01-10T08:00:00Z"
      }
    ]
  }
}
```

### 创建配置模板

创建新的配置模板。

```http
POST /api/v1/config/templates
Content-Type: application/json

{
  "name": "自定义OPC UA模板",
  "protocol": "OPC_UA",
  "description": "自定义的OPC UA配置模板",
  "config": {
    "endpoint": "opc.tcp://{{host}}:{{port}}",
    "securityPolicy": "None",
    "subscriptionInterval": 1000
  },
  "variables": [
    {
      "name": "host",
      "type": "string",
      "description": "服务器地址",
      "default": "localhost"
    },
    {
      "name": "port",
      "type": "number",
      "description": "端口号",
      "default": 4840
    }
  ],
  "tags": ["custom", "opcua"]
}
```

### 导出配置

导出接口配置。

```http
GET /api/v1/config/export
```

**查询参数**:
- `interfaces` (可选): 接口ID列表，逗号分隔
- `format` (可选): 导出格式 (`json`, `yaml`, `excel`)
- `includeData` (可选): 是否包含数据点配置

**响应**:
```json
{
  "success": true,
  "data": {
    "exportId": "export-001",
    "format": "json",
    "downloadUrl": "/api/v1/config/export/export-001/download",
    "generated": "2024-01-15T10:30:00Z",
    "expires": "2024-01-16T10:30:00Z",
    "fileSize": 1024
  }
}
```

### 导入配置

导入接口配置。

```http
POST /api/v1/config/import
Content-Type: multipart/form-data

{
  "file": "config-export.json",
  "overwrite": false,
  "validate": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "importId": "import-001",
    "summary": {
      "total": 5,
      "imported": 4,
      "skipped": 1,
      "errors": 0
    },
    "results": [
      {
        "name": "OPC UA Interface 1",
        "status": "imported",
        "id": "opc-ua-003"
      },
      {
        "name": "Existing Interface",
        "status": "skipped",
        "reason": "Interface already exists"
      }
    ]
  }
}
```

## 数据查询API

### 查询实时数据

查询接口的实时数据。

```http
GET /api/v1/data/realtime
```

**查询参数**:
- `interfaces` (可选): 接口ID列表
- `dataPoints` (可选): 数据点ID列表
- `format` (可选): 数据格式 (`json`, `csv`)

**响应**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00Z",
    "interfaces": [
      {
        "id": "opc-ua-001",
        "name": "生产线OPC UA服务器",
        "status": "connected",
        "dataPoints": [
          {
            "id": "ns=2;s=Temperature",
            "name": "温度",
            "value": 25.6,
            "quality": "Good",
            "timestamp": "2024-01-15T10:29:55Z",
            "dataType": "Double",
            "unit": "°C"
          }
        ]
      }
    ]
  }
}
```

### 查询历史数据

查询历史数据（如果配置了数据存储）。

```http
GET /api/v1/data/history
```

**查询参数**:
- `interfaces`: 接口ID列表
- `dataPoints`: 数据点ID列表
- `startTime`: 开始时间 (ISO 8601)
- `endTime`: 结束时间 (ISO 8601)
- `interval` (可选): 数据间隔
- `aggregation` (可选): 聚合方式 (`avg`, `min`, `max`, `sum`)
- `limit` (可选): 最大记录数

**响应**:
```json
{
  "success": true,
  "data": {
    "query": {
      "startTime": "2024-01-15T09:00:00Z",
      "endTime": "2024-01-15T10:00:00Z",
      "interval": "1m"
    },
    "series": [
      {
        "interfaceId": "opc-ua-001",
        "dataPointId": "ns=2;s=Temperature",
        "name": "温度",
        "unit": "°C",
        "data": [
          {
            "timestamp": "2024-01-15T09:00:00Z",
            "value": 25.1,
            "quality": "Good"
          },
          {
            "timestamp": "2024-01-15T09:01:00Z",
            "value": 25.3,
            "quality": "Good"
          }
        ]
      }
    ],
    "pagination": {
      "total": 60,
      "returned": 60
    }
  }
}
```

### 数据统计

获取数据统计信息。

```http
GET /api/v1/data/statistics
```

**查询参数**:
- `interfaces` (可选): 接口ID列表
- `period` (可选): 统计周期 (`1h`, `1d`, `1w`, `1m`)

**响应**:
```json
{
  "success": true,
  "data": {
    "period": "1d",
    "timestamp": "2024-01-15T10:30:00Z",
    "statistics": [
      {
        "interfaceId": "opc-ua-001",
        "name": "生产线OPC UA服务器",
        "dataPoints": 125,
        "totalRecords": 180000,
        "dataRate": {
          "current": 50.5,
          "average": 48.2,
          "peak": 65.0
        },
        "quality": {
          "good": 99.2,
          "uncertain": 0.5,
          "bad": 0.3
        },
        "errors": {
          "total": 12,
          "rate": 0.007
        }
      }
    ]
  }
}
```

## 错误处理

### 错误代码

| 错误代码 | 描述 | HTTP状态码 |
|---------|------|-----------|
| `INVALID_REQUEST` | 请求参数无效 | 400 |
| `UNAUTHORIZED` | 未授权访问 | 401 |
| `FORBIDDEN` | 权限不足 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `CONFLICT` | 资源冲突 | 409 |
| `VALIDATION_ERROR` | 数据验证失败 | 422 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `SERVICE_UNAVAILABLE` | 服务不可用 | 503 |
| `PROTOCOL_ERROR` | 协议错误 | 400 |
| `CONNECTION_ERROR` | 连接错误 | 503 |
| `TIMEOUT_ERROR` | 超时错误 | 408 |
| `DRIVER_ERROR` | 驱动错误 | 500 |

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "接口配置验证失败",
    "details": {
      "field": "config.endpoint",
      "message": "端点URL格式无效",
      "value": "invalid-url"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-12345"
}
```

### 错误处理最佳实践

1. **检查HTTP状态码**: 首先检查HTTP状态码判断请求是否成功
2. **解析错误响应**: 解析JSON响应中的错误信息
3. **错误重试**: 对于临时性错误（5xx），可以实施重试机制
4. **用户友好提示**: 将技术错误转换为用户友好的提示信息
5. **日志记录**: 记录详细的错误信息用于调试

## SDK和示例

### JavaScript SDK

```javascript
// ProDB Collector JavaScript SDK
class ProDBCollectorClient {
    constructor(baseURL, apiKey) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api/v1${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...options.headers
            },
            ...options
        };
        
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }
        
        return data.data;
    }
    
    // 系统状态
    async getStatus() {
        return this.request('/status');
    }
    
    // 接口管理
    async getInterfaces() {
        return this.request('/interfaces');
    }
    
    async createInterface(config) {
        return this.request('/interfaces', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }
    
    async updateInterface(id, config) {
        return this.request(`/interfaces/${id}`, {
            method: 'PUT',
            body: JSON.stringify(config)
        });
    }
    
    async deleteInterface(id) {
        return this.request(`/interfaces/${id}`, {
            method: 'DELETE'
        });
    }
    
    async controlInterface(id, action) {
        return this.request(`/interfaces/${id}/control`, {
            method: 'POST',
            body: JSON.stringify({ action })
        });
    }
    
    // 协议测试
    async testProtocol(config) {
        return this.request('/test/protocol', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }
    
    async scanDevices(config) {
        return this.request('/scan/devices', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }
    
    // 数据查询
    async getRealtimeData(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/data/realtime?${query}`);
    }
    
    async getHistoryData(params) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/data/history?${query}`);
    }
}

// 使用示例
const client = new ProDBCollectorClient('http://localhost:8080', 'your-api-key');

// 获取系统状态
const status = await client.getStatus();
console.log('System status:', status);

// 创建OPC UA接口
const interface = await client.createInterface({
    name: 'Test OPC UA',
    protocol: 'OPC_UA',
    config: {
        endpoint: 'opc.tcp://localhost:4840',
        securityPolicy: 'None'
    }
});

// 启动接口
await client.controlInterface(interface.id, 'start');

// 获取实时数据
const data = await client.getRealtimeData({
    interfaces: interface.id
});
```

### Python SDK

```python
import requests
import json
from typing import Dict, List, Optional

class ProDBCollectorClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        url = f"{self.base_url}/api/v1{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        if not response.ok:
            error_data = response.json()
            raise Exception(error_data.get('error', {}).get('message', 'API request failed'))
        
        return response.json()['data']
    
    def get_status(self) -> Dict:
        """获取系统状态"""
        return self._request('GET', '/status')
    
    def get_interfaces(self) -> Dict:
        """获取接口列表"""
        return self._request('GET', '/interfaces')
    
    def create_interface(self, config: Dict) -> Dict:
        """创建接口"""
        return self._request('POST', '/interfaces', json=config)
    
    def test_protocol(self, config: Dict) -> Dict:
        """测试协议连接"""
        return self._request('POST', '/test/protocol', json=config)
    
    def get_realtime_data(self, **params) -> Dict:
        """获取实时数据"""
        return self._request('GET', '/data/realtime', params=params)

# 使用示例
client = ProDBCollectorClient('http://localhost:8080', 'your-api-key')

# 获取系统状态
status = client.get_status()
print(f"System status: {status['status']}")

# 测试OPC UA连接
test_result = client.test_protocol({
    'protocol': 'OPC_UA',
    'config': {
        'endpoint': 'opc.tcp://localhost:4840',
        'securityPolicy': 'None'
    },
    'testType': 'connect'
})

print(f"Test result: {test_result['result']}")
```

### cURL 示例

```bash
# 获取系统状态
curl -X GET "http://localhost:8080/api/v1/status" \
  -H "Authorization: Bearer YOUR_API_KEY"

# 创建OPC UA接口
curl -X POST "http://localhost:8080/api/v1/interfaces" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test OPC UA Interface",
    "protocol": "OPC_UA",
    "config": {
      "endpoint": "opc.tcp://localhost:4840",
      "securityPolicy": "None"
    }
  }'

# 测试协议连接
curl -X POST "http://localhost:8080/api/v1/test/protocol" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "OPC_UA",
    "config": {
      "endpoint": "opc.tcp://localhost:4840",
      "securityPolicy": "None"
    },
    "testType": "connect"
  }'

# 获取实时数据
curl -X GET "http://localhost:8080/api/v1/data/realtime?interfaces=opc-ua-001" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

这份API文档提供了完整的接口说明和使用示例，开发者可以根据这份文档快速集成和使用ProDB Collector的API功能。