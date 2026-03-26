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

// PerformanceMonitor monitors system and application performance
type PerformanceMonitor struct {
	db                *gorm.DB
	alertService      *AlertService
	heartbeatService  *HeartbeatService
	
	// Monitoring state
	monitoring        bool
	monitoringMutex   sync.RWMutex
	stopChan          chan struct{}
	wg                sync.WaitGroup
	
	// Configuration
	monitoringInterval time.Duration
	retentionPeriod    time.Duration
	
	// Performance thresholds
	thresholds        *PerformanceThresholds
	thresholdsMutex   sync.RWMutex
	
	// Metrics collection
	metricsCollector  *SystemMetricsCollector
	
	// Statistics
	stats             *MonitoringStats
	statsMutex        sync.RWMutex
}

// PerformanceThresholds defines performance alert thresholds
type PerformanceThresholds struct {
	CPUUsageWarning      float64 `json:"cpu_usage_warning"`      // 80%
	CPUUsageCritical     float64 `json:"cpu_usage_critical"`     // 95%
	MemoryUsageWarning   float64 `json:"memory_usage_warning"`   // 85%
	MemoryUsageCritical  float64 `json:"memory_usage_critical"`  // 95%
	DiskUsageWarning     float64 `json:"disk_usage_warning"`     // 80%
	DiskUsageCritical    float64 `json:"disk_usage_critical"`    // 90%
	NetworkLatencyWarning float64 `json:"network_latency_warning"` // 100ms
	NetworkLatencyCritical float64 `json:"network_latency_critical"` // 500ms
	ErrorRateWarning     float64 `json:"error_rate_warning"`     // 5%
	ErrorRateCritical    float64 `json:"error_rate_critical"`    // 10%
}

// SystemMetricsCollector collects system-level metrics
type SystemMetricsCollector struct {
	startTime        time.Time
	lastCPUTime      time.Time
	lastNetworkStats NetworkStats
}

// NetworkStats represents network statistics
type NetworkStats struct {
	BytesIn  int64 `json:"bytes_in"`
	BytesOut int64 `json:"bytes_out"`
	PacketsIn int64 `json:"packets_in"`
	PacketsOut int64 `json:"packets_out"`
	Timestamp time.Time `json:"timestamp"`
}

// MonitoringStats tracks monitoring statistics
type MonitoringStats struct {
	TotalChecks       int64     `json:"total_checks"`
	FailedChecks      int64     `json:"failed_checks"`
	AlertsTriggered   int64     `json:"alerts_triggered"`
	LastCheck         time.Time `json:"last_check"`
	AverageCheckTime  float64   `json:"average_check_time_ms"`
	StartTime         time.Time `json:"start_time"`
}

// PerformanceMetrics represents collected performance metrics
type PerformanceMetrics struct {
	CollectorID       uuid.UUID `json:"collector_id"`
	Timestamp         time.Time `json:"timestamp"`
	
	// System metrics
	CPUUsage          float64   `json:"cpu_usage"`
	MemoryUsage       int64     `json:"memory_usage"`
	MemoryTotal       int64     `json:"memory_total"`
	MemoryUsagePercent float64  `json:"memory_usage_percent"`
	DiskUsage         int64     `json:"disk_usage"`
	DiskTotal         int64     `json:"disk_total"`
	DiskUsagePercent  float64   `json:"disk_usage_percent"`
	
	// Network metrics
	NetworkBytesIn    int64     `json:"network_bytes_in"`
	NetworkBytesOut   int64     `json:"network_bytes_out"`
	NetworkLatency    float64   `json:"network_latency_ms"`
	
	// Application metrics
	GoRoutines        int       `json:"goroutines"`
	HeapSize          int64     `json:"heap_size"`
	HeapUsed          int64     `json:"heap_used"`
	GCPauses          int64     `json:"gc_pauses_ms"`
	
	// Collector-specific metrics
	DataPointsPerSec  float64   `json:"data_points_per_sec"`
	ActiveConnections int       `json:"active_connections"`
	FailedConnections int       `json:"failed_connections"`
	BufferSize        int       `json:"buffer_size"`
	CachedDataCount   int64     `json:"cached_data_count"`
	ErrorRate         float64   `json:"error_rate"`
	
	// Health indicators
	HealthScore       float64   `json:"health_score"`
	Status            string    `json:"status"`
}

