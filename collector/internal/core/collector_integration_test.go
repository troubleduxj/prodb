package core

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCollectorLifecycle tests the complete lifecycle of a collector
func TestCollectorLifecycle(t *testing.T) {
	// Create temporary config file
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	// Create collector
	collector, err := NewCollector(configPath)
	require.NoError(t, err, "Failed to create collector")
	require.NotNil(t, collector, "Collector should not be nil")

	// Verify initial status
	assert.Equal(t, StatusStopped, collector.GetStatus(), "Initial status should be stopped")

	// Start collector
	err = collector.Start()
	require.NoError(t, err, "Failed to start collector")
	assert.Equal(t, StatusRunning, collector.GetStatus(), "Status should be running after start")

	// Wait a bit for collector to initialize
	time.Sleep(100 * time.Millisecond)

	// Verify collector is running
	metrics := collector.GetMetrics()
	assert.NotNil(t, metrics, "Metrics should not be nil")
	assert.Equal(t, "running", metrics.Status, "Metrics status should be running")

	// Stop collector
	err = collector.Stop()
	require.NoError(t, err, "Failed to stop collector")
	assert.Equal(t, StatusStopped, collector.GetStatus(), "Status should be stopped after stop")
}

// TestCollectorStartTwice tests that starting a collector twice returns an error
func TestCollectorStartTwice(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start collector first time
	err = collector.Start()
	require.NoError(t, err)
	defer collector.Stop()

	// Try to start again
	err = collector.Start()
	assert.Error(t, err, "Starting collector twice should return an error")
	assert.Contains(t, err.Error(), "already running", "Error should mention already running")
}

// TestCollectorStopTwice tests that stopping a collector twice is safe
func TestCollectorStopTwice(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start and stop collector
	err = collector.Start()
	require.NoError(t, err)

	err = collector.Stop()
	require.NoError(t, err)

	// Stop again should not error
	err = collector.Stop()
	assert.NoError(t, err, "Stopping collector twice should not error")
}

// TestCollectorMetrics tests collector metrics collection
func TestCollectorMetrics(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start collector
	err = collector.Start()
	require.NoError(t, err)
	defer collector.Stop()

	// Wait for metrics to be collected
	time.Sleep(200 * time.Millisecond)

	// Get metrics
	metrics := collector.GetMetrics()
	require.NotNil(t, metrics, "Metrics should not be nil")

	// Verify metrics
	assert.Equal(t, "running", metrics.Status, "Status should be running")
	assert.Greater(t, metrics.Uptime, int64(0), "Uptime should be greater than 0")
	assert.NotZero(t, metrics.StartTime, "Start time should be set")
}

// TestCollectorStatusTransitions tests status transitions
func TestCollectorStatusTransitions(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Initial status
	assert.Equal(t, StatusStopped, collector.GetStatus())

	// Start collector
	err = collector.Start()
	require.NoError(t, err)

	// Should be running
	assert.Equal(t, StatusRunning, collector.GetStatus())

	// Stop collector
	err = collector.Stop()
	require.NoError(t, err)

	// Should be stopped
	assert.Equal(t, StatusStopped, collector.GetStatus())
}

// TestCollectorProtocolManager tests protocol manager access
func TestCollectorProtocolManager(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Get protocol manager
	protocolMgr := collector.GetProtocolManager()
	assert.NotNil(t, protocolMgr, "Protocol manager should not be nil")
}

// TestCollectorWithInvalidConfig tests collector creation with invalid config
func TestCollectorWithInvalidConfig(t *testing.T) {
	// Try to create collector with non-existent config
	collector, err := NewCollector("/non/existent/config.json")
	assert.Error(t, err, "Should error with invalid config path")
	assert.Nil(t, collector, "Collector should be nil on error")
}

// TestCollectorContextCancellation tests that collector respects context cancellation
func TestCollectorContextCancellation(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start collector
	err = collector.Start()
	require.NoError(t, err)

	// Stop collector (which cancels context)
	err = collector.Stop()
	require.NoError(t, err)

	// Verify status
	assert.Equal(t, StatusStopped, collector.GetStatus())
}

