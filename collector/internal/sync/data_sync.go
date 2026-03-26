package sync

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"prodb/collector/internal/communication"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/storage"
)

// DataSyncService manages data synchronization between local cache and platform
type DataSyncService struct {
	config         config.PlatformConfig
	logger         *logger.Logger
	storageCache   *storage.StorageCache
	platformClient *communication.PlatformClient
	networkMonitor *NetworkMonitor
	
	// Sync configuration
	batchSize      int
	maxRetries     int
	baseDelay      time.Duration
	maxDelay       time.Duration
	backoffFactor  float64
	
	// Control
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	
	// State
	isRunning      bool
	runningMutex   sync.RWMutex
	
	// Metrics
	metrics        *SyncMetrics
	metricsMutex   sync.RWMutex
	
	// Retry strategy
	retryStrategy  *ExponentialBackoffStrategy
}

// SyncMetrics contains data synchronization metrics
type SyncMetrics struct {
	TotalSyncAttempts     int64     `json:"total_sync_attempts"`
	SuccessfulSyncs       int64     `json:"successful_syncs"`
	FailedSyncs           int64     `json:"failed_syncs"`
	TotalDataPointsSynced int64     `json:"total_data_points_synced"`
	TotalBatchesSynced    int64     `json:"total_batches_synced"`
	LastSyncTime          time.Time `json:"last_sync_time"`
	LastSuccessfulSync    time.Time `json:"last_successful_sync"`
	LastFailedSync        time.Time `json:"last_failed_sync"`
	CurrentRetryCount     int       `json:"current_retry_count"`
	NextRetryTime         time.Time `json:"next_retry_time,omitempty"`
	AverageResponseTime   time.Duration `json:"average_response_time"`
	LastError             string    `json:"last_error,omitempty"`
	PendingDataCount      int64     `json:"pending_data_count"`
	SyncInProgress        bool      `json:"sync_in_progress"`
}

// ExponentialBackoffStrategy implements exponential backoff retry logic
type ExponentialBackoffStrategy struct {
	baseDelay     time.Duration
	maxDelay      time.Duration
	backoffFactor float64
	maxRetries    int
	jitterEnabled bool
}

// SyncResult represents the result of a sync operation
type SyncResult struct {
	Success           bool
	ProcessedRecords  int64
	FailedRecords     int64
	ResponseTime      time.Duration
	Error             error
	RetryAfter        time.Duration
}

// NewDataSyncService creates a new data sync service
func NewDataSyncService(
	config config.PlatformConfig,
	storageCache *storage.StorageCache,
	platformClient *communication.PlatformClient,
	networkMonitor *NetworkMonitor,
	logger *logger.Logger,
) *DataSyncService {
	ctx, cancel := context.WithCancel(context.Background())
	
	// Create exponential backoff strategy
	retryStrategy := &ExponentialBackoffStrategy{
		baseDelay:     time.Duration(config.RetryDelay) * time.Second,
		maxDelay:      5 * time.Minute, // Maximum 5 minutes between retries
		backoffFactor: 2.0,             // Double the delay each time
		maxRetries:    config.MaxRetries,
		jitterEnabled: true,            // Add jitter to prevent thundering herd
	}
	
	return &DataSyncService{
		config:         config,
		logger:         logger.WithGroup("data_sync"),
		storageCache:   storageCache,
		platformClient: platformClient,
		networkMonitor: networkMonitor,
		batchSize:      1000, // Sync 1000 records per batch
		maxRetries:     config.MaxRetries,
		baseDelay:      time.Duration(config.RetryDelay) * time.Second,
		maxDelay:       5 * time.Minute,
		backoffFactor:  2.0,
		ctx:            ctx,
		cancel:         cancel,
		metrics: &SyncMetrics{
			PendingDataCount: 0,
		},
		retryStrategy: retryStrategy,
	}
}

// Start starts the data sync service
func (dss *DataSyncService) Start() error {
	dss.runningMutex.Lock()
	defer dss.runningMutex.Unlock()
	
	if dss.isRunning {
		return fmt.Errorf("data sync service is already running")
	}
	
	dss.logger.Info("Starting data sync service")
	
	// Set up network monitor callbacks
	dss.networkMonitor.SetOnOnlineCallback(func() {
		dss.logger.Info("Network came online, triggering data sync")
		go dss.TriggerSync()
	})
	
	// Start sync routine
	dss.wg.Add(1)
	go dss.syncRoutine()
	
	// Start metrics update routine
	dss.wg.Add(1)
	go dss.metricsUpdateRoutine()
	
	dss.isRunning = true
	dss.logger.Info("Data sync service started")
	
	return nil
}