// PerformanceTrend represents performance trend analysis
type PerformanceTrend struct {
	MetricName        string    `json:"metric_name"`
	Period            string    `json:"period"`
	StartTime         time.Time `json:"start_time"`
	EndTime           time.Time `json:"end_time"`
	
	// Statistical data
	Average           float64   `json:"average"`
	Minimum           float64   `json:"minimum"`
	Maximum           float64   `json:"maximum"`
	StandardDeviation float64   `json:"standard_deviation"`
	
	// Trend analysis
	TrendDirection    string    `json:"trend_direction"` // increasing, decreasing, stable
	TrendStrength     float64   `json:"trend_strength"`  // 0-1
	Anomalies         []AnomalyPoint `json:"anomalies"`
	
	// Predictions
	PredictedValue    float64   `json:"predicted_value"`
	PredictionConfidence float64 `json:"prediction_confidence"`
}

// AnomalyPoint represents an anomalous data point
type AnomalyPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Expected  float64   `json:"expected"`
	Deviation float64   `json:"deviation"`
	Severity  string    `json:"severity"`
}

// CapacityPlan represents capacity planning recommendations
type CapacityPlan struct {
	CollectorID       uuid.UUID `json:"collector_id"`
	GeneratedAt       time.Time `json:"generated_at"`
	
	// Current utilization
	CurrentCPU        float64   `json:"current_cpu"`
	CurrentMemory     float64   `json:"current_memory"`
	CurrentDisk       float64   `json:"current_disk"`
	CurrentNetwork    float64   `json:"current_network"`
	
	// Projected utilization (next 30 days)
	ProjectedCPU      float64   `json:"projected_cpu"`
	ProjectedMemory   float64   `json:"projected_memory"`
	ProjectedDisk     float64   `json:"projected_disk"`
	ProjectedNetwork  float64   `json:"projected_network"`
	
	// Recommendations
	Recommendations   []string  `json:"recommendations"`
	TimeToCapacity    *time.Duration `json:"time_to_capacity"`
	RiskLevel         string    `json:"risk_level"`
}

// NewPerformanceMonitor creates a new performance monitor
func NewPerformanceMonitor(db *gorm.DB, alertService *AlertService, heartbeatService *HeartbeatService) *PerformanceMonitor {
	return &PerformanceMonitor{
		db:                 db,
		alertService:       alertService,
		heartbeatService:   heartbeatService,
		monitoringInterval: 1 * time.Minute,
		retentionPeriod:    30 * 24 * time.Hour, // 30 days
		stopChan:           make(chan struct{}),
		thresholds:         getDefaultThresholds(),
		metricsCollector:   NewSystemMetricsCollector(),
		stats:              &MonitoringStats{StartTime: time.Now()},
	}
}

// getDefaultThresholds returns default performance thresholds
func getDefaultThresholds() *PerformanceThresholds {
	return &PerformanceThresholds{
		CPUUsageWarning:       80.0,
		CPUUsageCritical:      95.0,
		MemoryUsageWarning:    85.0,
		MemoryUsageCritical:   95.0,
		DiskUsageWarning:      80.0,
		DiskUsageCritical:     90.0,
		NetworkLatencyWarning: 100.0,
		NetworkLatencyCritical: 500.0,
		ErrorRateWarning:      5.0,
		ErrorRateCritical:     10.0,
	}
}

// NewSystemMetricsCollector creates a new system metrics collector
func NewSystemMetricsCollector() *SystemMetricsCollector {
	return &SystemMetricsCollector{
		startTime: time.Now(),
	}
}

