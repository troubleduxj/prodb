package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// ConnectionPoolManager 连接池管理器
type ConnectionPoolManager struct {
	config       *PerformanceConfig
	pools        map[string]*ConnectionPool
	metrics      *ConnectionPoolMetrics
	running      bool
	stopChan     chan struct{}
	mu           sync.RWMutex
}

// ConnectionPool 连接池
type ConnectionPool struct {
	name         string
	factory      func() (interface{}, error)
	cleanup      func(interface{}) error
	validate     func(interface{}) bool
	maxSize      int
	minSize      int
	maxIdleTime  time.Duration
	connections  chan *PooledConnection
	active       int64
	created      int64
	closed       int64
	mu           sync.RWMutex
}

// PooledConnection 池化连接
type PooledConnection struct {
	conn       interface{}
	createdAt  time.Time
	lastUsed   time.Time
	pool       *ConnectionPool
}

// ConnectionPoolMetrics 连接池指标
type ConnectionPoolMetrics struct {
	TotalPools    int                    `json:"total_pools"`
	ActiveConns   int64                  `json:"active_connections"`
	IdleConns     int64                  `json:"idle_connections"`
	CreatedConns  int64                  `json:"created_connections"`
	ClosedConns   int64                  `json:"closed_connections"`
	PoolStats     map[string]*PoolStats  `json:"pool_stats"`
}

// PoolStats 单个池的统计信息
type PoolStats struct {
	Name         string    `json:"name"`
	Size         int       `json:"size"`
	Active       int64     `json:"active"`
	Idle         int       `json:"idle"`
	Created      int64     `json:"created"`
	Closed       int64     `json:"closed"`
	LastActivity time.Time `json:"last_activity"`
}

// NewConnectionPoolManager 创建连接池管理器
func NewConnectionPoolManager(config *PerformanceConfig) *ConnectionPoolManager {
	return &ConnectionPoolManager{
		config:   config,
		pools:    make(map[string]*ConnectionPool),
		metrics:  &ConnectionPoolMetrics{PoolStats: make(map[string]*PoolStats)},
		stopChan: make(chan struct{}),
	}
}

// Start 启动连接池管理器
func (cpm *ConnectionPoolManager) Start(ctx context.Context) error {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	
	if cpm.running {
		return fmt.Errorf("connection pool manager already running")
	}
	
	cpm.running = true
	
	// 启动监控循环
	go cpm.monitoringLoop(ctx)
	
	log.Println("Connection pool manager started")
	return nil
}

// Stop 停止连接池管理器
func (cpm *ConnectionPoolManager) Stop() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	
	if !cpm.running {
		return
	}
	
	cpm.running = false
	close(cpm.stopChan)
	
	// 关闭所有连接池
	for name, pool := range cpm.pools {
		pool.Close()
		log.Printf("Closed connection pool: %s", name)
	}
	
	log.Println("Connection pool manager stopped")
}

// CreatePool 创建连接池
func (cpm *ConnectionPoolManager) CreatePool(name string, factory func() (interface{}, error), 
	cleanup func(interface{}) error, validate func(interface{}) bool) error {
	
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	
	if _, exists := cpm.pools[name]; exists {
		return fmt.Errorf("pool %s already exists", name)
	}
	
	pool := &ConnectionPool{
		name:        name,
		factory:     factory,
		cleanup:     cleanup,
		validate:    validate,
		maxSize:     cpm.config.MaxConnections,
		minSize:     cpm.config.IdleConnections,
		maxIdleTime: cpm.config.ConnectionTimeout,
		connections: make(chan *PooledConnection, cpm.config.MaxConnections),
	}
	
	// 预创建最小连接数
	for i := 0; i < pool.minSize; i++ {
		if conn, err := pool.createConnection(); err == nil {
			select {
			case pool.connections <- conn:
				atomic.AddInt64(&pool.created, 1)
			default:
				pool.closeConnection(conn)
			}
		}
	}
	
	cpm.pools[name] = pool
	cpm.metrics.PoolStats[name] = &PoolStats{
		Name:         name,
		LastActivity: time.Now(),
	}
	
	log.Printf("Created connection pool: %s (min: %d, max: %d)", 
		name, pool.minSize, pool.maxSize)
	
	return nil
}

