package performance

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"runtime/debug"
	"sync"
	"time"
)

// MemoryOptimizer 内存优化器
type MemoryOptimizer struct {
	config      *OptimizerConfig
	pools       map[string]*sync.Pool
	allocations map[string]int64
	running     bool
	stopChan    chan struct{}
	mu          sync.RWMutex
}

// NewMemoryOptimizer 创建内存优化器
func NewMemoryOptimizer(config *OptimizerConfig) *MemoryOptimizer {
	return &MemoryOptimizer{
		config:      config,
		pools:       make(map[string]*sync.Pool),
		allocations: make(map[string]int64),
		stopChan:    make(chan struct{}),
	}
}

// Start 启动内存优化器
func (mo *MemoryOptimizer) Start(ctx context.Context) error {
	mo.mu.Lock()
	defer mo.mu.Unlock()
	
	if mo.running {
		return fmt.Errorf("memory optimizer already running")
	}
	
	mo.running = true
	
	// 初始化对象池
	mo.initializePools()
	
	// 启动内存监控
	go mo.memoryMonitorLoop(ctx)
	
	log.Println("Memory optimizer started")
	return nil
}

// Stop 停止内存优化器
func (mo *MemoryOptimizer) Stop() {
	mo.mu.Lock()
	defer mo.mu.Unlock()
	
	if !mo.running {
		return
	}
	
	mo.running = false
	close(mo.stopChan)
	
	log.Println("Memory optimizer stopped")
}

// initializePools 初始化对象池
func (mo *MemoryOptimizer) initializePools() {
	// 数据点缓冲池
	mo.pools["data_points"] = &sync.Pool{
		New: func() interface{} {
			return make([]interface{}, 0, 100)
		},
	}
	
	// 字节缓冲池 - 小缓冲区
	mo.pools["bytes_small"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 1024)
		},
	}
	
	// 字节缓冲池 - 中等缓冲区
	mo.pools["bytes_medium"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 8192)
		},
	}
	
	// 字节缓冲池 - 大缓冲区
	mo.pools["bytes_large"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 65536)
		},
	}
	
	// 映射池
	mo.pools["map_string"] = &sync.Pool{
		New: func() interface{} {
			return make(map[string]interface{}, 10)
		},
	}
	
	// 协议数据池
	mo.pools["protocol_data"] = &sync.Pool{
		New: func() interface{} {
			return make(map[string]interface{}, 20)
		},
	}
}

// GetBuffer 获取缓冲区
func (mo *MemoryOptimizer) GetBuffer(size int) []byte {
	var poolName string
	
	switch {
	case size <= 1024:
		poolName = "bytes_small"
	case size <= 8192:
		poolName = "bytes_medium"
	case size <= 65536:
		poolName = "bytes_large"
	default:
		// 对于超大缓冲区，直接分配
		mo.trackAllocation("large_buffer", int64(size))
		return make([]byte, size)
	}
	
	mo.mu.RLock()
	pool, exists := mo.pools[poolName]
	mo.mu.RUnlock()
	
	if !exists {
		return make([]byte, size)
	}
	
	buffer := pool.Get().([]byte)
	if len(buffer) < size {
		// 如果池中的缓冲区太小，重新分配
		buffer = make([]byte, size)
	}
	
	mo.trackAllocation(poolName, int64(len(buffer)))
	return buffer[:size]
}

// PutBuffer 归还缓冲区
func (mo *MemoryOptimizer) PutBuffer(buffer []byte) {
	if buffer == nil {
		return
	}
	
	var poolName string
	size := len(buffer)
	
	switch {
	case size <= 1024:
		poolName = "bytes_small"
	case size <= 8192:
		poolName = "bytes_medium"
	case size <= 65536:
		poolName = "bytes_large"
	default:
		// 大缓冲区不回收
		mo.trackDeallocation("large_buffer", int64(size))
		return
	}
	
	mo.mu.RLock()
	pool, exists := mo.pools[poolName]
	mo.mu.RUnlock()
	
	if exists {
		// 清零缓冲区
		for i := range buffer {
			buffer[i] = 0
		}
		pool.Put(buffer)
		mo.trackDeallocation(poolName, int64(size))
	}
}

// GetDataPointSlice 获取数据点切片
func (mo *MemoryOptimizer) GetDataPointSlice() []interface{} {
	mo.mu.RLock()
	pool, exists := mo.pools["data_points"]
	mo.mu.RUnlock()
	
	if !exists {
		return make([]interface{}, 0, 100)
	}
	
	slice := pool.Get().([]interface{})
	mo.trackAllocation("data_points", 800) // 估算大小
	return slice[:0] // 重置长度但保留容量
}

// PutDataPointSlice 归还数据点切片
func (mo *MemoryOptimizer) PutDataPointSlice(slice []interface{}) {
	if slice == nil {
		return
	}
	
	// 清空切片
	for i := range slice {
		slice[i] = nil
	}
	slice = slice[:0]
	
	mo.mu.RLock()
	pool, exists := mo.pools["data_points"]
	mo.mu.RUnlock()
	
	if exists {
		pool.Put(slice)
		mo.trackDeallocation("data_points", 800)
	}
}

// GetMap 获取映射
func (mo *MemoryOptimizer) GetMap() map[string]interface{} {
	mo.mu.RLock()
	pool, exists := mo.pools["map_string"]
	mo.mu.RUnlock()
	
	if !exists {
		return make(map[string]interface{}, 10)
	}
	
	m := pool.Get().(map[string]interface{})
	mo.trackAllocation("map_string", 160) // 估算大小
	return m
}

