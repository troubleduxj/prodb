package tdengine

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/taosdata/driver-go/v3/taosRestful"
)

// ConnectionPool manages a pool of TDengine connections
type ConnectionPool struct {
	config       *TDengineConfig
	connections  chan *sql.DB
	activeConns  int32
	totalConns   int32
	mu           sync.RWMutex
	closed       bool
	connFactory  func() (*sql.DB, error)
	
	// Metrics
	stats        *PoolStats
}

// PoolStats holds connection pool statistics
type PoolStats struct {
	ActiveConnections   int32 `json:"active_connections"`
	IdleConnections     int32 `json:"idle_connections"`
	TotalConnections    int32 `json:"total_connections"`
	ConnectionsCreated  int64 `json:"connections_created"`
	ConnectionsDestroyed int64 `json:"connections_destroyed"`
	ConnectionErrors    int64 `json:"connection_errors"`
	AcquireCount        int64 `json:"acquire_count"`
	AcquireTime         int64 `json:"acquire_time_ns"`
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(config *TDengineConfig) (*ConnectionPool, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}

	pool := &ConnectionPool{
		config:      config,
		connections: make(chan *sql.DB, config.MaxIdleConns),
		stats:       &PoolStats{},
		connFactory: func() (*sql.DB, error) {
			return createConnection(config)
		},
	}

	// Pre-create minimum connections
	minConns := config.MaxIdleConns / 2
	if minConns < 1 {
		minConns = 1
	}

	for i := 0; i < minConns; i++ {
		conn, err := pool.connFactory()
		if err != nil {
			pool.Close()
			return nil, ErrConnectionFailed(err)
		}
		
		pool.connections <- conn
		atomic.AddInt32(&pool.totalConns, 1)
		atomic.AddInt64(&pool.stats.ConnectionsCreated, 1)
	}

	return pool, nil
}

// createConnection creates a new TDengine connection
func createConnection(config *TDengineConfig) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@http(%s:%d)/%s",
		config.Username,
		config.Password,
		config.Host,
		config.Port,
		config.Database,
	)

	db, err := sql.Open("taosRestful", dsn)
	if err != nil {
		return nil, err
	}

	// Set connection parameters
	db.SetMaxOpenConns(1) // Each connection in pool is individual
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(config.MaxLifetime)
	db.SetConnMaxIdleTime(config.IdleTimeout)

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), config.ConnTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

// Acquire gets a connection from the pool
func (p *ConnectionPool) Acquire(ctx context.Context) (*sql.DB, error) {
	start := time.Now()
	defer func() {
		atomic.AddInt64(&p.stats.AcquireCount, 1)
		atomic.AddInt64(&p.stats.AcquireTime, time.Since(start).Nanoseconds())
	}()

	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return nil, ErrConnectionFailed(fmt.Errorf("connection pool is closed"))
	}
	p.mu.RUnlock()

	// Try to get an idle connection first
	select {
	case conn := <-p.connections:
		if p.isConnectionValid(conn) {
			atomic.AddInt32(&p.activeConns, 1)
			return conn, nil
		}
		// Connection is invalid, close it and create a new one
		conn.Close()
		atomic.AddInt32(&p.totalConns, -1)
		atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
	default:
		// No idle connections available
	}

	// Check if we can create a new connection
	if atomic.LoadInt32(&p.totalConns) >= int32(p.config.MaxOpenConns) {
		// Wait for an available connection with timeout
		select {
		case conn := <-p.connections:
			if p.isConnectionValid(conn) {
				atomic.AddInt32(&p.activeConns, 1)
				return conn, nil
			}
			// Connection is invalid, close it and try to create a new one
			conn.Close()
			atomic.AddInt32(&p.totalConns, -1)
			atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
		case <-ctx.Done():
			return nil, ErrPoolExhausted()
		}
	}

	// Create a new connection
	conn, err := p.connFactory()
	if err != nil {
		atomic.AddInt64(&p.stats.ConnectionErrors, 1)
		return nil, ErrConnectionFailed(err)
	}

	atomic.AddInt32(&p.totalConns, 1)
	atomic.AddInt32(&p.activeConns, 1)
	atomic.AddInt64(&p.stats.ConnectionsCreated, 1)

	return conn, nil
}

// Release returns a connection to the pool
func (p *ConnectionPool) Release(conn *sql.DB) {
	if conn == nil {
		return
	}

	atomic.AddInt32(&p.activeConns, -1)

	p.mu.RLock()
	closed := p.closed
	p.mu.RUnlock()

	if closed || !p.isConnectionValid(conn) {
		conn.Close()
		atomic.AddInt32(&p.totalConns, -1)
		atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
		return
	}

	// Try to return connection to pool
	select {
	case p.connections <- conn:
		// Successfully returned to pool
	default:
		// Pool is full, close the connection
		conn.Close()
		atomic.AddInt32(&p.totalConns, -1)
		atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
	}
}

// isConnectionValid checks if a connection is still valid
func (p *ConnectionPool) isConnectionValid(conn *sql.DB) bool {
	if conn == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return conn.PingContext(ctx) == nil
}

// Stats returns current pool statistics
func (p *ConnectionPool) Stats() *PoolStats {
	stats := &PoolStats{
		ActiveConnections:    atomic.LoadInt32(&p.activeConns),
		TotalConnections:     atomic.LoadInt32(&p.totalConns),
		ConnectionsCreated:   atomic.LoadInt64(&p.stats.ConnectionsCreated),
		ConnectionsDestroyed: atomic.LoadInt64(&p.stats.ConnectionsDestroyed),
		ConnectionErrors:     atomic.LoadInt64(&p.stats.ConnectionErrors),
		AcquireCount:         atomic.LoadInt64(&p.stats.AcquireCount),
		AcquireTime:          atomic.LoadInt64(&p.stats.AcquireTime),
	}
	
	stats.IdleConnections = stats.TotalConnections - stats.ActiveConnections
	return stats
}

// Close closes all connections in the pool
func (p *ConnectionPool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}

	p.closed = true
	close(p.connections)

	// Close all connections in the pool
	for conn := range p.connections {
		conn.Close()
		atomic.AddInt32(&p.totalConns, -1)
		atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
	}

	return nil
}

// Resize changes the pool size
func (p *ConnectionPool) Resize(maxIdle, maxOpen int) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return fmt.Errorf("cannot resize closed pool")
	}

	p.config.MaxIdleConns = maxIdle
	p.config.MaxOpenConns = maxOpen

	// Create new channel with new capacity
	newConnections := make(chan *sql.DB, maxIdle)
	
	// Move existing connections to new channel
	close(p.connections)
	for conn := range p.connections {
		select {
		case newConnections <- conn:
			// Connection moved successfully
		default:
			// New pool is smaller, close excess connections
			conn.Close()
			atomic.AddInt32(&p.totalConns, -1)
			atomic.AddInt64(&p.stats.ConnectionsDestroyed, 1)
		}
	}

	p.connections = newConnections
	return nil
}