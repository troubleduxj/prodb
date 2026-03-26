package tdengine

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"
)

// TDengineManager manages TDengine connections and operations
type TDengineManager struct {
	config           *TDengineConfig
	pool             *ConnectionPool
	healthChecker    *HealthChecker
	reconnectManager *ReconnectManager
	mu               sync.RWMutex
	closed           bool
	
	// Metrics
	metrics          *DBMetrics
	
	// Event callbacks
	onConnect        func()
	onDisconnect     func()
	onError          func(error)
}

// DBMetrics holds database operation metrics
type DBMetrics struct {
	ConnectionsActive    int32     `json:"connections_active"`
	ConnectionsTotal     int32     `json:"connections_total"`
	QueriesExecuted      int64     `json:"queries_executed"`
	QueriesFailed        int64     `json:"queries_failed"`
	QueryDuration        int64     `json:"query_duration_ns"`
	LastQueryTime        time.Time `json:"last_query_time"`
	HealthCheckCount     int64     `json:"health_check_count"`
	ReconnectionCount    int64     `json:"reconnection_count"`
	LastReconnection     time.Time `json:"last_reconnection"`
}

// NewTDengineManager creates a new TDengine manager
func NewTDengineManager(config *TDengineConfig) (*TDengineManager, error) {
	if config == nil {
		config = DefaultTDengineConfig()
	}

	if err := config.Validate(); err != nil {
		return nil, err
	}

	// Create connection pool
	pool, err := NewConnectionPool(config)
	if err != nil {
		return nil, err
	}

	manager := &TDengineManager{
		config:  config,
		pool:    pool,
		metrics: &DBMetrics{},
	}

	// Initialize health checker
	manager.healthChecker = NewHealthChecker(pool, config)
	
	// Initialize reconnection manager
	manager.reconnectManager = NewReconnectManager(manager, config)
	
	// Set up reconnection callbacks
	manager.reconnectManager.SetCallbacks(
		func() {
			log.Println("TDengine reconnection started")
			if manager.onDisconnect != nil {
				manager.onDisconnect()
			}
		},
		func() {
			log.Println("TDengine reconnection successful")
			if manager.onConnect != nil {
				manager.onConnect()
			}
		},
		func(err error) {
			log.Printf("TDengine reconnection failed: %v", err)
			if manager.onError != nil {
				manager.onError(err)
			}
		},
		func() {
			log.Println("TDengine reconnection gave up")
			if manager.onError != nil {
				manager.onError(fmt.Errorf("reconnection attempts exhausted"))
			}
		},
	)

	return manager, nil
}

// Start initializes and starts the TDengine manager
func (tm *TDengineManager) Start() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if tm.closed {
		return fmt.Errorf("manager is closed")
	}

	// Test initial connection
	ctx, cancel := context.WithTimeout(context.Background(), tm.config.ConnTimeout)
	defer cancel()

	conn, err := tm.pool.Acquire(ctx)
	if err != nil {
		return ErrConnectionFailed(err)
	}
	tm.pool.Release(conn)

	// Start health checker
	tm.healthChecker.Start()
	
	// Start reconnection manager
	tm.reconnectManager.Start()

	log.Println("TDengine manager started successfully")
	
	if tm.onConnect != nil {
		tm.onConnect()
	}

	return nil
}

// Stop gracefully shuts down the TDengine manager
func (tm *TDengineManager) Stop() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if tm.closed {
		return nil
	}

	tm.closed = true

	log.Println("Stopping TDengine manager...")

	// Stop health checker
	if tm.healthChecker != nil {
		tm.healthChecker.Stop()
	}

	// Stop reconnection manager
	if tm.reconnectManager != nil {
		tm.reconnectManager.Stop()
	}

	// Close connection pool
	if tm.pool != nil {
		tm.pool.Close()
	}

	log.Println("TDengine manager stopped")
	
	if tm.onDisconnect != nil {
		tm.onDisconnect()
	}

	return nil
}

// SetEventCallbacks sets event callback functions
func (tm *TDengineManager) SetEventCallbacks(onConnect, onDisconnect func(), onError func(error)) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	tm.onConnect = onConnect
	tm.onDisconnect = onDisconnect
	tm.onError = onError
}

// GetConnection acquires a connection from the pool
func (tm *TDengineManager) GetConnection(ctx context.Context) (*sql.DB, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if tm.closed {
		return nil, fmt.Errorf("manager is closed")
	}

	return tm.pool.Acquire(ctx)
}

// ReleaseConnection returns a connection to the pool
func (tm *TDengineManager) ReleaseConnection(conn *sql.DB) {
	if tm.pool != nil {
		tm.pool.Release(conn)
	}
}

