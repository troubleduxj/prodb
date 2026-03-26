package tdengine

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFailureRecovery_RecordFailure(t *testing.T) {
	// Create temporary directory for testing
	tempDir := filepath.Join(os.TempDir(), "test_recovery")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir
	config.QueueSize = 2 // Small queue to test overflow

	// Create mock data writer
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	// Create failure recovery system
	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	// Test recording failure
	dataPoints := []DataPoint{
		{
			DeviceID:  "test_device",
			PointName: "test_metric",
			Timestamp: time.Now(),
			Value:     42.0,
			Quality:   1,
		},
	}

	testErr := fmt.Errorf("test error")
	err = fr.RecordFailure("test_db", "test_table", dataPoints, testErr)
	if err != nil {
		t.Errorf("RecordFailure failed: %v", err)
	}

	// Verify failure was recorded
	stats := fr.GetFailureStats()
	if stats["queue_length"].(int) == 0 && stats["persisted_count"].(int) == 0 {
		t.Error("Expected failure to be recorded in queue or persisted")
	}
}

func TestFailureRecovery_StartStop(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_recovery_start_stop")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	ctx := context.Background()

	// Test start
	err = fr.Start(ctx)
	if err != nil {
		t.Errorf("Start failed: %v", err)
	}

	// Verify running state
	stats := fr.GetFailureStats()
	if !stats["is_running"].(bool) {
		t.Error("Expected failure recovery to be running")
	}

	// Test stop
	err = fr.Stop()
	if err != nil {
		t.Errorf("Stop failed: %v", err)
	}

	// Verify stopped state
	stats = fr.GetFailureStats()
	if stats["is_running"].(bool) {
		t.Error("Expected failure recovery to be stopped")
	}
}

func TestFailureRecovery_RetryFailedWrite(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_recovery_retry")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir
	config.MaxRetries = 2

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	tdConfig.Host = "localhost"
	tdConfig.Port = 6030

	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	ctx := context.Background()

	// Create a failed write
	failedWrite := &FailedWrite{
		ID:         "test_failed_write",
		Database:   "test_db",
		SuperTable: "test_metrics",
		DataPoints: []DataPoint{
			{
				DeviceID:  "retry_device",
				PointName: "retry_metric",
				Timestamp: time.Now(),
				Value:     123.45,
				Quality:   1,
				Tags: map[string]interface{}{
					"collector_id": "retry_collector",
				},
			},
		},
		FailedAt:   time.Now(),
		RetryCount: 0,
		LastError:  "initial error",
		Priority:   1,
	}

	// Test retry
	err = fr.RetryFailedWrite(ctx, failedWrite)
	// Note: This might fail if TDengine is not properly set up, but we're testing the retry logic
	if err != nil {
		t.Logf("Retry failed as expected in test environment: %v", err)
	}

	// Verify retry count was incremented
	if failedWrite.RetryCount != 1 {
		t.Errorf("Expected retry count 1, got %d", failedWrite.RetryCount)
	}
}

func TestFailureRecovery_ListFailedWrites(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_recovery_list")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	// Record some failures
	dataPoints := []DataPoint{
		{
			DeviceID:  "list_device",
			PointName: "list_metric",
			Timestamp: time.Now(),
			Value:     99.9,
			Quality:   1,
		},
	}

	testErr := fmt.Errorf("list test error")
	
	// Record multiple failures
	for i := 0; i < 3; i++ {
		err = fr.RecordFailure("test_db", "test_table", dataPoints, testErr)
		if err != nil {
			t.Errorf("RecordFailure %d failed: %v", i, err)
		}
	}

	// List failed writes
	failedWrites, err := fr.ListFailedWrites()
	if err != nil {
		t.Errorf("ListFailedWrites failed: %v", err)
	}

	if len(failedWrites) == 0 {
		t.Error("Expected some failed writes to be listed")
	}

	// Verify failed write structure
	for _, fw := range failedWrites {
		if fw.ID == "" {
			t.Error("Failed write should have an ID")
		}
		if fw.Database == "" {
			t.Error("Failed write should have a database")
		}
		if len(fw.DataPoints) == 0 {
			t.Error("Failed write should have data points")
		}
	}
}

