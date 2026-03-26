package services

import (
	"context"
	"fmt"
	"log"
	"math"
	"sync"
	"time"
)

// AutoTuner 自动调优器
type AutoTuner struct {
	config           *PerformanceConfig
	performanceData  *PerformanceHistory
	tuningRules      []TuningRule
	running          bool
	stopChan         chan struct{}
	mu               sync.RWMutex
}

// PerformanceHistory 性能历史数据
type PerformanceHistory struct {
	ResponseTimes    []float64 `json:"response_times"`
	Throughputs      []float64 `json:"throughputs"`
	ErrorRates       []float64 `json:"error_rates"`
	MemoryUsages     []float64 `json:"memory_usages"`
	CPUUsages        []float64 `json:"cpu_usages"`
	Timestamps       []time.Time `json:"timestamps"`
	MaxHistorySize   int       `json:"max_history_size"`
}

// TuningRule 调优规则
type TuningRule interface {
	Name() string
	Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool
	Action(optimizer *PerformanceOptimizer) error
	Priority() int
}

// TuningAction 调优动作
type TuningAction struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	Success     bool      `json:"success"`
	Error       string    `json:"error,omitempty"`
}

// NewAutoTuner 创建自动调优器
func NewAutoTuner(config *PerformanceConfig) *AutoTuner {
	tuner := &AutoTuner{
		config: config,
		performanceData: &PerformanceHistory{
			MaxHistorySize: 1000, // 保留最近1000个数据点
		},
		stopChan: make(chan struct{}),
	}
	
	// 初始化调优规则
	tuner.initializeTuningRules()
	
	return tuner
}

// Start 启动自动调优器
func (at *AutoTuner) Start(ctx context.Context) error {
	at.mu.Lock()
	defer at.mu.Unlock()
	
	if at.running {
		return fmt.Errorf("auto tuner already running")
	}
	
	at.running = true
	
	// 启动调优循环
	go at.tuningLoop(ctx)
	
	log.Println("Auto tuner started")
	return nil
}

// Stop 停止自动调优器
func (at *AutoTuner) Stop() {
	at.mu.Lock()
	defer at.mu.Unlock()
	
	if !at.running {
		return
	}
	
	at.running = false
	close(at.stopChan)
	
	log.Println("Auto tuner stopped")
}

// initializeTuningRules 初始化调优规则
func (at *AutoTuner) initializeTuningRules() {
	at.tuningRules = []TuningRule{
		&HighMemoryUsageRule{threshold: 0.8},
		&HighResponseTimeRule{threshold: at.config.PerformanceTarget},
		&LowCacheHitRateRule{threshold: 0.7},
		&HighConnectionUsageRule{threshold: 0.8},
		&HighErrorRateRule{threshold: 0.05},
		&CPUOptimizationRule{threshold: 0.8},
	}
}

// AddPerformanceData 添加性能数据
func (at *AutoTuner) AddPerformanceData(metrics *OptimizerMetrics) {
	at.mu.Lock()
	defer at.mu.Unlock()
	
	history := at.performanceData
	
	// 添加新数据
	history.ResponseTimes = append(history.ResponseTimes, metrics.ResponseTime)
	history.Throughputs = append(history.Throughputs, metrics.Throughput)
	history.ErrorRates = append(history.ErrorRates, metrics.ErrorRate)
	history.MemoryUsages = append(history.MemoryUsages, metrics.MemoryUsage)
	history.CPUUsages = append(history.CPUUsages, metrics.CPUUsage)
	history.Timestamps = append(history.Timestamps, metrics.Timestamp)
	
	// 保持历史数据大小限制
	if len(history.ResponseTimes) > history.MaxHistorySize {
		history.ResponseTimes = history.ResponseTimes[1:]
		history.Throughputs = history.Throughputs[1:]
		history.ErrorRates = history.ErrorRates[1:]
		history.MemoryUsages = history.MemoryUsages[1:]
		history.CPUUsages = history.CPUUsages[1:]
		history.Timestamps = history.Timestamps[1:]
	}
}

// tuningLoop 调优循环
func (at *AutoTuner) tuningLoop(ctx context.Context) {
	ticker := time.NewTicker(at.config.TuningInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-at.stopChan:
			return
		case <-ticker.C:
			// 这里需要从性能优化器获取当前指标
			// 由于循环依赖，我们通过回调或事件机制来处理
		}
	}
}

// PerformTuning 执行调优
func (at *AutoTuner) PerformTuning(optimizer *PerformanceOptimizer, metrics *OptimizerMetrics) []TuningAction {
	at.mu.RLock()
	defer at.mu.RUnlock()
	
	var actions []TuningAction
	
	// 添加性能数据到历史记录
	at.AddPerformanceData(metrics)
	
	// 按优先级排序规则
	rules := make([]TuningRule, len(at.tuningRules))
	copy(rules, at.tuningRules)
	
	// 简单的优先级排序
	for i := 0; i < len(rules)-1; i++ {
		for j := i + 1; j < len(rules); j++ {
			if rules[i].Priority() < rules[j].Priority() {
				rules[i], rules[j] = rules[j], rules[i]
			}
		}
	}
	
	// 执行符合条件的调优规则
	for _, rule := range rules {
		if rule.Condition(metrics, at.performanceData) {
			action := TuningAction{
				Name:        rule.Name(),
				Description: fmt.Sprintf("Executing tuning rule: %s", rule.Name()),
				Timestamp:   time.Now(),
			}
			
			if err := rule.Action(optimizer); err != nil {
				action.Success = false
				action.Error = err.Error()
				log.Printf("Tuning rule %s failed: %v", rule.Name(), err)
			} else {
				action.Success = true
				log.Printf("Tuning rule %s executed successfully", rule.Name())
			}
			
			actions = append(actions, action)
		}
	}
	
	return actions
}

