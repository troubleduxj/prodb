package services

import (
	"context"
	"fmt"
	"hash/fnv"
	"log"
	"math/rand"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// LoadBalancer 负载均衡器
type LoadBalancer struct {
	config    *LoadBalancerConfig
	algorithm LoadBalancingAlgorithm
	instances map[string][]*ServiceInstance
	stats     *LoadBalancerStats
	running   bool
	stopChan  chan struct{}
	mu        sync.RWMutex
}

// LoadBalancingAlgorithm 负载均衡算法接口
type LoadBalancingAlgorithm interface {
	Select(instances []*ServiceInstance) *ServiceInstance
	UpdateStats(instance *ServiceInstance, latency time.Duration, success bool)
}

// ServiceInstance 服务实例
type ServiceInstance struct {
	Info         *ServiceInfo  `json:"info"`
	Weight       int           `json:"weight"`
	CurrentWeight int          `json:"current_weight"`
	RequestCount int64         `json:"request_count"`
	ErrorCount   int64         `json:"error_count"`
	TotalLatency time.Duration `json:"total_latency"`
	LastUsed     time.Time     `json:"last_used"`
	Healthy      bool          `json:"healthy"`
	mu           sync.RWMutex
}

// NewLoadBalancer 创建负载均衡器
func NewLoadBalancer(config *LoadBalancerConfig) *LoadBalancer {
	lb := &LoadBalancer{
		config:    config,
		instances: make(map[string][]*ServiceInstance),
		stats: &LoadBalancerStats{
			InstanceStats: make(map[string]*InstanceStat),
		},
		stopChan: make(chan struct{}),
	}
	
	// 根据配置创建算法
	switch config.Algorithm {
	case "round_robin":
		lb.algorithm = NewRoundRobinAlgorithm()
	case "weighted_round_robin":
		lb.algorithm = NewWeightedRoundRobinAlgorithm()
	case "least_connections":
		lb.algorithm = NewLeastConnectionsAlgorithm()
	case "ip_hash":
		lb.algorithm = NewIPHashAlgorithm()
	default:
		lb.algorithm = NewRoundRobinAlgorithm()
	}
	
	return lb
}

// Start 启动负载均衡器
func (lb *LoadBalancer) Start(ctx context.Context) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	
	if lb.running {
		return fmt.Errorf("load balancer already running")
	}
	
	lb.running = true
	
	// 启动健康检查
	if lb.config.HealthCheck {
		go lb.healthCheckLoop(ctx)
	}
	
	// 启动统计更新
	go lb.statsUpdateLoop(ctx)
	
	log.Println("Load balancer started")
	return nil
}

// Stop 停止负载均衡器
func (lb *LoadBalancer) Stop() {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	
	if !lb.running {
		return
	}
	
	lb.running = false
	close(lb.stopChan)
	
	log.Println("Load balancer stopped")
}

// AddInstance 添加服务实例
func (lb *LoadBalancer) AddInstance(serviceName string, service *ServiceInfo) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	
	instance := &ServiceInstance{
		Info:    service,
		Weight:  1, // 默认权重
		Healthy: true,
	}
	
	lb.instances[serviceName] = append(lb.instances[serviceName], instance)
	
	log.Printf("Added instance to load balancer: %s -> %s:%d", 
		serviceName, service.Address, service.Port)
	
	return nil
}

// RemoveInstance 移除服务实例
func (lb *LoadBalancer) RemoveInstance(serviceName, instanceID string) error {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	
	instances := lb.instances[serviceName]
	for i, instance := range instances {
		if instance.Info.ID == instanceID {
			// 移除实例
			lb.instances[serviceName] = append(instances[:i], instances[i+1:]...)
			
			log.Printf("Removed instance from load balancer: %s -> %s", 
				serviceName, instanceID)
			
			return nil
		}
	}
	
	return fmt.Errorf("instance %s not found in service %s", instanceID, serviceName)
}

// GetInstance 获取服务实例
func (lb *LoadBalancer) GetInstance(serviceName string) (*ServiceInfo, error) {
	lb.mu.RLock()
	instances := lb.instances[serviceName]
	lb.mu.RUnlock()
	
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available for service %s", serviceName)
	}
	
	// 过滤健康的实例
	var healthyInstances []*ServiceInstance
	for _, instance := range instances {
		if instance.Healthy {
			healthyInstances = append(healthyInstances, instance)
		}
	}
	
	if len(healthyInstances) == 0 {
		return nil, fmt.Errorf("no healthy instances available for service %s", serviceName)
	}
	
	// 使用负载均衡算法选择实例
	selected := lb.algorithm.Select(healthyInstances)
	if selected == nil {
		return nil, fmt.Errorf("load balancing algorithm failed to select instance")
	}
	
	// 更新使用统计
	selected.mu.Lock()
	selected.LastUsed = time.Now()
	atomic.AddInt64(&selected.RequestCount, 1)
	selected.mu.Unlock()
	
	// 更新全局统计
	atomic.AddInt64(&lb.stats.TotalRequests, 1)
	
	return selected.Info, nil
}

