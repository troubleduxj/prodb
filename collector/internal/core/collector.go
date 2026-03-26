package core

import (
	"context"
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/buffer"
	"prodb/collector/internal/communication"
	"prodb/collector/internal/config"
	"prodb/collector/internal/configsync"
	"prodb/collector/internal/heartbeat"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/storage"
	syncpkg "prodb/collector/internal/sync"
)

// CollectorStatus represents the current status of the collector
type CollectorStatus string

const (
	StatusStopped  CollectorStatus = "stopped"
	StatusStarting CollectorStatus = "starting"
	StatusRunning  CollectorStatus = "running"
	StatusStopping CollectorStatus = "stopping"
	StatusError    CollectorStatus = "error"
)

// Collector represents the main collector instance
type Collector struct {
	ID             string
	config         *config.CollectorConfig
	authManager    *auth.AuthManager
	protocolMgr    *protocol.ProtocolManager
	dataBuffer     *buffer.DataBuffer
	storageCache   *storage.StorageCache
	platformClient *communication.PlatformClient
	syncManager    *syncpkg.SyncManager
	heartbeatMgr   *heartbeat.HeartbeatManager
	logger         *logger.Logger
	
	// Config sync service (NEW)
	configSyncSvc  *configsync.SyncService
	
	status         CollectorStatus
	statusMutex    sync.RWMutex
	
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	
	// Metrics
	startTime      time.Time
	lastError      error
}

// NewCollector creates a new collector instance
func NewCollector(configPath string) (*Collector, error) {
	// Load configuration
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize logger
	log, err := logger.NewLogger(cfg.Logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize logger: %w", err)
	}

	// Initialize authentication manager
	authMgr, err := auth.NewAuthManager(cfg.Auth, log)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize auth manager: %w", err)
	}

	// Initialize storage cache
	storageCache, err := storage.NewStorageCache(cfg.Storage, log)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage cache: %w", err)
	}

	// Initialize data buffer
	dataBuffer := buffer.NewDataBuffer(cfg.Buffer, log)

	// Initialize protocol manager
	protocolMgr := protocol.NewProtocolManager(log)

	// Initialize platform client
	platformClient := communication.NewPlatformClient(cfg.Platform, authMgr, log)

	// Initialize sync manager
	syncManager := syncpkg.NewSyncManager(cfg.Platform, storageCache, platformClient, log)

	// Initialize heartbeat manager
	heartbeatMgr := heartbeat.NewHeartbeatManager(cfg, platformClient, log)

	// Initialize config sync service (NEW)
	syncSvcConfig := configsync.DefaultSyncServiceConfig()
	syncSvcConfig.PlatformBaseURL = cfg.Platform.BaseURL
	configSyncSvc, err := configsync.NewSyncService(
		cfg.CollectorID,
		authMgr,
		protocolMgr,
		log,
		syncSvcConfig,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize config sync service: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	collector := &Collector{
		ID:             cfg.CollectorID,
		config:         cfg,
		authManager:    authMgr,
		protocolMgr:    protocolMgr,
		dataBuffer:     dataBuffer,
		storageCache:   storageCache,
		platformClient: platformClient,
		syncManager:    syncManager,
		heartbeatMgr:   heartbeatMgr,
		configSyncSvc:  configSyncSvc,
		logger:         log,
		status:         StatusStopped,
		ctx:            ctx,
		cancel:         cancel,
	}

	return collector, nil
}

// Start starts the collector
func (c *Collector) Start() error {
	c.statusMutex.Lock()
	defer c.statusMutex.Unlock()

	if c.status != StatusStopped {
		return fmt.Errorf("collector is already running or starting")
	}

	c.setStatus(StatusStarting)
	c.startTime = time.Now()

	c.logger.Info("Starting collector", "collector_id", c.ID)

	// Start authentication
	if err := c.authManager.Start(c.ctx); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start auth manager: %w", err)
	}

	// Start storage cache
	if err := c.storageCache.Start(c.ctx); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start storage cache: %w", err)
	}

	// Start data buffer
	if err := c.dataBuffer.Start(c.ctx); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start data buffer: %w", err)
	}

	// Start protocol manager
	if err := c.protocolMgr.Start(c.ctx); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start protocol manager: %w", err)
	}

	// Start sync manager
	if err := c.syncManager.Start(); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start sync manager: %w", err)
	}

	// Start heartbeat manager
	if err := c.heartbeatMgr.Start(c.ctx); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start heartbeat manager: %w", err)
	}

	// Start config sync service (NEW)
	if err := c.configSyncSvc.Start(); err != nil {
		c.setStatus(StatusError)
		c.lastError = err
		return fmt.Errorf("failed to start config sync service: %w", err)
	}

	c.setStatus(StatusRunning)
	c.logger.Info("Collector started successfully", "collector_id", c.ID)

	return nil
}

