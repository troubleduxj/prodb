package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ConfigCenter 配置中心
type ConfigCenter struct {
	config   *ConfigCenterConfig
	provider ConfigProvider
	cache    map[string]interface{}
	watchers map[string][]func(string, interface{})
	stats    *ConfigCenterStats
	running  bool
	stopChan chan struct{}
	mu       sync.RWMutex
}

// ConfigProvider 配置提供者接口
type ConfigProvider interface {
	Get(key string) (interface{}, error)
	Set(key string, value interface{}) error
	Delete(key string) error
	List(prefix string) (map[string]interface{}, error)
	Watch(key string, callback func(string, interface{})) error
	Close() error
}

// ConfigItem 配置项
type ConfigItem struct {
	Key       string      `json:"key"`
	Value     interface{} `json:"value"`
	Version   int64       `json:"version"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	CreatedBy string      `json:"created_by"`
	UpdatedBy string      `json:"updated_by"`
}

// NewConfigCenter 创建配置中心
func NewConfigCenter(config *ConfigCenterConfig) *ConfigCenter {
	cc := &ConfigCenter{
		config:   config,
		cache:    make(map[string]interface{}),
		watchers: make(map[string][]func(string, interface{})),
		stats:    &ConfigCenterStats{},
		stopChan: make(chan struct{}),
	}
	
	// 根据配置创建提供者
	switch config.Provider {
	case "consul":
		cc.provider = NewConsulConfigProvider(config)
	case "etcd":
		cc.provider = NewEtcdConfigProvider(config)
	case "nacos":
		cc.provider = NewNacosConfigProvider(config)
	case "memory":
		cc.provider = NewMemoryConfigProvider(config)
	default:
		cc.provider = NewMemoryConfigProvider(config)
	}
	
	return cc
}

// Start 启动配置中心
func (cc *ConfigCenter) Start(ctx context.Context) error {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	
	if cc.running {
		return fmt.Errorf("config center already running")
	}
	
	cc.running = true
	
	// 启动配置同步
	go cc.syncLoop(ctx)
	
	log.Println("Config center started")
	return nil
}

// Stop 停止配置中心
func (cc *ConfigCenter) Stop() {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	
	if !cc.running {
		return
	}
	
	cc.running = false
	close(cc.stopChan)
	
	// 关闭提供者
	cc.provider.Close()
	
	log.Println("Config center stopped")
}

// GetConfig 获取配置
func (cc *ConfigCenter) GetConfig(key string) (interface{}, error) {
	// 先从缓存获取
	cc.mu.RLock()
	if value, exists := cc.cache[key]; exists {
		cc.mu.RUnlock()
		return value, nil
	}
	cc.mu.RUnlock()
	
	// 从提供者获取
	value, err := cc.provider.Get(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get config %s: %w", key, err)
	}
	
	// 更新缓存
	cc.mu.Lock()
	cc.cache[key] = value
	cc.mu.Unlock()
	
	return value, nil
}

// SetConfig 设置配置
func (cc *ConfigCenter) SetConfig(key string, value interface{}) error {
	// 设置到提供者
	if err := cc.provider.Set(key, value); err != nil {
		return fmt.Errorf("failed to set config %s: %w", key, err)
	}
	
	// 更新缓存
	cc.mu.Lock()
	cc.cache[key] = value
	cc.stats.LastConfigUpdate = time.Now()
	cc.mu.Unlock()
	
	// 通知监听者
	cc.notifyWatchers(key, value)
	
	log.Printf("Config updated: %s", key)
	return nil
}

// DeleteConfig 删除配置
func (cc *ConfigCenter) DeleteConfig(key string) error {
	// 从提供者删除
	if err := cc.provider.Delete(key); err != nil {
		return fmt.Errorf("failed to delete config %s: %w", key, err)
	}
	
	// 从缓存删除
	cc.mu.Lock()
	delete(cc.cache, key)
	cc.mu.Unlock()
	
	// 通知监听者
	cc.notifyWatchers(key, nil)
	
	log.Printf("Config deleted: %s", key)
	return nil
}

// ListConfigs 列出配置
func (cc *ConfigCenter) ListConfigs(prefix string) (map[string]interface{}, error) {
	configs, err := cc.provider.List(prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to list configs with prefix %s: %w", prefix, err)
	}
	
	// 更新缓存
	cc.mu.Lock()
	for key, value := range configs {
		cc.cache[key] = value
	}
	cc.stats.ConfigKeys = len(cc.cache)
	cc.mu.Unlock()
	
	return configs, nil
}

// WatchConfig 监听配置变化
func (cc *ConfigCenter) WatchConfig(key string, callback func(string, interface{})) error {
	cc.mu.Lock()
	cc.watchers[key] = append(cc.watchers[key], callback)
	cc.mu.Unlock()
	
	// 注册到提供者
	if cc.config.WatchConfig {
		return cc.provider.Watch(key, func(k string, v interface{}) {
			// 更新缓存
			cc.mu.Lock()
			cc.cache[k] = v
			cc.mu.Unlock()
			
			// 通知所有监听者
			cc.notifyWatchers(k, v)
		})
	}
	
	return nil
}

// GetConfigString 获取字符串配置
func (cc *ConfigCenter) GetConfigString(key, defaultValue string) string {
	value, err := cc.GetConfig(key)
	if err != nil {
		return defaultValue
	}
	
	if str, ok := value.(string); ok {
		return str
	}
	
	return defaultValue
}

// GetConfigInt 获取整数配置
func (cc *ConfigCenter) GetConfigInt(key string, defaultValue int) int {
	value, err := cc.GetConfig(key)
	if err != nil {
		return defaultValue
	}
	
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return defaultValue
	}
}

// GetConfigBool 获取布尔配置
func (cc *ConfigCenter) GetConfigBool(key string, defaultValue bool) bool {
	value, err := cc.GetConfig(key)
	if err != nil {
		return defaultValue
	}
	
	if b, ok := value.(bool); ok {
		return b
	}
	
	return defaultValue
}

// GetConfigDuration 获取时间间隔配置
func (cc *ConfigCenter) GetConfigDuration(key string, defaultValue time.Duration) time.Duration {
	value, err := cc.GetConfig(key)
	if err != nil {
		return defaultValue
	}
	
	switch v := value.(type) {
	case string:
		if duration, err := time.ParseDuration(v); err == nil {
			return duration
		}
	case int64:
		return time.Duration(v)
	case float64:
		return time.Duration(v)
	}
	
	return defaultValue
}

// GetStats 获取统计信息
func (cc *ConfigCenter) GetStats() *ConfigCenterStats {
	cc.mu.RLock()
	defer cc.mu.RUnlock()
	
	stats := &ConfigCenterStats{
		ConfigKeys:       len(cc.cache),
		LastConfigUpdate: cc.stats.LastConfigUpdate,
		ConfigWatchErrors: cc.stats.ConfigWatchErrors,
	}
	
	return stats
}

// notifyWatchers 通知监听者
func (cc *ConfigCenter) notifyWatchers(key string, value interface{}) {
	cc.mu.RLock()
	watchers := cc.watchers[key]
	cc.mu.RUnlock()
	
	for _, callback := range watchers {
		go func(cb func(string, interface{})) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Config watcher panic: %v", r)
					cc.mu.Lock()
					cc.stats.ConfigWatchErrors++
					cc.mu.Unlock()
				}
			}()
			cb(key, value)
		}(callback)
	}
}

// syncLoop 配置同步循环
func (cc *ConfigCenter) syncLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-cc.stopChan:
			return
		case <-ticker.C:
			cc.syncConfigs()
		}
	}
}

// syncConfigs 同步配置
func (cc *ConfigCenter) syncConfigs() {
	// 获取所有配置
	configs, err := cc.provider.List("")
	if err != nil {
		log.Printf("Failed to sync configs: %v", err)
		return
	}
	
	// 更新缓存
	cc.mu.Lock()
	cc.cache = configs
	cc.stats.ConfigKeys = len(configs)
	cc.mu.Unlock()
}

// UpdateConfig 更新配置
func (cc *ConfigCenter) UpdateConfig(config *ConfigCenterConfig) {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	
	cc.config = config
	log.Println("Config center configuration updated")
}

// 内存配置提供者实现

// MemoryConfigProvider 内存配置提供者
type MemoryConfigProvider struct {
	config   *ConfigCenterConfig
	data     map[string]interface{}
	watchers map[string][]func(string, interface{})
	mu       sync.RWMutex
}

// NewMemoryConfigProvider 创建内存配置提供者
func NewMemoryConfigProvider(config *ConfigCenterConfig) *MemoryConfigProvider {
	return &MemoryConfigProvider{
		config:   config,
		data:     make(map[string]interface{}),
		watchers: make(map[string][]func(string, interface{})),
	}
}

// Get 获取配置
func (mcp *MemoryConfigProvider) Get(key string) (interface{}, error) {
	mcp.mu.RLock()
	defer mcp.mu.RUnlock()
	
	if value, exists := mcp.data[key]; exists {
		return value, nil
	}
	
	return nil, fmt.Errorf("config key %s not found", key)
}

// Set 设置配置
func (mcp *MemoryConfigProvider) Set(key string, value interface{}) error {
	mcp.mu.Lock()
	mcp.data[key] = value
	watchers := mcp.watchers[key]
	mcp.mu.Unlock()
	
	// 通知监听者
	for _, callback := range watchers {
		go callback(key, value)
	}
	
	return nil
}

// Delete 删除配置
func (mcp *MemoryConfigProvider) Delete(key string) error {
	mcp.mu.Lock()
	delete(mcp.data, key)
	watchers := mcp.watchers[key]
	mcp.mu.Unlock()
	
	// 通知监听者
	for _, callback := range watchers {
		go callback(key, nil)
	}
	
	return nil
}

// List 列出配置
func (mcp *MemoryConfigProvider) List(prefix string) (map[string]interface{}, error) {
	mcp.mu.RLock()
	defer mcp.mu.RUnlock()
	
	result := make(map[string]interface{})
	for key, value := range mcp.data {
		if prefix == "" || len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			result[key] = value
		}
	}
	
	return result, nil
}

// Watch 监听配置变化
func (mcp *MemoryConfigProvider) Watch(key string, callback func(string, interface{})) error {
	mcp.mu.Lock()
	defer mcp.mu.Unlock()
	
	mcp.watchers[key] = append(mcp.watchers[key], callback)
	return nil
}

// Close 关闭提供者
func (mcp *MemoryConfigProvider) Close() error {
	mcp.mu.Lock()
	defer mcp.mu.Unlock()
	
	mcp.data = make(map[string]interface{})
	mcp.watchers = make(map[string][]func(string, interface{}))
	
	return nil
}

// Consul配置提供者实现（简化版本）

// ConsulConfigProvider Consul配置提供者
type ConsulConfigProvider struct {
	config *ConfigCenterConfig
	// 这里应该包含Consul客户端
}

// NewConsulConfigProvider 创建Consul配置提供者
func NewConsulConfigProvider(config *ConfigCenterConfig) *ConsulConfigProvider {
	return &ConsulConfigProvider{
		config: config,
	}
}

// Get 从Consul获取配置
func (ccp *ConsulConfigProvider) Get(key string) (interface{}, error) {
	// 这里应该实现Consul配置获取逻辑
	log.Printf("Getting config from Consul: %s", key)
	return nil, fmt.Errorf("consul provider not implemented")
}

// Set 设置配置到Consul
func (ccp *ConsulConfigProvider) Set(key string, value interface{}) error {
	// 这里应该实现Consul配置设置逻辑
	log.Printf("Setting config to Consul: %s", key)
	return fmt.Errorf("consul provider not implemented")
}

// Delete 从Consul删除配置
func (ccp *ConsulConfigProvider) Delete(key string) error {
	// 这里应该实现Consul配置删除逻辑
	log.Printf("Deleting config from Consul: %s", key)
	return fmt.Errorf("consul provider not implemented")
}

// List 从Consul列出配置
func (ccp *ConsulConfigProvider) List(prefix string) (map[string]interface{}, error) {
	// 这里应该实现Consul配置列表逻辑
	log.Printf("Listing configs from Consul with prefix: %s", prefix)
	return make(map[string]interface{}), nil
}

// Watch 监听Consul配置变化
func (ccp *ConsulConfigProvider) Watch(key string, callback func(string, interface{})) error {
	// 这里应该实现Consul配置监听逻辑
	log.Printf("Watching config in Consul: %s", key)
	return nil
}

// Close 关闭Consul连接
func (ccp *ConsulConfigProvider) Close() error {
	// 这里应该实现Consul连接关闭逻辑
	return nil
}

// Etcd配置提供者实现（简化版本）

// EtcdConfigProvider Etcd配置提供者
type EtcdConfigProvider struct {
	config *ConfigCenterConfig
	// 这里应该包含Etcd客户端
}

// NewEtcdConfigProvider 创建Etcd配置提供者
func NewEtcdConfigProvider(config *ConfigCenterConfig) *EtcdConfigProvider {
	return &EtcdConfigProvider{
		config: config,
	}
}

// Get 从Etcd获取配置
func (ecp *EtcdConfigProvider) Get(key string) (interface{}, error) {
	log.Printf("Getting config from Etcd: %s", key)
	return nil, fmt.Errorf("etcd provider not implemented")
}

// Set 设置配置到Etcd
func (ecp *EtcdConfigProvider) Set(key string, value interface{}) error {
	log.Printf("Setting config to Etcd: %s", key)
	return fmt.Errorf("etcd provider not implemented")
}

// Delete 从Etcd删除配置
func (ecp *EtcdConfigProvider) Delete(key string) error {
	log.Printf("Deleting config from Etcd: %s", key)
	return fmt.Errorf("etcd provider not implemented")
}

// List 从Etcd列出配置
func (ecp *EtcdConfigProvider) List(prefix string) (map[string]interface{}, error) {
	log.Printf("Listing configs from Etcd with prefix: %s", prefix)
	return make(map[string]interface{}), nil
}

// Watch 监听Etcd配置变化
func (ecp *EtcdConfigProvider) Watch(key string, callback func(string, interface{})) error {
	log.Printf("Watching config in Etcd: %s", key)
	return nil
}

// Close 关闭Etcd连接
func (ecp *EtcdConfigProvider) Close() error {
	return nil
}

// Nacos配置提供者实现（简化版本）

// NacosConfigProvider Nacos配置提供者
type NacosConfigProvider struct {
	config *ConfigCenterConfig
	// 这里应该包含Nacos客户端
}

// NewNacosConfigProvider 创建Nacos配置提供者
func NewNacosConfigProvider(config *ConfigCenterConfig) *NacosConfigProvider {
	return &NacosConfigProvider{
		config: config,
	}
}

// Get 从Nacos获取配置
func (ncp *NacosConfigProvider) Get(key string) (interface{}, error) {
	log.Printf("Getting config from Nacos: %s", key)
	return nil, fmt.Errorf("nacos provider not implemented")
}

// Set 设置配置到Nacos
func (ncp *NacosConfigProvider) Set(key string, value interface{}) error {
	log.Printf("Setting config to Nacos: %s", key)
	return fmt.Errorf("nacos provider not implemented")
}

// Delete 从Nacos删除配置
func (ncp *NacosConfigProvider) Delete(key string) error {
	log.Printf("Deleting config from Nacos: %s", key)
	return fmt.Errorf("nacos provider not implemented")
}

// List 从Nacos列出配置
func (ncp *NacosConfigProvider) List(prefix string) (map[string]interface{}, error) {
	log.Printf("Listing configs from Nacos with prefix: %s", prefix)
	return make(map[string]interface{}), nil
}

// Watch 监听Nacos配置变化
func (ncp *NacosConfigProvider) Watch(key string, callback func(string, interface{})) error {
	log.Printf("Watching config in Nacos: %s", key)
	return nil
}

// Close 关闭Nacos连接
func (ncp *NacosConfigProvider) Close() error {
	return nil
}