package tdengine

import (
	"context"
	"log"
	"sync"
	"time"
)

// ReconnectManager handles automatic reconnection to TDengine
type ReconnectManager struct {
	manager         *TDengineManager
	config          *TDengineConfig
	mu              sync.RWMutex
	isReconnecting  bool
	stopCh          chan struct{}
	stopped         bool
	reconnectCount  int
	lastReconnect   time.Time
	
	// Callbacks
	onReconnectStart    func()
	onReconnectSuccess  func()
	onReconnectFailed   func(error)
	onReconnectGiveUp   func()
}

// NewReconnectManager creates a new reconnection manager
func NewReconnectManager(manager *TDengineManager, config *TDengineConfig) *ReconnectManager {
	return &ReconnectManager{
		manager: manager,
		config:  config,
		stopCh:  make(chan struct{}),
	}
}

// SetCallbacks sets the reconnection event callbacks
func (rm *ReconnectManager) SetCallbacks(
	onStart func(),
	onSuccess func(),
	onFailed func(error),
	onGiveUp func(),
) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	rm.onReconnectStart = onStart
	rm.onReconnectSuccess = onSuccess
	rm.onReconnectFailed = onFailed
	rm.onReconnectGiveUp = onGiveUp
}

// Start begins monitoring for reconnection needs
func (rm *ReconnectManager) Start() {
	if !rm.config.EnableAutoReconnect {
		return
	}
	
	// Set up health check callback to trigger reconnection
	if rm.manager.healthChecker != nil {
		rm.manager.healthChecker.SetHealthChangeCallback(rm.onHealthChange)
	}
}

// Stop stops the reconnection manager
func (rm *ReconnectManager) Stop() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	
	if !rm.stopped {
		rm.stopped = true
		close(rm.stopCh)
	}
}

// IsReconnecting returns whether a reconnection is currently in progress
func (rm *ReconnectManager) IsReconnecting() bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.isReconnecting
}

// GetReconnectStats returns reconnection statistics
func (rm *ReconnectManager) GetReconnectStats() (count int, lastAttempt time.Time) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.reconnectCount, rm.lastReconnect
}

// onHealthChange is called when health status changes
func (rm *ReconnectManager) onHealthChange(healthy bool) {
	if !healthy && rm.config.EnableAutoReconnect {
		go rm.attemptReconnection()
	}
}

// attemptReconnection performs the reconnection process
func (rm *ReconnectManager) attemptReconnection() {
	rm.mu.Lock()
	if rm.isReconnecting || rm.stopped {
		rm.mu.Unlock()
		return
	}
	rm.isReconnecting = true
	rm.mu.Unlock()

	defer func() {
		rm.mu.Lock()
		rm.isReconnecting = false
		rm.mu.Unlock()
	}()

	log.Println("TDengine connection lost, starting reconnection process...")
	
	if rm.onReconnectStart != nil {
		rm.onReconnectStart()
	}

	maxAttempts := rm.config.MaxReconnectAttempts
	if maxAttempts <= 0 {
		maxAttempts = 5 // Default fallback
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		rm.mu.Lock()
		if rm.stopped {
			rm.mu.Unlock()
			return
		}
		rm.lastReconnect = time.Now()
		rm.reconnectCount++
		rm.mu.Unlock()

		log.Printf("Reconnection attempt %d/%d...", attempt, maxAttempts)

		if err := rm.performReconnect(); err != nil {
			log.Printf("Reconnection attempt %d failed: %v", attempt, err)
			
			if rm.onReconnectFailed != nil {
				rm.onReconnectFailed(err)
			}

			if attempt < maxAttempts {
				// Wait before next attempt with exponential backoff
				waitTime := rm.calculateBackoffDelay(attempt)
				
				select {
				case <-time.After(waitTime):
					continue
				case <-rm.stopCh:
					return
				}
			}
		} else {
			log.Printf("Reconnection successful after %d attempts", attempt)
			
			if rm.onReconnectSuccess != nil {
				rm.onReconnectSuccess()
			}
			return
		}
	}

	log.Printf("Reconnection failed after %d attempts, giving up", maxAttempts)
	
	if rm.onReconnectGiveUp != nil {
		rm.onReconnectGiveUp()
	}
}

// performReconnect attempts to reconnect to TDengine
func (rm *ReconnectManager) performReconnect() error {
	// Close existing connections
	if rm.manager.pool != nil {
		rm.manager.pool.Close()
	}

	// Create new connection pool
	newPool, err := NewConnectionPool(rm.config)
	if err != nil {
		return ErrReconnectFailed(err)
	}

	// Test the new connection
	ctx, cancel := context.WithTimeout(context.Background(), rm.config.ConnTimeout)
	defer cancel()

	conn, err := newPool.Acquire(ctx)
	if err != nil {
		newPool.Close()
		return ErrReconnectFailed(err)
	}

	// Perform a test query
	if err := conn.PingContext(ctx); err != nil {
		newPool.Release(conn)
		newPool.Close()
		return ErrReconnectFailed(err)
	}

	newPool.Release(conn)

	// Replace the old pool with the new one
	rm.manager.mu.Lock()
	oldPool := rm.manager.pool
	rm.manager.pool = newPool
	rm.manager.mu.Unlock()

	// Close the old pool
	if oldPool != nil {
		oldPool.Close()
	}

	// Restart health checker with new pool
	if rm.manager.healthChecker != nil {
		rm.manager.healthChecker.Stop()
		rm.manager.healthChecker = NewHealthChecker(newPool, rm.config)
		rm.manager.healthChecker.SetHealthChangeCallback(rm.onHealthChange)
		rm.manager.healthChecker.Start()
	}

	return nil
}

// calculateBackoffDelay calculates the delay for the next reconnection attempt
func (rm *ReconnectManager) calculateBackoffDelay(attempt int) time.Duration {
	baseDelay := rm.config.ReconnectInterval
	if baseDelay <= 0 {
		baseDelay = 10 * time.Second
	}

	// Exponential backoff with jitter
	delay := baseDelay * time.Duration(1<<uint(attempt-1))
	
	// Cap the maximum delay at 5 minutes
	maxDelay := 5 * time.Minute
	if delay > maxDelay {
		delay = maxDelay
	}

	// Add some jitter (±25%)
	jitter := time.Duration(float64(delay) * 0.25)
	delay = delay - jitter/2 + time.Duration(float64(jitter)*0.5)

	return delay
}

// ForceReconnect forces an immediate reconnection attempt
func (rm *ReconnectManager) ForceReconnect() error {
	rm.mu.Lock()
	if rm.isReconnecting {
		rm.mu.Unlock()
		return ErrReconnectFailed(nil)
	}
	rm.mu.Unlock()

	return rm.performReconnect()
}