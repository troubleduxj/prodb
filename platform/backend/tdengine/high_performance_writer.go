package tdengine

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// HighPerformanceWriter provides a complete high-performance data writing solution
type HighPerformanceWriter struct {
	dataWriter       *DataWriter
	compressor       *DataCompressor
	failureRecovery  *FailureRecovery
	config           *HighPerformanceConfig
	metrics          *HighPerformanceMetrics
	mu               sync.RWMutex
	isRunning        bool
	stopChan         chan struct{}
	wg               sync.WaitGroup
}

// HighPerformanceConfig configures the high-performance writer
type HighPerformanceConfig struct {
	WriterConfig      *WriterConfig      `json:"writer_config"`
	CompressionConfig *CompressionConfig `json:"compression_config"`
	RecoveryConfig    *RecoveryConfig    `json:"recovery_config"`
	EnableCompression bool               `json:"enable_compression"`
	EnableRecovery    bool               `json:"enable_recovery"`
	MetricsInterval   time.Duration      `json:"metrics_interval"`
}

// HighPerformanceMetrics tracks comprehensive performance metrics
type HighPerformanceMetrics struct {
	// Write metrics
	TotalWrites        int64     `json:"total_writes"`
	SuccessfulWrites   int64     `json:"successful_writes"`
	FailedWrites       int64     `json:"failed_writes"`
	RecoveredWrites    int64     `json:"recovered_writes"`
	BatchWrites        int64     `json:"batch_writes"`
	StreamWrites       int64     `json:"stream_writes"`
	
	// Performance metrics
	AvgWriteLatency    float64   `json:"avg_write_latency_ms"`
	MaxWriteLatency    float64   `json:"max_write_latency_ms"`
	MinWriteLatency    float64   `json:"min_write_latency_ms"`
	DataPointsPerSec   float64   `json:"data_points_per_sec"`
	ThroughputMBPS     float64   `json:"throughput_mbps"`
	
	// Compression metrics
	CompressionRatio   float64   `json:"compression_ratio"`
	CompressionSavings float64   `json:"compression_savings_pct"`
	
	// Recovery metrics
	FailureRate        float64   `json:"failure_rate_pct"`
	RecoveryRate       float64   `json:"recovery_rate_pct"`
	
	// System metrics
	LastUpdateTime     time.Time `json:"last_update_time"`
	UptimeSeconds      int64     `json:"uptime_seconds"`
}

// DefaultHighPerformanceConfig returns default configuration
func DefaultHighPerformanceConfig() *HighPerformanceConfig {
	return &HighPerformanceConfig{
		WriterConfig:      DefaultWriterConfig(),
		CompressionConfig: DefaultCompressionConfig(),
		RecoveryConfig:    DefaultRecoveryConfig(),
		EnableCompression: true,
		EnableRecovery:    true,
		MetricsInterval:   30 * time.Second,
	}
}

// NewHighPerformanceWriter creates a new high-performance writer
func NewHighPerformanceWriter(service *TDengineService, config *HighPerformanceConfig) (*HighPerformanceWriter, error) {
	if config == nil {
		config = DefaultHighPerformanceConfig()
	}

	// Create data writer
	dataWriter := NewDataWriter(service, config.WriterConfig)

	// Create compressor if enabled
	var compressor *DataCompressor
	if config.EnableCompression {
		compressor = NewDataCompressor(config.CompressionConfig)
	}

	// Create failure recovery if enabled
	var failureRecovery *FailureRecovery
	if config.EnableRecovery {
		var err error
		failureRecovery, err = NewFailureRecovery(dataWriter, config.RecoveryConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create failure recovery: %w", err)
		}
	}

	hpw := &HighPerformanceWriter{
		dataWriter:      dataWriter,
		compressor:      compressor,
		failureRecovery: failureRecovery,
		config:          config,
		metrics:         &HighPerformanceMetrics{},
		stopChan:        make(chan struct{}),
	}

	return hpw, nil
}

// Start starts the high-performance writer
func (hpw *HighPerformanceWriter) Start(ctx context.Context) error {
	hpw.mu.Lock()
	if hpw.isRunning {
		hpw.mu.Unlock()
		return fmt.Errorf("high-performance writer is already running")
	}
	hpw.isRunning = true
	hpw.mu.Unlock()

	// Start failure recovery if enabled
	if hpw.failureRecovery != nil {
		if err := hpw.failureRecovery.Start(ctx); err != nil {
			return fmt.Errorf("failed to start failure recovery: %w", err)
		}
	}

	// Start metrics collection
	hpw.wg.Add(1)
	go hpw.metricsCollector(ctx)

	return nil
}

