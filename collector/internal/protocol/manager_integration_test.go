package protocol

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// TestProtocolManagerLifecycle tests the complete lifecycle
func TestProtocolManagerLifecycle(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)
	require.NotNil(t, mgr)

	ctx := context.Background()

	// Start manager
	err = mgr.Start(ctx)
	require.NoError(t, err)

	// Stop manager
	mgr.Stop()
}

// TestProtocolManagerRegisterProtocol tests protocol registration
func TestProtocolManagerRegisterProtocol(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Register a mock protocol
	mockProtocol := &MockProtocol{
		name: "test-protocol",
	}

	err = mgr.RegisterProtocol("test-protocol", mockProtocol)
	require.NoError(t, err)

	// Verify protocol is registered
	protocol, err := mgr.GetProtocol("test-protocol")
	require.NoError(t, err)
	assert.Equal(t, mockProtocol, protocol)
}

// TestProtocolManagerRegisterDuplicate tests duplicate protocol registration
func TestProtocolManagerRegisterDuplicate(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	mockProtocol := &MockProtocol{name: "test-protocol"}

	// Register first time
	err = mgr.RegisterProtocol("test-protocol", mockProtocol)
	require.NoError(t, err)

	// Register again should error
	err = mgr.RegisterProtocol("test-protocol", mockProtocol)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
}

// TestProtocolManagerGetNonExistent tests getting non-existent protocol
func TestProtocolManagerGetNonExistent(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Try to get non-existent protocol
	protocol, err := mgr.GetProtocol("non-existent")
	assert.Error(t, err)
	assert.Nil(t, protocol)
	assert.Contains(t, err.Error(), "not found")
}

// TestProtocolManagerListProtocols tests listing protocols
func TestProtocolManagerListProtocols(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Register multiple protocols
	protocols := []string{"opcua", "modbus", "mqtt"}
	for _, name := range protocols {
		err := mgr.RegisterProtocol(name, &MockProtocol{name: name})
		require.NoError(t, err)
	}

	// List protocols
	list := mgr.ListProtocols()
	assert.Len(t, list, len(protocols))

	// Verify all protocols are in the list
	for _, name := range protocols {
		assert.Contains(t, list, name)
	}
}

// TestProtocolManagerUnregisterProtocol tests protocol unregistration
func TestProtocolManagerUnregisterProtocol(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Register protocol
	err = mgr.RegisterProtocol("test-protocol", &MockProtocol{name: "test-protocol"})
	require.NoError(t, err)

	// Unregister protocol
	err = mgr.UnregisterProtocol("test-protocol")
	require.NoError(t, err)

	// Verify protocol is unregistered
	_, err = mgr.GetProtocol("test-protocol")
	assert.Error(t, err)
}

// TestProtocolManagerUnregisterNonExistent tests unregistering non-existent protocol
func TestProtocolManagerUnregisterNonExistent(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Try to unregister non-existent protocol
	err = mgr.UnregisterProtocol("non-existent")
	assert.Error(t, err)
}

// TestProtocolManagerConcurrentAccess tests concurrent access
func TestProtocolManagerConcurrentAccess(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Register some protocols
	for i := 0; i < 5; i++ {
		name := string(rune('a' + i))
		err := mgr.RegisterProtocol(name, &MockProtocol{name: name})
		require.NoError(t, err)
	}

	// Concurrent access
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = mgr.ListProtocols()
				_, _ = mgr.GetProtocol("a")
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestProtocolManagerMetrics tests metrics collection
func TestProtocolManagerMetrics(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	// Register protocols
	err = mgr.RegisterProtocol("opcua", &MockProtocol{name: "opcua"})
	require.NoError(t, err)

	ctx := context.Background()
	err = mgr.Start(ctx)
	require.NoError(t, err)
	defer mgr.Stop()

	// Get metrics
	metrics := mgr.GetMetrics()
	assert.NotNil(t, metrics)
}

// TestProtocolManagerStartStop tests start and stop
func TestProtocolManagerStartStop(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	ctx := context.Background()

	// Start
	err = mgr.Start(ctx)
	require.NoError(t, err)

	// Wait a bit
	time.Sleep(100 * time.Millisecond)

	// Stop
	mgr.Stop()
}

// TestProtocolManagerMultipleStarts tests multiple start calls
func TestProtocolManagerMultipleStarts(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	ctx := context.Background()

	// First start
	err = mgr.Start(ctx)
	require.NoError(t, err)

	// Second start should not error
	err = mgr.Start(ctx)
	assert.NoError(t, err)

	mgr.Stop()
}

// TestProtocolManagerMultipleStops tests multiple stop calls
func TestProtocolManagerMultipleStops(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	mgr := NewProtocolManager(log)

	ctx := context.Background()
	err = mgr.Start(ctx)
	require.NoError(t, err)

	// First stop
	mgr.Stop()

	// Second stop should not panic
	assert.NotPanics(t, func() {
		mgr.Stop()
	})
}

// MockProtocol is a mock implementation of Protocol interface for testing
type MockProtocol struct {
	name string
}

func (m *MockProtocol) Name() string {
	return m.name
}

func (m *MockProtocol) Connect(config interface{}) error {
	return nil
}

func (m *MockProtocol) Disconnect() error {
	return nil
}

func (m *MockProtocol) Read(address string) (interface{}, error) {
	return nil, nil
}

func (m *MockProtocol) Write(address string, value interface{}) error {
	return nil
}

func (m *MockProtocol) IsConnected() bool {
	return true
}
