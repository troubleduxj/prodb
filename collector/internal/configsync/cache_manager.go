// Package configsync 配置同步相关功能
package configsync

import (
	"compress/gzip"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"time"

	_ "modernc.org/sqlite"
)

// CacheManager 配置缓存管理器
type CacheManager struct {
	db     *sql.DB
	logger interface {
		Info(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
	}
}

// CachedConfig 缓存的配置项
type CachedConfig struct {
	ID         int64
	ConfigType string
	ConfigKey  string
	ConfigValue []byte
	Checksum   string
	Version    int
	SyncedAt   time.Time
	ExpiresAt  *time.Time
}

// TaskRuntimeStatus 任务运行时状态
type TaskRuntimeStatus struct {
	InterfaceID        string
	InterfaceName      string
	Protocol           string
	TaskState          string
	Enabled            bool
	LastExecution      *time.Time
	LastSuccess        *time.Time
	LastError          *time.Time
	ErrorCount         int
	ConsecutiveErrors  int
	LastErrorMessage   string
	IsHealthy          bool
	HealthCheckAt      *time.Time
	ConfigVersion      int
	ConfigAppliedAt    *time.Time
	AvgExecutionMs     int
	TotalExecutions    int
	TotalSuccess       int
	TotalErrors        int
	UpdatedAt          time.Time
}

// NewCacheManager 创建缓存管理器
func NewCacheManager(dbPath string, logger interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
}) (*CacheManager, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open cache database: %w", err)
	}
	
	// 设置连接池
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)
	
	// 执行迁移
	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}
	
	return &CacheManager{
		db:     db,
		logger: logger,
	}, nil
}

// Close 关闭数据库连接
func (cm *CacheManager) Close() error {
	return cm.db.Close()
}