// Stop stops the data sync service
func (dss *DataSyncService) Stop() {
	dss.runningMutex.Lock()
	defer dss.runningMutex.Unlock()
	
	if !dss.isRunning {
		return
	}
	
	dss.logger.Info("Stopping data sync service")
	
	dss.cancel()
	dss.wg.Wait()
	
	dss.isRunning = false
	dss.logger.Info("Data sync service stopped")
}

// TriggerSync triggers an immediate sync attempt
func (dss *DataSyncService) TriggerSync() {
	if !dss.networkMonitor.IsOnline() {
		dss.logger.Debug("Network is offline, skipping sync trigger")
		return
	}
	
	dss.logger.Debug("Triggering immediate data sync")
	
	// Perform sync in a separate goroutine to avoid blocking
	go func() {
		if err := dss.performSync(); err != nil {
			dss.logger.Error("Triggered sync failed", "error", err)
		}
	}()
}

// GetMetrics returns sync metrics
func (dss *DataSyncService) GetMetrics() *SyncMetrics {
	dss.metricsMutex.RLock()
	defer dss.metricsMutex.RUnlock()
	
	// Create a copy to avoid race conditions
	metrics := *dss.metrics
	return &metrics
}

// syncRoutine runs the main sync loop
func (dss *DataSyncService) syncRoutine() {
	defer dss.wg.Done()
	
	// Initial sync attempt when starting
	if dss.networkMonitor.IsOnline() {
		dss.logger.Debug("Performing initial sync on startup")
		if err := dss.performSync(); err != nil {
			dss.logger.Warn("Initial sync failed", "error", err)
		}
	}
	
	// Regular sync interval (every 5 minutes when online)
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-dss.ctx.Done():
			return
			
		case <-ticker.C:
			if dss.networkMonitor.IsOnline() {
				if err := dss.performSync(); err != nil {
					dss.logger.Debug("Scheduled sync failed", "error", err)
				}
			} else {
				dss.logger.Debug("Network offline, skipping scheduled sync")
			}
		}
	}
}

// metricsUpdateRoutine updates sync metrics periodically
func (dss *DataSyncService) metricsUpdateRoutine() {
	defer dss.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-dss.ctx.Done():
			return
			
		case <-ticker.C:
			dss.updatePendingDataCount()
		}
	}
}

// performSync performs a complete sync operation with retry logic
func (dss *DataSyncService) performSync() error {
	dss.metricsMutex.Lock()
	if dss.metrics.SyncInProgress {
		dss.metricsMutex.Unlock()
		dss.logger.Debug("Sync already in progress, skipping")
		return nil
	}
	dss.metrics.SyncInProgress = true
	dss.metricsMutex.Unlock()
	
	defer func() {
		dss.metricsMutex.Lock()
		dss.metrics.SyncInProgress = false
		dss.metricsMutex.Unlock()
	}()
	
	startTime := time.Now()
	
	// Check if network is online
	if !dss.networkMonitor.IsOnline() {
		return fmt.Errorf("network is offline")
	}
	
	// Get cached data to sync
	cachedData, err := dss.storageCache.Retrieve(dss.batchSize)
	if err != nil {
		dss.updateMetricsOnFailure(err, time.Since(startTime))
		return fmt.Errorf("failed to retrieve cached data: %w", err)
	}
	
	if len(cachedData) == 0 {
		dss.logger.Debug("No cached data to sync")
		return nil
	}
	
	dss.logger.Info("Starting data sync", "batch_size", len(cachedData))
	
	// Perform sync with retry logic
	result := dss.syncWithRetry(cachedData)
	
	// Update metrics based on result
	if result.Success {
		dss.updateMetricsOnSuccess(result)
		dss.logger.Info("Data sync completed successfully", 
			"processed_records", result.ProcessedRecords,
			"response_time", result.ResponseTime)
	} else {
		dss.updateMetricsOnFailure(result.Error, result.ResponseTime)
		dss.logger.Error("Data sync failed", 
			"error", result.Error,
			"failed_records", result.FailedRecords)
	}
	
	return result.Error
}

