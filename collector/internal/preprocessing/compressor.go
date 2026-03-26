// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// CompressionAlgorithm 压缩算法类型
type CompressionAlgorithm string

const (
	// CompressionDeadband 死区压缩
	CompressionDeadband CompressionAlgorithm = "deadband"
	// CompressionSwingingDoor 摆动门压缩
	CompressionSwingingDoor CompressionAlgorithm = "swinging_door"
)

// DataPoint 数据点
type DataPoint struct {
	Timestamp time.Time
	Value     float64
	Quality   int // 数据质量标志
}

// CompressedPoint 压缩后的数据点
type CompressedPoint struct {
	Timestamp    time.Time       `json:"timestamp"`
	Value        float64         `json:"value"`
	OriginalCount int            `json:"original_count"` // 原始数据点数量
	Algorithm    string          `json:"algorithm"`
	IsKeyframe   bool            `json:"is_keyframe"` // 是否关键帧
}

// CompressionConfig 压缩配置
type CompressionConfig struct {
	Algorithm   CompressionAlgorithm
	Threshold   float64       // 死区阈值或摆动门偏差
	MinInterval time.Duration // 最小上报间隔
	MaxInterval time.Duration // 最大上报间隔
}

// DataCompressor 数据压缩器
type DataCompressor struct {
	config      CompressionConfig
	logger      interface {
		Debug(msg string, keysAndValues ...interface{})
		Info(msg string, keysAndValues ...interface{})
	}
	
	// 每个数据点的压缩状态
	states      map[string]*CompressionState
	mu          sync.RWMutex
}

// CompressionState 压缩状态
type CompressionState struct {
	PointID       string
	LastSent      *DataPoint      // 上次发送的数据点
	Pending       *DataPoint      // 待发送的数据点
	Buffer        []*DataPoint    // 摆动门缓冲区
	LastSentTime  time.Time       // 上次发送时间
	Algorithm     CompressionAlgorithm
	Threshold     float64
}

// NewDataCompressor 创建数据压缩器
func NewDataCompressor(config CompressionConfig, logger interface {
	Debug(msg string, keysAndValues ...interface{})
	Info(msg string, keysAndValues ...interface{})
}) *DataCompressor {
	return &DataCompressor{
		config: config,
		logger: logger,
		states: make(map[string]*CompressionState),
	}
}

// Compress 压缩单个数据点
func (dc *DataCompressor) Compress(pointID string, point DataPoint) (*CompressedPoint, bool) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	state, exists := dc.states[pointID]
	if !exists {
		// 首次数据点，直接发送并创建状态
		state = &CompressionState{
			PointID:      pointID,
			LastSent:     &point,
			LastSentTime: time.Now(),
			Algorithm:    dc.config.Algorithm,
			Threshold:    dc.config.Threshold,
		}
		dc.states[pointID] = state
		
		return &CompressedPoint{
			Timestamp:     point.Timestamp,
			Value:         point.Value,
			OriginalCount: 1,
			Algorithm:     string(dc.config.Algorithm),
			IsKeyframe:    true,
		}, true
	}
	
	// 检查最大间隔
	if time.Since(state.LastSentTime) >= dc.config.MaxInterval {
		// 超过最大间隔，强制发送
		result := &CompressedPoint{
			Timestamp:     point.Timestamp,
			Value:         point.Value,
			OriginalCount: 1,
			Algorithm:     string(dc.config.Algorithm),
			IsKeyframe:    true,
		}
		state.LastSent = &point
		state.LastSentTime = time.Now()
		return result, true
	}
	
	// 根据算法进行压缩
	switch dc.config.Algorithm {
	case CompressionDeadband:
		return dc.compressDeadband(state, point)
	case CompressionSwingingDoor:
		return dc.compressSwingingDoor(state, point)
	default:
		// 未知算法，直接发送
		return &CompressedPoint{
			Timestamp:     point.Timestamp,
			Value:         point.Value,
			OriginalCount: 1,
			Algorithm:     "none",
			IsKeyframe:    true,
		}, true
	}
}

