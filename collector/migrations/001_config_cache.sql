-- ============================================
-- 迁移脚本: 001_config_cache.sql
-- 描述: Collector配置缓存和边缘告警相关表
-- 数据库: SQLite
-- 日期: 2026-03-13
-- 版本: v1.0
-- ============================================

-- ============================================
-- 1. 创建配置缓存表
-- ============================================
CREATE TABLE IF NOT EXISTS config_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_type VARCHAR(50) NOT NULL,  -- 'interfaces', 'global', 'edge_alerts'
    config_key VARCHAR(255) NOT NULL,
    config_value BLOB NOT NULL,        -- 压缩后的JSON配置
    checksum VARCHAR(64) NOT NULL,     -- SHA256校验和
    version INTEGER NOT NULL DEFAULT 1,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,              -- 缓存过期时间
    
    UNIQUE(config_type, config_key)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_config_cache_type ON config_cache(config_type);
CREATE INDEX IF NOT EXISTS idx_config_cache_version ON config_cache(version);
CREATE INDEX IF NOT EXISTS idx_config_cache_synced_at ON config_cache(synced_at);

-- ============================================
-- 2. 创建任务运行时状态表
-- ============================================
CREATE TABLE IF NOT EXISTS task_runtime_status (
    interface_id VARCHAR(255) PRIMARY KEY,
    interface_name VARCHAR(255) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    
    -- 运行状态
    task_state VARCHAR(20) DEFAULT 'stopped' CHECK (task_state IN ('stopped', 'running', 'error', 'paused')),
    enabled BOOLEAN DEFAULT true,
    
    -- 执行统计
    last_execution TIMESTAMP,
    last_success TIMESTAMP,
    last_error TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    
    -- 健康状态
    is_healthy BOOLEAN DEFAULT true,
    health_check_at TIMESTAMP,
    
    -- 配置版本
    config_version INTEGER DEFAULT 0,
    config_applied_at TIMESTAMP,
    
    -- 性能指标
    avg_execution_ms INTEGER DEFAULT 0,
    total_executions INTEGER DEFAULT 0,
    total_success INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_runtime_state ON task_runtime_status(task_state);
CREATE INDEX IF NOT EXISTS idx_task_runtime_health ON task_runtime_status(is_healthy);

-- ============================================
-- 3. 创建边缘告警缓存表（离线告警持久化）
-- ============================================
CREATE TABLE IF NOT EXISTS pending_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id VARCHAR(255) NOT NULL UNIQUE,  -- UUID格式
    rule_id VARCHAR(255) NOT NULL,
    rule_name VARCHAR(255),
    
    -- 告警内容
    point_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('trigger', 'recovery')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    value REAL,
    threshold REAL,
    
    -- 时间戳
    edge_timestamp TIMESTAMP NOT NULL,      -- 边缘触发时间
    local_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 本地记录时间
    
    -- 上报状态
    reported BOOLEAN DEFAULT false,
    report_attempts INTEGER DEFAULT 0,
    last_report_attempt TIMESTAMP,
    report_error TEXT,
    
    -- 元数据
    metadata TEXT  -- JSON格式
);

CREATE INDEX IF NOT EXISTS idx_pending_alerts_reported ON pending_alerts(reported);
CREATE INDEX IF NOT EXISTS idx_pending_alerts_timestamp ON pending_alerts(edge_timestamp);
CREATE INDEX IF NOT EXISTS idx_pending_alerts_rule ON pending_alerts(rule_id);

-- ============================================
-- 4. 创建压缩状态表（死区压缩需要记住最后发送的值）
-- ============================================
CREATE TABLE IF NOT EXISTS compression_state (
    point_key VARCHAR(255) PRIMARY KEY,  -- 格式: interface_id.point_name
    interface_id VARCHAR(255) NOT NULL,
    point_name VARCHAR(255) NOT NULL,
    
    -- 死区压缩状态
    last_sent_value REAL,
    last_sent_time TIMESTAMP,
    
    -- 统计
    total_sent INTEGER DEFAULT 0,
    total_compressed INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compression_state_interface ON compression_state(interface_id);

-- ============================================
-- 5. 创建采集数据统计表
-- ============================================
CREATE TABLE IF NOT EXISTS collection_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interface_id VARCHAR(255) NOT NULL,
    point_name VARCHAR(255) NOT NULL,
    
    -- 统计周期（按小时）
    stats_hour TIMESTAMP NOT NULL,
    
    -- 采集统计
    read_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- 数值统计（仅数值类型）
    min_value REAL,
    max_value REAL,
    avg_value REAL,
    
    -- 质量统计
    null_count INTEGER DEFAULT 0,
    out_of_range_count INTEGER DEFAULT 0,
    
    UNIQUE(interface_id, point_name, stats_hour)
);

