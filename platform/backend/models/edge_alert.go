package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EdgeAlertRule 边缘告警规则
type EdgeAlertRule struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID   uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	InterfaceID   uuid.UUID `gorm:"type:uuid;not null;index" json:"interface_id"`
	Name          string    `gorm:"size:100;not null" json:"name"`
	PointName     string    `gorm:"size:255;not null" json:"point_name"`
	Condition     string    `gorm:"size:10;not null" json:"condition"` // >, <, =, !=, >=, <=
	Threshold     float64   `json:"threshold"`
	Duration      int       `json:"duration"` // 持续时间(ms)
	Severity      string    `gorm:"size:20;not null" json:"severity"` // info, warning, critical
	Enabled       bool      `gorm:"default:true" json:"enabled"`
	Description   string    `gorm:"size:500" json:"description,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// BeforeCreate 在创建前设置UUID
func (e *EdgeAlertRule) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (EdgeAlertRule) TableName() string {
	return "edge_alert_rules"
}

// EdgeAlertEvent 边缘告警事件
type EdgeAlertEvent struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	RuleID          uuid.UUID `gorm:"type:uuid;not null;index" json:"rule_id"`
	CollectorID     uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	InterfaceID     uuid.UUID `gorm:"type:uuid;not null;index" json:"interface_id"`
	PointName       string    `gorm:"size:255;not null" json:"point_name"`
	EventType       string    `gorm:"size:20;not null" json:"event_type"` // trigger, recovery
	Severity        string    `gorm:"size:20;not null" json:"severity"`
	Value           *float64  `json:"value,omitempty"`
	Threshold       *float64  `json:"threshold,omitempty"`
	Condition       string    `gorm:"size:10" json:"condition,omitempty"`
	EdgeTimestamp   time.Time `json:"edge_timestamp"`
	LocalTimestamp  time.Time `json:"local_timestamp"`
	Reported        bool      `gorm:"default:false" json:"reported"`
	ReportedAt      *time.Time `json:"reported_at,omitempty"`
	ReportAttempts  int       `gorm:"default:0" json:"report_attempts"`
	LastReportError string    `gorm:"size:500" json:"last_report_error,omitempty"`
	Metadata        string    `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// BeforeCreate 在创建前设置UUID
func (e *EdgeAlertEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (EdgeAlertEvent) TableName() string {
	return "edge_alert_events"
}

// MarkReported 标记为已上报
func (e *EdgeAlertEvent) MarkReported() {
	e.Reported = true
	now := time.Now()
	e.ReportedAt = &now
}

// IncrementRetry 增加重试计数
func (e *EdgeAlertEvent) IncrementRetry(errMsg string) {
	e.ReportAttempts++
	e.LastReportError = errMsg
}

// IsRetryable 是否可重试
func (e *EdgeAlertEvent) IsRetryable(maxRetries int) bool {
	return !e.Reported && e.ReportAttempts < maxRetries
}