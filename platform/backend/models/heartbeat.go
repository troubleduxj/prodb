package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CollectorHeartbeat represents the collector_heartbeats table
type CollectorHeartbeat struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Timestamp   time.Time `gorm:"not null;index" json:"timestamp"`
	Status      string    `gorm:"size:20;not null" json:"status"`
	Metrics     string    `gorm:"type:jsonb" json:"metrics"`
	CreatedAt   time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ch *CollectorHeartbeat) BeforeCreate(tx *gorm.DB) (err error) {
	ch.ID = uuid.New()
	return
}

// CollectorStatus represents the collector_status table for current status tracking
type CollectorStatus struct {
	CollectorID       uuid.UUID  `gorm:"type:uuid;primary_key;" json:"collector_id"`
	Collector         Collector  `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Status            string     `gorm:"size:20;not null" json:"status"`
	LastHeartbeat     time.Time  `gorm:"not null;index" json:"last_heartbeat"`
	LastOnline        *time.Time `gorm:"index" json:"last_online"`
	LastOffline       *time.Time `gorm:"index" json:"last_offline"`
	ConsecutiveFailures int      `gorm:"default:0" json:"consecutive_failures"`
	TotalUptime       int64      `gorm:"default:0" json:"total_uptime"` // in seconds
	TotalDowntime     int64      `gorm:"default:0" json:"total_downtime"` // in seconds
	LastMetrics       string     `gorm:"type:jsonb" json:"last_metrics"`
	UpdatedAt         time.Time  `json:"updated_at"`
	CreatedAt         time.Time  `json:"created_at"`
}

// CollectorMetricsHistory represents the collector_metrics_history table
type CollectorMetricsHistory struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Timestamp   time.Time `gorm:"not null;index" json:"timestamp"`
	CPUUsage    *float64  `json:"cpu_usage"`
	MemoryUsage *int64    `json:"memory_usage"`
	DiskUsage   *int64    `json:"disk_usage"`
	NetworkIn   *int64    `json:"network_in"`
	NetworkOut  *int64    `json:"network_out"`
	DataPointsPerSec *float64 `json:"data_points_per_sec"`
	ActiveConnections *int    `json:"active_connections"`
	FailedConnections *int    `json:"failed_connections"`
	CachedDataCount   *int64  `json:"cached_data_count"`
	BufferSize        *int    `json:"buffer_size"`
	CreatedAt   time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (cmh *CollectorMetricsHistory) BeforeCreate(tx *gorm.DB) (err error) {
	cmh.ID = uuid.New()
	return
}

// CollectorAlert represents the collector_alerts table
type CollectorAlert struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	AlertType   string    `gorm:"size:50;not null" json:"alert_type"` // offline, high_error_rate, resource_usage, etc.
	Severity    string    `gorm:"size:20;not null" json:"severity"`   // critical, warning, info
	Title       string    `gorm:"size:200;not null" json:"title"`
	Message     string    `gorm:"type:text;not null" json:"message"`
	Status      string    `gorm:"size:20;default:'active'" json:"status"` // active, acknowledged, resolved
	FiredAt     time.Time `gorm:"not null;index" json:"fired_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	AcknowledgedBy *uint      `json:"acknowledged_by"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	ResolvedBy     *uint      `json:"resolved_by"`
	Metadata    string    `gorm:"type:jsonb" json:"metadata"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ca *CollectorAlert) BeforeCreate(tx *gorm.DB) (err error) {
	ca.ID = uuid.New()
	return
}

// HeartbeatStatistics represents aggregated heartbeat statistics
type HeartbeatStatistics struct {
	CollectorID     uuid.UUID `json:"collector_id"`
	CollectorName   string    `json:"collector_name"`
	Status          string    `json:"status"`
	LastHeartbeat   time.Time `json:"last_heartbeat"`
	UptimePercent   float64   `json:"uptime_percent"`
	AvgResponseTime float64   `json:"avg_response_time"`
	TotalHeartbeats int64     `json:"total_heartbeats"`
	MissedHeartbeats int64    `json:"missed_heartbeats"`
	LastOnline      *time.Time `json:"last_online"`
	LastOffline     *time.Time `json:"last_offline"`
	ConsecutiveFailures int   `json:"consecutive_failures"`
}

// CollectorHealthSummary represents overall collector health
type CollectorHealthSummary struct {
	TotalCollectors    int     `json:"total_collectors"`
	OnlineCollectors   int     `json:"online_collectors"`
	OfflineCollectors  int     `json:"offline_collectors"`
	WarningCollectors  int     `json:"warning_collectors"`
	CriticalCollectors int     `json:"critical_collectors"`
	OverallHealth      float64 `json:"overall_health"` // percentage
	LastUpdated        time.Time `json:"last_updated"`
}