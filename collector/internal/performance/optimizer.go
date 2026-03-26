package performance

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
	"github.com/shirou/gopsutil/v3/process"
)

// CollectorOptimizer 采集器性能优化器
type CollectorOptimizer struct {
	config          *OptimizerConfig
	memoryOptimizer *MemoryOptimizer
	bufferOptimizer *BufferOptimizer
	networkOptimizer *NetworkOptimizer
	metrics         *CollectorMetrics
	running         bool
	stopChan        chan struct{}
	mu              sync.RWMutex
}

// OptimizerConfig 优化器配置
type OptimizerConfig struct {
	// 内存优化配置
	MaxMemoryUsage      float64       `json:"max_memory_usage"`      // 最大内存使用率
	GCThreshold         float64       `json:"gc_threshold"`          // GC触发阈值
	MemoryCheckInterval time.Duration `json:"memory_check_interval"` // 内存检查间隔
	
	// 缓冲区优化配置
	MaxBufferSize       int           `json:"max_buffer_size"`       // 最大缓冲区大小
	BufferFlushInterval time.Duration `json:"buffer_flush_interval"` // 缓冲区刷新间隔
	BatchSize          int           `json:"batch_size"`            // 批处理大小
	
	// 网络优化配置
	ConnectionTimeout   time.Duration `json:"connection_timeout"`    // 连接超时
	RetryInterval      time.Duration `json:"retry_interval"`        // 重试间隔
	MaxRetries         int           `json:"max_retries"`           // 最大重试次数
	
	// 性能监控配置
	MetricsInterval    time.Duration `json:"metrics_interval"`      // 指标收集间隔
	AutoOptimization   bool          `json:"auto_optimization"`     // 自动优化开关
}

// CollectorMetrics 采集器性能指标
type CollectorMetrics struct {
	// 系统指标
	CPUUsage        float64   `json:"cpu_usage"`
	MemoryUsage     float64   `json:"memory_usage"`
	DiskUsage       float64   `json:"disk_usage"`
	
	// 应用指标
	GoroutineCount  int       `json:"goroutine_count"`
	HeapSize        uint64    `json:"heap_size"`
	GCCount         uint32    `json:"gc_count"`
	
	// 采集指标
	DataPointsPerSec float64  `json:"data_points_per_sec"`
	CollectionErrors int64    `json:"collection_errors"`
	BufferUsage     float64   `json:"buffer_usage"`
	
	// 网络指标
	NetworkLatency  float64   `json:"network_latency"`
	ConnectionCount int       `json:"connection_count"`
	UploadSuccess   int64     `json:"upload_success"`
	UploadFailures  int64     `json:"upload_failures"`
	
	Timestamp       time.Time `json:"timestamp"`
}

// NewCollectorOptimizer 创建采集器优化器
func NewCollectorOptimizer(config *OptimizerConfig) *CollectorOptimizer {
	if config == nil {
		config = DefaultOptimizerConfig()
	}
	
	return &CollectorOptimizer{
		config:          config,
		memoryOptimizer: NewMemoryOptimizer(config),
		bufferOptimizer: NewBufferOptimizer(config),
		networkOptimizer: NewNetworkOptimizer(config),
		metrics:         &CollectorMetrics{},
		stopChan:        make(chan struct{}),
	}
}

// DefaultOptimizerConfig 默认优化器配置
func DefaultOptimizerConfig() *OptimizerConfig {
	return &OptimizerConfig{
		MaxMemoryUsage:      0.8,
		GCThreshold:         0.7,
		MemoryCheckInterval: 30 * time.Second,
		MaxBufferSize:       10000,
		BufferFlushInterval: 5 * time.Second,
		BatchSize:          100,
		ConnectionTimeout:   30 * time.Second,
		RetryInterval:      5 * time.Second,
		MaxRetries:         3,
		MetricsInterval:    10 * time.Second,
		AutoOptimization:   true,
	}
}