// Stop stops the high-performance writer
func (hpw *HighPerformanceWriter) Stop() error {
	hpw.mu.Lock()
	if !hpw.isRunning {
		hpw.mu.Unlock()
		return nil
	}
	hpw.isRunning = false
	hpw.mu.Unlock()

	close(hpw.stopChan)
	hpw.wg.Wait()

	// Stop failure recovery if enabled
	if hpw.failureRecovery != nil {
		if err := hpw.failureRecovery.Stop(); err != nil {
			return fmt.Errorf("failed to stop failure recovery: %w", err)
		}
	}

	return nil
}

// WriteData performs high-performance data writing with all optimizations
func (hpw *HighPerformanceWriter) WriteData(ctx context.Context, database, superTable string, dataPoints []DataPoint) (*WriteResult, error) {
	startTime := time.Now()
	
	// Update metrics
	hpw.mu.Lock()
	hpw.metrics.TotalWrites++
	hpw.mu.Unlock()

	// Optimize data points if compressor is available
	optimizedPoints := dataPoints
	if hpw.compressor != nil {
		optimizedPoints = hpw.compressor.OptimizeDataPoints(dataPoints)
	}

	// Perform the write with retry
	result, err := hpw.dataWriter.WriteWithRetry(ctx, database, superTable, optimizedPoints, 3)
	
	duration := time.Since(startTime)
	
	// Update performance metrics
	hpw.updatePerformanceMetrics(result, duration, len(dataPoints))
	
	// Handle failure if recovery is enabled
	if err != nil && hpw.failureRecovery != nil {
		recoveryErr := hpw.failureRecovery.RecordFailure(database, superTable, dataPoints, err)
		if recoveryErr != nil {
			fmt.Printf("Failed to record failure for recovery: %v\n", recoveryErr)
		}
		
		hpw.mu.Lock()
		hpw.metrics.FailedWrites++
		hpw.mu.Unlock()
	} else if err == nil {
		hpw.mu.Lock()
		hpw.metrics.SuccessfulWrites++
		hpw.mu.Unlock()
	}

	return result, err
}

// WriteBatch performs high-performance batch writing
func (hpw *HighPerformanceWriter) WriteBatch(ctx context.Context, batches []BatchData) (*WriteResult, error) {
	startTime := time.Now()
	
	hpw.mu.Lock()
	hpw.metrics.TotalWrites++
	hpw.metrics.BatchWrites++
	hpw.mu.Unlock()

	// Compress batch data if compression is enabled
	var compressedBatches []BatchData = batches
	if hpw.compressor != nil {
		for i, batch := range batches {
			optimizedPoints := hpw.compressor.OptimizeDataPoints(batch.DataPoints)
			compressedBatches[i].DataPoints = optimizedPoints
		}
	}

	// Perform batch write
	result, err := hpw.dataWriter.BatchWrite(ctx, compressedBatches)
	
	duration := time.Since(startTime)
	
	// Calculate total data points
	totalPoints := 0
	for _, batch := range batches {
		totalPoints += len(batch.DataPoints)
	}
	
	hpw.updatePerformanceMetrics(result, duration, totalPoints)
	
	// Handle failures
	if err != nil {
		hpw.mu.Lock()
		hpw.metrics.FailedWrites++
		hpw.mu.Unlock()
		
		// Record each failed batch for recovery
		if hpw.failureRecovery != nil {
			for _, batch := range batches {
				recoveryErr := hpw.failureRecovery.RecordFailure(batch.Database, batch.SuperTable, batch.DataPoints, err)
				if recoveryErr != nil {
					fmt.Printf("Failed to record batch failure for recovery: %v\n", recoveryErr)
				}
			}
		}
	} else {
		hpw.mu.Lock()
		hpw.metrics.SuccessfulWrites++
		hpw.mu.Unlock()
	}

	return result, err
}

// WriteStream performs high-performance streaming writes
func (hpw *HighPerformanceWriter) WriteStream(ctx context.Context, database, superTable string, dataPoints <-chan DataPoint) error {
	hpw.mu.Lock()
	hpw.metrics.TotalWrites++
	hpw.metrics.StreamWrites++
	hpw.mu.Unlock()

	err := hpw.dataWriter.StreamWrite(ctx, database, superTable, dataPoints)
	
	if err != nil {
		hpw.mu.Lock()
		hpw.metrics.FailedWrites++
		hpw.mu.Unlock()
	} else {
		hpw.mu.Lock()
		hpw.metrics.SuccessfulWrites++
		hpw.mu.Unlock()
	}

	return err
}

// CompressData compresses data for efficient transmission
func (hpw *HighPerformanceWriter) CompressData(dataPoints []DataPoint) (*CompressedData, error) {
	if hpw.compressor == nil {
		return nil, fmt.Errorf("compression is not enabled")
	}
	
	return hpw.compressor.CompressDataPoints(dataPoints)
}

// DecompressData decompresses data
func (hpw *HighPerformanceWriter) DecompressData(compressed *CompressedData) ([]DataPoint, error) {
	if hpw.compressor == nil {
		return nil, fmt.Errorf("compression is not enabled")
	}
	
	return hpw.compressor.DecompressDataPoints(compressed)
}

