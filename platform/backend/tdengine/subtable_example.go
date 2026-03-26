package tdengine

import (
	"context"
	"fmt"
	"log"
	"time"
)

// SubTableManagementExample demonstrates comprehensive sub-table management functionality
func SubTableManagementExample() {
	// Initialize TDengine service
	config := DefaultTDengineConfig()
	config.Host = "localhost"
	config.Port = 6030
	config.Username = "root"
	config.Password = "taosdata"
	
	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}
	
	err = manager.Start()
	if err != nil {
		log.Fatalf("Failed to start TDengine manager: %v", err)
	}
	defer manager.Stop()
	
	service := NewTDengineService(manager)
	ctx := context.Background()
	
	// Example 1: Create database and super table for IoT data
	fmt.Println("=== Example 1: Setting up database and super table ===")
	
	database := "iot_data"
	superTable := "sensor_metrics"
	
	// Create database
	err = service.CreateDatabase(ctx, database, &DatabaseOptions{
		Days:      30,
		Keep:      "365",
		Cache:     32,
		Precision: "ms",
	})
	if err != nil {
		log.Printf("Database creation failed (may already exist): %v", err)
	} else {
		fmt.Printf("Created database: %s\n", database)
	}
	
	// Create super table for sensor data
	schema := &SuperTableSchema{
		Name: superTable,
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "temperature", Type: "FLOAT"},
			{Name: "humidity", Type: "FLOAT"},
			{Name: "pressure", Type: "DOUBLE"},
			{Name: "battery_level", Type: "INT"},
			{Name: "status", Type: "TINYINT"},
		},
		Tags: []SuperTableTag{
			{Name: "collector_id", Type: "NCHAR", Length: 64},
			{Name: "device_id", Type: "NCHAR", Length: 64},
			{Name: "location", Type: "NCHAR", Length: 128},
			{Name: "device_type", Type: "NCHAR", Length: 32},
			{Name: "manufacturer", Type: "NCHAR", Length: 64},
		},
	}
	
	err = service.CreateSuperTable(ctx, database, schema, &SuperTableOptions{IfNotExists: true})
	if err != nil {
		log.Printf("Super table creation failed (may already exist): %v", err)
	} else {
		fmt.Printf("Created super table: %s\n", superTable)
	}
	
	// Example 2: Manual sub-table creation
	fmt.Println("\n=== Example 2: Manual sub-table creation ===")
	
	subTableName := "sensor_workshop_a_001"
	tags := map[string]interface{}{
		"collector_id":  "collector-001",
		"device_id":     "sensor-001",
		"location":      "Workshop A - Line 1",
		"device_type":   "temperature_sensor",
		"manufacturer":  "SensorTech Inc",
	}
	
	err = service.CreateSubTable(ctx, database, superTable, subTableName, tags, &SubTableOptions{IfNotExists: true})
	if err != nil {
		log.Printf("Sub-table creation failed: %v", err)
	} else {
		fmt.Printf("Created sub-table: %s\n", subTableName)
	}
	
	// Example 3: Auto-creation from data points
	fmt.Println("\n=== Example 3: Auto-creation from data points ===")
	
	dataPoints := []DataPoint{
		{
			DeviceID:  "sensor-002",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     23.5,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id":  "collector-001",
				"location":      "Workshop B - Line 2",
				"device_type":   "multi_sensor",
				"manufacturer":  "IoT Solutions Ltd",
			},
		},
		{
			DeviceID:  "sensor-003",
			PointName: "humidity",
			Timestamp: time.Now(),
			Value:     65.2,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id":  "collector-002",
				"location":      "Warehouse - Zone A",
				"device_type":   "environmental_sensor",
				"manufacturer":  "EnviroTech Corp",
			},
		},
	}
	
	for _, dp := range dataPoints {
		subTableName, err := service.AutoCreateSubTable(ctx, database, superTable, dp)
		if err != nil {
			log.Printf("Auto-creation failed for device %s: %v", dp.DeviceID, err)
		} else {
			fmt.Printf("Auto-created sub-table: %s for device: %s\n", subTableName, dp.DeviceID)
		}
	}
	
	// Example 4: List all sub-tables with pagination
	fmt.Println("\n=== Example 4: Listing sub-tables with pagination ===")
	
	result, err := service.ListSubTables(ctx, database, superTable, nil, 1, 10)
	if err != nil {
		log.Printf("Failed to list sub-tables: %v", err)
	} else {
		fmt.Printf("Found %d sub-tables (page 1, showing %d):\n", result.Total, len(result.SubTables))
		for i, subTable := range result.SubTables {
			fmt.Printf("  %d. %s (created: %s, records: %d)\n", 
				i+1, subTable.Name, subTable.CreatedTime.Format("2006-01-02 15:04:05"), subTable.RecordCount)
		}
	}
	
	// Example 5: Filter sub-tables by tags
	fmt.Println("\n=== Example 5: Filtering sub-tables by tags ===")
	
	tagFilters := map[string]interface{}{
		"collector_id": "collector-001",
	}
	
	filteredSubTables, err := service.GetSubTablesByTags(ctx, database, superTable, tagFilters)
	if err != nil {
		log.Printf("Failed to filter sub-tables by tags: %v", err)
	} else {
		fmt.Printf("Found %d sub-tables for collector-001:\n", len(filteredSubTables))
		for i, subTable := range filteredSubTables {
			fmt.Printf("  %d. %s (location: %v)\n", 
				i+1, subTable.Name, subTable.Tags["location"])
		}
	}
	
	// Example 6: Insert data with automatic sub-table management
	fmt.Println("\n=== Example 6: Inserting data with auto sub-table management ===")
	
	sampleData := []DataPoint{
		{
			DeviceID:  "sensor-001",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     24.8,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector-001",
			},
		},
		{
			DeviceID:  "sensor-002",
			PointName: "humidity",
			Timestamp: time.Now(),
			Value:     68.5,
			Quality:   1,
			Tags: map[string]interface{}{
				"collector_id": "collector-001",
			},
		},
	}
	
	err = service.InsertDataWithAutoSubTable(ctx, database, superTable, sampleData)
	if err != nil {
		log.Printf("Failed to insert data: %v", err)
	} else {
		fmt.Printf("Successfully inserted %d data points with auto sub-table management\n", len(sampleData))
	}
	
	// Example 7: Sub-table lifecycle management
	fmt.Println("\n=== Example 7: Sub-table lifecycle management ===")
	
	// Create a lifecycle policy
	maxAge := 30 * 24 * time.Hour // 30 days
	maxIdleTime := 7 * 24 * time.Hour // 7 days
	minRecords := int64(100)
	
	lifecyclePolicy := &SubTableLifecyclePolicy{
		AutoCleanup:        true,
		MaxAge:             &maxAge,
		MaxIdleTime:        &maxIdleTime,
		MinRecords:         &minRecords,
		ArchiveOldData:     true,
		NotifyBeforeDelete: true,
	}
	
	err = service.ApplyLifecyclePolicy(ctx, database, superTable, lifecyclePolicy)
	if err != nil {
		log.Printf("Failed to apply lifecycle policy: %v", err)
	} else {
		fmt.Println("Successfully applied lifecycle policy to sub-tables")
	}
	
	// Example 8: Get detailed sub-table information
	fmt.Println("\n=== Example 8: Getting detailed sub-table information ===")
	
	if len(result.SubTables) > 0 {
		firstSubTable := result.SubTables[0].Name
		subInfo, err := service.GetSubTableInfo(ctx, database, firstSubTable)
		if err != nil {
			log.Printf("Failed to get sub-table info: %v", err)
		} else {
			fmt.Printf("Sub-table details for %s:\n", firstSubTable)
			fmt.Printf("  Super table: %s\n", subInfo.SuperTable)
			fmt.Printf("  Created: %s\n", subInfo.CreatedTime.Format("2006-01-02 15:04:05"))
			fmt.Printf("  Last update: %s\n", subInfo.LastUpdate.Format("2006-01-02 15:04:05"))
			fmt.Printf("  Record count: %d\n", subInfo.RecordCount)
			fmt.Printf("  Tags: %+v\n", subInfo.Tags)
		}
	}
	
	// Example 9: Advanced filtering with time ranges
	fmt.Println("\n=== Example 9: Advanced filtering with time ranges ===")
	
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	
	advancedFilter := &SubTableFilter{
		CreatedAfter: &yesterday,
		CreatedBefore: &now,
	}
	
	recentResult, err := service.ListSubTables(ctx, database, superTable, advancedFilter, 1, 5)
	if err != nil {
		log.Printf("Failed to list recent sub-tables: %v", err)
	} else {
		fmt.Printf("Found %d sub-tables created in the last 24 hours:\n", len(recentResult.SubTables))
		for i, subTable := range recentResult.SubTables {
			fmt.Printf("  %d. %s (created: %s)\n", 
				i+1, subTable.Name, subTable.CreatedTime.Format("2006-01-02 15:04:05"))
		}
	}
	
	// Example 10: Cleanup - Drop a sub-table
	fmt.Println("\n=== Example 10: Cleanup operations ===")
	
	// Create a temporary sub-table for demonstration
	tempSubTable := "temp_test_subtable"
	tempTags := map[string]interface{}{
		"collector_id":  "temp-collector",
		"device_id":     "temp-device",
		"location":      "Test Location",
		"device_type":   "test_sensor",
		"manufacturer":  "Test Corp",
	}
	
	err = service.CreateSubTable(ctx, database, superTable, tempSubTable, tempTags, nil)
	if err != nil {
		log.Printf("Failed to create temp sub-table: %v", err)
	} else {
		fmt.Printf("Created temporary sub-table: %s\n", tempSubTable)
		
		// Verify it exists
		exists, err := service.SubTableExists(ctx, database, tempSubTable)
		if err != nil {
			log.Printf("Failed to check sub-table existence: %v", err)
		} else {
			fmt.Printf("Sub-table exists: %v\n", exists)
		}
		
		// Drop the temporary sub-table
		err = service.DropSubTable(ctx, database, tempSubTable)
		if err != nil {
			log.Printf("Failed to drop temp sub-table: %v", err)
		} else {
			fmt.Printf("Successfully dropped temporary sub-table: %s\n", tempSubTable)
		}
		
		// Verify it's gone
		exists, err = service.SubTableExists(ctx, database, tempSubTable)
		if err != nil {
			log.Printf("Failed to check sub-table existence after drop: %v", err)
		} else {
			fmt.Printf("Sub-table exists after drop: %v\n", exists)
		}
	}
	
	fmt.Println("\n=== Sub-table management example completed ===")
}

