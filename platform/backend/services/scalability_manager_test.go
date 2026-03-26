package services

import (
	"context"
	"testing"
	"time"
)

func TestScalabilityManager(t *testing.T) {
	config := DefaultScalabilityConfig()
	manager := NewScalabilityManager(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// 测试启动
	err := manager.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start scalability manager: %v", err)
	}
	
	// 测试服务注册
	service := &ServiceInfo{
		ID:      "test-service-1",
		Name:    "test-service",
		Address: "127.0.0.1",
		Port:    8080,
		Tags:    []string{"test"},
		Meta:    map[string]string{"version": "1.0.0"},
	}
	
	err = manager.RegisterService(service)
	if err != nil {
		t.Errorf("Failed to register service: %v", err)
	}
	
	// 测试服务发现
	services, err := manager.DiscoverServices("test-service")
	if err != nil {
		t.Errorf("Failed to discover services: %v", err)
	}
	
	if len(services) == 0 {
		t.Error("Expected to find registered service")
	}
	
	// 测试获取服务实例
	instance, err := manager.GetServiceInstance("test-service")
	if err != nil {
		t.Errorf("Failed to get service instance: %v", err)
	}
	
	if instance == nil {
		t.Error("Expected service instance, got nil")
	}
	
	// 测试更新健康状态
	err = manager.UpdateServiceHealth("test-service-1", true)
	if err != nil {
		t.Errorf("Failed to update service health: %v", err)
	}
	
	// 测试配置管理
	err = manager.SetConfig("test-key", "test-value")
	if err != nil {
		t.Errorf("Failed to set config: %v", err)
	}
	
	value, err := manager.GetConfig("test-key")
	if err != nil {
		t.Errorf("Failed to get config: %v", err)
	}
	
	if value != "test-value" {
		t.Errorf("Expected 'test-value', got %v", value)
	}
	
	// 测试扩容
	err = manager.ScaleUp("test-service", 2)
	if err != nil {
		t.Errorf("Failed to scale up: %v", err)
	}
	
	// 测试缩容
	err = manager.ScaleDown("test-service", 1)
	if err != nil {
		t.Errorf("Failed to scale down: %v", err)
	}
	
	// 测试获取指标
	metrics := manager.GetMetrics()
	if metrics == nil {
		t.Error("Expected metrics, got nil")
	}
	
	// 测试注销服务
	err = manager.DeregisterService("test-service-1")
	if err != nil {
		t.Errorf("Failed to deregister service: %v", err)
	}
	
	// 测试停止
	err = manager.Stop()
	if err != nil {
		t.Errorf("Failed to stop scalability manager: %v", err)
	}
}

func TestServiceDiscovery(t *testing.T) {
	config := &ServiceDiscoveryConfig{
		Enabled:           true,
		Registry:          "memory",
		HeartbeatInterval: 10 * time.Second,
		TTL:              30 * time.Second,
	}
	
	sd := NewServiceDiscovery(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := sd.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start service discovery: %v", err)
	}
	
	// 测试注册服务
	service := &ServiceInfo{
		ID:      "test-service-1",
		Name:    "test-service",
		Address: "127.0.0.1",
		Port:    8080,
	}
	
	err = sd.RegisterService(service)
	if err != nil {
		t.Errorf("Failed to register service: %v", err)
	}
	
	// 测试发现服务
	services, err := sd.DiscoverServices("test-service")
	if err != nil {
		t.Errorf("Failed to discover services: %v", err)
	}
	
	if len(services) != 1 {
		t.Errorf("Expected 1 service, got %d", len(services))
	}
	
	// 测试更新健康状态
	err = sd.UpdateServiceHealth("test-service-1", false)
	if err != nil {
		t.Errorf("Failed to update service health: %v", err)
	}
	
	// 测试获取统计信息
	stats := sd.GetStats()
	if stats == nil {
		t.Error("Expected stats, got nil")
	}
	
	// 测试注销服务
	err = sd.DeregisterService("test-service-1")
	if err != nil {
		t.Errorf("Failed to deregister service: %v", err)
	}
	
	// 测试停止
	sd.Stop()
}