// Stop stops the collector
func (c *Collector) Stop() error {
	c.statusMutex.Lock()
	defer c.statusMutex.Unlock()

	if c.status == StatusStopped || c.status == StatusStopping {
		return nil
	}

	c.setStatus(StatusStopping)
	c.logger.Info("Stopping collector", "collector_id", c.ID)

	// Cancel context to signal all goroutines to stop
	c.cancel()

	// Wait for all goroutines to finish
	c.wg.Wait()

	// Stop all components
	c.heartbeatMgr.Stop()
	c.syncManager.Stop()
	c.protocolMgr.Stop()
	c.dataBuffer.Stop()
	c.storageCache.Stop()
	c.authManager.Stop()

	c.setStatus(StatusStopped)
	c.logger.Info("Collector stopped", "collector_id", c.ID)

	return nil
}

// GetStatus returns the current status of the collector
func (c *Collector) GetStatus() CollectorStatus {
	c.statusMutex.RLock()
	defer c.statusMutex.RUnlock()
	return c.status
}

// GetProtocolManager returns the protocol manager
func (c *Collector) GetProtocolManager() *protocol.ProtocolManager {
	return c.protocolMgr
}

// GetMetrics returns collector metrics
func (c *Collector) GetMetrics() *CollectorMetrics {
	c.statusMutex.RLock()
	defer c.statusMutex.RUnlock()

	uptime := int64(0)
	if !c.startTime.IsZero() {
		uptime = int64(time.Since(c.startTime).Seconds())
	}

	return &CollectorMetrics{
		Status:          string(c.status),
		Uptime:          uptime,
		LastError:       c.lastError,
		StartTime:       c.startTime,
		BufferMetrics:   c.dataBuffer.GetMetrics(),
		StorageMetrics:  c.storageCache.GetMetrics(),
		ProtocolMetrics: c.protocolMgr.GetMetrics(),
		SyncMetrics:     c.syncManager.GetAggregatedMetrics(),
		NetworkOnline:   c.syncManager.IsNetworkOnline(),
		SyncHealthy:     c.syncManager.IsHealthy(),
		HeartbeatStats:  c.heartbeatMgr.GetStats(),
		HeartbeatHealth: c.heartbeatMgr.GetHealthStatus(),
	}
}

// UpdateConfig updates the collector configuration
func (c *Collector) UpdateConfig(newConfig *config.CollectorConfig) error {
	c.logger.Info("Updating collector configuration", "version", newConfig.Version)

	// Validate configuration
	if err := newConfig.Validate(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	// Update protocol manager configuration
	if err := c.protocolMgr.UpdateConfig(newConfig.CollectionTasks); err != nil {
		return fmt.Errorf("failed to update protocol manager config: %w", err)
	}

	// Update other components as needed
	c.config = newConfig
	c.logger.Info("Configuration updated successfully", "version", newConfig.Version)

	return nil
}

// setStatus sets the collector status (internal use only)
func (c *Collector) setStatus(status CollectorStatus) {
	c.status = status
}



// configSyncRoutine periodically syncs configuration from the platform
func (c *Collector) configSyncRoutine() {
	defer c.wg.Done()

	ticker := time.NewTicker(5 * time.Minute) // Check for config updates every 5 minutes
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			if err := c.syncConfiguration(); err != nil {
				c.logger.Error("Failed to sync configuration", "error", err)
			}
		}
	}
}



