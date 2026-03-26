package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ServiceDiscovery 服务发现
type ServiceDiscovery struct {
	config    *ServiceDiscoveryConfig
	registry  ServiceRegistry
	services  map[string]*ServiceInfo
	running   bool
	stopChan  chan struct{}
	mu        sync.RWMutex
}

// ServiceRegistry 服务注册表接口
type ServiceRegistry interface {
	Register(service *ServiceInfo) error
	Deregister(serviceID string) error
	Discover(serviceName string) ([]*ServiceInfo, error)
	Watch(serviceName string, callback func([]*ServiceInfo)) error
	HealthCheck(serviceID string) error
	Close() error
}

// ServiceInfo 服务信息
type ServiceInfo struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Address  string            `json:"address"`
	Port     int               `json:"port"`
	Tags     []string          `json:"tags"`
	Meta     map[string]string `json:"meta"`
	Health   HealthStatus      `json:"health"`
	RegisterTime time.Time      `json:"register_time"`
	LastHeartbeat time.Time     `json:"last_heartbeat"`
}

// HealthStatus 健康状态
type HealthStatus struct {
	Status      string    `json:"status"`      // healthy, unhealthy, unknown
	LastCheck   time.Time `json:"last_check"`
	CheckCount  int64     `json:"check_count"`
	FailureCount int64    `json:"failure_count"`
	Message     string    `json:"message"`
}

// NewServiceDiscovery 创建服务发现
func NewServiceDiscovery(config *ServiceDiscoveryConfig) *ServiceDiscovery {
	sd := &ServiceDiscovery{
		config:   config,
		services: make(map[string]*ServiceInfo),
		stopChan: make(chan struct{}),
	}
	
	// 根据配置创建注册表
	switch config.Registry {
	case "consul":
		sd.registry = NewConsulRegistry(config)
	case "etcd":
		sd.registry = NewEtcdRegistry(config)
	case "memory":
		sd.registry = NewMemoryRegistry(config)
	default:
		sd.registry = NewMemoryRegistry(config)
	}
	
	return sd
}

// Start 启动服务发现
func (sd *ServiceDiscovery) Start(ctx context.Context) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	if sd.running {
		return fmt.Errorf("service discovery already running")
	}
	
	sd.running = true
	
	// 启动心跳循环
	go sd.heartbeatLoop(ctx)
	
	log.Println("Service discovery started")
	return nil
}

// Stop 停止服务发现
func (sd *ServiceDiscovery) Stop() {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	if !sd.running {
		return
	}
	
	sd.running = false
	close(sd.stopChan)
	
	// 注销所有服务
	for serviceID := range sd.services {
		sd.registry.Deregister(serviceID)
	}
	
	// 关闭注册表
	sd.registry.Close()
	
	log.Println("Service discovery stopped")
}

// RegisterService 注册服务
func (sd *ServiceDiscovery) RegisterService(service *ServiceInfo) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	service.RegisterTime = time.Now()
	service.LastHeartbeat = time.Now()
	service.Health.Status = "healthy"
	service.Health.LastCheck = time.Now()
	
	// 注册到注册表
	if err := sd.registry.Register(service); err != nil {
		return fmt.Errorf("failed to register service: %w", err)
	}
	
	// 本地缓存
	sd.services[service.ID] = service
	
	log.Printf("Service registered: %s (%s:%d)", service.Name, service.Address, service.Port)
	return nil
}

// DeregisterService 注销服务
func (sd *ServiceDiscovery) DeregisterService(serviceID string) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	// 从注册表注销
	if err := sd.registry.Deregister(serviceID); err != nil {
		return fmt.Errorf("failed to deregister service: %w", err)
	}
	
	// 从本地缓存删除
	delete(sd.services, serviceID)
	
	log.Printf("Service deregistered: %s", serviceID)
	return nil
}

// DiscoverServices 发现服务
func (sd *ServiceDiscovery) DiscoverServices(serviceName string) ([]*ServiceInfo, error) {
	services, err := sd.registry.Discover(serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to discover services: %w", err)
	}
	
	// 过滤健康的服务
	var healthyServices []*ServiceInfo
	for _, service := range services {
		if service.Health.Status == "healthy" {
			healthyServices = append(healthyServices, service)
		}
	}
	
	return healthyServices, nil
}

// WatchServices 监听服务变化
func (sd *ServiceDiscovery) WatchServices(serviceName string, callback func([]*ServiceInfo)) error {
	return sd.registry.Watch(serviceName, callback)
}