// GetPerformanceTrend 获取性能趋势
func (at *AutoTuner) GetPerformanceTrend() map[string]string {
	at.mu.RLock()
	defer at.mu.RUnlock()
	
	trends := make(map[string]string)
	
	if len(at.performanceData.ResponseTimes) >= 10 {
		trend := at.calculateTrend(at.performanceData.ResponseTimes)
		trends["response_time"] = trend
	}
	
	if len(at.performanceData.MemoryUsages) >= 10 {
		trend := at.calculateTrend(at.performanceData.MemoryUsages)
		trends["memory_usage"] = trend
	}
	
	if len(at.performanceData.CPUUsages) >= 10 {
		trend := at.calculateTrend(at.performanceData.CPUUsages)
		trends["cpu_usage"] = trend
	}
	
	return trends
}

// calculateTrend 计算趋势
func (at *AutoTuner) calculateTrend(data []float64) string {
	if len(data) < 2 {
		return "stable"
	}
	
	// 计算最近10个数据点的平均值和之前10个数据点的平均值
	recentSize := int(math.Min(10, float64(len(data))))
	recent := data[len(data)-recentSize:]
	
	if len(data) < 20 {
		return "stable"
	}
	
	previous := data[len(data)-2*recentSize : len(data)-recentSize]
	
	recentAvg := at.average(recent)
	previousAvg := at.average(previous)
	
	change := (recentAvg - previousAvg) / previousAvg
	
	if change > 0.1 {
		return "increasing"
	} else if change < -0.1 {
		return "decreasing"
	} else {
		return "stable"
	}
}

// average 计算平均值
func (at *AutoTuner) average(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}
	
	sum := 0.0
	for _, v := range data {
		sum += v
	}
	
	return sum / float64(len(data))
}

// 调优规则实现

// HighMemoryUsageRule 高内存使用率规则
type HighMemoryUsageRule struct {
	threshold float64
}

func (r *HighMemoryUsageRule) Name() string {
	return "HighMemoryUsage"
}

func (r *HighMemoryUsageRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	return metrics.MemoryUsage > r.threshold*100
}

func (r *HighMemoryUsageRule) Action(optimizer *PerformanceOptimizer) error {
	return optimizer.OptimizeMemory()
}

func (r *HighMemoryUsageRule) Priority() int {
	return 10
}

// HighResponseTimeRule 高响应时间规则
type HighResponseTimeRule struct {
	threshold float64
}

func (r *HighResponseTimeRule) Name() string {
	return "HighResponseTime"
}

func (r *HighResponseTimeRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	return metrics.ResponseTime > r.threshold
}

func (r *HighResponseTimeRule) Action(optimizer *PerformanceOptimizer) error {
	// 综合优化
	if err := optimizer.OptimizeCache(); err != nil {
		return err
	}
	return optimizer.OptimizeConnections()
}

func (r *HighResponseTimeRule) Priority() int {
	return 9
}

// LowCacheHitRateRule 低缓存命中率规则
type LowCacheHitRateRule struct {
	threshold float64
}

func (r *LowCacheHitRateRule) Name() string {
	return "LowCacheHitRate"
}

func (r *LowCacheHitRateRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	return metrics.CacheHitRate < r.threshold
}

func (r *LowCacheHitRateRule) Action(optimizer *PerformanceOptimizer) error {
	return optimizer.OptimizeCache()
}

func (r *LowCacheHitRateRule) Priority() int {
	return 8
}

// HighConnectionUsageRule 高连接使用率规则
type HighConnectionUsageRule struct {
	threshold float64
}

func (r *HighConnectionUsageRule) Name() string {
	return "HighConnectionUsage"
}

func (r *HighConnectionUsageRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	if metrics.ActiveConns == 0 {
		return false
	}
	// 这里需要从配置中获取最大连接数
	return float64(metrics.ActiveConns)/100 > r.threshold // 假设最大连接数为100
}

func (r *HighConnectionUsageRule) Action(optimizer *PerformanceOptimizer) error {
	return optimizer.OptimizeConnections()
}

func (r *HighConnectionUsageRule) Priority() int {
	return 7
}

// HighErrorRateRule 高错误率规则
type HighErrorRateRule struct {
	threshold float64
}

func (r *HighErrorRateRule) Name() string {
	return "HighErrorRate"
}

func (r *HighErrorRateRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	return metrics.ErrorRate > r.threshold
}

func (r *HighErrorRateRule) Action(optimizer *PerformanceOptimizer) error {
	// 高错误率时进行全面优化
	if err := optimizer.OptimizeMemory(); err != nil {
		return err
	}
	if err := optimizer.OptimizeConnections(); err != nil {
		return err
	}
	return optimizer.OptimizeCache()
}

func (r *HighErrorRateRule) Priority() int {
	return 6
}

// CPUOptimizationRule CPU优化规则
type CPUOptimizationRule struct {
	threshold float64
}

func (r *CPUOptimizationRule) Name() string {
	return "CPUOptimization"
}

func (r *CPUOptimizationRule) Condition(metrics *OptimizerMetrics, history *PerformanceHistory) bool {
	return metrics.CPUUsage > r.threshold*100
}

func (r *CPUOptimizationRule) Action(optimizer *PerformanceOptimizer) error {
	// CPU使用率高时，主要优化内存和缓存
	if err := optimizer.OptimizeMemory(); err != nil {
		return err
	}
	return optimizer.OptimizeCache()
}

func (r *CPUOptimizationRule) Priority() int {
	return 5
}