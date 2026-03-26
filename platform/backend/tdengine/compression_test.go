package tdengine

import (
	"testing"
	"time"
)

func TestDataCompressor_CompressDataPoints(t *testing.T) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	// Create test data points
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
	}

	// Test compression
	compressed, err := compressor.CompressDataPoints(dataPoints)
	if err != nil {
		t.Fatalf("CompressDataPoints failed: %v", err)
	}

	if compressed == nil {
		t.Fatal("Compressed data should not be nil")
	}

	// Verify compression metadata
	if compressed.OriginalSize <= 0 {
		t.Errorf("Expected OriginalSize > 0, got %d", compressed.OriginalSize)
	}

	if compressed.CompressedSize <= 0 {
		t.Errorf("Expected CompressedSize > 0, got %d", compressed.CompressedSize)
	}

	if compressed.CompressionRatio <= 0 {
		t.Errorf("Expected CompressionRatio > 0, got %f", compressed.CompressionRatio)
	}

	// Test decompression
	decompressed, err := compressor.DecompressDataPoints(compressed)
	if err != nil {
		t.Fatalf("DecompressDataPoints failed: %v", err)
	}

	if len(decompressed) != len(dataPoints) {
		t.Errorf("Expected %d decompressed points, got %d", len(dataPoints), len(decompressed))
	}

	// Verify data integrity
	for i, original := range dataPoints {
		if i >= len(decompressed) {
			break
		}
		
		decompressedPoint := decompressed[i]
		
		if original.DeviceID != decompressedPoint.DeviceID {
			t.Errorf("DeviceID mismatch: expected %s, got %s", original.DeviceID, decompressedPoint.DeviceID)
		}
		
		if original.PointName != decompressedPoint.PointName {
			t.Errorf("PointName mismatch: expected %s, got %s", original.PointName, decompressedPoint.PointName)
		}
		
		if original.Value != decompressedPoint.Value {
			t.Errorf("Value mismatch: expected %v, got %v", original.Value, decompressedPoint.Value)
		}
		
		if original.Quality != decompressedPoint.Quality {
			t.Errorf("Quality mismatch: expected %d, got %d", original.Quality, decompressedPoint.Quality)
		}
	}
}

func TestDataCompressor_CompressBatchData(t *testing.T) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	// Create test batch data
	batches := []BatchData{
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
				},
			},
			CollectorID: "collector_001",
		},
		{
			Database:   "test_db",
			SuperTable: "test_metrics",
			DataPoints: []DataPoint{
				{
					DeviceID:  "device_002",
					PointName: "pressure",
					Timestamp: time.Now(),
					Value:     1013.25,
					Quality:   1,
				},
			},
			CollectorID: "collector_002",
		},
	}

	// Test batch compression
	compressed, err := compressor.CompressBatchData(batches)
	if err != nil {
		t.Fatalf("CompressBatchData failed: %v", err)
	}

	if compressed == nil {
		t.Fatal("Compressed batch data should not be nil")
	}

	// Test batch decompression
	decompressed, err := compressor.DecompressBatchData(compressed)
	if err != nil {
		t.Fatalf("DecompressBatchData failed: %v", err)
	}

	if len(decompressed) != len(batches) {
		t.Errorf("Expected %d decompressed batches, got %d", len(batches), len(decompressed))
	}

	// Verify batch data integrity
	for i, original := range batches {
		if i >= len(decompressed) {
			break
		}
		
		decompressedBatch := decompressed[i]
		
		if original.Database != decompressedBatch.Database {
			t.Errorf("Database mismatch: expected %s, got %s", original.Database, decompressedBatch.Database)
		}
		
		if original.SuperTable != decompressedBatch.SuperTable {
			t.Errorf("SuperTable mismatch: expected %s, got %s", original.SuperTable, decompressedBatch.SuperTable)
		}
		
		if original.CollectorID != decompressedBatch.CollectorID {
			t.Errorf("CollectorID mismatch: expected %s, got %s", original.CollectorID, decompressedBatch.CollectorID)
		}
		
		if len(original.DataPoints) != len(decompressedBatch.DataPoints) {
			t.Errorf("DataPoints length mismatch: expected %d, got %d", 
				len(original.DataPoints), len(decompressedBatch.DataPoints))
		}
	}
}

func TestDataCompressor_OptimizeDataPoints(t *testing.T) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	baseTime := time.Now()
	
	// Create test data with duplicates
	dataPoints := []DataPoint{
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: baseTime,
			Value:     25.5,
			Quality:   1,
		},
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: baseTime.Add(500 * time.Millisecond), // Same value within 1 second
			Value:     25.5,
			Quality:   1,
		},
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: baseTime.Add(2 * time.Second), // Different time, should be kept
			Value:     25.5,
			Quality:   1,
		},
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: baseTime.Add(3 * time.Second),
			Value:     26.0, // Different value, should be kept
			Quality:   1,
		},
	}

	// Test optimization
	optimized := compressor.OptimizeDataPoints(dataPoints)

	// Should remove the duplicate within 1 second window
	expectedLength := 3 // First, third, and fourth points
	if len(optimized) != expectedLength {
		t.Errorf("Expected %d optimized points, got %d", expectedLength, len(optimized))
	}

	// Verify first point is kept
	if len(optimized) > 0 && optimized[0].Timestamp != baseTime {
		t.Errorf("First point timestamp mismatch")
	}

	// Verify different value is kept
	if len(optimized) >= 3 && optimized[2].Value != 26.0 {
		t.Errorf("Expected different value to be kept")
	}
}

