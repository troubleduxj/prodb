package services

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

// MemoryManager 内存管理器
type MemoryManager struct {
	config      *PerformanceConfig
	pools       map[string]*sync.Pool
	allocations map[string]int64
	running     bool
	stopChan    chan struct{}
	mu          sync.RWMutex
}

// NewMemoryManager 创建内存管理器
func NewMemoryManager(config *PerformanceConfig) *MemoryManager {
	return &MemoryManager{
		config:      config,
		pools:       make(map[string]*sync.Pool),
		allocations: make(map[string]int64),
		stopChan:    make(chan struct{}),
	}
}

// Start 启动内存管理器
func (mm *MemoryManager) Start(ctx context.Context) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()
	
	if mm.running {
		return fmt.Errorf("memory manager already running")
	}
	
	mm.running = true
	
	// 初始化对象池
	mm.initializePools()
	
	// 启动内存监控
	go mm.memoryMonitorLoop(ctx)
	
	log.Println("Memory manager started")
	return nil
}

// Stop 停止内存管理器
func (mm *MemoryManager) Stop() {
	mm.mu.Lock()
	defer mm.mu.Unlock()
	
	if !mm.running {
		return
	}
	
	mm.running = false
	close(mm.stopChan)
	
	log.Println("Memory manager stopped")
}

// initializePools 初始化对象池
func (mm *MemoryManager) initializePools() {
	// 字节缓冲池
	mm.pools["bytes_1k"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 1024)
		},
	}
	
	mm.pools["bytes_4k"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 4096)
		},
	}
	
	mm.pools["bytes_64k"] = &sync.Pool{
		New: func() interface{} {
			return make([]byte, 65536)
		},
	}
	
	// 字符串构建器池
	mm.pools["string_builder"] = &sync.Pool{
		New: func() interface{} {
			return &strings.Builder{}
		},
	}
	
	// 映射池
	mm.pools["map_string"] = &sync.Pool{
		New: func() interface{} {
			return make(map[string]interface{})
		},
	}
	
	// 切片池
	mm.pools["slice_interface"] = &sync.Pool{
		New: func() interface{} {
			return make([]interface{}, 0, 100)
		},
	}
}

// GetBuffer 获取缓冲区
func (mm *MemoryManager) GetBuffer(size int) []byte {
	var poolName string
	
	switch {
	case size <= 1024:
		poolName = "bytes_1k"
	case size <= 4096:
		poolName = "bytes_4k"
	case size <= 65536:
		poolName = "bytes_64k"
	default:
		// 对于大缓冲区，直接分配
		mm.trackAllocation("large_buffer", int64(size))
		return make([]byte, size)
	}
	
	mm.mu.RLock()
	pool, exists := mm.pools[poolName]
	mm.mu.RUnlock()
	
	if !exists {
		return make([]byte, size)
	}
	
	buffer := pool.Get().([]byte)
	if len(buffer) < size {
		// 如果池中的缓冲区太小，重新分配
		buffer = make([]byte, size)
	}
	
	mm.trackAllocation(poolName, int64(len(buffer)))
	return buffer[:size]
}

// PutBuffer 归还缓冲区
func (mm *MemoryManager) PutBuffer(buffer []byte) {
	if buffer == nil {
		return
	}
	
	var poolName string
	size := len(buffer)
	
	switch {
	case size <= 1024:
		poolName = "bytes_1k"
	case size <= 4096:
		poolName = "bytes_4k"
	case size <= 65536:
		poolName = "bytes_64k"
	default:
		// 大缓冲区不回收
		mm.trackDeallocation("large_buffer", int64(size))
		return
	}
	
	mm.mu.RLock()
	pool, exists := mm.pools[poolName]
	mm.mu.RUnlock()
	
	if exists {
		// 清零缓冲区
		for i := range buffer {
			buffer[i] = 0
		}
		pool.Put(buffer)
		mm.trackDeallocation(poolName, int64(size))
	}
}

