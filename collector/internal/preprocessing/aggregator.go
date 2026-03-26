// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"fmt"
	"sync"
	"time"
)

// AggregationFunction 聚合函数类型
type AggregationFunction string

const (
	AggregationAvg   AggregationFunction = "avg"
	AggregationSum   AggregationFunction = "sum"
	AggregationMax   AggregationFunction = "max"
	AggregationMin   AggregationFunction = "min"
	AggregationCount AggregationFunction = "count"
	AggregationFirst AggregationFunction = "first"
	AggregationLast  AggregationFunction = "last"
)

// AggregationConfig 聚合配置
type AggregationConfig struct {
	Enabled  bool
	Window   time.Duration // 窗口大小
	Function AggregationFunction
}

// WindowAggregator 窗口聚合器
type WindowAggregator struct {
	config AggregationConfig
	logger interface {
		Debug(msg string, keysAndValues ...interface{})
		Info(msg string, keysAndValues ...interface{})
	}
	
	// 每个数据点的窗口
	windows map[string]*DataWindow
	mu      sync.RWMutex
	
	// 控制
	ticker  *time.Ticker
	stopCh  chan struct{}
	wg      sync.WaitGroup
}

// DataWindow 数据窗口
type DataWindow struct {
	PointID   string
	Values    []DataPoint
	StartTime time.Time
	EndTime   time.Time
	Function  AggregationFunction
}

// AggregatedPoint 聚合后的数据点
type AggregatedPoint struct {
	Timestamp  time.Time       `json:"timestamp"`
	Value      float64         `json:"value"`
	Count      int             `json:"count"`
	Function   string          `json:"function"`
	Min        float64         `json:"min,omitempty"`
	Max        float64         `json:"max,omitempty"`
	Avg        float64         `json:"avg,omitempty"`
}

// NewWindowAggregator 创建窗口聚合器
func NewWindowAggregator(config AggregationConfig, logger interface {
	Debug(msg string, keysAndValues ...interface{})
	Info(msg string, keysAndValues ...interface{})
}) *WindowAggregator {
	return &WindowAggregator{
		config:  config,
		logger:  logger,
		windows: make(map[string]*DataWindow),
		stopCh:  make(chan struct{}),
	}
}

// Start 启动聚合器
func (wa *WindowAggregator) Start() {
	if !wa.config.Enabled {
		return
	}
	
	wa.ticker = time.NewTicker(wa.config.Window)
	wa.wg.Add(1)
	go wa.windowRotationLoop()
	
	wa.logger.Info("Window aggregator started", "window", wa.config.Window, "function", wa.config.Function)
}

// Stop 停止聚合器
func (wa *WindowAggregator) Stop() {
	if wa.ticker != nil {
		wa.ticker.Stop()
	}
	close(wa.stopCh)
	wa.wg.Wait()
	wa.logger.Info("Window aggregator stopped")
}

// windowRotationLoop 窗口轮转循环
func (wa *WindowAggregator) windowRotationLoop() {
	defer wa.wg.Done()
	
	for {
		select {
		case <-wa.stopCh:
			return
		case <-wa.ticker.C:
			wa.rotateWindows()
		}
	}
}

// rotateWindows 轮转所有窗口
func (wa *WindowAggregator) rotateWindows() {
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	now := time.Now()
	for pointID, window := range wa.windows {
		// 检查窗口是否过期
		if now.Sub(window.StartTime) >= wa.config.Window {
			wa.logger.Debug("Window expired", "point_id", pointID, "count", len(window.Values))
			// 这里可以选择保留过期窗口供后续聚合，或清理
			// 目前策略：清空窗口，重新累积
			window.Values = window.Values[:0]
			window.StartTime = now
		}
	}
}

// Add 添加数据点到聚合窗口
func (wa *WindowAggregator) Add(pointID string, point DataPoint) error {
	if !wa.config.Enabled {
		return nil
	}
	
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	window, exists := wa.windows[pointID]
	if !exists {
		// 创建新窗口
		window = &DataWindow{
			PointID:   pointID,
			Values:    make([]DataPoint, 0),
			StartTime: time.Now(),
			Function:  wa.config.Function,
		}
		wa.windows[pointID] = window
	}
	
	// 添加数据点
	window.Values = append(window.Values, point)
	
	return nil
}

