package services

import (
	"context"
	"testing"
	"time"
)

func TestPerformanceOptimizer(t *testing.T) {
	config := DefaultPerformanceConfig()
	optimizer := NewPerformanceOptimizer(config)
	
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
	
	// 测试连接优化
	err = optimizer.OptimizeConnections()
	if err != nil {
		t.Errorf("Connection optimization failed: %v", err)
	}
	
	// 测试缓存优化
	err = optimizer.OptimizeCache()
	if err != nil {
		t.Errorf("Cache optimization failed: %v", err)
	}
	
	// 测试获取优化建议
	recommendations := optimizer.GetOptimizationRecommendations()
	if recommendations == nil {
		t.Error("Expected recommendations, got nil")
	}
	
	// 测试停止
	err = optimizer.Stop()
	if err != nil {
		t.Errorf("Failed to stop optimizer: %v", err)
	}
}

func TestMemoryManager(t *testing.T) {
	config := DefaultPerformanceConfig()
	manager := NewMemoryManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := manager.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start memory manager: %v", err)
	}
	
	// 测试获取缓冲区
	buffer := manager.GetBuffer(1024)
	if len(buffer) != 1024 {
		t.Errorf("Expected buffer size 1024, got %d", len(buffer))
	}
	
	// 测试归还缓冲区
	manager.PutBuffer(buffer)
	
	// 测试获取映射
	m := manager.GetMap()
	if m == nil {
		t.Error("Expected map, got nil")
	}
	
	// 测试归还映射
	manager.PutMap(m)
	
	// 测试获取切片
	slice := manager.GetSlice()
	if slice == nil {
		t.Error("Expected slice, got nil")
	}
	
	// 测试归还切片
	manager.PutSlice(slice)
	
	// 测试优化
	err = manager.Optimize()
	if err != nil {
		t.Errorf("Memory optimization failed: %v", err)
	}
	
	// 测试获取统计信息
	stats := manager.GetMemoryStats()
	if stats == nil {
		t.Error("Expected memory stats, got nil")
	}
	
	// 测试停止
	manager.Stop()
}

func TestConnectionPoolManager(t *testing.T) {
	config := DefaultPerformanceConfig()
	manager := NewConnectionPoolManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := manager.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start connection pool manager: %v", err)
	}
	
	// 测试创建连接池
	factory := func() (interface{}, error) {
		return "test-connection", nil
	}
	cleanup := func(conn interface{}) error {
		return nil
	}
	validate := func(conn interface{}) bool {
		return conn != nil
	}
	
	err = manager.CreatePool("test-pool", factory, cleanup, validate)
	if err != nil {
		t.Errorf("Failed to create pool: %v", err)
	}
	
	// 测试获取连接
	conn, err := manager.GetConnection("test-pool")
	if err != nil {
		t.Errorf("Failed to get connection: %v", err)
	}
	
	// 测试归还连接
	err = manager.PutConnection("test-pool", conn)
	if err != nil {
		t.Errorf("Failed to put connection: %v", err)
	}
	
	// 测试获取连接数
	activeCount := manager.GetActiveCount()
	if activeCount < 0 {
		t.Errorf("Invalid active count: %d", activeCount)
	}
	
	idleCount := manager.GetIdleCount()
	if idleCount < 0 {
		t.Errorf("Invalid idle count: %d", idleCount)
	}
	
	// 测试优化
	err = manager.Optimize()
	if err != nil {
		t.Errorf("Connection pool optimization failed: %v", err)
	}
	
	// 测试获取指标
	metrics := manager.GetMetrics()
	if metrics == nil {
		t.Error("Expected metrics, got nil")
	}
	
	// 测试停止
	manager.Stop()
}

func TestCacheManager(t *testing.T) {
	config := DefaultPerformanceConfig()
	manager := NewCacheManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := manager.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start cache manager: %v", err)
	}
	
	// 测试设置缓存
	err = manager.Set("test-key", "test-value", 1*time.Hour)
	if err != nil {
		t.Errorf("Failed to set cache: %v", err)
	}
	
	// 测试获取缓存
	value, found := manager.Get("test-key")
	if !found {
		t.Error("Expected to find cached value")
	}
	if value != "test-value" {
		t.Errorf("Expected 'test-value', got %v", value)
	}
	
	// 测试获取不存在的键
	_, found = manager.Get("non-existent-key")
	if found {
		t.Error("Expected not to find non-existent key")
	}
	
	// 测试删除缓存
	manager.Delete("test-key")
	_, found = manager.Get("test-key")
	if found {
		t.Error("Expected key to be deleted")
	}
	
	// 测试缓存大小
	size := manager.GetSize()
	if size < 0 {
		t.Errorf("Invalid cache size: %d", size)
	}
	
	// 测试命中率
	hitRate := manager.GetHitRate()
	if hitRate < 0 || hitRate > 1 {
		t.Errorf("Invalid hit rate: %f", hitRate)
	}
	
	// 测试获取统计信息
	stats := manager.GetStats()
	if stats == nil {
		t.Error("Expected cache stats, got nil")
	}
	
	// 测试优化
	err = manager.Optimize()
	if err != nil {
		t.Errorf("Cache optimization failed: %v", err)
	}
	
	// 测试清空缓存
	manager.Clear()
	size = manager.GetSize()
	if size != 0 {
		t.Errorf("Expected cache size 0 after clear, got %d", size)
	}
	
	// 测试停止
	manager.Stop()
}

func TestAutoTuner(t *testing.T) {
	config := DefaultPerformanceConfig()
	tuner := NewAutoTuner(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := tuner.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start auto tuner: %v", err)
	}
	
	// 测试添加性能数据
	metrics := &PerformanceMetrics{
		CPUUsage:     50.0,
		MemoryUsage:  60.0,
		ResponseTime: 1500.0,
		Throughput:   100.0,
		ErrorRate:    0.01,
		Timestamp:    time.Now(),
	}
	
	tuner.AddPerformanceData(metrics)
	
	// 测试获取性能趋势
	trends := tuner.GetPerformanceTrend()
	if trends == nil {
		t.Error("Expected performance trends, got nil")
	}
	
	// 测试停止
	tuner.Stop()
}

func BenchmarkMemoryManager_GetBuffer(b *testing.B) {
	config := DefaultPerformanceConfig()
	manager := NewMemoryManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	manager.Start(ctx)
	defer manager.Stop()
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		buffer := manager.GetBuffer(1024)
		manager.PutBuffer(buffer)
	}
}

func BenchmarkCacheManager_SetGet(b *testing.B) {
	config := DefaultPerformanceConfig()
	manager := NewCacheManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	manager.Start(ctx)
	defer manager.Stop()
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("key-%d", i)
		value := fmt.Sprintf("value-%d", i)
		
		manager.Set(key, value, 1*time.Hour)
		manager.Get(key)
	}
}