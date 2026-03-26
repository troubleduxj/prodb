package performance

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// BufferOptimizer 缓冲区优化器
type BufferOptimizer struct {
	config       *OptimizerConfig
	buffers      map[string]*OptimizedBuffer
	metrics      *BufferMetrics
	running      bool
	stopChan     chan struct{}
	mu           sync.RWMutex
}

// OptimizedBuffer 优化的缓冲区
type OptimizedBuffer struct {
	name         string
	data         []interface{}
	maxSize      int
	flushSize    int
	flushInterval time.Duration
	lastFlush    time.Time
	writeCount   int64
	readCount    int64
	flushCount   int64
	mu           sync.RWMutex
	flushCallback func([]interface{}) error
}

// BufferMetrics 缓冲区指标
type BufferMetrics struct {
	TotalBuffers    int                    `json:"total_buffers"`
	TotalSize       int64                  `json:"total_size"`
	TotalCapacity   int64                  `json:"total_capacity"`
	WriteRate       float64                `json:"write_rate"`
	ReadRate        float64                `json:"read_rate"`
	FlushRate       float64                `json:"flush_rate"`
	BufferStats     map[string]*BufferStat `json:"buffer_stats"`
}

// BufferStat 单个缓冲区统计
type BufferStat struct {
	Name          string    `json:"name"`
	Size          int       `json:"size"`
	Capacity      int       `json:"capacity"`
	Usage         float64   `json:"usage"`
	WriteCount    int64     `json:"write_count"`
	ReadCount     int64     `json:"read_count"`
	FlushCount    int64     `json:"flush_count"`
	LastFlush     time.Time `json:"last_flush"`
	FlushInterval time.Duration `json:"flush_interval"`
}

// NewBufferOptimizer 创建缓冲区优化器
func NewBufferOptimizer(config *OptimizerConfig) *BufferOptimizer {
	return &BufferOptimizer{
		config:   config,
		buffers:  make(map[string]*OptimizedBuffer),
		metrics:  &BufferMetrics{BufferStats: make(map[string]*BufferStat)},
		stopChan: make(chan struct{}),
	}
}

// Start 启动缓冲区优化器
func (bo *BufferOptimizer) Start(ctx context.Context) error {
	bo.mu.Lock()
	defer bo.mu.Unlock()
	
	if bo.running {
		return fmt.Errorf("buffer optimizer already running")
	}
	
	bo.running = true
	
	// 启动缓冲区监控和自动刷新
	go bo.bufferMonitorLoop(ctx)
	
	log.Println("Buffer optimizer started")
	return nil
}

// Stop 停止缓冲区优化器
func (bo *BufferOptimizer) Stop() {
	bo.mu.Lock()
	defer bo.mu.Unlock()
	
	if !bo.running {
		return
	}
	
	bo.running = false
	close(bo.stopChan)
	
	// 刷新所有缓冲区
	for _, buffer := range bo.buffers {
		buffer.Flush()
	}
	
	log.Println("Buffer optimizer stopped")
}

// CreateBuffer 创建缓冲区
func (bo *BufferOptimizer) CreateBuffer(name string, maxSize int, flushCallback func([]interface{}) error) error {
	bo.mu.Lock()
	defer bo.mu.Unlock()
	
	if _, exists := bo.buffers[name]; exists {
		return fmt.Errorf("buffer %s already exists", name)
	}
	
	buffer := &OptimizedBuffer{
		name:          name,
		data:          make([]interface{}, 0, maxSize),
		maxSize:       maxSize,
		flushSize:     bo.config.BatchSize,
		flushInterval: bo.config.BufferFlushInterval,
		lastFlush:     time.Now(),
		flushCallback: flushCallback,
	}
	
	bo.buffers[name] = buffer
	bo.metrics.BufferStats[name] = &BufferStat{
		Name:          name,
		Capacity:      maxSize,
		FlushInterval: buffer.flushInterval,
	}
	
	log.Printf("Created buffer: %s (max_size: %d, flush_size: %d)", name, maxSize, buffer.flushSize)
	return nil
}

// Write 写入数据到缓冲区
func (bo *BufferOptimizer) Write(bufferName string, data interface{}) error {
	bo.mu.RLock()
	buffer, exists := bo.buffers[bufferName]
	bo.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("buffer %s not found", bufferName)
	}
	
	return buffer.Write(data)
}