// UpdateInstanceHealth 更新实例健康状态
func (lb *LoadBalancer) UpdateInstanceHealth(serviceName, instanceID string, healthy bool) error {
	lb.mu.RLock()
	instances := lb.instances[serviceName]
	lb.mu.RUnlock()
	
	for _, instance := range instances {
		if instance.Info.ID == instanceID {
			instance.mu.Lock()
			instance.Healthy = healthy
			instance.mu.Unlock()
			
			log.Printf("Updated instance health: %s -> %s (healthy: %v)", 
				serviceName, instanceID, healthy)
			
			return nil
		}
	}
	
	return fmt.Errorf("instance %s not found in service %s", instanceID, serviceName)
}

// RecordRequest 记录请求结果
func (lb *LoadBalancer) RecordRequest(serviceName, instanceID string, latency time.Duration, success bool) {
	lb.mu.RLock()
	instances := lb.instances[serviceName]
	lb.mu.RUnlock()
	
	for _, instance := range instances {
		if instance.Info.ID == instanceID {
			// 更新算法统计
			lb.algorithm.UpdateStats(instance, latency, success)
			
			// 更新实例统计
			instance.mu.Lock()
			instance.TotalLatency += latency
			if success {
				atomic.AddInt64(&lb.stats.SuccessRequests, 1)
			} else {
				atomic.AddInt64(&instance.ErrorCount, 1)
				atomic.AddInt64(&lb.stats.FailedRequests, 1)
			}
			instance.mu.Unlock()
			
			break
		}
	}
}

// GetStats 获取负载均衡统计
func (lb *LoadBalancer) GetStats() *LoadBalancerStats {
	lb.mu.RLock()
	defer lb.mu.RUnlock()
	
	// 深拷贝统计信息
	stats := &LoadBalancerStats{
		TotalRequests:   lb.stats.TotalRequests,
		SuccessRequests: lb.stats.SuccessRequests,
		FailedRequests:  lb.stats.FailedRequests,
		AverageLatency:  lb.stats.AverageLatency,
		InstanceStats:   make(map[string]*InstanceStat),
	}
	
	// 更新实例统计
	for _, instances := range lb.instances {
		for _, instance := range instances {
			instance.mu.RLock()
			
			var avgLatency float64
			if instance.RequestCount > 0 {
				avgLatency = float64(instance.TotalLatency) / float64(instance.RequestCount) / float64(time.Millisecond)
			}
			
			stats.InstanceStats[instance.Info.ID] = &InstanceStat{
				ID:             instance.Info.ID,
				Address:        fmt.Sprintf("%s:%d", instance.Info.Address, instance.Info.Port),
				Healthy:        instance.Healthy,
				RequestCount:   instance.RequestCount,
				ErrorCount:     instance.ErrorCount,
				AverageLatency: avgLatency,
				LastCheck:      instance.LastUsed,
			}
			
			instance.mu.RUnlock()
		}
	}
	
	return stats
}

// healthCheckLoop 健康检查循环
func (lb *LoadBalancer) healthCheckLoop(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-lb.stopChan:
			return
		case <-ticker.C:
			lb.performHealthCheck()
		}
	}
}

// performHealthCheck 执行健康检查
func (lb *LoadBalancer) performHealthCheck() {
	lb.mu.RLock()
	allInstances := make([]*ServiceInstance, 0)
	for _, instances := range lb.instances {
		allInstances = append(allInstances, instances...)
	}
	lb.mu.RUnlock()
	
	for _, instance := range allInstances {
		healthy := lb.checkInstanceHealth(instance)
		
		instance.mu.Lock()
		instance.Healthy = healthy
		instance.mu.Unlock()
	}
}

// checkInstanceHealth 检查实例健康状态
func (lb *LoadBalancer) checkInstanceHealth(instance *ServiceInstance) bool {
	address := fmt.Sprintf("%s:%d", instance.Info.Address, instance.Info.Port)
	
	conn, err := net.DialTimeout("tcp", address, lb.config.Timeout)
	if err != nil {
		return false
	}
	defer conn.Close()
	
	return true
}

// statsUpdateLoop 统计更新循环
func (lb *LoadBalancer) statsUpdateLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-lb.stopChan:
			return
		case <-ticker.C:
			lb.updateAverageLatency()
		}
	}
}

