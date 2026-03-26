# ProDB Collector & Platform 架构优化执行方案

> 版本: v1.0  
> 日期: 2026-03-13  
> 状态: 待评审

---

## 目录

1. [执行摘要](#一执行摘要)
2. [优化范围与目标](#二优化范围与目标)
3. [详细设计方案](#三详细设计方案)
4. [数据库变更](#四数据库变更)
5. [API接口规范](#五api接口规范)
6. [代码实现规划](#六代码实现规划)
7. [实施路线图](#七实施路线图)
8. [风险评估与回滚方案](#八风险评估与回滚方案)

---

## 一、执行摘要

### 1.1 核心问题

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 配置管理分散 | Platform和Collector同时维护配置，易不一致 | P0 |
| 边缘预处理不足 | 缺少压缩、聚合、边缘告警能力 | P1 |
| 数据流不够灵活 | 无法支持边缘直连TDengine模式 | P2 |

### 1.2 优化目标

1. **配置单一源**: Platform作为配置的唯一真理源，Collector只读执行
2. **边缘计算增强**: 增加数据压缩、窗口聚合、边缘告警缓存
3. **部署模式灵活**: 支持云-边-端多种部署拓扑

### 1.3 预期收益

- 配置一致性提升至 99.9%
- 网络带宽节省 40-60%（通过边缘压缩和聚合）
- 离线告警响应时间 < 100ms

---

## 二、优化范围与目标

### 2.1 系统边界

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              优化范围                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐      │
│  │   Platform   │◄──────►│   Network    │◄──────►│  Collector   │      │
│  │   (Backend)  │        │              │        │   (Edge)     │      │
│  └──────────────┘        └──────────────┘        └──────────────┘      │
│         ▲                                               │              │
│         │                                               ▼              │
│         │                                        ┌──────────────┐      │
│         └────────────────────────────────────────│  Devices     │      │
│                                                  │ (Modbus/OPC) │      │
│                                                  └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 非优化范围

- TDengine核心功能
- 前端UI框架更换
- 认证鉴权体系重构

---

## 三、详细设计方案

### 3.1 配置统一管理方案

#### 3.1.1 当前问题分析

```go
// 当前 Collector 配置（config.json）
{
  "collector_id": "col-001",
  "collection_tasks": [
    {
      "task_id": "task-001",
      "data_points": [
        {"name": "temperature", "address": "40001"}  // ❌ 本地硬编码
      ]
    }
  ]
}

// 当前 Platform Interface 表
interface {
  id,
  collector_id,
  config: "{\"points\":[{...}]}"  // ❌ 可能与Collector配置不一致
}
```

**问题**: 同一采集点的配置可能在两个地方维护，容易产生差异。

#### 3.1.2 目标架构

```
┌────────────────────────────────────────────────────────────────┐
│                      配置统一管理架构                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Platform (唯一配置源)                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ Collectors  │  │ Interfaces  │  │ CollectionTasks │  │   │
│  │  │   表        │  │   表        │  │    表           │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  │         │                │                  │            │   │
│  │         └────────────────┴──────────────────┘            │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │              ┌─────────────────────┐                     │   │
│  │              │  Config Assembler   │                     │   │
│  │              │  (配置组装服务)      │                     │   │
│  │              └─────────────────────┘                     │   │
│  │                          │                               │   │
│  └──────────────────────────┼───────────────────────────────┘   │
│                             │                                   │
│                             ▼ /api/v1/collectors/{id}/config    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Collector (只读缓存)                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ Config Cache│  │   Runtime   │  │   Executor      │  │   │
│  │  │  (SQLite)   │  │   Engine    │  │  (Protocol)     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  │         ▲                                                │   │
│  │         │ Pull / Sync                                    │   │
│  └─────────┴────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### 3.1.3 数据模型设计

**新增表: collector_interfaces**（替代现有 interfaces 表）

```sql
-- 采集器接口配置表（Platform 端）
CREATE TABLE collector_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) NOT NULL,  -- modbus_tcp, modbus_rtu, opcua, mqtt
    enabled BOOLEAN DEFAULT true,
    
    -- 连接配置 (JSONB)
    connection_config JSONB NOT NULL DEFAULT '{}',
    -- 示例: modbus_tcp: {"host": "192.168.1.1", "port": 502}
    -- 示例: opcua: {"endpoint": "opc.tcp://...", "security_mode": "SignAndEncrypt"}
    
    -- 采集点配置 (JSONB数组)
    data_points JSONB NOT NULL DEFAULT '[]',
    -- 示例: [
    --   {"name": "temp", "address": "40001", "data_type": "float32", 
    --    "scale": 0.1, "unit": "°C", "collection_interval": 1000},
    --   {"name": "pressure", "address": "40002", "data_type": "int32"}
    -- ]
    
    -- 边缘预处理配置
    edge_processing JSONB DEFAULT '{}',
    -- 示例: {"compression": true, "aggregation": "1m_avg", "edge_alerts": true}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(collector_id, name)
);

-- 配置版本历史表（用于追踪变更）
CREATE TABLE interface_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id),
    version INTEGER NOT NULL,
    config_snapshot JSONB NOT NULL,
    change_summary TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置下发状态追踪表
CREATE TABLE config_delivery_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id),
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id),
    config_version INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, delivered, applied, failed
    delivered_at TIMESTAMP,
    applied_at TIMESTAMP,
    error_message TEXT,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Collector 本地缓存表**（SQLite）

```sql
-- Collector 本地只读缓存
CREATE TABLE config_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value BLOB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 采集任务运行时状态
CREATE TABLE task_runtime_status (
    interface_id VARCHAR(255) PRIMARY KEY,
    last_execution TIMESTAMP,
    last_success TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    is_healthy BOOLEAN DEFAULT true
);
```

#### 3.1.4 配置下发流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     配置下发序列图                                │
└─────────────────────────────────────────────────────────────────┘

Platform                    Collector                    Device
   │                            │                           │
   │◄──── 1. 配置变更 ──────────┤                           │
   │                            │                           │
   │  2. 生成配置快照            │                           │
   │  3. 计算 checksum           │                           │
   │  4. 写入 config_delivery_status (pending)               │
   │                            │                           │
   │───────────────────────────►│                           │
   │   5. POST /config/sync     │                           │
   │   {config, version, checksum}                           │
   │                            │                           │
   │                            │  6. 验证 checksum         │
   │                            │  7. 写入 config_cache     │
   │                            │  8. 热重载配置            │
   │                            │                           │
   │◄───────────────────────────│                           │
   │   9. 返回 {status: "applied", version}                  │
   │                            │                           │
   │  10. 更新 config_delivery_status (applied)              │
   │                            │                           │
   │                            │  11. 按新配置采集 ────────►│
   │                            │                           │
   │◄───────────────────────────│◄──────────────────────────│
   │   12. 上报数据              │   数据                   │
```

#### 3.1.5 配置冲突解决机制

```go
// collector/internal/config/config_manager.go

type ConfigManager struct {
    localVersion  int64
    remoteVersion int64
    cache         *ConfigCache
    platformClient *communication.PlatformClient
}

// SyncConfiguration 配置同步（带冲突检测）
func (cm *ConfigManager) SyncConfiguration() error {
    // 1. 获取本地配置版本
    localVersion := cm.cache.GetVersion()
    
    // 2. 请求平台配置
    remoteConfig, err := cm.platformClient.FetchConfiguration(localVersion)
    if err != nil {
        return fmt.Errorf("fetch remote config failed: %w", err)
    }
    
    // 3. 版本冲突检测
    if remoteConfig.Version < localVersion {
        // 平台版本比本地还旧，可能是平台回滚或数据错误
        log.Warn("Remote config version is older than local, ignoring")
        return nil
    }
    
    if remoteConfig.Version == localVersion {
        // 版本一致，无需更新
        return nil
    }
    
    // 4. 校验 checksum
    calculatedChecksum := cm.calculateChecksum(remoteConfig.Config)
    if calculatedChecksum != remoteConfig.Checksum {
        return fmt.Errorf("config checksum mismatch")
    }
    
    // 5. 原子性更新本地缓存
    if err := cm.cache.UpdateAtomic(remoteConfig); err != nil {
        return fmt.Errorf("update local cache failed: %w", err)
    }
    
    // 6. 通知各模块热重载
    cm.notifyReload(remoteConfig)
    
    // 7. 确认应用到平台
    return cm.platformClient.ConfirmConfigurationApplied(remoteConfig.Version)
}
```

---

### 3.2 边缘预处理增强方案

#### 3.2.1 新增模块架构

```
collector/internal/
├── preprocessing/           # 新增: 边缘预处理模块
│   ├── compressor.go        # 数据压缩
│   ├── aggregator.go        # 窗口聚合
│   ├── filter.go            # 数据过滤
│   ├── edge_alerts.go       # 边缘告警
│   └── manager.go           # 预处理管理器
├── protocol/
├── validation/
└── ...
```

#### 3.2.2 数据压缩模块

**需求**: 减少网络传输量，特别是高频采集场景。

```go
// preprocessing/compressor.go

package preprocessing

// CompressionAlgorithm 压缩算法类型
type CompressionAlgorithm string

const (
    CompressionDeadband    CompressionAlgorithm = "deadband"      // 死区压缩
    CompressionSwingingDoor CompressionAlgorithm = "swinging_door" // 摇摆门算法
    CompressionChangeRate  CompressionAlgorithm = "change_rate"   // 变化率压缩
)

// DeadbandCompressor 死区压缩器
type DeadbandCompressor struct {
    lastSentValue float64
    lastSentTime  time.Time
    threshold     float64  // 死区阈值 (如: 0.5 表示变化小于0.5时不发送)
    minInterval   time.Duration  // 最小发送间隔
    maxInterval   time.Duration  // 最大发送间隔（强制发送）
}

// Compress 执行死区压缩
func (dc *DeadbandCompressor) Compress(point *DataPoint) (*DataPoint, bool) {
    now := time.Now()
    
    // 检查最大间隔（强制发送）
    if now.Sub(dc.lastSentTime) >= dc.maxInterval {
        dc.lastSentValue = point.Value
        dc.lastSentTime = now
        return point, true
    }
    
    // 检查最小间隔
    if now.Sub(dc.lastSentTime) < dc.minInterval {
        return nil, false
    }
    
    // 死区判断
    if math.Abs(point.Value-dc.lastSentValue) < dc.threshold {
        return nil, false  // 在死区内，丢弃
    }
    
    dc.lastSentValue = point.Value
    dc.lastSentTime = now
    return point, true
}
```

**配置示例**:
```json
{
  "data_points": [
    {
      "name": "temperature",
      "address": "40001",
      "compression": {
        "enabled": true,
        "algorithm": "deadband",
        "threshold": 0.5,
        "min_interval_ms": 1000,
        "max_interval_ms": 30000
      }
    }
  ]
}
```

#### 3.2.3 窗口聚合模块

**需求**: 边缘端预聚合，减少上传数据量。

```go
// preprocessing/aggregator.go

package preprocessing

// AggregationFunction 聚合函数类型
type AggregationFunction string

const (
    AggAvg   AggregationFunction = "avg"
    AggMin   AggregationFunction = "min"
    AggMax   AggregationFunction = "max"
    AggSum   AggregationFunction = "sum"
    AggFirst AggregationFunction = "first"
    AggLast  AggregationFunction = "last"
    AggCount AggregationFunction = "count"
)

// WindowAggregator 滑动窗口聚合器
type WindowAggregator struct {
    windowSize   time.Duration
    function     AggregationFunction
    buffer       []DataPoint
    lastEmitTime time.Time
}

// AddPoint 添加数据点
func (wa *WindowAggregator) AddPoint(point DataPoint) (*DataPoint, bool) {
    wa.buffer = append(wa.buffer, point)
    
    // 检查窗口是否满
    if point.Timestamp.Sub(wa.lastEmitTime) >= wa.windowSize {
        return wa.emit()
    }
    
    return nil, false
}

// emit 执行聚合并返回结果
func (wa *WindowAggregator) emit() (*DataPoint, bool) {
    if len(wa.buffer) == 0 {
        return nil, false
    }
    
    var result DataPoint
    result.Timestamp = wa.buffer[len(wa.buffer)-1].Timestamp
    
    switch wa.function {
    case AggAvg:
        result.Value = wa.calculateAvg()
    case AggMin:
        result.Value = wa.calculateMin()
    case AggMax:
        result.Value = wa.calculateMax()
    case AggLast:
        result.Value = wa.buffer[len(wa.buffer)-1].Value
    }
    
    // 清空缓冲区
    wa.buffer = wa.buffer[:0]
    wa.lastEmitTime = result.Timestamp
    
    return &result, true
}
```

**配置示例**:
```json
{
  "data_points": [
    {
      "name": "vibration",
      "address": "40010",
      "sampling_interval_ms": 100,    // 每100ms采集
      "aggregation": {
        "enabled": true,
        "window": "1m",               // 1分钟窗口
        "function": "avg",            // 计算平均值
        "emit_on_change": false       // 即使值变化也等窗口满
      }
    }
  ]
}
```

#### 3.2.4 边缘告警模块

**需求**: 离线时本地告警缓存，恢复后批量上报。

```go
// preprocessing/edge_alerts.go

package preprocessing

// EdgeAlertRule 边缘告警规则
type EdgeAlertRule struct {
    RuleID      string
    PointName   string
    Condition   AlertCondition  // >, <, =, !=, between
    Threshold   float64
    Duration    time.Duration   // 持续时间（如：连续5秒超过阈值）
    Severity    string          // info, warning, critical
}

// EdgeAlertManager 边缘告警管理器
type EdgeAlertManager struct {
    rules        []EdgeAlertRule
    stateCache   map[string]*AlertState  // 点名称 -> 告警状态
    pendingQueue []EdgeAlertEvent        // 待上报的告警
    storage      *storage.StorageCache   // 本地持久化
}

// Evaluate 评估数据点是否触发告警
func (eam *EdgeAlertManager) Evaluate(point DataPoint) {
    for _, rule := range eam.rules {
        if rule.PointName != point.Name {
            continue
        }
        
        triggered := eam.evaluateCondition(point.Value, rule)
        state := eam.stateCache[point.Name]
        
        if triggered {
            if state == nil {
                // 新告警
                state = &AlertState{
                    RuleID:      rule.RuleID,
                    FirstTrigger: point.Timestamp,
                    LastTrigger:  point.Timestamp,
                }
                eam.stateCache[point.Name] = state
            } else {
                state.LastTrigger = point.Timestamp
                
                // 检查是否达到持续时间
                if point.Timestamp.Sub(state.FirstTrigger) >= rule.Duration {
                    if !state.Alerting {
                        // 触发告警
                        state.Alerting = true
                        alert := EdgeAlertEvent{
                            RuleID:    rule.RuleID,
                            PointName: point.Name,
                            Value:     point.Value,
                            Severity:  rule.Severity,
                            Timestamp: point.Timestamp,
                        }
                        eam.raiseAlert(alert)
                    }
                }
            }
        } else {
            if state != nil && state.Alerting {
                // 告警恢复
                state.Alerting = false
                recovery := EdgeAlertEvent{
                    RuleID:      rule.RuleID,
                    PointName:   point.Name,
                    EventType:   "recovery",
                    Timestamp:   point.Timestamp,
                }
                eam.raiseAlert(recovery)
            }
            delete(eam.stateCache, point.Name)
        }
    }
}

// raiseAlert 触发告警（本地缓存或上报）
func (eam *EdgeAlertManager) raiseAlert(alert EdgeAlertEvent) {
    if eam.isNetworkOnline() {
        // 网络在线，直接上报
        eam.reportAlert(alert)
    } else {
        // 网络离线，持久化到本地
        eam.pendingQueue = append(eam.pendingQueue, alert)
        eam.storage.SavePendingAlert(alert)
    }
}

// SyncPendingAlerts 同步离线期间的告警
func (eam *EdgeAlertManager) SyncPendingAlerts() error {
    if !eam.isNetworkOnline() {
        return nil
    }
    
    alerts := eam.storage.GetPendingAlerts()
    for _, alert := range alerts {
        if err := eam.reportAlert(alert); err != nil {
            return err
        }
        eam.storage.DeletePendingAlert(alert.ID)
    }
    
    eam.pendingQueue = eam.pendingQueue[:0]
    return nil
}
```

---

## 四、数据库变更

### 4.1 Platform 数据库变更（PostgreSQL）

```sql
-- ============================================
-- 迁移脚本: 001_config_unification.sql
-- 日期: 2026-03-13
-- ============================================

-- 1. 创建新的采集器接口配置表
CREATE TABLE collector_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) NOT NULL CHECK (protocol IN ('modbus_tcp', 'modbus_rtu', 'opcua', 'mqtt')),
    enabled BOOLEAN DEFAULT true,
    
    -- 连接配置
    connection_config JSONB NOT NULL DEFAULT '{}',
    
    -- 采集点配置
    data_points JSONB NOT NULL DEFAULT '[]',
    
    -- 边缘预处理配置
    edge_processing JSONB DEFAULT '{
        "compression": {"enabled": false},
        "aggregation": {"enabled": false},
        "edge_alerts": {"enabled": false}
    }',
    
    -- 采集调度配置
    schedule_config JSONB DEFAULT '{
        "mode": "interval",
        "interval_ms": 1000
    }',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(collector_id, name)
);

