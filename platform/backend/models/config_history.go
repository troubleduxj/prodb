package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigChangeType 配置变更类型
type ConfigChangeType string

const (
	ConfigChangeManual    ConfigChangeType = "manual"
	ConfigChangeAutoSync  ConfigChangeType = "auto_sync"
	ConfigChangeRollback  ConfigChangeType = "rollback"
	ConfigChangeImport    ConfigChangeType = "import"
	ConfigChangeMigration ConfigChangeType = "migration"
)

// ConfigSnapshot 配置快照
type ConfigSnapshot struct {
	InterfaceID      uuid.UUID            `json:"interface_id"`
	Name             string               `json:"name"`
	Protocol         ProtocolType         `json:"protocol"`
	Enabled          bool                 `json:"enabled"`
	ConnectionConfig ConnectionConfig     `json:"connection_config"`
	DataPoints       DataPoints           `json:"data_points"`
	EdgeProcessing   EdgeProcessingConfig `json:"edge_processing"`
	ScheduleConfig   ScheduleConfig       `json:"schedule_config"`
	TargetConfig     TargetConfig         `json:"target_config"`
}

// Value 实现 driver.Valuer 接口
func (cs ConfigSnapshot) Value() (driver.Value, error) {
	return json.Marshal(cs)
}

// Scan 实现 sql.Scanner 接口
func (cs *ConfigSnapshot) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into ConfigSnapshot", value)
	}
	return json.Unmarshal(bytes, cs)
}

// InterfaceConfigHistory 接口配置版本历史表
type InterfaceConfigHistory struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`

	// 关联
	InterfaceID uuid.UUID          `gorm:"type:uuid;not null;index" json:"interface_id"`
	Interface   CollectorInterface `gorm:"foreignKey:InterfaceID" json:"interface,omitempty"`

	// 版本信息
	Version int `gorm:"not null" json:"version"`

	// 配置快照
	ConfigSnapshot ConfigSnapshot `gorm:"type:jsonb;not null" json:"config_snapshot"`

	// 变更信息
	ChangeSummary string           `json:"change_summary"`
	ChangeType    ConfigChangeType `gorm:"size:50;default:'manual'" json:"change_type"`

	// 创建者
	CreatedBy *uint `json:"created_by"`
	Creator   *User `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

// BeforeCreate 在创建前设置UUID
func (ich *InterfaceConfigHistory) BeforeCreate(tx *gorm.DB) (err error) {
	if ich.ID == uuid.Nil {
		ich.ID = uuid.New()
	}
	return
}

// TableName 返回表名
func (InterfaceConfigHistory) TableName() string {
	return "interface_config_history"
}

