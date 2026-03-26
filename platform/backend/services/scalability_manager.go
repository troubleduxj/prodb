package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ScalabilityManager 可扩展性管理器
type ScalabilityManager struct {
	config           *ScalabilityConfig
	serviceDiscovery *ServiceDiscovery
	loadBalancer     *LoadBalancer
	configCenter     *ConfigCenter
	healthChecker    *HealthChecker
	metrics          *ScalabilityMetrics
	running          bool
	stopChan         chan struct{}
	mu               sync.RWMutex
}

// ScalabilityConfig 可扩展性配置
type ScalabilityConfig struct {
	// 服务发现配置
	ServiceDiscovery ServiceDiscoveryConfig `json:"service_discovery"`
	
	// 负载均衡配置
	LoadBalancer LoadBalancerConfig `json:"load_balancer"`
	
	// 配置中心配置
	ConfigCenter ConfigCenterConfig `json:"config_center"`
	
	// 健康检查配置
	HealthCheck HealthCheckConfig `json:"health_check"`
	
	// 扩展配置
	Scaling ScalingConfig `json:"scaling"`
}

// ServiceDiscoveryConfig 服务发现配置
type ServiceDiscoveryConfig struct {
	Enabled         bool          `json:"enabled"`
	Registry        string        `json:"registry"`         // consul, etcd, zookeeper
	Address         string        `json:"address"`
	Namespace       string        `json:"namespace"`
	HeartbeatInterval time.Duration `json:"heartbeat_interval"`
	TTL             time.Duration `json:"ttl"`
}

// LoadBalancerConfig 负载均衡配置
type LoadBalancerConfig struct {
	Enabled    bool   `json:"enabled"`
	Algorithm  string `json:"algorithm"`  // round_robin, weighted_round_robin, least_connections, ip_hash
	HealthCheck bool  `json:"health_check"`
	Timeout    time.Duration `json:"timeout"`
}

// ConfigCenterConfig 配置中心配置
type ConfigCenterConfig struct {
	Enabled     bool   `json:"enabled"`
	Provider    string `json:"provider"`    // consul, etcd, nacos
	Address     string `json:"address"`
	Namespace   string `json:"namespace"`
	WatchConfig bool   `json:"watch_config"`
}

// HealthCheckConfig 健康检查配置
type HealthCheckConfig struct {
	Enabled         bool          `json:"enabled"`
	Interval        time.Duration `json:"interval"`
	Timeout         time.Duration `json:"timeout"`
	FailureThreshold int          `json:"failure_threshold"`
	SuccessThreshold int          `json:"success_threshold"`
}

// ScalingConfig 扩展配置
type ScalingConfig struct {
	AutoScaling     bool    `json:"auto_scaling"`
	MinInstances    int     `json:"min_instances"`
	MaxInstances    int     `json:"max_instances"`
	CPUThreshold    float64 `json:"cpu_threshold"`
	MemoryThreshold float64 `json:"memory_threshold"`
	ScaleUpCooldown time.Duration `json:"scale_up_cooldown"`
	ScaleDownCooldown time.Duration `json:"scale_down_cooldown"`
}

// ScalabilityMetrics 可扩展性指标
type ScalabilityMetrics struct {
	ServiceInstances    int                    `json:"service_instances"`
	HealthyInstances    int                    `json:"healthy_instances"`
	UnhealthyInstances  int                    `json:"unhealthy_instances"`
	LoadBalancerStats   *LoadBalancerStats     `json:"load_balancer_stats"`
	ServiceDiscoveryStats *ServiceDiscoveryStats `json:"service_discovery_stats"`
	ConfigCenterStats   *ConfigCenterStats     `json:"config_center_stats"`
	LastScalingAction   *ScalingAction         `json:"last_scaling_action"`
	Timestamp           time.Time              `json:"timestamp"`
}

// LoadBalancerStats 负载均衡统计
type LoadBalancerStats struct {
	TotalRequests    int64                    `json:"total_requests"`
	SuccessRequests  int64                    `json:"success_requests"`
	FailedRequests   int64                    `json:"failed_requests"`
	AverageLatency   float64                  `json:"average_latency"`
	InstanceStats    map[string]*InstanceStat `json:"instance_stats"`
}