// ExecuteQuery executes a query and returns the result
func (tm *TDengineManager) ExecuteQuery(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	start := time.Now()
	defer func() {
		tm.metrics.QueriesExecuted++
		tm.metrics.QueryDuration += time.Since(start).Nanoseconds()
		tm.metrics.LastQueryTime = start
	}()

	conn, err := tm.GetConnection(ctx)
	if err != nil {
		tm.metrics.QueriesFailed++
		return nil, err
	}
	defer tm.ReleaseConnection(conn)

	rows, err := conn.QueryContext(ctx, query, args...)
	if err != nil {
		tm.metrics.QueriesFailed++
		return nil, ErrQueryFailed(err)
	}

	return rows, nil
}

// ExecuteNonQuery executes a non-query statement (INSERT, UPDATE, DELETE)
func (tm *TDengineManager) ExecuteNonQuery(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	start := time.Now()
	defer func() {
		tm.metrics.QueriesExecuted++
		tm.metrics.QueryDuration += time.Since(start).Nanoseconds()
		tm.metrics.LastQueryTime = start
	}()

	conn, err := tm.GetConnection(ctx)
	if err != nil {
		tm.metrics.QueriesFailed++
		return nil, err
	}
	defer tm.ReleaseConnection(conn)

	result, err := conn.ExecContext(ctx, query, args...)
	if err != nil {
		tm.metrics.QueriesFailed++
		return nil, ErrQueryFailed(err)
	}

	return result, nil
}

// Ping tests the connection to TDengine
func (tm *TDengineManager) Ping(ctx context.Context) error {
	conn, err := tm.GetConnection(ctx)
	if err != nil {
		return err
	}
	defer tm.ReleaseConnection(conn)

	return conn.PingContext(ctx)
}

// GetHealthStatus returns the current health status
func (tm *TDengineManager) GetHealthStatus() *HealthStatus {
	if tm.healthChecker != nil {
		return tm.healthChecker.GetStatus()
	}
	return &HealthStatus{IsHealthy: false}
}

// IsHealthy returns whether the connection is healthy
func (tm *TDengineManager) IsHealthy() bool {
	if tm.healthChecker != nil {
		return tm.healthChecker.IsHealthy()
	}
	return false
}

// ForceHealthCheck performs an immediate health check
func (tm *TDengineManager) ForceHealthCheck() *HealthStatus {
	if tm.healthChecker != nil {
		return tm.healthChecker.ForceHealthCheck()
	}
	return &HealthStatus{IsHealthy: false}
}

// GetPoolStats returns connection pool statistics
func (tm *TDengineManager) GetPoolStats() *PoolStats {
	if tm.pool != nil {
		return tm.pool.Stats()
	}
	return &PoolStats{}
}

// GetMetrics returns database operation metrics
func (tm *TDengineManager) GetMetrics() *DBMetrics {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	// Update current connection stats
	if tm.pool != nil {
		stats := tm.pool.Stats()
		tm.metrics.ConnectionsActive = stats.ActiveConnections
		tm.metrics.ConnectionsTotal = stats.TotalConnections
	}

	// Return a copy to avoid race conditions
	metrics := *tm.metrics
	return &metrics
}

// ForceReconnect forces an immediate reconnection
func (tm *TDengineManager) ForceReconnect() error {
	if tm.reconnectManager != nil {
		return tm.reconnectManager.ForceReconnect()
	}
	return fmt.Errorf("reconnection manager not available")
}

// GetReconnectStats returns reconnection statistics
func (tm *TDengineManager) GetReconnectStats() (count int, lastAttempt time.Time) {
	if tm.reconnectManager != nil {
		return tm.reconnectManager.GetReconnectStats()
	}
	return 0, time.Time{}
}

// IsReconnecting returns whether a reconnection is in progress
func (tm *TDengineManager) IsReconnecting() bool {
	if tm.reconnectManager != nil {
		return tm.reconnectManager.IsReconnecting()
	}
	return false
}

// UpdateConfig updates the configuration (requires restart to take effect)
func (tm *TDengineManager) UpdateConfig(newConfig *TDengineConfig) error {
	if err := newConfig.Validate(); err != nil {
		return err
	}

	tm.mu.Lock()
	defer tm.mu.Unlock()

	tm.config = newConfig
	return nil
}

// GetConfig returns a copy of the current configuration
func (tm *TDengineManager) GetConfig() *TDengineConfig {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	// Return a copy to avoid external modifications
	config := *tm.config
	return &config
}