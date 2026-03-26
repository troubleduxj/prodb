package tdengine

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestHighPerformanceWriter_WriteData(t *testing.T) {
	// Create temporary directory for recovery
	tempDir := filepath.Join(os.TempDir(), "test_hp_writer")
	defer os.RemoveAll(tempDir)

	// Configure high-performance writer
	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	// Create TDengine service
	tdConfig := DefaultTDengineConfig()
	tdConfig.Host = "localhost"
	tdConfig.Port = 6030

	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	// Create high-performance writer
	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx := context.Background()

	// Start the writer
	err = hpw.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	// Create test data
	dataPoints := []DataPoint{
		{
			DeviceID:  "hp_device_001",
			PointName: "hp_temperature",
			Timestamp: time.Now(),
			Value:     25.5,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "hp_collector_001",
				"location":     "hp_workshop_a",
			},
		},
		{
			DeviceID:  "hp_device_001",
			PointName: "hp_pressure",
			Timestamp: time.Now(),
			Value:     1013.25,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "hp_collector_001",
				"location":     "hp_workshop_a",
			},
		},
	}

	// Test write data
	result, err := hpw.WriteData(ctx, "test_db", "test_metrics", dataPoints)
	if err != nil {
		t.Errorf("WriteData failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}

	if !result.Success {
		t.Errorf("Expected success=true, got %v", result.Success)
	}

	if result.RecordsWritten != 2 {
		t.Errorf("Expected 2 records written, got %d", result.RecordsWritten)
	}

	// Verify metrics
	metrics := hpw.GetMetrics()
	if metrics.TotalWrites == 0 {
		t.Error("Expected TotalWrites > 0")
	}

	if metrics.SuccessfulWrites == 0 {
		t.Error("Expected SuccessfulWrites > 0")
	}
}

func TestHighPerformanceWriter_WriteBatch(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_batch")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	tdConfig := DefaultTDengineConfig()
	tdConfig.Host = "localhost"
	tdConfig.Port = 6030

	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx := context.Background()
	err = hpw.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	// Create batch data
	batches := []BatchData{
		{
			Database:   "test_db",
			SuperTable: "test_metrics",
			DataPoints: []DataPoint{
				{
					DeviceID:  "batch_device_001",
					PointName: "batch_temperature",
					Timestamp: time.Now(),
					Value:     22.3,
					Quality:   1,
					Tags: map[string]interface{}{
						"collector_id": "batch_collector_001",
					},
				},
			},
			CollectorID: "batch_collector_001",
		},
		{
			Database:   "test_db",
			SuperTable: "test_metrics",
			DataPoints: []DataPoint{
				{
					DeviceID:  "batch_device_002",
					PointName: "batch_humidity",
					Timestamp: time.Now(),
					Value:     65.2,
					Quality:   1,
					Tags: map[string]interface{}{
						"collector_id": "batch_collector_002",
					},
				},
			},
			CollectorID: "batch_collector_002",
		},
	}

	// Test batch write
	result, err := hpw.WriteBatch(ctx, batches)
	if err != nil {
		t.Errorf("WriteBatch failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}

	if !result.Success {
		t.Errorf("Expected success=true, got %v", result.Success)
	}

	if result.RecordsWritten != 2 {
		t.Errorf("Expected 2 records written, got %d", result.RecordsWritten)
	}
}

func TestHighPerformanceWriter_WriteStream(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_stream")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir
	config.WriterConfig.BatchSize = 2
	config.WriterConfig.FlushTimeout = 1 * time.Second

	tdConfig := DefaultTDengineConfig()
	tdConfig.Host = "localhost"
	tdConfig.Port = 6030

	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = hpw.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	// Create data channel
	dataChannel := make(chan DataPoint, 10)

	// Start streaming in a goroutine
	go func() {
		err := hpw.WriteStream(ctx, "test_db", "test_metrics", dataChannel)
		if err != nil && err != context.DeadlineExceeded {
			t.Errorf("WriteStream failed: %v", err)
		}
	}()

	// Send test data
	for i := 0; i < 5; i++ {
		dataPoint := DataPoint{
			DeviceID:  "stream_device",
			PointName: "stream_value",
			Timestamp: time.Now(),
			Value:     float64(i * 10),
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "stream_collector",
			},
		}

		select {
		case dataChannel <- dataPoint:
		case <-ctx.Done():
			t.Fatal("Context cancelled while sending data")
		}

		time.Sleep(100 * time.Millisecond)
	}

	close(dataChannel)
	time.Sleep(2 * time.Second)

	// Verify metrics
	metrics := hpw.GetMetrics()
	if metrics.TotalWrites == 0 {
		t.Error("Expected TotalWrites > 0")
	}
}

func TestHighPerformanceWriter_Compression(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_compression")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir
	config.EnableCompression = true

	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	// Create test data
	dataPoints := []DataPoint{
		{
			DeviceID:  "compress_device",
			PointName: "compress_metric",
			Timestamp: time.Now(),
			Value:     42.0,
			Quality:   1,
		},
	}

	// Test compression
	compressed, err := hpw.CompressData(dataPoints)
	if err != nil {
		t.Errorf("CompressData failed: %v", err)
	}

	if compressed == nil {
		t.Fatal("Compressed data should not be nil")
	}

	// Test decompression
	decompressed, err := hpw.DecompressData(compressed)
	if err != nil {
		t.Errorf("DecompressData failed: %v", err)
	}

	if len(decompressed) != len(dataPoints) {
		t.Errorf("Expected %d decompressed points, got %d", len(dataPoints), len(decompressed))
	}
}

func TestHighPerformanceWriter_GetMetrics(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_metrics")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	// Get initial metrics
	metrics := hpw.GetMetrics()
	if metrics == nil {
		t.Fatal("Metrics should not be nil")
	}

	// Verify metrics structure
	if metrics.TotalWrites != 0 {
		t.Errorf("Expected initial TotalWrites=0, got %d", metrics.TotalWrites)
	}

	if metrics.SuccessfulWrites != 0 {
		t.Errorf("Expected initial SuccessfulWrites=0, got %d", metrics.SuccessfulWrites)
	}

	if metrics.FailedWrites != 0 {
		t.Errorf("Expected initial FailedWrites=0, got %d", metrics.FailedWrites)
	}
}

func TestHighPerformanceWriter_GetDetailedStats(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_detailed_stats")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx := context.Background()
	err = hpw.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	// Get detailed stats
	stats := hpw.GetDetailedStats()
	if stats == nil {
		t.Fatal("Detailed stats should not be nil")
	}

	// Verify stats structure
	expectedKeys := []string{"high_performance", "data_writer", "failure_recovery", "config"}
	for _, key := range expectedKeys {
		if _, exists := stats[key]; !exists {
			t.Errorf("Expected stats key '%s' not found", key)
		}
	}
}

func TestHighPerformanceWriter_HealthCheck(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_health")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx := context.Background()

	// Test health check before starting
	health := hpw.HealthCheck(ctx)
	if health == nil {
		t.Fatal("Health check should not be nil")
	}

	if health["status"] != "stopped" {
		t.Errorf("Expected status 'stopped', got %v", health["status"])
	}

	if health["is_running"] != false {
		t.Errorf("Expected is_running false, got %v", health["is_running"])
	}

	// Start and test health check
	err = hpw.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	health = hpw.HealthCheck(ctx)
	if health["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got %v", health["status"])
	}

	if health["is_running"] != true {
		t.Errorf("Expected is_running true, got %v", health["is_running"])
	}
}

func TestHighPerformanceWriter_ResetMetrics(t *testing.T) {
	tempDir := filepath.Join(os.TempDir(), "test_hp_reset")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir

	tdConfig := DefaultTDengineConfig()
	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		t.Fatalf("Failed to create high-performance writer: %v", err)
	}

	// Simulate some metrics
	hpw.mu.Lock()
	hpw.metrics.TotalWrites = 10
	hpw.metrics.SuccessfulWrites = 8
	hpw.metrics.FailedWrites = 2
	hpw.mu.Unlock()

	// Verify metrics before reset
	metrics := hpw.GetMetrics()
	if metrics.TotalWrites != 10 {
		t.Errorf("Expected TotalWrites=10, got %d", metrics.TotalWrites)
	}

	// Reset metrics
	hpw.ResetMetrics()

	// Verify metrics after reset
	metrics = hpw.GetMetrics()
	if metrics.TotalWrites != 0 {
		t.Errorf("Expected TotalWrites=0 after reset, got %d", metrics.TotalWrites)
	}

	if metrics.SuccessfulWrites != 0 {
		t.Errorf("Expected SuccessfulWrites=0 after reset, got %d", metrics.SuccessfulWrites)
	}

	if metrics.FailedWrites != 0 {
		t.Errorf("Expected FailedWrites=0 after reset, got %d", metrics.FailedWrites)
	}
}