// Aggregate 立即聚合指定数据点
func (wa *WindowAggregator) Aggregate(pointID string) (*AggregatedPoint, error) {
	if !wa.config.Enabled {
		return nil, fmt.Errorf("aggregator is disabled")
	}
	
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	window, exists := wa.windows[pointID]
	if !exists || len(window.Values) == 0 {
		return nil, fmt.Errorf("no data for point: %s", pointID)
	}
	
	// 执行聚合
	result := wa.aggregateWindow(window)
	
	// 清空窗口
	window.Values = window.Values[:0]
	window.StartTime = time.Now()
	
	return result, nil
}

// AggregateAll 聚合所有数据点
func (wa *WindowAggregator) AggregateAll() []*AggregatedPoint {
	if !wa.config.Enabled {
		return nil
	}
	
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	var results []*AggregatedPoint
	for pointID, window := range wa.windows {
		if len(window.Values) == 0 {
			continue
		}
		
		result := wa.aggregateWindow(window)
		results = append(results, result)
		
		// 清空窗口
		window.Values = window.Values[:0]
		window.StartTime = time.Now()
		
		wa.logger.Debug("Aggregated point", "point_id", pointID, "count", result.Count, "value", result.Value)
	}
	
	return results
}

// aggregateWindow 执行窗口聚合
func (wa *WindowAggregator) aggregateWindow(window *DataWindow) *AggregatedPoint {
	values := make([]float64, len(window.Values))
	for i, dp := range window.Values {
		values[i] = dp.Value
	}
	
	result := &AggregatedPoint{
		Timestamp: window.Values[len(window.Values)-1].Timestamp,
		Count:     len(window.Values),
		Function:  string(window.Function),
	}
	
	switch window.Function {
	case AggregationAvg:
		result.Value = calculateAvg(values)
		result.Avg = result.Value
	case AggregationSum:
		result.Value = calculateSum(values)
	case AggregationMax:
		result.Value = calculateMax(values)
		result.Max = result.Value
	case AggregationMin:
		result.Value = calculateMin(values)
		result.Min = result.Value
	case AggregationCount:
		result.Value = float64(len(values))
	case AggregationFirst:
		result.Value = values[0]
	case AggregationLast:
		result.Value = values[len(values)-1]
	default:
		result.Value = calculateAvg(values)
	}
	
	// 计算统计值
	if window.Function != AggregationMin && window.Function != AggregationMax {
		result.Min = calculateMin(values)
		result.Max = calculateMax(values)
		result.Avg = calculateAvg(values)
	}
	
	return result
}

// GetWindowStats 获取窗口统计信息
func (wa *WindowAggregator) GetWindowStats(pointID string) (map[string]interface{}, error) {
	wa.mu.RLock()
	defer wa.mu.RUnlock()
	
	window, exists := wa.windows[pointID]
	if !exists {
		return nil, fmt.Errorf("window not found for point: %s", pointID)
	}
	
	return map[string]interface{}{
		"point_id":    pointID,
		"count":       len(window.Values),
		"start_time":  window.StartTime,
		"window_size": wa.config.Window,
		"function":    window.Function,
	}, nil
}

// RemoveWindow 移除数据点窗口
func (wa *WindowAggregator) RemoveWindow(pointID string) {
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	delete(wa.windows, pointID)
}

// UpdateConfig 更新聚合配置
func (wa *WindowAggregator) UpdateConfig(config AggregationConfig) {
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	// 如果窗口大小改变，重置所有窗口
	if config.Window != wa.config.Window {
		wa.windows = make(map[string]*DataWindow)
	}
	
	wa.config = config
	
	// 更新所有窗口的聚合函数
	for _, window := range wa.windows {
		window.Function = config.Function
	}
	
	wa.logger.Info("Aggregator config updated", "window", config.Window, "function", config.Function)
}

// Reset 重置聚合器
func (wa *WindowAggregator) Reset() {
	wa.mu.Lock()
	defer wa.mu.Unlock()
	
	wa.windows = make(map[string]*DataWindow)
	wa.logger.Info("Aggregator reset")
}

// calculateAvg 计算平均值
func calculateAvg(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return calculateSum(values) / float64(len(values))
}

// calculateSum 计算总和
func calculateSum(values []float64) float64 {
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum
}

// calculateMax 计算最大值
func calculateMax(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values[1:] {
		if v > max {
			max = v
		}
	}
	return max
}

// calculateMin 计算最小值
func calculateMin(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	min := values[0]
	for _, v := range values[1:] {
		if v < min {
			min = v
		}
	}
	return min
}