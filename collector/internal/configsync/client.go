// Package configsync 提供从Platform拉取配置的功能
package configsync

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/logger"
)

// ClientConfig 配置同步客户端配置
type ClientConfig struct {
	PlatformBaseURL   string
	ConfigEndpoint    string // /api/v1/collectors/{collector_id}/config
	ConfirmEndpoint   string // /api/v1/collectors/{collector_id}/config/confirm
	SyncInterval      time.Duration
	RetryInterval     time.Duration
	MaxRetries        int
	Timeout           time.Duration
}

// ConfigSyncClient 配置同步客户端
type ConfigSyncClient struct {
	config       *ClientConfig
	authManager  *auth.AuthManager
	httpClient   *http.Client
	collectorID  string
	logger       *logger.Logger
	
	// 状态
	currentVersion int
	isFirstSync    bool
}

// NewConfigSyncClient 创建配置同步客户端
func NewConfigSyncClient(cfg *ClientConfig, collectorID string, authManager *auth.AuthManager, log *logger.Logger) *ConfigSyncClient {
	return &ConfigSyncClient{
		config: cfg,
		authManager: authManager,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		collectorID:    collectorID,
		logger:         log,
		currentVersion: 0,
		isFirstSync:    true,
	}
}

// SyncResult 同步结果
type SyncResult struct {
	Success        bool
	HasChanges     bool
	Version        int
	Checksum       string
	Config         *PlatformConfig
	Error          error
	IsFullSync     bool
}

// PlatformConfig Platform下发的配置结构
type PlatformConfig struct {
	Version      int                `json:"version"`
	Checksum     string             `json:"checksum"`
	GeneratedAt  time.Time          `json:"generated_at"`
	CollectorID  string             `json:"collector_id"`
	GlobalConfig GlobalConfig       `json:"global_config"`
	Interfaces   []InterfaceConfig  `json:"interfaces"`
	EdgeAlerts   []EdgeAlertRule    `json:"edge_alerts"`
}

// GlobalConfig 全局配置
type GlobalConfig struct {
	HeartbeatInterval  int           `json:"heartbeat_interval"`
	DataSyncInterval   int           `json:"data_sync_interval"`
	ConfigSyncInterval int           `json:"config_sync_interval"`
	MaxOfflineStorage  time.Duration `json:"max_offline_storage"`
}

// InterfaceConfig 接口配置
type InterfaceConfig struct {
	ID             string                  `json:"id"`
	Name           string                  `json:"name"`
	Protocol       string                  `json:"protocol"`
	Enabled        bool                    `json:"enabled"`
	Connection     ConnectionConfig        `json:"connection"`
	DataPoints     []DataPointConfig       `json:"data_points"`
	Schedule       ScheduleConfig          `json:"schedule"`
	Target         TargetConfig            `json:"target"`
	EdgeProcessing EdgeProcessingConfig    `json:"edge_processing"`
}

// ConnectionConfig 连接配置
type ConnectionConfig struct {
	Host              string `json:"host,omitempty"`
	Port              int    `json:"port,omitempty"`
	TimeoutMs         int    `json:"timeout_ms,omitempty"`
	RetryCount        int    `json:"retry_count,omitempty"`
	Endpoint          string `json:"endpoint,omitempty"`
	SecurityMode      string `json:"security_mode,omitempty"`
	Username          string `json:"username,omitempty"`
	Password          string `json:"password,omitempty"`
	Broker            string `json:"broker,omitempty"`
	ClientID          string `json:"client_id,omitempty"`
	KeepAliveInterval int    `json:"keep_alive_interval,omitempty"`
}

// DataPointConfig 采集点配置
type DataPointConfig struct {
	Name             string            `json:"name"`
	Address          string            `json:"address"`
	DataType         string            `json:"data_type"`
	Scale            float64           `json:"scale"`
	Offset           float64           `json:"offset"`
	Unit             string            `json:"unit"`
	SamplingInterval int               `json:"sampling_interval_ms"`
	ReadOnly         bool              `json:"read_only"`
	Description      string            `json:"description,omitempty"`
}

