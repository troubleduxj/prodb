package heartbeat

import (
	"context"
	"fmt"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// MockPlatformClient for testing
type MockPlatformClient struct {
	heartbeats []HeartbeatCall
	shouldFail bool
}

type HeartbeatCall struct {
	CollectorID string
	Status      string
	Metrics     map[string]interface{}
	Timestamp   time.Time
}

func (mpc *MockPlatformClient) SendHeartbeat(collectorID string, status string, metrics map[string]interface{}) error {
	mpc.heartbeats = append(mpc.heartbeats, HeartbeatCall{
		CollectorID: collectorID,
		Status:      status,
		Metrics:     metrics,
		Timestamp:   time.Now(),
	})
	
	if mpc.shouldFail {
		return fmt.Errorf("mock error")
	}
	
	return nil
}

func TestHeartbeatManager_Basic(t *testing.T) {
	// Create test configuration
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-001",
		HeartbeatInterval: 1, // 1 second for fast testing
	}
	
	// Create logger
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	
	// Create mock platform client
	mockClient := &MockPlatformClient{}
	
	// Create heartbeat manager
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Test initial state
	if hm.IsRunning() {
		t.Error("Heartbeat manager should not be running initially")
	}
	
	if !hm.IsEnabled() {
		t.Error("Heartbeat manager should be enabled by default")
	}
	
	// Test start
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	err = hm.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start heartbeat manager: %v", err)
	}
	
	if !hm.IsRunning() {
		t.Error("Heartbeat manager should be running after start")
	}
	
	// Wait for a few heartbeats
	time.Sleep(1100 * time.Millisecond)
	
	// Stop the manager
	hm.Stop()
	
	if hm.IsRunning() {
		t.Error("Heartbeat manager should not be running after stop")
	}
	
	// Check that heartbeats were sent
	if len(mockClient.heartbeats) < 2 {
		t.Errorf("Expected at least 2 heartbeats, got %d", len(mockClient.heartbeats))
	}
	
	// Check first heartbeat (starting)
	firstHeartbeat := mockClient.heartbeats[0]
	if firstHeartbeat.Status != "starting" {
		t.Errorf("Expected first heartbeat status 'starting', got '%s'", firstHeartbeat.Status)
	}
	
	if firstHeartbeat.CollectorID != cfg.CollectorID {
		t.Errorf("Expected collector ID '%s', got '%s'", cfg.CollectorID, firstHeartbeat.CollectorID)
	}
	
	// Check that metrics are included
	if firstHeartbeat.Metrics == nil {
		t.Error("Expected metrics in heartbeat")
	}
	
	// Check for required metrics
	requiredMetrics := []string{"cpu_usage", "memory_usage", "uptime", "goroutines"}
	for _, metric := range requiredMetrics {
		if _, exists := firstHeartbeat.Metrics[metric]; !exists {
			t.Errorf("Expected metric '%s' in heartbeat", metric)
		}
	}
}

func TestHeartbeatManager_ManualHeartbeat(t *testing.T) {
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-002",
		HeartbeatInterval: 60, // Long interval to avoid automatic heartbeats
	}
	
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mockClient := &MockPlatformClient{}
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Send manual heartbeat
	additionalMetrics := map[string]interface{}{
		"custom_metric": 42.0,
		"test_data":     "hello",
	}
	
	err := hm.SendHeartbeat("testing", additionalMetrics)
	if err != nil {
		t.Fatalf("Failed to send manual heartbeat: %v", err)
	}
	
	// Check heartbeat was sent
	if len(mockClient.heartbeats) != 1 {
		t.Errorf("Expected 1 heartbeat, got %d", len(mockClient.heartbeats))
	}
	
	heartbeat := mockClient.heartbeats[0]
	if heartbeat.Status != "testing" {
		t.Errorf("Expected status 'testing', got '%s'", heartbeat.Status)
	}
	
	// Check additional metrics were included
	if heartbeat.Metrics["custom_metric"] != 42.0 {
		t.Errorf("Expected custom_metric 42.0, got %v", heartbeat.Metrics["custom_metric"])
	}
	
	if heartbeat.Metrics["test_data"] != "hello" {
		t.Errorf("Expected test_data 'hello', got %v", heartbeat.Metrics["test_data"])
	}
}

