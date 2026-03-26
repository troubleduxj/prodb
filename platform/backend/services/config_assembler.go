package services

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"prodb/platform/backend/models"
	"prodb/platform/backend/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigAssembler 配置组装服务
// 负责将采集器的所有接口配置组装成完整的配置结构
type ConfigAssembler struct {
	db            *gorm.DB
	interfaceRepo *repository.CollectorInterfaceRepository
}

// NewConfigAssembler 创建配置组装服务实例
func NewConfigAssembler(db *gorm.DB, interfaceRepo *repository.CollectorInterfaceRepository) *ConfigAssembler {
	return &ConfigAssembler{
		db:            db,
		interfaceRepo: interfaceRepo,
	}
}

// AssembleCollectorConfig 组装采集器完整配置
func (ca *ConfigAssembler) AssembleCollectorConfig(ctx context.Context, collectorID uuid.UUID) (*CollectorConfig, error) {
	// 1. 获取采集器基本信息
	var collector models.Collector
	if err := ca.db.WithContext(ctx).First(&collector, "id = ?", collectorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("collector not found: %s", collectorID)
		}
		return nil, fmt.Errorf("failed to get collector: %w", err)
	}

	// 2. 获取所有接口配置
	interfaces, err := ca.interfaceRepo.GetByCollectorID(ctx, collectorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get interfaces: %w", err)
	}

	// 3. 计算配置版本（所有接口的最大版本号）
	maxVersion := 1
	for _, iface := range interfaces {
		// 这里简化处理，实际应该从历史表中获取
		if iface.UpdatedAt.After(time.Now().Add(-time.Hour * 24 * 365)) {
			maxVersion++
		}
	}

	// 4. 组装配置
	config := &CollectorConfig{
		Version:     maxVersion,
		CollectorID: collectorID.String(),
		GeneratedAt: time.Now().UTC(),
		GlobalConfig: GlobalConfig{
			HeartbeatInterval:  60,
			DataSyncInterval:   300,
			ConfigSyncInterval: 300,
			MaxOfflineStorage:  7 * 24 * time.Hour,
		},
		Interfaces: ca.assembleInterfaces(interfaces),
		EdgeAlerts: ca.assembleEdgeAlerts(interfaces),
	}

	// 5. 计算校验和
	checksum, err := ca.calculateChecksum(config)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate checksum: %w", err)
	}
	config.Checksum = checksum

	return config, nil
}

// assembleInterfaces 组装接口配置
func (ca *ConfigAssembler) assembleInterfaces(interfaces []models.CollectorInterface) []InterfaceConfig {
	result := make([]InterfaceConfig, 0, len(interfaces))

	for _, iface := range interfaces {
		interfaceConfig := InterfaceConfig{
			ID:       iface.ID.String(),
			Name:     iface.Name,
			Protocol: string(iface.Protocol),
			Enabled:  iface.Enabled,
			Connection: ConnectionConfigDTO{
				Host:              iface.ConnectionConfig.Host,
				Port:              iface.ConnectionConfig.Port,
				TimeoutMs:         iface.ConnectionConfig.TimeoutMs,
				RetryCount:        iface.ConnectionConfig.RetryCount,
				Endpoint:          iface.ConnectionConfig.Endpoint,
				SecurityMode:      iface.ConnectionConfig.SecurityMode,
				Username:          iface.ConnectionConfig.Username,
				Password:          "", // 密码不返回
				Broker:            iface.ConnectionConfig.Broker,
				ClientID:          iface.ConnectionConfig.ClientID,
				KeepAliveInterval: iface.ConnectionConfig.KeepAliveInterval,
			},
			DataPoints: ca.assembleDataPoints(iface.DataPoints),
			Schedule: ScheduleConfigDTO{
				Mode:       iface.ScheduleConfig.Mode,
				IntervalMs: iface.ScheduleConfig.IntervalMs,
				CronExpr:   iface.ScheduleConfig.CronExpr,
				Timezone:   iface.ScheduleConfig.Timezone,
			},
			Target: TargetConfigDTO{
				Database:   iface.TargetConfig.Database,
				SuperTable: iface.TargetConfig.SuperTable,
				Tags:       iface.TargetConfig.Tags,
				AutoCreate: iface.TargetConfig.AutoCreate,
			},
			EdgeProcessing: EdgeProcessingConfigDTO{
				Compression: CompressionConfigDTO{
					Enabled:     iface.EdgeProcessing.Compression.Enabled,
					Algorithm:   iface.EdgeProcessing.Compression.Algorithm,
					Threshold:   iface.EdgeProcessing.Compression.Threshold,
					MinInterval: iface.EdgeProcessing.Compression.MinInterval,
					MaxInterval: iface.EdgeProcessing.Compression.MaxInterval,
				},
				Aggregation: AggregationConfigDTO{
					Enabled:  iface.EdgeProcessing.Aggregation.Enabled,
					Window:   iface.EdgeProcessing.Aggregation.Window,
					Function: iface.EdgeProcessing.Aggregation.Function,
				},
				EdgeAlerts: iface.EdgeProcessing.EdgeAlerts,
			},
		}
		result = append(result, interfaceConfig)
	}

	return result
}

