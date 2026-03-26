package heartbeat

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// PlatformClient interface for heartbeat communication
type PlatformClient interface {
	SendHeartbeat(collectorID string, status string, metrics map[string]interface{}) error
}

// HeartbeatManager manages collector heartbeat functionality
type HeartbeatManager struct {
	config         *config.CollectorConfig
	logger         *logger.Logger
	platformClient PlatformClient
	
	// Heartbeat state
	interval       time.Duration
	enabled        bool
	running        bool
	mutex          sync.RWMutex
	
	// Context and cancellation
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	
	// Metrics collection
	metricsCollector *MetricsCollector
	
	// Statistics
	stats          *HeartbeatStats
	statsMutex     sync.RWMutex
}

// HeartbeatStats tracks heartbeat statistics
type HeartbeatStats struct {
	TotalSent       int64     `json:"total_sent"`
	TotalFailed     int64     `json:"total_failed"`
	LastSent        time.Time `json:"last_sent"`
	LastSuccess     time.Time `json:"last_success"`
	LastError       error     `json:"last_error,omitempty"`
	ConsecutiveFails int      `json:"consecutive_fails"`
	AverageLatency  float64   `json:"average_latency_ms"`
}

// MetricsCollector collects system and application metrics
type MetricsCollector struct {
	logger         *logger.Logger
	startTime      time.Time
	lastCPUTime    time.Time
	lastCPUUsage   float64
}

// SystemMetrics represents collected system metrics
type SystemMetrics struct {
	CPUUsage        float64   `json:"cpu_usage"`
	MemoryUsage     int64     `json:"memory_usage"`
	DiskUsage       int64     `json:"disk_usage"`
	NetworkIn       int64     `json:"network_in"`
	NetworkOut      int64     `json:"network_out"`
	Uptime          int64     `json:"uptime"`
	GoRoutines      int       `json:"goroutines"`
	HeapSize        int64     `json:"heap_size"`
	HeapUsed        int64     `json:"heap_used"`
	GCPauses        int64     `json:"gc_pauses"`
	Timestamp       time.Time `json:"timestamp"`
}

// NewHeartbeatManager creates a new heartbeat manager
func NewHeartbeatManager(config *config.CollectorConfig, platformClient PlatformClient, logger *logger.Logger) *HeartbeatManager {
	interval := time.Duration(config.HeartbeatInterval) * time.Second
	if interval <= 0 {
		interval = 60 * time.Second // Default to 60 seconds
	}
	
	return &HeartbeatManager{
		config:         config,
		logger:         logger.WithGroup("heartbeat"),
		platformClient: platformClient,
		interval:       interval,
		enabled:        true,
		metricsCollector: &MetricsCollector{
			logger:    logger.WithGroup("metrics"),
			startTime: time.Now(),
		},
		stats: &HeartbeatStats{},
	}
}

// Start starts the heartbeat manager
func (hm *HeartbeatManager) Start(ctx context.Context) error {
	hm.mutex.Lock()
	defer hm.mutex.Unlock()
	
	if hm.running {
		return fmt.Errorf("heartbeat manager is already running")
	}
	
	hm.ctx, hm.cancel = context.WithCancel(ctx)
	hm.running = true
	
	// Start heartbeat goroutine
	hm.wg.Add(1)
	go hm.heartbeatLoop()
	
	hm.logger.Info("Heartbeat manager started", "interval", hm.interval)
	return nil
}

// Stop stops the heartbeat manager
func (hm *HeartbeatManager) Stop() {
	hm.mutex.Lock()
	defer hm.mutex.Unlock()
	
	if !hm.running {
		return
	}
	
	hm.running = false
	hm.cancel()
	hm.wg.Wait()
	
	hm.logger.Info("Heartbeat manager stopped")
}

// SetInterval updates the heartbeat interval
func (hm *HeartbeatManager) SetInterval(interval time.Duration) {
	hm.mutex.Lock()
	defer hm.mutex.Unlock()
	
	if interval <= 0 {
		interval = 60 * time.Second
	}
	
	hm.interval = interval
	hm.logger.Info("Heartbeat interval updated", "interval", interval)
}

