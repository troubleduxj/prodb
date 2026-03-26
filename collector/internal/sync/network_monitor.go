package sync

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// NetworkStatus represents the current network connection status
type NetworkStatus string

const (
	NetworkStatusOnline     NetworkStatus = "online"
	NetworkStatusOffline    NetworkStatus = "offline"
	NetworkStatusUnknown    NetworkStatus = "unknown"
	NetworkStatusDegraded   NetworkStatus = "degraded"
)

// NetworkMonitor monitors network connectivity to the platform
type NetworkMonitor struct {
	config         config.PlatformConfig
	logger         *logger.Logger
	
	// Status tracking
	status         NetworkStatus
	statusMutex    sync.RWMutex
	lastCheck      time.Time
	lastOnline     time.Time
	lastOffline    time.Time
	
	// Monitoring configuration
	checkInterval  time.Duration
	timeout        time.Duration
	
	// Control
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	
	// Metrics
	metrics        *NetworkMetrics
	
	// Event callbacks
	onStatusChange func(oldStatus, newStatus NetworkStatus)
	onOnline       func()
	onOffline      func()
}

// NetworkMetrics contains network monitoring metrics
type NetworkMetrics struct {
	Status              NetworkStatus `json:"status"`
	LastCheck           time.Time     `json:"last_check"`
	LastOnline          time.Time     `json:"last_online"`
	LastOffline         time.Time     `json:"last_offline"`
	TotalChecks         int64         `json:"total_checks"`
	SuccessfulChecks    int64         `json:"successful_checks"`
	FailedChecks        int64         `json:"failed_checks"`
	ConsecutiveFailures int64         `json:"consecutive_failures"`
	ConsecutiveSuccesses int64        `json:"consecutive_successes"`
	UpTimePercent       float64       `json:"uptime_percent"`
	ResponseTime        time.Duration `json:"response_time"`
	LastError           string        `json:"last_error,omitempty"`
}

// NewNetworkMonitor creates a new network monitor
func NewNetworkMonitor(config config.PlatformConfig, logger *logger.Logger) *NetworkMonitor {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &NetworkMonitor{
		config:        config,
		logger:        logger.WithGroup("network_monitor"),
		status:        NetworkStatusUnknown,
		checkInterval: 30 * time.Second, // Check every 30 seconds
		timeout:       time.Duration(config.Timeout) * time.Second,
		ctx:           ctx,
		cancel:        cancel,
		metrics: &NetworkMetrics{
			Status: NetworkStatusUnknown,
		},
	}
}

// Start starts the network monitor
func (nm *NetworkMonitor) Start() error {
	nm.logger.Info("Starting network monitor")
	
	// Perform initial connectivity check
	if err := nm.checkConnectivity(); err != nil {
		nm.logger.Warn("Initial connectivity check failed", "error", err)
		nm.setStatus(NetworkStatusOffline)
	} else {
		nm.setStatus(NetworkStatusOnline)
	}
	
	// Start monitoring routine
	nm.wg.Add(1)
	go nm.monitoringRoutine()
	
	nm.logger.Info("Network monitor started")
	return nil
}

// Stop stops the network monitor
func (nm *NetworkMonitor) Stop() {
	nm.logger.Info("Stopping network monitor")
	
	nm.cancel()
	nm.wg.Wait()
	
	nm.logger.Info("Network monitor stopped")
}

// GetStatus returns the current network status
func (nm *NetworkMonitor) GetStatus() NetworkStatus {
	nm.statusMutex.RLock()
	defer nm.statusMutex.RUnlock()
	return nm.status
}

// IsOnline returns true if the network is online
func (nm *NetworkMonitor) IsOnline() bool {
	return nm.GetStatus() == NetworkStatusOnline
}

// GetMetrics returns network monitoring metrics
func (nm *NetworkMonitor) GetMetrics() *NetworkMetrics {
	nm.statusMutex.RLock()
	defer nm.statusMutex.RUnlock()
	
	// Create a copy to avoid race conditions
	metrics := *nm.metrics
	return &metrics
}

// SetOnStatusChangeCallback sets a callback for status changes
func (nm *NetworkMonitor) SetOnStatusChangeCallback(callback func(oldStatus, newStatus NetworkStatus)) {
	nm.onStatusChange = callback
}

// SetOnOnlineCallback sets a callback for when network comes online
func (nm *NetworkMonitor) SetOnOnlineCallback(callback func()) {
	nm.onOnline = callback
}

// SetOnOfflineCallback sets a callback for when network goes offline
func (nm *NetworkMonitor) SetOnOfflineCallback(callback func()) {
	nm.onOffline = callback
}

// monitoringRoutine runs the network monitoring loop
func (nm *NetworkMonitor) monitoringRoutine() {
	defer nm.wg.Done()
	
	ticker := time.NewTicker(nm.checkInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-nm.ctx.Done():
			return
			
		case <-ticker.C:
			if err := nm.checkConnectivity(); err != nil {
				nm.handleConnectivityFailure(err)
			} else {
				nm.handleConnectivitySuccess()
			}
		}
	}
}

// checkConnectivity performs a connectivity check to the platform
func (nm *NetworkMonitor) checkConnectivity() error {
	startTime := time.Now()
	
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: nm.timeout,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: nm.timeout,
			}).DialContext,
			TLSHandshakeTimeout: nm.timeout,
		},
	}
	
	// Create health check URL
	healthURL := nm.config.BaseURL + "/api/v1/health"
	
	// Create request with context
	ctx, cancel := context.WithTimeout(nm.ctx, nm.timeout)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}
	
	// Add user agent
	req.Header.Set("User-Agent", "ProDB-Collector/1.0")
	
	// Perform request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("health check failed with status %d", resp.StatusCode)
	}
	
	// Update response time metric
	responseTime := time.Since(startTime)
	nm.statusMutex.Lock()
	nm.metrics.ResponseTime = responseTime
	nm.statusMutex.Unlock()
	
	nm.logger.Debug("Connectivity check successful", 
		"response_time", responseTime,
		"status_code", resp.StatusCode)
	
	return nil
}

