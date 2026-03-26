package tdengine

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"
)

// HighPerformanceWriterExample demonstrates the usage of high-performance data writing
func HighPerformanceWriterExample() {
	fmt.Println("=== High-Performance Data Writer Example ===")

	// 1. Create TDengine connection
	config := &TDengineConfig{
		Host:         "localhost",
		Port:         6030,
		Username:     "root",
		Password:     "taosdata",
		Database:     "industrial_data",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnTimeout:  30,
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Printf("Failed to create TDengine manager: %v", err)
		return
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	// 2. Configure high-performance writer
	hpConfig := &HighPerformanceConfig{
		WriterConfig: &WriterConfig{
			BatchSize:         1000,
			FlushTimeout:      5 * time.Second,
			MaxRetries:        3,
			RetryDelay:        1 * time.Second,
			CompressionLevel:  1,
			EnableCompression: true,
		},
		CompressionConfig: &CompressionConfig{
			Type:           CompressionGzip,
			Level:          1,
			MinSize:        1024,
			EnableBatching: true,
			BatchSize:      10000,
		},
		RecoveryConfig: &RecoveryConfig{
			RecoveryDir:     "./recovery",
			MaxRetries:      5,
			RetryInterval:   30 * time.Second,
			MaxFileSize:     100 * 1024 * 1024,
			QueueSize:       1000,
			WorkerCount:     3,
			CleanupInterval: 1 * time.Hour,
		},
		EnableCompression: true,
		EnableRecovery:    true,
		MetricsInterval:   30 * time.Second,
	}

	// 3. Create high-performance writer
	hpWriter, err := NewHighPerformanceWriter(service, hpConfig)
	if err != nil {
		log.Printf("Failed to create high-performance writer: %v", err)
		return
	}

	ctx := context.Background()

	// 4. Start the writer
	err = hpWriter.Start(ctx)
	if err != nil {
		log.Printf("Failed to start high-performance writer: %v", err)
		return
	}
	defer hpWriter.Stop()

	fmt.Println("High-performance writer started successfully")

	// 5. Demonstrate single data write
	fmt.Println("\n--- Single Data Write Example ---")
	singleDataExample(ctx, hpWriter)

	// 6. Demonstrate batch write
	fmt.Println("\n--- Batch Write Example ---")
	batchWriteExample(ctx, hpWriter)

	// 7. Demonstrate streaming write
	fmt.Println("\n--- Streaming Write Example ---")
	streamWriteExample(ctx, hpWriter)

	// 8. Demonstrate compression
	fmt.Println("\n--- Compression Example ---")
	compressionExample(hpWriter)

	// 9. Show performance metrics
	fmt.Println("\n--- Performance Metrics ---")
	showMetrics(hpWriter)

	// 10. Show health status
	fmt.Println("\n--- Health Check ---")
	showHealthStatus(ctx, hpWriter)

	fmt.Println("\n=== High-Performance Data Writer Example Complete ===")
}

func singleDataExample(ctx context.Context, hpWriter *HighPerformanceWriter) {
	// Create sample data points
	dataPoints := []DataPoint{
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.5,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector_001",
				"location":     "workshop_a",
				"device_type":  "sensor",
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
				"device_type":  "sensor",
			},
		},
	}

	// Write data
	result, err := hpWriter.WriteData(ctx, "industrial_data", "modbus_metrics", dataPoints)
	if err != nil {
		log.Printf("Single write failed: %v", err)
		return
	}

	fmt.Printf("Single write result: Success=%v, Records=%d, Duration=%v\n",
		result.Success, result.RecordsWritten, result.Duration)
}

func batchWriteExample(ctx context.Context, hpWriter *HighPerformanceWriter) {
	// Create multiple batches
	batches := []BatchData{
		{
			Database:   "industrial_data",
			SuperTable: "modbus_metrics",
			DataPoints: generateSampleData("collector_001", "device_001", 100),
			Timestamp:  time.Now(),
			CollectorID: "collector_001",
		},
		{
			Database:   "industrial_data",
			SuperTable: "modbus_metrics",
			DataPoints: generateSampleData("collector_002", "device_002", 100),
			Timestamp:  time.Now(),
			CollectorID: "collector_002",
		},
		{
			Database:   "industrial_data",
			SuperTable: "modbus_metrics",
			DataPoints: generateSampleData("collector_003", "device_003", 100),
			Timestamp:  time.Now(),
			CollectorID: "collector_003",
		},
	}

	// Write batches
	startTime := time.Now()
	result, err := hpWriter.WriteBatch(ctx, batches)
	duration := time.Since(startTime)

	if err != nil {
		log.Printf("Batch write failed: %v", err)
		return
	}

	fmt.Printf("Batch write result: Success=%v, Records=%d, Duration=%v\n",
		result.Success, result.RecordsWritten, duration)

	// Calculate throughput
	pointsPerSecond := float64(result.RecordsWritten) / duration.Seconds()
	fmt.Printf("Throughput: %.2f points/second\n", pointsPerSecond)
}