// Start 启动优化器
func (co *CollectorOptimizer) Start(ctx context.Context) error {
	co.mu.Lock()
	defer co.mu.Unlock()
	
	if co.running {
		return fmt.Errorf("collector optimizer already running")
	}
	
	co.running = true
	
	// 启动各个优化器组件
	if err := co.memoryOptimizer.Start(ctx); err != nil {
		return fmt.Errorf("failed to start memory optimizer: %w", err)
	}
	
	if err := co.bufferOptimizer.Start(ctx); err != nil {
		return fmt.Errorf("failed to start buffer optimizer: %w", err)
	}
	
	if err := co.networkOptimizer.Start(ctx); err != nil {
		return fmt.Errorf("failed to start network optimizer: %w", err)
	}
	
	// 启动监控循环
	go co.monitoringLoop(ctx)
	
	log.Println("Collector optimizer started")
	return nil
}

// Stop 停止优化器
func (co *CollectorOptimizer) Stop() error {
	co.mu.Lock()
	defer co.mu.Unlock()
	
	if !co.running {
		return nil
	}
	
	co.running = false
	close(co.stopChan)
	
	// 停止各个组件
	co.memoryOptimizer.Stop()
	co.bufferOptimizer.Stop()
	co.networkOptimizer.Stop()
	
	log.Println("Collector optimizer stopped")
	return nil
}

// GetMetrics 获取性能指标
func (co *CollectorOptimizer) GetMetrics() *CollectorMetrics {
	co.mu.RLock()
	defer co.mu.RUnlock()
	
	metrics := *co.metrics
	return &metrics
}

// OptimizeMemory 优化内存
func (co *CollectorOptimizer) OptimizeMemory() error {
	return co.memoryOptimizer.Optimize()
}

// OptimizeBuffer 优化缓冲区
func (co *CollectorOptimizer) OptimizeBuffer() error {
	return co.bufferOptimizer.Optimize()
}

// OptimizeNetwork 优化网络
func (co *CollectorOptimizer) OptimizeNetwork() error {
	return co.networkOptimizer.Optimize()
}

// monitoringLoop 监控循环
func (co *CollectorOptimizer) monitoringLoop(ctx context.Context) {
	ticker := time.NewTicker(co.config.MetricsInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-co.stopChan:
			return
		case <-ticker.C:
			co.collectMetrics()
			if co.config.AutoOptimization {
				co.performAutoOptimization()
			}
		}
	}
}

// collectMetrics 收集性能指标
func (co *CollectorOptimizer) collectMetrics() {
	co.mu.Lock()
	defer co.mu.Unlock()
	
	// 收集系统指标
	if cpuPercent, err := cpu.Percent(0, false); err == nil && len(cpuPercent) > 0 {
		co.metrics.CPUUsage = cpuPercent[0]
	}
	
	if memInfo, err := mem.VirtualMemory(); err == nil {
		co.metrics.MemoryUsage = memInfo.UsedPercent
	}
	
	if diskInfo, err := disk.Usage("."); err == nil {
		co.metrics.DiskUsage = diskInfo.UsedPercent
	}
	
	// 收集Go运行时指标
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	co.metrics.GoroutineCount = runtime.NumGoroutine()
	co.metrics.HeapSize = memStats.HeapAlloc
	co.metrics.GCCount = memStats.NumGC
	
	// 收集应用指标
	co.metrics.BufferUsage = co.bufferOptimizer.GetUsage()
	co.metrics.ConnectionCount = co.networkOptimizer.GetConnectionCount()
	
	co.metrics.Timestamp = time.Now()
}

// performAutoOptimization 执行自动优化
func (co *CollectorOptimizer) performAutoOptimization() {
	// 检查内存使用率
	if co.metrics.MemoryUsage > co.config.MaxMemoryUsage*100 {
		log.Printf("High memory usage detected: %.2f%%, triggering optimization", co.metrics.MemoryUsage)
		if err := co.OptimizeMemory(); err != nil {
			log.Printf("Memory optimization failed: %v", err)
		}
	}
	
	// 检查缓冲区使用率
	if co.metrics.BufferUsage > 0.8 {
		log.Printf("High buffer usage detected: %.2f%%, triggering optimization", co.metrics.BufferUsage)
		if err := co.OptimizeBuffer(); err != nil {
			log.Printf("Buffer optimization failed: %v", err)
		}
	}
	
	// 检查网络状态
	if co.metrics.UploadFailures > 0 && co.metrics.UploadFailures > co.metrics.UploadSuccess/10 {
		log.Printf("High network failure rate detected, triggering optimization")
		if err := co.OptimizeNetwork(); err != nil {
			log.Printf("Network optimization failed: %v", err)
		}
	}
}

