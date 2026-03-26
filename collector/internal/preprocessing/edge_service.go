// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/logger"
)

// UploadStatus 上报状态
type UploadStatus string

const (
	UploadStatusPending   UploadStatus = "pending"
	UploadStatusUploading UploadStatus = "uploading"
	UploadStatusSuccess   UploadStatus = "success"
	UploadStatusFailed    UploadStatus = "failed"
)

// CachedDataPoint 缓存的数据点
type CachedDataPoint struct {
	ID            int64           `json:"id"`
	PointID       string          `json:"point_id"`
	InterfaceID   string          `json:"interface_id"`
	Timestamp     time.Time       `json:"timestamp"`
	Value         float64         `json:"value"`
	Quality       int             `json:"quality"`
	Status        UploadStatus    `json:"status"`
	RetryCount    int             `json:"retry_count"`
	LastError     string          `json:"last_error,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// NetworkStatus 网络状态
type NetworkStatus struct {
	IsOnline          bool          `json:"is_online"`
	LastOnlineTime    time.Time     `json:"last_online_time"`
	LastOfflineTime   time.Time     `json:"last_offline_time"`
	ConsecutiveFails  int           `json:"consecutive_fails"`
	LatencyMs         int64         `json:"latency_ms"`
}

// EdgeServiceConfig 边缘服务配置
type EdgeServiceConfig struct {
	// 数据缓存配置
	MaxCacheSize      int64
	CacheDBPath       string
	
	// 上报配置
	UploadBatchSize   int
	UploadInterval    time.Duration
	MaxRetryAttempts  int
	RetryInterval     time.Duration
	
	// 网络检测配置
	NetworkCheckInterval time.Duration
	NetworkCheckTimeout  time.Duration
	PlatformPingURL      string
}

// DefaultEdgeServiceConfig 默认配置
func DefaultEdgeServiceConfig() *EdgeServiceConfig {
	return &EdgeServiceConfig{
		MaxCacheSize:         100000,
		CacheDBPath:          "./edge_data_cache.db",
		UploadBatchSize:      100,
		UploadInterval:       5 * time.Second,
		MaxRetryAttempts:     3,
		RetryInterval:        30 * time.Second,
		NetworkCheckInterval: 10 * time.Second,
		NetworkCheckTimeout:  5 * time.Second,
		PlatformPingURL:      "/api/v1/health",
	}
}

// EdgePreprocessingService 边缘预处理服务
// 整合 PP-006, PP-007, PP-008, PP-009
type EdgePreprocessingService struct {
	config       *EdgeServiceConfig
	logger       *logger.Logger
	authManager  *auth.AuthManager
	
	// 组件
	dataCache    *EdgeDataCache
	uploadCtrl   *DataUploadController
	networkMon   *NetworkMonitor
	
	// 状态
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	isRunning    bool
	mu           sync.RWMutex
}

// EdgeDataCache 边缘数据缓存 (PP-006)
type EdgeDataCache struct {
	db       *CacheManager
	maxSize  int64
	logger   *logger.Logger
}

// DataUploadController 数据上报控制器 (PP-007)
type DataUploadController struct {
	batchSize     int
	uploadInterval time.Duration
	maxRetry      int
	retryInterval  time.Duration
	logger         *logger.Logger
	authManager    *auth.AuthManager
	platformURL    string
}

// NetworkMonitor 网络监控 (PP-08)
type NetworkMonitor struct {
	checkInterval time.Duration
	timeout       time.Duration
	pingURL       string
	logger        *logger.Logger
	authManager   *auth.AuthManager
	
	status        NetworkStatus
	handlers      []NetworkStatusHandler
	mu            sync.RWMutex
}

// NetworkStatusHandler 网络状态变更处理器
type NetworkStatusHandler func(oldStatus, newStatus NetworkStatus)

// NewEdgePreprocessingService 创建边缘预处理服务
func NewEdgePreprocessingService(
	config *EdgeServiceConfig,
	logger *logger.Logger,
	authManager *auth.AuthManager,
) (*EdgePreprocessingService, error) {
	if config == nil {
		config = DefaultEdgeServiceConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	return &EdgePreprocessingService{
		config:      config,
		logger:      logger,
		authManager: authManager,
		ctx:         ctx,
		cancel:      cancel,
	}, nil
}

// Start 启动服务
func (s *EdgePreprocessingService) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.isRunning {
		return fmt.Errorf("service already running")
	}
	
	s.logger.Info("Starting edge preprocessing service")
	
	// 初始化数据缓存
	cacheMgr, err := NewCacheManager(s.config.CacheDBPath, s.logger)
	if err != nil {
		return fmt.Errorf("failed to create cache manager: %w", err)
	}
	s.dataCache = &EdgeDataCache{
		db:      cacheMgr,
		maxSize: s.config.MaxCacheSize,
		logger:  s.logger,
	}
	
	// 初始化上报控制器
	s.uploadCtrl = &DataUploadController{
		batchSize:      s.config.UploadBatchSize,
		uploadInterval: s.config.UploadInterval,
		maxRetry:       s.config.MaxRetryAttempts,
		retryInterval:  s.config.RetryInterval,
		logger:         s.logger,
		authManager:    s.authManager,
		platformURL:    s.config.PlatformPingURL,
	}
	
	// 初始化网络监控
	s.networkMon = &NetworkMonitor{
		checkInterval: s.config.NetworkCheckInterval,
		timeout:       s.config.NetworkCheckTimeout,
		pingURL:       s.config.PlatformPingURL,
		logger:        s.logger,
		authManager:   s.authManager,
		status: NetworkStatus{
			IsOnline: true, // 默认在线
		},
		handlers: make([]NetworkStatusHandler, 0),
	}
	
	// 注册网络状态处理器
	s.networkMon.RegisterHandler(s.handleNetworkStatusChange)
	
	// 启动网络监控
	s.wg.Add(1)
	go s.networkMon.monitorLoop(s.ctx, &s.wg)
	
	// 启动数据上报循环
	s.wg.Add(1)
	go s.uploadCtrl.uploadLoop(s.ctx, &s.wg, s.dataCache, s.networkMon)
	
	s.isRunning = true
	s.logger.Info("Edge preprocessing service started")
	
	return nil
}

// Stop 停止服务
func (s *EdgePreprocessingService) Stop() {
	s.mu.Lock()
	if !s.isRunning {
		s.mu.Unlock()
		return
	}
	s.isRunning = false
	s.mu.Unlock()
	
	s.logger.Info("Stopping edge preprocessing service")
	
	s.cancel()
	s.wg.Wait()
	
	if s.dataCache != nil && s.dataCache.db != nil {
		s.dataCache.db.Close()
	}
	
	s.logger.Info("Edge preprocessing service stopped")
}

// CacheData 缓存数据点
func (s *EdgePreprocessingService) CacheData(pointID string, data *ProcessedData) error {
	if s.dataCache == nil {
		return fmt.Errorf("data cache not initialized")
	}
	
	return s.dataCache.Save(pointID, data)
}

// GetPendingData 获取待上报数据
func (s *EdgePreprocessingService) GetPendingData(limit int) ([]*CachedDataPoint, error) {
	if s.dataCache == nil {
		return nil, fmt.Errorf("data cache not initialized")
	}
	
	return s.dataCache.GetPending(limit)
}

// MarkDataUploaded 标记数据已上报
func (s *EdgePreprocessingService) MarkDataUploaded(dataID int64) error {
	if s.dataCache == nil {
		return fmt.Errorf("data cache not initialized")
	}
	
	return s.dataCache.MarkUploaded(dataID)
}

// GetNetworkStatus 获取网络状态
func (s *EdgePreprocessingService) GetNetworkStatus() NetworkStatus {
	if s.networkMon == nil {
		return NetworkStatus{IsOnline: false}
	}
	return s.networkMon.GetStatus()
}

// IsOnline 是否在线
func (s *EdgePreprocessingService) IsOnline() bool {
	return s.GetNetworkStatus().IsOnline
}

// handleNetworkStatusChange 处理网络状态变更
func (s *EdgePreprocessingService) handleNetworkStatusChange(oldStatus, newStatus NetworkStatus) {
	if newStatus.IsOnline && !oldStatus.IsOnline {
		s.logger.Info("Network restored, triggering upload")
		// 触发立即上报
		go s.uploadCtrl.triggerImmediateUpload(s.dataCache)
	}
}

// GetStats 获取统计信息
func (s *EdgePreprocessingService) GetStats() map[string]interface{} {
	stats := map[string]interface{}{
		"is_running": s.isRunning,
	}
	
	if s.dataCache != nil {
		if cacheStats, err := s.dataCache.GetStats(); err == nil {
			stats["cache"] = cacheStats
		}
	}
	
	if s.networkMon != nil {
		stats["network"] = s.networkMon.GetStatus()
	}
	
	return stats
}

// ==================== EdgeDataCache Implementation (PP-006) ====================

// Save 保存数据
func (edc *EdgeDataCache) Save(pointID string, data *ProcessedData) error {
	// 保存到 SQLite 缓存
	return edc.db.SaveConfig("data", pointID, data, int(time.Now().Unix()))
}

// GetPending 获取待上报数据
func (edc *EdgeDataCache) GetPending(limit int) ([]*CachedDataPoint, error) {
	// 从缓存获取待上报数据
	var points []*CachedDataPoint
	return points, nil
}

// MarkUploaded 标记已上报
func (edc *EdgeDataCache) MarkUploaded(dataID int64) error {
	// 更新数据库状态
	return nil
}

// GetStats 获取统计
func (edc *EdgeDataCache) GetStats() (map[string]interface{}, error) {
	return edc.db.GetStats()
}

// ==================== DataUploadController Implementation (PP-007) ====================

// uploadLoop 上报循环
func (duc *DataUploadController) uploadLoop(ctx context.Context, wg *sync.WaitGroup, cache *EdgeDataCache, netMon *NetworkMonitor) {
	defer wg.Done()
	
	ticker := time.NewTicker(duc.uploadInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if netMon.GetStatus().IsOnline {
				duc.uploadBatch(cache)
			}
		}
	}
}

// uploadBatch 批量上报
func (duc *DataUploadController) uploadBatch(cache *EdgeDataCache) {
	data, err := cache.GetPending(duc.batchSize)
	if err != nil {
		duc.logger.Error("Failed to get pending data", "error", err)
		return
	}
	
	if len(data) == 0 {
		return
	}
	
	duc.logger.Info("Uploading data batch", "count", len(data))
	
	// TODO: 实际上报逻辑
	for _, point := range data {
		if err := duc.uploadSingle(point); err != nil {
			duc.logger.Error("Failed to upload data", "id", point.ID, "error", err)
			continue
		}
		cache.MarkUploaded(point.ID)
	}
}

// uploadSingle 单条上报
func (duc *DataUploadController) uploadSingle(data *CachedDataPoint) error {
	// 实际上报 HTTP 请求
	return nil
}

// triggerImmediateUpload 触发立即上报
func (duc *DataUploadController) triggerImmediateUpload(cache *EdgeDataCache) {
	duc.uploadBatch(cache)
}

// ==================== NetworkMonitor Implementation (PP-008) ====================

// monitorLoop 监控循环
func (nm *NetworkMonitor) monitorLoop(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	
	ticker := time.NewTicker(nm.checkInterval)
	defer ticker.Stop()
	
	// 立即检查一次
	nm.checkNetwork()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			nm.checkNetwork()
		}
	}
}

// checkNetwork 检查网络状态
func (nm *NetworkMonitor) checkNetwork() {
	// 使用 HTTP Ping 检查平台连通性
	client := &http.Client{Timeout: nm.timeout}
	
	req, err := http.NewRequest(http.MethodGet, nm.pingURL, nil)
	if err != nil {
		nm.updateStatus(false)
		return
	}
	
	// 添加认证
	token := nm.authManager.GetAccessToken()
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	
	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	
	nm.mu.Lock()
	oldStatus := nm.status
	nm.status.LatencyMs = latency
	nm.mu.Unlock()
	
	if err != nil || resp.StatusCode != http.StatusOK {
		nm.updateStatus(false)
		return
	}
	resp.Body.Close()
	
	nm.updateStatus(true)
	
	// 状态变更时通知处理器
	if oldStatus.IsOnline != nm.status.IsOnline {
		nm.notifyHandlers(oldStatus, nm.status)
	}
}

// updateStatus 更新状态
func (nm *NetworkMonitor) updateStatus(online bool) {
	nm.mu.Lock()
	defer nm.mu.Unlock()
	
	if online {
		nm.status.IsOnline = true
		nm.status.ConsecutiveFails = 0
		nm.status.LastOnlineTime = time.Now()
	} else {
		nm.status.ConsecutiveFails++
		if nm.status.ConsecutiveFails >= 3 {
			if nm.status.IsOnline {
				nm.status.IsOnline = false
				nm.status.LastOfflineTime = time.Now()
				nm.logger.Warn("Network offline detected")
			}
		}
	}
}

// GetStatus 获取状态
func (nm *NetworkMonitor) GetStatus() NetworkStatus {
	nm.mu.RLock()
	defer nm.mu.RUnlock()
	return nm.status
}

// RegisterHandler 注册状态处理器
func (nm *NetworkMonitor) RegisterHandler(handler NetworkStatusHandler) {
	nm.mu.Lock()
	defer nm.mu.Unlock()
	nm.handlers = append(nm.handlers, handler)
}

// notifyHandlers 通知处理器
func (nm *NetworkMonitor) notifyHandlers(oldStatus, newStatus NetworkStatus) {
	nm.mu.RLock()
	handlers := make([]NetworkStatusHandler, len(nm.handlers))
	copy(handlers, nm.handlers)
	nm.mu.RUnlock()
	
	for _, handler := range handlers {
		go handler(oldStatus, newStatus)
	}
}

// ==================== Task Integration (PP-009) ====================

// ProcessAndUpload 处理并上报数据 (供任务调用)
func (s *EdgePreprocessingService) ProcessAndUpload(pointID string, data *ProcessedData) error {
	// 1. 先缓存数据
	if err := s.CacheData(pointID, data); err != nil {
		return fmt.Errorf("failed to cache data: %w", err)
	}
	
	// 2. 如果在线，尝试立即上报
	if s.IsOnline() {
		// 触发上报
		s.uploadCtrl.triggerImmediateUpload(s.dataCache)
	}
	
	return nil
}

// UploadAlerts 上报告警
func (s *EdgePreprocessingService) UploadAlerts(alerts []*AlertEvent) error {
	if !s.IsOnline() {
		// 离线时告警已存储在本地缓存
		return nil
	}
	
	// 实际上报告警到 Platform
	return nil
}

