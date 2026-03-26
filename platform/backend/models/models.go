package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents the users table
type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"size:50;unique;not null"`
	PasswordHash string    `gorm:"size:255;not null"`
	FullName     string    `gorm:"size:100"`
	Email        string    `gorm:"size:100;unique"`
	PhoneNumber  string    `gorm:"size:20"`
	AvatarURL    string    `gorm:"size:255"`
	Status       int16     `gorm:"not null;default:1"`
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Roles        []*Role `gorm:"many2many:user_roles;"`
}

// Role represents the roles table
type Role struct {
	ID          uint      `gorm:"primaryKey"`
	Name        string    `gorm:"size:50;unique;not null"`
	Description string    `gorm:"size:255"`
	Status      int16     `gorm:"not null;default:1"`
	Permissions []*Permission `gorm:"many2many:role_permissions;"`
}

// PermissionGroup represents the permission_groups table
type PermissionGroup struct {
	ID        uint   `gorm:"primaryKey"`
	Name      string `gorm:"size:50;unique;not null"`
	SortOrder int
}

// Permission represents the permissions table
type Permission struct {
	ID          uint   `gorm:"primaryKey"`
	GroupID     uint
	Group       PermissionGroup `gorm:"foreignKey:GroupID"`
	Name        string `gorm:"size:100;unique;not null"`
	Description string `gorm:"size:255"`
	Type        int16  `gorm:"not null;default:1"`
}

// Collector represents the collectors table
type Collector struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	AgentID        string    `gorm:"size:100;unique" json:"agent_id"`
	Name           string    `gorm:"size:100;not null" json:"name"`
	SecretKey      string    `gorm:"size:255;not null" json:"secret_key"`
	Status         string    `gorm:"size:20;default:'offline'" json:"status"`
	LastHeartbeat  *time.Time `json:"last_heartbeat"`
	ConfigJSON     string `gorm:"type:jsonb" json:"config_json"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (c *Collector) BeforeCreate(tx *gorm.DB) (err error) {
	c.ID = uuid.New()
	return
}

// Interface represents the interfaces table
type Interface struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Type        string    `gorm:"size:50;not null" json:"type"`
	Config      string    `gorm:"type:jsonb" json:"config"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ConfigTemplate represents the config_templates table
type ConfigTemplate struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Name           string    `gorm:"size:100;not null" json:"name"`
	Description    string    `gorm:"type:text" json:"description"`
	Protocol       string    `gorm:"size:50;not null" json:"protocol"`
	TemplateConfig string    `gorm:"type:jsonb;not null" json:"template_config"`
	Version        string    `gorm:"size:20;default:'1.0.0'" json:"version"`
	CreatedBy      uint      `gorm:"not null" json:"created_by"`
	Creator        User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	Status         string    `gorm:"size:20;default:'active'" json:"status"`
	Tags           string    `gorm:"type:jsonb" json:"tags"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ct *ConfigTemplate) BeforeCreate(tx *gorm.DB) (err error) {
	ct.ID = uuid.New()
	return
}

// ConfigTemplateVersion represents the config_template_versions table for version history
type ConfigTemplateVersion struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	TemplateID uuid.UUID `gorm:"type:uuid;not null" json:"template_id"`
	Template   ConfigTemplate `gorm:"foreignKey:TemplateID" json:"template,omitempty"`
	Version    string    `gorm:"size:20;not null" json:"version"`
	Config     string    `gorm:"type:jsonb;not null" json:"config"`
	ChangeLog  string    `gorm:"type:text" json:"change_log"`
	CreatedBy  uint      `gorm:"not null" json:"created_by"`
	Creator    User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ctv *ConfigTemplateVersion) BeforeCreate(tx *gorm.DB) (err error) {
	ctv.ID = uuid.New()
	return
}

// CollectionTask represents the collection_tasks table
type CollectionTask struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Protocol    string    `gorm:"size:50;not null" json:"protocol"`
	Config      string    `gorm:"type:jsonb;not null" json:"config"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	TemplateID  *uuid.UUID `gorm:"type:uuid" json:"template_id"`
	Template    *ConfigTemplate `gorm:"foreignKey:TemplateID" json:"template,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ct *CollectionTask) BeforeCreate(tx *gorm.DB) (err error) {
	ct.ID = uuid.New()
	return
}