-- 2. 创建配置版本历史表
CREATE TABLE interface_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    config_snapshot JSONB NOT NULL,
    change_summary TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(interface_id, version)
);

-- 3. 创建配置下发状态表
CREATE TABLE config_delivery_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    interface_id UUID REFERENCES collector_interfaces(id) ON DELETE SET NULL,
    config_version INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'delivered', 'applied', 'failed', 'rollback')),
    delivered_at TIMESTAMP,
    applied_at TIMESTAMP,
    error_message TEXT,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建索引
CREATE INDEX idx_collector_interfaces_collector_id ON collector_interfaces(collector_id);
CREATE INDEX idx_config_delivery_status_collector_id ON config_delivery_status(collector_id);
CREATE INDEX idx_config_delivery_status_status ON config_delivery_status(status);
CREATE INDEX idx_interface_config_history_interface_id ON interface_config_history(interface_id);

-- 5. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collector_interfaces_updated_at 
    BEFORE UPDATE ON collector_interfaces 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_delivery_status_updated_at 
    BEFORE UPDATE ON config_delivery_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 数据迁移（从旧表迁移）
-- 将现有的 interfaces 表数据迁移到新表
INSERT INTO collector_interfaces (
    collector_id, name, protocol, enabled, connection_config, created_at, updated_at
)
SELECT 
    collector_id,
    name,
    type as protocol,
    true as enabled,
    config::jsonb as connection_config,
    created_at,
    updated_at
FROM interfaces;

-- 7. 可选: 软删除旧表（确认迁移成功后执行）
-- ALTER TABLE interfaces RENAME TO interfaces_old;
```

### 4.2 Collector 数据库变更（SQLite）

```sql
-- ============================================
-- 迁移脚本: collector_config_cache.sql
-- ============================================

-- 1. 创建配置缓存表（替代原有的配置存储）
CREATE TABLE IF NOT EXISTS config_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_type VARCHAR(50) NOT NULL,  -- 'interfaces', 'global', 'alerts'
    config_key VARCHAR(255) NOT NULL,
    config_value BLOB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,  -- 缓存过期时间
    
    UNIQUE(config_type, config_key)
);

-- 2. 创建索引
CREATE INDEX idx_config_cache_type ON config_cache(config_type);
CREATE INDEX idx_config_cache_version ON config_cache(version);