// assembleDataPoints 组装采集点配置
func (ca *ConfigAssembler) assembleDataPoints(points models.DataPoints) []DataPointConfigDTO {
	result := make([]DataPointConfigDTO, 0, len(points))

	for _, point := range points {
		dpConfig := DataPointConfigDTO{
			Name:             point.Name,
			Address:          point.Address,
			DataType:         point.DataType,
			Scale:            point.Scale,
			Offset:           point.Offset,
			Unit:             point.Unit,
			SamplingInterval: point.SamplingInterval,
			ReadOnly:         point.ReadOnly,
			Description:      point.Description,
		}

		if point.Compression != nil {
			dpConfig.Compression = &CompressionConfigDTO{
				Enabled:     point.Compression.Enabled,
				Algorithm:   point.Compression.Algorithm,
				Threshold:   point.Compression.Threshold,
				MinInterval: point.Compression.MinInterval,
				MaxInterval: point.Compression.MaxInterval,
			}
		}

		if point.Aggregation != nil {
			dpConfig.Aggregation = &AggregationConfigDTO{
				Enabled:  point.Aggregation.Enabled,
				Window:   point.Aggregation.Window,
				Function: point.Aggregation.Function,
			}
		}

		result = append(result, dpConfig)
	}

	return result
}

// assembleEdgeAlerts 组装边缘告警规则
func (ca *ConfigAssembler) assembleEdgeAlerts(interfaces []models.CollectorInterface) []EdgeAlertRuleDTO {
	// 简化实现：从接口配置中提取需要边缘告警的采集点
	// 实际应该从 edge_alert_rules 表中查询
	result := make([]EdgeAlertRuleDTO, 0)

	for _, iface := range interfaces {
		if !iface.EdgeProcessing.EdgeAlerts {
			continue
		}

		// 为每个采集点生成默认告警规则（示例）
		for _, point := range iface.DataPoints {
			// 这里简化处理，实际应该从数据库查询告警规则
			rule := EdgeAlertRuleDTO{
				RuleID:    fmt.Sprintf("rule_%s_%s", iface.ID.String()[:8], point.Name),
				PointName: point.Name,
				Condition: "gt", // 大于阈值
				Threshold: 100,  // 默认阈值
				Duration:  5000, // 5秒防抖
				Severity:  "warning",
				Enabled:   true,
			}
			result = append(result, rule)
		}
	}

	return result
}

// CalculateDelta 计算配置差异（用于增量同步）
func (ca *ConfigAssembler) CalculateDelta(ctx context.Context, collectorID uuid.UUID, sinceVersion int) (*ConfigDelta, error) {
	// 1. 获取当前完整配置
	currentConfig, err := ca.AssembleCollectorConfig(ctx, collectorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current config: %w", err)
	}

	// 2. 如果请求版本>=当前版本，无需更新
	if sinceVersion >= currentConfig.Version {
		return &ConfigDelta{
			BaseVersion:   sinceVersion,
			TargetVersion: currentConfig.Version,
			Changes:       []ConfigChange{},
			Checksum:      currentConfig.Checksum,
		}, nil
	}

	// 3. 简化实现：返回全量配置作为差异
	// 实际应该对比历史版本，生成真正的增量变更
	changes := []ConfigChange{
		{
			Op:    "replace",
			Path:  "/",
			Value: currentConfig,
		},
	}

	return &ConfigDelta{
		BaseVersion:   sinceVersion,
		TargetVersion: currentConfig.Version,
		Changes:       changes,
		Checksum:      currentConfig.Checksum,
	}, nil
}

// calculateChecksum 计算配置校验和
func (ca *ConfigAssembler) calculateChecksum(config *CollectorConfig) (string, error) {
	// 序列化配置（排除Checksum字段本身）
	configCopy := *config
	configCopy.Checksum = ""

	data, err := json.Marshal(configCopy)
	if err != nil {
		return "", err
	}

	// 计算SHA256
	hash := sha256.Sum256(data)
	return fmt.Sprintf("sha256:%x", hash), nil
}

