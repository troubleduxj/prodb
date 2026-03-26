package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProtocolType 协议类型
type ProtocolType string

const (
	ProtocolModbusTCP ProtocolType = "modbus_tcp"
	ProtocolModbusRTU ProtocolType = "modbus_rtu"
	ProtocolOPCUA     ProtocolType = "opcua"
	ProtocolMQTT      ProtocolType = "mqtt"
)

// ConnectionConfig 连接配置（JSONB）
type ConnectionConfig struct {
	// Modbus TCP/RTU
	Host       string `json:"host,omitempty"`
	Port       int    `json:"port,omitempty"`
	TimeoutMs  int    `json:"timeout_ms,omitempty"`
	RetryCount int    `json:"retry_count,omitempty"`

	// OPC UA
	Endpoint      string `json:"endpoint,omitempty"`
	SecurityMode  string `json:"security_mode,omitempty"`
	Username      string `json:"username,omitempty"`
	Password      string `json:"password,omitempty"`

	// MQTT
	Broker   string `json:"broker,omitempty"`
	ClientID string `json:"client_id,omitempty"`

	// 通用字段
	KeepAliveInterval int `json:"keep_alive_interval,omitempty"`
}

// Value 实现 driver.Valuer 接口
func (cc ConnectionConfig) Value() (driver.Value, error) {
	return json.Marshal(cc)
}

// Scan 实现 sql.Scanner 接口
func (cc *ConnectionConfig) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into ConnectionConfig", value)
	}
	return json.Unmarshal(bytes, cc)
}

// DataPointConfig 采集点配置
type DataPointConfig struct {
	Name             string  `json:"name"`
	Address          string  `json:"address"`
	DataType         string  `json:"data_type"` // int16, int32, float32, float64, bool, string
	Scale            float64 `json:"scale"`
	Offset           float64 `json:"offset"`
	Unit             string  `json:"unit"`
	SamplingInterval int     `json:"sampling_interval_ms"`
	ReadOnly         bool    `json:"read_only"`
	Description      string  `json:"description,omitempty"`

	// 边缘预处理配置
	Compression *CompressionConfig `json:"compression,omitempty"`
	Aggregation *AggregationConfig `json:"aggregation,omitempty"`
}

// CompressionConfig 压缩配置
type CompressionConfig struct {
	Enabled     bool    `json:"enabled"`
	Algorithm   string  `json:"algorithm"` // deadband, swinging_door
	Threshold   float64 `json:"threshold"`
	MinInterval int     `json:"min_interval_ms,omitempty"`
	MaxInterval int     `json:"max_interval_ms"`
}

// AggregationConfig 聚合配置
type AggregationConfig struct {
	Enabled  bool   `json:"enabled"`
	Window   string `json:"window"`   // e.g., "1m", "5m", "1h"
	Function string `json:"function"` // avg, min, max, last, first, count
}

// DataPoints 采集点数组类型
type DataPoints []DataPointConfig

// Value 实现 driver.Valuer 接口
func (dp DataPoints) Value() (driver.Value, error) {
	return json.Marshal(dp)
}

// Scan 实现 sql.Scanner 接口
func (dp *DataPoints) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into DataPoints", value)
	}
	return json.Unmarshal(bytes, dp)
}

// EdgeProcessingConfig 边缘预处理配置
type EdgeProcessingConfig struct {
	Compression  CompressionConfig `json:"compression"`
	Aggregation  AggregationConfig `json:"aggregation"`
	EdgeAlerts   bool              `json:"edge_alerts"`
}

// Value 实现 driver.Valuer 接口
func (ep EdgeProcessingConfig) Value() (driver.Value, error) {
	return json.Marshal(ep)
}

// Scan 实现 sql.Scanner 接口
func (ep *EdgeProcessingConfig) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into EdgeProcessingConfig", value)
	}
	return json.Unmarshal(bytes, ep)
}

