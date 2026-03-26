package sync

import (
	"context"
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/communication"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/storage"
)

// SyncManager coordinates network monitoring and data synchronization
type SyncManager struct {
	config         config.PlatformConfig
	logger         *logger.Logger
	
	// Components
	networkMonitor *NetworkMonitor
	dataSyncService *DataSyncService
	storageCache   *storage.StorageCache
	platformClient *communication.PlatformClient
	
	// Control
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	
	// State
	isRunning      bool
	runningMutex   sync.RWMutex
	
	// Metrics aggregation
	aggregatedMetrics *AggregatedSyncMetrics
	metricsMutex      sync.RWMutex
}

// AggregatedSyncMetrics contains combined metrics from all sync components
type AggregatedSyncMetrics struct {
	NetworkMetrics *NetworkMetrics `json:"network_metrics"`
	SyncMetrics    *SyncMetrics    `json:"sync_metrics"`
	StorageMetrics *storage.StorageMetrics `json:"storage_metrics"`
	
	// Overall health indicators
	OverallHealth  string    `json:"overall_health"` // healthy, degraded, unhealthy
	LastUpdate     time.Time `json:"last_update"`
	
	// Summary statistics
	TotalPendingData    int64     `json:"total_pending_data"`
	NetworkUptime       float64   `json:"network_uptime_percent"`
	SyncSuccessRate     float64   `json:"sync_success_rate_percent"`
	LastSuccessfulSync  time.Time `json:"last_successful_sync"`
	NextScheduledSync   time.Time `json:"next_scheduled_sync,omitempty"`
}

// NewSyncManager creates a new sync manager
func NewSyncManager(
	config config.PlatformConfig,
	storageCache *storage.StorageCache,
	platformClient *communication.PlatformClient,
	logger *logger.Logger,
) *SyncManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	// Create network monitor
	networkMonitor := NewNetworkMonitor(config, logger)
	
	// Create data sync service
	dataSyncService := NewDataSyncService(config, storageCache, platformClient, networkMonitor, logger)
	
	return &SyncManager{
		config:          config,
		logger:          logger.WithGroup("sync_manager"),
		networkMonitor:  networkMonitor,
		dataSyncService: dataSyncService,
		storageCache:    storageCache,
		platformClient:  platformClient,
		ctx:             ctx,
		cancel:          cancel,
		aggregatedMetrics: &AggregatedSyncMetrics{
			OverallHealth: "unknown",
		},
	}
}

// Start starts the sync manager and all its components
func (sm *SyncManager) Start() error {
	sm.runningMutex.Lock()
	defer sm.runningMutex.Unlock()
	
	if sm.isRunning {
		return fmt.Errorf("sync manager is already running")
	}
	
	sm.logger.Info("Starting sync manager")
	
	// Start network monitor
	if err := sm.networkMonitor.Start(); err != nil {
		return fmt.Errorf("failed to start network monitor: %w", err)
	}
	
	// Start data sync service
	if err := sm.dataSyncService.Start(); err != nil {
		sm.networkMonitor.Stop()
		return fmt.Errorf("failed to start data sync service: %w", err)
	}
	
	// Start metrics aggregation routine
	sm.wg.Add(1)
	go sm.metricsAggregationRoutine()
	
	// Start health monitoring routine
	sm.wg.Add(1)
	go sm.healthMonitoringRoutine()
	
	sm.isRunning = true
	sm.logger.Info("Sync manager started successfully")
	
	return nil
}

// Stop stops the sync manager and all its components
func (sm *SyncManager) Stop() {
	sm.runningMutex.Lock()
	defer sm.runningMutex.Unlock()
	
	if !sm.isRunning {
		return
	}
	
	sm.logger.Info("Stopping sync manager")
	
	// Cancel context to signal all routines to stop
	sm.cancel()
	
	// Stop components
	sm.dataSyncService.Stop()
	sm.networkMonitor.Stop()
	
	// Wait for all routines to finish
	sm.wg.Wait()
	
	sm.isRunning = false
	sm.logger.Info("Sync manager stopped")
}

// GetNetworkStatus returns the current network status
func (sm *SyncManager) GetNetworkStatus() NetworkStatus {
	return sm.networkMonitor.GetStatus()
}

// IsNetworkOnline returns true if the network is online
func (sm *SyncManager) IsNetworkOnline() bool {
	return sm.networkMonitor.IsOnline()
}

// TriggerSync triggers an immediate data sync
func (sm *SyncManager) TriggerSync() {
	sm.logger.Info("Manual sync trigger requested")
	sm.dataSyncService.TriggerSync()
}

// GetAggregatedMetrics returns combined metrics from all components
func (sm *SyncManager) GetAggregatedMetrics() *AggregatedSyncMetrics {
	sm.metricsMutex.RLock()
	defer sm.metricsMutex.RUnlock()
	
	// Create a copy to avoid race conditions
	metrics := *sm.aggregatedMetrics
	return &metrics
}