// syncWithRetry performs sync with exponential backoff retry
func (dss *DataSyncService) syncWithRetry(cachedData []storage.CachedData) *SyncResult {
	var lastError error
	var totalProcessed int64
	var totalFailed int64
	
	for attempt := 0; attempt <= dss.retryStrategy.maxRetries; attempt++ {
		if attempt > 0 {
			// Calculate retry delay with exponential backoff
			delay := dss.retryStrategy.calculateDelay(attempt)
			
			dss.logger.Debug("Retrying sync after delay", 
				"attempt", attempt,
				"delay", delay,
				"max_retries", dss.retryStrategy.maxRetries)
			
			// Update metrics with next retry time
			dss.metricsMutex.Lock()
			dss.metrics.CurrentRetryCount = attempt
			dss.metrics.NextRetryTime = time.Now().Add(delay)
			dss.metricsMutex.Unlock()
			
			// Wait for retry delay or context cancellation
			select {
			case <-dss.ctx.Done():
				return &SyncResult{
					Success:      false,
					Error:        fmt.Errorf("sync cancelled during retry"),
					FailedRecords: int64(len(cachedData)),
				}
			case <-time.After(delay):
				// Continue with retry
			}
			
			// Check if network is still online before retry
			if !dss.networkMonitor.IsOnline() {
				return &SyncResult{
					Success:      false,
					Error:        fmt.Errorf("network went offline during retry"),
					FailedRecords: int64(len(cachedData)),
				}
			}
		}
		
		// Attempt to sync the batch
		result := dss.syncBatch(cachedData)
		
		if result.Success {
			// Reset retry count on success
			dss.metricsMutex.Lock()
			dss.metrics.CurrentRetryCount = 0
			dss.metrics.NextRetryTime = time.Time{}
			dss.metricsMutex.Unlock()
			
			return result
		}
		
		lastError = result.Error
		totalFailed += result.FailedRecords
		
		// Check if this is a permanent failure (don't retry)
		if dss.isPermanentFailure(result.Error) {
			dss.logger.Warn("Permanent failure detected, not retrying", "error", result.Error)
			break
		}
		
		dss.logger.Warn("Sync attempt failed", 
			"attempt", attempt+1,
			"error", result.Error)
	}
	
	// All retries exhausted
	dss.metricsMutex.Lock()
	dss.metrics.CurrentRetryCount = 0
	dss.metrics.NextRetryTime = time.Time{}
	dss.metricsMutex.Unlock()
	
	return &SyncResult{
		Success:          false,
		ProcessedRecords: totalProcessed,
		FailedRecords:    totalFailed,
		Error:            fmt.Errorf("sync failed after %d attempts: %w", dss.retryStrategy.maxRetries+1, lastError),
	}
}

// syncBatch syncs a single batch of cached data
func (dss *DataSyncService) syncBatch(cachedData []storage.CachedData) *SyncResult {
	startTime := time.Now()
	
	// Convert cached data to data values for upload
	var allDataValues []protocol.DataValue
	var recordIDs []int64
	
	for _, cached := range cachedData {
		allDataValues = append(allDataValues, cached.DataPoints...)
		recordIDs = append(recordIDs, cached.ID)
	}
	
	// Upload data to platform
	err := dss.platformClient.UploadData(dss.config.BaseURL, allDataValues)
	responseTime := time.Since(startTime)
	
	if err != nil {
		// Increment retry count for failed records
		if retryErr := dss.storageCache.IncrementRetryCount(recordIDs); retryErr != nil {
			dss.logger.Error("Failed to increment retry count", "error", retryErr)
		}
		
		return &SyncResult{
			Success:       false,
			FailedRecords: int64(len(cachedData)),
			ResponseTime:  responseTime,
			Error:         err,
		}
	}
	
	// Mark data as uploaded on success
	if err := dss.storageCache.MarkUploaded(recordIDs); err != nil {
		dss.logger.Error("Failed to mark data as uploaded", "error", err)
		// This is not a critical failure, data was uploaded successfully
	}
	
	return &SyncResult{
		Success:          true,
		ProcessedRecords: int64(len(cachedData)),
		ResponseTime:     responseTime,
	}
}

// calculateDelay calculates the retry delay using exponential backoff
func (ebs *ExponentialBackoffStrategy) calculateDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return ebs.baseDelay
	}
	
	// Calculate exponential backoff: baseDelay * (backoffFactor ^ attempt)
	delay := float64(ebs.baseDelay) * math.Pow(ebs.backoffFactor, float64(attempt))
	
	// Cap at maximum delay
	if delay > float64(ebs.maxDelay) {
		delay = float64(ebs.maxDelay)
	}
	
	duration := time.Duration(delay)
	
	// Add jitter to prevent thundering herd problem
	if ebs.jitterEnabled {
		jitter := time.Duration(float64(duration) * 0.1 * (2*rand.Float64() - 1)) // ±10% jitter
		duration += jitter
		
		// Ensure duration is not negative
		if duration < 0 {
			duration = ebs.baseDelay
		}
	}
	
	return duration
}