// UpdateServiceHealth 更新服务健康状态
func (sd *ServiceDiscovery) UpdateServiceHealth(serviceID string, healthy bool) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	service, exists := sd.services[serviceID]
	if !exists {
		return fmt.Errorf("service %s not found", serviceID)
	}
	
	service.Health.LastCheck = time.Now()
	service.Health.CheckCount++
	
	if healthy {
		service.Health.Status = "healthy"
		service.Health.Message = "Health check passed"
	} else {
		service.Health.Status = "unhealthy"
		service.Health.FailureCount++
		service.Health.Message = "Health check failed"
	}
	
	// 更新注册表中的健康状态
	return sd.registry.Register(service)
}

// GetStats 获取统计信息
func (sd *ServiceDiscovery) GetStats() *ServiceDiscoveryStats {
	sd.mu.RLock()
	defer sd.mu.RUnlock()
	
	stats := &ServiceDiscoveryStats{
		RegisteredServices: len(sd.services),
	}
	
	// 计算最后心跳时间
	var lastHeartbeat time.Time
	for _, service := range sd.services {
		if service.LastHeartbeat.After(lastHeartbeat) {
			lastHeartbeat = service.LastHeartbeat
		}
	}
	stats.LastHeartbeat = lastHeartbeat
	
	return stats
}

// heartbeatLoop 心跳循环
func (sd *ServiceDiscovery) heartbeatLoop(ctx context.Context) {
	ticker := time.NewTicker(sd.config.HeartbeatInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-sd.stopChan:
			return
		case <-ticker.C:
			sd.sendHeartbeat()
		}
	}
}

// sendHeartbeat 发送心跳
func (sd *ServiceDiscovery) sendHeartbeat() {
	sd.mu.RLock()
	services := make([]*ServiceInfo, 0, len(sd.services))
	for _, service := range sd.services {
		services = append(services, service)
	}
	sd.mu.RUnlock()
	
	for _, service := range services {
		if err := sd.registry.HealthCheck(service.ID); err != nil {
			log.Printf("Heartbeat failed for service %s: %v", service.ID, err)
			sd.UpdateServiceHealth(service.ID, false)
		} else {
			service.LastHeartbeat = time.Now()
			sd.UpdateServiceHealth(service.ID, true)
		}
	}
}

// UpdateConfig 更新配置
func (sd *ServiceDiscovery) UpdateConfig(config *ServiceDiscoveryConfig) {
	sd.mu.Lock()
	defer sd.mu.Unlock()
	
	sd.config = config
	log.Println("Service discovery configuration updated")
}

// 内存注册表实现（用于测试和开发）

// MemoryRegistry 内存注册表
type MemoryRegistry struct {
	config   *ServiceDiscoveryConfig
	services map[string]map[string]*ServiceInfo // serviceName -> serviceID -> ServiceInfo
	watchers map[string][]func([]*ServiceInfo)  // serviceName -> callbacks
	mu       sync.RWMutex
}

// NewMemoryRegistry 创建内存注册表
func NewMemoryRegistry(config *ServiceDiscoveryConfig) *MemoryRegistry {
	return &MemoryRegistry{
		config:   config,
		services: make(map[string]map[string]*ServiceInfo),
		watchers: make(map[string][]func([]*ServiceInfo)),
	}
}

// Register 注册服务
func (mr *MemoryRegistry) Register(service *ServiceInfo) error {
	mr.mu.Lock()
	defer mr.mu.Unlock()
	
	if mr.services[service.Name] == nil {
		mr.services[service.Name] = make(map[string]*ServiceInfo)
	}
	
	mr.services[service.Name][service.ID] = service
	
	// 通知监听者
	if watchers, exists := mr.watchers[service.Name]; exists {
		services := make([]*ServiceInfo, 0, len(mr.services[service.Name]))
		for _, svc := range mr.services[service.Name] {
			services = append(services, svc)
		}
		
		for _, callback := range watchers {
			go callback(services)
		}
	}
	
	return nil
}

// Deregister 注销服务
func (mr *MemoryRegistry) Deregister(serviceID string) error {
	mr.mu.Lock()
	defer mr.mu.Unlock()
	
	var serviceName string
	for name, services := range mr.services {
		if _, exists := services[serviceID]; exists {
			serviceName = name
			delete(services, serviceID)
			break
		}
	}
	
	// 通知监听者
	if serviceName != "" {
		if watchers, exists := mr.watchers[serviceName]; exists {
			services := make([]*ServiceInfo, 0, len(mr.services[serviceName]))
			for _, svc := range mr.services[serviceName] {
				services = append(services, svc)
			}
			
			for _, callback := range watchers {
				go callback(services)
			}
		}
	}
	
	return nil
}