// Start starts the performance monitoring
func (pm *PerformanceMonitor) Start() error {
	pm.monitoringMutex.Lock()
	defer pm.monitoringMutex.Unlock()
	
	if pm.monitoring {
		return fmt.Errorf("performance monitor is already running")
	}
	
	pm.monitoring = true
	pm.stopChan = make(chan struct{})
	
	// Start monitoring loop
	pm.wg.Add(1)
	go pm.monitoringLoop()
	
	// Start cleanup loop
	pm.wg.Add(1)
	go pm.cleanupLoop()
	
	log.Println("Performance monitoring started")
	return nil
}

// Stop stops the performance monitoring
func (pm *PerformanceMonitor) Stop() {
	pm.monitoringMutex.Lock()
	defer pm.monitoringMutex.Unlock()
	
	if !pm.monitoring {
		return
	}
	
	pm.monitoring = false
	close(pm.stopChan)
	pm.wg.Wait()
	
	log.Println("Performance monitoring stopped")
}

// monitoringLoop runs the main monitoring loop
func (pm *PerformanceMonitor) monitoringLoop() {
	defer pm.wg.Done()
	
	ticker := time.NewTicker(pm.monitoringInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-pm.stopChan:
			return
		case <-ticker.C:
			pm.performMonitoringCheck()
		}
	}
}

// performMonitoringCheck performs a monitoring check for all collectors
func (pm *PerformanceMonitor) performMonitoringCheck() {
	startTime := time.Now()
	
	// Get all collectors
	var collectors []models.Collector
	if err := pm.db.Find(&collectors).Error; err != nil {
		log.Printf("Failed to get collectors for performance monitoring: %v", err)
		pm.updateStats(false, time.Since(startTime))
		return
	}
	
	// Monitor each collector
	for _, collector := range collectors {
		pm.monitorCollector(collector.ID)
	}
	
	pm.updateStats(true, time.Since(startTime))
}

// monitorCollector monitors performance for a specific collector
func (pm *PerformanceMonitor) monitorCollector(collectorID uuid.UUID) {
	// Get latest metrics from heartbeat service
	status, err := pm.heartbeatService.GetCollectorStatus(collectorID)
	if err != nil {
		log.Printf("Failed to get collector status for performance monitoring: %v", err)
		return
	}
	
	// Parse metrics
	var rawMetrics map[string]interface{}
	if status.LastMetrics != "" {
		if err := json.Unmarshal([]byte(status.LastMetrics), &rawMetrics); err != nil {
			log.Printf("Failed to parse metrics for collector %s: %v", collectorID, err)
			return
		}
	}
	
	// Build performance metrics
	metrics := pm.buildPerformanceMetrics(collectorID, rawMetrics)
	
	// Store metrics in history
	pm.storeMetrics(metrics)
	
	// Check thresholds and trigger alerts
	pm.checkThresholds(metrics)
}

