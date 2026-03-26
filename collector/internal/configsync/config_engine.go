// Package configsync 配置同步相关功能
package configsync

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/protocol"
)

// ApplyResult 配置应用结果
type ApplyResult struct {
	Success      bool
	InterfaceID  string
	ChangeType   ChangeType
	Error        error
	AppliedAt    time.Time
	RequiresRestart bool
}

// ConfigEngine 配置应用引擎
type ConfigEngine struct {
	cacheManager  *CacheManager
	protocolMgr   *protocol.ProtocolManager
	logger        interface {
		Info(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
		Warn(msg string, keysAndValues ...interface{})
	}
	
	// 任务运行时管理
	taskManager   *TaskLifecycleManager
	
	// 状态
	currentConfig *PlatformConfig
	mu            sync.RWMutex
	
	// 变更回调
	changeCallbacks []ConfigChangeCallback
}

// ConfigChangeCallback 配置变更回调函数
type ConfigChangeCallback func(change InterfaceChange, result ApplyResult)

// NewConfigEngine 创建配置应用引擎
func NewConfigEngine(cacheMgr *CacheManager, protocolMgr *protocol.ProtocolManager, taskMgr *TaskLifecycleManager, logger interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
	Warn(msg string, keysAndValues ...interface{})
}) *ConfigEngine {
	return &ConfigEngine{
		cacheManager:    cacheMgr,
		protocolMgr:     protocolMgr,
		logger:          logger,
		taskManager:     taskMgr,
		changeCallbacks: make([]ConfigChangeCallback, 0),
	}
}

// RegisterChangeCallback 注册配置变更回调
func (ce *ConfigEngine) RegisterChangeCallback(callback ConfigChangeCallback) {
	ce.changeCallbacks = append(ce.changeCallbacks, callback)
}

// GetCurrentConfig 获取当前配置
func (ce *ConfigEngine) GetCurrentConfig() *PlatformConfig {
	ce.mu.RLock()
	defer ce.mu.RUnlock()
	return ce.currentConfig
}

// ApplyConfig 应用新配置
func (ce *ConfigEngine) ApplyConfig(ctx context.Context, newConfig *PlatformConfig) []ApplyResult {
	ce.mu.Lock()
	oldConfig := ce.currentConfig
	ce.mu.Unlock()
	
	// 检测变更
	detector := NewChangeDetector(oldConfig, newConfig)
	changes := detector.DetectChanges()
	
	if len(changes) == 0 {
		ce.logger.Info("No configuration changes detected")
		return nil
	}
	
	ce.logger.Info("Applying configuration changes", "change_count", len(changes))
	
	var results []ApplyResult
	
	// 判断是否需要完全重载
	if detector.IsFullReloadRequired() {
		ce.logger.Info("Full reload required")
		result := ce.performFullReload(ctx, oldConfig, newConfig)
		results = append(results, result...)
	} else {
		// 增量应用
		for _, change := range changes {
			result := ce.applyIncrementalChange(ctx, change)
			results = append(results, result)
		}
	}
	
	// 更新当前配置
	ce.mu.Lock()
	ce.currentConfig = newConfig
	ce.mu.Unlock()
	
	// 保存到缓存
	if err := ce.cacheManager.SaveConfig("global", "current", newConfig, newConfig.Version); err != nil {
		ce.logger.Error("Failed to cache config", "error", err)
	}
	
	// 触发回调
	for i, change := range changes {
		for _, callback := range ce.changeCallbacks {
			callback(change, results[i])
		}
	}
	
	return results
}

// performFullReload 执行完全重载
func (ce *ConfigEngine) performFullReload(ctx context.Context, oldConfig, newConfig *PlatformConfig) []ApplyResult {
	var results []ApplyResult
	
	// 1. 停止所有现有任务
	if oldConfig != nil {
		for _, iface := range oldConfig.Interfaces {
			ce.logger.Info("Stopping interface", "interface_id", iface.ID, "name", iface.Name)
			if err := ce.taskManager.StopTask(iface.ID); err != nil {
				ce.logger.Error("Failed to stop task", "interface_id", iface.ID, "error", err)
			}
			results = append(results, ApplyResult{
				Success:     true,
				InterfaceID: iface.ID,
				ChangeType:  ChangeTypeRemove,
				AppliedAt:   time.Now(),
			})
		}
	}
	
	// 2. 启动新配置的所有任务
	for _, iface := range newConfig.Interfaces {
		if !iface.Enabled {
			ce.logger.Info("Interface disabled, skipping", "interface_id", iface.ID, "name", iface.Name)
			continue
		}
		
		result := ce.startInterfaceTask(ctx, iface)
		results = append(results, result)
	}
	
	return results
}