// InstanceStat 实例统计
type InstanceStat struct {
	ID            string    `json:"id"`
	Address       string    `json:"address"`
	Healthy       bool      `json:"healthy"`
	RequestCount  int64     `json:"request_count"`
	ErrorCount    int64     `json:"error_count"`
	AverageLatency float64  `json:"average_latency"`
	LastCheck     time.Time `json:"last_check"`
}

// ServiceDiscoveryStats 服务发现统计
type ServiceDiscoveryStats struct {
	RegisteredServices int       `json:"registered_services"`
	DiscoveredServices int       `json:"discovered_services"`
	LastHeartbeat      time.Time `json:"last_heartbeat"`
	HeartbeatFailures  int64     `json:"heartbeat_failures"`
}

// ConfigCenterStats 配置中心统计
type ConfigCenterStats struct {
	ConfigKeys        int       `json:"config_keys"`
	LastConfigUpdate  time.Time `json:"last_config_update"`
	ConfigWatchErrors int64     `json:"config_watch_errors"`
}

// ScalingAction 扩展动作
type ScalingAction struct {
	Type        string    `json:"type"`        // scale_up, scale_down
	Reason      string    `json:"reason"`
	FromCount   int       `json:"from_count"`
	ToCount     int       `json:"to_count"`
	Timestamp   time.Time `json:"timestamp"`
	Success     bool      `json:"success"`
	Error       string    `json:"error,omitempty"`
}

// NewScalabilityManager 创建可扩展性管理器
func NewScalabilityManager(config *ScalabilityConfig) *ScalabilityManager {
	if config == nil {
		config = DefaultScalabilityConfig()
	}
	
	return &ScalabilityManager{
		config:           config,
		serviceDiscovery: NewServiceDiscovery(&config.ServiceDiscovery),
		loadBalancer:     NewLoadBalancer(&config.LoadBalancer),
		configCenter:     NewConfigCenter(&config.ConfigCenter),
		healthChecker:    NewHealthChecker(&config.HealthCheck),
		metrics:          &ScalabilityMetrics{},
		stopChan:         make(chan struct{}),
	}
}

// DefaultScalabilityConfig 默认可扩展性配置
func DefaultScalabilityConfig() *ScalabilityConfig {
	return &ScalabilityConfig{
		ServiceDiscovery: ServiceDiscoveryConfig{
			Enabled:           true,
			Registry:          "consul",
			Address:           "localhost:8500",
			Namespace:         "prodb",
			HeartbeatInterval: 30 * time.Second,
			TTL:              60 * time.Second,
		},
		LoadBalancer: LoadBalancerConfig{
			Enabled:     true,
			Algorithm:   "round_robin",
			HealthCheck: true,
			Timeout:     30 * time.Second,
		},
		ConfigCenter: ConfigCenterConfig{
			Enabled:     true,
			Provider:    "consul",
			Address:     "localhost:8500",
			Namespace:   "prodb/config",
			WatchConfig: true,
		},
		HealthCheck: HealthCheckConfig{
			Enabled:          true,
			Interval:         10 * time.Second,
			Timeout:          5 * time.Second,
			FailureThreshold: 3,
			SuccessThreshold: 2,
		},
		Scaling: ScalingConfig{
			AutoScaling:       true,
			MinInstances:      2,
			MaxInstances:      10,
			CPUThreshold:      0.8,
			MemoryThreshold:   0.8,
			ScaleUpCooldown:   5 * time.Minute,
			ScaleDownCooldown: 10 * time.Minute,
		},
	}
}

