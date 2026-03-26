package tdengine

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// DataWriter provides high-performance data writing capabilities
type DataWriter struct {
	service      *TDengineService
	batchSize    int
	flushTimeout time.Duration
	bufferPool   sync.Pool
	metrics      *WriterMetrics
	mu           sync.RWMutex
}

// WriterMetrics tracks data writing performance metrics
type WriterMetrics struct {
	TotalWrites     int64     `json:"total_writes"`
	SuccessfulWrites int64    `json:"successful_writes"`
	FailedWrites    int64     `json:"failed_writes"`
	BatchWrites     int64     `json:"batch_writes"`
	StreamWrites    int64     `json:"stream_writes"`
	AvgWriteTime    float64   `json:"avg_write_time_ms"`
	LastWriteTime   time.Time `json:"last_write_time"`
	DataPointsPerSec float64  `json:"data_points_per_sec"`
}

// WriterConfig configures the data writer
type WriterConfig struct {
	BatchSize         int           `json:"batch_size"`
	FlushTimeout      time.Duration `json:"flush_timeout"`
	MaxRetries        int           `json:"max_retries"`
	RetryDelay        time.Duration `json:"retry_delay"`
	CompressionLevel  int           `json:"compression_level"`
	EnableCompression bool          `json:"enable_compression"`
}

// DefaultWriterConfig returns default configuration for data writer
func DefaultWriterConfig() *WriterConfig {
	return &WriterConfig{
		BatchSize:         1000,
		FlushTimeout:      5 * time.Second,
		MaxRetries:        3,
		RetryDelay:        1 * time.Second,
		CompressionLevel:  1,
		EnableCompression: true,
	}
}

// NewDataWriter creates a new high-performance data writer
func NewDataWriter(service *TDengineService, config *WriterConfig) *DataWriter {
	if config == nil {
		config = DefaultWriterConfig()
	}

	writer := &DataWriter{
		service:      service,
		batchSize:    config.BatchSize,
		flushTimeout: config.FlushTimeout,
		metrics:      &WriterMetrics{},
		bufferPool: sync.Pool{
			New: func() interface{} {
				return make([]DataPoint, 0, config.BatchSize)
			},
		},
	}

	return writer
}

// BatchData represents a batch of data points for writing
type BatchData struct {
	Database    string      `json:"database"`
	SuperTable  string      `json:"super_table"`
	DataPoints  []DataPoint `json:"data_points"`
	Timestamp   time.Time   `json:"timestamp"`
	CollectorID string      `json:"collector_id"`
}

// WriteResult represents the result of a write operation
type WriteResult struct {
	Success       bool          `json:"success"`
	RecordsWritten int          `json:"records_written"`
	Duration      time.Duration `json:"duration"`
	Error         error         `json:"error,omitempty"`
	RetryCount    int           `json:"retry_count"`
}

// BatchWrite performs high-performance batch writing of data points
func (w *DataWriter) BatchWrite(ctx context.Context, batches []BatchData) (*WriteResult, error) {
	startTime := time.Now()
	
	w.mu.Lock()
	w.metrics.TotalWrites++
	w.metrics.BatchWrites++
	w.mu.Unlock()

	if len(batches) == 0 {
		return &WriteResult{
			Success:        true,
			RecordsWritten: 0,
			Duration:       time.Since(startTime),
		}, nil
	}

	totalRecords := 0
	for _, batch := range batches {
		totalRecords += len(batch.DataPoints)
	}

	// Group batches by database and super table for optimization
	groupedBatches := w.groupBatchesByTable(batches)
	
	var allErrors []error
	recordsWritten := 0

	for key, groupedData := range groupedBatches {
		parts := strings.Split(key, ".")
		if len(parts) != 2 {
			continue
		}
		database, superTable := parts[0], parts[1]

		result, err := w.writeBatchGroup(ctx, database, superTable, groupedData)
		if err != nil {
			allErrors = append(allErrors, err)
		} else {
			recordsWritten += result.RecordsWritten
		}
	}

	duration := time.Since(startTime)
	success := len(allErrors) == 0

	// Update metrics
	w.mu.Lock()
	if success {
		w.metrics.SuccessfulWrites++
	} else {
		w.metrics.FailedWrites++
	}
	w.metrics.LastWriteTime = time.Now()
	w.metrics.AvgWriteTime = float64(duration.Nanoseconds()) / 1e6 // Convert to milliseconds
	if duration.Seconds() > 0 {
		w.metrics.DataPointsPerSec = float64(recordsWritten) / duration.Seconds()
	}
	w.mu.Unlock()

	result := &WriteResult{
		Success:        success,
		RecordsWritten: recordsWritten,
		Duration:       duration,
	}

	if len(allErrors) > 0 {
		result.Error = fmt.Errorf("batch write errors: %v", allErrors)
	}

	return result, result.Error
}