// ConfigDelivery represents the config_deliveries table for tracking configuration delivery
type ConfigDelivery struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID  uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Collector    Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Config       string    `gorm:"type:jsonb;not null" json:"config"`
	Version      string    `gorm:"size:50;not null" json:"version"`
	Status       string    `gorm:"size:20;default:'pending'" json:"status"` // pending, delivered, applied, failed, cancelled, rolled_back
	Priority     string    `gorm:"size:10;default:'normal'" json:"priority"` // high, normal, low
	Checksum     string    `gorm:"size:32;not null" json:"checksum"`
	DeliveredAt  *time.Time `json:"delivered_at"`
	AppliedAt    *time.Time `json:"applied_at"`
	ErrorMessage string    `gorm:"type:text" json:"error_message"`
	Retries      int       `gorm:"default:0" json:"retries"`
	MaxRetries   int       `gorm:"default:3" json:"max_retries"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (cd *ConfigDelivery) BeforeCreate(tx *gorm.DB) (err error) {
	cd.ID = uuid.New()
	return
}

// ConfigVersion represents the config_versions table for configuration history
type ConfigVersion struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Version     string    `gorm:"size:50;not null" json:"version"`
	Config      string    `gorm:"type:jsonb;not null" json:"config"`
	Checksum    string    `gorm:"size:32;not null" json:"checksum"`
	IsActive    bool      `gorm:"default:false" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (cv *ConfigVersion) BeforeCreate(tx *gorm.DB) (err error) {
	cv.ID = uuid.New()
	return
}

// AuditLog represents the audit_logs table for security audit logging
type AuditLog struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID        *uint     `gorm:"index" json:"user_id"`
	User          *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CollectorID   *uuid.UUID `gorm:"type:uuid;index" json:"collector_id"`
	Collector     *Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Action        string    `gorm:"size:100;not null;index" json:"action"`
	Resource      string    `gorm:"size:100;not null;index" json:"resource"`
	ResourceID    string    `gorm:"size:100;index" json:"resource_id"`
	Method        string    `gorm:"size:10;not null" json:"method"`
	Path          string    `gorm:"size:255;not null" json:"path"`
	IPAddress     string    `gorm:"size:45;not null;index" json:"ip_address"`
	UserAgent     string    `gorm:"size:500" json:"user_agent"`
	RequestData   string    `gorm:"type:jsonb" json:"request_data"`
	ResponseData  string    `gorm:"type:jsonb" json:"response_data"`
	StatusCode    int       `gorm:"not null" json:"status_code"`
	Duration      int64     `gorm:"not null" json:"duration"` // in milliseconds
	IsSensitive   bool      `gorm:"default:false;index" json:"is_sensitive"`
	RiskLevel     string    `gorm:"size:20;default:'low';index" json:"risk_level"` // low, medium, high, critical
	SessionID     string    `gorm:"size:100;index" json:"session_id"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (al *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	al.ID = uuid.New()
	return
}

// SecurityEvent represents the security_events table for security threat detection
type SecurityEvent struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID        *uint     `gorm:"index" json:"user_id"`
	User          *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CollectorID   *uuid.UUID `gorm:"type:uuid;index" json:"collector_id"`
	Collector     *Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	EventType     string    `gorm:"size:50;not null;index" json:"event_type"` // failed_login, suspicious_activity, brute_force, etc.
	Severity      string    `gorm:"size:20;not null;index" json:"severity"` // low, medium, high, critical
	Status        string    `gorm:"size:20;default:'active';index" json:"status"` // active, resolved, ignored
	IPAddress     string    `gorm:"size:45;not null;index" json:"ip_address"`
	UserAgent     string    `gorm:"size:500" json:"user_agent"`
	Description   string    `gorm:"type:text;not null" json:"description"`
	Details       string    `gorm:"type:jsonb" json:"details"`
	RuleID        string    `gorm:"size:100;index" json:"rule_id"`
	Count         int       `gorm:"default:1" json:"count"`
	FirstSeen     time.Time `gorm:"not null;index" json:"first_seen"`
	LastSeen      time.Time `gorm:"not null;index" json:"last_seen"`
	ResolvedAt    *time.Time `json:"resolved_at"`
	ResolvedBy    *uint     `json:"resolved_by"`
	Resolver      *User     `gorm:"foreignKey:ResolvedBy" json:"resolver,omitempty"`
	Resolution    string    `gorm:"type:text" json:"resolution"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (se *SecurityEvent) BeforeCreate(tx *gorm.DB) (err error) {
	se.ID = uuid.New()
	return
}