// ValidateConfig 验证配置有效性
func (ca *ConfigAssembler) ValidateConfig(config *CollectorConfig) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}

	if config.CollectorID == "" {
		return fmt.Errorf("collector_id is required")
	}

	// 验证每个接口配置
	for i, iface := range config.Interfaces {
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

// ==================== DTO 定义 ====================

// CollectorConfig 采集器完整配置（下发给Collector）
type CollectorConfig struct {
	Version      int                `json:"version"`
	Checksum     string             `json:"checksum"`
	GeneratedAt  time.Time          `json:"generated_at"`
	CollectorID  string             `json:"collector_id"`
	GlobalConfig GlobalConfig       `json:"global_config"`
	Interfaces   []InterfaceConfig  `json:"interfaces"`
	EdgeAlerts   []EdgeAlertRuleDTO `json:"edge_alerts"`
}

// GlobalConfig 全局配置
type GlobalConfig struct {
	HeartbeatInterval  int           `json:"heartbeat_interval"`   // 秒
	DataSyncInterval   int           `json:"data_sync_interval"`   // 秒
	ConfigSyncInterval int           `json:"config_sync_interval"` // 秒
	MaxOfflineStorage  time.Duration `json:"max_offline_storage"`  // 最大离线存储时间
}

// InterfaceConfig 接口配置DTO
type InterfaceConfig struct {
	ID             string                  `json:"id"`
	Name           string                  `json:"name"`
	Protocol       string                  `json:"protocol"`
	Enabled        bool                    `json:"enabled"`
	Connection     ConnectionConfigDTO     `json:"connection"`
	DataPoints     []DataPointConfigDTO    `json:"data_points"`
	Schedule       ScheduleConfigDTO       `json:"schedule"`
	Target         TargetConfigDTO         `json:"target"`
	EdgeProcessing EdgeProcessingConfigDTO `json:"edge_processing"`
}

// ConnectionConfigDTO 连接配置DTO
type ConnectionConfigDTO struct {
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

// DataPointConfigDTO 采集点配置DTO
type DataPointConfigDTO struct {
	Name             string                `json:"name"`
	Address          string                `json:"address"`
	DataType         string                `json:"data_type"`
	Scale            float64               `json:"scale"`
	Offset           float64               `json:"offset"`
	Unit             string                `json:"unit"`
	SamplingInterval int                   `json:"sampling_interval_ms"`
	ReadOnly         bool                  `json:"read_only"`
	Description      string                `json:"description,omitempty"`
	Compression      *CompressionConfigDTO `json:"compression,omitempty"`
	Aggregation      *AggregationConfigDTO `json:"aggregation,omitempty"`
}

// ScheduleConfigDTO 调度配置DTO
type ScheduleConfigDTO struct {
	Mode       string `json:"mode"`
	IntervalMs int    `json:"interval_ms"`
	CronExpr   string `json:"cron_expr,omitempty"`
	Timezone   string `json:"timezone,omitempty"`
}

// TargetConfigDTO 目标配置DTO
type TargetConfigDTO struct {
	Database   string            `json:"database"`
	SuperTable string            `json:"super_table"`
	Tags       map[string]string `json:"tags"`
	AutoCreate bool              `json:"auto_create"`
}

// EdgeProcessingConfigDTO 边缘预处理配置DTO
type EdgeProcessingConfigDTO struct {
	Compression CompressionConfigDTO `json:"compression"`
	Aggregation AggregationConfigDTO `json:"aggregation"`
	EdgeAlerts  bool                 `json:"edge_alerts"`
}

// CompressionConfigDTO 压缩配置DTO
type CompressionConfigDTO struct {
	Enabled     bool    `json:"enabled"`
	Algorithm   string  `json:"algorithm"`
	Threshold   float64 `json:"threshold"`
	MinInterval int     `json:"min_interval_ms,omitempty"`
	MaxInterval int     `json:"max_interval_ms"`
}

// AggregationConfigDTO 聚合配置DTO
type AggregationConfigDTO struct {
	Enabled  bool   `json:"enabled"`
	Window   string `json:"window"`
	Function string `json:"function"`
}

// EdgeAlertRuleDTO 边缘告警规则DTO
type EdgeAlertRuleDTO struct {
	RuleID    string  `json:"rule_id"`
	PointName string  `json:"point_name"`
	Condition string  `json:"condition"`
	Threshold float64 `json:"threshold"`
	Duration  int     `json:"duration_ms"`
	Severity  string  `json:"severity"`
	Enabled   bool    `json:"enabled"`
}

// ConfigDelta 配置差异
type ConfigDelta struct {
	BaseVersion   int            `json:"base_version"`
	TargetVersion int            `json:"target_version"`
	Changes       []ConfigChange `json:"changes"`
	Checksum      string         `json:"checksum"`
}

// ConfigChange 配置变更项
type ConfigChange struct {
	Op    string      `json:"op"`    // add, remove, replace
	Path  string      `json:"path"`  // JSON Pointer路径
	Value interface{} `json:"value"` // 新值
}