// GetConnection 获取连接
func (cpm *ConnectionPoolManager) GetConnection(poolName string) (interface{}, error) {
	cpm.mu.RLock()
	pool, exists := cpm.pools[poolName]
	cpm.mu.RUnlock()
	
	if !exists {
		return nil, fmt.Errorf("pool %s not found", poolName)
	}
	
	return pool.Get()
}

// PutConnection 归还连接
func (cpm *ConnectionPoolManager) PutConnection(poolName string, conn interface{}) error {
	cpm.mu.RLock()
	pool, exists := cpm.pools[poolName]
	cpm.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("pool %s not found", poolName)
	}
	
	return pool.Put(conn)
}

// Get 从池中获取连接
func (cp *ConnectionPool) Get() (interface{}, error) {
	// 尝试从池中获取空闲连接
	select {
	case pooledConn := <-cp.connections:
		// 验证连接是否有效
		if cp.validate != nil && !cp.validate(pooledConn.conn) {
			cp.closeConnection(pooledConn)
			return cp.createNewConnection()
		}
		
		// 检查连接是否过期
		if time.Since(pooledConn.lastUsed) > cp.maxIdleTime {
			cp.closeConnection(pooledConn)
			return cp.createNewConnection()
		}
		
		pooledConn.lastUsed = time.Now()
		atomic.AddInt64(&cp.active, 1)
		return pooledConn.conn, nil
		
	default:
		// 池中没有空闲连接，创建新连接
		return cp.createNewConnection()
	}
}

// Put 将连接归还到池中
func (cp *ConnectionPool) Put(conn interface{}) error {
	if conn == nil {
		return nil
	}
	
	atomic.AddInt64(&cp.active, -1)
	
	// 验证连接是否有效
	if cp.validate != nil && !cp.validate(conn) {
		if cp.cleanup != nil {
			cp.cleanup(conn)
		}
		return nil
	}
	
	pooledConn := &PooledConnection{
		conn:     conn,
		lastUsed: time.Now(),
		pool:     cp,
	}
	
	// 尝试将连接放回池中
	select {
	case cp.connections <- pooledConn:
		return nil
	default:
		// 池已满，关闭连接
		cp.closeConnection(pooledConn)
		return nil
	}
}

// createNewConnection 创建新连接
func (cp *ConnectionPool) createNewConnection() (interface{}, error) {
	if atomic.LoadInt64(&cp.active) >= int64(cp.maxSize) {
		return nil, fmt.Errorf("connection pool %s is full", cp.name)
	}
	
	conn, err := cp.factory()
	if err != nil {
		return nil, fmt.Errorf("failed to create connection: %w", err)
	}
	
	atomic.AddInt64(&cp.active, 1)
	atomic.AddInt64(&cp.created, 1)
	
	return conn, nil
}

// createConnection 创建池化连接
func (cp *ConnectionPool) createConnection() (*PooledConnection, error) {
	conn, err := cp.factory()
	if err != nil {
		return nil, err
	}
	
	return &PooledConnection{
		conn:      conn,
		createdAt: time.Now(),
		lastUsed:  time.Now(),
		pool:      cp,
	}, nil
}

// closeConnection 关闭连接
func (cp *ConnectionPool) closeConnection(pooledConn *PooledConnection) {
	if pooledConn == nil {
		return
	}
	
	if cp.cleanup != nil {
		cp.cleanup(pooledConn.conn)
	}
	
	atomic.AddInt64(&cp.closed, 1)
}

// Close 关闭连接池
func (cp *ConnectionPool) Close() {
	close(cp.connections)
	
	// 关闭所有连接
	for pooledConn := range cp.connections {
		cp.closeConnection(pooledConn)
	}
}

// GetActiveCount 获取活跃连接数
func (cpm *ConnectionPoolManager) GetActiveCount() int {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	var total int64
	for _, pool := range cpm.pools {
		total += atomic.LoadInt64(&pool.active)
	}
	
	return int(total)
}