// PutMap 归还映射
func (mo *MemoryOptimizer) PutMap(m map[string]interface{}) {
	if m == nil {
		return
	}
	
	// 清空映射
	for k := range m {
		delete(m, k)
	}
	
	mo.mu.RLock()
	pool, exists := mo.pools["map_string"]
	mo.mu.RUnlock()
	
	if exists {
		pool.Put(m)
		mo.trackDeallocation("map_string", 160)
	}
}

// GetProtocolData 获取协议数据映射
func (mo *MemoryOptimizer) GetProtocolData() map[string]interface{} {
	mo.mu.RLock()
	pool, exists := mo.pools["protocol_data"]
	mo.mu.RUnlock()
	
	if !exists {
		return make(map[string]interface{}, 20)
	}
	
	m := pool.Get().(map[string]interface{})
	mo.trackAllocation("protocol_data", 320) // 估算大小
	return m
}

// PutProtocolData 归还协议数据映射
func (mo *MemoryOptimizer) PutProtocolData(m map[string]interface{}) {
	if m == nil {
		return
	}
	
	// 清空映射
	for k := range m {
		delete(m, k)
	}
	
	mo.mu.RLock()
	pool, exists := mo.pools["protocol_data"]
	mo.mu.RUnlock()
	
	if exists {
		pool.Put(m)
		mo.trackDeallocation("protocol_data", 320)
	}
}

// trackAllocation 跟踪内存分配
func (mo *MemoryOptimizer) trackAllocation(poolName string, size int64) {
	mo.mu.Lock()
	mo.allocations[poolName] += size
	mo.mu.Unlock()
}

// trackDeallocation 跟踪内存释放
func (mo *MemoryOptimizer) trackDeallocation(poolName string, size int64) {
	mo.mu.Lock()
	mo.allocations[poolName] -= size
	mo.mu.Unlock()
}

// Optimize 优化内存使用
func (mo *MemoryOptimizer) Optimize() error {
	// 强制垃圾回收
	runtime.GC()
	
	// 释放未使用的内存给操作系统
	debug.FreeOSMemory()
	
	// 调整GC目标
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	// 如果堆内存使用过高，降低GC目标
	maxHeapSize := uint64(mo.config.MaxMemoryUsage * 1024 * 1024 * 1024) // GB转字节
	if memStats.HeapAlloc > maxHeapSize {
		debug.SetGCPercent(50) // 更频繁的GC
		log.Println("High memory usage detected, increased GC frequency")
	} else {
		debug.SetGCPercent(100) // 默认GC频率
	}
	
	log.Printf("Memory optimization completed. Heap: %d bytes, GC: %d times", 
		memStats.HeapAlloc, memStats.NumGC)
	
	return nil
}

// memoryMonitorLoop 内存监控循环
func (mo *MemoryOptimizer) memoryMonitorLoop(ctx context.Context) {
	ticker := time.NewTicker(mo.config.MemoryCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-mo.stopChan:
			return
		case <-ticker.C:
			mo.checkMemoryUsage()
		}
	}
}

// checkMemoryUsage 检查内存使用情况
func (mo *MemoryOptimizer) checkMemoryUsage() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	// 计算内存使用率
	heapUsage := float64(memStats.HeapAlloc) / (1024 * 1024 * 1024) // GB
	
	if heapUsage > mo.config.MaxMemoryUsage {
		log.Printf("High memory usage detected: %.2f GB, triggering optimization", heapUsage)
		mo.Optimize()
	}
	
	// 检查GC频率
	if memStats.NumGC > 0 {
		gcRate := float64(memStats.NumGC) / time.Since(time.Unix(0, int64(memStats.LastGC))).Minutes()
		if gcRate > 10 { // 每分钟超过10次GC
			log.Printf("High GC rate detected: %.2f GC/min", gcRate)
		}
	}
	
	// 检查Goroutine数量
	goroutineCount := runtime.NumGoroutine()
	if goroutineCount > 1000 {
		log.Printf("High goroutine count detected: %d", goroutineCount)
	}
}

// GetMemoryStats 获取内存统计信息
func (mo *MemoryOptimizer) GetMemoryStats() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	mo.mu.RLock()
	allocations := make(map[string]int64)
	for k, v := range mo.allocations {
		allocations[k] = v
	}
	mo.mu.RUnlock()
	
	return map[string]interface{}{
		"heap_alloc":      memStats.HeapAlloc,
		"heap_sys":        memStats.HeapSys,
		"heap_idle":       memStats.HeapIdle,
		"heap_inuse":      memStats.HeapInuse,
		"heap_released":   memStats.HeapReleased,
		"heap_objects":    memStats.HeapObjects,
		"stack_inuse":     memStats.StackInuse,
		"stack_sys":       memStats.StackSys,
		"gc_count":        memStats.NumGC,
		"gc_pause_total":  memStats.PauseTotalNs,
		"last_gc":         memStats.LastGC,
		"allocations":     allocations,
		"goroutines":      runtime.NumGoroutine(),
		"pools_count":     len(mo.pools),
	}
}

// UpdateConfig 更新配置
func (mo *MemoryOptimizer) UpdateConfig(config *OptimizerConfig) {
	mo.mu.Lock()
	defer mo.mu.Unlock()
	
	mo.config = config
	log.Println("Memory optimizer configuration updated")
}

// GetPoolStats 获取对象池统计
func (mo *MemoryOptimizer) GetPoolStats() map[string]interface{} {
	mo.mu.RLock()
	defer mo.mu.RUnlock()
	
	stats := make(map[string]interface{})
	
	for name := range mo.pools {
		stats[name] = map[string]interface{}{
			"allocation": mo.allocations[name],
		}
	}
	
	return stats
}