// StreamWrite performs streaming write of data points with automatic batching
func (w *DataWriter) StreamWrite(ctx context.Context, database, superTable string, dataPoints <-chan DataPoint) error {
	w.mu.Lock()
	w.metrics.TotalWrites++
	w.metrics.StreamWrites++
	w.mu.Unlock()

	buffer := w.bufferPool.Get().([]DataPoint)
	defer w.bufferPool.Put(buffer[:0])

	flushTimer := time.NewTimer(w.flushTimeout)
	defer flushTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			// Flush remaining data before exit
			if len(buffer) > 0 {
				w.flushBuffer(ctx, database, superTable, buffer)
			}
			return ctx.Err()

		case dataPoint, ok := <-dataPoints:
			if !ok {
				// Channel closed, flush remaining data
				if len(buffer) > 0 {
					w.flushBuffer(ctx, database, superTable, buffer)
				}
				return nil
			}

			buffer = append(buffer, dataPoint)

			// Flush when buffer is full
			if len(buffer) >= w.batchSize {
				w.flushBuffer(ctx, database, superTable, buffer)
				buffer = buffer[:0]
				flushTimer.Reset(w.flushTimeout)
			}

		case <-flushTimer.C:
			// Flush on timeout
			if len(buffer) > 0 {
				w.flushBuffer(ctx, database, superTable, buffer)
				buffer = buffer[:0]
			}
			flushTimer.Reset(w.flushTimeout)
		}
	}
}

// OptimizedBatchInsert performs optimized batch insertion with SQL statement preparation
func (w *DataWriter) OptimizedBatchInsert(ctx context.Context, database, superTable string, dataPoints []DataPoint) (*WriteResult, error) {
	startTime := time.Now()
	
	if len(dataPoints) == 0 {
		return &WriteResult{
			Success:        true,
			RecordsWritten: 0,
			Duration:       time.Since(startTime),
		}, nil
	}

	// Group data points by device for sub-table optimization
	deviceGroups := w.groupDataPointsByDevice(dataPoints)
	
	var sqlStatements []string
	recordsWritten := 0

	for deviceKey, devicePoints := range deviceGroups {
		if len(devicePoints) == 0 {
			continue
		}

		// Auto-create sub-table if needed
		firstPoint := devicePoints[0]
		subTableName, err := w.service.AutoCreateSubTable(ctx, database, superTable, firstPoint)
		if err != nil {
			return &WriteResult{
				Success:  false,
				Duration: time.Since(startTime),
				Error:    fmt.Errorf("failed to create sub-table for device %s: %w", deviceKey, err),
			}, err
		}

		// Build optimized INSERT statement for this device
		sql := w.buildOptimizedInsertSQL(subTableName, devicePoints)
		sqlStatements = append(sqlStatements, sql)
		recordsWritten += len(devicePoints)
	}

	// Execute all statements in a single batch
	if len(sqlStatements) > 0 {
		combinedSQL := strings.Join(sqlStatements, "; ")
		_, err := w.service.manager.ExecuteNonQuery(ctx, combinedSQL)
		if err != nil {
			w.mu.Lock()
			w.metrics.FailedWrites++
			w.mu.Unlock()
			
			return &WriteResult{
				Success:  false,
				Duration: time.Since(startTime),
				Error:    fmt.Errorf("failed to execute batch insert: %w", err),
			}, err
		}
	}

	duration := time.Since(startTime)
	
	// Update metrics
	w.mu.Lock()
	w.metrics.SuccessfulWrites++
	w.metrics.LastWriteTime = time.Now()
	w.metrics.AvgWriteTime = float64(duration.Nanoseconds()) / 1e6
	if duration.Seconds() > 0 {
		w.metrics.DataPointsPerSec = float64(recordsWritten) / duration.Seconds()
	}
	w.mu.Unlock()

	return &WriteResult{
		Success:        true,
		RecordsWritten: recordsWritten,
		Duration:       duration,
	}, nil
}