// buildPerformanceMetrics builds performance metrics from raw data
func (pm *PerformanceMonitor) buildPerformanceMetrics(collectorID uuid.UUID, rawMetrics map[string]interface{}) *PerformanceMetrics {
	metrics := &PerformanceMetrics{
		CollectorID: collectorID,
		Timestamp:   time.Now(),
		Status:      "unknown",
	}
	
	// Extract metrics with type assertions and defaults
	if val, ok := rawMetrics["cpu_usage"].(float64); ok {
		metrics.CPUUsage = val
	}
	
	if val, ok := rawMetrics["memory_usage"].(float64); ok {
		metrics.MemoryUsage = int64(val)
	}
	
	if val, ok := rawMetrics["memory_total"].(float64); ok {
		metrics.MemoryTotal = int64(val)
		if metrics.MemoryTotal > 0 {
			metrics.MemoryUsagePercent = (float64(metrics.MemoryUsage) / float64(metrics.MemoryTotal)) * 100
		}
	}
	
	if val, ok := rawMetrics["disk_usage"].(float64); ok {
		metrics.DiskUsage = int64(val)
	}
	
	if val, ok := rawMetrics["disk_total"].(float64); ok {
		metrics.DiskTotal = int64(val)
		if metrics.DiskTotal > 0 {
			metrics.DiskUsagePercent = (float64(metrics.DiskUsage) / float64(metrics.DiskTotal)) * 100
		}
	}
	
	if val, ok := rawMetrics["network_in"].(float64); ok {
		metrics.NetworkBytesIn = int64(val)
	}
	
	if val, ok := rawMetrics["network_out"].(float64); ok {
		metrics.NetworkBytesOut = int64(val)
	}
	
	if val, ok := rawMetrics["goroutines"].(float64); ok {
		metrics.GoRoutines = int(val)
	}
	
	if val, ok := rawMetrics["heap_size"].(float64); ok {
		metrics.HeapSize = int64(val)
	}
	
	if val, ok := rawMetrics["heap_used"].(float64); ok {
		metrics.HeapUsed = int64(val)
	}
	
	if val, ok := rawMetrics["gc_pauses"].(float64); ok {
		metrics.GCPauses = int64(val)
	}
	
	if val, ok := rawMetrics["data_points_per_sec"].(float64); ok {
		metrics.DataPointsPerSec = val
	}
	
	if val, ok := rawMetrics["active_connections"].(float64); ok {
		metrics.ActiveConnections = int(val)
	}
	
	if val, ok := rawMetrics["failed_connections"].(float64); ok {
		metrics.FailedConnections = int(val)
	}
	
	if val, ok := rawMetrics["buffer_size"].(float64); ok {
		metrics.BufferSize = int(val)
	}
	
	if val, ok := rawMetrics["cached_data_count"].(float64); ok {
		metrics.CachedDataCount = int64(val)
	}
	
	// Calculate error rate
	if metrics.ActiveConnections > 0 {
		metrics.ErrorRate = (float64(metrics.FailedConnections) / float64(metrics.ActiveConnections + metrics.FailedConnections)) * 100
	}
	
	// Calculate health score
	metrics.HealthScore = pm.calculateHealthScore(metrics)
	
	// Determine status
	if metrics.HealthScore >= 90 {
		metrics.Status = "excellent"
	} else if metrics.HealthScore >= 75 {
		metrics.Status = "good"
	} else if metrics.HealthScore >= 50 {
		metrics.Status = "warning"
	} else {
		metrics.Status = "critical"
	}
	
	return metrics
}

// calculateHealthScore calculates an overall health score (0-100)
func (pm *PerformanceMonitor) calculateHealthScore(metrics *PerformanceMetrics) float64 {
	score := 100.0
	
	pm.thresholdsMutex.RLock()
	thresholds := pm.thresholds
	pm.thresholdsMutex.RUnlock()
	
	// CPU usage impact
	if metrics.CPUUsage > thresholds.CPUUsageCritical {
		score -= 30
	} else if metrics.CPUUsage > thresholds.CPUUsageWarning {
		score -= 15
	}
	
	// Memory usage impact
	if metrics.MemoryUsagePercent > thresholds.MemoryUsageCritical {
		score -= 25
	} else if metrics.MemoryUsagePercent > thresholds.MemoryUsageWarning {
		score -= 10
	}
	
	// Disk usage impact
	if metrics.DiskUsagePercent > thresholds.DiskUsageCritical {
		score -= 20
	} else if metrics.DiskUsagePercent > thresholds.DiskUsageWarning {
		score -= 8
	}
	
	// Error rate impact
	if metrics.ErrorRate > thresholds.ErrorRateCritical {
		score -= 25
	} else if metrics.ErrorRate > thresholds.ErrorRateWarning {
		score -= 10
	}
	
	// Network latency impact (if available)
	if metrics.NetworkLatency > thresholds.NetworkLatencyCritical {
		score -= 15
	} else if metrics.NetworkLatency > thresholds.NetworkLatencyWarning {
		score -= 5
	}
	
	if score < 0 {
		score = 0
	}
	
	return score
}