// Enable enables heartbeat sending
func (hm *HeartbeatManager) Enable() {
	hm.mutex.Lock()
	defer hm.mutex.Unlock()
	
	hm.enabled = true
	hm.logger.Info("Heartbeat enabled")
}

// Disable disables heartbeat sending
func (hm *HeartbeatManager) Disable() {
	hm.mutex.Lock()
	defer hm.mutex.Unlock()
	
	hm.enabled = false
	hm.logger.Info("Heartbeat disabled")
}

// IsEnabled returns whether heartbeat is enabled
func (hm *HeartbeatManager) IsEnabled() bool {
	hm.mutex.RLock()
	defer hm.mutex.RUnlock()
	return hm.enabled
}

// IsRunning returns whether heartbeat manager is running
func (hm *HeartbeatManager) IsRunning() bool {
	hm.mutex.RLock()
	defer hm.mutex.RUnlock()
	return hm.running
}

// SendHeartbeat sends an immediate heartbeat
func (hm *HeartbeatManager) SendHeartbeat(status string, additionalMetrics map[string]interface{}) error {
	if !hm.IsEnabled() {
		return fmt.Errorf("heartbeat is disabled")
	}
	
	startTime := time.Now()
	
	// Collect system metrics
	systemMetrics := hm.metricsCollector.CollectMetrics()
	
	// Prepare metrics payload
	metrics := make(map[string]interface{})
	
	// Add system metrics
	metrics["cpu_usage"] = systemMetrics.CPUUsage
	metrics["memory_usage"] = systemMetrics.MemoryUsage
	metrics["disk_usage"] = systemMetrics.DiskUsage
	metrics["network_in"] = systemMetrics.NetworkIn
	metrics["network_out"] = systemMetrics.NetworkOut
	metrics["uptime"] = systemMetrics.Uptime
	metrics["goroutines"] = systemMetrics.GoRoutines
	metrics["heap_size"] = systemMetrics.HeapSize
	metrics["heap_used"] = systemMetrics.HeapUsed
	metrics["gc_pauses"] = systemMetrics.GCPauses
	
	// Add additional metrics
	for key, value := range additionalMetrics {
		metrics[key] = value
	}
	
	// Add heartbeat statistics
	hm.statsMutex.RLock()
	metrics["heartbeat_stats"] = map[string]interface{}{
		"total_sent":        hm.stats.TotalSent,
		"total_failed":      hm.stats.TotalFailed,
		"consecutive_fails": hm.stats.ConsecutiveFails,
		"average_latency":   hm.stats.AverageLatency,
	}
	hm.statsMutex.RUnlock()
	
	// Send heartbeat
	err := hm.platformClient.SendHeartbeat(hm.config.CollectorID, status, metrics)
	
	// Update statistics
	latency := time.Since(startTime).Milliseconds()
	hm.updateStats(err, float64(latency))
	
	if err != nil {
		hm.logger.Error("Failed to send heartbeat", "error", err, "latency_ms", latency)
		return err
	}
	
	hm.logger.Debug("Heartbeat sent successfully", "status", status, "latency_ms", latency)
	return nil
}

// heartbeatLoop runs the main heartbeat loop
func (hm *HeartbeatManager) heartbeatLoop() {
	defer hm.wg.Done()
	
	ticker := time.NewTicker(hm.interval)
	defer ticker.Stop()
	
	// Send initial heartbeat
	if err := hm.SendHeartbeat("starting", nil); err != nil {
		hm.logger.Error("Failed to send initial heartbeat", "error", err)
	}
	
	for {
		select {
		case <-hm.ctx.Done():
			// Send final heartbeat before stopping
			hm.SendHeartbeat("stopping", nil)
			return
			
		case <-ticker.C:
			// Check if interval has changed
			hm.mutex.RLock()
			currentInterval := hm.interval
			enabled := hm.enabled
			hm.mutex.RUnlock()
			
			// Update ticker if interval changed
			if ticker.C != nil && currentInterval != hm.interval {
				ticker.Stop()
				ticker = time.NewTicker(currentInterval)
			}
			
			// Send heartbeat if enabled
			if enabled {
				if err := hm.SendHeartbeat("running", nil); err != nil {
					hm.logger.Error("Failed to send periodic heartbeat", "error", err)
				}
			}
		}
	}
}