func TestHeartbeatManager_EnableDisable(t *testing.T) {
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-003",
		HeartbeatInterval: 60,
	}
	
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mockClient := &MockPlatformClient{}
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Disable heartbeat
	hm.Disable()
	if hm.IsEnabled() {
		t.Error("Heartbeat should be disabled")
	}
	
	// Try to send heartbeat while disabled
	err := hm.SendHeartbeat("testing", nil)
	if err == nil {
		t.Error("Expected error when sending heartbeat while disabled")
	}
	
	// Enable heartbeat
	hm.Enable()
	if !hm.IsEnabled() {
		t.Error("Heartbeat should be enabled")
	}
	
	// Send heartbeat while enabled
	err = hm.SendHeartbeat("testing", nil)
	if err != nil {
		t.Errorf("Unexpected error when sending heartbeat while enabled: %v", err)
	}
}

func TestHeartbeatManager_Statistics(t *testing.T) {
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-004",
		HeartbeatInterval: 60,
	}
	
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mockClient := &MockPlatformClient{}
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Initial stats
	stats := hm.GetStats()
	if stats.TotalSent != 0 {
		t.Errorf("Expected TotalSent 0, got %d", stats.TotalSent)
	}
	
	// Send successful heartbeat
	err := hm.SendHeartbeat("testing", nil)
	if err != nil {
		t.Fatalf("Failed to send heartbeat: %v", err)
	}
	
	stats = hm.GetStats()
	if stats.TotalSent != 1 {
		t.Errorf("Expected TotalSent 1, got %d", stats.TotalSent)
	}
	
	if stats.TotalFailed != 0 {
		t.Errorf("Expected TotalFailed 0, got %d", stats.TotalFailed)
	}
	
	if stats.ConsecutiveFails != 0 {
		t.Errorf("Expected ConsecutiveFails 0, got %d", stats.ConsecutiveFails)
	}
	
	// Simulate failure
	mockClient.shouldFail = true
	err = hm.SendHeartbeat("testing", nil)
	if err == nil {
		t.Error("Expected error from mock client")
	}
	
	stats = hm.GetStats()
	if stats.TotalSent != 2 {
		t.Errorf("Expected TotalSent 2, got %d", stats.TotalSent)
	}
	
	if stats.TotalFailed != 1 {
		t.Errorf("Expected TotalFailed 1, got %d", stats.TotalFailed)
	}
	
	if stats.ConsecutiveFails != 1 {
		t.Errorf("Expected ConsecutiveFails 1, got %d", stats.ConsecutiveFails)
	}
}

func TestHeartbeatManager_IntervalUpdate(t *testing.T) {
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-005",
		HeartbeatInterval: 60,
	}
	
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mockClient := &MockPlatformClient{}
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Test interval update
	newInterval := 30 * time.Second
	hm.SetInterval(newInterval)
	
	// The interval should be updated (we can't easily test the actual timing without complex mocking)
	// This test mainly ensures the method doesn't panic and accepts the new interval
}

func TestMetricsCollector(t *testing.T) {
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mc := &MetricsCollector{
		logger:    logger,
		startTime: time.Now(),
	}
	
	metrics := mc.CollectMetrics()
	
	// Check that metrics are collected
	if metrics == nil {
		t.Fatal("Expected metrics, got nil")
	}
	
	if metrics.Timestamp.IsZero() {
		t.Error("Expected timestamp to be set")
	}
	
	if metrics.GoRoutines <= 0 {
		t.Error("Expected positive number of goroutines")
	}
	
	if metrics.MemoryUsage <= 0 {
		t.Error("Expected positive memory usage")
	}
	
	if metrics.Uptime < 0 {
		t.Error("Expected non-negative uptime")
	}
}

func TestHeartbeatManager_HealthStatus(t *testing.T) {
	cfg := &config.CollectorConfig{
		CollectorID:       "test-collector-006",
		HeartbeatInterval: 60,
	}
	
	logger, _ := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text"})
	mockClient := &MockPlatformClient{}
	hm := NewHeartbeatManager(cfg, mockClient, logger)
	
	// Initial health status
	health := hm.GetHealthStatus()
	if health["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%v'", health["status"])
	}
	
	// Simulate failures to change health status
	mockClient.shouldFail = true
	for i := 0; i < 5; i++ {
		hm.SendHeartbeat("testing", nil)
	}
	
	health = hm.GetHealthStatus()
	if health["status"] != "unhealthy" {
		t.Errorf("Expected status 'unhealthy' after failures, got '%v'", health["status"])
	}
	
	if health["consecutive_fails"].(int) != 5 {
		t.Errorf("Expected 5 consecutive fails, got %v", health["consecutive_fails"])
	}
}