// applyIncrementalChange 应用增量变更
func (ce *ConfigEngine) applyIncrementalChange(ctx context.Context, change InterfaceChange) ApplyResult {
	switch change.ChangeType {
	case ChangeTypeAdd:
		return ce.startInterfaceTask(ctx, *change.NewInterface)
		
	case ChangeTypeRemove:
		if err := ce.taskManager.StopTask(change.InterfaceID); err != nil {
			return ApplyResult{
				Success:     false,
				InterfaceID: change.InterfaceID,
				ChangeType:  ChangeTypeRemove,
				Error:       err,
				AppliedAt:   time.Now(),
			}
		}
		return ApplyResult{
			Success:     true,
			InterfaceID: change.InterfaceID,
			ChangeType:  ChangeTypeRemove,
			AppliedAt:   time.Now(),
		}
		
	case ChangeTypeUpdate:
		// 判断是否需要重启任务
		requiresRestart := ce.requiresTaskRestart(change.Changes)
		
		if requiresRestart {
			// 停止旧任务
			if err := ce.taskManager.StopTask(change.InterfaceID); err != nil {
				ce.logger.Error("Failed to stop task for restart", "interface_id", change.InterfaceID, "error", err)
			}
			// 启动新任务
			return ce.startInterfaceTask(ctx, *change.NewInterface)
		}
		
		// 热更新：只更新部分配置
		return ce.hotUpdateTask(change.InterfaceID, change.Changes)
	}
	
	return ApplyResult{
		Success:     false,
		InterfaceID: change.InterfaceID,
		ChangeType:  change.ChangeType,
		Error:       fmt.Errorf("unknown change type: %s", change.ChangeType),
		AppliedAt:   time.Now(),
	}
}

// startInterfaceTask 启动接口任务
func (ce *ConfigEngine) startInterfaceTask(ctx context.Context, iface InterfaceConfig) ApplyResult {
	ce.logger.Info("Starting interface task", 
		"interface_id", iface.ID, 
		"name", iface.Name, 
		"protocol", iface.Protocol)
	
	// 创建任务配置
	taskConfig := ce.convertToTaskConfig(iface)
	
	// 启动任务
	if err := ce.taskManager.StartTask(ctx, iface.ID, taskConfig); err != nil {
		ce.logger.Error("Failed to start task", "interface_id", iface.ID, "error", err)
		return ApplyResult{
			Success:     false,
			InterfaceID: iface.ID,
			ChangeType:  ChangeTypeAdd,
			Error:       err,
			AppliedAt:   time.Now(),
		}
	}
	
	return ApplyResult{
		Success:     true,
		InterfaceID: iface.ID,
		ChangeType:  ChangeTypeAdd,
		AppliedAt:   time.Now(),
	}
}

// hotUpdateTask 热更新任务配置
func (ce *ConfigEngine) hotUpdateTask(interfaceID string, changes []ConfigChange) ApplyResult {
	ce.logger.Info("Hot updating task", "interface_id", interfaceID)
	
	// 更新任务配置（无需重启）
	if err := ce.taskManager.UpdateTaskConfig(interfaceID, changes); err != nil {
		return ApplyResult{
			Success:     false,
			InterfaceID: interfaceID,
			ChangeType:  ChangeTypeUpdate,
			Error:       err,
			AppliedAt:   time.Now(),
		}
	}
	
	return ApplyResult{
		Success:     true,
		InterfaceID: interfaceID,
		ChangeType:  ChangeTypeUpdate,
		AppliedAt:   time.Now(),
	}
}

// requiresTaskRestart 判断变更是否需要重启任务
func (ce *ConfigEngine) requiresTaskRestart(changes []ConfigChange) bool {
	for _, change := range changes {
		// 连接配置变更需要重启
		if change.EntityType == "connection" {
			return true
		}
		
		// 数据点增删需要重启
		if change.EntityType == "datapoint" && (change.Type == ChangeTypeAdd || change.Type == ChangeTypeRemove) {
			return true
		}
		
		// 协议类型变更需要重启
		if change.Field == "protocol" {
			return true
		}
	}
	return false
}

