// Package configsync 配置同步相关功能
package configsync

import (
	"context"
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// SyncService 配置同步服务
type SyncService struct {
	// 组件
	client      *ConfigSyncClient
	cacheMgr    *CacheManager
	engine      *ConfigEngine
	taskMgr     *TaskLifecycleManager
	
	// 依赖
	authManager *auth.AuthManager
	protocolMgr *protocol.ProtocolManager
	logger      *logger.Logger
	
	// 配置
	collectorID string
	config      *SyncServiceConfig
	
	// 控制
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	mu          sync.RWMutex
	
	// 状态
	isRunning   bool
	lastSync    time.Time
	lastError   error
}

// SyncServiceConfig 同步服务配置
type SyncServiceConfig struct {
	// Platform 连接配置
	PlatformBaseURL   string
	ConfigEndpoint    string
	ConfirmEndpoint   string
	
	// 同步间隔
	SyncInterval      time.Duration
	RetryInterval     time.Duration
	MaxRetries        int
	
	// 缓存配置
	CacheDBPath       string
	
	// 超时配置
	RequestTimeout    time.Duration
}

// DefaultSyncServiceConfig 默认配置
func DefaultSyncServiceConfig() *SyncServiceConfig {
	return &SyncServiceConfig{
		PlatformBaseURL:   "http://localhost:8088",
		ConfigEndpoint:    "/api/v1/collectors/%s/config",
		ConfirmEndpoint:   "/api/v1/collectors/%s/config/confirm",
		SyncInterval:      5 * time.Minute,
		RetryInterval:     30 * time.Second,
		MaxRetries:        3,
		CacheDBPath:       "./config_cache.db",
		RequestTimeout:    30 * time.Second,
	}
}

// NewSyncService 创建配置同步服务
func NewSyncService(
	collectorID string,
	authManager *auth.AuthManager,
	protocolMgr *protocol.ProtocolManager,
	logger *logger.Logger,
	config *SyncServiceConfig,
) (*SyncService, error) {
	if config == nil {
		config = DefaultSyncServiceConfig()
	}
	
	// 创建缓存管理器
	cacheMgr, err := NewCacheManager(config.CacheDBPath, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache manager: %w", err)
	}
	
	// 创建同步客户端
	clientConfig := &ClientConfig{
		PlatformBaseURL: config.PlatformBaseURL,
		ConfigEndpoint:  config.ConfigEndpoint,
		ConfirmEndpoint: config.ConfirmEndpoint,
		SyncInterval:    config.SyncInterval,
		RetryInterval:   config.RetryInterval,
		MaxRetries:      config.MaxRetries,
		Timeout:         config.RequestTimeout,
	}
	syncClient := NewConfigSyncClient(clientConfig, collectorID, authManager, logger)
	
	// 创建任务生命周期管理器
	taskMgr := NewTaskLifecycleManager(logger)
	
	// 创建配置应用引擎
	engine := NewConfigEngine(cacheMgr, protocolMgr, taskMgr, logger)
	
	ctx, cancel := context.WithCancel(context.Background())
	
	return &SyncService{
		client:      syncClient,
		cacheMgr:    cacheMgr,
		engine:      engine,
		taskMgr:     taskMgr,
		authManager: authManager,
		protocolMgr: protocolMgr,
		logger:      logger,
		collectorID: collectorID,
		config:      config,
		ctx:         ctx,
		cancel:      cancel,
	}, nil
}

// Start 启动配置同步服务
func (s *SyncService) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.isRunning {
		return fmt.Errorf("sync service is already running")
	}
	
	s.logger.Info("Starting config sync service", "collector_id", s.collectorID)
	
	// 1. 尝试从缓存加载配置
	if err := s.loadCachedConfig(); err != nil {
		s.logger.Warn("Failed to load cached config", "error", err)
	} else {
		s.logger.Info("Loaded config from cache")
	}
	
	// 2. 立即执行一次同步
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.performSync()
	}()
	
	// 3. 启动定期同步协程
	s.wg.Add(1)
	go s.syncLoop()
	
	s.isRunning = true
	s.logger.Info("Config sync service started")
	
	return nil
}

// Stop 停止配置同步服务
func (s *SyncService) Stop() error {
	s.mu.Lock()
	if !s.isRunning {
		s.mu.Unlock()
		return nil
	}
	s.isRunning = false
	s.mu.Unlock()
	
	s.logger.Info("Stopping config sync service")
	
	// 取消上下文
	s.cancel()
	
	// 停止所有任务
	if err := s.taskMgr.StopAllTasks(); err != nil {
		s.logger.Error("Failed to stop tasks", "error", err)
	}
	
	// 等待所有协程退出
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	
	select {
	case <-done:
		s.logger.Info("All sync goroutines stopped")
	case <-time.After(10 * time.Second):
		s.logger.Warn("Timeout waiting for sync goroutines")
	}
	
	// 关闭缓存
	if err := s.cacheMgr.Close(); err != nil {
		s.logger.Error("Failed to close cache", "error", err)
	}
	
	s.logger.Info("Config sync service stopped")
	return nil
}