// syncConfiguration syncs configuration from the platform
func (c *Collector) syncConfiguration() error {
	// Only sync configuration if network is online
	if !c.syncManager.IsNetworkOnline() {
		c.logger.Debug("Network offline, skipping config sync", "collector_id", c.ID)
		return nil
	}

	// Sync configuration via platform client
	newConfig, err := c.platformClient.SyncConfiguration(c.ID)
	if err != nil {
		c.logger.Error("Failed to sync configuration", "collector_id", c.ID, "error", err)
		return err
	}

	// Update configuration if changed
	if newConfig != nil && newConfig.Version != c.config.Version {
		c.logger.Info("New configuration received", 
			"collector_id", c.ID,
			"old_version", c.config.Version,
			"new_version", newConfig.Version)

		if err := c.UpdateConfig(newConfig); err != nil {
			c.logger.Error("Failed to update configuration", "error", err)
			return err
		}
	}

	c.logger.Debug("Configuration sync completed", "collector_id", c.ID)
	return nil
}

// CollectorMetrics represents collector performance metrics
type CollectorMetrics struct {
	Status          string                        `json:"status"`
	Uptime          int64                         `json:"uptime"`
	LastError       error                         `json:"last_error,omitempty"`
	StartTime       time.Time                     `json:"start_time"`
	BufferMetrics   *buffer.BufferMetrics         `json:"buffer_metrics"`
	StorageMetrics  *storage.StorageMetrics       `json:"storage_metrics"`
	ProtocolMetrics *protocol.ProtocolMetrics     `json:"protocol_metrics"`
	SyncMetrics     *syncpkg.AggregatedSyncMetrics   `json:"sync_metrics"`
	NetworkOnline   bool                          `json:"network_online"`
	SyncHealthy     bool                          `json:"sync_healthy"`
	HeartbeatStats  *heartbeat.HeartbeatStats     `json:"heartbeat_stats"`
	HeartbeatHealth map[string]interface{}        `json:"heartbeat_health"`
}

// TriggerDataSync triggers an immediate data synchronization
func (c *Collector) TriggerDataSync() {
	c.logger.Info("Manual data sync triggered", "collector_id", c.ID)
	c.syncManager.TriggerSync()
}

// GetNetworkStatus returns the current network status
func (c *Collector) GetNetworkStatus() string {
	return string(c.syncManager.GetNetworkStatus())
}

// GetSyncHealthSummary returns a human-readable sync health summary
func (c *Collector) GetSyncHealthSummary() string {
	return c.syncManager.GetHealthSummary()
}

// WaitForNetworkOnline waits for the network to come online
func (c *Collector) WaitForNetworkOnline(timeout time.Duration) error {
	return c.syncManager.WaitForNetworkOnline(timeout)
}

// SendManualHeartbeat sends an immediate heartbeat with additional metrics
func (c *Collector) SendManualHeartbeat(additionalMetrics map[string]interface{}) error {
	if additionalMetrics == nil {
		additionalMetrics = make(map[string]interface{})
	}
	
	// Add collector-specific metrics
	additionalMetrics["buffer_size"] = c.dataBuffer.GetMetrics().BufferSize
	additionalMetrics["cached_data"] = c.storageCache.GetMetrics().CachedDataCount
	additionalMetrics["network_online"] = c.syncManager.IsNetworkOnline()
	additionalMetrics["sync_healthy"] = c.syncManager.IsHealthy()
	
	return c.heartbeatMgr.SendHeartbeat(string(c.status), additionalMetrics)
}

// GetHeartbeatStats returns heartbeat statistics
func (c *Collector) GetHeartbeatStats() *heartbeat.HeartbeatStats {
	return c.heartbeatMgr.GetStats()
}

// GetHeartbeatHealth returns heartbeat health status
func (c *Collector) GetHeartbeatHealth() map[string]interface{} {
	return c.heartbeatMgr.GetHealthStatus()
}

// SetHeartbeatInterval updates the heartbeat interval
func (c *Collector) SetHeartbeatInterval(interval time.Duration) {
	c.heartbeatMgr.SetInterval(interval)
}

// EnableHeartbeat enables heartbeat sending
func (c *Collector) EnableHeartbeat() {
	c.heartbeatMgr.Enable()
}

// DisableHeartbeat disables heartbeat sending
func (c *Collector) DisableHeartbeat() {
	c.heartbeatMgr.Disable()
}

// GetConfig returns the current collector configuration
func (c *Collector) GetConfig() *config.CollectorConfig {
	return c.config
}