// LoginAttempt represents the login_attempts table for tracking login attempts
type LoginAttempt struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Username    string    `gorm:"size:50;not null;index" json:"username"`
	IPAddress   string    `gorm:"size:45;not null;index" json:"ip_address"`
	UserAgent   string    `gorm:"size:500" json:"user_agent"`
	Success     bool      `gorm:"not null;index" json:"success"`
	FailReason  string    `gorm:"size:100" json:"fail_reason"`
	SessionID   string    `gorm:"size:100;index" json:"session_id"`
	AttemptedAt time.Time `gorm:"not null;index" json:"attempted_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (la *LoginAttempt) BeforeCreate(tx *gorm.DB) (err error) {
	la.ID = uuid.New()
	return
}

// TDengineConnection represents the TDengine connections table
type TDengineConnection struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Name            string    `gorm:"size:100;not null;unique" json:"name"`
	Host            string    `gorm:"size:255;not null" json:"host"`
	Port            int       `gorm:"not null;default:6041" json:"port"`
	Username        string    `gorm:"size:100;not null" json:"username"`
	Password        string    `gorm:"size:255;not null" json:"password"`
	Database        string    `gorm:"size:100" json:"database"`
	MaxOpenConns    int       `gorm:"default:20" json:"max_open_conns"`
	MaxIdleConns    int       `gorm:"default:10" json:"max_idle_conns"`
	ConnTimeout     int       `gorm:"default:30" json:"conn_timeout"` // seconds
	IsDefault       bool      `gorm:"default:false" json:"is_default"`
	Status          string    `gorm:"size:20;default:'disconnected'" json:"status"`
	LastConnected   *time.Time `json:"last_connected"`
	Description     string    `gorm:"type:text" json:"description"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (tc *TDengineConnection) BeforeCreate(tx *gorm.DB) (err error) {
	tc.ID = uuid.New()
	return
}

// QueryTemplate represents a saved query template
type QueryTemplate struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Query       string    `gorm:"type:jsonb;not null" json:"query"` // JSON serialized QueryRequest
	CreatedBy   uint      `gorm:"not null" json:"created_by"`
	Creator     User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	IsPublic    bool      `gorm:"default:false" json:"is_public"`
	Tags        string    `gorm:"type:jsonb" json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (qt *QueryTemplate) BeforeCreate(tx *gorm.DB) (err error) {
	qt.ID = uuid.New()
	return
}

// QueryHistory represents query execution history
type QueryHistory struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID        uint      `gorm:"not null" json:"user_id"`
	User          User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Query         string    `gorm:"type:text;not null" json:"query"`
	QueryType     string    `gorm:"size:20;not null" json:"query_type"` // structured, sql
	Database      string    `gorm:"size:100;not null" json:"database"`
	ExecutionTime int64     `gorm:"not null" json:"execution_time"` // milliseconds
	RowCount      int64     `gorm:"not null" json:"row_count"`
	Success       bool      `gorm:"not null" json:"success"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	CreatedAt     time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (qh *QueryHistory) BeforeCreate(tx *gorm.DB) (err error) {
	qh.ID = uuid.New()
	return
}

// ExportJob represents an export job
type ExportJob struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	UserID       uint      `gorm:"not null" json:"user_id"`
	User         User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Query        string    `gorm:"type:jsonb;not null" json:"query"`
	Format       string    `gorm:"size:20;not null" json:"format"`
	Filename     string    `gorm:"size:255;not null" json:"filename"`
	Status       string    `gorm:"size:20;default:'pending'" json:"status"` // pending, processing, completed, failed
	Progress     int       `gorm:"default:0" json:"progress"`               // 0-100
	FileSize     int64     `gorm:"default:0" json:"file_size"`
	FilePath     string    `gorm:"size:500" json:"file_path"`
	RowCount     int64     `gorm:"default:0" json:"row_count"`
	StartedAt    *time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	ErrorMessage string    `gorm:"type:text" json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ej *ExportJob) BeforeCreate(tx *gorm.DB) (err error) {
	ej.ID = uuid.New()
	return
}

// CollectorAuthStatus represents the authentication status of a collector
type CollectorAuthStatus struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID      uuid.UUID  `gorm:"type:uuid;not null;unique" json:"collector_id"`
	Collector        Collector  `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Name             string     `gorm:"size:100;not null" json:"name"`
	IPAddress        string     `gorm:"size:45;not null" json:"ip_address"`
	UserAgent        string     `gorm:"size:500" json:"user_agent"`
	ConnectionTime   time.Time  `gorm:"not null" json:"connection_time"`
	Status           string     `gorm:"size:20;default:'pending'" json:"status"` // pending, approved, rejected, expired, suspended
	AuthToken        string     `gorm:"size:255" json:"auth_token,omitempty"`
	ExpiresAt        *time.Time `json:"expires_at"`
	ApprovedBy       *uint      `json:"approved_by"`
	Approver         *User      `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`
	ApprovedAt       *time.Time `json:"approved_at"`
	RejectedBy       *uint      `json:"rejected_by"`
	Rejector         *User      `gorm:"foreignKey:RejectedBy" json:"rejector,omitempty"`
	RejectedAt       *time.Time `json:"rejected_at"`
	RejectionReason  string     `gorm:"type:text" json:"rejection_reason"`
	LastActivity     *time.Time `json:"last_activity"`
	Metadata         string     `gorm:"type:jsonb" json:"metadata"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (cas *CollectorAuthStatus) BeforeCreate(tx *gorm.DB) (err error) {
	cas.ID = uuid.New()
	return
}

// AuthenticationRule represents authentication rules
type AuthenticationRule struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Type        string    `gorm:"size:50;not null" json:"type"` // ip_whitelist, certificate, token, manual, auto_approve
	Config      string    `gorm:"type:jsonb;not null" json:"config"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	Priority    int       `gorm:"default:0" json:"priority"`
	CreatedBy   uint      `gorm:"not null" json:"created_by"`
	Creator     User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (ar *AuthenticationRule) BeforeCreate(tx *gorm.DB) (err error) {
	ar.ID = uuid.New()
	return
}