// syncLoop 定期同步循环
func (s *SyncService) syncLoop() {
	defer s.wg.Done()
	
	ticker := time.NewTicker(s.config.SyncInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.performSync()
		}
	}
}

// performSync 执行配置同步
func (s *SyncService) performSync() {
	s.logger.Info("Performing config sync")
	
	// 同步配置
	result := s.client.SyncWithRetry(s.ctx)
	if !result.Success {
		s.logger.Error("Config sync failed", "error", result.Error)
		s.mu.Lock()
		s.lastError = result.Error
		s.mu.Unlock()
		return
	}
	
	// 如果没有变更，直接返回
	if !result.HasChanges {
		s.logger.Debug("No config changes detected")
		return
	}
	
	s.logger.Info("Config changes detected", 
		"version", result.Version, 
		"is_full_sync", result.IsFullSync)
	
	// 验证配置
	if err := s.engine.ValidateConfig(result.Config); err != nil {
		s.logger.Error("Config validation failed", "error", err)
		s.reportFailure(result.Version, err)
		return
	}
	
	// 应用配置
	applyResults := s.engine.ApplyConfig(s.ctx, result.Config)
	
	// 检查应用结果
	allSuccess := true
	for _, r := range applyResults {
		if !r.Success {
			allSuccess = false
			s.logger.Error("Failed to apply config for interface", 
				"interface_id", r.InterfaceID, 
				"error", r.Error)
		}
	}
	
	// 上报结果
	if allSuccess {
		s.reportSuccess(result.Version, result.Checksum)
	} else {
		s.reportFailure(result.Version, fmt.Errorf("partial failure"))
	}
	
	// 更新状态
	s.mu.Lock()
	s.lastSync = time.Now()
	s.lastError = nil
	s.mu.Unlock()
}

// reportSuccess 上报配置应用成功
func (s *SyncService) reportSuccess(version int, checksum string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	if err := s.client.ConfirmApplied(ctx, nil, version, checksum, true, ""); err != nil {
		s.logger.Error("Failed to report config success", "error", err)
	} else {
		s.logger.Info("Config applied successfully reported", "version", version)
	}
}

// reportFailure 上报配置应用失败
func (s *SyncService) reportFailure(version int, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	
	if confirmErr := s.client.ConfirmApplied(ctx, nil, version, "", false, errMsg); confirmErr != nil {
		s.logger.Error("Failed to report config failure", "error", confirmErr)
	}
}

// loadCachedConfig 从缓存加载配置
func (s *SyncService) loadCachedConfig() error {
	config, err := s.engine.LoadCachedConfig()
	if err != nil {
		return err
	}
	
	// 应用缓存的配置
	s.engine.ApplyConfig(s.ctx, config)
	return nil
}

// ForceSync 强制立即同步
func (s *SyncService) ForceSync() error {
	s.mu.RLock()
	if !s.isRunning {
		s.mu.RUnlock()
		return fmt.Errorf("sync service is not running")
	}
	s.mu.RUnlock()
	
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.performSync()
	}()
	
	return nil
}

// GetStatus 获取同步服务状态
func (s *SyncService) GetStatus() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	status := map[string]interface{}{
		"is_running":  s.isRunning,
		"last_sync":   s.lastSync,
		"collector_id": s.collectorID,
	}
	
	if s.lastError != nil {
		status["last_error"] = s.lastError.Error()
	}
	
	// 添加任务统计
	status["tasks"] = s.taskMgr.GetTaskStatistics()
	
	// 添加缓存统计
	if cacheStats, err := s.cacheMgr.GetStats(); err == nil {
		status["cache"] = cacheStats
	}
	
	return status
}

// GetCurrentConfig 获取当前配置
func (s *SyncService) GetCurrentConfig() *PlatformConfig {
	return s.engine.GetCurrentConfig()
}

// GetTaskStatus 获取任务状态
func (s *SyncService) GetTaskStatus(interfaceID string) (*TaskRuntimeStatus, error) {
	return s.engine.GetTaskStatus(interfaceID)
}

// ListAllTaskStatus 列出所有任务状态
func (s *SyncService) ListAllTaskStatus() ([]*TaskRuntimeStatus, error) {
	return s.engine.ListAllTaskStatus()
}

// RestartTask 重启任务
func (s *SyncService) RestartTask(interfaceID string) error {
	return s.taskMgr.RestartTask(s.ctx, interfaceID)
}

// ExportConfig 导出当前配置
func (s *SyncService) ExportConfig() ([]byte, error) {
	return s.engine.ExportCurrentConfig()
}