// ScheduleConfig 调度配置
type ScheduleConfig struct {
	Mode       string `json:"mode"`        // interval, cron
	IntervalMs int    `json:"interval_ms"`
	CronExpr   string `json:"cron_expr,omitempty"`
	Timezone   string `json:"timezone,omitempty"`
}

// TargetConfig 目标配置
type TargetConfig struct {
	Database   string            `json:"database"`
	SuperTable string            `json:"super_table"`
	Tags       map[string]string `json:"tags"`
	AutoCreate bool              `json:"auto_create"`
}

// EdgeProcessingConfig 边缘处理配置
type EdgeProcessingConfig struct {
	Compression CompressionConfig `json:"compression"`
	Aggregation AggregationConfig `json:"aggregation"`
	EdgeAlerts  []EdgeAlertConfig `json:"edge_alerts"`
}

// CompressionConfig 压缩配置
type CompressionConfig struct {
	Enabled     bool    `json:"enabled"`
	Algorithm   string  `json:"algorithm"`    // deadband, swinging_door
	Threshold   float64 `json:"threshold"`    // 死区阈值或摆动门偏差
	MinInterval int     `json:"min_interval"` // 最小上报间隔(ms)
	MaxInterval int     `json:"max_interval"` // 最大上报间隔(ms)
}

// AggregationConfig 聚合配置
type AggregationConfig struct {
	Enabled  bool   `json:"enabled"`
	Window   int    `json:"window"`   // 窗口大小(ms)
	Function string `json:"function"` // avg, max, min, sum, count
}

// EdgeAlertConfig 边缘告警配置
type EdgeAlertConfig struct {
	Name      string  `json:"name"`
	PointName string  `json:"point_name"`
	Condition string  `json:"condition"` // >, <, =, !=, >=, <=
	Threshold float64 `json:"threshold"`
	Duration  int     `json:"duration"`  // 持续时间(ms)
	Severity  string  `json:"severity"`  // info, warning, critical
	Enabled   bool    `json:"enabled"`
}

// EdgeAlertRule 边缘告警规则
type EdgeAlertRule struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	PointName string  `json:"point_name"`
	Condition string  `json:"condition"`
	Threshold float64 `json:"threshold"`
	Duration  int     `json:"duration"`
	Severity  string  `json:"severity"`
	Enabled   bool    `json:"enabled"`
}

// ConfirmRequest 配置确认请求
type ConfirmRequest struct {
	DeliveryID *string   `json:"delivery_id,omitempty"`
	Version    int       `json:"version"`
	Checksum   string    `json:"checksum"`
	AppliedAt  time.Time `json:"applied_at"`
	Success    bool      `json:"success"`
	Error      string    `json:"error,omitempty"`
}

// Sync 执行配置同步
func (c *ConfigSyncClient) Sync(ctx context.Context) *SyncResult {
	// 构建请求URL
	url := fmt.Sprintf("%s%s", c.config.PlatformBaseURL, 
		fmt.Sprintf(c.config.ConfigEndpoint, c.collectorID))
	
	// 如果是增量同步，添加版本参数
	if !c.isFirstSync && c.currentVersion > 0 {
		url = fmt.Sprintf("%s?version=%d", url, c.currentVersion)
	}
	
	// 创建请求
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return &SyncResult{Success: false, Error: fmt.Errorf("failed to create request: %w", err)}
	}
	
	// 添加认证头
	token := c.authManager.GetAccessToken()
	if token == "" {
		return &SyncResult{Success: false, Error: fmt.Errorf("access token is empty")}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	
	// 发送请求
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &SyncResult{Success: false, Error: fmt.Errorf("failed to send request: %w", err)}
	}
	defer resp.Body.Close()
	
	// 处理响应
	if resp.StatusCode == http.StatusNotModified {
		// 配置未变化
		return &SyncResult{
			Success:    true,
			HasChanges: false,
			Version:    c.currentVersion,
		}
	}
	
	if resp.StatusCode != http.StatusOK {
		return &SyncResult{
			Success: false,
			Error:   fmt.Errorf("unexpected status code: %d", resp.StatusCode),
		}
	}
	
	// 解析配置
	var config PlatformConfig
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return &SyncResult{Success: false, Error: fmt.Errorf("failed to decode config: %w", err)}
	}
	
	// 验证配置
	if err := c.validateConfig(&config); err != nil {
		return &SyncResult{Success: false, Error: fmt.Errorf("config validation failed: %w", err)}
	}
	
	c.logger.Info("Config synced successfully", 
		"version", config.Version,
		"interfaces", len(config.Interfaces))
	
	return &SyncResult{
		Success:    true,
		HasChanges: true,
		Version:    config.Version,
		Checksum:   config.Checksum,
		Config:     &config,
		IsFullSync: c.isFirstSync || config.Version <= c.currentVersion+1,
	}
}

