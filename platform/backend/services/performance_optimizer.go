package services

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// PerformanceOptimizer 性能优化器
type PerformanceOptimizer struct {
	config           *PerformanceConfig
	memoryManager    *MemoryManager
	connectionPool   *ConnectionPoolManager
	cacheManager     *CacheManager
	autoTuner        *AutoTuner
	metrics          *OptimizerMetrics
	running          bool
	stopChan         chan struct{}
	mu               sync.RWMutex
}

// PerformanceConfig 性能配置
type PerformanceConfig struct {
	// 内存管理配置
	MaxMemoryUsage        float64       `json:"max_memory_usage"`         // 最大内存使用率 (0.8 = 80%)
	GCThreshold          float64       `json:"gc_threshold"`             // GC触发阈值
	MemoryCheckInterval  time.Duration `json:"memory_check_interval"`    // 内存检查间隔
	
	// 连接池配置
	MaxConnections       int           `json:"max_connections"`          // 最大连接数
	IdleConnections      int           `json:"idle_connections"`         // 空闲连接数
	ConnectionTimeout    time.Duration `json:"connection_timeout"`       // 连接超时
	
	// 缓存配置
	CacheSize           int64         `json:"cache_size"`               // 缓存大小 (字节)
	CacheTTL            time.Duration `json:"cache_ttl"`                // 缓存TTL
	CacheCleanInterval  time.Duration `json:"cache_clean_interval"`     // 缓存清理间隔
	
	// 自动调优配置
	AutoTuningEnabled   bool          `json:"auto_tuning_enabled"`      // 启用自动调优
	TuningInterval      time.Duration `json:"tuning_interval"`          // 调优间隔
	PerformanceTarget   float64       `json:"performance_target"`       // 性能目标 (响应时间ms)
}

// OptimizerMetrics 优化器性能指标
type OptimizerMetrics struct {
	// 系统指标
	CPUUsage        float64   `json:"cpu_usage"`
	MemoryUsage     float64   `json:"memory_usage"`
	DiskUsage       float64   `json:"disk_usage"`
	NetworkIn       uint64    `json:"network_in"`
	NetworkOut      uint64    `json:"network_out"`
	
	// 应用指标
	GoroutineCount  int       `json:"goroutine_count"`
	HeapSize        uint64    `json:"heap_size"`
	GCCount         uint32    `json:"gc_count"`
	
	// 性能指标
	ResponseTime    float64   `json:"response_time"`
	Throughput      float64   `json:"throughput"`
	ErrorRate       float64   `json:"error_rate"`
	
	// 连接池指标
	ActiveConns     int       `json:"active_connections"`
	IdleConns       int       `json:"idle_connections"`
	
	// 缓存指标
	CacheHitRate    float64   `json:"cache_hit_rate"`
	CacheSize       int64     `json:"cache_size"`
	
	Timestamp       time.Time `json:"timestamp"`
}

// NewPerformanceOptimizer 创建性能优化器
func NewPerformanceOptimizer(config *PerformanceConfig) *PerformanceOptimizer {
	if config == nil {
		config = DefaultPerformanceConfig()
	}
	
	return &PerformanceOptimizer{
		config:         config,
		memoryManager:  NewMemoryManager(config),
		connectionPool: NewConnectionPoolManager(config),
		cacheManager:   NewCacheManager(config),
		autoTuner:      NewAutoTuner(config),
		metrics:        &OptimizerMetrics{},
		stopChan:       make(chan struct{}),
	}
}

// DefaultPerformanceConfig 默认性能配置
func DefaultPerformanceConfig() *PerformanceConfig {
	return &PerformanceConfig{
		MaxMemoryUsage:       0.8,
		GCThreshold:         0.7,
		MemoryCheckInterval: 30 * time.Second,
		MaxConnections:      100,
		IdleConnections:     10,
		ConnectionTimeout:   30 * time.Second,
		CacheSize:          100 * 1024 * 1024, // 100MB
		CacheTTL:           1 * time.Hour,
		CacheCleanInterval: 10 * time.Minute,
		AutoTuningEnabled:  true,
		TuningInterval:     5 * time.Minute,
		PerformanceTarget:  2000, // 2秒响应时间目标
	}
}

// Start 启动性能优化器
func (po *PerformanceOptimizer) Start(ctx context.Context) error {
	po.mu.Lock()
	defer po.mu.Unlock()
	
	if po.running {
		return fmt.Errorf("performance optimizer already running")
	}
	
	po.running = true
	
	// 启动各个组件
	if err := po.memoryManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start memory manager: %w", err)
	}
	
	if err := po.connectionPool.Start(ctx); err != nil {
		return fmt.Errorf("failed to start connection pool: %w", err)
	}
	
	if err := po.cacheManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start cache manager: %w", err)
	}
	
	if po.config.AutoTuningEnabled {
		if err := po.autoTuner.Start(ctx); err != nil {
			return fmt.Errorf("failed to start auto tuner: %w", err)
		}
	}
	
	// 启动监控循环
	go po.monitoringLoop(ctx)
	
	log.Println("Performance optimizer started")
	return nil
}