// Flush 刷新指定缓冲区
func (bo *BufferOptimizer) Flush(bufferName string) error {
	bo.mu.RLock()
	buffer, exists := bo.buffers[bufferName]
	bo.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("buffer %s not found", bufferName)
	}
	
	return buffer.Flush()
}

// FlushAll 刷新所有缓冲区
func (bo *BufferOptimizer) FlushAll() error {
	bo.mu.RLock()
	buffers := make([]*OptimizedBuffer, 0, len(bo.buffers))
	for _, buffer := range bo.buffers {
		buffers = append(buffers, buffer)
	}
	bo.mu.RUnlock()
	
	var lastErr error
	for _, buffer := range buffers {
		if err := buffer.Flush(); err != nil {
			lastErr = err
			log.Printf("Failed to flush buffer %s: %v", buffer.name, err)
		}
	}
	
	return lastErr
}

// GetUsage 获取缓冲区使用率
func (bo *BufferOptimizer) GetUsage() float64 {
	bo.mu.RLock()
	defer bo.mu.RUnlock()
	
	if len(bo.buffers) == 0 {
		return 0
	}
	
	totalUsage := 0.0
	for _, buffer := range bo.buffers {
		buffer.mu.RLock()
		usage := float64(len(buffer.data)) / float64(buffer.maxSize)
		buffer.mu.RUnlock()
		totalUsage += usage
	}
	
	return totalUsage / float64(len(bo.buffers))
}

// Optimize 优化缓冲区
func (bo *BufferOptimizer) Optimize() error {
	bo.mu.RLock()
	defer bo.mu.RUnlock()
	
	for name, buffer := range bo.buffers {
		// 检查缓冲区使用率
		buffer.mu.RLock()
		usage := float64(len(buffer.data)) / float64(buffer.maxSize)
		buffer.mu.RUnlock()
		
		// 如果使用率过高，立即刷新
		if usage > 0.8 {
			log.Printf("High buffer usage detected for %s: %.2f%%, flushing", name, usage*100)
			if err := buffer.Flush(); err != nil {
				log.Printf("Failed to flush buffer %s: %v", name, err)
			}
		}
		
		// 检查是否需要根据时间刷新
		if time.Since(buffer.lastFlush) > buffer.flushInterval {
			log.Printf("Buffer %s flush interval exceeded, flushing", name)
			if err := buffer.Flush(); err != nil {
				log.Printf("Failed to flush buffer %s: %v", name, err)
			}
		}
	}
	
	return nil
}

// bufferMonitorLoop 缓冲区监控循环
func (bo *BufferOptimizer) bufferMonitorLoop(ctx context.Context) {
	ticker := time.NewTicker(bo.config.BufferFlushInterval / 2) // 检查频率是刷新间隔的一半
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-bo.stopChan:
			return
		case <-ticker.C:
			bo.updateMetrics()
			bo.Optimize()
		}
	}
}

// updateMetrics 更新指标
func (bo *BufferOptimizer) updateMetrics() {
	bo.mu.RLock()
	defer bo.mu.RUnlock()
	
	var totalSize, totalCapacity int64
	var totalWrites, totalReads, totalFlushes int64
	
	for name, buffer := range bo.buffers {
		buffer.mu.RLock()
		size := int64(len(buffer.data))
		capacity := int64(buffer.maxSize)
		writes := atomic.LoadInt64(&buffer.writeCount)
		reads := atomic.LoadInt64(&buffer.readCount)
		flushes := atomic.LoadInt64(&buffer.flushCount)
		usage := float64(size) / float64(capacity)
		buffer.mu.RUnlock()
		
		totalSize += size
		totalCapacity += capacity
		totalWrites += writes
		totalReads += reads
		totalFlushes += flushes
		
		bo.metrics.BufferStats[name] = &BufferStat{
			Name:          name,
			Size:          int(size),
			Capacity:      int(capacity),
			Usage:         usage,
			WriteCount:    writes,
			ReadCount:     reads,
			FlushCount:    flushes,
			LastFlush:     buffer.lastFlush,
			FlushInterval: buffer.flushInterval,
		}
	}
	
	bo.metrics.TotalBuffers = len(bo.buffers)
	bo.metrics.TotalSize = totalSize
	bo.metrics.TotalCapacity = totalCapacity
	
	// 计算速率（简化版本，实际应该基于时间窗口）
	bo.metrics.WriteRate = float64(totalWrites)
	bo.metrics.ReadRate = float64(totalReads)
	bo.metrics.FlushRate = float64(totalFlushes)
}