CREATE INDEX IF NOT EXISTS idx_collection_stats_interface ON collection_statistics(interface_id);
CREATE INDEX IF NOT EXISTS idx_collection_stats_time ON collection_statistics(stats_hour DESC);

-- ============================================
-- 6. 创建同步状态表
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type VARCHAR(50) NOT NULL,  -- 'config', 'data', 'alerts'
    
    -- 同步状态
    last_sync_at TIMESTAMP,
    last_success_at TIMESTAMP,
    last_error_at TIMESTAMP,
    last_error_message TEXT,
    
    -- 统计
    total_syncs INTEGER DEFAULT 0,
    successful_syncs INTEGER DEFAULT 0,
    failed_syncs INTEGER DEFAULT 0,
    
    -- 待同步数据
    pending_count INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(sync_type)
);

-- ============================================
-- 7. 创建配置变更日志表
-- ============================================
CREATE TABLE IF NOT EXISTS config_change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_type VARCHAR(50) NOT NULL,  -- 'full_sync', 'delta_sync', 'local_update'
    
    -- 版本信息
    old_version INTEGER,
    new_version INTEGER,
    
    -- 变更内容摘要
    change_summary TEXT,
    
    -- 执行结果
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- 时间
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_config_change_log_time ON config_change_log(executed_at DESC);

-- ============================================
-- 8. 创建系统状态表
-- ============================================
CREATE TABLE IF NOT EXISTS system_status (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化系统状态
INSERT OR REPLACE INTO system_status (key, value) VALUES 
    ('collector_id', ''),
    ('collector_name', ''),
    ('platform_endpoint', ''),
    ('last_heartbeat', ''),
    ('config_version', '0'),
    ('network_online', 'false'),
    ('startup_time', CURRENT_TIMESTAMP);

-- ============================================
-- 视图：待同步告警统计
-- ============================================
CREATE VIEW IF NOT EXISTS pending_alerts_summary AS
SELECT 
    severity,
    event_type,
    COUNT(*) as count,
    MIN(edge_timestamp) as oldest,
    MAX(edge_timestamp) as newest
FROM pending_alerts
WHERE reported = false
GROUP BY severity, event_type;

-- ============================================
-- 视图：任务健康状态概览
-- ============================================
CREATE VIEW IF NOT EXISTS task_health_summary AS
SELECT 
    task_state,
    is_healthy,
    COUNT(*) as count
FROM task_runtime_status
GROUP BY task_state, is_healthy;

-- ============================================
-- 清理旧数据的触发器示例
-- ============================================
-- 清理超过30天的统计历史
DELETE FROM collection_statistics 
WHERE stats_hour < datetime('now', '-30 days');

-- 清理超过7天的配置变更日志
DELETE FROM config_change_log 
WHERE executed_at < datetime('now', '-7 days');

-- ============================================
-- 使用说明
-- ============================================
-- 执行迁移: sqlite3 collector_cache.db < 001_config_cache.sql
-- 
-- 验证表创建:
-- .tables
-- .schema config_cache
--
-- 回滚（手动）:
-- DROP TABLE IF EXISTS system_status;
-- DROP TABLE IF EXISTS config_change_log;
-- DROP TABLE IF EXISTS sync_status;
-- DROP TABLE IF EXISTS collection_statistics;
-- DROP TABLE IF EXISTS compression_state;
-- DROP TABLE IF EXISTS pending_alerts;
-- DROP TABLE IF EXISTS task_runtime_status;
-- DROP TABLE IF EXISTS config_cache;
-- DROP VIEW IF EXISTS pending_alerts_summary;
-- DROP VIEW IF EXISTS task_health_summary;
