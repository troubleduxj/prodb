package performance

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// NetworkOptimizer 网络优化器
type NetworkOptimizer struct {
	config       *OptimizerConfig
	connections  map[string]*OptimizedConnection
	httpClient   *http.Client
	metrics      *NetworkMetrics
	running      bool
	stopChan     chan struct{}
	mu           sync.RWMutex
}

// OptimizedConnection 优化的连接
type OptimizedConnection struct {
	name         string
	conn         net.Conn
	lastUsed     time.Time
	useCount     int64
	errorCount   int64
	timeout      time.Duration
	mu           sync.RWMutex
}

// NetworkMetrics 网络指标
type NetworkMetrics struct {
	TotalConnections int                        `json:"total_connections"`
	ActiveConnections int                       `json:"active_connections"`
	TotalRequests    int64                     `json:"total_requests"`
	SuccessRequests  int64                     `json:"success_requests"`
	FailedRequests   int64                     `json:"failed_requests"`
	AverageLatency   float64                   `json:"average_latency"`
	ConnectionStats  map[string]*ConnectionStat `json:"connection_stats"`
}

// ConnectionStat 连接统计
type ConnectionStat struct {
	Name         string    `json:"name"`
	UseCount     int64     `json:"use_count"`
	ErrorCount   int64     `json:"error_count"`
	LastUsed     time.Time `json:"last_used"`
	IsActive     bool      `json:"is_active"`
	Latency      float64   `json:"latency"`
}

// NewNetworkOptimizer 创建网络优化器
func NewNetworkOptimizer(config *OptimizerConfig) *NetworkOptimizer {
	// 创建优化的HTTP客户端
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		DialContext: (&net.Dialer{
			Timeout:   config.ConnectionTimeout,
			KeepAlive: 30 * time.Second,
		}).DialContext,
	}
	
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   config.ConnectionTimeout,
	}
	
	return &NetworkOptimizer{
		config:      config,
		connections: make(map[string]*OptimizedConnection),
		httpClient:  httpClient,
		metrics:     &NetworkMetrics{ConnectionStats: make(map[string]*ConnectionStat)},
		stopChan:    make(chan struct{}),
	}
}

// Start 启动网络优化器
func (no *NetworkOptimizer) Start(ctx context.Context) error {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	if no.running {
		return fmt.Errorf("network optimizer already running")
	}
	
	no.running = true
	
	// 启动网络监控
	go no.networkMonitorLoop(ctx)
	
	log.Println("Network optimizer started")
	return nil
}

// Stop 停止网络优化器
func (no *NetworkOptimizer) Stop() {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	if !no.running {
		return
	}
	
	no.running = false
	close(no.stopChan)
	
	// 关闭所有连接
	for name, conn := range no.connections {
		conn.Close()
		log.Printf("Closed connection: %s", name)
	}
	
	log.Println("Network optimizer stopped")
}

// CreateConnection 创建连接
func (no *NetworkOptimizer) CreateConnection(name, address string) error {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	if _, exists := no.connections[name]; exists {
		return fmt.Errorf("connection %s already exists", name)
	}
	
	conn, err := net.DialTimeout("tcp", address, no.config.ConnectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to create connection %s: %w", name, err)
	}
	
	optimizedConn := &OptimizedConnection{
		name:     name,
		conn:     conn,
		lastUsed: time.Now(),
		timeout:  no.config.ConnectionTimeout,
	}
	
	no.connections[name] = optimizedConn
	no.metrics.ConnectionStats[name] = &ConnectionStat{
		Name:     name,
		IsActive: true,
		LastUsed: time.Now(),
	}
	
	log.Printf("Created connection: %s -> %s", name, address)
	return nil
}

// GetConnection 获取连接
func (no *NetworkOptimizer) GetConnection(name string) (net.Conn, error) {
	no.mu.RLock()
	conn, exists := no.connections[name]
	no.mu.RUnlock()
	
	if !exists {
		return nil, fmt.Errorf("connection %s not found", name)
	}
	
	conn.mu.Lock()
	defer conn.mu.Unlock()
	
	conn.lastUsed = time.Now()
	atomic.AddInt64(&conn.useCount, 1)
	
	return conn.conn, nil
}

// CloseConnection 关闭连接
func (no *NetworkOptimizer) CloseConnection(name string) error {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	conn, exists := no.connections[name]
	if !exists {
		return fmt.Errorf("connection %s not found", name)
	}
	
	conn.Close()
	delete(no.connections, name)
	delete(no.metrics.ConnectionStats, name)
	
	log.Printf("Closed connection: %s", name)
	return nil
}

// GetHTTPClient 获取优化的HTTP客户端
func (no *NetworkOptimizer) GetHTTPClient() *http.Client {
	return no.httpClient
}

// MakeRequest 发起HTTP请求（带重试和指标收集）
func (no *NetworkOptimizer) MakeRequest(req *http.Request) (*http.Response, error) {
	startTime := time.Now()
	var lastErr error
	
	for i := 0; i <= no.config.MaxRetries; i++ {
		atomic.AddInt64(&no.metrics.TotalRequests, 1)
		
		resp, err := no.httpClient.Do(req)
		if err == nil {
			atomic.AddInt64(&no.metrics.SuccessRequests, 1)
			
			// 更新延迟指标
			latency := time.Since(startTime).Seconds() * 1000 // 毫秒
			no.updateLatency(latency)
			
			return resp, nil
		}
		
		lastErr = err
		atomic.AddInt64(&no.metrics.FailedRequests, 1)
		
		if i < no.config.MaxRetries {
			// 指数退避重试
			backoff := time.Duration(i+1) * no.config.RetryInterval
			log.Printf("Request failed, retrying in %v: %v", backoff, err)
			time.Sleep(backoff)
		}
	}
	
	return nil, fmt.Errorf("request failed after %d retries: %w", no.config.MaxRetries, lastErr)
}