// isPermanentFailure checks if an error represents a permanent failure
func (dss *DataSyncService) isPermanentFailure(err error) bool {
	if err == nil {
		return false
	}
	
	errorStr := err.Error()
	
	// Check for authentication errors (permanent until token refresh)
	if contains(errorStr, "401") || contains(errorStr, "unauthorized") {
		return true
	}
	
	// Check for forbidden errors
	if contains(errorStr, "403") || contains(errorStr, "forbidden") {
		return true
	}
	
	// Check for bad request errors (malformed data)
	if contains(errorStr, "400") || contains(errorStr, "bad request") {
		return true
	}
	
	// Check for not found errors (endpoint doesn't exist)
	if contains(errorStr, "404") || contains(errorStr, "not found") {
		return true
	}
	
	return false
}

// updateMetricsOnSuccess updates metrics after successful sync
func (dss *DataSyncService) updateMetricsOnSuccess(result *SyncResult) {
	dss.metricsMutex.Lock()
	defer dss.metricsMutex.Unlock()
	
	now := time.Now()
	
	dss.metrics.TotalSyncAttempts++
	dss.metrics.SuccessfulSyncs++
	dss.metrics.TotalDataPointsSynced += result.ProcessedRecords
	dss.metrics.TotalBatchesSynced++
	dss.metrics.LastSyncTime = now
	dss.metrics.LastSuccessfulSync = now
	dss.metrics.LastError = ""
	
	// Update average response time
	if dss.metrics.SuccessfulSyncs == 1 {
		dss.metrics.AverageResponseTime = result.ResponseTime
	} else {
		// Calculate running average
		totalTime := dss.metrics.AverageResponseTime * time.Duration(dss.metrics.SuccessfulSyncs-1)
		dss.metrics.AverageResponseTime = (totalTime + result.ResponseTime) / time.Duration(dss.metrics.SuccessfulSyncs)
	}
}

// updateMetricsOnFailure updates metrics after failed sync
func (dss *DataSyncService) updateMetricsOnFailure(err error, responseTime time.Duration) {
	dss.metricsMutex.Lock()
	defer dss.metricsMutex.Unlock()
	
	now := time.Now()
	
	dss.metrics.TotalSyncAttempts++
	dss.metrics.FailedSyncs++
	dss.metrics.LastSyncTime = now
	dss.metrics.LastFailedSync = now
	
	if err != nil {
		dss.metrics.LastError = err.Error()
	}
}

// updatePendingDataCount updates the pending data count metric
func (dss *DataSyncService) updatePendingDataCount() {
	// Get storage metrics to determine pending data count
	storageMetrics := dss.storageCache.GetMetrics()
	
	dss.metricsMutex.Lock()
	dss.metrics.PendingDataCount = storageMetrics.CachedDataCount
	dss.metricsMutex.Unlock()
}

// GetPendingDataCount returns the current number of pending data records
func (dss *DataSyncService) GetPendingDataCount() int64 {
	dss.metricsMutex.RLock()
	defer dss.metricsMutex.RUnlock()
	return dss.metrics.PendingDataCount
}

// IsHealthy returns true if the sync service is healthy
func (dss *DataSyncService) IsHealthy() bool {
	metrics := dss.GetMetrics()
	
	// Consider healthy if:
	// 1. No sync in progress for too long (> 10 minutes)
	// 2. Last successful sync was recent (< 1 hour) OR no data to sync
	// 3. Not too many consecutive failures
	
	now := time.Now()
	
	// Check if sync has been running too long
	if metrics.SyncInProgress && !metrics.LastSyncTime.IsZero() {
		if now.Sub(metrics.LastSyncTime) > 10*time.Minute {
			return false
		}
	}
	
	// If there's no pending data, consider healthy
	if metrics.PendingDataCount == 0 {
		return true
	}
	
	// Check last successful sync time
	if !metrics.LastSuccessfulSync.IsZero() {
		if now.Sub(metrics.LastSuccessfulSync) < time.Hour {
			return true
		}
	}
	
	// Check failure rate
	if metrics.TotalSyncAttempts > 0 {
		failureRate := float64(metrics.FailedSyncs) / float64(metrics.TotalSyncAttempts)
		if failureRate < 0.5 { // Less than 50% failure rate
			return true
		}
	}
	
	return false
}

// Helper function to check if string contains substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
		    (len(s) > len(substr) && 
		     (s[:len(substr)] == substr || 
		      s[len(s)-len(substr):] == substr ||
		      findInString(s, substr))))
}

func findInString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}