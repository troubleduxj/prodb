package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestStorageCache_BasicOperations(t *testing.T) {
	// Create temporary directory for test database
	tempDir, err := os.MkdirTemp("", "storage_cache_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test configuration
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "test_cache.db"),
		MaxCacheSize:    1024 * 1024, // 1MB
		RetentionDays:   7,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache
	cache, err := NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Start cache
	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	// Test data storage
	testData := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Value:     25.5,
			Quality:   1,
			Timestamp: time.Now(),
		},
		{
			DeviceID:  "device1",
			PointName: "pressure",
			Value:     1013.25,
			Quality:   1,
			Timestamp: time.Now(),
		},
	}

	err = cache.Store(testData)
	if err != nil {
		t.Fatalf("Failed to store data: %v", err)
	}

	// Test data retrieval
	cachedData, err := cache.Retrieve(10)
	if err != nil {
		t.Fatalf("Failed to retrieve data: %v", err)
	}

	if len(cachedData) != 1 {
		t.Errorf("Expected 1 cached record, got %d", len(cachedData))
	}

	if len(cachedData[0].DataPoints) != 2 {
		t.Errorf("Expected 2 data points, got %d", len(cachedData[0].DataPoints))
	}

	// Test marking as uploaded
	ids := []int64{cachedData[0].ID}
	err = cache.MarkUploaded(ids)
	if err != nil {
		t.Fatalf("Failed to mark data as uploaded: %v", err)
	}

	// Verify data is marked as uploaded
	pendingData, err := cache.Retrieve(10)
	if err != nil {
		t.Fatalf("Failed to retrieve pending data: %v", err)
	}

	if len(pendingData) != 0 {
		t.Errorf("Expected 0 pending records after upload, got %d", len(pendingData))
	}
}

func TestStorageCache_FIFOCleanup(t *testing.T) {
	// Create temporary directory for test database
	tempDir, err := os.MkdirTemp("", "storage_cache_fifo_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test configuration with small limits
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "test_cache.db"),
		MaxCacheSize:    1024 * 1024, // 1MB
		RetentionDays:   1,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache with small cleanup threshold
	cache, err := NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Set small threshold for testing
	cache.maxRecordsBeforeCleanup = 5
	cache.fifoCleanupBatchSize = 2

	// Start cache
	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	// Store multiple batches of data to trigger FIFO cleanup
	for i := 0; i < 10; i++ {
		testData := []protocol.DataValue{
			{
				DeviceID:  "device1",
				PointName: "temperature",
				Value:     float64(20 + i),
				Quality:   1,
				Timestamp: time.Now().Add(time.Duration(i) * time.Second),
			},
		}

		err = cache.Store(testData)
		if err != nil {
			t.Fatalf("Failed to store data batch %d: %v", i, err)
		}

		// Small delay to ensure different timestamps
		time.Sleep(10 * time.Millisecond)
	}

	// Wait a bit for async cleanup to complete
	time.Sleep(100 * time.Millisecond)

	// Check that FIFO cleanup occurred
	stats, err := cache.GetCacheStatistics()
	if err != nil {
		t.Fatalf("Failed to get cache statistics: %v", err)
	}

	if stats.TotalRecords > cache.maxRecordsBeforeCleanup+int64(cache.fifoCleanupBatchSize) {
		t.Errorf("FIFO cleanup did not work properly. Expected <= %d records, got %d",
			cache.maxRecordsBeforeCleanup+int64(cache.fifoCleanupBatchSize), stats.TotalRecords)
	}

	t.Logf("FIFO cleanup test completed. Total records: %d", stats.TotalRecords)
}