// GetMetrics 获取缓冲区指标
func (bo *BufferOptimizer) GetMetrics() *BufferMetrics {
	bo.mu.RLock()
	defer bo.mu.RUnlock()
	
	// 深拷贝指标
	metrics := &BufferMetrics{
		TotalBuffers:  bo.metrics.TotalBuffers,
		TotalSize:     bo.metrics.TotalSize,
		TotalCapacity: bo.metrics.TotalCapacity,
		WriteRate:     bo.metrics.WriteRate,
		ReadRate:      bo.metrics.ReadRate,
		FlushRate:     bo.metrics.FlushRate,
		BufferStats:   make(map[string]*BufferStat),
	}
	
	for name, stat := range bo.metrics.BufferStats {
		metrics.BufferStats[name] = &BufferStat{
			Name:          stat.Name,
			Size:          stat.Size,
			Capacity:      stat.Capacity,
			Usage:         stat.Usage,
			WriteCount:    stat.WriteCount,
			ReadCount:     stat.ReadCount,
			FlushCount:    stat.FlushCount,
			LastFlush:     stat.LastFlush,
			FlushInterval: stat.FlushInterval,
		}
	}
	
	return metrics
}

// UpdateConfig 更新配置
func (bo *BufferOptimizer) UpdateConfig(config *OptimizerConfig) {
	bo.mu.Lock()
	defer bo.mu.Unlock()
	
	bo.config = config
	
	// 更新所有缓冲区的配置
	for _, buffer := range bo.buffers {
		buffer.mu.Lock()
		buffer.flushSize = config.BatchSize
		buffer.flushInterval = config.BufferFlushInterval
		buffer.mu.Unlock()
	}
	
	log.Println("Buffer optimizer configuration updated")
}

// OptimizedBuffer 方法

// Write 写入数据
func (ob *OptimizedBuffer) Write(data interface{}) error {
	ob.mu.Lock()
	defer ob.mu.Unlock()
	
	// 检查缓冲区是否已满
	if len(ob.data) >= ob.maxSize {
		// 缓冲区已满，先刷新一部分数据
		if err := ob.flushInternal(); err != nil {
			return fmt.Errorf("failed to flush buffer when full: %w", err)
		}
	}
	
	// 添加数据
	ob.data = append(ob.data, data)
	atomic.AddInt64(&ob.writeCount, 1)
	
	// 检查是否需要刷新
	if len(ob.data) >= ob.flushSize {
		return ob.flushInternal()
	}
	
	return nil
}

// Flush 刷新缓冲区
func (ob *OptimizedBuffer) Flush() error {
	ob.mu.Lock()
	defer ob.mu.Unlock()
	
	return ob.flushInternal()
}

// flushInternal 内部刷新方法（不加锁）
func (ob *OptimizedBuffer) flushInternal() error {
	if len(ob.data) == 0 {
		return nil
	}
	
	// 复制数据
	dataToFlush := make([]interface{}, len(ob.data))
	copy(dataToFlush, ob.data)
	
	// 清空缓冲区
	ob.data = ob.data[:0]
	ob.lastFlush = time.Now()
	atomic.AddInt64(&ob.flushCount, 1)
	atomic.AddInt64(&ob.readCount, int64(len(dataToFlush)))
	
	// 异步执行刷新回调
	if ob.flushCallback != nil {
		go func() {
			if err := ob.flushCallback(dataToFlush); err != nil {
				log.Printf("Buffer %s flush callback failed: %v", ob.name, err)
			}
		}()
	}
	
	return nil
}

// GetSize 获取缓冲区大小
func (ob *OptimizedBuffer) GetSize() int {
	ob.mu.RLock()
	defer ob.mu.RUnlock()
	
	return len(ob.data)
}

// GetUsage 获取缓冲区使用率
func (ob *OptimizedBuffer) GetUsage() float64 {
	ob.mu.RLock()
	defer ob.mu.RUnlock()
	
	return float64(len(ob.data)) / float64(ob.maxSize)
}