func TestLoadBalancer(t *testing.T) {
	config := &LoadBalancerConfig{
		Enabled:     true,
		Algorithm:   "round_robin",
		HealthCheck: true,
		Timeout:     30 * time.Second,
	}
	
	lb := NewLoadBalancer(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := lb.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start load balancer: %v", err)
	}
	
	// 测试添加实例
	service1 := &ServiceInfo{
		ID:      "instance-1",
		Name:    "test-service",
		Address: "127.0.0.1",
		Port:    8080,
	}
	
	service2 := &ServiceInfo{
		ID:      "instance-2",
		Name:    "test-service",
		Address: "127.0.0.1",
		Port:    8081,
	}
	
	err = lb.AddInstance("test-service", service1)
	if err != nil {
		t.Errorf("Failed to add instance: %v", err)
	}
	
	err = lb.AddInstance("test-service", service2)
	if err != nil {
		t.Errorf("Failed to add instance: %v", err)
	}
	
	// 测试获取实例
	instance, err := lb.GetInstance("test-service")
	if err != nil {
		t.Errorf("Failed to get instance: %v", err)
	}
	
	if instance == nil {
		t.Error("Expected instance, got nil")
	}
	
	// 测试更新健康状态
	err = lb.UpdateInstanceHealth("test-service", "instance-1", false)
	if err != nil {
		t.Errorf("Failed to update instance health: %v", err)
	}
	
	// 测试记录请求
	lb.RecordRequest("test-service", "instance-1", 100*time.Millisecond, true)
	
	// 测试获取统计信息
	stats := lb.GetStats()
	if stats == nil {
		t.Error("Expected stats, got nil")
	}
	
	// 测试移除实例
	err = lb.RemoveInstance("test-service", "instance-1")
	if err != nil {
		t.Errorf("Failed to remove instance: %v", err)
	}
	
	// 测试停止
	lb.Stop()
}

func TestConfigCenter(t *testing.T) {
	config := &ConfigCenterConfig{
		Enabled:     true,
		Provider:    "memory",
		WatchConfig: true,
	}
	
	cc := NewConfigCenter(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := cc.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start config center: %v", err)
	}
	
	// 测试设置配置
	err = cc.SetConfig("test-key", "test-value")
	if err != nil {
		t.Errorf("Failed to set config: %v", err)
	}
	
	// 测试获取配置
	value, err := cc.GetConfig("test-key")
	if err != nil {
		t.Errorf("Failed to get config: %v", err)
	}
	
	if value != "test-value" {
		t.Errorf("Expected 'test-value', got %v", value)
	}
	
	// 测试类型化获取方法
	err = cc.SetConfig("string-key", "string-value")
	if err != nil {
		t.Errorf("Failed to set string config: %v", err)
	}
	
	stringValue := cc.GetConfigString("string-key", "default")
	if stringValue != "string-value" {
		t.Errorf("Expected 'string-value', got %s", stringValue)
	}
	
	err = cc.SetConfig("int-key", 42)
	if err != nil {
		t.Errorf("Failed to set int config: %v", err)
	}
	
	intValue := cc.GetConfigInt("int-key", 0)
	if intValue != 42 {
		t.Errorf("Expected 42, got %d", intValue)
	}
	
	err = cc.SetConfig("bool-key", true)
	if err != nil {
		t.Errorf("Failed to set bool config: %v", err)
	}
	
	boolValue := cc.GetConfigBool("bool-key", false)
	if !boolValue {
		t.Error("Expected true, got false")
	}
	
	// 测试监听配置变化
	configChanged := false
	err = cc.WatchConfig("watch-key", func(key string, value interface{}) {
		configChanged = true
	})
	if err != nil {
		t.Errorf("Failed to watch config: %v", err)
	}
	
	err = cc.SetConfig("watch-key", "watch-value")
	if err != nil {
		t.Errorf("Failed to set watched config: %v", err)
	}
	
	// 等待一下让回调执行
	time.Sleep(100 * time.Millisecond)
	
	if !configChanged {
		t.Error("Expected config change notification")
	}
	
	// 测试列出配置
	configs, err := cc.ListConfigs("")
	if err != nil {
		t.Errorf("Failed to list configs: %v", err)
	}
	
	if len(configs) == 0 {
		t.Error("Expected configs, got empty list")
	}
	
	// 测试删除配置
	err = cc.DeleteConfig("test-key")
	if err != nil {
		t.Errorf("Failed to delete config: %v", err)
	}
	
	// 测试获取统计信息
	stats := cc.GetStats()
	if stats == nil {
		t.Error("Expected stats, got nil")
	}
	
	// 测试停止
	cc.Stop()
}