// GetNetworkMetrics returns network monitoring metrics
func (sm *SyncManager) GetNetworkMetrics() *NetworkMetrics {
	return sm.networkMonitor.GetMetrics()
}

// GetSyncMetrics returns data sync metrics
func (sm *SyncManager) GetSyncMetrics() *SyncMetrics {
	return sm.dataSyncService.GetMetrics()
}

// GetStorageMetrics returns storage cache metrics
func (sm *SyncManager) GetStorageMetrics() *storage.StorageMetrics {
	return sm.storageCache.GetMetrics()
}

// IsHealthy returns true if the overall sync system is healthy
func (sm *SyncManager) IsHealthy() bool {
	metrics := sm.GetAggregatedMetrics()
	return metrics.OverallHealth == "healthy"
}

// WaitForNetworkOnline waits for the network to come online
func (sm *SyncManager) WaitForNetworkOnline(timeout time.Duration) error {
	return sm.networkMonitor.WaitForOnline(timeout)
}

// ForceNetworkCheck forces an immediate network connectivity check
func (sm *SyncManager) ForceNetworkCheck() error {
	return sm.networkMonitor.ForceCheck()
}

// GetPendingDataCount returns the number of pending data records
func (sm *SyncManager) GetPendingDataCount() int64 {
	return sm.dataSyncService.GetPendingDataCount()
}

// metricsAggregationRoutine periodically aggregates metrics from all components
func (sm *SyncManager) metricsAggregationRoutine() {
	defer sm.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	// Initial metrics update
	sm.updateAggregatedMetrics()
	
	for {
		select {
		case <-sm.ctx.Done():
			return
			
		case <-ticker.C:
			sm.updateAggregatedMetrics()
		}
	}
}

// healthMonitoringRoutine monitors overall system health
func (sm *SyncManager) healthMonitoringRoutine() {
	defer sm.wg.Done()
	
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-sm.ctx.Done():
			return
			
		case <-ticker.C:
			sm.evaluateOverallHealth()
		}
	}
}

// updateAggregatedMetrics updates the aggregated metrics
func (sm *SyncManager) updateAggregatedMetrics() {
	networkMetrics := sm.networkMonitor.GetMetrics()
	syncMetrics := sm.dataSyncService.GetMetrics()
	storageMetrics := sm.storageCache.GetMetrics()
	
	sm.metricsMutex.Lock()
	defer sm.metricsMutex.Unlock()
	
	sm.aggregatedMetrics.NetworkMetrics = networkMetrics
	sm.aggregatedMetrics.SyncMetrics = syncMetrics
	sm.aggregatedMetrics.StorageMetrics = storageMetrics
	sm.aggregatedMetrics.LastUpdate = time.Now()
	
	// Update summary statistics
	sm.aggregatedMetrics.TotalPendingData = storageMetrics.CachedDataCount
	sm.aggregatedMetrics.NetworkUptime = networkMetrics.UpTimePercent
	sm.aggregatedMetrics.LastSuccessfulSync = syncMetrics.LastSuccessfulSync
	
	// Calculate sync success rate
	if syncMetrics.TotalSyncAttempts > 0 {
		sm.aggregatedMetrics.SyncSuccessRate = float64(syncMetrics.SuccessfulSyncs) / float64(syncMetrics.TotalSyncAttempts) * 100
	} else {
		sm.aggregatedMetrics.SyncSuccessRate = 0
	}
	
	// Estimate next scheduled sync (if network is online and no sync in progress)
	if networkMetrics.Status == NetworkStatusOnline && !syncMetrics.SyncInProgress {
		if !syncMetrics.NextRetryTime.IsZero() {
			sm.aggregatedMetrics.NextScheduledSync = syncMetrics.NextRetryTime
		} else {
			// Regular sync interval (5 minutes)
			sm.aggregatedMetrics.NextScheduledSync = time.Now().Add(5 * time.Minute)
		}
	} else {
		sm.aggregatedMetrics.NextScheduledSync = time.Time{}
	}
}

// evaluateOverallHealth evaluates and updates the overall system health
func (sm *SyncManager) evaluateOverallHealth() {
	networkMetrics := sm.networkMonitor.GetMetrics()
	syncMetrics := sm.dataSyncService.GetMetrics()
	storageMetrics := sm.storageCache.GetMetrics()
	
	var health string
	
	// Determine overall health based on component status
	switch {
	case sm.isSystemHealthy(networkMetrics, syncMetrics, storageMetrics):
		health = "healthy"
		
	case sm.isSystemDegraded(networkMetrics, syncMetrics, storageMetrics):
		health = "degraded"
		
	default:
		health = "unhealthy"
	}
	
	// Update health status
	sm.metricsMutex.Lock()
	oldHealth := sm.aggregatedMetrics.OverallHealth
	sm.aggregatedMetrics.OverallHealth = health
	sm.metricsMutex.Unlock()
	
	// Log health changes
	if oldHealth != health {
		sm.logger.Info("Overall system health changed", 
			"old_health", oldHealth,
			"new_health", health,
			"network_status", networkMetrics.Status,
			"pending_data", storageMetrics.CachedDataCount,
			"sync_success_rate", sm.aggregatedMetrics.SyncSuccessRate)
	}
}

