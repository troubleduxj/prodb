package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/storage"
)

func main() {
	fmt.Println("=== ProDB Collector SQLite Cache System Demo ===")

	// Create temporary directory for demo
	tempDir, err := os.MkdirTemp("", "storage_cache_demo")
	if err != nil {
		log.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create configuration
	storageConfig := config.StorageConfig{
		DatabasePath:    filepath.Join(tempDir, "demo_cache.db"),
		MaxCacheSize:    10 * 1024 * 1024, // 10MB
		RetentionDays:   7,
		CleanupInterval: 60,
		MaxRetries:      3,
		RetryDelay:      5,
	}

	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	// Create and start storage cache
	cache, err := storage.NewStorageCache(storageConfig, loggerInstance)
	if err != nil {
		log.Fatalf("Failed to create storage cache: %v", err)
	}

	ctx := context.Background()
	err = cache.Start(ctx)
	if err != nil {
		log.Fatalf("Failed to start storage cache: %v", err)
	}
	defer cache.Stop()

	fmt.Printf("✓ Storage cache initialized at: %s\n", storageConfig.DatabasePath)

	// Demo 1: Basic data storage and retrieval
	fmt.Println("\n--- Demo 1: Basic Data Storage ---")
	
	// Store some sample data
	sampleData := []protocol.DataValue{
		{
			DeviceID:  "PLC-001",
			PointName: "temperature",
			Value:     25.5,
			Quality:   1,
			Timestamp: time.Now(),
		},
		{
			DeviceID:  "PLC-001",
			PointName: "pressure",
			Value:     1013.25,
			Quality:   1,
			Timestamp: time.Now(),
		},
		{
			DeviceID:  "PLC-002",
			PointName: "flow_rate",
			Value:     150.0,
			Quality:   1,
			Timestamp: time.Now(),
		},
	}

	err = cache.Store(sampleData)
	if err != nil {
		log.Fatalf("Failed to store data: %v", err)
	}
	fmt.Printf("✓ Stored %d data points from 2 devices\n", len(sampleData))

	// Retrieve cached data
	cachedData, err := cache.Retrieve(10)
	if err != nil {
		log.Fatalf("Failed to retrieve data: %v", err)
	}
	fmt.Printf("✓ Retrieved %d cached records\n", len(cachedData))

	// Demo 2: Cache statistics
	fmt.Println("\n--- Demo 2: Cache Statistics ---")
	
	stats, err := cache.GetCacheStatistics()
	if err != nil {
		log.Fatalf("Failed to get cache statistics: %v", err)
	}

	fmt.Printf("Total Records: %d\n", stats.TotalRecords)
	fmt.Printf("Pending Records: %d\n", stats.PendingRecords)
	fmt.Printf("Total Data Size: %d bytes\n", stats.TotalDataSize)
	fmt.Printf("Average Record Size: %d bytes\n", stats.AvgRecordSize)
	fmt.Printf("Database File Size: %d bytes\n", stats.DatabaseFileSize)

	// Demo 3: Disk space monitoring
	fmt.Println("\n--- Demo 3: Disk Space Monitoring ---")
	
	diskInfo, err := cache.GetDiskSpaceInfo()
	if err != nil {
		log.Fatalf("Failed to get disk space info: %v", err)
	}

	fmt.Printf("Disk Path: %s\n", diskInfo.Path)
	fmt.Printf("Total Space: %.2f GB\n", float64(diskInfo.TotalSpace)/(1024*1024*1024))
	fmt.Printf("Available Space: %.2f GB\n", float64(diskInfo.AvailableSpace)/(1024*1024*1024))
	fmt.Printf("Usage: %.2f%%\n", diskInfo.UsagePercent)

	// Demo 4: FIFO cleanup simulation
	fmt.Println("\n--- Demo 4: FIFO Cleanup Simulation ---")
	
	// Store many records to trigger FIFO cleanup
	fmt.Println("Storing 50 additional records to demonstrate FIFO cleanup...")
	for i := 0; i < 50; i++ {
		testData := []protocol.DataValue{
			{
				DeviceID:  fmt.Sprintf("DEVICE-%03d", i),
				PointName: "test_value",
				Value:     float64(i * 10),
				Quality:   1,
				Timestamp: time.Now().Add(time.Duration(i) * time.Second),
			},
		}

		err = cache.Store(testData)
		if err != nil {
			log.Printf("Failed to store batch %d: %v", i, err)
			continue
		}

		// Small delay to ensure different timestamps
		time.Sleep(1 * time.Millisecond)
	}

	// Get updated statistics
	updatedStats, err := cache.GetCacheStatistics()
	if err != nil {
		log.Fatalf("Failed to get updated statistics: %v", err)
	}

	fmt.Printf("✓ Total records after bulk insert: %d\n", updatedStats.TotalRecords)
	fmt.Printf("✓ Pending records: %d\n", updatedStats.PendingRecords)

	// Demo 5: Retry mechanism
	fmt.Println("\n--- Demo 5: Retry Mechanism ---")
	
	// Get some records to test retry mechanism
	retryTestData, err := cache.Retrieve(3)
	if err != nil {
		log.Fatalf("Failed to retrieve data for retry test: %v", err)
	}

	if len(retryTestData) > 0 {
		// Simulate upload failure by incrementing retry count
		ids := []int64{retryTestData[0].ID}
		err = cache.IncrementRetryCount(ids)
		if err != nil {
			log.Fatalf("Failed to increment retry count: %v", err)
		}
		fmt.Printf("✓ Incremented retry count for record ID %d\n", retryTestData[0].ID)

		// Retrieve again to show updated retry count
		updatedData, err := cache.Retrieve(1)
		if err != nil {
			log.Fatalf("Failed to retrieve updated data: %v", err)
		}

		if len(updatedData) > 0 {
			fmt.Printf("✓ Record retry count is now: %d\n", updatedData[0].RetryCount)
		}
	}

	// Demo 6: Mark as uploaded
	fmt.Println("\n--- Demo 6: Upload Confirmation ---")
	
	uploadData, err := cache.Retrieve(5)
	if err != nil {
		log.Fatalf("Failed to retrieve data for upload test: %v", err)
	}

	if len(uploadData) > 0 {
		// Mark first 2 records as uploaded
		uploadIds := make([]int64, min(2, len(uploadData)))
		for i := 0; i < len(uploadIds); i++ {
			uploadIds[i] = uploadData[i].ID
		}

		err = cache.MarkUploaded(uploadIds)
		if err != nil {
			log.Fatalf("Failed to mark data as uploaded: %v", err)
		}
		fmt.Printf("✓ Marked %d records as uploaded\n", len(uploadIds))

		// Check pending count
		finalStats, err := cache.GetCacheStatistics()
		if err != nil {
			log.Fatalf("Failed to get final statistics: %v", err)
		}
		fmt.Printf("✓ Remaining pending records: %d\n", finalStats.PendingRecords)
	}

	// Demo 7: Database optimization
	fmt.Println("\n--- Demo 7: Database Optimization ---")
	
	err = cache.OptimizeDatabase()
	if err != nil {
		log.Fatalf("Failed to optimize database: %v", err)
	}
	fmt.Println("✓ Database optimization completed")

	// Final metrics
	fmt.Println("\n--- Final Cache Metrics ---")
	metrics := cache.GetMetrics()
	fmt.Printf("Cached Data Count: %d\n", metrics.CachedDataCount)
	fmt.Printf("Total Cached: %d\n", metrics.TotalCached)
	fmt.Printf("Total Uploaded: %d\n", metrics.TotalUploaded)
	fmt.Printf("Total Deleted: %d\n", metrics.TotalDeleted)
	fmt.Printf("Database Size: %d bytes\n", metrics.DatabaseSize)
	fmt.Printf("Storage Healthy: %t\n", metrics.StorageHealthy)

	fmt.Println("\n=== Demo Completed Successfully ===")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}