// convertToTaskConfig 转换配置为任务配置
func (ce *ConfigEngine) convertToTaskConfig(iface InterfaceConfig) map[string]interface{} {
	config := map[string]interface{}{
		"task_id":    iface.ID,
		"name":       iface.Name,
		"protocol":   iface.Protocol,
		"enabled":    iface.Enabled,
		"connection": convertConnectionToMap(iface.Connection),
		"data_points": convertDataPointsToMaps(iface.DataPoints),
		"schedule": map[string]interface{}{
			"interval": iface.Schedule.IntervalMs / 1000, // 转换为秒
			"unit":     "seconds",
		},
		"target": map[string]interface{}{
			"database":    iface.Target.Database,
			"super_table": iface.Target.SuperTable,
			"tags":        iface.Target.Tags,
		},
		"edge_processing": map[string]interface{}{
			"compression": map[string]interface{}{
				"enabled":      iface.EdgeProcessing.Compression.Enabled,
				"algorithm":    iface.EdgeProcessing.Compression.Algorithm,
				"threshold":    iface.EdgeProcessing.Compression.Threshold,
				"min_interval": iface.EdgeProcessing.Compression.MinInterval,
				"max_interval": iface.EdgeProcessing.Compression.MaxInterval,
			},
			"aggregation": map[string]interface{}{
				"enabled":  iface.EdgeProcessing.Aggregation.Enabled,
				"window":   iface.EdgeProcessing.Aggregation.Window,
				"function": iface.EdgeProcessing.Aggregation.Function,
			},
		},
	}
	
	return config
}

// convertConnectionToMap 转换连接配置
func convertConnectionToMap(conn ConnectionConfig) map[string]interface{} {
	m := make(map[string]interface{})
	
	if conn.Host != "" {
		m["host"] = conn.Host
	}
	if conn.Port != 0 {
		m["port"] = conn.Port
	}
	if conn.TimeoutMs != 0 {
		m["timeout"] = conn.TimeoutMs / 1000
	}
	if conn.RetryCount != 0 {
		m["retry_count"] = conn.RetryCount
	}
	if conn.Endpoint != "" {
		m["endpoint"] = conn.Endpoint
	}
	if conn.SecurityMode != "" {
		m["security_mode"] = conn.SecurityMode
	}
	if conn.Username != "" {
		m["username"] = conn.Username
	}
	if conn.Password != "" {
		m["password"] = conn.Password
	}
	if conn.Broker != "" {
		m["broker"] = conn.Broker
	}
	if conn.ClientID != "" {
		m["client_id"] = conn.ClientID
	}
	if conn.KeepAliveInterval != 0 {
		m["keep_alive"] = conn.KeepAliveInterval
	}
	
	return m
}

// convertDataPointsToMaps 转换数据点配置
func convertDataPointsToMaps(points []DataPointConfig) []map[string]interface{} {
	var result []map[string]interface{}
	for _, point := range points {
		result = append(result, map[string]interface{}{
			"name":      point.Name,
			"address":   point.Address,
			"data_type": point.DataType,
			"scale":     point.Scale,
			"offset":    point.Offset,
			"unit":      point.Unit,
			"tags":      map[string]string{},
		})
	}
	return result
}

// GetTaskStatus 获取任务状态
func (ce *ConfigEngine) GetTaskStatus(interfaceID string) (*TaskRuntimeStatus, error) {
	return ce.cacheManager.GetTaskStatus(interfaceID)
}

// ListAllTaskStatus 列出所有任务状态
func (ce *ConfigEngine) ListAllTaskStatus() ([]*TaskRuntimeStatus, error) {
	return ce.cacheManager.ListTaskStatus()
}

// StopAllTasks 停止所有任务
func (ce *ConfigEngine) StopAllTasks() error {
	if ce.currentConfig == nil {
		return nil
	}
	
	for _, iface := range ce.currentConfig.Interfaces {
		if err := ce.taskManager.StopTask(iface.ID); err != nil {
			ce.logger.Error("Failed to stop task", "interface_id", iface.ID, "error", err)
		}
	}
	
	return nil
}

// ValidateConfig 验证配置有效性
func (ce *ConfigEngine) ValidateConfig(config *PlatformConfig) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}
	
	if config.Version <= 0 {
		return fmt.Errorf("invalid version: %d", config.Version)
	}
	
	if len(config.Interfaces) == 0 {
		return fmt.Errorf("no interfaces configured")
	}
	
	// 验证校验和
	if config.Checksum != "" {
		if err := ValidateChecksum(config, config.Checksum); err != nil {
			return fmt.Errorf("checksum validation failed: %w", err)
		}
	}
	
	// 验证每个接口
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

// LoadCachedConfig 从缓存加载配置
func (ce *ConfigEngine) LoadCachedConfig() (*PlatformConfig, error) {
	var config PlatformConfig
	version, checksum, err := ce.cacheManager.GetConfig("global", "current", &config)
	if err != nil {
		return nil, err
	}
	
	ce.logger.Info("Loaded cached config", "version", version, "checksum", checksum)
	
	ce.mu.Lock()
	ce.currentConfig = &config
	ce.mu.Unlock()
	
	return &config, nil
}

// ExportCurrentConfig 导出当前配置为JSON
func (ce *ConfigEngine) ExportCurrentConfig() ([]byte, error) {
	ce.mu.RLock()
	config := ce.currentConfig
	ce.mu.RUnlock()
	
	if config == nil {
		return nil, fmt.Errorf("no config available")
	}
	
	return json.MarshalIndent(config, "", "  ")
}