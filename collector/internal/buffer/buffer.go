package buffer

import (
	"context"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// DataBuffer manages in-memory buffering of collected data
type DataBuffer struct {
	config     config.BufferConfig
	logger     *logger.Logger
	
	// Buffer storage
	buffer     []protocol.DataValue
	mutex      sync.RWMutex
	
	// Control
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	
	// Channels
	dataChan   chan protocol.DataValue
	flushChan  chan []protocol.DataValue
	
	// Metrics
	metrics    *BufferMetrics
}

// BufferMetrics contains buffer performance metrics
type BufferMetrics struct {
	BufferSize      int   `json:"buffer_size"`
	MaxBufferSize   int   `json:"max_buffer_size"`
	TotalReceived   int64 `json:"total_received"`
	TotalFlushed    int64 `json:"total_flushed"`
	FlushCount      int64 `json:"flush_count"`
	DroppedCount    int64 `json:"dropped_count"`
	LastFlush       time.Time `json:"last_flush"`
	BufferUtilization float64 `json:"buffer_utilization"`
}

// NewDataBuffer creates a new data buffer
func NewDataBuffer(config config.BufferConfig, logger *logger.Logger) *DataBuffer {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &DataBuffer{
		config:    config,
		logger:    logger.WithGroup("data_buffer"),
		buffer:    make([]protocol.DataValue, 0, config.MaxSize),
		ctx:       ctx,
		cancel:    cancel,
		dataChan:  make(chan protocol.DataValue, 1000), // Buffered channel
		flushChan: make(chan []protocol.DataValue, 10),  // Buffered channel for flush operations
		metrics: &BufferMetrics{
			MaxBufferSize: config.MaxSize,
		},
	}
}

// Start starts the data buffer
func (db *DataBuffer) Start(ctx context.Context) error {
	db.logger.Info("Starting data buffer", 
		"max_size", db.config.MaxSize,
		"flush_interval", db.config.FlushInterval,
		"flush_batch_size", db.config.FlushBatchSize)
	
	// Start buffer management goroutine
	db.wg.Add(1)
	go db.bufferManager()
	
	// Start flush timer goroutine
	db.wg.Add(1)
	go db.flushTimer()
	
	db.logger.Info("Data buffer started")
	return nil
}

// Stop stops the data buffer
func (db *DataBuffer) Stop() {
	db.logger.Info("Stopping data buffer")
	
	db.cancel()
	close(db.dataChan)
	
	db.wg.Wait()
	
	// Flush remaining data
	db.flushBuffer(true)
	
	db.logger.Info("Data buffer stopped")
}

// Add adds a data value to the buffer
func (db *DataBuffer) Add(data protocol.DataValue) {
	select {
	case db.dataChan <- data:
		// Data added successfully
	default:
		// Channel is full, drop the data
		db.metrics.DroppedCount++
		db.logger.Warn("Data dropped due to full buffer channel")
	}
}

// AddBatch adds multiple data values to the buffer
func (db *DataBuffer) AddBatch(data []protocol.DataValue) {
	for _, value := range data {
		db.Add(value)
	}
}

// GetMetrics returns buffer metrics
func (db *DataBuffer) GetMetrics() *BufferMetrics {
	db.mutex.RLock()
	defer db.mutex.RUnlock()
	
	// Update buffer utilization
	db.metrics.BufferSize = len(db.buffer)
	if db.config.MaxSize > 0 {
		db.metrics.BufferUtilization = float64(len(db.buffer)) / float64(db.config.MaxSize) * 100
	}
	
	return db.metrics
}

// GetFlushChannel returns the flush channel for consumers
func (db *DataBuffer) GetFlushChannel() <-chan []protocol.DataValue {
	return db.flushChan
}

// bufferManager manages the data buffer
func (db *DataBuffer) bufferManager() {
	defer db.wg.Done()
	
	for {
		select {
		case <-db.ctx.Done():
			return
			
		case data, ok := <-db.dataChan:
			if !ok {
				return
			}
			
			db.addToBuffer(data)
		}
	}
}

// flushTimer periodically flushes the buffer
func (db *DataBuffer) flushTimer() {
	defer db.wg.Done()
	
	ticker := time.NewTicker(time.Duration(db.config.FlushInterval) * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-db.ctx.Done():
			return
			
		case <-ticker.C:
			db.flushBuffer(false)
		}
	}
}

// addToBuffer adds data to the internal buffer
func (db *DataBuffer) addToBuffer(data protocol.DataValue) {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	
	// Check if buffer is full
	if len(db.buffer) >= db.config.MaxSize {
		// Remove oldest data (FIFO)
		db.buffer = db.buffer[1:]
		db.metrics.DroppedCount++
		db.logger.Warn("Buffer full, dropping oldest data")
	}
	
	// Add new data
	db.buffer = append(db.buffer, data)
	db.metrics.TotalReceived++
	
	// Check if we should flush based on batch size
	if len(db.buffer) >= db.config.FlushBatchSize {
		go db.flushBuffer(false)
	}
}

// flushBuffer flushes data from the buffer
func (db *DataBuffer) flushBuffer(force bool) {
	db.mutex.Lock()
	
	// Check if there's data to flush
	if len(db.buffer) == 0 {
		db.mutex.Unlock()
		return
	}
	
	// Determine how much data to flush
	flushSize := db.config.FlushBatchSize
	if force || len(db.buffer) < flushSize {
		flushSize = len(db.buffer)
	}
	
	// Copy data to flush
	dataToFlush := make([]protocol.DataValue, flushSize)
	copy(dataToFlush, db.buffer[:flushSize])
	
	// Remove flushed data from buffer
	db.buffer = db.buffer[flushSize:]
	
	// Update metrics
	db.metrics.TotalFlushed += int64(flushSize)
	db.metrics.FlushCount++
	db.metrics.LastFlush = time.Now()
	
	db.mutex.Unlock()
	
	// Send data to flush channel (non-blocking)
	select {
	case db.flushChan <- dataToFlush:
		db.logger.Debug("Data flushed from buffer", 
			"count", len(dataToFlush),
			"remaining", len(db.buffer))
	default:
		// Flush channel is full, log warning
		db.logger.Warn("Flush channel full, data may be delayed")
		
		// Try to send with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		select {
		case db.flushChan <- dataToFlush:
			db.logger.Debug("Data flushed after retry", "count", len(dataToFlush))
		case <-ctx.Done():
			db.logger.Error("Failed to flush data, timeout exceeded")
			// Put data back in buffer
			db.mutex.Lock()
			db.buffer = append(dataToFlush, db.buffer...)
			db.metrics.TotalFlushed -= int64(len(dataToFlush))
			db.metrics.FlushCount--
			db.mutex.Unlock()
		}
	}
}

// Clear clears all data from the buffer
func (db *DataBuffer) Clear() {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	
	clearedCount := len(db.buffer)
	db.buffer = db.buffer[:0]
	
	db.logger.Info("Buffer cleared", "cleared_count", clearedCount)
}

// GetBufferSize returns the current buffer size
func (db *DataBuffer) GetBufferSize() int {
	db.mutex.RLock()
	defer db.mutex.RUnlock()
	
	return len(db.buffer)
}

// IsEmpty returns true if the buffer is empty
func (db *DataBuffer) IsEmpty() bool {
	return db.GetBufferSize() == 0
}

// IsFull returns true if the buffer is full
func (db *DataBuffer) IsFull() bool {
	db.mutex.RLock()
	defer db.mutex.RUnlock()
	
	return len(db.buffer) >= db.config.MaxSize
}