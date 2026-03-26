package tdengine

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"
)

// HealthStatus represents the health status of TDengine connection
type HealthStatus struct {
	IsHealthy        bool      `json:"is_healthy"`
	LastCheck        time.Time `json:"last_check"`
	LastError        string    `json:"last_error,omitempty"`
	ConsecutiveFailures int    `json:"consecutive_failures"`
	Uptime           time.Duration `json:"uptime"`
	ResponseTime     time.Duration `json:"response_time"`
}

// HealthChecker monitors the health of TDengine connections
type HealthChecker struct {
	pool           *ConnectionPool
	config         *TDengineConfig
	status         *HealthStatus
	mu             sync.RWMutex
	stopCh         chan struct{}
	stopped        bool
	onHealthChange func(healthy bool)
	
	// Health check query
	healthQuery    string
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(pool *ConnectionPool, config *TDengineConfig) *HealthChecker {
	return &HealthChecker{
		pool:   pool,
		config: config,
		status: &HealthStatus{
			IsHealthy: true,
			LastCheck: time.Now(),
		},
		stopCh:      make(chan struct{}),
		healthQuery: "SELECT SERVER_STATUS()",
	}
}

// Start begins the health checking routine
func (hc *HealthChecker) Start() {
	go hc.healthCheckLoop()
}

// Stop stops the health checking routine
func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	
	if !hc.stopped {
		hc.stopped = true
		close(hc.stopCh)
	}
}

// SetHealthChangeCallback sets a callback function for health status changes
func (hc *HealthChecker) SetHealthChangeCallback(callback func(bool)) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	hc.onHealthChange = callback
}

// GetStatus returns the current health status
func (hc *HealthChecker) GetStatus() *HealthStatus {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	
	// Create a copy to avoid race conditions
	status := *hc.status
	return &status
}

// IsHealthy returns whether the connection is currently healthy
func (hc *HealthChecker) IsHealthy() bool {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.status.IsHealthy
}

// healthCheckLoop runs the periodic health check
func (hc *HealthChecker) healthCheckLoop() {
	ticker := time.NewTicker(hc.config.HealthCheckInterval)
	defer ticker.Stop()

	startTime := time.Now()

	for {
		select {
		case <-ticker.C:
			hc.performHealthCheck(startTime)
		case <-hc.stopCh:
			return
		}
	}
}

// performHealthCheck executes a single health check
func (hc *HealthChecker) performHealthCheck(startTime time.Time) {
	checkStart := time.Now()
	
	ctx, cancel := context.WithTimeout(context.Background(), hc.config.ConnTimeout)
	defer cancel()

	err := hc.checkConnection(ctx)
	responseTime := time.Since(checkStart)

	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.status.LastCheck = checkStart
	hc.status.ResponseTime = responseTime
	hc.status.Uptime = time.Since(startTime)

	wasHealthy := hc.status.IsHealthy

	if err != nil {
		hc.status.IsHealthy = false
		hc.status.LastError = err.Error()
		hc.status.ConsecutiveFailures++
		
		log.Printf("TDengine health check failed: %v (consecutive failures: %d)", 
			err, hc.status.ConsecutiveFailures)
	} else {
		hc.status.IsHealthy = true
		hc.status.LastError = ""
		hc.status.ConsecutiveFailures = 0
	}

	// Notify about health status change
	if wasHealthy != hc.status.IsHealthy && hc.onHealthChange != nil {
		go hc.onHealthChange(hc.status.IsHealthy)
	}
}

// checkConnection performs the actual connection health check
func (hc *HealthChecker) checkConnection(ctx context.Context) error {
	conn, err := hc.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer hc.pool.Release(conn)

	// Perform a simple query to check if TDengine is responsive
	return hc.executeHealthQuery(ctx, conn)
}

// executeHealthQuery executes a health check query
func (hc *HealthChecker) executeHealthQuery(ctx context.Context, conn *sql.DB) error {
	// Try a simple ping first
	if err := conn.PingContext(ctx); err != nil {
		return err
	}

	// Execute a simple query to verify TDengine is working
	rows, err := conn.QueryContext(ctx, "SELECT NOW()")
	if err != nil {
		return err
	}
	defer rows.Close()

	// Ensure we can read the result
	if !rows.Next() {
		return ErrHealthCheckFailed(rows.Err())
	}

	var timestamp string
	if err := rows.Scan(&timestamp); err != nil {
		return err
	}

	return nil
}

// ForceHealthCheck performs an immediate health check
func (hc *HealthChecker) ForceHealthCheck() *HealthStatus {
	ctx, cancel := context.WithTimeout(context.Background(), hc.config.ConnTimeout)
	defer cancel()

	checkStart := time.Now()
	err := hc.checkConnection(ctx)
	responseTime := time.Since(checkStart)

	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.status.LastCheck = checkStart
	hc.status.ResponseTime = responseTime

	if err != nil {
		hc.status.IsHealthy = false
		hc.status.LastError = err.Error()
		hc.status.ConsecutiveFailures++
	} else {
		hc.status.IsHealthy = true
		hc.status.LastError = ""
		hc.status.ConsecutiveFailures = 0
	}

	// Return a copy of the status
	status := *hc.status
	return &status
}