// WriteWithRetry performs data writing with automatic retry on failure
func (w *DataWriter) WriteWithRetry(ctx context.Context, database, superTable string, dataPoints []DataPoint, maxRetries int) (*WriteResult, error) {
	var lastErr error
	retryDelay := 1 * time.Second

	for attempt := 0; attempt <= maxRetries; attempt++ {
		result, err := w.OptimizedBatchInsert(ctx, database, superTable, dataPoints)
		if err == nil {
			result.RetryCount = attempt
			return result, nil
		}

		lastErr = err
		
		// Don't retry on context cancellation
		if ctx.Err() != nil {
			break
		}

		// Don't retry on the last attempt
		if attempt < maxRetries {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(retryDelay):
				// Exponential backoff
				retryDelay *= 2
				if retryDelay > 30*time.Second {
					retryDelay = 30 * time.Second
				}
			}
		}
	}

	return &WriteResult{
		Success:    false,
		Error:      lastErr,
		RetryCount: maxRetries,
	}, lastErr
}

// GetMetrics returns current writer metrics
func (w *DataWriter) GetMetrics() *WriterMetrics {
	w.mu.RLock()
	defer w.mu.RUnlock()
	
	// Return a copy to avoid race conditions
	return &WriterMetrics{
		TotalWrites:      w.metrics.TotalWrites,
		SuccessfulWrites: w.metrics.SuccessfulWrites,
		FailedWrites:     w.metrics.FailedWrites,
		BatchWrites:      w.metrics.BatchWrites,
		StreamWrites:     w.metrics.StreamWrites,
		AvgWriteTime:     w.metrics.AvgWriteTime,
		LastWriteTime:    w.metrics.LastWriteTime,
		DataPointsPerSec: w.metrics.DataPointsPerSec,
	}
}

// ResetMetrics resets all writer metrics
func (w *DataWriter) ResetMetrics() {
	w.mu.Lock()
	defer w.mu.Unlock()
	
	w.metrics = &WriterMetrics{}
}

// Helper methods

func (w *DataWriter) groupBatchesByTable(batches []BatchData) map[string][]DataPoint {
	grouped := make(map[string][]DataPoint)
	
	for _, batch := range batches {
		key := fmt.Sprintf("%s.%s", batch.Database, batch.SuperTable)
		grouped[key] = append(grouped[key], batch.DataPoints...)
	}
	
	return grouped
}

func (w *DataWriter) groupDataPointsByDevice(dataPoints []DataPoint) map[string][]DataPoint {
	grouped := make(map[string][]DataPoint)
	
	for _, dp := range dataPoints {
		deviceKey := dp.DeviceID
		if collectorID, exists := dp.Tags["collector_id"]; exists {
			deviceKey = fmt.Sprintf("%v_%s", collectorID, dp.DeviceID)
		}
		grouped[deviceKey] = append(grouped[deviceKey], dp)
	}
	
	return grouped
}

func (w *DataWriter) buildOptimizedInsertSQL(subTableName string, dataPoints []DataPoint) string {
	if len(dataPoints) == 0 {
		return ""
	}

	var values []string
	for _, dp := range dataPoints {
		value := fmt.Sprintf("('%s', %v, %d, 1, '%v')",
			dp.Timestamp.Format("2006-01-02 15:04:05.000"),
			dp.Value,
			dp.Quality,
			dp.Value,
		)
		values = append(values, value)
	}

	return fmt.Sprintf("INSERT INTO %s VALUES %s", subTableName, strings.Join(values, ", "))
}

func (w *DataWriter) writeBatchGroup(ctx context.Context, database, superTable string, dataPoints []DataPoint) (*WriteResult, error) {
	return w.OptimizedBatchInsert(ctx, database, superTable, dataPoints)
}

func (w *DataWriter) flushBuffer(ctx context.Context, database, superTable string, buffer []DataPoint) {
	if len(buffer) == 0 {
		return
	}

	// Create a copy of the buffer to avoid race conditions
	dataPoints := make([]DataPoint, len(buffer))
	copy(dataPoints, buffer)

	// Perform the write operation
	_, err := w.OptimizedBatchInsert(ctx, database, superTable, dataPoints)
	if err != nil {
		// Log error but don't stop streaming
		fmt.Printf("Failed to flush buffer: %v\n", err)
	}
}