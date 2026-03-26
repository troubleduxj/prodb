-- ============================================
-- 迁移脚本: 001_config_unification.sql
-- 描述: 配置统一管理 - 新增采集器接口配置相关表
-- 日期: 2026-03-13
-- 版本: v1.0
-- ============================================

-- 开启事务
BEGIN;

-- ============================================
-- 1. 创建采集器接口配置表
-- ============================================
CREATE TABLE IF NOT EXISTS collector_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) NOT NULL CHECK (protocol IN ('modbus_tcp', 'modbus_rtu', 'opcua', 'mqtt')),
    enabled BOOLEAN DEFAULT true,
    
    -- 连接配置 (JSONB) - 存储协议特定的连接参数
    connection_config JSONB NOT NULL DEFAULT '{}',
    -- 示例 modbus_tcp: {"host": "192.168.1.100", "port": 502, "timeout_ms": 5000, "retry_count": 3}
    -- 示例 opcua: {"endpoint": "opc.tcp://192.168.1.10:4840", "security_mode": "SignAndEncrypt", "username": "", "password": ""}
    -- 示例 mqtt: {"broker": "tcp://192.168.1.50:1883", "client_id": "collector_001", "username": "", "password": ""}
    
    -- 采集点配置 (JSONB数组)
    data_points JSONB NOT NULL DEFAULT '[]',
    -- 示例: [
    --   {"name": "temperature", "address": "40001", "data_type": "float32", "scale": 0.1, "offset": 0, 
    --    "unit": "°C", "sampling_interval_ms": 1000, "read_only": false},
    --   {"name": "pressure", "address": "40002", "data_type": "int32", "scale": 1, "offset": 0, 
    --    "unit": "Pa", "sampling_interval_ms": 2000}
    -- ]
    
    -- 边缘预处理配置
    edge_processing JSONB DEFAULT '{
        "compression": {"enabled": false, "algorithm": "deadband", "threshold": 0.5, "max_interval_ms": 30000},
        "aggregation": {"enabled": false, "window": "1m", "function": "avg"},
        "edge_alerts": {"enabled": false}
    }',
    
    -- 采集调度配置
    schedule_config JSONB DEFAULT '{
        "mode": "interval",
        "interval_ms": 1000
    }',
    
    -- 数据目标配置
    target_config JSONB DEFAULT '{
        "database": "",
        "super_table": "",
        "tags": {}
    }',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(collector_id, name)
);

-- 为 collector_interfaces 创建索引
CREATE INDEX idx_collector_interfaces_collector_id ON collector_interfaces(collector_id);
CREATE INDEX idx_collector_interfaces_protocol ON collector_interfaces(protocol);
CREATE INDEX idx_collector_interfaces_enabled ON collector_interfaces(enabled);

COMMENT ON TABLE collector_interfaces IS '采集器接口配置表 - 存储每个采集器的数据采集接口配置';
COMMENT ON COLUMN collector_interfaces.connection_config IS '协议特定的连接参数';
COMMENT ON COLUMN collector_interfaces.data_points IS '采集点配置数组';
COMMENT ON COLUMN collector_interfaces.edge_processing IS '边缘预处理配置（压缩、聚合、告警）';

-- ============================================
-- 2. 创建配置版本历史表
-- ============================================
CREATE TABLE IF NOT EXISTS interface_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    config_snapshot JSONB NOT NULL,
    change_summary TEXT,
    change_type VARCHAR(50) DEFAULT 'manual',  -- manual, auto_sync, rollback
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(interface_id, version)
);

-- 创建索引
CREATE INDEX idx_interface_config_history_interface_id ON interface_config_history(interface_id);
CREATE INDEX idx_interface_config_history_version ON interface_config_history(version);

COMMENT ON TABLE interface_config_history IS '接口配置版本历史表 - 追踪配置变更历史';

-- ============================================
-- 3. 创建配置下发状态表
-- ============================================
CREATE TABLE IF NOT EXISTS config_delivery_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    interface_id UUID REFERENCES collector_interfaces(id) ON DELETE SET NULL,
    config_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'delivering', 'delivered', 'applied', 'failed', 'rollback')),
    
    -- 下发详情
    delivered_at TIMESTAMP,
    applied_at TIMESTAMP,
    error_message TEXT,
    checksum VARCHAR(64),  -- 配置内容校验和
    
    -- 重试信息
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    
    -- 下发内容快照（用于回滚）
    config_snapshot JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_config_delivery_status_collector_id ON config_delivery_status(collector_id);