-- 3. 创建任务运行时状态表
CREATE TABLE IF NOT EXISTS task_runtime_status (
    interface_id VARCHAR(255) PRIMARY KEY,
    task_state VARCHAR(20) DEFAULT 'stopped',  -- stopped, running, error
    last_execution TIMESTAMP,
    last_success TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    is_healthy BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建边缘告警缓存表（离线告警持久化）
CREATE TABLE IF NOT EXISTS pending_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id VARCHAR(255) NOT NULL,
    rule_id VARCHAR(255) NOT NULL,
    point_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL,  -- 'trigger', 'recovery'
    severity VARCHAR(20) NOT NULL,
    value REAL,
    threshold REAL,
    timestamp TIMESTAMP NOT NULL,
    reported BOOLEAN DEFAULT false,
    report_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_alerts_reported ON pending_alerts(reported);
CREATE INDEX idx_pending_alerts_timestamp ON pending_alerts(timestamp);

-- 5. 创建压缩状态表（死区压缩需要记住最后发送的值）
CREATE TABLE IF NOT EXISTS compression_state (
    point_key VARCHAR(255) PRIMARY KEY,  -- interface_id.point_name
    last_sent_value REAL,
    last_sent_time TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 五、API接口规范

### 5.1 配置管理接口

#### 5.1.1 获取采集器完整配置

```http
GET /api/v1/collectors/{collector_id}/config
Authorization: Bearer {token}
X-Collector-ID: {collector_id}
X-Collector-Secret: {secret}
```

**响应**:
```json
{
  "version": 15,
  "checksum": "sha256:abc123...",
  "generated_at": "2026-03-13T10:30:00Z",
  "global_config": {
    "heartbeat_interval": 60,
    "data_sync_interval": 300
  },
  "interfaces": [
    {
      "id": "iface-001",
      "name": "PLC-Line1",
      "protocol": "modbus_tcp",
      "enabled": true,
      "connection": {
        "host": "192.168.1.100",
        "port": 502,
        "timeout_ms": 5000
      },
      "data_points": [
        {
          "name": "temperature",
          "address": "40001",
          "data_type": "float32",
          "scale": 0.1,
          "offset": 0,
          "unit": "°C",
          "sampling_interval_ms": 1000,
          "compression": {
            "enabled": true,
            "algorithm": "deadband",
            "threshold": 0.5,
            "max_interval_ms": 30000
          },
          "aggregation": {
            "enabled": false
          }
        }
      ]
    }
  ],
  "edge_alerts": [
    {
      "rule_id": "alert-001",
      "point_name": "temperature",
      "condition": "gt",
      "threshold": 100.0,
      "duration_ms": 5000,
      "severity": "critical"
    }
  ]
}
```

#### 5.1.2 增量配置同步

```http
GET /api/v1/collectors/{collector_id}/config/delta?since_version=10
```

**响应**（仅返回变更部分）:
```json
{
  "base_version": 10,
  "target_version": 15,
  "changes": [
    {
      "op": "replace",
      "path": "/interfaces/0/data_points/0/threshold",
      "value": 0.3
    },
    {
      "op": "add",
      "path": "/interfaces/0/data_points/-",
      "value": {
        "name": "pressure",
        "address": "40002"
      }
    }
  ],
  "checksum": "sha256:xyz789..."
}
```

#### 5.1.3 配置应用确认

```http
POST /api/v1/collectors/{collector_id}/config/confirm
Content-Type: application/json

{
  "version": 15,
  "applied_at": "2026-03-13T10:30:05Z",
  "status": "success",
  "interface_states": [
    {
      "interface_id": "iface-001",
      "state": "running",
      "error_message": null
    }
  ]
}
```

### 5.2 接口管理接口（Platform 端）

#### 5.2.1 创建接口配置

```http
POST /api/v1/collectors/{collector_id}/interfaces
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "PLC-Line1",
  "protocol": "modbus_tcp",
  "connection_config": {
    "host": "192.168.1.100",
    "port": 502,
    "timeout_ms": 5000,
    "retry_count": 3
  },
  "data_points": [
    {
      "name": "temperature",
      "address": "40001",
      "data_type": "float32",
      "scale": 0.1,
      "unit": "°C",
      "sampling_interval_ms": 1000,
      "compression": {
        "enabled": true,
        "algorithm": "deadband",
        "threshold": 0.5
      }
    },
    {
      "name": "pressure",
      "address": "40002",
      "data_type": "int32",
      "unit": "Pa",
      "sampling_interval_ms": 2000
    }
  ],
  "edge_processing": {
    "compression": {"enabled": true},
    "aggregation": {"enabled": false},
    "edge_alerts": {"enabled": true}
  }
}
```

#### 5.2.2 更新接口配置（触发配置下发）

```http
PUT /api/v1/collectors/{collector_id}/interfaces/{interface_id}
Content-Type: application/json

{
  "data_points": [
    {
      "name": "temperature",
      "threshold": 0.3  // 修改死区阈值
    }
  ]
}
```

**响应**:
```json
{
  "interface_id": "iface-001",
  "new_version": 16,
  "delivery_status": {
    "status": "pending",
    "estimated_delivery": "2026-03-13T10:31:00Z"
  }
}
```

#### 5.2.3 获取配置下发状态

```http
GET /api/v1/collectors/{collector_id}/config/delivery-status
```

**响应**:
```json
{
  "collector_id": "col-001",
  "current_version": 16,
  "applied_version": 15,
  "sync_status": "syncing",
  "interfaces": [
    {
      "interface_id": "iface-001",
      "target_version": 16,
      "applied_version": 15,
      "status": "pending",
      "last_error": null
    }
  ]
}
```

### 5.3 边缘告警接口

#### 5.3.1 批量上报边缘告警

```http
POST /api/v1/collectors/{collector_id}/alerts/batch
Content-Type: application/json

{
  "alerts": [
    {
      "rule_id": "alert-001",
      "point_name": "temperature",
      "event_type": "trigger",
      "severity": "critical",
      "value": 105.5,
      "threshold": 100.0,
      "timestamp": "2026-03-13T10:25:00Z",
      "edge_timestamp": "2026-03-13T10:25:00Z"  // 边缘触发时间
    },
    {
      "rule_id": "alert-001",
      "point_name": "temperature",
      "event_type": "recovery",
      "value": 98.0,
      "timestamp": "2026-03-13T10:28:00Z"
    }
  ],
  "batch_info": {
    "total_count": 2,
    "offline_generated": true,
    "time_range_start": "2026-03-13T10:25:00Z",
    "time_range_end": "2026-03-13T10:28:00Z"
  }
}
```

---

## 六、代码实现规划

### 6.1 新增/修改文件清单

#### Platform (Backend)

```
platform/backend/
├── handlers/
│   ├── interface_config_handler.go      # 新增: 接口配置管理
│   ├── config_delivery_handler.go       # 修改: 配置下发增强
│   └── edge_alert_handler.go            # 新增: 边缘告警接收
├── models/
│   ├── collector_interface.go           # 新增: 采集器接口模型
│   ├── config_delivery.go               # 新增: 配置下发状态模型
│   └── edge_alert.go                    # 新增: 边缘告警模型
├── services/
│   ├── interface_config_service.go      # 新增: 接口配置服务
│   ├── config_assembler.go              # 新增: 配置组装服务
│   └── config_delivery_service.go       # 新增: 配置下发服务
├── dto/
│   ├── interface_config_dto.go          # 新增: 接口配置DTO
│   └── config_delivery_dto.go           # 新增: 配置下发DTO
└── migrations/
    └── 001_config_unification.sql       # 新增: 数据库迁移脚本
```

#### Collector

```
collector/internal/
├── config/
│   ├── manager.go                       # 修改: 配置管理器（从远端拉取）
│   ├── cache.go                         # 新增: 本地配置缓存
│   └── sync.go                          # 新增: 配置同步逻辑
├── preprocessing/
│   ├── manager.go                       # 新增: 预处理管理器
│   ├── compressor.go                    # 新增: 压缩器
│   ├── aggregator.go                    # 新增: 聚合器
│   ├── filter.go                        # 新增: 过滤器
│   └── edge_alerts.go                   # 新增: 边缘告警
├── protocol/
│   └── manager.go                       # 修改: 集成预处理
├── core/
│   └── collector.go                     # 修改: 初始化预处理模块
└── storage/
    └── alert_cache.go                   # 新增: 告警缓存存储
```

### 6.2 关键代码实现

#### 6.2.1 Platform - 配置组装服务

```go
// platform/backend/services/config_assembler.go

package services

// ConfigAssembler 配置组装服务
type ConfigAssembler struct {
    interfaceRepo  *repos.InterfaceRepository
    alertRuleRepo  *repos.AlertRuleRepository
}

// AssembleCollectorConfig 组装采集器完整配置
func (ca *ConfigAssembler) AssembleCollectorConfig(collectorID uuid.UUID) (*CollectorConfig, error) {
    // 1. 获取所有接口配置
    interfaces, err := ca.interfaceRepo.GetByCollectorID(collectorID)
    if err != nil {
        return nil, err
    }
    
    // 2. 获取边缘告警规则
    alertRules, err := ca.alertRuleRepo.GetEdgeRulesByCollectorID(collectorID)
    if err != nil {
        return nil, err
    }
    
    // 3. 组装配置
    config := &CollectorConfig{
        Version: ca.generateVersion(),
        GlobalConfig: GlobalConfig{
            HeartbeatInterval: 60,
            DataSyncInterval:  300,
        },
        Interfaces:  ca.assembleInterfaces(interfaces),
        EdgeAlerts:  ca.assembleEdgeAlerts(alertRules),
    }
    
    // 4. 计算校验和
    config.Checksum = ca.calculateChecksum(config)
    
    return config, nil
}

// CalculateDelta 计算配置差异（用于增量同步）
func (ca *ConfigAssembler) CalculateDelta(
    collectorID uuid.UUID, 
    sinceVersion int64,
) (*ConfigDelta, error) {
    // 获取基础版本配置快照
    baseSnapshot, err := ca.getSnapshot(collectorID, sinceVersion)
    if err != nil {
        return nil, err
    }
    
    // 获取当前完整配置
    currentConfig, err := ca.AssembleCollectorConfig(collectorID)
    if err != nil {
        return nil, err
    }
    
    // 计算 JSON Patch 差异
    patch, err := jsondiff.Compare(baseSnapshot, currentConfig)
    if err != nil {
        return nil, err
    }
    
    return &ConfigDelta{
        BaseVersion:    sinceVersion,
        TargetVersion:  currentConfig.Version,
        Changes:        patch,
        Checksum:       currentConfig.Checksum,
    }, nil
}
```

#### 6.2.2 Collector - 配置管理器

```go
// collector/internal/config/manager.go

package config

// Manager 配置管理器
type Manager struct {
    localCache      *Cache
    platformClient  *communication.PlatformClient
    currentVersion  int64
    mu              sync.RWMutex
    reloadCallbacks []func(*CollectorConfig)
}

// Start 启动配置管理器
func (m *Manager) Start(ctx context.Context) error {
    // 1. 从本地缓存加载配置
    if err := m.loadFromCache(); err != nil {
        log.Warn("Failed to load config from cache, will fetch from platform")
    }
    
    // 2. 立即同步一次配置
    if err := m.SyncConfiguration(); err != nil {
        return fmt.Errorf("initial config sync failed: %w", err)
    }
    
    // 3. 启动定时同步协程
    go m.syncRoutine(ctx)
    
    return nil
}

// SyncConfiguration 同步配置
func (m *Manager) SyncConfiguration() error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 获取当前版本
    currentVersion := m.currentVersion
    
    // 2. 尝试增量同步
    delta, err := m.platformClient.FetchConfigDelta(currentVersion)
    if err != nil {
        // 增量同步失败，尝试全量同步
        log.Warn("Delta sync failed, falling back to full sync", "error", err)
        return m.fullSync()
    }
    
    if delta == nil || len(delta.Changes) == 0 {
        // 无变更
        return nil
    }
    
    // 3. 应用增量变更
    newConfig, err := m.applyDelta(delta)
    if err != nil {
        return fmt.Errorf("apply delta failed: %w", err)
    }
    
    // 4. 验证校验和
    if !m.verifyChecksum(newConfig, delta.Checksum) {
        // 校验失败，回退到全量同步
        return m.fullSync()
    }
    
    // 5. 原子更新
    if err := m.updateConfigAtomic(newConfig); err != nil {
        return err
    }
    
    // 6. 通知热重载
    m.notifyReload(newConfig)
    
    // 7. 确认应用到平台
    return m.platformClient.ConfirmConfigApplied(newConfig.Version)
}

// fullSync 全量同步
func (m *Manager) fullSync() error {
    config, err := m.platformClient.FetchFullConfig()
    if err != nil {
        return fmt.Errorf("fetch full config failed: %w", err)
    }
    
    if err := m.updateConfigAtomic(config); err != nil {
        return err
    }
    
    m.notifyReload(config)
    return m.platformClient.ConfirmConfigApplied(config.Version)
}

// updateConfigAtomic 原子更新配置
func (m *Manager) updateConfigAtomic(config *CollectorConfig) error {
    // 1. 保存到缓存
    if err := m.localCache.Save(config); err != nil {
        return fmt.Errorf("save to cache failed: %w", err)
    }
    
    // 2. 更新当前版本
    m.currentVersion = config.Version
    
    return nil
}
```

#### 6.2.3 Collector - 预处理管理器

```go
// collector/internal/preprocessing/manager.go

package preprocessing

// Manager 预处理管理器
type Manager struct {
    compressors   map[string]Compressor  // point_key -> compressor
    aggregators   map[string]Aggregator  // point_key -> aggregator
    alertManager  *EdgeAlertManager
    mu            sync.RWMutex
}

// NewManager 创建预处理管理器
func NewManager(config *PreprocessingConfig, storage *storage.StorageCache) *Manager {
    m := &Manager{
        compressors:  make(map[string]Compressor),
        aggregators:  make(map[string]Aggregator),
        alertManager: NewEdgeAlertManager(config.EdgeAlerts, storage),
    }
    
    // 根据配置初始化各点的预处理器
    m.initializeFromConfig(config)
    
    return m
}

// Process 处理数据点
func (m *Manager) Process(point *protocol.DataValue) ([]*protocol.DataValue, error) {
    pointKey := fmt.Sprintf("%s.%s", point.DeviceID, point.PointName)
    
    // 1. 边缘告警评估
    m.alertManager.Evaluate(*point)
    
    // 2. 压缩处理
    if compressor, exists := m.compressors[pointKey]; exists {
        compressed, shouldSend := compressor.Compress(point)
        if !shouldSend {
            return nil, nil  // 被压缩丢弃
        }
        point = compressed
    }
    
    // 3. 聚合处理
    if aggregator, exists := m.aggregators[pointKey]; exists {
        result, hasResult := aggregator.AddPoint(*point)
        if !hasResult {
            return nil, nil  // 窗口未满，等待聚合
        }
        point = result
    }
    
    return []*protocol.DataValue{point}, nil
}

// ProcessBatch 批量处理（用于优化性能）
func (m *Manager) ProcessBatch(points []*protocol.DataValue) ([]*protocol.DataValue, error) {
    results := make([]*protocol.DataValue, 0, len(points))
    
    for _, point := range points {
        processed, err := m.Process(point)
        if err != nil {
            log.Error("Process point failed", "error", err, "point", point.PointName)
            continue
        }
        if processed != nil {
            results = append(results, processed...)
        }
    }
    
    return results, nil
}

// UpdateConfig 热更新预处理配置
func (m *Manager) UpdateConfig(config *PreprocessingConfig) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 保存旧的压缩状态（用于平滑过渡）
    oldCompressors := m.compressors
    
    // 重新初始化
    m.initializeFromConfig(config)
    
    // 迁移状态（死区压缩需要保持last_sent_value）
    m.migrateCompressionState(oldCompressors)
    
    return nil
}
```

---

## 七、实施路线图

### 7.1 实施阶段规划

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           实施路线图                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  第1阶段: 基础改造 (4周)              第2阶段: 功能增强 (3周)                │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │ Week 1-2                │         │ Week 5-6                │           │
│  │ • 数据库迁移脚本         │         │ • 数据压缩模块          │           │
│  │ • 新数据模型             │         │ • 窗口聚合模块          │           │
│  │ • API接口实现            │         │ • 预处理管理器          │           │
│  │ Week 3-4                │         │ Week 7                  │           │
│  │ • 配置组装服务           │         │ • 边缘告警模块          │           │
│  │ • 配置下发服务           │         │ • 告警缓存持久化        │           │
│  │ • 基础同步逻辑           │         └─────────────────────────┘           │
│  └─────────────────────────┘                                                │
│                                                                             │
│  第3阶段: 集成测试 (2周)              第4阶段: 灰度上线 (2周)                │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │ Week 8-9                │         │ Week 10-11              │           │
│  │ • 单元测试              │         │ • 预发布环境验证        │           │
│  │ • 集成测试              │         │ • 逐步灰度              │           │
│  │ • 性能测试              │         │ • 监控和回滚准备        │           │
│  │ • 文档完善              │         │ • 全量发布              │           │
│  └─────────────────────────┘         └─────────────────────────┘           │
│                                                                             │
│  总计: 11周                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 详细任务分解

#### Phase 1: 基础改造（第1-4周）

| 周次 | 任务 | 负责人 | 交付物 | 验收标准 |
|------|------|--------|--------|----------|
| W1 | 数据库迁移脚本 | DBA | SQL脚本 | 通过评审，可在测试环境执行 |
| W1 | 新数据模型定义 | 后端 | Go structs | 字段完整，包含JSON标签 |
| W2 | API接口实现 | 后端 | Handler代码 | 接口文档匹配，单测通过 |
| W2 | 配置组装服务 | 后端 | Service代码 | 可正确组装完整配置 |
| W3 | 配置下发服务 | 后端 | Service代码 | 支持版本控制和增量同步 |
| W3 | Collector配置缓存 | 边缘端 | Cache模块 | 支持原子更新和持久化 |
| W4 | 配置同步逻辑 | 边缘端 | Sync模块 | 支持全量和增量同步 |
| W4 | 基础集成测试 | 测试 | 测试报告 | 核心流程通过 |

#### Phase 2: 功能增强（第5-7周）

| 周次 | 任务 | 负责人 | 交付物 | 验收标准 |
|------|------|--------|--------|----------|
| W5 | 死区压缩模块 | 边缘端 | Compressor代码 | 压缩率>30%，性能达标 |
| W5 | 窗口聚合模块 | 边缘端 | Aggregator代码 | 支持常用聚合函数 |
| W6 | 预处理管理器 | 边缘端 | Manager代码 | 支持热更新配置 |
| W6 | 边缘告警模块 | 边缘端 | Alert模块 | 支持阈值和持续时间 |
| W7 | 告警缓存持久化 | 边缘端 | Storage模块 | 离线告警不丢失 |
| W7 | 告警上报接口 | 后端 | Handler代码 | 支持批量上报 |

#### Phase 3: 集成测试（第8-9周）

| 周次 | 任务 | 负责人 | 交付物 | 验收标准 |
|------|------|--------|--------|----------|
| W8 | 单元测试完善 | 开发 | 测试代码 | 覆盖率>80% |
| W8 | 集成测试 | 测试 | 测试用例 | 端到端场景通过 |
| W9 | 性能测试 | 测试 | 性能报告 | 满足性能指标 |
| W9 | 文档完善 | 开发 | 技术文档 | 更新架构图和API文档 |

#### Phase 4: 灰度上线（第10-11周）

| 周次 | 任务 | 负责人 | 交付物 | 验收标准 |
|------|------|--------|--------|----------|
| W10 | 预发布验证 | 运维 | 验证报告 | 无P0/P1缺陷 |
| W10 | 灰度发布(10%) | 运维 | 监控数据 | 错误率<0.1% |
| W11 | 灰度发布(50%) | 运维 | 监控数据 | 系统稳定 |
| W11 | 全量发布 | 运维 | 上线报告 | 全部流量切换 |

### 7.3 里程碑检查点

```
M1 (W2结束): 数据库迁移完成，新API可调用
M2 (W4结束): 配置同步功能可用，支持新旧配置切换
M3 (W7结束): 边缘预处理功能完整，可独立运行
M4 (W9结束): 测试通过，准备上线
M5 (W11结束): 全量上线，监控稳定
```

---

## 八、风险评估与回滚方案

### 8.1 风险识别

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 配置同步失败导致采集中断 | 中 | 高 | 保留本地配置备份，支持快速回退 |
| 新配置格式兼容性问题 | 中 | 中 | 双轨运行期，旧配置格式保留 |
| 边缘预处理性能下降 | 低 | 中 | 性能测试基准，超标自动降级 |
| 网络分区时配置不一致 | 中 | 中 | 版本校验机制，冲突时平台优先 |
| 数据丢失 | 低 | 极高 | 完整的数据备份和恢复方案 |

### 8.2 回滚方案

#### 8.2.1 配置层面回滚

```go
// 快速回滚到上一版本配置
func (m *Manager) RollbackToPrevious() error {
    previousVersion := m.currentVersion - 1
    
    // 1. 从配置历史获取上一版本
    config, err := m.localCache.GetVersion(previousVersion)
    if err != nil {
        return err
    }
    
    // 2. 原子更新
    if err := m.updateConfigAtomic(config); err != nil {
        return err
    }
    
    // 3. 通知重载
    m.notifyReload(config)
    
    log.Warn("Config rolled back", 
        "from_version", m.currentVersion,
        "to_version", previousVersion)
    
    return nil
}
```

#### 8.2.2 数据库层面回滚

```sql
-- 紧急回滚脚本
BEGIN;

-- 1. 恢复旧表
DROP TABLE IF EXISTS collector_interfaces;
ALTER TABLE interfaces_old RENAME TO interfaces;

-- 2. 清理新表数据（保留历史）
-- TRUNCATE TABLE config_delivery_status;

COMMIT;
```

#### 8.2.3 灰度回滚策略

```
1. 发现问题 → 立即停止灰度扩大
2. 评估影响 → 判断是否触发回滚
3. 执行回滚 → 
   - 配置层面: 下发旧版本配置
   - 代码层面: 切回旧版本Collector
4. 验证恢复 → 确认采集恢复正常
5. 问题修复 → 修复后重新灰度
```

### 8.3 监控指标

| 指标 | 正常范围 | 告警阈值 | 严重阈值 |
|------|----------|----------|----------|
| 配置同步成功率 | >99.5% | <99% | <95% |
| 配置同步延迟 | <5s | >10s | >30s |
| 数据压缩率 | 30-60% | <20% | - |
| 边缘预处理耗时 | <10ms | >50ms | >100ms |
| 离线告警积压数 | <1000 | >5000 | >10000 |

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| Platform | 中央管理平台，负责配置管理和数据接收 |
| Collector | 边缘采集器，负责数据采集和边缘预处理 |
| Interface | 采集器与设备的连接配置 |
| Data Point | 单个数据采集点 |
| Deadband Compression | 死区压缩，变化小于阈值时不发送 |
| Swinging Door | 摇摆门压缩算法 |
| Edge Alert | 边缘告警，在采集器本地触发的告警 |

### B. 参考文档

- [JSON Patch RFC 6902](https://tools.ietf.org/html/rfc6902)
- [TDengine 数据模型](https://docs.tdengine.com)
- [SQLite 性能优化](https://sqlite.org/optimization.html)

---

**文档历史**

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-03-13 | - | 初始版本 |
| v1.1 | 2026-03-13 | - | 增加前端功能调整方案和Platform模块分析 |

---

## 九、前端功能调整方案

### 9.1 当前前端架构分析

基于对 `platform/frontend` 代码的分析，当前前端结构如下：

```
platform/frontend/
├── App.tsx              # 路由配置
├── components/
│   ├── Layout.tsx       # 布局框架
│   ├── Sidebar.tsx      # 侧边导航（含菜单定义）
│   └── ...
├── pages/               # 页面组件
│   ├── CollectorAgents.tsx      # 采集器列表
│   ├── CollectorConfigs.tsx     # 配置管理
│   ├── CollectorMonitor.tsx     # 监控大屏
│   └── ...
└── ...
```

**当前菜单结构**（来自 Sidebar.tsx）：

| 一级菜单 | 二级菜单 | 对应页面 | 功能说明 |
|----------|----------|----------|----------|
| Dashboard | - | Dashboard | 系统概览 |
| Realtime Explorer | Live Data | RealtimeLive | 实时数据 |
| | Tables & Tags | RealtimeTables | 表和标签管理 |
| | Query Studio | QueryWorkbench | SQL工作台 |
| **Collector** | **Agents** | **CollectorAgents** | **采集器列表** |
| | **Configurations** | **CollectorConfigs** | **配置管理** |
| | **Monitoring** | **CollectorMonitor** | **监控大屏** |
| Data Ingestion | Sources | Ingestion | 数据源管理 |
| Stream Computing | Native Streams | ComputingNative | 流计算 |
| Operations | Cluster | OperationsCluster | 集群运维 |
```

### 9.2 前端功能调整清单

根据架构优化方案，前端需要进行以下调整：

#### 9.2.1 菜单结构调整

```typescript
// Sidebar.tsx 菜单配置更新

const menuItems = [
  // ... 其他菜单保持不变
  
  {
    id: 'collector',
    label: t('nav.collectorManagement'),
    icon: Radio,
    subItems: [
      { id: Page.COLLECTOR_AGENTS, label: t('nav.agents'), icon: Server },
      { id: Page.COLLECTOR_INTERFACES, label: t('nav.interfaces'), icon: Plug },      // 新增
      { id: Page.COLLECTOR_CONFIGS, label: t('nav.configurations'), icon: FileText },
      { id: Page.COLLECTOR_MONITOR, label: t('nav.monitoring'), icon: Activity },
      { id: Page.COLLECTOR_EDGE_ALERTS, label: t('nav.edgeAlerts'), icon: Bell },     // 新增
    ]
  },
  
  // ... 其他菜单
];
```

#### 9.2.2 新增页面清单

| 页面组件 | 路径 | 功能描述 | 优先级 |
|----------|------|----------|--------|
| `CollectorInterfaces.tsx` | `pages/CollectorInterfaces.tsx` | 接口配置管理（替代原配置页面核心功能） | P0 |
| `CollectorInterfaceEdit.tsx` | `pages/CollectorInterfaceEdit.tsx` | 接口配置编辑器（含采集点配置） | P0 |
| `CollectorConfigDelivery.tsx` | `pages/CollectorConfigDelivery.tsx` | 配置下发状态追踪 | P1 |
| `CollectorEdgeAlerts.tsx` | `pages/CollectorEdgeAlerts.tsx` | 边缘告警规则管理 | P1 |
| `CollectorCompressionSettings.tsx` | `pages/CollectorCompressionSettings.tsx` | 数据压缩策略配置 | P2 |

#### 9.2.3 页面功能详细设计

##### 1. CollectorInterfaces（接口管理页）

**功能需求**：
- 展示采集器下的所有接口列表
- 支持按协议类型筛选（Modbus/OPC UA/MQTT）
- 显示接口配置下发状态

**界面原型**：
```
+---------------------------------------------------------------------+
| 采集器接口管理                    [+ 新增接口] [批量下发]            |
+---------------------------------------------------------------------+
| 筛选: [全部 ▼] [协议: 全部 ▼] [状态: 全部 ▼]    [搜索...]            |
+---------------------------------------------------------------------+
|                                                                     |
|  +-------------------------------------------------------------+   |
|  |  | 接口名称      | 协议       | 采集点数 | 状态    | 操作  |   |
|  +--+---------------+------------+----------+---------+-------+   |
|  |  | PLC-Line1     | Modbus TCP | 12       | 已同步   | 设置  |   |
|  |  | OPC-Server-01 | OPC UA     | 45       | 待下发   | 设置  |   |
|  |  | MQTT-Gateway  | MQTT       | 8        | 已同步   | 设置  |   |
|  +-------------------------------------------------------------+   |
|                                                                     |
|  共 3 个接口                                          [1] [2] [3]  |
+---------------------------------------------------------------------+
```

**关键字段**：
```typescript
interface InterfaceListItem {
  id: string;
  name: string;
  protocol: 'modbus_tcp' | 'modbus_rtu' | 'opcua' | 'mqtt';
  dataPointCount: number;
  enabled: boolean;
  deliveryStatus: 'synced' | 'pending' | 'failed';
  lastSyncTime: string;
  collectorId: string;
  collectorName: string;
}
```

##### 2. CollectorInterfaceEdit（接口配置编辑器）

**功能需求**：
- 协议选择向导
- 连接参数配置（协议特定）
- 采集点列表管理（增删改）
- 边缘预处理配置（压缩、聚合）
- 配置版本对比和回滚

**界面结构**：
```
+---------------------------------------------------------------------+
| <- 返回列表                                                        |
| 配置接口: PLC-Line1                                     [保存] [下发]|
+---------------------------------------------------------------------+
|                                                                     |
| [基础配置] [采集点] [预处理] [告警规则]                              |
|                                                                     |
| +-- 基础配置 -----------------------------------------------------+ |
| |                                                                  | |
| |  接口名称: [PLC-Line1                                    ]      | |
| |  协议类型: [Modbus TCP ▼]                                       | |
| |                                                                  | |
| |  -- 连接参数 --                                                   | |
| |  主机地址: [192.168.1.100                                ]      | |
| |  端口:     [502                                          ]      | |
| |  超时(ms): [5000                                         ]      | |
| |                                                                  | |
| +------------------------------------------------------------------+ |
|                                                                     |
| +-- 采集点列表 -------------------------------- [+ 添加采集点] -----+ |
| |                                                                  | |
| | 名称        | 地址      | 数据类型 | 缩放    | 单位 | 采集周期 |  |
| |-------------+-----------+----------+---------+------+----------|  |
| | temperature | 40001     | float32  | 0.1     | C    | 1000ms   |  |
| | pressure    | 40002     | int32    | 1       | Pa   | 2000ms   |  |
| |                                                                  | |
| +------------------------------------------------------------------+ |
|                                                                     |
+---------------------------------------------------------------------+
```

**表单数据结构**：
```typescript
interface InterfaceFormData {
  id?: string;
  name: string;
  protocol: ProtocolType;
  enabled: boolean;
  connection: ModbusConnection | OpcuaConnection | MqttConnection;
  dataPoints: DataPointConfig[];
  edgeProcessing: {
    compression: CompressionConfig;
    aggregation: AggregationConfig;
    edgeAlerts: boolean;
  };
}

interface DataPointConfig {
  name: string;
  address: string;
  dataType: 'int16' | 'int32' | 'float32' | 'float64' | 'bool' | 'string';
  scale: number;
  offset: number;
  unit: string;
  samplingInterval: number;  // ms
  compression?: {
    enabled: boolean;
    algorithm: 'deadband' | 'swinging_door';
    threshold: number;
    maxInterval: number;
  };
  aggregation?: {
    enabled: boolean;
    window: string;  // e.g., "1m"
    function: 'avg' | 'min' | 'max' | 'last';
  };
}
```

##### 3. CollectorConfigDelivery（配置下发状态）

**功能需求**：
- 实时显示配置下发进度
- 下发失败原因展示
- 批量重试功能
- 配置版本历史对比

**界面结构**：
```
+---------------------------------------------------------------------+
| 配置下发状态                                                      |
+---------------------------------------------------------------------+
|                                                                     |
|  +-- 实时状态概览 ---------------------------------------------+   |
|  |  待下发: 2  |  下发中: 1  |  已同步: 15  |  失败: 1         |   |
|  +--------------------------------------------------------------+   |
|                                                                     |
|  [全部] [待下发] [下发中] [已同步] [失败]                           |
|                                                                     |
|  采集器          | 配置版本 | 状态    | 进度   | 时间           |操作|
|  ----------------+----------+---------+--------+----------------+----|
|  Factory-GW-01   | v12      | 已同步   | 100%   | 2分钟前        |详情|
|  Factory-GW-02   | v12      | 下发中   | 65%    | 进行中         |详情|
|  Warehouse-01    | v11->v12 | 失败     | 30%    | 10分钟前       |重试|
|                                                                     |
+---------------------------------------------------------------------+
```

##### 4. CollectorEdgeAlerts（边缘告警规则）

**功能需求**：
- 边缘告警规则CRUD
- 规则与采集点绑定
- 离线告警事件查看

```typescript
interface EdgeAlertRule {
  id: string;
  name: string;
  collectorId: string;
  interfaceId: string;
  pointName: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'between';
  threshold: number;
  thresholdMax?: number;  // for 'between'
  duration: number;  // ms, 持续时间才触发
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}
```

#### 9.2.4 现有页面改造

##### CollectorAgents 改造点

1. **新增列**: 配置版本同步状态
2. **新增操作**:
   - 查看接口列表（跳转到 CollectorInterfaces）
   - 强制同步配置
   - 查看配置下发历史

```typescript
// Agent 列表项扩展
interface Agent {
  id: string;
  name: string;
  // ... 现有字段
  
  // 新增字段
  configSyncStatus: 'synced' | 'syncing' | 'pending' | 'failed';
  appliedVersion: number;
  targetVersion: number;
  interfaceCount: number;
  lastSyncTime: string;
}
```

##### CollectorConfigs 改造点

**建议**: 此页面功能被 CollectorInterfaces 替代，可以：
- 方案A: 重定向到 CollectorInterfaces
- 方案B: 改造为"配置模板管理"页面（全局模板）

推荐 **方案B**，原 CollectorConfigs 改为管理跨采集器的配置模板。

##### CollectorMonitor 改造点

1. **新增图表**:
   - 配置同步成功率趋势
   - 边缘压缩率统计
   - 离线告警事件数

2. **新增面板**:
   - 配置下发失败告警
   - 边缘预处理性能指标

```typescript
// 新增监控指标
interface CollectorMetrics {
  // ... 现有指标
  
  // 新增
  configSyncRate: number;        // 配置同步成功率
  dataCompressionRatio: number;  // 数据压缩率
  edgeAlertCount: number;        // 边缘告警数
  pendingSyncCount: number;      // 待同步配置数
}
```

### 9.3 前端路由更新

```typescript
// App.tsx 路由配置

{/* Collector Management Routes */}
<Route path="/collector" element={<ProtectedRoute element={<Navigate to={`/${Page.COLLECTOR_AGENTS}`} replace />} />} />
<Route path={`/${Page.COLLECTOR_AGENTS}`} element={<ProtectedRoute element={<CollectorAgents />} />} />

{/* 新增路由 */}
<Route path={`/${Page.COLLECTOR_INTERFACES}`} element={<ProtectedRoute element={<CollectorInterfaces />} />} />
<Route path={`/${Page.COLLECTOR_INTERFACES}/new`} element={<ProtectedRoute element={<CollectorInterfaceEdit />} />} />
<Route path={`/${Page.COLLECTOR_INTERFACES}/:id/edit`} element={<ProtectedRoute element={<CollectorInterfaceEdit />} />} />
<Route path={`/${Page.COLLECTOR_CONFIG_DELIVERY}`} element={<ProtectedRoute element={<CollectorConfigDelivery />} />} />
<Route path={`/${Page.COLLECTOR_EDGE_ALERTS}`} element={<ProtectedRoute element={<CollectorEdgeAlerts />} />} />

<Route path={`/${Page.COLLECTOR_CONFIGS}`} element={<ProtectedRoute element={<CollectorConfigs />} />} />
<Route path={`/${Page.COLLECTOR_MONITOR}`} element={<ProtectedRoute element={<CollectorMonitor />} />} />
```

### 9.4 API服务扩展

```typescript
// services/api.ts 新增接口

export const api = {
  // ... 现有接口
  
  // 采集器接口管理
  collectorInterfaces: {
    list: (collectorId: string) =>
      axios.get(`/api/v1/collectors/${collectorId}/interfaces`),
    
    get: (collectorId: string, interfaceId: string) =>
      axios.get(`/api/v1/collectors/${collectorId}/interfaces/${interfaceId}`),
    
    create: (collectorId: string, data: InterfaceFormData) =>
      axios.post(`/api/v1/collectors/${collectorId}/interfaces`, data),
    
    update: (collectorId: string, interfaceId: string, data: InterfaceFormData) =>
      axios.put(`/api/v1/collectors/${collectorId}/interfaces/${interfaceId}`, data),
    
    delete: (collectorId: string, interfaceId: string) =>
      axios.delete(`/api/v1/collectors/${collectorId}/interfaces/${interfaceId}`),
    
    deploy: (collectorId: string, interfaceId: string) =>
      axios.post(`/api/v1/collectors/${collectorId}/interfaces/${interfaceId}/deploy`),
  },
  
  // 配置下发状态
  configDelivery: {
    getStatus: (collectorId: string) =>
      axios.get(`/api/v1/collectors/${collectorId}/config/delivery-status`),
    
    retry: (collectorId: string, interfaceId: string) =>
      axios.post(`/api/v1/collectors/${collectorId}/interfaces/${interfaceId}/retry`),
    
    getHistory: (collectorId: string, params: PaginationParams) =>
      axios.get(`/api/v1/collectors/${collectorId}/config/delivery-history`, { params }),
  },
  
  // 边缘告警
  edgeAlerts: {
    listRules: (collectorId: string) =>
      axios.get(`/api/v1/collectors/${collectorId}/edge-alerts/rules`),
    
    createRule: (collectorId: string, data: EdgeAlertRule) =>
      axios.post(`/api/v1/collectors/${collectorId}/edge-alerts/rules`, data),
    
    getEvents: (collectorId: string, params: EventQueryParams) =>
      axios.get(`/api/v1/collectors/${collectorId}/edge-alerts/events`, { params }),
  },
};
```

### 9.5 前端实施计划

| 周次 | 任务 | 交付物 | 依赖 |
|------|------|--------|------|
| W1 | API服务扩展 | api.ts 更新 | 后端API就绪 |
| W1 | 类型定义更新 | types.ts 更新 | - |
| W2 | CollectorInterfaces页面 | 接口列表页 | API就绪 |
| W2 | CollectorInterfaceEdit页面 | 接口编辑器 | API就绪 |
| W3 | CollectorConfigDelivery页面 | 下发状态页 | 后端Phase 1完成 |
| W3 | CollectorAgents改造 | 列表页增强 | - |
| W4 | CollectorEdgeAlerts页面 | 边缘告警页 | 后端Phase 2完成 |
| W4 | CollectorMonitor增强 | 监控页改造 | - |
| W5 | 菜单和路由更新 | Sidebar.tsx, App.tsx | 所有页面就绪 |
| W5 | 集成测试 | 端到端测试 | - |

---

## 十、Platform功能模块分析与建议

### 10.1 当前功能模块概览

基于代码分析，Platform当前功能模块如下：

```
+---------------------------------------------------------------------+
|                        Platform 功能模块架构                         |
+---------------------------------------------------------------------+
|                                                                     |
|  +-------------+  +-------------+  +-------------+  +------------+  |
|  |  用户权限   |  |  采集器管理  |  |  数据接入   |  |  元数据管理 |  |
|  |  (RBAC)    |  | (Collector) |  | (Ingestion) |  | (Metadata) |  |
|  +-------------+  +-------------+  +-------------+  +------------+  |
|         |                |                |               |          |
|         ▼                ▼                ▼               ▼          |
|  +-------------+  +-------------+  +-------------+  +------------+  |
|  |  流计算     |  |  查询服务   |  |  运维管理   |  |  系统管理   |  |
|  |(Computing) |  |   (Query)   |  |(Operations) |  |  (System)  |  |
|  +-------------+  +-------------+  +-------------+  +------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

### 10.2 模块分析评价

#### 设计合理的模块

| 模块 | 评价 | 理由 |
|------|------|------|
| **用户权限(RBAC)** | 5星 | 标准的RBAC模型，users/roles/permissions三层结构清晰 |
| **采集器管理** | 4星 | 基础功能完整，但缺少配置版本管理和下发追踪 |
| **查询服务** | 5星 | 工作台、API、虚拟视图功能丰富 |
| **运维管理** | 4星 | 集群、节点、告警、日志覆盖全面 |

#### 需要优化的模块

| 模块 | 问题 | 建议 |
|------|------|------|
| **采集器配置** | 配置与采集器耦合过紧，缺乏接口抽象 | 按本方案改造，引入Interface概念 |
| **数据接入** | Ingestion 与 Collector 功能边界模糊 | 明确分工：Collector负责边缘采集，Ingestion负责云侧接入 |
| **流计算** | Native Streams 与 Flink 并存，资源可能冲突 | 统一调度或明确使用场景 |

#### 缺失的关键模块

| 缺失模块 | 重要性 | 说明 |
|----------|--------|------|
| **配置版本管理** | 高 | 配置变更历史、回滚能力 |
| **边缘计算管理** | 高 | 边缘预处理策略配置、压缩/聚合规则 |
| **配置下发编排** | 中 | 灰度下发、批量下发、定时下发 |
| **采集器分组** | 中 | 按工厂、产线等维度分组管理 |
| **配置模板市场** | 低 | 行业模板、社区共享模板 |

### 10.3 功能模块优化建议

#### 建议1: 明确模块边界

```
+---------------------------------------------------------------------+
|                     优化后的模块边界                                |
+---------------------------------------------------------------------+
|                                                                     |
|  +-------------------------------------------------------------+   |
|  |                    边缘层 (Edge)                             |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  |   |  数据采集   |  | 边缘预处理  |  | 边缘告警    |        |   |
|  |   | (Collector) |  |(Compression)|  |(Edge Alerts)|        |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  +-------------------------------------------------------------+   |
|                              |                                      |
|                              ▼ 网络                                  |
|  +-------------------------------------------------------------+   |
|  |                    平台层 (Platform)                         |   |
|  |                                                              |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  |   | 配置管理    |  | 数据接入    |  | 流计算      |        |   |
|  |   |(Interface)  |  | (Ingestion) |  |(Computing)  |        |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  |                                                              |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  |   | 查询服务    |  | 运维管理    |  | 系统管理    |        |   |
|  |   |  (Query)   |  |(Operations) |  |  (System)   |        |   |
|  |   +-------------+  +-------------+  +-------------+        |   |
|  |                                                              |   |
|  +-------------------------------------------------------------+   |
|                                                                     |
+---------------------------------------------------------------------+
```

**边界说明**：
- **Collector**: 只负责执行配置，不负责配置编辑
- **Interface配置**: Platform唯一配置源，支持版本管理和下发追踪
- **Ingestion**: 负责云侧数据接入（如第三方MQTT broker、HTTP推送等）

#### 建议2: 新增核心模块

##### A. 配置中心模块 (Config Center)

```go
// 新增模块: platform/backend/config_center/
config_center/
├── models/
│   ├── interface.go           # 接口配置模型
│   ├── config_version.go      # 配置版本
│   └── delivery_status.go     # 下发状态
├── services/
│   ├── config_assembler.go    # 配置组装
│   ├── config_delivery.go     # 配置下发
│   └── version_control.go     # 版本控制
├── handlers/
│   └── interface_handler.go   # API接口
└── repository/
    └── interface_repo.go      # 数据访问
```

**职责**：
- Interface CRUD
- 配置版本管理
- 配置下发编排
- 配置冲突检测

##### B. 边缘管理模块 (Edge Management)

```go
// 新增模块: platform/backend/edge_management/
edge_management/
├── models/
│   ├── edge_alert_rule.go     # 边缘告警规则
│   ├── compression_policy.go  # 压缩策略
│   └── aggregation_rule.go    # 聚合规则
├── services/
│   ├── edge_alert_service.go
│   └── preprocessing_service.go
└── handlers/
    └── edge_alert_handler.go
```

**职责**：
- 边缘告警规则管理
- 边缘预处理策略配置
- 边缘告警事件接收和展示

#### 建议3: 功能合并与拆分

| 当前设计 | 优化建议 | 理由 |
|----------|----------|------|
| IngestionMapping + CollectorConfig | 统一到 Interface 配置 | 都是采集点映射，避免分散 |
| OperationsAlerts + EdgeAlerts | 分离为云侧告警和边缘告警 | 处理延迟、场景不同 |
| ConfigTemplates（全局） | 保留，增加行业模板分类 | 便于复用 |

### 10.4 数据库表优化建议

```sql
-- 建议新增的核心表

-- 1. 采集器分组表（便于批量管理）
CREATE TABLE collector_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',  -- 如: {"factory": "A", "line": "1"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 配置下发批次表（批量下发追踪）
CREATE TABLE config_delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL,  -- 'single', 'group', 'all'
    target_id UUID,  -- collector_id or group_id
    config_snapshot JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, delivering, completed, failed
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 3. 边缘告警事件表
CREATE TABLE edge_alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id),
    rule_id VARCHAR(255) NOT NULL,
    point_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL,  -- 'trigger', 'recovery'
    severity VARCHAR(20) NOT NULL,
    value REAL,
    threshold REAL,
    edge_timestamp TIMESTAMP NOT NULL,  -- 边缘触发时间
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP
);
```

### 10.5 元数据管理模块深度分析与优化建议

#### 10.5.1 当前元数据模块功能概览

基于前端代码分析，当前元数据管理模块包含以下功能页面：

| 页面 | 文件 | 功能描述 | 当前状态 |
|------|------|----------|----------|
| **Data Map** | `MetadataMap.tsx` | 存储拓扑可视化、Tag基数分析 | 已实现UI，AI诊断+规则引擎降级 |
| **Schema Evolution** | `MetadataSchema.tsx` | 动态Schema变更管理、变更审批 | 已实现UI，Mock数据 |
| **Lifecycle** | `MetadataLifecycle.tsx` | 数据保留策略、分层存储配置 | 已实现UI，基础功能 |
| **Lineage** | `MetadataLineage.tsx` | 数据血缘追踪、流向可视化 | 已实现UI，静态展示 |

**当前菜单结构**（来自 Sidebar.tsx）：
```
Metadata
├── Data Map          (MetadataMap)
├── Schema Evolution  (MetadataSchema)
├── Lifecycle         (MetadataLifecycle)
└── Lineage           (MetadataLineage)
```

#### 10.5.2 当前设计评价

##### ✅ 设计亮点

| 功能 | 评价 | 说明 |
|------|------|------|
| **Tag Cardinality分析** | ⭐⭐⭐⭐⭐ | AI诊断 + 规则引擎降级策略，兼顾智能化和稳定性 |
| **Schema变更审批** | ⭐⭐⭐⭐ | 支持审批流程、类型冲突解决策略配置 |
| **数据血缘可视化** | ⭐⭐⭐⭐ | Canvas画布展示，支持多级数据流向 |
| **Lifecycle管理** | ⭐⭐⭐⭐ | TTL、分层存储、Write Buffer统一管理 |

##### ⚠️ 存在的问题

| 问题 | 影响 | 具体表现 |
|------|------|----------|
| **与采集配置割裂** | 高 | Metadata中定义的超级表与Collector采集点映射无关联 |
| **血缘数据静态** | 中 | 当前为Mock数据，无法反映真实的Collector→Platform→TDengine流向 |
| **缺乏元数据发现** | 中 | 不支持自动扫描已有数据库结构 |
| **无数据质量监控** | 中 | 缺少空值率、异常值、延迟等质量指标 |
| **Schema版本管理弱** | 低 | 变更历史可追溯，但缺乏版本对比和回滚 |

#### 10.5.3 优化建议

##### 建议1: 建立采集点与元数据的关联

**当前问题**：Collector采集的接口配置（采集点）与Metadata的超级表Schema是割裂的。

**优化方案**：
```
┌─────────────────────────────────────────────────────────────────────┐
│                    元数据与采集配置关联架构                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Collector Interface Config          Metadata SuperTable          │
│   ┌─────────────────────────────┐    ┌─────────────────────────┐   │
│   │ Interface: PLC-Line1        │    │ SuperTable: meters      │   │
│   │ ├── Point: temperature      │───▶│ ├── Column: ts          │   │
│   │ │   Address: 40001          │    │ ├── Column: temperature │   │
│   │ │   DataType: float32       │关联 │ ├── Column: pressure    │   │
│   │ │   Unit: °C                │    │ └── Tag: device_id      │   │
│   │ └── Point: pressure         │    │                         │   │
│   │     Address: 40002          │    │ 映射关系表              │   │
│   └─────────────────────────────┘    │ interface_id ↔ table    │   │
│                                      │ point_name ↔ column     │   │
│                                      └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**数据库表设计**：
```sql
-- 采集点与元数据映射表
CREATE TABLE collector_point_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id),
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id),
    point_name VARCHAR(255) NOT NULL,
    
    -- 关联的元数据
    database_name VARCHAR(100) NOT NULL,
    super_table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    
    -- 映射配置
    mapping_config JSONB DEFAULT '{}',
    -- e.g., {"transform": "scale", "factor": 0.1}
    
    -- 同步状态
    sync_status VARCHAR(20) DEFAULT 'pending',  -- pending, synced, error
    last_sync_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(interface_id, point_name)
);

-- 创建索引
CREATE INDEX idx_collector_point_metadata_collector ON collector_point_metadata(collector_id);
CREATE INDEX idx_collector_point_metadata_table ON collector_point_metadata(database_name, super_table_name);
```

##### 建议2: 增强数据血缘追踪

**当前问题**：血缘图是静态Mock，无法反映真实的采集-处理-消费链路。

**优化方案**：
```typescript
// 增强的血缘数据模型
interface DataLineageNode {
  id: string;
  type: 'source' | 'collector' | 'raw_table' | 'stream_task' | 'agg_table' | 'consumer';
  name: string;
  metadata: {
    // 根据类型不同而变化
    collectorId?: string;
    interfaceId?: string;
    database?: string;
    table?: string;
    streamId?: string;
    consumerType?: 'grafana' | 'api' | 'report';
  };
  metrics: {
    throughput: number;      // 每秒数据量
    latency: number;         // 延迟(ms)
    errorRate: number;       // 错误率
  };
  status: 'healthy' | 'warning' | 'error';
}

interface DataLineageEdge {
  source: string;
  target: string;
  type: 'ingestion' | 'processing' | 'query';
  metrics: {
    recordCount: number;     // 总记录数
    byteCount: number;       // 总字节数
    avgLatency: number;      // 平均延迟
  };
}
```

**血缘数据自动采集**：
```go
// lineage_tracker.go

// 从Collector采集注入点
func (lt *LineageTracker) TrackCollectorInjection(collectorID string, interfaceID string, pointName string, database string, table string) {
    lt.recordLineage(&LineageRecord{
        SourceType: "collector",
        SourceID: fmt.Sprintf("%s/%s/%s", collectorID, interfaceID, pointName),
        TargetType: "raw_table",
        TargetID: fmt.Sprintf("%s.%s", database, table),
        Timestamp: time.Now(),
    })
}

// 从流计算任务采集处理链路
func (lt *LineageTracker) TrackStreamProcessing(streamID string, sourceTable string, targetTable string) {
    lt.recordLineage(&LineageRecord{
        SourceType: "raw_table",
        SourceID: sourceTable,
        TargetType: "stream_task",
        TargetID: streamID,
        Timestamp: time.Now(),
    })
    lt.recordLineage(&LineageRecord{
        SourceType: "stream_task",
        SourceID: streamID,
        TargetType: "agg_table",
        TargetID: targetTable,
        Timestamp: time.Now(),
    })
}
```

##### 建议3: 增加数据质量监控

**新增页面：MetadataQuality.tsx**

```typescript
// 数据质量监控模型
interface DataQualityMetrics {
  tableName: string;
  
  // 完整性
  completeness: {
    totalRows: number;
    nullValues: Record<string, number>;  // column -> null count
    nullRate: Record<string, number>;     // column -> null rate
  };
  
  // 准确性
  accuracy: {
    outOfRangeValues: Record<string, number>;  // 超出合理范围的值
    formatErrors: Record<string, number>;      // 格式错误
  };
  
  // 及时性
  timeliness: {
    avgLatency: number;      // 平均入库延迟
    maxLatency: number;      // 最大延迟
    lateArrivals: number;    // 迟到数据数量
  };
  
  // 一致性
  consistency: {
    schemaDrifts: number;    // Schema漂移次数
    typeMismatches: number;  // 类型不匹配次数
  };
}
```

**质量监控Dashboard**：
```
+---------------------------------------------------------------------+
│ 数据质量监控                                                        │
+---------------------------------------------------------------------+
│                                                                     │
│  ┌─ 质量评分概览 ──────────────────────────────────────────────┐   │
│  │  完整性: 98%    准确性: 95%    及时性: 92%    一致性: 99%    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  表名              │ 完整性 │ 准确性 │ 及时性 │ 质量评分 │ 趋势    │
│  -----------------+--------+--------+--------+----------+---------│
│  power_db.meters  │  99%   │  97%   │  94%   │   97%    │ ↑       │
│  factory_db.temp  │  95%   │  93%   │  89%   │   92%    │ →       │
│  fleet_db.gps     │  98%   │  96%   │  91%   │   95%    │ ↓       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

##### 建议4: Schema版本管理与对比

**增强 MetadataSchema 页面**：
```typescript
// Schema版本管理
interface SchemaVersion {
  version: number;
  timestamp: string;
  author: string;
  changeType: 'add_column' | 'modify_column' | 'drop_column' | 'add_tag' | 'modify_tag';
  changes: SchemaChange[];
  ddl: string;           // 完整的DDL语句
  rollbackDDL: string;   // 回滚DDL
}

interface SchemaChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  changeType: 'added' | 'modified' | 'removed';
}
```

**版本对比功能**：
```
+---------------------------------------------------------------------+
│ Schema版本对比                                                      │
+---------------------------------------------------------------------+
│                                                                     │
│  [版本: v5 ▼]  vs  [版本: v6 ▼]                            [对比]   │
│                                                                     │
│  ┌─ 差异概览 ──────────────────────────────────────────────────┐   │
│  │  + 新增列: 1    ~ 修改列: 1    - 删除列: 0                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  字段              │ v5              │ v6              │ 操作      │
│  ------------------+-----------------+-----------------+-----------│
│  temperature      │ FLOAT           │ FLOAT           │ -         │
│  humidity         │ -               │ FLOAT           │ + 新增    │
│  status           │ INT             │ VARCHAR(50)     │ ~ 修改    │
│                                                                     │
│  [查看完整DDL]  [回滚到此版本]                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### 建议5: 元数据自动发现

**新增功能：自动扫描已有数据库结构**

```go
// metadata_discovery.go

type MetadataDiscoveryService struct {
    tdengine *tdengine.TDengineService
}

// ScanDatabase 扫描数据库结构
func (mds *MetadataDiscoveryService) ScanDatabase(database string) (*DiscoveredMetadata, error) {
    // 1. 获取所有超级表
    superTables, err := mds.tdengine.ListSuperTables(ctx, database)
    if err != nil {
        return nil, err
    }
    
    result := &DiscoveredMetadata{
        Database: database,
        SuperTables: make([]DiscoveredSuperTable, 0),
    }
    
    for _, st := range superTables {
        // 2. 获取表结构
        schema, err := mds.tdengine.GetSuperTableSchema(ctx, database, st.Name)
        if err != nil {
            continue
        }
        
        // 3. 采集统计信息
        stats, err := mds.tdengine.GetSuperTableStatistics(ctx, database, st.Name)
        
        result.SuperTables = append(result.SuperTables, DiscoveredSuperTable{
            Name: st.Name,
            Schema: schema,
            Statistics: stats,
            SuggestedMapping: mds.suggestCollectorMapping(schema),  // 智能推荐采集映射
        })
    }
    
    return result, nil
}

// suggestCollectorMapping 基于Schema智能推荐采集点配置
func (mds *MetadataDiscoveryService) suggestCollectorMapping(schema *SuperTableSchema) []SuggestedMapping {
    suggestions := make([]SuggestedMapping, 0)
    
    for _, col := range schema.Columns {
        // 根据列名和数据类型推荐采集配置
        suggestion := SuggestedMapping{
            PointName: col.Name,
            DataType: mds.mapToCollectorDataType(col.Type),
            Address: mds.suggestAddress(col.Name),  // 基于命名规则推测地址
        }
        suggestions = append(suggestions, suggestion)
    }
    
    return suggestions
}
```

**自动发现UI**：
```
+---------------------------------------------------------------------+
│ 元数据自动发现                                                      │
+---------------------------------------------------------------------+
│                                                                     │
│  数据库: [power_db ▼]                                    [开始扫描] │
│                                                                     │
│  ┌─ 扫描结果 ──────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  ✓ meters (超级表)                                           │   │
│  │    - 发现 3 个列, 1 个标签                                    │   │
│  │    - 智能推荐: 可关联到 Collector Interface "PLC-Line1"      │   │
│  │    [一键创建采集映射]                                         │   │
│  │                                                              │   │
│  │  ⚠ sensors (超级表)                                          │   │
│  │    - 发现 5 个列, 2 个标签                                    │   │
│  │    - 警告: 存在未匹配的采集点                                 │   │
│  │    [查看详情]                                                 │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 10.5.4 前端页面优化清单

| 页面 | 当前状态 | 优化建议 | 优先级 |
|------|----------|----------|--------|
| **MetadataMap** | AI+规则分析Tag基数 | 增加采集点关联展示、自动发现入口 | P1 |
| **MetadataSchema** | 变更日志、审批 | 增加版本对比、Schema回滚、DDL导出 | P1 |
| **MetadataLifecycle** | TTL、分层存储 | 增加基于标签的精细策略、自动优化建议 | P2 |
| **MetadataLineage** | 静态血缘图 | 接入真实链路数据、增加性能指标 | P1 |
| **MetadataQuality** | ❌ 缺失 | 新增数据质量监控Dashboard | P1 |
| **MetadataDiscovery** | ❌ 缺失 | 新增自动发现页面 | P2 |

#### 10.5.5 与采集配置的联动

**关键优化：采集配置保存时自动同步元数据**

```typescript
// 采集配置保存流程增强
async function saveInterfaceConfig(collectorId: string, config: InterfaceFormData) {
  // 1. 保存接口配置
  const interface = await api.collectorInterfaces.update(collectorId, config);
  
  // 2. 自动创建/更新超级表Schema
  await api.metadata.syncCollectorToSchema({
    collectorId,
    interfaceId: interface.id,
    dataPoints: config.dataPoints,
    targetDatabase: config.target.database,
    targetSuperTable: config.target.superTable,
  });
  
  // 3. 创建采集点与元数据映射
  for (const point of config.dataPoints) {
    await api.collectorPointMetadata.create({
      collectorId,
      interfaceId: interface.id,
      pointName: point.name,
      databaseName: config.target.database,
      superTableName: config.target.superTable,
      columnName: point.name,
    });
  }
  
  // 4. 触发配置下发
  await api.collectorInterfaces.deploy(collectorId, interface.id);
}
```

### 10.6 总结建议

| 优先级 | 优化项 | 预期收益 |
|--------|--------|----------|
| **P0** | 配置统一管理改造 | 配置一致性提升，运维成本降低50% |
| **P0** | Interface配置模块 | 支持细粒度的采集点管理 |
| **P1** | 边缘告警管理模块 | 离线场景告警不丢失 |
| **P1** | 配置下发追踪 | 问题定位时间从小时级降至分钟级 |
| **P1** | **采集点-元数据关联** | **打通采集与存储，避免重复配置** |
| **P1** | **数据血缘实时化** | **真实链路追踪，问题定位更高效** |
| **P1** | **数据质量监控** | **提前发现数据问题，保障数据可信** |
| **P2** | 采集器分组管理 | 批量操作效率提升10倍 |
| **P2** | 元数据自动发现 | 降低新系统集成成本 |
| **P2** | Schema版本管理 |  Schema变更有据可查，支持回滚 |