func BenchmarkHighPerformanceWriter_WriteData(b *testing.B) {
	tempDir := filepath.Join(os.TempDir(), "bench_hp_writer")
	defer os.RemoveAll(tempDir)

	config := DefaultHighPerformanceConfig()
	config.RecoveryConfig.RecoveryDir = tempDir
	config.EnableCompression = false // Disable compression for pure write performance

	tdConfig := DefaultTDengineConfig()
	tdConfig.Host = "localhost"
	tdConfig.Port = 6030

	manager, err := NewTDengineManager(tdConfig)
	if err != nil {
		b.Skipf("Skipping benchmark - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	hpw, err := NewHighPerformanceWriter(service, config)
	if err != nil {
		b.Fatalf("Failed to create high-performance writer: %v", err)
	}

	ctx := context.Background()
	err = hpw.Start(ctx)
	if err != nil {
		b.Fatalf("Failed to start high-performance writer: %v", err)
	}
	defer hpw.Stop()

	// Create test data
	dataPoints := []DataPoint{
		{
			DeviceID:  "bench_device",
			PointName: "bench_metric",
			Timestamp: time.Now(),
			Value:     42.0,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "bench_collector",
			},
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := hpw.WriteData(ctx, "bench_db", "bench_metrics", dataPoints)
		if err != nil {
			b.Errorf("WriteData failed: %v", err)
		}
	}
}