// GetIdleCount 获取空闲连接数
func (cpm *ConnectionPoolManager) GetIdleCount() int {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	var total int
	for _, pool := range cpm.pools {
		total += len(pool.connections)
	}
	
	return total
}

// Optimize 优化连接池
func (cpm *ConnectionPoolManager) Optimize() error {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	for name, pool := range cpm.pools {
		// 清理过期连接
		cleaned := cpm.cleanExpiredConnections(pool)
		if cleaned > 0 {
			log.Printf("Cleaned %d expired connections from pool %s", cleaned, name)
		}
		
		// 预热连接池
		if len(pool.connections) < pool.minSize {
			needed := pool.minSize - len(pool.connections)
			for i := 0; i < needed; i++ {
				if conn, err := pool.createConnection(); err == nil {
					select {
					case pool.connections <- conn:
						atomic.AddInt64(&pool.created, 1)
					default:
						pool.closeConnection(conn)
						break
					}
				}
			}
		}
	}
	
	return nil
}

// cleanExpiredConnections 清理过期连接
func (cpm *ConnectionPoolManager) cleanExpiredConnections(pool *ConnectionPool) int {
	cleaned := 0
	poolSize := len(pool.connections)
	
	for i := 0; i < poolSize; i++ {
		select {
		case pooledConn := <-pool.connections:
			if time.Since(pooledConn.lastUsed) > pool.maxIdleTime {
				pool.closeConnection(pooledConn)
				cleaned++
			} else {
				// 连接仍然有效，放回池中
				select {
				case pool.connections <- pooledConn:
				default:
					pool.closeConnection(pooledConn)
				}
			}
		default:
			break
		}
	}
	
	return cleaned
}

// monitoringLoop 监控循环
func (cpm *ConnectionPoolManager) monitoringLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-cpm.stopChan:
			return
		case <-ticker.C:
			cpm.updateMetrics()
			cpm.Optimize()
		}
	}
}

// updateMetrics 更新指标
func (cpm *ConnectionPoolManager) updateMetrics() {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	var totalActive, totalIdle, totalCreated, totalClosed int64
	
	for name, pool := range cpm.pools {
		active := atomic.LoadInt64(&pool.active)
		idle := int64(len(pool.connections))
		created := atomic.LoadInt64(&pool.created)
		closed := atomic.LoadInt64(&pool.closed)
		
		totalActive += active
		totalIdle += idle
		totalCreated += created
		totalClosed += closed
		
		cpm.metrics.PoolStats[name] = &PoolStats{
			Name:         name,
			Size:         len(pool.connections),
			Active:       active,
			Idle:         int(idle),
			Created:      created,
			Closed:       closed,
			LastActivity: time.Now(),
		}
	}
	
	cpm.metrics.TotalPools = len(cpm.pools)
	cpm.metrics.ActiveConns = totalActive
	cpm.metrics.IdleConns = totalIdle
	cpm.metrics.CreatedConns = totalCreated
	cpm.metrics.ClosedConns = totalClosed
}

// GetMetrics 获取连接池指标
func (cpm *ConnectionPoolManager) GetMetrics() *ConnectionPoolMetrics {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	// 深拷贝指标
	metrics := &ConnectionPoolMetrics{
		TotalPools:   cpm.metrics.TotalPools,
		ActiveConns:  cpm.metrics.ActiveConns,
		IdleConns:    cpm.metrics.IdleConns,
		CreatedConns: cpm.metrics.CreatedConns,
		ClosedConns:  cpm.metrics.ClosedConns,
		PoolStats:    make(map[string]*PoolStats),
	}
	
	for name, stats := range cpm.metrics.PoolStats {
		metrics.PoolStats[name] = &PoolStats{
			Name:         stats.Name,
			Size:         stats.Size,
			Active:       stats.Active,
			Idle:         stats.Idle,
			Created:      stats.Created,
			Closed:       stats.Closed,
			LastActivity: stats.LastActivity,
		}
	}
	
	return metrics
}