// Stop 停止性能优化器
func (po *PerformanceOptimizer) Stop() error {
	po.mu.Lock()
	defer po.mu.Unlock()
	
	if !po.running {
		return nil
	}
	
	po.running = false
	close(po.stopChan)
	
	// 停止各个组件
	po.memoryManager.Stop()
	po.connectionPool.Stop()
	po.cacheManager.Stop()
	po.autoTuner.Stop()
	
	log.Println("Performance optimizer stopped")
	return nil
}

// GetMetrics 获取性能指标
func (po *PerformanceOptimizer) GetMetrics() *OptimizerMetrics {
	po.mu.RLock()
	defer po.mu.RUnlock()
	
	metrics := *po.metrics
	return &metrics
}

// OptimizeMemory 优化内存使用
func (po *PerformanceOptimizer) OptimizeMemory() error {
	return po.memoryManager.Optimize()
}

// OptimizeConnections 优化连接池
func (po *PerformanceOptimizer) OptimizeConnections() error {
	return po.connectionPool.Optimize()
}

// OptimizeCache 优化缓存
func (po *PerformanceOptimizer) OptimizeCache() error {
	return po.cacheManager.Optimize()
}

// monitoringLoop 监控循环
func (po *PerformanceOptimizer) monitoringLoop(ctx context.Context) {
	ticker := time.NewTicker(po.config.MemoryCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-po.stopChan:
			return
		case <-ticker.C:
			po.collectMetrics()
			po.checkThresholds()
		}
	}
}

// collectMetrics 收集性能指标
func (po *PerformanceOptimizer) collectMetrics() {
	po.mu.Lock()
	defer po.mu.Unlock()
	
	// 收集系统指标
	if cpuPercent, err := cpu.Percent(0, false); err == nil && len(cpuPercent) > 0 {
		po.metrics.CPUUsage = cpuPercent[0]
	}
	
	if memInfo, err := mem.VirtualMemory(); err == nil {
		po.metrics.MemoryUsage = memInfo.UsedPercent
	}
	
	if diskInfo, err := disk.Usage("/"); err == nil {
		po.metrics.DiskUsage = diskInfo.UsedPercent
	}
	
	if netStats, err := net.IOCounters(false); err == nil && len(netStats) > 0 {
		po.metrics.NetworkIn = netStats[0].BytesRecv
		po.metrics.NetworkOut = netStats[0].BytesSent
	}
	
	// 收集Go运行时指标
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	po.metrics.GoroutineCount = runtime.NumGoroutine()
	po.metrics.HeapSize = memStats.HeapAlloc
	po.metrics.GCCount = memStats.NumGC
	
	// 收集连接池指标
	po.metrics.ActiveConns = po.connectionPool.GetActiveCount()
	po.metrics.IdleConns = po.connectionPool.GetIdleCount()
	
	// 收集缓存指标
	po.metrics.CacheHitRate = po.cacheManager.GetHitRate()
	po.metrics.CacheSize = po.cacheManager.GetSize()
	
	po.metrics.Timestamp = time.Now()
}

// checkThresholds 检查阈值
func (po *PerformanceOptimizer) checkThresholds() {
	// 检查内存使用率
	if po.metrics.MemoryUsage > po.config.MaxMemoryUsage*100 {
		log.Printf("High memory usage detected: %.2f%%, triggering optimization", po.metrics.MemoryUsage)
		if err := po.OptimizeMemory(); err != nil {
			log.Printf("Memory optimization failed: %v", err)
		}
	}
	
	// 检查GC压力
	if float64(po.metrics.HeapSize) > float64(po.config.MaxMemoryUsage)*1024*1024*1024 {
		log.Println("High heap usage detected, triggering GC")
		runtime.GC()
	}
	
	// 检查连接池状态
	if po.metrics.ActiveConns > po.config.MaxConnections*8/10 {
		log.Printf("High connection usage detected: %d/%d, optimizing pool", 
			po.metrics.ActiveConns, po.config.MaxConnections)
		if err := po.OptimizeConnections(); err != nil {
			log.Printf("Connection optimization failed: %v", err)
		}
	}
	
	// 检查缓存命中率
	if po.metrics.CacheHitRate < 0.8 {
		log.Printf("Low cache hit rate detected: %.2f%%, optimizing cache", po.metrics.CacheHitRate)
		if err := po.OptimizeCache(); err != nil {
			log.Printf("Cache optimization failed: %v", err)
		}
	}
}

// GetOptimizationRecommendations 获取优化建议
func (po *PerformanceOptimizer) GetOptimizationRecommendations() []string {
	var recommendations []string
	
	metrics := po.GetMetrics()
	
	if metrics.MemoryUsage > 80 {
		recommendations = append(recommendations, "内存使用率过高，建议增加内存或优化内存使用")
	}
	
	if metrics.CPUUsage > 80 {
		recommendations = append(recommendations, "CPU使用率过高，建议优化算法或增加CPU资源")
	}
	
	if metrics.CacheHitRate < 0.8 {
		recommendations = append(recommendations, "缓存命中率较低，建议调整缓存策略或增加缓存大小")
	}
	
	if float64(metrics.ActiveConns)/float64(po.config.MaxConnections) > 0.8 {
		recommendations = append(recommendations, "连接池使用率过高，建议增加连接池大小")
	}
	
	if metrics.ResponseTime > po.config.PerformanceTarget {
		recommendations = append(recommendations, "响应时间超过目标值，建议进行性能优化")
	}
	
	return recommendations
}