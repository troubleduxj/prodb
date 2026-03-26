package tdengine

import (
	"context"
	"testing"
	"time"
)

func TestTDengineConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  *TDengineConfig
		wantErr bool
	}{
		{
			name:    "valid config",
			config:  DefaultTDengineConfig(),
			wantErr: false,
		},
		{
			name: "empty host",
			config: &TDengineConfig{
				Host:         "",
				Port:         6030,
				Username:     "root",
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			config: &TDengineConfig{
				Host:         "localhost",
				Port:         0,
				Username:     "root",
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			wantErr: true,
		},
		{
			name: "empty username",
			config: &TDengineConfig{
				Host:         "localhost",
				Port:         6030,
				Username:     "",
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			wantErr: true,
		},
		{
			name: "invalid max connections",
			config: &TDengineConfig{
				Host:         "localhost",
				Port:         6030,
				Username:     "root",
				MaxOpenConns: 0,
				MaxIdleConns: 5,
			},
			wantErr: true,
		},
		{
			name: "idle connections greater than max",
			config: &TDengineConfig{
				Host:         "localhost",
				Port:         6030,
				Username:     "root",
				MaxOpenConns: 5,
				MaxIdleConns: 10,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("TDengineConfig.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestDefaultTDengineConfig(t *testing.T) {
	config := DefaultTDengineConfig()
	
	if config == nil {
		t.Fatal("DefaultTDengineConfig() returned nil")
	}
	
	if err := config.Validate(); err != nil {
		t.Errorf("Default config validation failed: %v", err)
	}
	
	// Check default values
	if config.Host != "localhost" {
		t.Errorf("Expected host 'localhost', got '%s'", config.Host)
	}
	
	if config.Port != 6030 {
		t.Errorf("Expected port 6030, got %d", config.Port)
	}
	
	if config.Username != "root" {
		t.Errorf("Expected username 'root', got '%s'", config.Username)
	}
	
	if config.MaxOpenConns <= 0 {
		t.Errorf("Expected positive MaxOpenConns, got %d", config.MaxOpenConns)
	}
	
	if config.MaxIdleConns < 0 {
		t.Errorf("Expected non-negative MaxIdleConns, got %d", config.MaxIdleConns)
	}
}

func TestTDengineManager_Creation(t *testing.T) {
	// Test with nil config (should use default)
	manager, err := NewTDengineManager(nil)
	if err == nil {
		// If no error, the manager should be created with default config
		if manager == nil {
			t.Error("Expected manager to be created with default config")
		} else {
			manager.Stop() // Clean up
		}
	}
	
	// Test with valid config
	config := DefaultTDengineConfig()
	manager, err = NewTDengineManager(config)
	if err == nil {
		if manager == nil {
			t.Error("Expected manager to be created")
		} else {
			manager.Stop() // Clean up
		}
	}
	
	// Test with invalid config
	invalidConfig := &TDengineConfig{
		Host: "", // Invalid empty host
	}
	manager, err = NewTDengineManager(invalidConfig)
	if err == nil {
		t.Error("Expected error for invalid config")
		if manager != nil {
			manager.Stop()
		}
	}
}

func TestTDengineManager_ConfigOperations(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	// Test GetConfig
	retrievedConfig := manager.GetConfig()
	if retrievedConfig == nil {
		t.Error("GetConfig() returned nil")
	}
	
	if retrievedConfig.Host != config.Host {
		t.Errorf("Expected host '%s', got '%s'", config.Host, retrievedConfig.Host)
	}
	
	// Test UpdateConfig with valid config
	newConfig := DefaultTDengineConfig()
	newConfig.MaxOpenConns = 20
	
	err = manager.UpdateConfig(newConfig)
	if err != nil {
		t.Errorf("UpdateConfig() failed: %v", err)
	}
	
	// Test UpdateConfig with invalid config
	invalidConfig := &TDengineConfig{
		Host: "", // Invalid
	}
	
	err = manager.UpdateConfig(invalidConfig)
	if err == nil {
		t.Error("Expected error for invalid config update")
	}
}

func TestTDengineManager_HealthCheck(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	// Test initial health status
	status := manager.GetHealthStatus()
	if status == nil {
		t.Error("GetHealthStatus() returned nil")
	}
	
	// Test IsHealthy
	healthy := manager.IsHealthy()
	t.Logf("Initial health status: %v", healthy)
	
	// Test ForceHealthCheck
	status = manager.ForceHealthCheck()
	if status == nil {
		t.Error("ForceHealthCheck() returned nil")
	}
	
	if status.LastCheck.IsZero() {
		t.Error("Expected LastCheck to be set")
	}
}

func TestTDengineManager_Metrics(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	// Test GetMetrics
	metrics := manager.GetMetrics()
	if metrics == nil {
		t.Error("GetMetrics() returned nil")
	}
	
	// Test GetPoolStats
	poolStats := manager.GetPoolStats()
	if poolStats == nil {
		t.Error("GetPoolStats() returned nil")
	}
	
	t.Logf("Pool stats: Active=%d, Total=%d", 
		poolStats.ActiveConnections, poolStats.TotalConnections)
}

func TestTDengineManager_ConnectionOperations(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	// Test GetConnection and ReleaseConnection
	conn, err := manager.GetConnection(ctx)
	if err != nil {
		t.Skipf("Skipping connection test due to error: %v", err)
	} else {
		// Test that connection is valid
		if conn == nil {
			t.Error("GetConnection() returned nil connection")
		}
		
		// Release the connection
		manager.ReleaseConnection(conn)
	}
	
	// Test Ping
	err = manager.Ping(ctx)
	if err != nil {
		t.Logf("Ping failed (expected if TDengine not available): %v", err)
	}
}

func TestTDengineManager_Lifecycle(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	
	// Test Start
	err = manager.Start()
	if err != nil {
		t.Logf("Start failed (expected if TDengine not available): %v", err)
	}
	
	// Test Stop
	err = manager.Stop()
	if err != nil {
		t.Errorf("Stop() failed: %v", err)
	}
	
	// Test operations after stop should fail
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	_, err = manager.GetConnection(ctx)
	if err == nil {
		t.Error("Expected error when getting connection from stopped manager")
	}
}

func TestTDengineManager_EventCallbacks(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	var connectCalled, disconnectCalled bool
	var errorCalled bool
	
	manager.SetEventCallbacks(
		func() { connectCalled = true },
		func() { disconnectCalled = true },
		func(error) { errorCalled = true },
	)
	
	// Use the errorCalled variable to avoid unused variable error
	_ = errorCalled
	
	// Start should trigger connect callback if successful
	err = manager.Start()
	if err == nil && !connectCalled {
		t.Error("Expected connect callback to be called")
	}
	
	// Stop should trigger disconnect callback
	manager.Stop()
	if !disconnectCalled {
		t.Error("Expected disconnect callback to be called")
	}
}

func TestReconnectManager_Stats(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test due to connection error: %v", err)
	}
	defer manager.Stop()
	
	// Test GetReconnectStats
	count, lastAttempt := manager.GetReconnectStats()
	t.Logf("Reconnect stats: count=%d, lastAttempt=%v", count, lastAttempt)
	
	// Test IsReconnecting
	isReconnecting := manager.IsReconnecting()
	t.Logf("Is reconnecting: %v", isReconnecting)
}

// Benchmark tests
func BenchmarkTDengineManager_GetConnection(b *testing.B) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		b.Skipf("Skipping benchmark due to connection error: %v", err)
	}
	defer manager.Stop()
	
	ctx := context.Background()
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			conn, err := manager.GetConnection(ctx)
			if err == nil {
				manager.ReleaseConnection(conn)
			}
		}
	})
}

func BenchmarkTDengineManager_HealthCheck(b *testing.B) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		b.Skipf("Skipping benchmark due to connection error: %v", err)
	}
	defer manager.Stop()
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.ForceHealthCheck()
	}
}