// GetMap 获取映射
func (mm *MemoryManager) GetMap() map[string]interface{} {
	mm.mu.RLock()
	pool, exists := mm.pools["map_string"]
	mm.mu.RUnlock()
	
	if !exists {
		return make(map[string]interface{})
	}
	
	m := pool.Get().(map[string]interface{})
	mm.trackAllocation("map_string", 64) // 估算大小
	return m
}

// PutMap 归还映射
func (mm *MemoryManager) PutMap(m map[string]interface{}) {
	if m == nil {
		return
	}
	
	// 清空映射
	for k := range m {
		delete(m, k)
	}
	
	mm.mu.RLock()
	pool, exists := mm.pools["map_string"]
	mm.mu.RUnlock()
	
	if exists {
		pool.Put(m)
		mm.trackDeallocation("map_string", 64)
	}
}

// GetSlice 获取切片
func (mm *MemoryManager) GetSlice() []interface{} {
	mm.mu.RLock()
	pool, exists := mm.pools["slice_interface"]
	mm.mu.RUnlock()
	
	if !exists {
		return make([]interface{}, 0, 100)
	}
	
	s := pool.Get().([]interface{})
	mm.trackAllocation("slice_interface", 800) // 估算大小
	return s[:0] // 重置长度但保留容量
}

// PutSlice 归还切片
func (mm *MemoryManager) PutSlice(s []interface{}) {
	if s == nil {
		return
	}
	
	// 清空切片
	for i := range s {
		s[i] = nil
	}
	s = s[:0]
	
	mm.mu.RLock()
	pool, exists := mm.pools["slice_interface"]
	mm.mu.RUnlock()
	
	if exists {
		pool.Put(s)
		mm.trackDeallocation("slice_interface", 800)
	}
}

// trackAllocation 跟踪内存分配
func (mm *MemoryManager) trackAllocation(poolName string, size int64) {
	mm.mu.Lock()
	mm.allocations[poolName] += size
	mm.mu.Unlock()
}

// trackDeallocation 跟踪内存释放
func (mm *MemoryManager) trackDeallocation(poolName string, size int64) {
	mm.mu.Lock()
	mm.allocations[poolName] -= size
	mm.mu.Unlock()
}

// Optimize 优化内存使用
func (mm *MemoryManager) Optimize() error {
	// 强制垃圾回收
	runtime.GC()
	
	// 释放未使用的内存给操作系统
	debug.FreeOSMemory()
	
	// 调整GC目标
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	// 如果堆内存使用过高，降低GC目标
	if memStats.HeapAlloc > uint64(mm.config.MaxMemoryUsage*1024*1024*1024) {
		debug.SetGCPercent(50) // 更频繁的GC
	} else {
		debug.SetGCPercent(100) // 默认GC频率
	}
	
	log.Printf("Memory optimization completed. Heap: %d bytes, GC: %d times", 
		memStats.HeapAlloc, memStats.NumGC)
	
	return nil
}

// memoryMonitorLoop 内存监控循环
func (mm *MemoryManager) memoryMonitorLoop(ctx context.Context) {
	ticker := time.NewTicker(mm.config.MemoryCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-mm.stopChan:
			return
		case <-ticker.C:
			mm.checkMemoryUsage()
		}
	}
}

// checkMemoryUsage 检查内存使用情况
func (mm *MemoryManager) checkMemoryUsage() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	// 计算内存使用率
	heapUsage := float64(memStats.HeapAlloc) / (1024 * 1024 * 1024) // GB
	
	if heapUsage > mm.config.MaxMemoryUsage {
		log.Printf("High memory usage detected: %.2f GB, triggering optimization", heapUsage)
		mm.Optimize()
	}
	
	// 检查GC频率
	if memStats.NumGC > 0 {
		gcRate := float64(memStats.NumGC) / time.Since(time.Unix(0, int64(memStats.LastGC))).Minutes()
		if gcRate > 10 { // 每分钟超过10次GC
			log.Printf("High GC rate detected: %.2f GC/min", gcRate)
		}
	}
}

// GetMemoryStats 获取内存统计信息
func (mm *MemoryManager) GetMemoryStats() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	mm.mu.RLock()
	allocations := make(map[string]int64)
	for k, v := range mm.allocations {
		allocations[k] = v
	}
	mm.mu.RUnlock()
	
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
	}
}