// updateAverageLatency 更新平均延迟
func (lb *LoadBalancer) updateAverageLatency() {
	lb.mu.RLock()
	defer lb.mu.RUnlock()
	
	var totalLatency time.Duration
	var totalRequests int64
	
	for _, instances := range lb.instances {
		for _, instance := range instances {
			instance.mu.RLock()
			totalLatency += instance.TotalLatency
			totalRequests += instance.RequestCount
			instance.mu.RUnlock()
		}
	}
	
	if totalRequests > 0 {
		lb.stats.AverageLatency = float64(totalLatency) / float64(totalRequests) / float64(time.Millisecond)
	}
}

// UpdateConfig 更新配置
func (lb *LoadBalancer) UpdateConfig(config *LoadBalancerConfig) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	
	lb.config = config
	
	// 根据新配置更新算法
	switch config.Algorithm {
	case "round_robin":
		lb.algorithm = NewRoundRobinAlgorithm()
	case "weighted_round_robin":
		lb.algorithm = NewWeightedRoundRobinAlgorithm()
	case "least_connections":
		lb.algorithm = NewLeastConnectionsAlgorithm()
	case "ip_hash":
		lb.algorithm = NewIPHashAlgorithm()
	}
	
	log.Println("Load balancer configuration updated")
}

// 负载均衡算法实现

// RoundRobinAlgorithm 轮询算法
type RoundRobinAlgorithm struct {
	current int64
}

func NewRoundRobinAlgorithm() *RoundRobinAlgorithm {
	return &RoundRobinAlgorithm{}
}

func (rr *RoundRobinAlgorithm) Select(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	index := atomic.AddInt64(&rr.current, 1) % int64(len(instances))
	return instances[index]
}

func (rr *RoundRobinAlgorithm) UpdateStats(instance *ServiceInstance, latency time.Duration, success bool) {
	// 轮询算法不需要更新统计
}

// WeightedRoundRobinAlgorithm 加权轮询算法
type WeightedRoundRobinAlgorithm struct {
	mu sync.Mutex
}

func NewWeightedRoundRobinAlgorithm() *WeightedRoundRobinAlgorithm {
	return &WeightedRoundRobinAlgorithm{}
}

func (wrr *WeightedRoundRobinAlgorithm) Select(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	wrr.mu.Lock()
	defer wrr.mu.Unlock()
	
	var selected *ServiceInstance
	totalWeight := 0
	
	for _, instance := range instances {
		instance.CurrentWeight += instance.Weight
		totalWeight += instance.Weight
		
		if selected == nil || instance.CurrentWeight > selected.CurrentWeight {
			selected = instance
		}
	}
	
	if selected != nil {
		selected.CurrentWeight -= totalWeight
	}
	
	return selected
}

func (wrr *WeightedRoundRobinAlgorithm) UpdateStats(instance *ServiceInstance, latency time.Duration, success bool) {
	// 可以根据延迟和成功率动态调整权重
	if !success {
		instance.Weight = max(1, instance.Weight-1)
	} else if latency < 100*time.Millisecond {
		instance.Weight = min(10, instance.Weight+1)
	}
}

// LeastConnectionsAlgorithm 最少连接算法
type LeastConnectionsAlgorithm struct{}

func NewLeastConnectionsAlgorithm() *LeastConnectionsAlgorithm {
	return &LeastConnectionsAlgorithm{}
}

func (lc *LeastConnectionsAlgorithm) Select(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	var selected *ServiceInstance
	minConnections := int64(-1)
	
	for _, instance := range instances {
		connections := atomic.LoadInt64(&instance.RequestCount) - atomic.LoadInt64(&instance.ErrorCount)
		if minConnections == -1 || connections < minConnections {
			minConnections = connections
			selected = instance
		}
	}
	
	return selected
}

func (lc *LeastConnectionsAlgorithm) UpdateStats(instance *ServiceInstance, latency time.Duration, success bool) {
	// 最少连接算法使用请求计数，在GetInstance中已更新
}

// IPHashAlgorithm IP哈希算法
type IPHashAlgorithm struct{}

func NewIPHashAlgorithm() *IPHashAlgorithm {
	return &IPHashAlgorithm{}
}

func (ih *IPHashAlgorithm) Select(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	// 这里应该基于客户端IP进行哈希
	// 由于没有客户端IP信息，使用随机选择
	index := rand.Intn(len(instances))
	return instances[index]
}

func (ih *IPHashAlgorithm) SelectByIP(instances []*ServiceInstance, clientIP string) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}
	
	hash := fnv.New32a()
	hash.Write([]byte(clientIP))
	index := hash.Sum32() % uint32(len(instances))
	
	return instances[index]
}

func (ih *IPHashAlgorithm) UpdateStats(instance *ServiceInstance, latency time.Duration, success bool) {
	// IP哈希算法不需要更新统计
}

// 辅助函数
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}