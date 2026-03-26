package services

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"
)

// HealthChecker 健康检查器
type HealthChecker struct {
	config      *HealthCheckConfig
	instances   map[string]*HealthCheckInstance
	stats       *HealthCheckStats
	running     bool
	stopChan    chan struct{}
	mu          sync.RWMutex
}

// HealthCheckInstance 健康检查实例
type HealthCheckInstance struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Address         string                 `json:"address"`
	Port            int                    `json:"port"`
	CheckType       string                 `json:"check_type"`       // tcp, http, grpc
	CheckPath       string                 `json:"check_path"`       // HTTP路径
	CheckInterval   time.Duration          `json:"check_interval"`
	CheckTimeout    time.Duration          `json:"check_timeout"`
	HealthStatus    string                 `json:"health_status"`    // healthy, unhealthy, unknown
	LastCheck       time.Time              `json:"last_check"`
	CheckCount      int64                  `json:"check_count"`
	SuccessCount    int64                  `json:"success_count"`
	FailureCount    int64                  `json:"failure_count"`
	ConsecutiveFails int                   `json:"consecutive_fails"`
	ConsecutiveSuccess int                 `json:"consecutive_success"`
	LastError       string                 `json:"last_error"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// HealthCheckStats 健康检查统计
type HealthCheckStats struct {
	TotalCount    int       `json:"total_count"`
	HealthyCount  int       `json:"healthy_count"`
	UnhealthyCount int      `json:"unhealthy_count"`
	UnknownCount  int       `json:"unknown_count"`
	LastCheck     time.Time `json:"last_check"`
	CheckErrors   int64     `json:"check_errors"`
}

// NewHealthChecker 创建健康检查器
func NewHealthChecker(config *HealthCheckConfig) *HealthChecker {
	return &HealthChecker{
		config:    config,
		instances: make(map[string]*HealthCheckInstance),
		stats:     &HealthCheckStats{},
		stopChan:  make(chan struct{}),
	}
}

// Start 启动健康检查器
func (hc *HealthChecker) Start(ctx context.Context) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	if hc.running {
		return fmt.Errorf("health checker already running")
	}
	
	hc.running = true
	
	// 启动健康检查循环
	go hc.checkLoop(ctx)
	
	log.Println("Health checker started")
	return nil
}

// Stop 停止健康检查器
func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	if !hc.running {
		return
	}
	
	hc.running = false
	close(hc.stopChan)
	
	log.Println("Health checker stopped")
}

// AddInstance 添加健康检查实例
func (hc *HealthChecker) AddInstance(instance *HealthCheckInstance) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	// 设置默认值
	if instance.CheckInterval == 0 {
		instance.CheckInterval = hc.config.Interval
	}
	if instance.CheckTimeout == 0 {
		instance.CheckTimeout = hc.config.Timeout
	}
	if instance.CheckType == "" {
		instance.CheckType = "tcp"
	}
	
	instance.HealthStatus = "unknown"
	instance.LastCheck = time.Now()
	
	hc.instances[instance.ID] = instance
	
	log.Printf("Added health check instance: %s (%s:%d)", 
		instance.Name, instance.Address, instance.Port)
	
	return nil
}

// RemoveInstance 移除健康检查实例
func (hc *HealthChecker) RemoveInstance(instanceID string) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	if _, exists := hc.instances[instanceID]; !exists {
		return fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	delete(hc.instances, instanceID)
	
	log.Printf("Removed health check instance: %s", instanceID)
	return nil
}

// UpdateHealth 更新健康状态
func (hc *HealthChecker) UpdateHealth(instanceID string, healthy bool) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	instance.LastCheck = time.Now()
	instance.CheckCount++
	
	if healthy {
		instance.HealthStatus = "healthy"
		instance.SuccessCount++
		instance.ConsecutiveSuccess++
		instance.ConsecutiveFails = 0
		instance.LastError = ""
	} else {
		instance.HealthStatus = "unhealthy"
		instance.FailureCount++
		instance.ConsecutiveFails++
		instance.ConsecutiveSuccess = 0
	}
	
	return nil
}

// GetInstanceHealth 获取实例健康状态
func (hc *HealthChecker) GetInstanceHealth(instanceID string) (string, error) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return "", fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	return instance.HealthStatus, nil
}

// GetAllInstances 获取所有实例
func (hc *HealthChecker) GetAllInstances() map[string]*HealthCheckInstance {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	// 深拷贝
	result := make(map[string]*HealthCheckInstance)
	for id, instance := range hc.instances {
		instanceCopy := *instance
		result[id] = &instanceCopy
	}
	
	return result
}

// GetStats 获取统计信息
func (hc *HealthChecker) GetStats() *HealthCheckStats {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	stats := &HealthCheckStats{
		TotalCount: len(hc.instances),
		LastCheck:  hc.stats.LastCheck,
		CheckErrors: hc.stats.CheckErrors,
	}
	
	// 统计各状态数量
	for _, instance := range hc.instances {
		switch instance.HealthStatus {
		case "healthy":
			stats.HealthyCount++
		case "unhealthy":
			stats.UnhealthyCount++
		default:
			stats.UnknownCount++
		}
	}
	
	return stats
}

// checkLoop 健康检查循环
func (hc *HealthChecker) checkLoop(ctx context.Context) {
	ticker := time.NewTicker(hc.config.Interval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-hc.stopChan:
			return
		case <-ticker.C:
			hc.performHealthChecks()
		}
	}
}

// performHealthChecks 执行健康检查
func (hc *HealthChecker) performHealthChecks() {
	hc.mu.RLock()
	instances := make([]*HealthCheckInstance, 0, len(hc.instances))
	for _, instance := range hc.instances {
		instances = append(instances, instance)
	}
	hc.mu.RUnlock()
	
	// 并发执行健康检查
	var wg sync.WaitGroup
	for _, instance := range instances {
		wg.Add(1)
		go func(inst *HealthCheckInstance) {
			defer wg.Done()
			hc.checkInstance(inst)
		}(instance)
	}
	
	wg.Wait()
	
	// 更新统计信息
	hc.mu.Lock()
	hc.stats.LastCheck = time.Now()
	hc.mu.Unlock()
}

// checkInstance 检查单个实例
func (hc *HealthChecker) checkInstance(instance *HealthCheckInstance) {
	var err error
	
	switch instance.CheckType {
	case "tcp":
		err = hc.checkTCP(instance)
	case "http":
		err = hc.checkHTTP(instance)
	case "grpc":
		err = hc.checkGRPC(instance)
	default:
		err = fmt.Errorf("unsupported check type: %s", instance.CheckType)
	}
	
	// 更新实例状态
	hc.mu.Lock()
	instance.LastCheck = time.Now()
	instance.CheckCount++
	
	if err != nil {
		instance.HealthStatus = "unhealthy"
		instance.FailureCount++
		instance.ConsecutiveFails++
		instance.ConsecutiveSuccess = 0
		instance.LastError = err.Error()
		hc.stats.CheckErrors++
		
		log.Printf("Health check failed for %s: %v", instance.Name, err)
	} else {
		// 检查是否需要连续成功才标记为健康
		instance.ConsecutiveSuccess++
		instance.ConsecutiveFails = 0
		instance.LastError = ""
		
		if instance.ConsecutiveSuccess >= hc.config.SuccessThreshold {
			instance.HealthStatus = "healthy"
			instance.SuccessCount++
		}
	}
	
	// 检查是否需要连续失败才标记为不健康
	if instance.ConsecutiveFails >= hc.config.FailureThreshold {
		instance.HealthStatus = "unhealthy"
	}
	
	hc.mu.Unlock()
}

// checkTCP TCP健康检查
func (hc *HealthChecker) checkTCP(instance *HealthCheckInstance) error {
	address := fmt.Sprintf("%s:%d", instance.Address, instance.Port)
	
	conn, err := net.DialTimeout("tcp", address, instance.CheckTimeout)
	if err != nil {
		return fmt.Errorf("TCP connection failed: %w", err)
	}
	defer conn.Close()
	
	return nil
}

// checkHTTP HTTP健康检查
func (hc *HealthChecker) checkHTTP(instance *HealthCheckInstance) error {
	url := fmt.Sprintf("http://%s:%d%s", instance.Address, instance.Port, instance.CheckPath)
	
	client := &http.Client{
		Timeout: instance.CheckTimeout,
	}
	
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP check failed with status: %d", resp.StatusCode)
	}
	
	return nil
}

// checkGRPC gRPC健康检查
func (hc *HealthChecker) checkGRPC(instance *HealthCheckInstance) error {
	// 这里应该实现gRPC健康检查逻辑
	// 可以使用grpc_health_v1协议
	
	// 暂时使用TCP检查代替
	return hc.checkTCP(instance)
}

// SetInstanceMetadata 设置实例元数据
func (hc *HealthChecker) SetInstanceMetadata(instanceID string, metadata map[string]interface{}) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	if instance.Metadata == nil {
		instance.Metadata = make(map[string]interface{})
	}
	
	for key, value := range metadata {
		instance.Metadata[key] = value
	}
	
	return nil
}

// GetInstanceMetadata 获取实例元数据
func (hc *HealthChecker) GetInstanceMetadata(instanceID string) (map[string]interface{}, error) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return nil, fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	// 深拷贝元数据
	metadata := make(map[string]interface{})
	for key, value := range instance.Metadata {
		metadata[key] = value
	}
	
	return metadata, nil
}

// GetHealthyInstances 获取健康的实例
func (hc *HealthChecker) GetHealthyInstances() []*HealthCheckInstance {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	var healthy []*HealthCheckInstance
	for _, instance := range hc.instances {
		if instance.HealthStatus == "healthy" {
			instanceCopy := *instance
			healthy = append(healthy, &instanceCopy)
		}
	}
	
	return healthy
}

// GetUnhealthyInstances 获取不健康的实例
func (hc *HealthChecker) GetUnhealthyInstances() []*HealthCheckInstance {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	var unhealthy []*HealthCheckInstance
	for _, instance := range hc.instances {
		if instance.HealthStatus == "unhealthy" {
			instanceCopy := *instance
			unhealthy = append(unhealthy, &instanceCopy)
		}
	}
	
	return unhealthy
}

// UpdateConfig 更新配置
func (hc *HealthChecker) UpdateConfig(config *HealthCheckConfig) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	hc.config = config
	
	// 更新所有实例的配置
	for _, instance := range hc.instances {
		if instance.CheckInterval == 0 {
			instance.CheckInterval = config.Interval
		}
		if instance.CheckTimeout == 0 {
			instance.CheckTimeout = config.Timeout
		}
	}
	
	log.Println("Health checker configuration updated")
}

// IsInstanceHealthy 检查实例是否健康
func (hc *HealthChecker) IsInstanceHealthy(instanceID string) bool {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return false
	}
	
	return instance.HealthStatus == "healthy"
}

// GetInstanceStats 获取实例统计信息
func (hc *HealthChecker) GetInstanceStats(instanceID string) (*HealthCheckInstance, error) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	instance, exists := hc.instances[instanceID]
	if !exists {
		return nil, fmt.Errorf("health check instance %s not found", instanceID)
	}
	
	// 返回副本
	instanceCopy := *instance
	return &instanceCopy, nil
}