// GetConnectionCount 获取连接数
func (no *NetworkOptimizer) GetConnectionCount() int {
	no.mu.RLock()
	defer no.mu.RUnlock()
	
	return len(no.connections)
}

// Optimize 优化网络连接
func (no *NetworkOptimizer) Optimize() error {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	now := time.Now()
	var closedCount int
	
	// 清理长时间未使用的连接
	for name, conn := range no.connections {
		conn.mu.RLock()
		lastUsed := conn.lastUsed
		errorCount := atomic.LoadInt64(&conn.errorCount)
		conn.mu.RUnlock()
		
		// 如果连接超过5分钟未使用，或者错误次数过多，则关闭
		if now.Sub(lastUsed) > 5*time.Minute || errorCount > 10 {
			log.Printf("Closing idle/error connection: %s (last_used: %v, errors: %d)", 
				name, lastUsed, errorCount)
			conn.Close()
			delete(no.connections, name)
			delete(no.metrics.ConnectionStats, name)
			closedCount++
		}
	}
	
	if closedCount > 0 {
		log.Printf("Network optimization completed, closed %d connections", closedCount)
	}
	
	return nil
}

// networkMonitorLoop 网络监控循环
func (no *NetworkOptimizer) networkMonitorLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-no.stopChan:
			return
		case <-ticker.C:
			no.updateMetrics()
			no.Optimize()
		}
	}
}

// updateMetrics 更新指标
func (no *NetworkOptimizer) updateMetrics() {
	no.mu.RLock()
	defer no.mu.RUnlock()
	
	activeConnections := 0
	
	for name, conn := range no.connections {
		conn.mu.RLock()
		useCount := atomic.LoadInt64(&conn.useCount)
		errorCount := atomic.LoadInt64(&conn.errorCount)
		lastUsed := conn.lastUsed
		conn.mu.RUnlock()
		
		// 检查连接是否活跃（最近5分钟内使用过）
		isActive := time.Since(lastUsed) < 5*time.Minute
		if isActive {
			activeConnections++
		}
		
		no.metrics.ConnectionStats[name] = &ConnectionStat{
			Name:       name,
			UseCount:   useCount,
			ErrorCount: errorCount,
			LastUsed:   lastUsed,
			IsActive:   isActive,
		}
	}
	
	no.metrics.TotalConnections = len(no.connections)
	no.metrics.ActiveConnections = activeConnections
}

// updateLatency 更新延迟指标
func (no *NetworkOptimizer) updateLatency(latency float64) {
	// 简单的移动平均，实际应该使用更复杂的算法
	if no.metrics.AverageLatency == 0 {
		no.metrics.AverageLatency = latency
	} else {
		no.metrics.AverageLatency = (no.metrics.AverageLatency*0.9 + latency*0.1)
	}
}

// GetMetrics 获取网络指标
func (no *NetworkOptimizer) GetMetrics() *NetworkMetrics {
	no.mu.RLock()
	defer no.mu.RUnlock()
	
	// 深拷贝指标
	metrics := &NetworkMetrics{
		TotalConnections:  no.metrics.TotalConnections,
		ActiveConnections: no.metrics.ActiveConnections,
		TotalRequests:     no.metrics.TotalRequests,
		SuccessRequests:   no.metrics.SuccessRequests,
		FailedRequests:    no.metrics.FailedRequests,
		AverageLatency:    no.metrics.AverageLatency,
		ConnectionStats:   make(map[string]*ConnectionStat),
	}
	
	for name, stat := range no.metrics.ConnectionStats {
		metrics.ConnectionStats[name] = &ConnectionStat{
			Name:       stat.Name,
			UseCount:   stat.UseCount,
			ErrorCount: stat.ErrorCount,
			LastUsed:   stat.LastUsed,
			IsActive:   stat.IsActive,
			Latency:    stat.Latency,
		}
	}
	
	return metrics
}

// UpdateConfig 更新配置
func (no *NetworkOptimizer) UpdateConfig(config *OptimizerConfig) {
	no.mu.Lock()
	defer no.mu.Unlock()
	
	no.config = config
	
	// 更新HTTP客户端配置
	if transport, ok := no.httpClient.Transport.(*http.Transport); ok {
		transport.TLSHandshakeTimeout = config.ConnectionTimeout
		transport.DialContext = (&net.Dialer{
			Timeout:   config.ConnectionTimeout,
			KeepAlive: 30 * time.Second,
		}).DialContext
	}
	
	no.httpClient.Timeout = config.ConnectionTimeout
	
	log.Println("Network optimizer configuration updated")
}

// OptimizedConnection 方法

// Close 关闭连接
func (oc *OptimizedConnection) Close() error {
	oc.mu.Lock()
	defer oc.mu.Unlock()
	
	if oc.conn != nil {
		return oc.conn.Close()
	}
	
	return nil
}

// RecordError 记录错误
func (oc *OptimizedConnection) RecordError() {
	atomic.AddInt64(&oc.errorCount, 1)
}

// IsHealthy 检查连接是否健康
func (oc *OptimizedConnection) IsHealthy() bool {
	oc.mu.RLock()
	defer oc.mu.RUnlock()
	
	// 检查连接是否超时
	if time.Since(oc.lastUsed) > oc.timeout*2 {
		return false
	}
	
	// 检查错误率
	useCount := atomic.LoadInt64(&oc.useCount)
	errorCount := atomic.LoadInt64(&oc.errorCount)
	
	if useCount > 0 && float64(errorCount)/float64(useCount) > 0.1 {
		return false
	}
	
	return true
}