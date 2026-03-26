package sync

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestNetworkMonitor_Basic(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Test initial status
	if monitor.GetStatus() != NetworkStatusUnknown {
		t.Errorf("Expected initial status to be unknown, got %s", monitor.GetStatus())
	}

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait for initial check
	time.Sleep(100 * time.Millisecond)

	// Should be online now
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online")
	}

	// Test metrics
	metrics := monitor.GetMetrics()
	if metrics.Status != NetworkStatusOnline {
		t.Errorf("Expected metrics status to be online, got %s", metrics.Status)
	}

	if metrics.TotalChecks == 0 {
		t.Errorf("Expected at least one check to have been performed")
	}

	if metrics.SuccessfulChecks == 0 {
		t.Errorf("Expected at least one successful check")
	}
}

func TestNetworkMonitor_Offline(t *testing.T) {
	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config with invalid URL
	platformConfig := config.PlatformConfig{
		BaseURL: "http://invalid-host-that-does-not-exist:9999",
		Timeout: 1, // Short timeout
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait for initial check
	time.Sleep(2 * time.Second)

	// Should be offline
	if monitor.IsOnline() {
		t.Errorf("Expected monitor to be offline")
	}

	// Test metrics
	metrics := monitor.GetMetrics()
	if metrics.Status != NetworkStatusOffline {
		t.Errorf("Expected metrics status to be offline, got %s", metrics.Status)
	}

	if metrics.FailedChecks == 0 {
		t.Errorf("Expected at least one failed check")
	}

	if metrics.LastError == "" {
		t.Errorf("Expected last error to be set")
	}
}

func TestNetworkMonitor_StatusCallbacks(t *testing.T) {
	// Create test server that can be controlled
	serverOnline := true
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" && serverOnline {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Set up callbacks
	statusChanges := make(chan string, 10)
	onlineEvents := make(chan bool, 10)
	offlineEvents := make(chan bool, 10)

	monitor.SetOnStatusChangeCallback(func(oldStatus, newStatus NetworkStatus) {
		statusChanges <- string(oldStatus) + "->" + string(newStatus)
	})

	monitor.SetOnOnlineCallback(func() {
		onlineEvents <- true
	})

	monitor.SetOnOfflineCallback(func() {
		offlineEvents <- true
	})

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait for initial online status
	time.Sleep(100 * time.Millisecond)

	// Should be online
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online initially")
	}

	// Make server go offline
	serverOnline = false

	// Force a check
	monitor.ForceCheck()
	time.Sleep(100 * time.Millisecond)

	// Should be offline now
	if monitor.IsOnline() {
		t.Errorf("Expected monitor to be offline after server went down")
	}

	// Check that we received offline event
	select {
	case <-offlineEvents:
		// Good, received offline event
	case <-time.After(1 * time.Second):
		t.Errorf("Did not receive offline event")
	}

	// Make server come back online
	serverOnline = true

	// Force a check
	monitor.ForceCheck()
	time.Sleep(100 * time.Millisecond)

	// Should be online again
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online after server came back")
	}

	// Check that we received online event
	select {
	case <-onlineEvents:
		// Good, received online event
	case <-time.After(1 * time.Second):
		t.Errorf("Did not receive online event")
	}
}

func TestNetworkMonitor_ForceCheck(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Force check before starting (should work)
	if err := monitor.ForceCheck(); err != nil {
		t.Errorf("Force check failed: %v", err)
	}

	// Should be online
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online after force check")
	}

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Get initial metrics
	initialMetrics := monitor.GetMetrics()

	// Force another check
	if err := monitor.ForceCheck(); err != nil {
		t.Errorf("Force check failed after start: %v", err)
	}

	// Metrics should have been updated
	newMetrics := monitor.GetMetrics()
	if newMetrics.TotalChecks <= initialMetrics.TotalChecks {
		t.Errorf("Expected total checks to increase after force check")
	}
}