// AuthenticationLog represents authentication activity logs
type AuthenticationLog struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	Action      string    `gorm:"size:50;not null" json:"action"` // connect, authenticate, approve, reject, suspend, expire
	Status      string    `gorm:"size:20;not null" json:"status"` // success, failed, pending
	IPAddress   string    `gorm:"size:45;not null" json:"ip_address"`
	UserAgent   string    `gorm:"size:500" json:"user_agent"`
	UserID      *uint     `json:"user_id"`
	User        *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Details     string    `gorm:"type:jsonb" json:"details"`
	Message     string    `gorm:"type:text" json:"message"`
	CreatedAt   time.Time `json:"created_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (al *AuthenticationLog) BeforeCreate(tx *gorm.DB) (err error) {
	al.ID = uuid.New()
	return
}

// NodePoint represents a data collection point
type NodePoint struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Collector   Collector `gorm:"foreignKey:CollectorID" json:"collector,omitempty"`
	DeviceID    string    `gorm:"size:100;not null" json:"device_id"`
	PointName   string    `gorm:"size:128;not null" json:"point_name"`
	Address     string    `gorm:"size:255;not null" json:"address"`
	DataType    string    `gorm:"size:50;not null" json:"data_type"` // INT16, INT32, FLOAT, DOUBLE, BOOL, STRING
	Unit        string    `gorm:"size:16" json:"unit"`
	Description string    `gorm:"type:text" json:"description"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	ScanRate    int       `gorm:"default:1000" json:"scan_rate"` // milliseconds
	ScaleFactor float64   `gorm:"default:1.0" json:"scale_factor"`
	Offset      float64   `gorm:"default:0.0" json:"offset"`
	MinValue    *float64  `json:"min_value"`
	MaxValue    *float64  `json:"max_value"`
	AlarmConfig string    `gorm:"type:jsonb" json:"alarm_config"`
	Tags        string    `gorm:"type:jsonb" json:"tags"`
	CreatedBy   uint      `gorm:"not null" json:"created_by"`
	Creator     User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (np *NodePoint) BeforeCreate(tx *gorm.DB) (err error) {
	np.ID = uuid.New()
	return
}

// BatchOperation represents a batch operation on node points
type BatchOperation struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Type           string    `gorm:"size:50;not null" json:"type"` // create, update, delete, enable, disable, import
	Status         string    `gorm:"size:20;default:'pending'" json:"status"` // pending, processing, completed, failed, cancelled
	Progress       int       `gorm:"default:0" json:"progress"`               // 0-100
	TotalItems     int       `gorm:"not null" json:"total_items"`
	ProcessedItems int       `gorm:"default:0" json:"processed_items"`
	SuccessCount   int       `gorm:"default:0" json:"success_count"`
	ErrorCount     int       `gorm:"default:0" json:"error_count"`
	ErrorDetails   string    `gorm:"type:jsonb" json:"error_details"`
	Parameters     string    `gorm:"type:jsonb" json:"parameters"`
	CreatedBy      uint      `gorm:"not null" json:"created_by"`
	Creator        User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	StartedAt      *time.Time `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (bo *BatchOperation) BeforeCreate(tx *gorm.DB) (err error) {
	bo.ID = uuid.New()
	return
}

// Note: CollectorHeartbeat, CollectorStatus, CollectorMetricsHistory, and CollectorAlert
// are defined in heartbeat.go to avoid duplication