// handleConnectivitySuccess handles successful connectivity checks
func (nm *NetworkMonitor) handleConnectivitySuccess() {
	nm.statusMutex.Lock()
	defer nm.statusMutex.Unlock()
	
	now := time.Now()
	oldStatus := nm.status
	
	// Update metrics
	nm.metrics.TotalChecks++
	nm.metrics.SuccessfulChecks++
	nm.metrics.ConsecutiveSuccesses++
	nm.metrics.ConsecutiveFailures = 0
	nm.metrics.LastCheck = now
	nm.metrics.LastError = ""
	
	// Update status if changed
	if nm.status != NetworkStatusOnline {
		nm.status = NetworkStatusOnline
		nm.lastOnline = now
		nm.metrics.LastOnline = now
		
		nm.logger.Info("Network status changed to online")
		
		// Trigger callbacks
		if nm.onStatusChange != nil {
			go nm.onStatusChange(oldStatus, NetworkStatusOnline)
		}
		if nm.onOnline != nil {
			go nm.onOnline()
		}
	}
	
	// Update uptime percentage
	nm.updateUptimePercent()
}

// handleConnectivityFailure handles failed connectivity checks
func (nm *NetworkMonitor) handleConnectivityFailure(err error) {
	nm.statusMutex.Lock()
	defer nm.statusMutex.Unlock()
	
	now := time.Now()
	oldStatus := nm.status
	
	// Update metrics
	nm.metrics.TotalChecks++
	nm.metrics.FailedChecks++
	nm.metrics.ConsecutiveFailures++
	nm.metrics.ConsecutiveSuccesses = 0
	nm.metrics.LastCheck = now
	nm.metrics.LastError = err.Error()
	
	// Update status if changed
	if nm.status != NetworkStatusOffline {
		nm.status = NetworkStatusOffline
		nm.lastOffline = now
		nm.metrics.LastOffline = now
		
		nm.logger.Warn("Network status changed to offline", "error", err)
		
		// Trigger callbacks
		if nm.onStatusChange != nil {
			go nm.onStatusChange(oldStatus, NetworkStatusOffline)
		}
		if nm.onOffline != nil {
			go nm.onOffline()
		}
	} else {
		nm.logger.Debug("Network connectivity check failed", 
			"error", err,
			"consecutive_failures", nm.metrics.ConsecutiveFailures)
	}
	
	// Update uptime percentage
	nm.updateUptimePercent()
}

// setStatus sets the network status (for initial setup)
func (nm *NetworkMonitor) setStatus(status NetworkStatus) {
	nm.statusMutex.Lock()
	defer nm.statusMutex.Unlock()
	
	now := time.Now()
	oldStatus := nm.status
	nm.status = status
	nm.metrics.Status = status
	
	if status == NetworkStatusOnline {
		nm.lastOnline = now
		nm.metrics.LastOnline = now
	} else if status == NetworkStatusOffline {
		nm.lastOffline = now
		nm.metrics.LastOffline = now
	}
	
	// Trigger status change callback if status actually changed
	if oldStatus != status && nm.onStatusChange != nil {
		go nm.onStatusChange(oldStatus, status)
	}
}

// updateUptimePercent calculates and updates the uptime percentage
func (nm *NetworkMonitor) updateUptimePercent() {
	if nm.metrics.TotalChecks == 0 {
		nm.metrics.UpTimePercent = 0
		return
	}
	
	nm.metrics.UpTimePercent = float64(nm.metrics.SuccessfulChecks) / float64(nm.metrics.TotalChecks) * 100
}

// ForceCheck forces an immediate connectivity check
func (nm *NetworkMonitor) ForceCheck() error {
	nm.logger.Debug("Forcing connectivity check")
	
	if err := nm.checkConnectivity(); err != nil {
		nm.handleConnectivityFailure(err)
		return err
	}
	
	nm.handleConnectivitySuccess()
	return nil
}

// WaitForOnline waits for the network to come online with a timeout
func (nm *NetworkMonitor) WaitForOnline(timeout time.Duration) error {
	if nm.IsOnline() {
		return nil
	}
	
	ctx, cancel := context.WithTimeout(nm.ctx, timeout)
	defer cancel()
	
	// Check every second
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for network to come online")
			
		case <-ticker.C:
			if nm.IsOnline() {
				return nil
			}
		}
	}
}

// GetLastOnlineTime returns the last time the network was online
func (nm *NetworkMonitor) GetLastOnlineTime() time.Time {
	nm.statusMutex.RLock()
	defer nm.statusMutex.RUnlock()
	return nm.lastOnline
}

// GetLastOfflineTime returns the last time the network went offline
func (nm *NetworkMonitor) GetLastOfflineTime() time.Time {
	nm.statusMutex.RLock()
	defer nm.statusMutex.RUnlock()
	return nm.lastOffline
}

// GetOfflineDuration returns how long the network has been offline
func (nm *NetworkMonitor) GetOfflineDuration() time.Duration {
	nm.statusMutex.RLock()
	defer nm.statusMutex.RUnlock()
	
	if nm.status == NetworkStatusOnline {
		return 0
	}
	
	if nm.lastOffline.IsZero() {
		return 0
	}
	
	return time.Since(nm.lastOffline)
}