func TestNetworkMonitor_WaitForOnline(t *testing.T) {
	// Create test server that starts offline
	serverOnline := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" && serverOnline {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait a bit for initial check
	time.Sleep(100 * time.Millisecond)

	// Should be offline
	if monitor.IsOnline() {
		t.Errorf("Expected monitor to be offline initially")
	}

	// Start a goroutine to bring server online after delay
	go func() {
		time.Sleep(500 * time.Millisecond)
		serverOnline = true
		monitor.ForceCheck() // Force immediate check
	}()

	// Wait for online with timeout
	_, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	start := time.Now()
	err = monitor.WaitForOnline(2 * time.Second)
	elapsed := time.Since(start)

	if err != nil {
		t.Errorf("WaitForOnline failed: %v", err)
	}

	if elapsed > 1*time.Second {
		t.Errorf("WaitForOnline took too long: %v", elapsed)
	}

	// Should be online now
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online after wait")
	}
}

func TestNetworkMonitor_WaitForOnlineTimeout(t *testing.T) {
	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config with invalid URL
	platformConfig := config.PlatformConfig{
		BaseURL: "http://invalid-host:9999",
		Timeout: 1,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait for online with short timeout (should timeout)
	start := time.Now()
	err = monitor.WaitForOnline(500 * time.Millisecond)
	elapsed := time.Since(start)

	if err == nil {
		t.Errorf("Expected WaitForOnline to timeout")
	}

	if elapsed < 400*time.Millisecond || elapsed > 600*time.Millisecond {
		t.Errorf("WaitForOnline timeout took unexpected time: %v", elapsed)
	}
}

func TestNetworkMonitor_Metrics(t *testing.T) {
	// Create test server
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.URL.Path == "/api/v1/health" {
			if requestCount <= 2 {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			} else if requestCount <= 4 {
				w.WriteHeader(http.StatusServiceUnavailable)
			} else {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			}
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Perform several checks manually
	for i := 0; i < 5; i++ {
		monitor.ForceCheck()
		time.Sleep(50 * time.Millisecond)
	}

	// Check metrics
	metrics := monitor.GetMetrics()

	if metrics.TotalChecks != 5 {
		t.Errorf("Expected 5 total checks, got %d", metrics.TotalChecks)
	}

	if metrics.SuccessfulChecks != 3 {
		t.Errorf("Expected 3 successful checks, got %d", metrics.SuccessfulChecks)
	}

	if metrics.FailedChecks != 2 {
		t.Errorf("Expected 2 failed checks, got %d", metrics.FailedChecks)
	}

	expectedUptime := float64(3) / float64(5) * 100 // 60%
	if metrics.UpTimePercent != expectedUptime {
		t.Errorf("Expected uptime %.2f%%, got %.2f%%", expectedUptime, metrics.UpTimePercent)
	}

	// Should be online (last checks were successful)
	if metrics.Status != NetworkStatusOnline {
		t.Errorf("Expected status to be online, got %s", metrics.Status)
	}

	if metrics.ConsecutiveSuccesses == 0 {
		t.Errorf("Expected consecutive successes > 0")
	}

	if metrics.ResponseTime == 0 {
		t.Errorf("Expected response time to be set")
	}
}

func TestNetworkMonitor_StopAndRestart(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create network monitor
	monitor := NewNetworkMonitor(platformConfig, log)

	// Start monitor
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to start monitor: %v", err)
	}

	// Wait for initial check
	time.Sleep(100 * time.Millisecond)

	// Should be online
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online")
	}

	// Stop monitor
	monitor.Stop()

	// Start again
	if err := monitor.Start(); err != nil {
		t.Fatalf("Failed to restart monitor: %v", err)
	}
	defer monitor.Stop()

	// Wait for check
	time.Sleep(100 * time.Millisecond)

	// Should still be online
	if !monitor.IsOnline() {
		t.Errorf("Expected monitor to be online after restart")
	}
}