// Start 启动可扩展性管理器
func (sm *ScalabilityManager) Start(ctx context.Context) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	if sm.running {
		return fmt.Errorf("scalability manager already running")
	}
	
	sm.running = true
	
	// 启动服务发现
	if sm.config.ServiceDiscovery.Enabled {
		if err := sm.serviceDiscovery.Start(ctx); err != nil {
			return fmt.Errorf("failed to start service discovery: %w", err)
		}
	}
	
	// 启动负载均衡器
	if sm.config.LoadBalancer.Enabled {
		if err := sm.loadBalancer.Start(ctx); err != nil {
			return fmt.Errorf("failed to start load balancer: %w", err)
		}
	}
	
	// 启动配置中心
	if sm.config.ConfigCenter.Enabled {
		if err := sm.configCenter.Start(ctx); err != nil {
			return fmt.Errorf("failed to start config center: %w", err)
		}
	}
	
	// 启动健康检查
	if sm.config.HealthCheck.Enabled {
		if err := sm.healthChecker.Start(ctx); err != nil {
			return fmt.Errorf("failed to start health checker: %w", err)
		}
	}
	
	// 启动监控循环
	go sm.monitoringLoop(ctx)
	
	// 启动自动扩展
	if sm.config.Scaling.AutoScaling {
		go sm.autoScalingLoop(ctx)
	}
	
	log.Println("Scalability manager started")
	return nil
}

// Stop 停止可扩展性管理器
func (sm *ScalabilityManager) Stop() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	if !sm.running {
		return nil
	}
	
	sm.running = false
	close(sm.stopChan)
	
	// 停止各个组件
	if sm.config.ServiceDiscovery.Enabled {
		sm.serviceDiscovery.Stop()
	}
	
	if sm.config.LoadBalancer.Enabled {
		sm.loadBalancer.Stop()
	}
	
	if sm.config.ConfigCenter.Enabled {
		sm.configCenter.Stop()
	}
	
	if sm.config.HealthCheck.Enabled {
		sm.healthChecker.Stop()
	}
	
	log.Println("Scalability manager stopped")
	return nil
}

// RegisterService 注册服务
func (sm *ScalabilityManager) RegisterService(service *ServiceInfo) error {
	if !sm.config.ServiceDiscovery.Enabled {
		return fmt.Errorf("service discovery is disabled")
	}
	
	return sm.serviceDiscovery.RegisterService(service)
}

// DeregisterService 注销服务
func (sm *ScalabilityManager) DeregisterService(serviceID string) error {
	if !sm.config.ServiceDiscovery.Enabled {
		return fmt.Errorf("service discovery is disabled")
	}
	
	return sm.serviceDiscovery.DeregisterService(serviceID)
}

// DiscoverServices 发现服务
func (sm *ScalabilityManager) DiscoverServices(serviceName string) ([]*ServiceInfo, error) {
	if !sm.config.ServiceDiscovery.Enabled {
		return nil, fmt.Errorf("service discovery is disabled")
	}
	
	return sm.serviceDiscovery.DiscoverServices(serviceName)
}

// GetServiceInstance 获取服务实例（负载均衡）
func (sm *ScalabilityManager) GetServiceInstance(serviceName string) (*ServiceInfo, error) {
	if !sm.config.LoadBalancer.Enabled {
		return nil, fmt.Errorf("load balancer is disabled")
	}
	
	return sm.loadBalancer.GetInstance(serviceName)
}

// UpdateServiceHealth 更新服务健康状态
func (sm *ScalabilityManager) UpdateServiceHealth(serviceID string, healthy bool) error {
	if !sm.config.HealthCheck.Enabled {
		return fmt.Errorf("health check is disabled")
	}
	
	return sm.healthChecker.UpdateHealth(serviceID, healthy)
}

// GetConfig 获取配置
func (sm *ScalabilityManager) GetConfig(key string) (interface{}, error) {
	if !sm.config.ConfigCenter.Enabled {
		return nil, fmt.Errorf("config center is disabled")
	}
	
	return sm.configCenter.GetConfig(key)
}

// SetConfig 设置配置
func (sm *ScalabilityManager) SetConfig(key string, value interface{}) error {
	if !sm.config.ConfigCenter.Enabled {
		return fmt.Errorf("config center is disabled")
	}
	
	return sm.configCenter.SetConfig(key, value)
}

// WatchConfig 监听配置变化
func (sm *ScalabilityManager) WatchConfig(key string, callback func(string, interface{})) error {
	if !sm.config.ConfigCenter.Enabled {
		return fmt.Errorf("config center is disabled")
	}
	
	return sm.configCenter.WatchConfig(key, callback)
}