func streamWriteExample(ctx context.Context, hpWriter *HighPerformanceWriter) {
	// Create data channel for streaming
	dataChannel := make(chan DataPoint, 1000)

	// Start streaming in a goroutine
	streamCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	go func() {
		err := hpWriter.WriteStream(streamCtx, "industrial_data", "modbus_metrics", dataChannel)
		if err != nil && err != context.DeadlineExceeded {
			log.Printf("Stream write failed: %v", err)
		}
	}()

	// Send data points
	fmt.Println("Sending 500 data points via streaming...")
	startTime := time.Now()

	for i := 0; i < 500; i++ {
		dataPoint := DataPoint{
			DeviceID:  "stream_device",
			PointName: "stream_metric",
			Timestamp: time.Now(),
			Value:     rand.Float64() * 100,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "stream_collector",
				"location":     "stream_test",
				"batch_id":     i / 50, // Group into batches of 50
			},
		}

		select {
		case dataChannel <- dataPoint:
		case <-streamCtx.Done():
			fmt.Printf("Stream context cancelled after %d points\n", i)
			close(dataChannel)
			return
		}

		// Simulate real-time data arrival
		if i%50 == 0 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	close(dataChannel)
	duration := time.Since(startTime)

	fmt.Printf("Streaming completed in %v\n", duration)
	fmt.Printf("Average rate: %.2f points/second\n", 500.0/duration.Seconds())
}

func compressionExample(hpWriter *HighPerformanceWriter) {
	// Generate large dataset for compression testing
	dataPoints := generateSampleData("compression_test", "compression_device", 1000)

	// Compress data
	compressed, err := hpWriter.CompressData(dataPoints)
	if err != nil {
		log.Printf("Compression failed: %v", err)
		return
	}

	fmt.Printf("Compression results:\n")
	fmt.Printf("  Original size: %d bytes\n", compressed.OriginalSize)
	fmt.Printf("  Compressed size: %d bytes\n", compressed.CompressedSize)
	fmt.Printf("  Compression ratio: %.2f\n", compressed.CompressionRatio)
	fmt.Printf("  Space savings: %.2f%%\n", (1.0-compressed.CompressionRatio)*100)

	// Decompress and verify
	decompressed, err := hpWriter.DecompressData(compressed)
	if err != nil {
		log.Printf("Decompression failed: %v", err)
		return
	}

	if len(decompressed) == len(dataPoints) {
		fmt.Printf("  Data integrity verified: %d points recovered\n", len(decompressed))
	} else {
		fmt.Printf("  Data integrity error: expected %d, got %d points\n", 
			len(dataPoints), len(decompressed))
	}
}

func showMetrics(hpWriter *HighPerformanceWriter) {
	metrics := hpWriter.GetMetrics()

	fmt.Printf("Performance Metrics:\n")
	fmt.Printf("  Total writes: %d\n", metrics.TotalWrites)
	fmt.Printf("  Successful writes: %d\n", metrics.SuccessfulWrites)
	fmt.Printf("  Failed writes: %d\n", metrics.FailedWrites)
	fmt.Printf("  Batch writes: %d\n", metrics.BatchWrites)
	fmt.Printf("  Stream writes: %d\n", metrics.StreamWrites)
	fmt.Printf("  Average write latency: %.2f ms\n", metrics.AvgWriteLatency)
	fmt.Printf("  Max write latency: %.2f ms\n", metrics.MaxWriteLatency)
	fmt.Printf("  Min write latency: %.2f ms\n", metrics.MinWriteLatency)
	fmt.Printf("  Data points per second: %.2f\n", metrics.DataPointsPerSec)
	fmt.Printf("  Throughput: %.2f MB/s\n", metrics.ThroughputMBPS)
	fmt.Printf("  Failure rate: %.2f%%\n", metrics.FailureRate)
	fmt.Printf("  Recovery rate: %.2f%%\n", metrics.RecoveryRate)
	fmt.Printf("  Uptime: %d seconds\n", metrics.UptimeSeconds)

	// Show detailed stats
	fmt.Printf("\nDetailed Statistics:\n")
	detailedStats := hpWriter.GetDetailedStats()
	
	if writerStats, ok := detailedStats["data_writer"]; ok {
		if ws, ok := writerStats.(*WriterMetrics); ok {
			fmt.Printf("  Data Writer - Total: %d, Success: %d, Failed: %d\n",
				ws.TotalWrites, ws.SuccessfulWrites, ws.FailedWrites)
		}
	}

	if recoveryStats, ok := detailedStats["failure_recovery"]; ok {
		if rs, ok := recoveryStats.(map[string]interface{}); ok {
			fmt.Printf("  Recovery - Queue: %v, Persisted: %v, Running: %v\n",
				rs["queue_length"], rs["persisted_count"], rs["is_running"])
		}
	}
}