CREATE INDEX idx_config_delivery_status_interface_id ON config_delivery_status(interface_id);
CREATE INDEX idx_config_delivery_status_status ON config_delivery_status(status);
CREATE INDEX idx_config_delivery_status_next_retry ON config_delivery_status(next_retry_at) WHERE status = 'failed';

COMMENT ON TABLE config_delivery_status IS '配置下发状态表 - 追踪配置下发到采集器的完整流程';

-- ============================================
-- 4. 创建采集器分组表
-- ============================================
CREATE TABLE IF NOT EXISTS collector_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    -- 元数据：如 {"factory": "A", "line": "1", "region": "east"}
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建采集器与分组的关联表
CREATE TABLE IF NOT EXISTS collector_group_members (
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES collector_groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collector_id, group_id)
);

COMMENT ON TABLE collector_groups IS '采集器分组表 - 支持按工厂、产线等维度批量管理';

-- ============================================
-- 5. 创建采集点与元数据映射表
-- ============================================
CREATE TABLE IF NOT EXISTS collector_point_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id) ON DELETE CASCADE,
    point_name VARCHAR(255) NOT NULL,
    
    -- 关联的元数据（TDengine）
    database_name VARCHAR(100) NOT NULL,
    super_table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    
    -- 映射配置
    mapping_config JSONB DEFAULT '{}',
    -- e.g., {"transform": "scale", "factor": 0.1, "offset": 0}
    
    -- 同步状态
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    last_sync_at TIMESTAMP,
    sync_error TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(interface_id, point_name)
);

-- 创建索引
CREATE INDEX idx_collector_point_metadata_collector ON collector_point_metadata(collector_id);
CREATE INDEX idx_collector_point_metadata_interface ON collector_point_metadata(interface_id);
CREATE INDEX idx_collector_point_metadata_table ON collector_point_metadata(database_name, super_table_name);
CREATE INDEX idx_collector_point_metadata_status ON collector_point_metadata(sync_status);

COMMENT ON TABLE collector_point_metadata IS '采集点与元数据映射表 - 打通采集配置与TDengine表结构';

-- ============================================
-- 6. 创建边缘告警规则表
-- ============================================
CREATE TABLE IF NOT EXISTS edge_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    interface_id UUID NOT NULL REFERENCES collector_interfaces(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 规则配置
    point_name VARCHAR(255) NOT NULL,
    condition VARCHAR(20) NOT NULL CHECK (condition IN ('gt', 'lt', 'eq', 'ne', 'between')),
    threshold FLOAT NOT NULL,
    threshold_max FLOAT,  -- 用于 between 条件
    duration_ms INTEGER DEFAULT 0,  -- 持续时间才触发（防抖）
    
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN DEFAULT true,
    
    -- 动作配置
    actions JSONB DEFAULT '["notify"]',
    -- e.g., ["notify", "tag_value_change"]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(collector_id, name)
);

CREATE INDEX idx_edge_alert_rules_collector ON edge_alert_rules(collector_id);
CREATE INDEX idx_edge_alert_rules_interface ON edge_alert_rules(interface_id);
CREATE INDEX idx_edge_alert_rules_enabled ON edge_alert_rules(enabled);

COMMENT ON TABLE edge_alert_rules IS '边缘告警规则表 - 存储在边缘采集器上执行的告警规则';

-- ============================================
-- 7. 创建边缘告警事件表
-- ============================================
CREATE TABLE IF NOT EXISTS edge_alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES edge_alert_rules(id) ON DELETE CASCADE,
    
    point_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('trigger', 'recovery')),
    severity VARCHAR(20) NOT NULL,
    
    value FLOAT,
    threshold FLOAT,
    
    -- 时间戳
    edge_timestamp TIMESTAMP NOT NULL,  -- 边缘触发时间
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 平台接收时间
    
    -- 处理状态
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    -- e.g., {"device_id": "dev001", "location": "line1"}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_edge_alert_events_collector ON edge_alert_events(collector_id);
CREATE INDEX idx_edge_alert_events_rule ON edge_alert_events(rule_id);
CREATE INDEX idx_edge_alert_events_type ON edge_alert_events(event_type);
CREATE INDEX idx_edge_alert_events_ack ON edge_alert_events(acknowledged) WHERE acknowledged = false;
CREATE INDEX idx_edge_alert_events_time ON edge_alert_events(edge_timestamp DESC);