// CollectorDataIngestionExample demonstrates real-world collector data ingestion with sub-table management
func CollectorDataIngestionExample() {
	fmt.Println("\n=== Collector Data Ingestion Example ===")
	
	// Initialize service (same as above)
	config := DefaultTDengineConfig()
	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}
	
	err = manager.Start()
	if err != nil {
		log.Fatalf("Failed to start TDengine manager: %v", err)
	}
	defer manager.Stop()
	
	service := NewTDengineService(manager)
	ctx := context.Background()
	
	// Simulate collector data ingestion
	collectorID := "industrial-collector-001"
	
	// Simulate data from multiple devices
	deviceData := map[string][]DataPoint{
		"plc-001": {
			{
				DeviceID:  "plc-001",
				PointName: "motor_speed",
				Timestamp: time.Now(),
				Value:     1450.5,
				Quality:   1,
				Tags: map[string]interface{}{
					"location":     "Production Line 1",
					"device_type":  "plc",
					"manufacturer": "Siemens",
					"unit":         "rpm",
				},
			},
			{
				DeviceID:  "plc-001",
				PointName: "motor_current",
				Timestamp: time.Now(),
				Value:     12.8,
				Quality:   1,
				Tags: map[string]interface{}{
					"location":     "Production Line 1",
					"device_type":  "plc",
					"manufacturer": "Siemens",
					"unit":         "A",
				},
			},
		},
		"temperature-sensor-001": {
			{
				DeviceID:  "temperature-sensor-001",
				PointName: "ambient_temperature",
				Timestamp: time.Now(),
				Value:     22.5,
				Quality:   1,
				Tags: map[string]interface{}{
					"location":     "Workshop A",
					"device_type":  "temperature_sensor",
					"manufacturer": "Honeywell",
					"unit":         "°C",
				},
			},
		},
		"flow-meter-001": {
			{
				DeviceID:  "flow-meter-001",
				PointName: "water_flow_rate",
				Timestamp: time.Now(),
				Value:     15.2,
				Quality:   1,
				Tags: map[string]interface{}{
					"location":     "Cooling System",
					"device_type":  "flow_meter",
					"manufacturer": "Endress+Hauser",
					"unit":         "L/min",
				},
			},
		},
	}
	
	// Process data from each device
	for deviceID, dataPoints := range deviceData {
		fmt.Printf("Processing data from device: %s\n", deviceID)
		
		// Add collector ID to all data points
		for i := range dataPoints {
			if dataPoints[i].Tags == nil {
				dataPoints[i].Tags = make(map[string]interface{})
			}
			dataPoints[i].Tags["collector_id"] = collectorID
		}
		
		// Insert data using the collector data insertion method
		err := service.InsertCollectorData(ctx, collectorID, dataPoints)
		if err != nil {
			log.Printf("Failed to insert data for device %s: %v", deviceID, err)
		} else {
			fmt.Printf("Successfully inserted %d data points for device %s\n", len(dataPoints), deviceID)
		}
	}
	
	// Query the latest data to verify insertion
	fmt.Println("\nQuerying latest data...")
	latestData, err := service.QueryLatestData(ctx, []string{collectorID}, 10)
	if err != nil {
		log.Printf("Failed to query latest data: %v", err)
	} else {
		fmt.Printf("Retrieved %d latest data points:\n", len(latestData))
		for i, dp := range latestData {
			fmt.Printf("  %d. Device: %s, Point: %s, Value: %v, Time: %s\n",
				i+1, dp.DeviceID, dp.PointName, dp.Value, dp.Timestamp.Format("15:04:05"))
		}
	}
	
	fmt.Println("Collector data ingestion example completed")
}

// RunAllSubTableExamples runs all sub-table management examples
func RunAllSubTableExamples() {
	fmt.Println("Starting TDengine Sub-table Management Examples...")
	
	// Run the main sub-table management example
	SubTableManagementExample()
	
	// Run the collector data ingestion example
	CollectorDataIngestionExample()
	
	fmt.Println("\nAll examples completed successfully!")
}