// isSystemHealthy determines if the system is healthy
func (sm *SyncManager) isSystemHealthy(network *NetworkMetrics, sync *SyncMetrics, storage *storage.StorageMetrics) bool {
	now := time.Now()
	
	// Network must be online
	if network.Status != NetworkStatusOnline {
		return false
	}
	
	// Storage must be healthy
	if !storage.StorageHealthy {
		return false
	}
	
	// If there's no pending data, system is healthy
	if storage.CachedDataCount == 0 {
		return true
	}
	
	// If there's pending data, check sync performance
	if sync.TotalSyncAttempts > 0 {
		// Success rate should be > 80%
		successRate := float64(sync.SuccessfulSyncs) / float64(sync.TotalSyncAttempts)
		if successRate < 0.8 {
			return false
		}
		
		// Last successful sync should be recent (< 30 minutes)
		if !sync.LastSuccessfulSync.IsZero() && now.Sub(sync.LastSuccessfulSync) > 30*time.Minute {
			return false
		}
	}
	
	return true
}

// isSystemDegraded determines if the system is in a degraded state
func (sm *SyncManager) isSystemDegraded(network *NetworkMetrics, sync *SyncMetrics, storage *storage.StorageMetrics) bool {
	now := time.Now()
	
	// Network issues but not completely offline
	if network.Status == NetworkStatusDegraded {
		return true
	}
	
	// Storage issues but not critical
	if !storage.StorageHealthy && storage.DiskSpacePercent < 95 {
		return true
	}
	
	// Sync issues but not complete failure
	if sync.TotalSyncAttempts > 0 {
		successRate := float64(sync.SuccessfulSyncs) / float64(sync.TotalSyncAttempts)
		
		// Success rate between 50-80%
		if successRate >= 0.5 && successRate < 0.8 {
			return true
		}
		
		// Last successful sync was somewhat recent (< 2 hours)
		if !sync.LastSuccessfulSync.IsZero() && 
		   now.Sub(sync.LastSuccessfulSync) > 30*time.Minute && 
		   now.Sub(sync.LastSuccessfulSync) < 2*time.Hour {
			return true
		}
	}
	
	// Moderate amount of pending data
	if storage.CachedDataCount > 0 && storage.CachedDataCount < 50000 {
		return true
	}
	
	return false
}

// GetHealthSummary returns a human-readable health summary
func (sm *SyncManager) GetHealthSummary() string {
	metrics := sm.GetAggregatedMetrics()
	
	switch metrics.OverallHealth {
	case "healthy":
		if metrics.TotalPendingData == 0 {
			return "System is healthy. All data is synchronized."
		}
		return fmt.Sprintf("System is healthy. %d records pending sync.", metrics.TotalPendingData)
		
	case "degraded":
		return fmt.Sprintf("System is degraded. Network: %s, Pending: %d records, Success rate: %.1f%%",
			metrics.NetworkMetrics.Status, metrics.TotalPendingData, metrics.SyncSuccessRate)
		
	case "unhealthy":
		return fmt.Sprintf("System is unhealthy. Network: %s, Pending: %d records, Success rate: %.1f%%",
			metrics.NetworkMetrics.Status, metrics.TotalPendingData, metrics.SyncSuccessRate)
		
	default:
		return "System health unknown"
	}
}

// GetDetailedStatus returns detailed status information
func (sm *SyncManager) GetDetailedStatus() map[string]interface{} {
	metrics := sm.GetAggregatedMetrics()
	
	return map[string]interface{}{
		"overall_health":        metrics.OverallHealth,
		"network_status":        metrics.NetworkMetrics.Status,
		"network_uptime":        fmt.Sprintf("%.2f%%", metrics.NetworkUptime),
		"pending_data_count":    metrics.TotalPendingData,
		"sync_success_rate":     fmt.Sprintf("%.2f%%", metrics.SyncSuccessRate),
		"last_successful_sync":  metrics.LastSuccessfulSync.Format(time.RFC3339),
		"next_scheduled_sync":   metrics.NextScheduledSync.Format(time.RFC3339),
		"storage_healthy":       metrics.StorageMetrics.StorageHealthy,
		"disk_usage":           fmt.Sprintf("%.2f%%", metrics.StorageMetrics.DiskSpacePercent),
		"sync_in_progress":     metrics.SyncMetrics.SyncInProgress,
		"consecutive_failures":  metrics.NetworkMetrics.ConsecutiveFailures,
		"last_error":           metrics.SyncMetrics.LastError,
	}
}