// ScaleUp 扩容
func (sm *ScalabilityManager) ScaleUp(serviceName string, count int) error {
	action := &ScalingAction{
		Type:      "scale_up",
		Reason:    "manual",
		FromCount: sm.getServiceInstanceCount(serviceName),
		ToCount:   sm.getServiceInstanceCount(serviceName) + count,
		Timestamp: time.Now(),
	}
	
	// 这里应该调用容器编排系统（如Kubernetes）进行扩容
	// 由于这是示例实现，我们只记录动作
	log.Printf("Scaling up service %s by %d instances", serviceName, count)
	
	action.Success = true
	sm.metrics.LastScalingAction = action
	
	return nil
}

// ScaleDown 缩容
func (sm *ScalabilityManager) ScaleDown(serviceName string, count int) error {
	currentCount := sm.getServiceInstanceCount(serviceName)
	if currentCount-count < sm.config.Scaling.MinInstances {
		return fmt.Errorf("cannot scale down below minimum instances (%d)", sm.config.Scaling.MinInstances)
	}
	
	action := &ScalingAction{
		Type:      "scale_down",
		Reason:    "manual",
		FromCount: currentCount,
		ToCount:   currentCount - count,
		Timestamp: time.Now(),
	}
	
	// 这里应该调用容器编排系统进行缩容
	log.Printf("Scaling down service %s by %d instances", serviceName, count)
	
	action.Success = true
	sm.metrics.LastScalingAction = action
	
	return nil
}

// GetMetrics 获取可扩展性指标
func (sm *ScalabilityManager) GetMetrics() *ScalabilityMetrics {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	metrics := *sm.metrics
	return &metrics
}

// monitoringLoop 监控循环
func (sm *ScalabilityManager) monitoringLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-sm.stopChan:
			return
		case <-ticker.C:
			sm.updateMetrics()
		}
	}
}

// autoScalingLoop 自动扩展循环
func (sm *ScalabilityManager) autoScalingLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-sm.stopChan:
			return
		case <-ticker.C:
			sm.checkAutoScaling()
		}
	}
}

// updateMetrics 更新指标
func (sm *ScalabilityManager) updateMetrics() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	// 更新服务发现统计
	if sm.config.ServiceDiscovery.Enabled {
		sm.metrics.ServiceDiscoveryStats = sm.serviceDiscovery.GetStats()
	}
	
	// 更新负载均衡统计
	if sm.config.LoadBalancer.Enabled {
		sm.metrics.LoadBalancerStats = sm.loadBalancer.GetStats()
	}
	
	// 更新配置中心统计
	if sm.config.ConfigCenter.Enabled {
		sm.metrics.ConfigCenterStats = sm.configCenter.GetStats()
	}
	
	// 更新健康检查统计
	if sm.config.HealthCheck.Enabled {
		healthStats := sm.healthChecker.GetStats()
		sm.metrics.HealthyInstances = healthStats.HealthyCount
		sm.metrics.UnhealthyInstances = healthStats.UnhealthyCount
		sm.metrics.ServiceInstances = healthStats.TotalCount
	}
	
	sm.metrics.Timestamp = time.Now()
}

// checkAutoScaling 检查自动扩展
func (sm *ScalabilityManager) checkAutoScaling() {
	// 获取系统资源使用情况
	// 这里应该从监控系统获取实际的CPU和内存使用率
	// 为了示例，我们使用模拟数据
	
	cpuUsage := sm.getCurrentCPUUsage()
	memoryUsage := sm.getCurrentMemoryUsage()
	
	serviceName := "prodb-backend" // 主服务名称
	currentInstances := sm.getServiceInstanceCount(serviceName)
	
	// 检查是否需要扩容
	if (cpuUsage > sm.config.Scaling.CPUThreshold || memoryUsage > sm.config.Scaling.MemoryThreshold) &&
		currentInstances < sm.config.Scaling.MaxInstances {
		
		// 检查冷却时间
		if sm.canScaleUp() {
			reason := fmt.Sprintf("CPU: %.2f%%, Memory: %.2f%%", cpuUsage*100, memoryUsage*100)
			action := &ScalingAction{
				Type:      "scale_up",
				Reason:    reason,
				FromCount: currentInstances,
				ToCount:   currentInstances + 1,
				Timestamp: time.Now(),
			}
			
			if err := sm.ScaleUp(serviceName, 1); err != nil {
				action.Success = false
				action.Error = err.Error()
			} else {
				action.Success = true
			}
			
			sm.metrics.LastScalingAction = action
			log.Printf("Auto scaling up: %s", reason)
		}
	}
	
	// 检查是否需要缩容
	if cpuUsage < sm.config.Scaling.CPUThreshold*0.5 && memoryUsage < sm.config.Scaling.MemoryThreshold*0.5 &&
		currentInstances > sm.config.Scaling.MinInstances {
		
		// 检查冷却时间
		if sm.canScaleDown() {
			reason := fmt.Sprintf("Low resource usage - CPU: %.2f%%, Memory: %.2f%%", cpuUsage*100, memoryUsage*100)
			action := &ScalingAction{
				Type:      "scale_down",
				Reason:    reason,
				FromCount: currentInstances,
				ToCount:   currentInstances - 1,
				Timestamp: time.Now(),
			}
			
			if err := sm.ScaleDown(serviceName, 1); err != nil {
				action.Success = false
				action.Error = err.Error()
			} else {
				action.Success = true
			}
			
			sm.metrics.LastScalingAction = action
			log.Printf("Auto scaling down: %s", reason)
		}
	}
}