COMMENT ON TABLE edge_alert_events IS '边缘告警事件表 - 存储从采集器上报的边缘告警';

-- ============================================
-- 8. 创建配置下发批次表（批量下发）
-- ============================================
CREATE TABLE IF NOT EXISTS config_delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 下发目标
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('single', 'group', 'all')),
    target_id UUID,  -- collector_id or group_id
    
    -- 下发内容
    config_snapshot JSONB NOT NULL,
    interface_ids UUID[],  -- 涉及的接口ID列表
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'completed', 'partial', 'failed')),
    
    -- 统计
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- 执行信息
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_delivery_batches_status ON config_delivery_batches(status);
CREATE INDEX idx_config_delivery_batches_target ON config_delivery_batches(target_type, target_id);

COMMENT ON TABLE config_delivery_batches IS '配置下发批次表 - 支持批量配置下发追踪';

-- ============================================
-- 9. 创建更新时间触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新updated_at的表创建触发器
DROP TRIGGER IF EXISTS update_collector_interfaces_updated_at ON collector_interfaces;
CREATE TRIGGER update_collector_interfaces_updated_at 
    BEFORE UPDATE ON collector_interfaces 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collector_groups_updated_at ON collector_groups;
CREATE TRIGGER update_collector_groups_updated_at 
    BEFORE UPDATE ON collector_groups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_delivery_status_updated_at ON config_delivery_status;
CREATE TRIGGER update_config_delivery_status_updated_at 
    BEFORE UPDATE ON config_delivery_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collector_point_metadata_updated_at ON collector_point_metadata;
CREATE TRIGGER update_collector_point_metadata_updated_at 
    BEFORE UPDATE ON collector_point_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_edge_alert_rules_updated_at ON edge_alert_rules;
CREATE TRIGGER update_edge_alert_rules_updated_at 
    BEFORE UPDATE ON edge_alert_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. 数据迁移（从旧表迁移）
-- ============================================
-- 注意：执行此迁移前请确保已备份数据

-- 将现有的 interfaces 表数据迁移到新表
DO $$
BEGIN
    -- 检查旧表是否存在
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'interfaces') THEN
        INSERT INTO collector_interfaces (
            collector_id, 
            name, 
            protocol, 
            enabled, 
            connection_config, 
            created_at, 
            updated_at
        )
        SELECT 
            collector_id,
            name,
            CASE 
                WHEN type = 'modbus_tcp' THEN 'modbus_tcp'
                WHEN type = 'modbus_rtu' THEN 'modbus_rtu'
                WHEN type = 'opcua' THEN 'opcua'
                WHEN type = 'mqtt' THEN 'mqtt'
                ELSE 'modbus_tcp'
            END as protocol,
            true as enabled,
            config::jsonb as connection_config,
            created_at,
            updated_at
        FROM interfaces
        ON CONFLICT (collector_id, name) DO NOTHING;
        
        RAISE NOTICE '数据迁移完成：从 interfaces 表迁移到 collector_interfaces 表';
    ELSE
        RAISE NOTICE '旧表 interfaces 不存在，跳过数据迁移';
    END IF;
END $$;

-- ============================================
-- 11. 可选：重命名旧表（确认迁移成功后手动执行）
-- ============================================
-- ALTER TABLE interfaces RENAME TO interfaces_backup;
-- COMMENT ON TABLE interfaces_backup IS '已弃用的interfaces表备份';

-- 提交事务
COMMIT;

-- ============================================
-- 回滚脚本（如需要）
-- ============================================
/*
BEGIN;
DROP TABLE IF EXISTS config_delivery_batches;
DROP TABLE IF EXISTS edge_alert_events;
DROP TABLE IF EXISTS edge_alert_rules;
DROP TABLE IF EXISTS collector_point_metadata;
DROP TABLE IF EXISTS collector_group_members;
DROP TABLE IF EXISTS collector_groups;
DROP TABLE IF EXISTS config_delivery_status;
DROP TABLE IF EXISTS interface_config_history;
DROP TABLE IF EXISTS collector_interfaces;
DROP FUNCTION IF EXISTS update_updated_at_column();
COMMIT;
*/