// TestCollectorConcurrentAccess tests concurrent access to collector
func TestCollectorConcurrentAccess(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	err = collector.Start()
	require.NoError(t, err)
	defer collector.Stop()

	// Concurrent status reads
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = collector.GetStatus()
				_ = collector.GetMetrics()
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestCollectorUptime tests uptime calculation
func TestCollectorUptime(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start collector
	err = collector.Start()
	require.NoError(t, err)
	defer collector.Stop()

	// Wait a bit
	time.Sleep(500 * time.Millisecond)

	// Check uptime
	metrics := collector.GetMetrics()
	assert.Greater(t, metrics.Uptime, int64(0), "Uptime should be greater than 0")
	assert.LessOrEqual(t, metrics.Uptime, int64(2), "Uptime should be reasonable")
}

// TestCollectorComponentInitialization tests that all components are initialized
func TestCollectorComponentInitialization(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Verify all components are initialized
	assert.NotNil(t, collector.authManager, "Auth manager should be initialized")
	assert.NotNil(t, collector.protocolMgr, "Protocol manager should be initialized")
	assert.NotNil(t, collector.dataBuffer, "Data buffer should be initialized")
	assert.NotNil(t, collector.storageCache, "Storage cache should be initialized")
	assert.NotNil(t, collector.platformClient, "Platform client should be initialized")
	assert.NotNil(t, collector.syncManager, "Sync manager should be initialized")
	assert.NotNil(t, collector.heartbeatMgr, "Heartbeat manager should be initialized")
	assert.NotNil(t, collector.logger, "Logger should be initialized")
}

// TestCollectorGracefulShutdown tests graceful shutdown
func TestCollectorGracefulShutdown(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start collector
	err = collector.Start()
	require.NoError(t, err)

	// Let it run for a bit
	time.Sleep(200 * time.Millisecond)

	// Stop collector
	startStop := time.Now()
	err = collector.Stop()
	stopDuration := time.Since(startStop)

	require.NoError(t, err, "Stop should not error")
	assert.Less(t, stopDuration, 5*time.Second, "Stop should complete quickly")
	assert.Equal(t, StatusStopped, collector.GetStatus())
}

// TestCollectorMetricsAfterStop tests that metrics are still available after stop
func TestCollectorMetricsAfterStop(t *testing.T) {
	configPath := createTestConfig(t)
	defer os.Remove(configPath)

	collector, err := NewCollector(configPath)
	require.NoError(t, err)

	// Start and stop collector
	err = collector.Start()
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	err = collector.Stop()
	require.NoError(t, err)

	// Metrics should still be available
	metrics := collector.GetMetrics()
	assert.NotNil(t, metrics, "Metrics should be available after stop")
	assert.Equal(t, "stopped", metrics.Status)
}

// Helper function to create a test configuration file
func createTestConfig(t *testing.T) string {
	t.Helper()

	configContent := `{
		"collector_id": "test-collector-001",
		"platform": {
			"url": "http://localhost:8080",
			"api_key": "test-api-key",
			"timeout": 30,
			"retry_count": 3,
			"retry_delay": 5
		},
		"auth": {
			"enabled": true,
			"token_refresh_interval": 3600
		},
		"buffer": {
			"max_size": 10000,
			"flush_interval": 5,
			"flush_batch_size": 100
		},
		"storage": {
			"enabled": true,
			"path": "./test_data",
			"max_size_mb": 100,
			"retention_days": 7
		},
		"logger": {
			"level": "info",
			"format": "json",
			"output": "stdout"
		},
		"heartbeat": {
			"enabled": true,
			"interval": 30,
			"timeout": 10
		}
	}`

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test_config.json")

	err := os.WriteFile(configPath, []byte(configContent), 0644)
	require.NoError(t, err, "Failed to create test config file")

	return configPath
}