// GetMetrics returns comprehensive performance metrics
func (hpw *HighPerformanceWriter) GetMetrics() *HighPerformanceMetrics {
	hpw.mu.RLock()
	defer hpw.mu.RUnlock()
	
	// Create a copy to avoid race conditions
	metrics := *hpw.metrics
	return &metrics
}

// GetDetailedStats returns detailed statistics from all components
func (hpw *HighPerformanceWriter) GetDetailedStats() map[string]interface{} {
	stats := make(map[string]interface{})
	
	// High-performance metrics
	stats["high_performance"] = hpw.GetMetrics()
	
	// Data writer metrics
	stats["data_writer"] = hpw.dataWriter.GetMetrics()
	
	// Failure recovery stats
	if hpw.failureRecovery != nil {
		stats["failure_recovery"] = hpw.failureRecovery.GetFailureStats()
	}
	
	// Configuration
	stats["config"] = hpw.config
	
	return stats
}

// ResetMetrics resets all performance metrics
func (hpw *HighPerformanceWriter) ResetMetrics() {
	hpw.mu.Lock()
	defer hpw.mu.Unlock()
	
	hpw.metrics = &HighPerformanceMetrics{
		LastUpdateTime: time.Now(),
	}
	
	hpw.dataWriter.ResetMetrics()
}

// HealthCheck performs a comprehensive health check
func (hpw *HighPerformanceWriter) HealthCheck(ctx context.Context) map[string]interface{} {
	health := make(map[string]interface{})
	
	// Check if running
	hpw.mu.RLock()
	isRunning := hpw.isRunning
	hpw.mu.RUnlock()
	
	health["is_running"] = isRunning
	health["timestamp"] = time.Now()
	
	// Check metrics
	metrics := hpw.GetMetrics()
	health["failure_rate"] = metrics.FailureRate
	health["data_points_per_sec"] = metrics.DataPointsPerSec
	health["avg_latency_ms"] = metrics.AvgWriteLatency
	
	// Determine overall health status
	status := "healthy"
	if metrics.FailureRate > 10.0 { // More than 10% failure rate
		status = "degraded"
	}
	if metrics.FailureRate > 50.0 { // More than 50% failure rate
		status = "unhealthy"
	}
	if !isRunning {
		status = "stopped"
	}
	
	health["status"] = status
	
	return health
}

// Private methods

func (hpw *HighPerformanceWriter) updatePerformanceMetrics(result *WriteResult, duration time.Duration, dataPointCount int) {
	hpw.mu.Lock()
	defer hpw.mu.Unlock()
	
	latencyMs := float64(duration.Nanoseconds()) / 1e6
	
	// Update latency metrics
	if hpw.metrics.MaxWriteLatency == 0 || latencyMs > hpw.metrics.MaxWriteLatency {
		hpw.metrics.MaxWriteLatency = latencyMs
	}
	if hpw.metrics.MinWriteLatency == 0 || latencyMs < hpw.metrics.MinWriteLatency {
		hpw.metrics.MinWriteLatency = latencyMs
	}
	
	// Calculate running average
	totalWrites := hpw.metrics.TotalWrites
	if totalWrites > 0 {
		hpw.metrics.AvgWriteLatency = (hpw.metrics.AvgWriteLatency*float64(totalWrites-1) + latencyMs) / float64(totalWrites)
	}
	
	// Update throughput
	if duration.Seconds() > 0 {
		hpw.metrics.DataPointsPerSec = float64(dataPointCount) / duration.Seconds()
		
		// Estimate throughput in MB/s (assuming ~100 bytes per data point)
		bytesPerSec := float64(dataPointCount) * 100 / duration.Seconds()
		hpw.metrics.ThroughputMBPS = bytesPerSec / (1024 * 1024)
	}
	
	// Update failure rate
	if hpw.metrics.TotalWrites > 0 {
		hpw.metrics.FailureRate = float64(hpw.metrics.FailedWrites) / float64(hpw.metrics.TotalWrites) * 100
	}
	
	// Update recovery rate
	if hpw.metrics.FailedWrites > 0 {
		hpw.metrics.RecoveryRate = float64(hpw.metrics.RecoveredWrites) / float64(hpw.metrics.FailedWrites) * 100
	}
	
	hpw.metrics.LastUpdateTime = time.Now()
}

func (hpw *HighPerformanceWriter) metricsCollector(ctx context.Context) {
	defer hpw.wg.Done()
	
	ticker := time.NewTicker(hpw.config.MetricsInterval)
	defer ticker.Stop()
	
	startTime := time.Now()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-hpw.stopChan:
			return
		case <-ticker.C:
			hpw.mu.Lock()
			hpw.metrics.UptimeSeconds = int64(time.Since(startTime).Seconds())
			hpw.mu.Unlock()
		}
	}
}