// compressDeadband 死区压缩
func (dc *DataCompressor) compressDeadband(state *CompressionState, point DataPoint) (*CompressedPoint, bool) {
	// 计算与上次发送值的偏差
	diff := math.Abs(point.Value - state.LastSent.Value)
	
	if diff >= dc.config.Threshold {
		// 超过阈值，发送数据
		result := &CompressedPoint{
			Timestamp:     point.Timestamp,
			Value:         point.Value,
			OriginalCount: 1,
			Algorithm:     string(CompressionDeadband),
			IsKeyframe:    true,
		}
		state.LastSent = &point
		state.LastSentTime = time.Now()
		
		dc.logger.Debug("Deadband compression: value exceeded threshold",
			"point_id", state.PointID,
			"value", point.Value,
			"last_sent", state.LastSent.Value,
			"diff", diff)
		
		return result, true
	}
	
	// 在死区内，缓存但不发送
	state.Pending = &point
	return nil, false
}

// compressSwingingDoor 摆动门压缩
func (dc *DataCompressor) compressSwingingDoor(state *CompressionState, point DataPoint) (*CompressedPoint, bool) {
	// 如果是第一个缓冲区点
	if len(state.Buffer) == 0 {
		state.Buffer = append(state.Buffer, state.LastSent)
		state.Buffer = append(state.Buffer, &point)
		return nil, false
	}
	
	// 获取缓冲区第一个点（锚点）
	anchor := state.Buffer[0]
	
	// 计算当前值是否在新门内
	// 计算两个门的斜率
	firstSlope := (state.Buffer[1].Value - anchor.Value + dc.config.Threshold) /
		float64(state.Buffer[1].Timestamp.Sub(anchor.Timestamp).Milliseconds())
	secondSlope := (state.Buffer[1].Value - anchor.Value - dc.config.Threshold) /
		float64(state.Buffer[1].Timestamp.Sub(anchor.Timestamp).Milliseconds())
	
	// 计算当前点与锚点的斜率
	currentSlope := (point.Value - anchor.Value) /
		float64(point.Timestamp.Sub(anchor.Timestamp).Milliseconds())
	
	// 如果当前点在任何一扇门外
	if currentSlope > firstSlope || currentSlope < secondSlope {
		// 发送缓冲区的最后一个点
		lastBuffered := state.Buffer[len(state.Buffer)-1]
		result := &CompressedPoint{
			Timestamp:     lastBuffered.Timestamp,
			Value:         lastBuffered.Value,
			OriginalCount: len(state.Buffer),
			Algorithm:     string(CompressionSwingingDoor),
			IsKeyframe:    true,
		}
		
		// 重置缓冲区
		state.LastSent = lastBuffered
		state.LastSentTime = time.Now()
		state.Buffer = []*DataPoint{lastBuffered, &point}
		
		dc.logger.Debug("Swinging door compression: new point outside door",
			"point_id", state.PointID,
			"buffered_count", result.OriginalCount)
		
		return result, true
	}
	
	// 在门内，加入缓冲区
	state.Buffer = append(state.Buffer, &point)
	
	// 检查缓冲区大小限制，防止内存无限增长
	if len(state.Buffer) > 1000 {
		// 强制发送并清理
		lastBuffered := state.Buffer[len(state.Buffer)-1]
		result := &CompressedPoint{
			Timestamp:     lastBuffered.Timestamp,
			Value:         lastBuffered.Value,
			OriginalCount: len(state.Buffer),
			Algorithm:     string(CompressionSwingingDoor),
			IsKeyframe:    true,
		}
		state.LastSent = lastBuffered
		state.LastSentTime = time.Now()
		state.Buffer = []*DataPoint{lastBuffered}
		return result, true
	}
	
	return nil, false
}

// Flush 强制刷新指定数据点的缓存
func (dc *DataCompressor) Flush(pointID string) *CompressedPoint {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	state, exists := dc.states[pointID]
	if !exists {
		return nil
	}
	
	// 根据算法刷新
	switch state.Algorithm {
	case CompressionDeadband:
		return dc.flushDeadband(state)
	case CompressionSwingingDoor:
		return dc.flushSwingingDoor(state)
	default:
		return nil
	}
}

