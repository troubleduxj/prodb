package tdengine

import (
	"context"
	"testing"
	"time"
)

func TestDataWriter_BatchWrite(t *testing.T) {
	// Create a mock TDengine service for testing
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030
	config.Username = "root"
	config.Password = "taosdata"

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	writer := NewDataWriter(service, DefaultWriterConfig())

	ctx := context.Background()

	// Create test data
	testData := []BatchData{
		{
			Database:   "test_db",
			SuperTable: "test_metrics",
			DataPoints: []DataPoint{
				{
					DeviceID:  "device_001",
					PointName: "temperature",
					Timestamp: time.Now(),
					Value:     25.5,
					Quality:   1,
					Tags: map[string]interface{}{
						"collector_id": "collector_001",
						"location":     "workshop_a",
					},
				},
				{
					DeviceID:  "device_001",
					PointName: "pressure",
					Timestamp: time.Now(),
					Value:     1013.25,
					Quality:   1,
					Tags: map[string]interface{}{
						"collector_id": "collector_001",
						"location":     "workshop_a",
					},
				},
			},
			CollectorID: "collector_001",
		},
	}

	// Test batch write
	result, err := writer.BatchWrite(ctx, testData)
	if err != nil {
		t.Errorf("BatchWrite failed: %v", err)
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
	metrics := writer.GetMetrics()
	if metrics.TotalWrites == 0 {
		t.Error("Expected TotalWrites > 0")
	}

	if metrics.BatchWrites == 0 {
		t.Error("Expected BatchWrites > 0")
	}
}

func TestDataWriter_OptimizedBatchInsert(t *testing.T) {
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	writer := NewDataWriter(service, DefaultWriterConfig())

	ctx := context.Background()

	// Create test data points
	dataPoints := []DataPoint{
		{
			DeviceID:  "device_002",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     22.3,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector_002",
				"location":     "workshop_b",
			},
		},
	}

	// Test optimized batch insert
	result, err := writer.OptimizedBatchInsert(ctx, "test_db", "test_metrics", dataPoints)
	if err != nil {
		t.Errorf("OptimizedBatchInsert failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}

	if !result.Success {
		t.Errorf("Expected success=true, got %v", result.Success)
	}

	if result.RecordsWritten != 1 {
		t.Errorf("Expected 1 record written, got %d", result.RecordsWritten)
	}
}

func TestDataWriter_WriteWithRetry(t *testing.T) {
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	writer := NewDataWriter(service, DefaultWriterConfig())

	ctx := context.Background()

	// Create test data points
	dataPoints := []DataPoint{
		{
			DeviceID:  "device_003",
			PointName: "humidity",
			Timestamp: time.Now(),
			Value:     65.2,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector_003",
				"location":     "workshop_c",
			},
		},
	}

	// Test write with retry
	result, err := writer.WriteWithRetry(ctx, "test_db", "test_metrics", dataPoints, 3)
	if err != nil {
		t.Errorf("WriteWithRetry failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}

	if !result.Success {
		t.Errorf("Expected success=true, got %v", result.Success)
	}

	if result.RetryCount > 3 {
		t.Errorf("Expected retry count <= 3, got %d", result.RetryCount)
	}
}

func TestDataWriter_StreamWrite(t *testing.T) {
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	
	// Use smaller batch size for testing
	writerConfig := DefaultWriterConfig()
	writerConfig.BatchSize = 2
	writerConfig.FlushTimeout = 1 * time.Second
	
	writer := NewDataWriter(service, writerConfig)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Create a channel for streaming data
	dataChannel := make(chan DataPoint, 10)

	// Start streaming in a goroutine
	go func() {
		err := writer.StreamWrite(ctx, "test_db", "test_metrics", dataChannel)
		if err != nil && err != context.DeadlineExceeded {
			t.Errorf("StreamWrite failed: %v", err)
		}
	}()

	// Send test data points
	for i := 0; i < 5; i++ {
		dataPoint := DataPoint{
			DeviceID:  "device_stream",
			PointName: "stream_value",
			Timestamp: time.Now(),
			Value:     float64(i * 10),
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector_stream",
				"location":     "stream_test",
			},
		}
		
		select {
		case dataChannel <- dataPoint:
		case <-ctx.Done():
			t.Fatal("Context cancelled while sending data")
		}
		
		time.Sleep(100 * time.Millisecond)
	}

	// Close the channel to signal end of stream
	close(dataChannel)

	// Wait a bit for processing
	time.Sleep(2 * time.Second)

	// Verify metrics
	metrics := writer.GetMetrics()
	if metrics.StreamWrites == 0 {
		t.Error("Expected StreamWrites > 0")
	}
}

func TestDataWriter_Metrics(t *testing.T) {
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	writer := NewDataWriter(service, DefaultWriterConfig())

	// Get initial metrics
	initialMetrics := writer.GetMetrics()
	if initialMetrics == nil {
		t.Fatal("Metrics should not be nil")
	}

	// Verify initial state
	if initialMetrics.TotalWrites != 0 {
		t.Errorf("Expected initial TotalWrites=0, got %d", initialMetrics.TotalWrites)
	}

	// Reset metrics
	writer.ResetMetrics()

	// Verify reset
	resetMetrics := writer.GetMetrics()
	if resetMetrics.TotalWrites != 0 {
		t.Errorf("Expected TotalWrites=0 after reset, got %d", resetMetrics.TotalWrites)
	}
}

func TestDataWriter_Performance(t *testing.T) {
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	
	// Configure for high performance
	writerConfig := DefaultWriterConfig()
	writerConfig.BatchSize = 1000
	
	writer := NewDataWriter(service, writerConfig)

	ctx := context.Background()

	// Generate large dataset for performance testing
	dataPoints := make([]DataPoint, 1000)
	for i := 0; i < 1000; i++ {
		dataPoints[i] = DataPoint{
			DeviceID:  "perf_device",
			PointName: "perf_metric",
			Timestamp: time.Now().Add(time.Duration(i) * time.Millisecond),
			Value:     float64(i),
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "perf_collector",
				"location":     "perf_test",
			},
		}
	}

	// Measure performance
	startTime := time.Now()
	result, err := writer.OptimizedBatchInsert(ctx, "test_db", "test_metrics", dataPoints)
	duration := time.Since(startTime)

	if err != nil {
		t.Errorf("Performance test failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}

	// Calculate performance metrics
	pointsPerSecond := float64(len(dataPoints)) / duration.Seconds()
	
	t.Logf("Performance test results:")
	t.Logf("  - Records written: %d", result.RecordsWritten)
	t.Logf("  - Duration: %v", duration)
	t.Logf("  - Points per second: %.2f", pointsPerSecond)
	t.Logf("  - Success: %v", result.Success)

	// Verify performance meets requirements (1000 points per second)
	if pointsPerSecond < 500 { // Allow some margin for test environment
		t.Errorf("Performance below expectations: %.2f points/sec (expected > 500)", pointsPerSecond)
	}

	// Verify all records were written
	if result.RecordsWritten != 1000 {
		t.Errorf("Expected 1000 records written, got %d", result.RecordsWritten)
	}
}

func BenchmarkDataWriter_BatchWrite(b *testing.B) {
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		b.Skipf("Skipping benchmark - TDengine not available: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	writer := NewDataWriter(service, DefaultWriterConfig())

	ctx := context.Background()

	// Create test batch data
	testData := []BatchData{
		{
			Database:   "bench_db",
			SuperTable: "bench_metrics",
			DataPoints: []DataPoint{
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
			},
		},
	}

	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		_, err := writer.BatchWrite(ctx, testData)
		if err != nil {
			b.Errorf("BatchWrite failed: %v", err)
		}
	}
}