// Discover 发现服务
func (mr *MemoryRegistry) Discover(serviceName string) ([]*ServiceInfo, error) {
	mr.mu.RLock()
	defer mr.mu.RUnlock()
	
	services := make([]*ServiceInfo, 0)
	if serviceMap, exists := mr.services[serviceName]; exists {
		for _, service := range serviceMap {
			services = append(services, service)
		}
	}
	
	return services, nil
}

// Watch 监听服务变化
func (mr *MemoryRegistry) Watch(serviceName string, callback func([]*ServiceInfo)) error {
	mr.mu.Lock()
	defer mr.mu.Unlock()
	
	mr.watchers[serviceName] = append(mr.watchers[serviceName], callback)
	return nil
}

// HealthCheck 健康检查
func (mr *MemoryRegistry) HealthCheck(serviceID string) error {
	// 内存注册表中的健康检查总是成功
	return nil
}

// Close 关闭注册表
func (mr *MemoryRegistry) Close() error {
	mr.mu.Lock()
	defer mr.mu.Unlock()
	
	mr.services = make(map[string]map[string]*ServiceInfo)
	mr.watchers = make(map[string][]func([]*ServiceInfo))
	
	return nil
}

// Consul注册表实现（简化版本）

// ConsulRegistry Consul注册表
type ConsulRegistry struct {
	config *ServiceDiscoveryConfig
	// 这里应该包含Consul客户端
}

// NewConsulRegistry 创建Consul注册表
func NewConsulRegistry(config *ServiceDiscoveryConfig) *ConsulRegistry {
	return &ConsulRegistry{
		config: config,
	}
}

// Register 注册服务到Consul
func (cr *ConsulRegistry) Register(service *ServiceInfo) error {
	// 这里应该实现Consul服务注册逻辑
	log.Printf("Registering service to Consul: %s", service.Name)
	return nil
}

// Deregister 从Consul注销服务
func (cr *ConsulRegistry) Deregister(serviceID string) error {
	// 这里应该实现Consul服务注销逻辑
	log.Printf("Deregistering service from Consul: %s", serviceID)
	return nil
}

// Discover 从Consul发现服务
func (cr *ConsulRegistry) Discover(serviceName string) ([]*ServiceInfo, error) {
	// 这里应该实现Consul服务发现逻辑
	log.Printf("Discovering services from Consul: %s", serviceName)
	return []*ServiceInfo{}, nil
}

// Watch 监听Consul服务变化
func (cr *ConsulRegistry) Watch(serviceName string, callback func([]*ServiceInfo)) error {
	// 这里应该实现Consul服务监听逻辑
	log.Printf("Watching services in Consul: %s", serviceName)
	return nil
}

// HealthCheck Consul健康检查
func (cr *ConsulRegistry) HealthCheck(serviceID string) error {
	// 这里应该实现Consul健康检查逻辑
	return nil
}

// Close 关闭Consul连接
func (cr *ConsulRegistry) Close() error {
	// 这里应该实现Consul连接关闭逻辑
	return nil
}

// Etcd注册表实现（简化版本）

// EtcdRegistry Etcd注册表
type EtcdRegistry struct {
	config *ServiceDiscoveryConfig
	// 这里应该包含Etcd客户端
}

// NewEtcdRegistry 创建Etcd注册表
func NewEtcdRegistry(config *ServiceDiscoveryConfig) *EtcdRegistry {
	return &EtcdRegistry{
		config: config,
	}
}

// Register 注册服务到Etcd
func (er *EtcdRegistry) Register(service *ServiceInfo) error {
	// 这里应该实现Etcd服务注册逻辑
	log.Printf("Registering service to Etcd: %s", service.Name)
	return nil
}

// Deregister 从Etcd注销服务
func (er *EtcdRegistry) Deregister(serviceID string) error {
	// 这里应该实现Etcd服务注销逻辑
	log.Printf("Deregistering service from Etcd: %s", serviceID)
	return nil
}

// Discover 从Etcd发现服务
func (er *EtcdRegistry) Discover(serviceName string) ([]*ServiceInfo, error) {
	// 这里应该实现Etcd服务发现逻辑
	log.Printf("Discovering services from Etcd: %s", serviceName)
	return []*ServiceInfo{}, nil
}

// Watch 监听Etcd服务变化
func (er *EtcdRegistry) Watch(serviceName string, callback func([]*ServiceInfo)) error {
	// 这里应该实现Etcd服务监听逻辑
	log.Printf("Watching services in Etcd: %s", serviceName)
	return nil
}

// HealthCheck Etcd健康检查
func (er *EtcdRegistry) HealthCheck(serviceID string) error {
	// 这里应该实现Etcd健康检查逻辑
	return nil
}

// Close 关闭Etcd连接
func (er *EtcdRegistry) Close() error {
	// 这里应该实现Etcd连接关闭逻辑
	return nil
}