// flushDeadband 刷新死区压缩
func (dc *DataCompressor) flushDeadband(state *CompressionState) *CompressedPoint {
	if state.Pending == nil {
		return nil
	}
	
	result := &CompressedPoint{
		Timestamp:     state.Pending.Timestamp,
		Value:         state.Pending.Value,
		OriginalCount: 1,
		Algorithm:     string(CompressionDeadband),
		IsKeyframe:    false,
	}
	
	state.LastSent = state.Pending
	state.LastSentTime = time.Now()
	state.Pending = nil
	
	return result
}

// flushSwingingDoor 刷新摆动门压缩
func (dc *DataCompressor) flushSwingingDoor(state *CompressionState) *CompressedPoint {
	if len(state.Buffer) <= 1 {
		return nil
	}
	
	lastBuffered := state.Buffer[len(state.Buffer)-1]
	result := &CompressedPoint{
		Timestamp:     lastBuffered.Timestamp,
		Value:         lastBuffered.Value,
		OriginalCount: len(state.Buffer),
		Algorithm:     string(CompressionSwingingDoor),
		IsKeyframe:    false,
	}
	
	state.LastSent = lastBuffered
	state.LastSentTime = time.Now()
	state.Buffer = []*DataPoint{lastBuffered}
	
	return result
}

// FlushAll 刷新所有数据点的缓存
func (dc *DataCompressor) FlushAll() []*CompressedPoint {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	var results []*CompressedPoint
	for pointID := range dc.states {
		if point := dc.flushByID(pointID); point != nil {
			results = append(results, point)
		}
	}
	return results
}

// flushByID 根据ID刷新（内部使用，已加锁）
func (dc *DataCompressor) flushByID(pointID string) *CompressedPoint {
	state := dc.states[pointID]
	if state == nil {
		return nil
	}
	
	switch state.Algorithm {
	case CompressionDeadband:
		return dc.flushDeadband(state)
	case CompressionSwingingDoor:
		return dc.flushSwingingDoor(state)
	}
	return nil
}

// CheckMaxInterval 检查是否超过最大间隔需要强制上报
func (dc *DataCompressor) CheckMaxInterval(pointID string) (*CompressedPoint, bool) {
	dc.mu.RLock()
	state, exists := dc.states[pointID]
	if !exists {
		dc.mu.RUnlock()
		return nil, false
	}
	
	if time.Since(state.LastSentTime) < dc.config.MaxInterval {
		dc.mu.RUnlock()
		return nil, false
	}
	dc.mu.RUnlock()
	
	// 需要强制刷新
	return dc.Flush(pointID), true
}

// GetState 获取数据点的压缩状态
func (dc *DataCompressor) GetState(pointID string) (*CompressionState, error) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	
	state, exists := dc.states[pointID]
	if !exists {
		return nil, fmt.Errorf("compression state not found for point: %s", pointID)
	}
	
	return state, nil
}

// RemoveState 移除数据点的压缩状态
func (dc *DataCompressor) RemoveState(pointID string) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	delete(dc.states, pointID)
}

// GetCompressionRatio 获取压缩比率
func (dc *DataCompressor) GetCompressionRatio(pointID string) float64 {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	
	state, exists := dc.states[pointID]
	if !exists || state.LastSent == nil {
		return 1.0
	}
	
	// 计算压缩比（实际发送数/总数据点数）
	// 这里简化计算，实际应该基于历史统计
	return 0.5 // 默认值
}

// Reset 重置压缩器
func (dc *DataCompressor) Reset() {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	dc.states = make(map[string]*CompressionState)
	dc.logger.Info("Compressor reset")
}

// UpdateConfig 更新压缩配置
func (dc *DataCompressor) UpdateConfig(config CompressionConfig) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	
	dc.config = config
	
	// 更新所有状态的配置
	for _, state := range dc.states {
		state.Algorithm = config.Algorithm
		state.Threshold = config.Threshold
	}
	
	dc.logger.Info("Compressor config updated", 
		"algorithm", config.Algorithm,
		"threshold", config.Threshold)
}