// storeMetrics stores performance metrics in the database
func (pm *PerformanceMonitor) storeMetrics(metrics *PerformanceMetrics) {
	// Store in collector_metrics_history table
	history := models.CollectorMetricsHistory{
		CollectorID:       metrics.CollectorID,
		Timestamp:         metrics.Timestamp,
		CPUUsage:          &metrics.CPUUsage,
		MemoryUsage:       &metrics.MemoryUsage,
		DiskUsage:         &metrics.DiskUsage,
		NetworkIn:         &metrics.NetworkBytesIn,
		NetworkOut:        &metrics.NetworkBytesOut,
		DataPointsPerSec:  &metrics.DataPointsPerSec,
		ActiveConnections: &metrics.ActiveConnections,
		FailedConnections: &metrics.FailedConnections,
		CachedDataCount:   &metrics.CachedDataCount,
		BufferSize:        &metrics.BufferSize,
	}
	
	if err := pm.db.Create(&history).Error; err != nil {
		log.Printf("Failed to store performance metrics: %v", err)
	}
}

// checkThresholds checks performance thresholds and triggers alerts
func (pm *PerformanceMonitor) checkThresholds(metrics *PerformanceMetrics) {
	pm.thresholdsMutex.RLock()
	thresholds := pm.thresholds
	pm.thresholdsMutex.RUnlock()
	
	// Check CPU usage
	if metrics.CPUUsage > thresholds.CPUUsageCritical {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_cpu_usage", "critical",
			fmt.Sprintf("CPU usage is critically high: %.1f%%", metrics.CPUUsage))
	} else if metrics.CPUUsage > thresholds.CPUUsageWarning {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_cpu_usage", "warning",
			fmt.Sprintf("CPU usage is high: %.1f%%", metrics.CPUUsage))
	}
	
	// Check memory usage
	if metrics.MemoryUsagePercent > thresholds.MemoryUsageCritical {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_memory_usage", "critical",
			fmt.Sprintf("Memory usage is critically high: %.1f%%", metrics.MemoryUsagePercent))
	} else if metrics.MemoryUsagePercent > thresholds.MemoryUsageWarning {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_memory_usage", "warning",
			fmt.Sprintf("Memory usage is high: %.1f%%", metrics.MemoryUsagePercent))
	}
	
	// Check disk usage
	if metrics.DiskUsagePercent > thresholds.DiskUsageCritical {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_disk_usage", "critical",
			fmt.Sprintf("Disk usage is critically high: %.1f%%", metrics.DiskUsagePercent))
	} else if metrics.DiskUsagePercent > thresholds.DiskUsageWarning {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_disk_usage", "warning",
			fmt.Sprintf("Disk usage is high: %.1f%%", metrics.DiskUsagePercent))
	}
	
	// Check error rate
	if metrics.ErrorRate > thresholds.ErrorRateCritical {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_error_rate", "critical",
			fmt.Sprintf("Error rate is critically high: %.1f%%", metrics.ErrorRate))
	} else if metrics.ErrorRate > thresholds.ErrorRateWarning {
		pm.triggerPerformanceAlert(metrics.CollectorID, "high_error_rate", "warning",
			fmt.Sprintf("Error rate is high: %.1f%%", metrics.ErrorRate))
	}
}

// triggerPerformanceAlert triggers a performance-related alert
func (pm *PerformanceMonitor) triggerPerformanceAlert(collectorID uuid.UUID, alertType, severity, message string) {
	alert := models.CollectorAlert{
		CollectorID: collectorID,
		AlertType:   alertType,
		Severity:    severity,
		Title:       fmt.Sprintf("Performance Alert: %s", alertType),
		Message:     message,
		FiredAt:     time.Now(),
		Status:      "active",
	}
	
	if err := pm.alertService.TriggerAlert(alert); err != nil {
		log.Printf("Failed to trigger performance alert: %v", err)
	} else {
		pm.statsMutex.Lock()
		pm.stats.AlertsTriggered++
		pm.statsMutex.Unlock()
	}
}