// ScheduleConfig 采集调度配置
type ScheduleConfig struct {
	Mode         string `json:"mode"`          // interval, cron
	IntervalMs   int    `json:"interval_ms"`   // 用于 interval 模式
	CronExpr     string `json:"cron_expr"`     // 用于 cron 模式
	Timezone     string `json:"timezone"`      // 时区
}

// Value 实现 driver.Valuer 接口
func (sc ScheduleConfig) Value() (driver.Value, error) {
	return json.Marshal(sc)
}

// Scan 实现 sql.Scanner 接口
func (sc *ScheduleConfig) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into ScheduleConfig", value)
	}
	return json.Unmarshal(bytes, sc)
}

// TargetConfig 数据目标配置
type TargetConfig struct {
	Database    string            `json:"database"`
	SuperTable  string            `json:"super_table"`
	Tags        map[string]string `json:"tags"`
	AutoCreate  bool              `json:"auto_create"` // 是否自动创建子表
}

// Value 实现 driver.Valuer 接口
func (tc TargetConfig) Value() (driver.Value, error) {
	return json.Marshal(tc)
}

// Scan 实现 sql.Scanner 接口
func (tc *TargetConfig) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into TargetConfig", value)
	}
	return json.Unmarshal(bytes, tc)
}

// CollectorInterface 采集器接口配置表
type CollectorInterface struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`

	// 关联
	CollectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`

	// 基本信息
	Name     string       `gorm:"size:100;not null" json:"name"`
	Protocol ProtocolType `gorm:"size:50;not null" json:"protocol"`
	Enabled  bool         `gorm:"default:true" json:"enabled"`

	// 配置（JSONB）
	ConnectionConfig ConnectionConfig     `gorm:"type:jsonb;not null" json:"connection_config"`
	DataPoints       DataPoints           `gorm:"type:jsonb;not null" json:"data_points"`
	EdgeProcessing   EdgeProcessingConfig `gorm:"type:jsonb" json:"edge_processing"`
	ScheduleConfig   ScheduleConfig       `gorm:"type:jsonb" json:"schedule_config"`
	TargetConfig     TargetConfig         `gorm:"type:jsonb" json:"target_config"`

	// 时间戳
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate 在创建前设置UUID
func (ci *CollectorInterface) BeforeCreate(tx *gorm.DB) (err error) {
	if ci.ID == uuid.Nil {
		ci.ID = uuid.New()
	}
	return
}

// TableName 返回表名
func (CollectorInterface) TableName() string {
	return "collector_interfaces"
}

// GetDataPointByName 根据名称获取采集点配置
func (ci *CollectorInterface) GetDataPointByName(name string) *DataPointConfig {
	for i := range ci.DataPoints {
		if ci.DataPoints[i].Name == name {
			return &ci.DataPoints[i]
		}
	}
	return nil
}

// UpdateDataPoint 更新采集点配置
func (ci *CollectorInterface) UpdateDataPoint(point DataPointConfig) bool {
	for i := range ci.DataPoints {
		if ci.DataPoints[i].Name == point.Name {
			ci.DataPoints[i] = point
			return true
		}
	}
	return false
}

// AddDataPoint 添加采集点配置
func (ci *CollectorInterface) AddDataPoint(point DataPointConfig) {
	ci.DataPoints = append(ci.DataPoints, point)
}

// RemoveDataPoint 删除采集点配置
func (ci *CollectorInterface) RemoveDataPoint(name string) bool {
	for i := range ci.DataPoints {
		if ci.DataPoints[i].Name == name {
			ci.DataPoints = append(ci.DataPoints[:i], ci.DataPoints[i+1:]...)
			return true
		}
	}
	return false
}

// GetConnectionInfo 获取连接信息摘要（用于日志）
func (ci *CollectorInterface) GetConnectionInfo() string {
	switch ci.Protocol {
	case ProtocolModbusTCP:
		return fmt.Sprintf("%s:%d", ci.ConnectionConfig.Host, ci.ConnectionConfig.Port)
	case ProtocolOPCUA:
		return ci.ConnectionConfig.Endpoint
	case ProtocolMQTT:
		return ci.ConnectionConfig.Broker
	default:
		return "unknown"
	}
}