// 辅助方法

func (sm *ScalabilityManager) getServiceInstanceCount(serviceName string) int {
	// 这里应该从服务发现或容器编排系统获取实际的实例数量
	// 为了示例，返回固定值
	return 3
}

func (sm *ScalabilityManager) getCurrentCPUUsage() float64 {
	// 这里应该从监控系统获取实际的CPU使用率
	// 为了示例，返回模拟值
	return 0.6
}

func (sm *ScalabilityManager) getCurrentMemoryUsage() float64 {
	// 这里应该从监控系统获取实际的内存使用率
	// 为了示例，返回模拟值
	return 0.7
}

func (sm *ScalabilityManager) canScaleUp() bool {
	if sm.metrics.LastScalingAction == nil {
		return true
	}
	
	if sm.metrics.LastScalingAction.Type == "scale_up" {
		return time.Since(sm.metrics.LastScalingAction.Timestamp) > sm.config.Scaling.ScaleUpCooldown
	}
	
	return true
}

func (sm *ScalabilityManager) canScaleDown() bool {
	if sm.metrics.LastScalingAction == nil {
		return true
	}
	
	if sm.metrics.LastScalingAction.Type == "scale_down" {
		return time.Since(sm.metrics.LastScalingAction.Timestamp) > sm.config.Scaling.ScaleDownCooldown
	}
	
	return true
}

// UpdateConfig 更新配置
func (sm *ScalabilityManager) UpdateConfig(config *ScalabilityConfig) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	// 验证配置
	if err := validateScalabilityConfig(config); err != nil {
		return err
	}
	
	sm.config = config
	
	// 更新各个组件的配置
	if sm.config.ServiceDiscovery.Enabled {
		sm.serviceDiscovery.UpdateConfig(&config.ServiceDiscovery)
	}
	
	if sm.config.LoadBalancer.Enabled {
		sm.loadBalancer.UpdateConfig(&config.LoadBalancer)
	}
	
	if sm.config.ConfigCenter.Enabled {
		sm.configCenter.UpdateConfig(&config.ConfigCenter)
	}
	
	if sm.config.HealthCheck.Enabled {
		sm.healthChecker.UpdateConfig(&config.HealthCheck)
	}
	
	log.Println("Scalability manager configuration updated")
	return nil
}

// validateScalabilityConfig 验证可扩展性配置
func validateScalabilityConfig(config *ScalabilityConfig) error {
	if config.Scaling.MinInstances < 1 {
		return fmt.Errorf("min_instances must be at least 1")
	}
	
	if config.Scaling.MaxInstances < config.Scaling.MinInstances {
		return fmt.Errorf("max_instances must be greater than or equal to min_instances")
	}
	
	if config.Scaling.CPUThreshold <= 0 || config.Scaling.CPUThreshold > 1 {
		return fmt.Errorf("cpu_threshold must be between 0 and 1")
	}
	
	if config.Scaling.MemoryThreshold <= 0 || config.Scaling.MemoryThreshold > 1 {
		return fmt.Errorf("memory_threshold must be between 0 and 1")
	}
	
	return nil
}