// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ProcessedData 处理后的数据
type ProcessedData struct {
	PointID       string          `json:"point_id"`
	Timestamp     time.Time       `json:"timestamp"`
	Value         float64         `json:"value"`
	Quality       int             `json:"quality"`
	IsCompressed  bool            `json:"is_compressed"`
	IsAggregated  bool            `json:"is_aggregated"`
	OriginalCount int             `json:"original_count,omitempty"`
	Alerts        []*AlertEvent   `json:"alerts,omitempty"`
}

// PipelineConfig 管道配置
type PipelineConfig struct {
	CompressionEnabled  bool
	CompressionConfig   CompressionConfig
	AggregationEnabled  bool
	AggregationConfig   AggregationConfig
	AlertEnabled        bool
}

// DataProcessingPipeline 数据预处理管道
type DataProcessingPipeline struct {
	config      PipelineConfig
	compressor  *DataCompressor
	aggregator  *WindowAggregator
	alertEngine *AlertEngine
	alertCache  *AlertCacheManager
	
	logger      interface {
		Debug(msg string, keysAndValues ...interface{})
		Info(msg string, keysAndValues ...interface{})
		Warn(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
	}
	
	// 输出回调
	outputHandlers []ProcessedDataHandler
	
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
}

// ProcessedDataHandler 处理后的数据处理函数
type ProcessedDataHandler func(data *ProcessedData)

// NewDataProcessingPipeline 创建数据预处理管道
func NewDataProcessingPipeline(
	config PipelineConfig,
	alertCache *AlertCacheManager,
	logger interface {
		Debug(msg string, keysAndValues ...interface{})
		Info(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
	},
) *DataProcessingPipeline {
	ctx, cancel := context.WithCancel(context.Background())
	
	pipeline := &DataProcessingPipeline{
		config:         config,
		alertCache:     alertCache,
		logger:         logger,
		outputHandlers: make([]ProcessedDataHandler, 0),
		ctx:            ctx,
		cancel:         cancel,
	}
	
	// 初始化组件
	if config.CompressionEnabled {
		pipeline.compressor = NewDataCompressor(config.CompressionConfig, logger)
	}
	
	if config.AggregationEnabled {
		pipeline.aggregator = NewWindowAggregator(config.AggregationConfig, logger)
	}
	
	if config.AlertEnabled {
		pipeline.alertEngine = NewAlertEngine(logger)
	}
	
	return pipeline
}

// Start 启动管道
func (p *DataProcessingPipeline) Start() {
	if p.aggregator != nil {
		p.aggregator.Start()
	}
	
	if p.alertEngine != nil {
		p.alertEngine.Start()
		// 注册告警事件处理器
		p.alertEngine.RegisterEventHandler(p.handleAlertEvent)
	}
	
	p.logger.Info("Data processing pipeline started")
}

// Stop 停止管道
func (p *DataProcessingPipeline) Stop() {
	p.cancel()
	
	if p.aggregator != nil {
		p.aggregator.Stop()
	}
	
	if p.alertEngine != nil {
		p.alertEngine.Stop()
	}
	
	p.logger.Info("Data processing pipeline stopped")
}

// Process 处理数据点
func (p *DataProcessingPipeline) Process(pointID string, point DataPoint) (*ProcessedData, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	// 1. 聚合处理
	if p.aggregator != nil && p.config.AggregationEnabled {
		if err := p.aggregator.Add(pointID, point); err != nil {
			p.logger.Error("Failed to add to aggregator", "error", err)
		}
	}
	
	// 2. 压缩处理
	var processed *ProcessedData
	if p.compressor != nil && p.config.CompressionEnabled {
		compressed, sent := p.compressor.Compress(pointID, point)
		if !sent {
			// 数据被压缩，不发送
			p.logger.Debug("Data compressed", "point_id", pointID)
			
			// 但仍需检查告警
			if p.alertEngine != nil && p.config.AlertEnabled {
				p.checkAlerts(pointID, point)
			}
			return nil, nil
		}
		
		processed = &ProcessedData{
			PointID:       pointID,
			Timestamp:     compressed.Timestamp,
			Value:         compressed.Value,
			Quality:       point.Quality,
			IsCompressed:  true,
			OriginalCount: compressed.OriginalCount,
		}
	} else {
		// 不压缩，直接通过
		processed = &ProcessedData{
			PointID:   pointID,
			Timestamp: point.Timestamp,
			Value:     point.Value,
			Quality:   point.Quality,
		}
	}
	
	// 3. 告警检查
	if p.alertEngine != nil && p.config.AlertEnabled {
		alerts := p.checkAlerts(pointID, point)
		processed.Alerts = alerts
	}
	
	// 4. 输出处理
	p.output(processed)
	
	return processed, nil
}

// ProcessBatch 批量处理
func (p *DataProcessingPipeline) ProcessBatch(pointID string, points []DataPoint) ([]*ProcessedData, error) {
	var results []*ProcessedData
	
	for _, point := range points {
		processed, err := p.Process(pointID, point)
		if err != nil {
			p.logger.Error("Failed to process point", "error", err)
			continue
		}
		if processed != nil {
			results = append(results, processed)
		}
	}
	
	return results, nil
}

// checkAlerts 检查告警
func (p *DataProcessingPipeline) checkAlerts(pointID string, point DataPoint) []*AlertEvent {
	events, err := p.alertEngine.Evaluate(pointID, point)
	if err != nil {
		p.logger.Error("Failed to evaluate alerts", "error", err)
		return nil
	}
	
	// 缓存告警
	for _, event := range events {
		if p.alertCache != nil {
			if err := p.alertCache.SaveAlert(event); err != nil {
				p.logger.Error("Failed to cache alert", "error", err)
			}
		}
	}
	
	return events
}

// handleAlertEvent 处理告警事件
func (p *DataProcessingPipeline) handleAlertEvent(event *AlertEvent) {
	p.logger.Info("Alert event", 
		"rule_id", event.RuleID,
		"type", event.EventType,
		"severity", event.Severity)
}

// Flush 强制刷新
func (p *DataProcessingPipeline) Flush() []*ProcessedData {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	var results []*ProcessedData
	
	// 刷新压缩器
	if p.compressor != nil {
		compressedPoints := p.compressor.FlushAll()
		for _, cp := range compressedPoints {
			results = append(results, &ProcessedData{
				PointID:       cp.Timestamp.String(), // 使用临时ID
				Timestamp:     cp.Timestamp,
				Value:         cp.Value,
				IsCompressed:  true,
				OriginalCount: cp.OriginalCount,
			})
		}
	}
	
	// 刷新聚合器
	if p.aggregator != nil {
		aggregatedPoints := p.aggregator.AggregateAll()
		for _, ap := range aggregatedPoints {
			results = append(results, &ProcessedData{
				PointID:      ap.Timestamp.String(),
				Timestamp:    ap.Timestamp,
				Value:        ap.Value,
				IsAggregated: true,
			})
		}
	}
	
	return results
}

// output 输出处理后的数据
func (p *DataProcessingPipeline) output(data *ProcessedData) {
	for _, handler := range p.outputHandlers {
		go handler(data)
	}
}

// RegisterOutputHandler 注册输出处理器
func (p *DataProcessingPipeline) RegisterOutputHandler(handler ProcessedDataHandler) {
	p.outputHandlers = append(p.outputHandlers, handler)
}

// AddAlertRule 添加告警规则
func (p *DataProcessingPipeline) AddAlertRule(rule *EdgeAlertRule) error {
	if p.alertEngine == nil {
		return fmt.Errorf("alert engine not initialized")
	}
	
	return p.alertEngine.AddRule(rule)
}

// RemoveAlertRule 移除告警规则
func (p *DataProcessingPipeline) RemoveAlertRule(ruleID string) {
	if p.alertEngine != nil {
		p.alertEngine.RemoveRule(ruleID)
	}
}

// UpdateConfig 更新配置
func (p *DataProcessingPipeline) UpdateConfig(config PipelineConfig) {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	p.config = config
	
	if p.compressor != nil {
		p.compressor.UpdateConfig(config.CompressionConfig)
	}
	
	if p.aggregator != nil {
		p.aggregator.UpdateConfig(config.AggregationConfig)
	}
}

// GetStats 获取统计信息
func (p *DataProcessingPipeline) GetStats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	stats := map[string]interface{}{
		"compression_enabled": p.config.CompressionEnabled,
		"aggregation_enabled": p.config.AggregationEnabled,
		"alert_enabled":       p.config.AlertEnabled,
	}
	
	if p.alertEngine != nil {
		stats["alert_rules"] = len(p.alertEngine.GetAllRules())
	}
	
	return stats
}