// GetOptimizationRecommendations 获取优化建议
func (co *CollectorOptimizer) GetOptimizationRecommendations() []string {
	var recommendations []string
	
	metrics := co.GetMetrics()
	
	if metrics.MemoryUsage > 80 {
		recommendations = append(recommendations, "内存使用率过高，建议增加内存或优化数据处理")
	}
	
	if metrics.CPUUsage > 80 {
		recommendations = append(recommendations, "CPU使用率过高，建议优化采集算法或降低采集频率")
	}
	
	if metrics.BufferUsage > 0.8 {
		recommendations = append(recommendations, "缓冲区使用率过高，建议增加缓冲区大小或提高上传频率")
	}
	
	if metrics.GoroutineCount > 1000 {
		recommendations = append(recommendations, "Goroutine数量过多，可能存在协程泄漏")
	}
	
	if metrics.UploadFailures > metrics.UploadSuccess/10 {
		recommendations = append(recommendations, "网络上传失败率过高，建议检查网络连接")
	}
	
	return recommendations
}

// UpdateConfig 更新配置
func (co *CollectorOptimizer) UpdateConfig(config *OptimizerConfig) error {
	co.mu.Lock()
	defer co.mu.Unlock()
	
	// 验证配置
	if err := validateOptimizerConfig(config); err != nil {
		return err
	}
	
	co.config = config
	
	// 更新各个组件的配置
	co.memoryOptimizer.UpdateConfig(config)
	co.bufferOptimizer.UpdateConfig(config)
	co.networkOptimizer.UpdateConfig(config)
	
	log.Println("Optimizer configuration updated")
	return nil
}

// validateOptimizerConfig 验证优化器配置
func validateOptimizerConfig(config *OptimizerConfig) error {
	if config.MaxMemoryUsage <= 0 || config.MaxMemoryUsage > 1 {
		return fmt.Errorf("max_memory_usage must be between 0 and 1")
	}
	
	if config.MaxBufferSize <= 0 {
		return fmt.Errorf("max_buffer_size must be positive")
	}
	
	if config.BatchSize <= 0 || config.BatchSize > config.MaxBufferSize {
		return fmt.Errorf("batch_size must be positive and not exceed max_buffer_size")
	}
	
	if config.MaxRetries < 0 {
		return fmt.Errorf("max_retries must be non-negative")
	}
	
	return nil
}

// GetSystemInfo 获取系统信息
func (co *CollectorOptimizer) GetSystemInfo() map[string]interface{} {
	info := make(map[string]interface{})
	
	// 获取进程信息
	if proc, err := process.NewProcess(int32(os.Getpid())); err == nil {
		if memInfo, err := proc.MemoryInfo(); err == nil {
			info["process_memory"] = memInfo
		}
		
		if cpuPercent, err := proc.CPUPercent(); err == nil {
			info["process_cpu"] = cpuPercent
		}
		
		if createTime, err := proc.CreateTime(); err == nil {
			info["process_start_time"] = time.Unix(createTime/1000, 0)
		}
	}
	
	// 获取运行时信息
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	info["runtime"] = map[string]interface{}{
		"goroutines":     runtime.NumGoroutine(),
		"heap_alloc":     memStats.HeapAlloc,
		"heap_sys":       memStats.HeapSys,
		"heap_idle":      memStats.HeapIdle,
		"heap_inuse":     memStats.HeapInuse,
		"heap_objects":   memStats.HeapObjects,
		"gc_count":       memStats.NumGC,
		"gc_pause_total": memStats.PauseTotalNs,
		"last_gc":        memStats.LastGC,
	}
	
	return info
}