func TestHealthChecker(t *testing.T) {
	config := &HealthCheckConfig{
		Enabled:          true,
		Interval:         5 * time.Second,
		Timeout:          3 * time.Second,
		FailureThreshold: 3,
		SuccessThreshold: 2,
	}
	
	hc := NewHealthChecker(config)
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	// 测试启动
	err := hc.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start health checker: %v", err)
	}
	
	// 测试添加实例
	instance := &HealthCheckInstance{
		ID:        "test-instance-1",
		Name:      "test-instance",
		Address:   "127.0.0.1",
		Port:      8080,
		CheckType: "tcp",
	}
	
	err = hc.AddInstance(instance)
	if err != nil {
		t.Errorf("Failed to add instance: %v", err)
	}
	
	// 测试更新健康状态
	err = hc.UpdateHealth("test-instance-1", true)
	if err != nil {
		t.Errorf("Failed to update health: %v", err)
	}
	
	// 测试获取健康状态
	health, err := hc.GetInstanceHealth("test-instance-1")
	if err != nil {
		t.Errorf("Failed to get instance health: %v", err)
	}
	
	if health != "healthy" {
		t.Errorf("Expected 'healthy', got %s", health)
	}
	
	// 测试检查实例是否健康
	isHealthy := hc.IsInstanceHealthy("test-instance-1")
	if !isHealthy {
		t.Error("Expected instance to be healthy")
	}
	
	// 测试获取所有实例
	instances := hc.GetAllInstances()
	if len(instances) != 1 {
		t.Errorf("Expected 1 instance, got %d", len(instances))
	}
	
	// 测试获取健康实例
	healthyInstances := hc.GetHealthyInstances()
	if len(healthyInstances) != 1 {
		t.Errorf("Expected 1 healthy instance, got %d", len(healthyInstances))
	}
	
	// 测试设置元数据
	metadata := map[string]interface{}{
		"version": "1.0.0",
		"region":  "us-west-1",
	}
	
	err = hc.SetInstanceMetadata("test-instance-1", metadata)
	if err != nil {
		t.Errorf("Failed to set instance metadata: %v", err)
	}
	
	// 测试获取元数据
	retrievedMetadata, err := hc.GetInstanceMetadata("test-instance-1")
	if err != nil {
		t.Errorf("Failed to get instance metadata: %v", err)
	}
	
	if retrievedMetadata["version"] != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got %v", retrievedMetadata["version"])
	}
	
	// 测试获取统计信息
	stats := hc.GetStats()
	if stats == nil {
		t.Error("Expected stats, got nil")
	}
	
	if stats.HealthyCount != 1 {
		t.Errorf("Expected 1 healthy instance, got %d", stats.HealthyCount)
	}
	
	// 测试移除实例
	err = hc.RemoveInstance("test-instance-1")
	if err != nil {
		t.Errorf("Failed to remove instance: %v", err)
	}
	
	// 测试停止
	hc.Stop()
}

func BenchmarkLoadBalancer_GetInstance(b *testing.B) {
	config := &LoadBalancerConfig{
		Enabled:   true,
		Algorithm: "round_robin",
	}
	
	lb := NewLoadBalancer(config)
	
	// 添加测试实例
	for i := 0; i < 10; i++ {
		service := &ServiceInfo{
			ID:      fmt.Sprintf("instance-%d", i),
			Name:    "test-service",
			Address: "127.0.0.1",
			Port:    8080 + i,
		}
		lb.AddInstance("test-service", service)
	}
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		lb.GetInstance("test-service")
	}
}

func BenchmarkConfigCenter_GetConfig(b *testing.B) {
	config := &ConfigCenterConfig{
		Enabled:  true,
		Provider: "memory",
	}
	
	cc := NewConfigCenter(config)
	
	// 设置测试配置
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("test-key-%d", i)
		value := fmt.Sprintf("test-value-%d", i)
		cc.SetConfig(key, value)
	}
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("test-key-%d", i%100)
		cc.GetConfig(key)
	}
}