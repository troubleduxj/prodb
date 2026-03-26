package services

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"prodb/platform/backend/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// HeartbeatService handles collector heartbeat monitoring
type HeartbeatService struct {
	db                *gorm.DB
	offlineThreshold  time.Duration
	warningThreshold  time.Duration
	cleanupInterval   time.Duration
	retentionPeriod   time.Duration
	alertService      *AlertService
	
	// Monitoring state
	monitoringActive  bool
	monitoringMutex   sync.RWMutex
	stopChan          chan struct{}
	wg                sync.WaitGroup
}

// HeartbeatConfig represents heartbeat service configuration
type HeartbeatConfig struct {
	OfflineThreshold  time.Duration `json:"offline_threshold"`   // 5 minutes default
	WarningThreshold  time.Duration `json:"warning_threshold"`   // 3 minutes default
	CleanupInterval   time.Duration `json:"cleanup_interval"`    // 1 hour default
	RetentionPeriod   time.Duration `json:"retention_period"`    // 30 days default
}

// HeartbeatData represents heartbeat payload
type HeartbeatData struct {
	CollectorID string                 `json:"collector_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Status      string                 `json:"status"`
	Metrics     map[string]interface{} `json:"metrics"`
}

// NewHeartbeatService creates a new heartbeat service
func NewHeartbeatService(db *gorm.DB, alertService *AlertService) *HeartbeatService {
	return &HeartbeatService{
		db:               db,
		offlineThreshold: 5 * time.Minute,
		warningThreshold: 3 * time.Minute,
		cleanupInterval:  1 * time.Hour,
		retentionPeriod:  30 * 24 * time.Hour, // 30 days
		alertService:     alertService,
		stopChan:         make(chan struct{}),
	}
}

// Configure updates the heartbeat service configuration
func (hs *HeartbeatService) Configure(config HeartbeatConfig) {
	hs.monitoringMutex.Lock()
	defer hs.monitoringMutex.Unlock()
	
	if config.OfflineThreshold > 0 {
		hs.offlineThreshold = config.OfflineThreshold
	}
	if config.WarningThreshold > 0 {
		hs.warningThreshold = config.WarningThreshold
	}
	if config.CleanupInterval > 0 {
		hs.cleanupInterval = config.CleanupInterval
	}
	if config.RetentionPeriod > 0 {
		hs.retentionPeriod = config.RetentionPeriod
	}
}

// StartMonitoring starts the heartbeat monitoring service
func (hs *HeartbeatService) StartMonitoring() error {
	hs.monitoringMutex.Lock()
	defer hs.monitoringMutex.Unlock()
	
	if hs.monitoringActive {
		return fmt.Errorf("heartbeat monitoring is already active")
	}
	
	hs.monitoringActive = true
	hs.stopChan = make(chan struct{})
	
	// Start monitoring goroutine
	hs.wg.Add(1)
	go hs.monitoringLoop()
	
	// Start cleanup goroutine
	hs.wg.Add(1)
	go hs.cleanupLoop()
	
	log.Println("Heartbeat monitoring service started")
	return nil
}

// StopMonitoring stops the heartbeat monitoring service
func (hs *HeartbeatService) StopMonitoring() {
	hs.monitoringMutex.Lock()
	defer hs.monitoringMutex.Unlock()
	
	if !hs.monitoringActive {
		return
	}
	
	hs.monitoringActive = false
	close(hs.stopChan)
	hs.wg.Wait()
	
	log.Println("Heartbeat monitoring service stopped")
}

// ProcessHeartbeat processes an incoming heartbeat
func (hs *HeartbeatService) ProcessHeartbeat(heartbeat HeartbeatData) error {
	collectorID, err := uuid.Parse(heartbeat.CollectorID)
	if err != nil {
		return fmt.Errorf("invalid collector ID: %w", err)
	}
	
	// Start transaction
	tx := hs.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()
	
	// Store heartbeat record
	metricsJSON, _ := json.Marshal(heartbeat.Metrics)
	heartbeatRecord := models.CollectorHeartbeat{
		CollectorID: collectorID,
		Timestamp:   heartbeat.Timestamp,
		Status:      heartbeat.Status,
		Metrics:     string(metricsJSON),
	}
	
	if err := tx.Create(&heartbeatRecord).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to store heartbeat: %w", err)
	}
	
	// Update collector status
	if err := hs.updateCollectorStatus(tx, collectorID, heartbeat); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update collector status: %w", err)
	}
	
	// Store metrics history
	if err := hs.storeMetricsHistory(tx, collectorID, heartbeat.Timestamp, heartbeat.Metrics); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to store metrics history: %w", err)
	}
	
	// Update collector's last heartbeat in collectors table
	if err := tx.Model(&models.Collector{}).Where("id = ?", collectorID).
		Update("last_heartbeat", heartbeat.Timestamp).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update collector last heartbeat: %w", err)
	}
	
	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit heartbeat transaction: %w", err)
	}
	
	log.Printf("Processed heartbeat for collector %s, status: %s", heartbeat.CollectorID, heartbeat.Status)
	return nil
}

// updateCollectorStatus updates the collector status record
func (hs *HeartbeatService) updateCollectorStatus(tx *gorm.DB, collectorID uuid.UUID, heartbeat HeartbeatData) error {
	var status models.CollectorStatus
	
	// Get or create collector status
	err := tx.Where("collector_id = ?", collectorID).First(&status).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create new status record
			metricsJSON, _ := json.Marshal(heartbeat.Metrics)
			status = models.CollectorStatus{
				CollectorID:   collectorID,
				Status:        heartbeat.Status,
				LastHeartbeat: heartbeat.Timestamp,
				LastMetrics:   string(metricsJSON),
			}
			
			if heartbeat.Status == "running" || heartbeat.Status == "online" {
				now := time.Now()
				status.LastOnline = &now
			}
			
			return tx.Create(&status).Error
		}
		return err
	}
	
	// Calculate uptime/downtime
	timeDiff := heartbeat.Timestamp.Sub(status.LastHeartbeat).Seconds()
	
	// Update status
	previousStatus := status.Status
	status.Status = heartbeat.Status
	status.LastHeartbeat = heartbeat.Timestamp
	
	metricsJSON, _ := json.Marshal(heartbeat.Metrics)
	status.LastMetrics = string(metricsJSON)
	
	// Handle status transitions
	now := time.Now()
	if heartbeat.Status == "running" || heartbeat.Status == "online" {
		if previousStatus == "offline" || previousStatus == "error" {
			status.LastOnline = &now
			status.ConsecutiveFailures = 0
		}
		
		// Add to uptime if previously online
		if previousStatus == "running" || previousStatus == "online" {
			status.TotalUptime += int64(timeDiff)
		}
	} else {
		if previousStatus == "running" || previousStatus == "online" {
			status.LastOffline = &now
		}
		
		// Add to downtime if previously offline
		if previousStatus == "offline" || previousStatus == "error" {
			status.TotalDowntime += int64(timeDiff)
		}
		
		status.ConsecutiveFailures++
	}
	
	return tx.Save(&status).Error
}

// storeMetricsHistory stores metrics in the history table
func (hs *HeartbeatService) storeMetricsHistory(tx *gorm.DB, collectorID uuid.UUID, timestamp time.Time, metrics map[string]interface{}) error {
	history := models.CollectorMetricsHistory{
		CollectorID: collectorID,
		Timestamp:   timestamp,
	}
	
	// Extract metrics with type assertions
	if val, ok := metrics["cpu_usage"].(float64); ok {
		history.CPUUsage = &val
	}
	if val, ok := metrics["memory_usage"].(float64); ok {
		intVal := int64(val)
		history.MemoryUsage = &intVal
	}
	if val, ok := metrics["disk_usage"].(float64); ok {
		intVal := int64(val)
		history.DiskUsage = &intVal
	}
	if val, ok := metrics["network_in"].(float64); ok {
		intVal := int64(val)
		history.NetworkIn = &intVal
	}
	if val, ok := metrics["network_out"].(float64); ok {
		intVal := int64(val)
		history.NetworkOut = &intVal
	}
	if val, ok := metrics["data_points_per_sec"].(float64); ok {
		history.DataPointsPerSec = &val
	}
	if val, ok := metrics["active_connections"].(float64); ok {
		intVal := int(val)
		history.ActiveConnections = &intVal
	}
	if val, ok := metrics["failed_connections"].(float64); ok {
		intVal := int(val)
		history.FailedConnections = &intVal
	}
	if val, ok := metrics["cached_data_count"].(float64); ok {
		intVal := int64(val)
		history.CachedDataCount = &intVal
	}
	if val, ok := metrics["buffer_size"].(float64); ok {
		intVal := int(val)
		history.BufferSize = &intVal
	}
	
	return tx.Create(&history).Error
}

// monitoringLoop runs the main monitoring loop
func (hs *HeartbeatService) monitoringLoop() {
	defer hs.wg.Done()
	
	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()
	
	for {
		select {
		case <-hs.stopChan:
			return
		case <-ticker.C:
			hs.checkOfflineCollectors()
		}
	}
}

// checkOfflineCollectors checks for offline collectors and triggers alerts
func (hs *HeartbeatService) checkOfflineCollectors() {
	now := time.Now()
	offlineThreshold := now.Add(-hs.offlineThreshold)
	warningThreshold := now.Add(-hs.warningThreshold)
	
	// Find collectors that haven't sent heartbeats
	var collectors []models.Collector
	err := hs.db.Where("last_heartbeat < ? OR last_heartbeat IS NULL", offlineThreshold).Find(&collectors).Error
	if err != nil {
		log.Printf("Error checking offline collectors: %v", err)
		return
	}
	
	for _, collector := range collectors {
		// Check current status
		var status models.CollectorStatus
		err := hs.db.Where("collector_id = ?", collector.ID).First(&status).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				// Create initial status record
				status = models.CollectorStatus{
					CollectorID:   collector.ID,
					Status:        "offline",
					LastHeartbeat: time.Time{},
				}
				hs.db.Create(&status)
			} else {
				log.Printf("Error getting collector status: %v", err)
				continue
			}
		}
		
		// Determine alert level
		var alertType, severity, message string
		
		if collector.LastHeartbeat == nil || collector.LastHeartbeat.Before(offlineThreshold) {
			if status.Status != "offline" {
				// Collector just went offline
				alertType = "collector_offline"
				severity = "critical"
				message = fmt.Sprintf("Collector '%s' has gone offline. Last heartbeat: %v", 
					collector.Name, collector.LastHeartbeat)
				
				// Update status to offline
				hs.db.Model(&status).Updates(models.CollectorStatus{
					Status: "offline",
					ConsecutiveFailures: status.ConsecutiveFailures + 1,
				})
				
				// Trigger alert
				if hs.alertService != nil {
					hs.alertService.TriggerAlert(models.CollectorAlert{
						CollectorID: collector.ID,
						AlertType:   alertType,
						Severity:    severity,
						Title:       "Collector Offline",
						Message:     message,
						FiredAt:     now,
						Status:      "active",
					})
				}
			}
		} else if collector.LastHeartbeat.Before(warningThreshold) {
			if status.Status != "warning" {
				// Collector is in warning state
				alertType = "collector_warning"
				severity = "warning"
				message = fmt.Sprintf("Collector '%s' heartbeat is delayed. Last heartbeat: %v", 
					collector.Name, collector.LastHeartbeat)
				
				// Update status to warning
				hs.db.Model(&status).Update("status", "warning")
				
				// Trigger warning alert
				if hs.alertService != nil {
					hs.alertService.TriggerAlert(models.CollectorAlert{
						CollectorID: collector.ID,
						AlertType:   alertType,
						Severity:    severity,
						Title:       "Collector Heartbeat Delayed",
						Message:     message,
						FiredAt:     now,
						Status:      "active",
					})
				}
			}
		}
	}
}

// cleanupLoop runs the cleanup process
func (hs *HeartbeatService) cleanupLoop() {
	defer hs.wg.Done()
	
	ticker := time.NewTicker(hs.cleanupInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-hs.stopChan:
			return
		case <-ticker.C:
			hs.cleanupOldData()
		}
	}
}

// cleanupOldData removes old heartbeat and metrics data
func (hs *HeartbeatService) cleanupOldData() {
	cutoff := time.Now().Add(-hs.retentionPeriod)
	
	// Clean up old heartbeat records
	result := hs.db.Where("created_at < ?", cutoff).Delete(&models.CollectorHeartbeat{})
	if result.Error != nil {
		log.Printf("Error cleaning up heartbeat records: %v", result.Error)
	} else if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d old heartbeat records", result.RowsAffected)
	}
	
	// Clean up old metrics history
	result = hs.db.Where("created_at < ?", cutoff).Delete(&models.CollectorMetricsHistory{})
	if result.Error != nil {
		log.Printf("Error cleaning up metrics history: %v", result.Error)
	} else if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d old metrics history records", result.RowsAffected)
	}
	
	// Clean up resolved alerts older than retention period
	result = hs.db.Where("resolved_at < ? AND status = 'resolved'", cutoff).Delete(&models.CollectorAlert{})
	if result.Error != nil {
		log.Printf("Error cleaning up old alerts: %v", result.Error)
	} else if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d old resolved alerts", result.RowsAffected)
	}
}

// GetCollectorStatus returns the current status of a collector
func (hs *HeartbeatService) GetCollectorStatus(collectorID uuid.UUID) (*models.CollectorStatus, error) {
	var status models.CollectorStatus
	err := hs.db.Preload("Collector").Where("collector_id = ?", collectorID).First(&status).Error
	if err != nil {
		return nil, err
	}
	return &status, nil
}

// GetHeartbeatStatistics returns heartbeat statistics for a collector
func (hs *HeartbeatService) GetHeartbeatStatistics(collectorID uuid.UUID, period time.Duration) (*models.HeartbeatStatistics, error) {
	var collector models.Collector
	if err := hs.db.First(&collector, collectorID).Error; err != nil {
		return nil, err
	}
	
	var status models.CollectorStatus
	err := hs.db.Where("collector_id = ?", collectorID).First(&status).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	
	// Calculate statistics for the given period
	since := time.Now().Add(-period)
	
	var totalHeartbeats int64
	hs.db.Model(&models.CollectorHeartbeat{}).
		Where("collector_id = ? AND created_at >= ?", collectorID, since).
		Count(&totalHeartbeats)
	
	// Calculate expected heartbeats (assuming 60-second intervals)
	expectedHeartbeats := int64(period.Seconds() / 60)
	missedHeartbeats := expectedHeartbeats - totalHeartbeats
	if missedHeartbeats < 0 {
		missedHeartbeats = 0
	}
	
	// Calculate uptime percentage
	uptimePercent := float64(0)
	if expectedHeartbeats > 0 {
		uptimePercent = (float64(totalHeartbeats) / float64(expectedHeartbeats)) * 100
	}
	
	stats := &models.HeartbeatStatistics{
		CollectorID:         collectorID,
		CollectorName:       collector.Name,
		Status:              status.Status,
		LastHeartbeat:       status.LastHeartbeat,
		UptimePercent:       uptimePercent,
		TotalHeartbeats:     totalHeartbeats,
		MissedHeartbeats:    missedHeartbeats,
		LastOnline:          status.LastOnline,
		LastOffline:         status.LastOffline,
		ConsecutiveFailures: status.ConsecutiveFailures,
	}
	
	return stats, nil
}

// GetCollectorHealthSummary returns overall collector health summary
func (hs *HeartbeatService) GetCollectorHealthSummary() (*models.CollectorHealthSummary, error) {
	var summary models.CollectorHealthSummary
	
	// Count total collectors
	var totalCount int64
	hs.db.Model(&models.Collector{}).Count(&totalCount)
	summary.TotalCollectors = int(totalCount)
	
	// Count by status
	var statusCounts []struct {
		Status string
		Count  int64
	}
	
	hs.db.Model(&models.CollectorStatus{}).
		Select("status, count(*) as count").
		Group("status").
		Scan(&statusCounts)
	
	for _, sc := range statusCounts {
		switch sc.Status {
		case "running", "online":
			summary.OnlineCollectors += int(sc.Count)
		case "offline":
			summary.OfflineCollectors += int(sc.Count)
		case "warning":
			summary.WarningCollectors += int(sc.Count)
		case "error":
			summary.CriticalCollectors += int(sc.Count)
		}
	}
	
	// Calculate overall health percentage
	if summary.TotalCollectors > 0 {
		summary.OverallHealth = (float64(summary.OnlineCollectors) / float64(summary.TotalCollectors)) * 100
	}
	
	summary.LastUpdated = time.Now()
	
	return &summary, nil
}

// GetMetricsHistory returns metrics history for a collector
func (hs *HeartbeatService) GetMetricsHistory(collectorID uuid.UUID, since time.Time, limit int) ([]models.CollectorMetricsHistory, error) {
	var history []models.CollectorMetricsHistory
	
	query := hs.db.Where("collector_id = ? AND timestamp >= ?", collectorID, since).
		Order("timestamp DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Find(&history).Error
	return history, err
}

// GetRecentHeartbeats returns recent heartbeats for a collector
func (hs *HeartbeatService) GetRecentHeartbeats(collectorID uuid.UUID, limit int) ([]models.CollectorHeartbeat, error) {
	var heartbeats []models.CollectorHeartbeat
	
	err := hs.db.Where("collector_id = ?", collectorID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&heartbeats).Error
	
	return heartbeats, err
}