// runMigrations 执行数据库迁移
func runMigrations(db *sql.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS config_cache (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			config_type VARCHAR(50) NOT NULL,
			config_key VARCHAR(255) NOT NULL,
			config_value BLOB NOT NULL,
			checksum VARCHAR(64) NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP,
			UNIQUE(config_type, config_key)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_config_cache_type ON config_cache(config_type);`,
		`CREATE INDEX IF NOT EXISTS idx_config_cache_version ON config_cache(version);`,
		`CREATE TABLE IF NOT EXISTS task_runtime_status (
			interface_id VARCHAR(255) PRIMARY KEY,
			interface_name VARCHAR(255) NOT NULL,
			protocol VARCHAR(50) NOT NULL,
			task_state VARCHAR(20) DEFAULT 'stopped',
			enabled BOOLEAN DEFAULT true,
			last_execution TIMESTAMP,
			last_success TIMESTAMP,
			last_error TIMESTAMP,
			error_count INTEGER DEFAULT 0,
			consecutive_errors INTEGER DEFAULT 0,
			last_error_message TEXT,
			is_healthy BOOLEAN DEFAULT true,
			health_check_at TIMESTAMP,
			config_version INTEGER DEFAULT 0,
			config_applied_at TIMESTAMP,
			avg_execution_ms INTEGER DEFAULT 0,
			total_executions INTEGER DEFAULT 0,
			total_success INTEGER DEFAULT 0,
			total_errors INTEGER DEFAULT 0,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_task_runtime_state ON task_runtime_status(task_state);`,
		`CREATE TABLE IF NOT EXISTS pending_alerts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			alert_id VARCHAR(255) NOT NULL UNIQUE,
			rule_id VARCHAR(255) NOT NULL,
			rule_name VARCHAR(255),
			point_name VARCHAR(255) NOT NULL,
			event_type VARCHAR(20) NOT NULL,
			severity VARCHAR(20) NOT NULL,
			value REAL,
			threshold REAL,
			edge_timestamp TIMESTAMP NOT NULL,
			local_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			reported BOOLEAN DEFAULT false,
			report_attempts INTEGER DEFAULT 0,
			last_report_attempt TIMESTAMP,
			report_error TEXT,
			metadata TEXT
		);`,
		`CREATE INDEX IF NOT EXISTS idx_pending_alerts_reported ON pending_alerts(reported);`,
		`CREATE TABLE IF NOT EXISTS compression_state (
			point_id VARCHAR(255) PRIMARY KEY,
			interface_id VARCHAR(255) NOT NULL,
			last_value REAL,
			last_timestamp TIMESTAMP,
			compression_buffer TEXT,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
	}
	
	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	
	return nil
}

// SaveConfig 保存配置到缓存
func (cm *CacheManager) SaveConfig(configType, configKey string, value interface{}, version int) error {
	// 序列化配置
	jsonData, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	
	// 压缩数据
	compressedData := compress(jsonData)
	
	// 计算校验和
	checksum := calculateChecksum(jsonData)
	
	// 保存到数据库
	query := `
		INSERT INTO config_cache (config_type, config_key, config_value, checksum, version, synced_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(config_type, config_key) DO UPDATE SET
			config_value = excluded.config_value,
			checksum = excluded.checksum,
			version = excluded.version,
			synced_at = excluded.synced_at
	`
	
	_, err = cm.db.Exec(query, configType, configKey, compressedData, checksum, version, time.Now())
	if err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	
	cm.logger.Info("Config cached", "type", configType, "key", configKey, "version", version)
	return nil
}

// GetConfig 从缓存获取配置
func (cm *CacheManager) GetConfig(configType, configKey string, dest interface{}) (int, string, error) {
	var compressedData []byte
	var version int
	var checksum string
	
	query := `SELECT config_value, version, checksum FROM config_cache WHERE config_type = ? AND config_key = ?`
	err := cm.db.QueryRow(query, configType, configKey).Scan(&compressedData, &version, &checksum)
	if err == sql.ErrNoRows {
		return 0, "", fmt.Errorf("config not found")
	}
	if err != nil {
		return 0, "", fmt.Errorf("failed to get config: %w", err)
	}
	
	// 解压数据
	jsonData, err := decompress(compressedData)
	if err != nil {
		return 0, "", fmt.Errorf("failed to decompress config: %w", err)
	}
	
	// 验证校验和
	expectedChecksum := calculateChecksum(jsonData)
	if expectedChecksum != checksum {
		return 0, "", fmt.Errorf("checksum mismatch: config may be corrupted")
	}
	
	// 反序列化
	if err := json.Unmarshal(jsonData, dest); err != nil {
		return 0, "", fmt.Errorf("failed to unmarshal config: %w", err)
	}
	
	return version, checksum, nil
}

// GetConfigVersion 获取配置版本
func (cm *CacheManager) GetConfigVersion(configType, configKey string) (int, error) {
	var version int
	query := `SELECT version FROM config_cache WHERE config_type = ? AND config_key = ?`
	err := cm.db.QueryRow(query, configType, configKey).Scan(&version)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return version, nil
}

// DeleteConfig 删除配置
func (cm *CacheManager) DeleteConfig(configType, configKey string) error {
	query := `DELETE FROM config_cache WHERE config_type = ? AND config_key = ?`
	_, err := cm.db.Exec(query, configType, configKey)
	return err
}

// SaveTaskStatus 保存任务状态
func (cm *CacheManager) SaveTaskStatus(status *TaskRuntimeStatus) error {
	query := `
		INSERT INTO task_runtime_status (
			interface_id, interface_name, protocol, task_state, enabled,
			last_execution, last_success, last_error, error_count, consecutive_errors,
			last_error_message, is_healthy, health_check_at, config_version,
			config_applied_at, avg_execution_ms, total_executions, total_success, total_errors, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(interface_id) DO UPDATE SET
			interface_name = excluded.interface_name,
			protocol = excluded.protocol,
			task_state = excluded.task_state,
			enabled = excluded.enabled,
			last_execution = excluded.last_execution,
			last_success = excluded.last_success,
			last_error = excluded.last_error,
			error_count = excluded.error_count,
			consecutive_errors = excluded.consecutive_errors,
			last_error_message = excluded.last_error_message,
			is_healthy = excluded.is_healthy,
			health_check_at = excluded.health_check_at,
			config_version = excluded.config_version,
			config_applied_at = excluded.config_applied_at,
			avg_execution_ms = excluded.avg_execution_ms,
			total_executions = excluded.total_executions,
			total_success = excluded.total_success,
			total_errors = excluded.total_errors,
			updated_at = excluded.updated_at
	`
	
	_, err := cm.db.Exec(query,
		status.InterfaceID, status.InterfaceName, status.Protocol, status.TaskState, status.Enabled,
		status.LastExecution, status.LastSuccess, status.LastError, status.ErrorCount, status.ConsecutiveErrors,
		status.LastErrorMessage, status.IsHealthy, status.HealthCheckAt, status.ConfigVersion,
		status.ConfigAppliedAt, status.AvgExecutionMs, status.TotalExecutions, status.TotalSuccess, status.TotalErrors,
		time.Now(),
	)
	return err
}

// GetTaskStatus 获取任务状态
func (cm *CacheManager) GetTaskStatus(interfaceID string) (*TaskRuntimeStatus, error) {
	query := `SELECT * FROM task_runtime_status WHERE interface_id = ?`
	row := cm.db.QueryRow(query, interfaceID)
	
	status := &TaskRuntimeStatus{}
	var lastExec, lastSuccess, lastError, healthCheckAt, configAppliedAt sql.NullTime
	var lastErrMsg sql.NullString
	
	err := row.Scan(
		&status.InterfaceID, &status.InterfaceName, &status.Protocol,
		&status.TaskState, &status.Enabled,
		&lastExec, &lastSuccess, &lastError,
		&status.ErrorCount, &status.ConsecutiveErrors, &lastErrMsg,
		&status.IsHealthy, &healthCheckAt,
		&status.ConfigVersion, &configAppliedAt,
		&status.AvgExecutionMs, &status.TotalExecutions, &status.TotalSuccess, &status.TotalErrors,
		&status.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	
	// 处理 NULL 值
	if lastExec.Valid {
		status.LastExecution = &lastExec.Time
	}
	if lastSuccess.Valid {
		status.LastSuccess = &lastSuccess.Time
	}
	if lastError.Valid {
		status.LastError = &lastError.Time
	}
	if lastErrMsg.Valid {
		status.LastErrorMessage = lastErrMsg.String
	}
	if healthCheckAt.Valid {
		status.HealthCheckAt = &healthCheckAt.Time
	}
	if configAppliedAt.Valid {
		status.ConfigAppliedAt = &configAppliedAt.Time
	}
	
	return status, nil
}

// ListTaskStatus 列出所有任务状态
func (cm *CacheManager) ListTaskStatus() ([]*TaskRuntimeStatus, error) {
	query := `SELECT * FROM task_runtime_status`
	rows, err := cm.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var statuses []*TaskRuntimeStatus
	for rows.Next() {
		status := &TaskRuntimeStatus{}
		var lastExec, lastSuccess, lastError, healthCheckAt, configAppliedAt sql.NullTime
		var lastErrMsg sql.NullString
		
		err := rows.Scan(
			&status.InterfaceID, &status.InterfaceName, &status.Protocol,
			&status.TaskState, &status.Enabled,
			&lastExec, &lastSuccess, &lastError,
			&status.ErrorCount, &status.ConsecutiveErrors, &lastErrMsg,
			&status.IsHealthy, &healthCheckAt,
			&status.ConfigVersion, &configAppliedAt,
			&status.AvgExecutionMs, &status.TotalExecutions, &status.TotalSuccess, &status.TotalErrors,
			&status.UpdatedAt,
		)
		if err != nil {
			continue
		}
		
		// 处理 NULL 值
		if lastExec.Valid {
			status.LastExecution = &lastExec.Time
		}
		if lastSuccess.Valid {
			status.LastSuccess = &lastSuccess.Time
		}
		if lastError.Valid {
			status.LastError = &lastError.Time
		}
		if lastErrMsg.Valid {
			status.LastErrorMessage = lastErrMsg.String
		}
		if healthCheckAt.Valid {
			status.HealthCheckAt = &healthCheckAt.Time
		}
		if configAppliedAt.Valid {
			status.ConfigAppliedAt = &configAppliedAt.Time
		}
		
		statuses = append(statuses, status)
	}
	
	return statuses, nil
}

// GetStats 获取缓存统计
func (cm *CacheManager) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})
	
	// 配置缓存统计
	var configCount int
	err := cm.db.QueryRow(`SELECT COUNT(*) FROM config_cache`).Scan(&configCount)
	if err != nil {
		return nil, err
	}
	stats["config_count"] = configCount
	
	// 任务状态统计
	var runningCount, errorCount int
	err = cm.db.QueryRow(`SELECT 
		COUNT(CASE WHEN task_state = 'running' THEN 1 END),
		COUNT(CASE WHEN task_state = 'error' THEN 1 END)
		FROM task_runtime_status`).Scan(&runningCount, &errorCount)
	if err != nil {
		return nil, err
	}
	stats["running_tasks"] = runningCount
	stats["error_tasks"] = errorCount
	
	// 待上报告警统计
	var pendingAlerts int
	err = cm.db.QueryRow(`SELECT COUNT(*) FROM pending_alerts WHERE reported = false`).Scan(&pendingAlerts)
	if err != nil {
		return nil, err
	}
	stats["pending_alerts"] = pendingAlerts
	
	return stats, nil
}

// ClearExpiredConfigs 清理过期配置
func (cm *CacheManager) ClearExpiredConfigs() error {
	query := `DELETE FROM config_cache WHERE expires_at IS NOT NULL AND expires_at < ?`
	_, err := cm.db.Exec(query, time.Now())
	return err
}

// compress 压缩数据
func compress(data []byte) []byte {
	var buf []byte
	w := gzip.NewWriter(&bufWriter{&buf})
	w.Write(data)
	w.Close()
	return buf
}

// decompress 解压数据
func decompress(data []byte) ([]byte, error) {
	r, err := gzip.NewReader(&sliceReader{data, 0})
	if err != nil {
		return nil, err
	}
	defer r.Close()
	return io.ReadAll(r)
}

// calculateChecksum 计算校验和
func calculateChecksum(data []byte) string {
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash)
}

// bufWriter 字节缓冲区写入器
type bufWriter struct {
	buf *[]byte
}

func (w *bufWriter) Write(p []byte) (n int, err error) {
	*w.buf = append(*w.buf, p...)
	return len(p), nil
}

// sliceReader 切片读取器
type sliceReader struct {
	data []byte
	pos  int
}

func (r *sliceReader) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}