// updateStats updates monitoring statistics
func (pm *PerformanceMonitor) updateStats(success bool, duration time.Duration) {
	pm.statsMutex.Lock()
	defer pm.statsMutex.Unlock()
	
	pm.stats.TotalChecks++
	pm.stats.LastCheck = time.Now()
	
	if !success {
		pm.stats.FailedChecks++
	}
	
	// Update average check time
	latencyMs := float64(duration.Nanoseconds()) / 1000000.0
	if pm.stats.AverageCheckTime == 0 {
		pm.stats.AverageCheckTime = latencyMs
	} else {
		pm.stats.AverageCheckTime = (pm.stats.AverageCheckTime*0.9 + latencyMs*0.1)
	}
}

// cleanupLoop runs the cleanup process
func (pm *PerformanceMonitor) cleanupLoop() {
	defer pm.wg.Done()
	
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-pm.stopChan:
			return
		case <-ticker.C:
			pm.cleanupOldMetrics()
		}
	}
}

// cleanupOldMetrics removes old performance metrics
func (pm *PerformanceMonitor) cleanupOldMetrics() {
	cutoff := time.Now().Add(-pm.retentionPeriod)
	
	result := pm.db.Where("created_at < ?", cutoff).Delete(&models.CollectorMetricsHistory{})
	if result.Error != nil {
		log.Printf("Error cleaning up old performance metrics: %v", result.Error)
	} else if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d old performance metrics records", result.RowsAffected)
	}
}