// SyncWithRetry 带重试的配置同步
func (c *ConfigSyncClient) SyncWithRetry(ctx context.Context) *SyncResult {
	var lastErr error
	
	for attempt := 0; attempt < c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			c.logger.Info("Retrying config sync", "attempt", attempt+1)
			time.Sleep(c.config.RetryInterval)
		}
		
		result := c.Sync(ctx)
		if result.Success {
			return result
		}
		lastErr = result.Error
	}
	
	return &SyncResult{
		Success: false,
		Error:   fmt.Errorf("max retries exceeded: %w", lastErr),
	}
}

// ConfirmApplied 向Platform确认配置已应用
func (c *ConfigSyncClient) ConfirmApplied(ctx context.Context, deliveryID *string, version int, checksum string, success bool, errMsg string) error {
	url := fmt.Sprintf("%s%s", c.config.PlatformBaseURL,
		fmt.Sprintf(c.config.ConfirmEndpoint, c.collectorID))
	
	reqBody := ConfirmRequest{
		DeliveryID: deliveryID,
		Version:    version,
		Checksum:   checksum,
		AppliedAt:  time.Now().UTC(),
		Success:    success,
		Error:      errMsg,
	}
	
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal confirm request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create confirm request: %w", err)
	}
	
	token := c.authManager.GetAccessToken()
	if token == "" {
		return fmt.Errorf("access token is empty")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send confirm request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("confirm request failed with status: %d", resp.StatusCode)
	}
	
	// 更新当前版本
	if success {
		c.currentVersion = version
		c.isFirstSync = false
	}
	
	return nil
}

// UpdateCurrentVersion 更新当前版本号
func (c *ConfigSyncClient) UpdateCurrentVersion(version int) {
	c.currentVersion = version
	c.isFirstSync = false
}

// GetCurrentVersion 获取当前版本号
func (c *ConfigSyncClient) GetCurrentVersion() int {
	return c.currentVersion
}

// IsFirstSync 是否是首次同步
func (c *ConfigSyncClient) IsFirstSync() bool {
	return c.isFirstSync
}

// validateConfig 验证配置有效性
func (c *ConfigSyncClient) validateConfig(config *PlatformConfig) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}
	
	if config.CollectorID != c.collectorID {
		return fmt.Errorf("collector_id mismatch: expected %s, got %s", c.collectorID, config.CollectorID)
	}
	
	if config.Version <= 0 {
		return fmt.Errorf("invalid version: %d", config.Version)
	}
	
	// 验证接口配置
	for i, iface := range config.Interfaces {
		if iface.ID == "" {
			return fmt.Errorf("interface[%d]: id is required", i)
		}
		if iface.Name == "" {
			return fmt.Errorf("interface[%d]: name is required", i)
		}
		if iface.Protocol == "" {
			return fmt.Errorf("interface[%d]: protocol is required", i)
		}
		if len(iface.DataPoints) == 0 {
			return fmt.Errorf("interface[%d]: at least one data point is required", i)
		}
	}
	
	return nil
}

// GetCollectorID 获取采集器ID
func (c *ConfigSyncClient) GetCollectorID() string {
	return c.collectorID
}