func showHealthStatus(ctx context.Context, hpWriter *HighPerformanceWriter) {
	health := hpWriter.HealthCheck(ctx)

	fmt.Printf("Health Status:\n")
	fmt.Printf("  Status: %v\n", health["status"])
	fmt.Printf("  Running: %v\n", health["is_running"])
	fmt.Printf("  Failure rate: %.2f%%\n", health["failure_rate"])
	fmt.Printf("  Data points/sec: %.2f\n", health["data_points_per_sec"])
	fmt.Printf("  Average latency: %.2f ms\n", health["avg_latency_ms"])
	fmt.Printf("  Timestamp: %v\n", health["timestamp"])
}

func generateSampleData(collectorID, deviceID string, count int) []DataPoint {
	dataPoints := make([]DataPoint, count)
	baseTime := time.Now()

	metrics := []string{"temperature", "pressure", "humidity", "voltage", "current"}

	for i := 0; i < count; i++ {
		metric := metrics[i%len(metrics)]
		
		var value float64
		switch metric {
		case "temperature":
			value = 20.0 + rand.Float64()*30.0 // 20-50°C
		case "pressure":
			value = 1000.0 + rand.Float64()*50.0 // 1000-1050 hPa
		case "humidity":
			value = 30.0 + rand.Float64()*40.0 // 30-70%
		case "voltage":
			value = 220.0 + rand.Float64()*20.0 // 220-240V
		case "current":
			value = rand.Float64() * 10.0 // 0-10A
		}

		dataPoints[i] = DataPoint{
			DeviceID:  deviceID,
			PointName: metric,
			Timestamp: baseTime.Add(time.Duration(i) * time.Millisecond),
			Value:     value,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": collectorID,
				"location":     "workshop_" + string(rune('a'+i%3)),
				"device_type":  "sensor",
				"unit":         getUnit(metric),
			},
		}
	}

	return dataPoints
}

func getUnit(metric string) string {
	units := map[string]string{
		"temperature": "°C",
		"pressure":    "hPa",
		"humidity":    "%",
		"voltage":     "V",
		"current":     "A",
	}
	
	if unit, exists := units[metric]; exists {
		return unit
	}
	return ""
}

// PerformanceTestExample demonstrates performance testing capabilities
func PerformanceTestExample() {
	fmt.Println("\n=== Performance Test Example ===")

	// Create TDengine connection
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030

	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Printf("Failed to create TDengine manager: %v", err)
		return
	}
	defer manager.Stop()

	service := NewTDengineService(manager)

	// Configure for maximum performance
	hpConfig := DefaultHighPerformanceConfig()
	hpConfig.WriterConfig.BatchSize = 1000
	hpConfig.EnableCompression = false // Disable for raw performance

	hpWriter, err := NewHighPerformanceWriter(service, hpConfig)
	if err != nil {
		log.Printf("Failed to create high-performance writer: %v", err)
		return
	}

	ctx := context.Background()
	err = hpWriter.Start(ctx)
	if err != nil {
		log.Printf("Failed to start high-performance writer: %v", err)
		return
	}
	defer hpWriter.Stop()

	// Performance test: Write 10,000 data points
	fmt.Println("Performance test: Writing 10,000 data points...")
	
	dataPoints := generateSampleData("perf_collector", "perf_device", 10000)
	
	startTime := time.Now()
	result, err := hpWriter.WriteData(ctx, "industrial_data", "modbus_metrics", dataPoints)
	duration := time.Since(startTime)

	if err != nil {
		log.Printf("Performance test failed: %v", err)
		return
	}

	// Calculate performance metrics
	pointsPerSecond := float64(result.RecordsWritten) / duration.Seconds()
	mbPerSecond := float64(result.RecordsWritten) * 100 / (1024 * 1024) / duration.Seconds() // Assume ~100 bytes per point

	fmt.Printf("Performance test results:\n")
	fmt.Printf("  Records written: %d\n", result.RecordsWritten)
	fmt.Printf("  Duration: %v\n", duration)
	fmt.Printf("  Points per second: %.2f\n", pointsPerSecond)
	fmt.Printf("  Throughput: %.2f MB/s\n", mbPerSecond)
	fmt.Printf("  Success: %v\n", result.Success)

	// Check if meets requirement (1000 points per second per collector)
	if pointsPerSecond >= 1000 {
		fmt.Printf("✓ Performance requirement met (>= 1000 points/sec)\n")
	} else {
		fmt.Printf("✗ Performance requirement not met (< 1000 points/sec)\n")
	}

	// Show final metrics
	metrics := hpWriter.GetMetrics()
	fmt.Printf("Final metrics - Total: %d, Success: %d, Failed: %d, Avg Latency: %.2f ms\n",
		metrics.TotalWrites, metrics.SuccessfulWrites, metrics.FailedWrites, metrics.AvgWriteLatency)
}