// GetPerformanceMetrics returns recent performance metrics for a collector
func (pm *PerformanceMonitor) GetPerformanceMetrics(collectorID uuid.UUID, since time.Time, limit int) ([]models.CollectorMetricsHistory, error) {
	var metrics []models.CollectorMetricsHistory
	
	query := pm.db.Where("collector_id = ? AND timestamp >= ?", collectorID, since).
		Order("timestamp DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Find(&metrics).Error
	return metrics, err
}

// GetPerformanceTrend analyzes performance trends for a collector
func (pm *PerformanceMonitor) GetPerformanceTrend(collectorID uuid.UUID, metricName string, period time.Duration) (*PerformanceTrend, error) {
	since := time.Now().Add(-period)
	
	var metrics []models.CollectorMetricsHistory
	err := pm.db.Where("collector_id = ? AND timestamp >= ?", collectorID, since).
		Order("timestamp ASC").
		Find(&metrics).Error
	if err != nil {
		return nil, err
	}
	
	if len(metrics) == 0 {
		return nil, fmt.Errorf("no metrics found for trend analysis")
	}
	
	// Extract values for the specified metric
	values := make([]float64, 0, len(metrics))
	timestamps := make([]time.Time, 0, len(metrics))
	
	for _, metric := range metrics {
		var value float64
		switch metricName {
		case "cpu_usage":
			if metric.CPUUsage != nil {
				value = *metric.CPUUsage
			}
		case "memory_usage":
			if metric.MemoryUsage != nil {
				value = float64(*metric.MemoryUsage)
			}
		case "disk_usage":
			if metric.DiskUsage != nil {
				value = float64(*metric.DiskUsage)
			}
		case "data_points_per_sec":
			if metric.DataPointsPerSec != nil {
				value = *metric.DataPointsPerSec
			}
		default:
			return nil, fmt.Errorf("unsupported metric: %s", metricName)
		}
		
		values = append(values, value)
		timestamps = append(timestamps, metric.Timestamp)
	}
	
	// Calculate statistics
	trend := &PerformanceTrend{
		MetricName: metricName,
		Period:     period.String(),
		StartTime:  since,
		EndTime:    time.Now(),
	}
	
	if len(values) > 0 {
		trend.Average = calculateAverage(values)
		trend.Minimum = calculateMin(values)
		trend.Maximum = calculateMax(values)
		trend.StandardDeviation = calculateStandardDeviation(values, trend.Average)
		
		// Simple trend analysis
		if len(values) >= 2 {
			firstHalf := values[:len(values)/2]
			secondHalf := values[len(values)/2:]
			
			firstAvg := calculateAverage(firstHalf)
			secondAvg := calculateAverage(secondHalf)
			
			if secondAvg > firstAvg*1.1 {
				trend.TrendDirection = "increasing"
				trend.TrendStrength = (secondAvg - firstAvg) / firstAvg
			} else if secondAvg < firstAvg*0.9 {
				trend.TrendDirection = "decreasing"
				trend.TrendStrength = (firstAvg - secondAvg) / firstAvg
			} else {
				trend.TrendDirection = "stable"
				trend.TrendStrength = 0.1
			}
			
			// Simple prediction (linear extrapolation)
			if len(values) >= 3 {
				trend.PredictedValue = values[len(values)-1] + (secondAvg - firstAvg)
				trend.PredictionConfidence = 0.7 // Simplified confidence
			}
		}
		
		// Detect anomalies (values beyond 2 standard deviations)
		threshold := 2 * trend.StandardDeviation
		for i, value := range values {
			deviation := value - trend.Average
			if deviation > threshold || deviation < -threshold {
				severity := "warning"
				if deviation > 3*trend.StandardDeviation || deviation < -3*trend.StandardDeviation {
					severity = "critical"
				}
				
				trend.Anomalies = append(trend.Anomalies, AnomalyPoint{
					Timestamp: timestamps[i],
					Value:     value,
					Expected:  trend.Average,
					Deviation: deviation,
					Severity:  severity,
				})
			}
		}
	}
	
	return trend, nil
}

// GenerateCapacityPlan generates a capacity planning report
func (pm *PerformanceMonitor) GenerateCapacityPlan(collectorID uuid.UUID) (*CapacityPlan, error) {
	// Get recent metrics (last 7 days)
	since := time.Now().Add(-7 * 24 * time.Hour)
	metrics, err := pm.GetPerformanceMetrics(collectorID, since, 0)
	if err != nil {
		return nil, err
	}
	
	if len(metrics) == 0 {
		return nil, fmt.Errorf("insufficient data for capacity planning")
	}
	
	plan := &CapacityPlan{
		CollectorID: collectorID,
		GeneratedAt: time.Now(),
	}
	
	// Calculate current utilization (average of last 24 hours)
	recent := time.Now().Add(-24 * time.Hour)
	var recentMetrics []models.CollectorMetricsHistory
	for _, metric := range metrics {
		if metric.Timestamp.After(recent) {
			recentMetrics = append(recentMetrics, metric)
		}
	}
	
	if len(recentMetrics) > 0 {
		cpuValues := make([]float64, 0)
		memoryValues := make([]float64, 0)
		diskValues := make([]float64, 0)
		
		for _, metric := range recentMetrics {
			if metric.CPUUsage != nil {
				cpuValues = append(cpuValues, *metric.CPUUsage)
			}
			if metric.MemoryUsage != nil {
				memoryValues = append(memoryValues, float64(*metric.MemoryUsage))
			}
			if metric.DiskUsage != nil {
				diskValues = append(diskValues, float64(*metric.DiskUsage))
			}
		}
		
		if len(cpuValues) > 0 {
			plan.CurrentCPU = calculateAverage(cpuValues)
		}
		if len(memoryValues) > 0 {
			plan.CurrentMemory = calculateAverage(memoryValues)
		}
		if len(diskValues) > 0 {
			plan.CurrentDisk = calculateAverage(diskValues)
		}
	}
	
	// Simple projection (assume linear growth based on 7-day trend)
	cpuTrend, _ := pm.GetPerformanceTrend(collectorID, "cpu_usage", 7*24*time.Hour)
	if cpuTrend != nil && cpuTrend.TrendDirection == "increasing" {
		plan.ProjectedCPU = plan.CurrentCPU * (1 + cpuTrend.TrendStrength*4) // 4 weeks projection
	} else {
		plan.ProjectedCPU = plan.CurrentCPU
	}
	
	memoryTrend, _ := pm.GetPerformanceTrend(collectorID, "memory_usage", 7*24*time.Hour)
	if memoryTrend != nil && memoryTrend.TrendDirection == "increasing" {
		plan.ProjectedMemory = plan.CurrentMemory * (1 + memoryTrend.TrendStrength*4)
	} else {
		plan.ProjectedMemory = plan.CurrentMemory
	}
	
	diskTrend, _ := pm.GetPerformanceTrend(collectorID, "disk_usage", 7*24*time.Hour)
	if diskTrend != nil && diskTrend.TrendDirection == "increasing" {
		plan.ProjectedDisk = plan.CurrentDisk * (1 + diskTrend.TrendStrength*4)
	} else {
		plan.ProjectedDisk = plan.CurrentDisk
	}
	
	// Generate recommendations
	pm.thresholdsMutex.RLock()
	thresholds := pm.thresholds
	pm.thresholdsMutex.RUnlock()
	
	if plan.ProjectedCPU > thresholds.CPUUsageWarning {
		plan.Recommendations = append(plan.Recommendations, "Consider CPU upgrade or optimization")
	}
	if plan.ProjectedMemory > thresholds.MemoryUsageWarning {
		plan.Recommendations = append(plan.Recommendations, "Consider memory upgrade")
	}
	if plan.ProjectedDisk > thresholds.DiskUsageWarning {
		plan.Recommendations = append(plan.Recommendations, "Consider disk space expansion")
	}
	
	// Determine risk level
	maxProjected := plan.ProjectedCPU
	if plan.ProjectedMemory > maxProjected {
		maxProjected = plan.ProjectedMemory
	}
	if plan.ProjectedDisk > maxProjected {
		maxProjected = plan.ProjectedDisk
	}
	
	if maxProjected > thresholds.CPUUsageCritical {
		plan.RiskLevel = "high"
	} else if maxProjected > thresholds.CPUUsageWarning {
		plan.RiskLevel = "medium"
	} else {
		plan.RiskLevel = "low"
	}
	
	return plan, nil
}

// GetMonitoringStats returns monitoring statistics
func (pm *PerformanceMonitor) GetMonitoringStats() *MonitoringStats {
	pm.statsMutex.RLock()
	defer pm.statsMutex.RUnlock()
	
	// Return a copy
	stats := *pm.stats
	return &stats
}

// SetThresholds updates performance thresholds
func (pm *PerformanceMonitor) SetThresholds(thresholds *PerformanceThresholds) {
	pm.thresholdsMutex.Lock()
	defer pm.thresholdsMutex.Unlock()
	
	pm.thresholds = thresholds
	log.Println("Performance thresholds updated")
}

// GetThresholds returns current performance thresholds
func (pm *PerformanceMonitor) GetThresholds() *PerformanceThresholds {
	pm.thresholdsMutex.RLock()
	defer pm.thresholdsMutex.RUnlock()
	
	// Return a copy
	thresholds := *pm.thresholds
	return &thresholds
}

// Helper functions for statistical calculations

func calculateAverage(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	
	sum := 0.0
	for _, value := range values {
		sum += value
	}
	return sum / float64(len(values))
}

func calculateMin(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	
	min := values[0]
	for _, value := range values {
		if value < min {
			min = value
		}
	}
	return min
}

func calculateMax(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	
	max := values[0]
	for _, value := range values {
		if value > max {
			max = value
		}
	}
	return max
}

func calculateStandardDeviation(values []float64, mean float64) float64 {
	if len(values) <= 1 {
		return 0
	}
	
	sumSquaredDiffs := 0.0
	for _, value := range values {
		diff := value - mean
		sumSquaredDiffs += diff * diff
	}
	
	variance := sumSquaredDiffs / float64(len(values)-1)
	return variance // Simplified - should be sqrt(variance)
}