// InterfaceConfigDelivery 接口配置下发状态表（为接口配置单独维护下发状态）
type InterfaceConfigDelivery struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`

	// 关联
	CollectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`

	InterfaceID *uuid.UUID          `gorm:"type:uuid;index" json:"interface_id,omitempty"`
	Interface   *CollectorInterface `gorm:"foreignKey:InterfaceID" json:"interface,omitempty"`

	// 版本信息
	ConfigVersion int `gorm:"not null;default:1" json:"config_version"`

	// 状态
	Status string `gorm:"size:20;default:'pending'" json:"status"` // pending, delivering, delivered, applied, failed, rollback

	// 下发详情
	DeliveredAt  *time.Time `json:"delivered_at,omitempty"`
	AppliedAt    *time.Time `json:"applied_at,omitempty"`
	ErrorMessage string     `json:"error_message,omitempty"`
	Checksum     string     `json:"checksum"`

	// 重试信息
	RetryCount  int        `gorm:"default:0" json:"retry_count"`
	MaxRetries  int        `gorm:"default:3" json:"max_retries"`
	NextRetryAt *time.Time `json:"next_retry_at,omitempty"`

	// 下发内容快照（用于回滚）
	ConfigSnapshot ConfigSnapshot `gorm:"type:jsonb" json:"config_snapshot,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate 在创建前设置UUID
func (icd *InterfaceConfigDelivery) BeforeCreate(tx *gorm.DB) (err error) {
	if icd.ID == uuid.Nil {
		icd.ID = uuid.New()
	}
	return
}

// TableName 返回表名
func (InterfaceConfigDelivery) TableName() string {
	return "interface_config_deliveries"
}

// IsRetryable 是否可重试
func (icd *InterfaceConfigDelivery) IsRetryable() bool {
	if icd.Status != "failed" {
		return false
	}
	return icd.RetryCount < icd.MaxRetries
}

// GetRetryDelay 获取重试延迟（指数退避）
func (icd *InterfaceConfigDelivery) GetRetryDelay() time.Duration {
	// 指数退避: 5s, 10s, 20s
	baseDelay := time.Second * 5
	multiplier := 1 << icd.RetryCount
	return baseDelay * time.Duration(multiplier)
}

// MarkDelivered 标记为已下发
func (icd *InterfaceConfigDelivery) MarkDelivered() {
	now := time.Now()
	icd.Status = "delivered"
	icd.DeliveredAt = &now
}

// MarkApplied 标记为已应用
func (icd *InterfaceConfigDelivery) MarkApplied() {
	now := time.Now()
	icd.Status = "applied"
	icd.AppliedAt = &now
}

// MarkFailed 标记为失败
func (icd *InterfaceConfigDelivery) MarkFailed(err string) {
	icd.Status = "failed"
	icd.ErrorMessage = err
	icd.RetryCount++

	if icd.IsRetryable() {
		nextRetry := time.Now().Add(icd.GetRetryDelay())
		icd.NextRetryAt = &nextRetry
	}
}

// ConfigDeliveryBatchStatus 批量下发批次状态
type ConfigDeliveryBatchStatus string

const (
	BatchStatusPending    ConfigDeliveryBatchStatus = "pending"
	BatchStatusDelivering ConfigDeliveryBatchStatus = "delivering"
	BatchStatusCompleted  ConfigDeliveryBatchStatus = "completed"
	BatchStatusPartial    ConfigDeliveryBatchStatus = "partial"
	BatchStatusFailed     ConfigDeliveryBatchStatus = "failed"
)

// ConfigDeliveryTargetType 下发目标类型
type ConfigDeliveryTargetType string

const (
	DeliveryTargetSingle  ConfigDeliveryTargetType = "single"
	DeliveryTargetGroup   ConfigDeliveryTargetType = "group"
	DeliveryTargetAll     ConfigDeliveryTargetType = "all"
)

// ConfigDeliveryBatch 配置下发批次表
type ConfigDeliveryBatch struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`

	// 批次信息
	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `json:"description,omitempty"`

	// 下发目标
	TargetType ConfigDeliveryTargetType `gorm:"size:20;not null" json:"target_type"`
	TargetID   *uuid.UUID               `gorm:"type:uuid" json:"target_id,omitempty"`

	// 下发内容
	ConfigSnapshot ConfigSnapshot `gorm:"type:jsonb;not null" json:"config_snapshot"`
	InterfaceIDs   []uuid.UUID    `gorm:"type:uuid[]" json:"interface_ids,omitempty"`

	// 状态
	Status ConfigDeliveryBatchStatus `gorm:"size:20;default:'pending'" json:"status"`

	// 统计
	TotalCount   int `json:"total_count"`
	SuccessCount int `json:"success_count"`
	FailedCount  int `json:"failed_count"`

	// 执行时间
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`

	// 创建者
	CreatedBy *uint `json:"created_by"`
	Creator   *User `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate 在创建前设置UUID
func (cdb *ConfigDeliveryBatch) BeforeCreate(tx *gorm.DB) (err error) {
	if cdb.ID == uuid.Nil {
		cdb.ID = uuid.New()
	}
	return
}

// TableName 返回表名
func (ConfigDeliveryBatch) TableName() string {
	return "config_delivery_batches"
}

// Start 开始执行批次
func (cdb *ConfigDeliveryBatch) Start() {
	now := time.Now()
	cdb.Status = BatchStatusDelivering
	cdb.StartedAt = &now
}

// Complete 完成批次
func (cdb *ConfigDeliveryBatch) Complete() {
	now := time.Now()
	cdb.CompletedAt = &now

	if cdb.FailedCount == 0 {
		cdb.Status = BatchStatusCompleted
	} else if cdb.SuccessCount == 0 {
		cdb.Status = BatchStatusFailed
	} else {
		cdb.Status = BatchStatusPartial
	}
}

// IncrementSuccess 增加成功计数
func (cdb *ConfigDeliveryBatch) IncrementSuccess() {
	cdb.SuccessCount++
}

// IncrementFailed 增加失败计数
func (cdb *ConfigDeliveryBatch) IncrementFailed() {
	cdb.FailedCount++
}