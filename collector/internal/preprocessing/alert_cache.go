// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// AlertCacheManager 告警缓存管理器
type AlertCacheManager struct {
	db     *sql.DB
	logger interface {
		Info(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
	}
	mu sync.RWMutex
}

// CachedAlert 缓存的告警
type CachedAlert struct {
	ID              string          `json:"id"`
	RuleID          string          `json:"rule_id"`
	RuleName        string          `json:"rule_name"`
	PointID         string          `json:"point_id"`
	EventType       string          `json:"event_type"`
	Severity        AlertSeverity   `json:"severity"`
	Value           float64         `json:"value"`
	Threshold       float64         `json:"threshold"`
	Condition       AlertCondition  `json:"condition"`
	Timestamp       time.Time       `json:"timestamp"`
	Duration        time.Duration   `json:"duration,omitempty"`
	Message         string          `json:"message"`
	Reported        bool            `json:"reported"`
	ReportAttempts  int             `json:"report_attempts"`
	LastReportError string          `json:"last_report_error,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// NewAlertCacheManager 创建告警缓存管理器
func NewAlertCacheManager(dbPath string, logger interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
}) (*AlertCacheManager, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open alert cache database: %w", err)
	}

	// 创建表
	if err := createAlertTables(db); err != nil {
		return nil, fmt.Errorf("failed to create alert tables: %w", err)
	}

	return &AlertCacheManager{
		db:     db,
		logger: logger,
	}, nil
}

// createAlertTables 创建告警表
func createAlertTables(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS pending_alerts (
		id TEXT PRIMARY KEY,
		rule_id TEXT NOT NULL,
		rule_name TEXT,
		point_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		severity TEXT NOT NULL,
		value REAL,
		threshold REAL,
		condition TEXT,
		timestamp TIMESTAMP NOT NULL,
		duration INTEGER,
		message TEXT,
		reported BOOLEAN DEFAULT false,
		report_attempts INTEGER DEFAULT 0,
		last_report_error TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_pending_alerts_reported ON pending_alerts(reported);
	CREATE INDEX IF NOT EXISTS idx_pending_alerts_timestamp ON pending_alerts(timestamp);
	`
	_, err := db.Exec(query)
	return err
}

// Close 关闭数据库连接
func (acm *AlertCacheManager) Close() error {
	return acm.db.Close()
}

// SaveAlert 保存告警到缓存
func (acm *AlertCacheManager) SaveAlert(event *AlertEvent) error {
	acm.mu.Lock()
	defer acm.mu.Unlock()

	query := `
		INSERT INTO pending_alerts (
			id, rule_id, rule_name, point_id, event_type, severity,
			value, threshold, condition, timestamp, duration, message,
			reported, report_attempts, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			reported = excluded.reported,
			report_attempts = excluded.report_attempts,
			last_report_error = excluded.last_report_error
	`

	_, err := acm.db.Exec(query,
		event.ID, event.RuleID, event.RuleName, event.PointID,
		event.EventType, event.Severity, event.Value, event.Threshold,
		event.Condition, event.Timestamp, event.Duration, event.Message,
		false, 0, time.Now(),
	)

	if err != nil {
		return fmt.Errorf("failed to save alert: %w", err)
	}

	acm.logger.Info("Alert cached", "alert_id", event.ID, "rule_name", event.RuleName)
	return nil
}

// GetPendingAlerts 获取待上报的告警
func (acm *AlertCacheManager) GetPendingAlerts(limit int) ([]*CachedAlert, error) {
	acm.mu.RLock()
	defer acm.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT id, rule_id, rule_name, point_id, event_type, severity,
			value, threshold, condition, timestamp, duration, message,
			reported, report_attempts, last_report_error, created_at
		FROM pending_alerts
		WHERE reported = false
		ORDER BY timestamp ASC
		LIMIT ?
	`

	rows, err := acm.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return acm.scanAlerts(rows)
}

// MarkAlertReported 标记告警为已上报
func (acm *AlertCacheManager) MarkAlertReported(alertID string) error {
	acm.mu.Lock()
	defer acm.mu.Unlock()

	query := `UPDATE pending_alerts SET reported = true WHERE id = ?`
	_, err := acm.db.Exec(query, alertID)
	return err
}

// IncrementRetry 增加重试计数
func (acm *AlertCacheManager) IncrementRetry(alertID string, errMsg string) error {
	acm.mu.Lock()
	defer acm.mu.Unlock()

	query := `
		UPDATE pending_alerts 
		SET report_attempts = report_attempts + 1, last_report_error = ?
		WHERE id = ?
	`
	_, err := acm.db.Exec(query, errMsg, alertID)
	return err
}

// DeleteAlert 删除告警
func (acm *AlertCacheManager) DeleteAlert(alertID string) error {
	acm.mu.Lock()
	defer acm.mu.Unlock()

	query := `DELETE FROM pending_alerts WHERE id = ?`
	_, err := acm.db.Exec(query, alertID)
	return err
}

// GetAlertStats 获取告警统计
func (acm *AlertCacheManager) GetAlertStats() (map[string]interface{}, error) {
	acm.mu.RLock()
	defer acm.mu.RUnlock()

	stats := make(map[string]interface{})

	// 总告警数
	var totalCount int
	err := acm.db.QueryRow(`SELECT COUNT(*) FROM pending_alerts`).Scan(&totalCount)
	if err != nil {
		return nil, err
	}
	stats["total"] = totalCount

	// 待上报告警数
	var pendingCount int
	err = acm.db.QueryRow(`SELECT COUNT(*) FROM pending_alerts WHERE reported = false`).Scan(&pendingCount)
	if err != nil {
		return nil, err
	}
	stats["pending"] = pendingCount

	// 已上报告警数
	stats["reported"] = totalCount - pendingCount

	return stats, nil
}

// CleanupOldAlerts 清理旧告警
func (acm *AlertCacheManager) CleanupOldAlerts(retention time.Duration) (int64, error) {
	acm.mu.Lock()
	defer acm.mu.Unlock()

	cutoff := time.Now().Add(-retention)
	query := `DELETE FROM pending_alerts WHERE timestamp < ? AND reported = true`
	result, err := acm.db.Exec(query, cutoff)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

// scanAlerts 扫描告警行
func (acm *AlertCacheManager) scanAlerts(rows *sql.Rows) ([]*CachedAlert, error) {
	var alerts []*CachedAlert
	for rows.Next() {
		alert := &CachedAlert{}
		var duration int64
		var lastErr sql.NullString

		err := rows.Scan(
			&alert.ID, &alert.RuleID, &alert.RuleName, &alert.PointID,
			&alert.EventType, &alert.Severity, &alert.Value, &alert.Threshold,
			&alert.Condition, &alert.Timestamp, &duration, &alert.Message,
			&alert.Reported, &alert.ReportAttempts, &lastErr, &alert.CreatedAt,
		)
		if err != nil {
			continue
		}

		alert.Duration = time.Duration(duration)
		if lastErr.Valid {
			alert.LastReportError = lastErr.String
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// ExportToJSON 导出告警为JSON
func (acm *AlertCacheManager) ExportToJSON(alertID string) ([]byte, error) {
	acm.mu.RLock()
	defer acm.mu.RUnlock()

	query := `
		SELECT id, rule_id, rule_name, point_id, event_type, severity,
			value, threshold, condition, timestamp, duration, message
		FROM pending_alerts WHERE id = ?
	`
	row := acm.db.QueryRow(query, alertID)

	alert := &CachedAlert{}
	var duration int64
	err := row.Scan(
		&alert.ID, &alert.RuleID, &alert.RuleName, &alert.PointID,
		&alert.EventType, &alert.Severity, &alert.Value, &alert.Threshold,
		&alert.Condition, &alert.Timestamp, &duration, &alert.Message,
	)
	if err != nil {
		return nil, err
	}

	alert.Duration = time.Duration(duration)
	return json.Marshal(alert)
}