func TestFailureRecovery_PersistenceAndRecovery(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_recovery_persistence")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir
	config.QueueSize = 1 // Force persistence

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	// Record failures to force persistence
	dataPoints := []DataPoint{
		{
			DeviceID:  "persist_device",
			PointName: "persist_metric",
			Timestamp: time.Now(),
			Value:     77.7,
			Quality:   1,
		},
	}

	testErr := fmt.Errorf("persistence test error")
	
	// Record multiple failures to exceed queue size
	for i := 0; i < 3; i++ {
		err = fr.RecordFailure("test_db", "test_table", dataPoints, testErr)
		if err != nil {
			t.Errorf("RecordFailure %d failed: %v", i, err)
		}
	}

	// Check that files were created
	files, err := filepath.Glob(filepath.Join(tempDir, "*.json"))
	if err != nil {
		t.Errorf("Failed to list recovery files: %v", err)
	}

	if len(files) == 0 {
		t.Error("Expected recovery files to be created")
	}

	// Create new failure recovery instance to test loading
	fr2, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create second failure recovery: %v", err)
	}

	ctx := context.Background()
	err = fr2.Start(ctx)
	if err != nil {
		t.Errorf("Failed to start second failure recovery: %v", err)
	}
	defer fr2.Stop()

	// Verify that persisted failures were loaded
	stats := fr2.GetFailureStats()
	totalFailures := stats["queue_length"].(int) + stats["persisted_count"].(int)
	if totalFailures == 0 {
		t.Error("Expected persisted failures to be loaded")
	}
}

func TestFailureRecovery_GetFailureStats(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_recovery_stats")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		t.Fatalf("Failed to create failure recovery: %v", err)
	}

	// Get initial stats
	stats := fr.GetFailureStats()
	if stats == nil {
		t.Fatal("Stats should not be nil")
	}

	// Verify stats structure
	expectedKeys := []string{"queue_length", "persisted_count", "is_running", "max_retries", "retry_interval"}
	for _, key := range expectedKeys {
		if _, exists := stats[key]; !exists {
			t.Errorf("Expected stats key '%s' not found", key)
		}
	}

	// Verify initial values
	if stats["queue_length"].(int) != 0 {
		t.Errorf("Expected initial queue_length 0, got %d", stats["queue_length"])
	}

	if stats["is_running"].(bool) {
		t.Error("Expected is_running false initially")
	}

	if stats["max_retries"].(int) != config.MaxRetries {
		t.Errorf("Expected max_retries %d, got %d", config.MaxRetries, stats["max_retries"])
	}
}

func BenchmarkFailureRecovery_RecordFailure(b *testing.B) {
	tempDir := filepath.Join(os.TempDir(), "bench_recovery")
	defer os.RemoveAll(tempDir)

	config := DefaultRecoveryConfig()
	config.RecoveryDir = tempDir
	config.QueueSize = 10000 // Large queue to avoid persistence overhead

	// Create mock components
	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		b.Skipf("Skipping benchmark - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	dataWriter := NewDataWriter(service, DefaultWriterConfig())

	fr, err := NewFailureRecovery(dataWriter, config)
	if err != nil {
		b.Fatalf("Failed to create failure recovery: %v", err)
	}

	dataPoints := []DataPoint{
		{
			DeviceID:  "bench_device",
			PointName: "bench_metric",
			Timestamp: time.Now(),
			Value:     42.0,
			Quality:   1,
		},
	}

	testErr := fmt.Errorf("benchmark error")

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		err := fr.RecordFailure("bench_db", "bench_table", dataPoints, testErr)
		if err != nil {
			b.Errorf("RecordFailure failed: %v", err)
		}
	}
}