// updateStats updates heartbeat statistics
func (hm *HeartbeatManager) updateStats(err error, latencyMs float64) {
	hm.statsMutex.Lock()
	defer hm.statsMutex.Unlock()
	
	hm.stats.TotalSent++
	hm.stats.LastSent = time.Now()
	
	if err != nil {
		hm.stats.TotalFailed++
		hm.stats.LastError = err
		hm.stats.ConsecutiveFails++
	} else {
		hm.stats.LastSuccess = time.Now()
		hm.stats.ConsecutiveFails = 0
		hm.stats.LastError = nil
		
		// Update average latency (simple moving average)
		if hm.stats.AverageLatency == 0 {
			hm.stats.AverageLatency = latencyMs
		} else {
			hm.stats.AverageLatency = (hm.stats.AverageLatency*0.9 + latencyMs*0.1)
		}
	}
}

// GetStats returns current heartbeat statistics
func (hm *HeartbeatManager) GetStats() *HeartbeatStats {
	hm.statsMutex.RLock()
	defer hm.statsMutex.RUnlock()
	
	// Return a copy to avoid race conditions
	statsCopy := *hm.stats
	return &statsCopy
}

// GetMetrics returns current system metrics
func (hm *HeartbeatManager) GetMetrics() *SystemMetrics {
	return hm.metricsCollector.CollectMetrics()
}

// CollectMetrics collects current system metrics
func (mc *MetricsCollector) CollectMetrics() *SystemMetrics {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	metrics := &SystemMetrics{
		MemoryUsage: int64(memStats.Sys),
		Uptime:      int64(time.Since(mc.startTime).Seconds()),
		GoRoutines:  runtime.NumGoroutine(),
		HeapSize:    int64(memStats.HeapSys),
		HeapUsed:    int64(memStats.HeapInuse),
		GCPauses:    int64(memStats.PauseTotalNs / 1000000), // Convert to milliseconds
		Timestamp:   time.Now(),
	}
	
	// CPU usage calculation (simplified)
	now := time.Now()
	if !mc.lastCPUTime.IsZero() {
		// This is a simplified CPU calculation
		// In a real implementation, you would use system-specific APIs
		timeDiff := now.Sub(mc.lastCPUTime).Seconds()
		if timeDiff > 0 {
			// Simulate CPU usage based on goroutines and memory pressure
			cpuFactor := float64(runtime.NumGoroutine()) / 100.0
			memFactor := float64(memStats.HeapInuse) / float64(memStats.HeapSys)
			metrics.CPUUsage = (cpuFactor + memFactor) * 50.0 // Simplified calculation
			if metrics.CPUUsage > 100.0 {
				metrics.CPUUsage = 100.0
			}
		}
	}
	mc.lastCPUTime = now
	mc.lastCPUUsage = metrics.CPUUsage
	
	// Disk usage (placeholder - would need OS-specific implementation)
	metrics.DiskUsage = int64(memStats.Sys) // Placeholder
	
	// Network usage (placeholder - would need OS-specific implementation)
	metrics.NetworkIn = 0  // Placeholder
	metrics.NetworkOut = 0 // Placeholder
	
	return metrics
}

// GetHealthStatus returns the health status of the heartbeat manager
func (hm *HeartbeatManager) GetHealthStatus() map[string]interface{} {
	hm.statsMutex.RLock()
	defer hm.statsMutex.RUnlock()
	
	status := "healthy"
	if hm.stats.ConsecutiveFails > 3 {
		status = "unhealthy"
	} else if hm.stats.ConsecutiveFails > 0 {
		status = "warning"
	}
	
	return map[string]interface{}{
		"status":            status,
		"enabled":           hm.IsEnabled(),
		"running":           hm.IsRunning(),
		"interval":          hm.interval.String(),
		"total_sent":        hm.stats.TotalSent,
		"total_failed":      hm.stats.TotalFailed,
		"consecutive_fails": hm.stats.ConsecutiveFails,
		"last_sent":         hm.stats.LastSent,
		"last_success":      hm.stats.LastSuccess,
		"average_latency":   hm.stats.AverageLatency,
		"last_error":        hm.stats.LastError,
	}
}