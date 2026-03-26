package performance

import (
	"context"
	"testing"
	"time"
)

func TestCollectorOptimizer(t *testing.T) {
	config := DefaultOptimizerConfig()
	optimizer := NewCollectorOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// 测试启动
	err := optimizer.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start optimizer: %v", err)
	}
	
	// 测试获取指标
	metrics := optimizer.GetMetrics()
	if metrics == nil {
		t.Error("Expected metrics, got nil")
	}
	
	// 测试内存优化
	err = optimizer.OptimizeMemory()
	if err != nil {
		t.Errorf("Memory optimization failed: %v", err)
	}
	
	// 测试缓冲区优化
	err = optimizer.OptimizeBuffer()
	if err != nil {
		t.Errorf("Buffer optimization failed: %v", err)
	}
	
	// 测试网络优化
	err = optimizer.OptimizeNetwork()
	if err != nil {
		t.Errorf("Network optimization failed: %v", err)
	}
	
	// 测试获取优化建议
	recommendations := optimizer.GetOptimizationRecommendations()
	if recommendations == nil {
		t.Error("Expected recommendations, got nil")
	}
	
	// 测试获取系统信息
	sysInfo := optimizer.GetSystemInfo()
	if sysInfo == nil {
		t.Error("Expected system info, got nil")
	}
	
	// 测试更新配置
	newConfig := DefaultOptimizerConfig()
	newConfig.MaxMemoryUsage = 0.9
	err = optimizer.UpdateConfig(newConfig)
	if err != nil {
		t.Errorf("Failed to update config: %v", err)
	}
	
	// 测试停止
	err = optimizer.Stop()
	if err != nil {
		t.Errorf("Failed to stop optimizer: %v", err)
	}
}

func TestMemoryOptimizer(t *testing.T) {
	config := DefaultOptimizerConfig()
	optimizer := NewMemoryOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := optimizer.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start memory optimizer: %v", err)
	}
	
	// 测试获取缓冲区
	buffer := optimizer.GetBuffer(1024)
	if len(buffer) != 1024 {
		t.Errorf("Expected buffer size 1024, got %d", len(buffer))
	}
	
	// 测试归还缓冲区
	optimizer.PutBuffer(buffer)
	
	// 测试获取数据点切片
	slice := optimizer.GetDataPointSlice()
	if slice == nil {
		t.Error("Expected slice, got nil")
	}
	
	// 测试归还数据点切片
	optimizer.PutDataPointSlice(slice)
	
	// 测试获取映射
	m := optimizer.GetMap()
	if m == nil {
		t.Error("Expected map, got nil")
	}
	
	// 测试归还映射
	optimizer.PutMap(m)
	
	// 测试获取协议数据
	protocolData := optimizer.GetProtocolData()
	if protocolData == nil {
		t.Error("Expected protocol data, got nil")
	}
	
	// 测试归还协议数据
	optimizer.PutProtocolData(protocolData)
	
	// 测试优化
	err = optimizer.Optimize()
	if err != nil {
		t.Errorf("Memory optimization failed: %v", err)
	}
	
	// 测试获取统计信息
	stats := optimizer.GetMemoryStats()
	if stats == nil {
		t.Error("Expected memory stats, got nil")
	}
	
	// 测试获取池统计
	poolStats := optimizer.GetPoolStats()
	if poolStats == nil {
		t.Error("Expected pool stats, got nil")
	}
	
	// 测试停止
	optimizer.Stop()
}

func TestBufferOptimizer(t *testing.T) {
	config := DefaultOptimizerConfig()
	optimizer := NewBufferOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := optimizer.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start buffer optimizer: %v", err)
	}
	
	// 测试创建缓冲区
	flushCallback := func(data []interface{}) error {
		// 模拟数据处理
		return nil
	}
	
	err = optimizer.CreateBuffer("test-buffer", 100, flushCallback)
	if err != nil {
		t.Errorf("Failed to create buffer: %v", err)
	}
	
	// 测试写入数据
	for i := 0; i < 10; i++ {
		err = optimizer.Write("test-buffer", map[string]interface{}{
			"id":    i,
			"value": float64(i * 10),
		})
		if err != nil {
			t.Errorf("Failed to write data: %v", err)
		}
	}
	
	// 测试获取使用率
	usage := optimizer.GetUsage()
	if usage < 0 || usage > 1 {
		t.Errorf("Invalid usage: %f", usage)
	}
	
	// 测试刷新缓冲区
	err = optimizer.Flush("test-buffer")
	if err != nil {
		t.Errorf("Failed to flush buffer: %v", err)
	}
	
	// 测试刷新所有缓冲区
	err = optimizer.FlushAll()
	if err != nil {
		t.Errorf("Failed to flush all buffers: %v", err)
	}
	
	// 测试优化
	err = optimizer.Optimize()
	if err != nil {
		t.Errorf("Buffer optimization failed: %v", err)
	}
	
	// 测试获取指标
	metrics := optimizer.GetMetrics()
	if metrics == nil {
		t.Error("Expected metrics, got nil")
	}
	
	// 测试停止
	optimizer.Stop()
}

func TestNetworkOptimizer(t *testing.T) {
	config := DefaultOptimizerConfig()
	optimizer := NewNetworkOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := optimizer.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start network optimizer: %v", err)
	}
	
	// 测试获取HTTP客户端
	client := optimizer.GetHTTPClient()
	if client == nil {
		t.Error("Expected HTTP client, got nil")
	}
	
	// 测试获取连接数
	count := optimizer.GetConnectionCount()
	if count < 0 {
		t.Errorf("Invalid connection count: %d", count)
	}
	
	// 测试优化
	err = optimizer.Optimize()
	if err != nil {
		t.Errorf("Network optimization failed: %v", err)
	}
	
	// 测试获取指标
	metrics := optimizer.GetNetrics()
	if metrics == nil {
		t.Error("Expected metrics, got nil")
	}
	
	// 测试停止
	optimizer.Stop()
}

func TestOptimizerConfig(t *testing.T) {
	// 测试默认配置
	config := DefaultOptimizerConfig()
	if config == nil {
		t.Error("Expected default config, got nil")
	}
	
	// 测试配置验证
	err := validateOptimizerConfig(config)
	if err != nil {
		t.Errorf("Default config validation failed: %v", err)
	}
	
	// 测试无效配置
	invalidConfig := &OptimizerConfig{
		MaxMemoryUsage: 1.5, // 无效值
	}
	
	err = validateOptimizerConfig(invalidConfig)
	if err == nil {
		t.Error("Expected validation error for invalid config")
	}
}

func BenchmarkMemoryOptimizer_GetBuffer(b *testing.B) {
	config := DefaultOptimizerConfig()
	optimizer := NewMemoryOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	optimizer.Start(ctx)
	defer optimizer.Stop()
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		buffer := optimizer.GetBuffer(1024)
		optimizer.PutBuffer(buffer)
	}
}

func BenchmarkBufferOptimizer_Write(b *testing.B) {
	config := DefaultOptimizerConfig()
	optimizer := NewBufferOptimizer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	optimizer.Start(ctx)
	defer optimizer.Stop()
	
	// 创建测试缓冲区
	flushCallback := func(data []interface{}) error {
		return nil
	}
	
	optimizer.CreateBuffer("bench-buffer", 10000, flushCallback)
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		data := map[string]interface{}{
			"id":    i,
			"value": float64(i),
		}
		optimizer.Write("bench-buffer", data)
	}
}