func TestStorageCache_DiskSpaceMonitoring(t *testing.T) {
	// Create temporary directory for test database
	tempDir, err := os.MkdirTemp("", "storage_cache_disk_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test configuration
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "test_cache.db"),
		MaxCacheSize:    1024 * 1024, // 1MB
		RetentionDays:   7,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache
	cache, err := NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Start cache
	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	// Test disk space info
	diskInfo, err := cache.GetDiskSpaceInfo()
	if err != nil {
		t.Fatalf("Failed to get disk space info: %v", err)
	}

	if diskInfo.TotalSpace <= 0 {
		t.Errorf("Invalid total disk space: %d", diskInfo.TotalSpace)
	}

	if diskInfo.AvailableSpace <= 0 {
		t.Errorf("Invalid available disk space: %d", diskInfo.AvailableSpace)
	}

	if diskInfo.UsagePercent < 0 || diskInfo.UsagePercent > 100 {
		t.Errorf("Invalid disk usage percentage: %f", diskInfo.UsagePercent)
	}

	t.Logf("Disk space info: Total=%d MB, Available=%d MB, Usage=%.2f%%",
		diskInfo.TotalSpace/(1024*1024),
		diskInfo.AvailableSpace/(1024*1024),
		diskInfo.UsagePercent)

	// Test metrics update
	cache.updateDiskSpaceMetrics()
	metrics := cache.GetMetrics()

	if metrics.TotalDiskSpace != diskInfo.TotalSpace {
		t.Errorf("Metrics disk space mismatch: expected %d, got %d",
			diskInfo.TotalSpace, metrics.TotalDiskSpace)
	}
}

func TestStorageCache_RetryMechanism(t *testing.T) {
	// Create temporary directory for test database
	tempDir, err := os.MkdirTemp("", "storage_cache_retry_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test configuration
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "test_cache.db"),
		MaxCacheSize:    1024 * 1024, // 1MB
		RetentionDays:   7,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache
	cache, err := NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Start cache
	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	// Store test data
	testData := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Value:     25.5,
			Quality:   1,
			Timestamp: time.Now(),
		},
	}

	err = cache.Store(testData)
	if err != nil {
		t.Fatalf("Failed to store data: %v", err)
	}

	// Retrieve data
	cachedData, err := cache.Retrieve(10)
	if err != nil {
		t.Fatalf("Failed to retrieve data: %v", err)
	}

	if len(cachedData) != 1 {
		t.Fatalf("Expected 1 cached record, got %d", len(cachedData))
	}

	// Test retry count increment
	ids := []int64{cachedData[0].ID}
	err = cache.IncrementRetryCount(ids)
	if err != nil {
		t.Fatalf("Failed to increment retry count: %v", err)
	}

	// Retrieve again and check retry count
	updatedData, err := cache.Retrieve(10)
	if err != nil {
		t.Fatalf("Failed to retrieve updated data: %v", err)
	}

	if len(updatedData) != 1 {
		t.Fatalf("Expected 1 updated record, got %d", len(updatedData))
	}

	if updatedData[0].RetryCount != 1 {
		t.Errorf("Expected retry count 1, got %d", updatedData[0].RetryCount)
	}

	// Test multiple retry increments
	for i := 0; i < 3; i++ {
		err = cache.IncrementRetryCount(ids)
		if err != nil {
			t.Fatalf("Failed to increment retry count (iteration %d): %v", i+2, err)
		}
	}

	// Check final retry count
	finalData, err := cache.Retrieve(10)
	if err != nil {
		t.Fatalf("Failed to retrieve final data: %v", err)
	}

	if finalData[0].RetryCount != 4 {
		t.Errorf("Expected final retry count 4, got %d", finalData[0].RetryCount)
	}
}

func TestStorageCache_DatabaseOptimization(t *testing.T) {
	// Create temporary directory for test database
	tempDir, err := os.MkdirTemp("", "storage_cache_optimize_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test configuration
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "test_cache.db"),
		MaxCacheSize:    1024 * 1024, // 1MB
		RetentionDays:   7,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache
	cache, err := NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Start cache
	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	// Store some test data
	for i := 0; i < 10; i++ {
		testData := []protocol.DataValue{
			{
				DeviceID:  "device1",
				PointName: "temperature",
				Value:     float64(20 + i),
				Quality:   1,
				Timestamp: time.Now(),
			},
		}

		err = cache.Store(testData)
		if err != nil {
			t.Fatalf("Failed to store data: %v", err)
		}
	}

	// Test database optimization
	err = cache.OptimizeDatabase()
	if err != nil {
		t.Fatalf("Failed to optimize database: %v", err)
	}

	// Verify database is still functional after optimization
	cachedData, err := cache.Retrieve(5)
	if err != nil {
		t.Fatalf("Failed to retrieve data after optimization: %v", err)
	}

	if len(cachedData) == 0 {
		t.Errorf("No data found after optimization")
	}

	t.Logf("Database optimization test completed. Retrieved %d records after optimization", len(cachedData))
}