func TestDataCompressor_CompressionTypes(t *testing.T) {
	// Test different compression types
	compressionTypes := []CompressionType{
		CompressionGzip,
		CompressionZlib,
		CompressionNone,
	}

	dataPoints := []DataPoint{
		{
			DeviceID:  "device_001",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.5,
			Quality:   1,
		},
	}

	for _, compressionType := range compressionTypes {
		config := &CompressionConfig{
			Type:           compressionType,
			Level:          1,
			MinSize:        0, // Force compression even for small data
			EnableBatching: true,
			BatchSize:      1000,
		}

		compressor := NewDataCompressor(config)

		compressed, err := compressor.CompressDataPoints(dataPoints)
		if err != nil {
			t.Errorf("Compression failed for type %d: %v", compressionType, err)
			continue
		}

		if compressed.CompressionType != compressionType {
			t.Errorf("Expected compression type %d, got %d", compressionType, compressed.CompressionType)
		}

		decompressed, err := compressor.DecompressDataPoints(compressed)
		if err != nil {
			t.Errorf("Decompression failed for type %d: %v", compressionType, err)
			continue
		}

		if len(decompressed) != len(dataPoints) {
			t.Errorf("Data length mismatch for type %d", compressionType)
		}
	}
}

func TestDataCompressor_GetCompressionStats(t *testing.T) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	originalSize := 1000
	compressedSize := 600

	stats := compressor.GetCompressionStats(originalSize, compressedSize)

	if stats == nil {
		t.Fatal("Stats should not be nil")
	}

	// Verify stats
	if stats["original_size"] != originalSize {
		t.Errorf("Expected original_size %d, got %v", originalSize, stats["original_size"])
	}

	if stats["compressed_size"] != compressedSize {
		t.Errorf("Expected compressed_size %d, got %v", compressedSize, stats["compressed_size"])
	}

	expectedRatio := float64(compressedSize) / float64(originalSize)
	if stats["compression_ratio"] != expectedRatio {
		t.Errorf("Expected compression_ratio %f, got %v", expectedRatio, stats["compression_ratio"])
	}

	expectedSavings := float64(originalSize-compressedSize) / float64(originalSize) * 100
	if stats["space_savings_pct"] != expectedSavings {
		t.Errorf("Expected space_savings_pct %f, got %v", expectedSavings, stats["space_savings_pct"])
	}
}

func TestDataCompressor_EmptyData(t *testing.T) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	// Test empty data points
	compressed, err := compressor.CompressDataPoints([]DataPoint{})
	if err != nil {
		t.Errorf("CompressDataPoints failed for empty data: %v", err)
	}

	if compressed == nil {
		t.Fatal("Compressed data should not be nil for empty input")
	}

	if len(compressed.Data) != 0 {
		t.Errorf("Expected empty compressed data, got %d bytes", len(compressed.Data))
	}

	// Test decompression of empty data
	decompressed, err := compressor.DecompressDataPoints(compressed)
	if err != nil {
		t.Errorf("DecompressDataPoints failed for empty data: %v", err)
	}

	if len(decompressed) != 0 {
		t.Errorf("Expected empty decompressed data, got %d points", len(decompressed))
	}
}

func BenchmarkDataCompressor_Compress(b *testing.B) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	// Create large dataset for benchmarking
	dataPoints := make([]DataPoint, 1000)
	for i := 0; i < 1000; i++ {
		dataPoints[i] = DataPoint{
			DeviceID:  "benchmark_device",
			PointName: "benchmark_metric",
			Timestamp: time.Now().Add(time.Duration(i) * time.Millisecond),
			Value:     float64(i),
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "benchmark_collector",
				"location":     "benchmark_location",
			},
		}
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := compressor.CompressDataPoints(dataPoints)
		if err != nil {
			b.Errorf("Compression failed: %v", err)
		}
	}
}

func BenchmarkDataCompressor_Decompress(b *testing.B) {
	compressor := NewDataCompressor(DefaultCompressionConfig())

	// Create and compress test data
	dataPoints := make([]DataPoint, 1000)
	for i := 0; i < 1000; i++ {
		dataPoints[i] = DataPoint{
			DeviceID:  "benchmark_device",
			PointName: "benchmark_metric",
			Timestamp: time.Now().Add(time.Duration(i) * time.Millisecond),
			Value:     float64(i),
			Quality:   1,
		}
	}

	compressed, err := compressor.CompressDataPoints(dataPoints)
	if err != nil {
		b.Fatalf("Failed to compress test data: %v", err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := compressor.DecompressDataPoints(compressed)
		if err != nil {
			b.Errorf("Decompression failed: %v", err)
		}
	}
}
