package tdengine

import (
	"context"
	"fmt"
	"log"
	"time"
)

// DatabaseManagementExample demonstrates comprehensive database management operations
func DatabaseManagementExample() {
	// Initialize TDengine manager and service
	config := &TDengineConfig{
		Host:         "localhost",
		Port:         6030,
		Username:     "root",
		Password:     "taosdata",
		Database:     "",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnTimeout:  30 * time.Second,
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}

	service := NewTDengineService(manager)

	// Start the manager
	if err := manager.Start(); err != nil {
		log.Fatalf("Failed to start TDengine manager: %v", err)
	}
	defer manager.Stop()

	ctx := context.Background()

	// Example 1: List existing databases
	fmt.Println("=== Example 1: List Databases ===")
	databases, err := service.ListDatabases(ctx)
	if err != nil {
		log.Printf("Failed to list databases: %v", err)
	} else {
		fmt.Printf("Found %d databases:\n", len(databases))
		for _, db := range databases {
			fmt.Printf("- %s (Tables: %d, Status: %s)\n", db.Name, db.NTables, db.Status)
		}
	}

	// Example 2: Create a new database with options
	fmt.Println("\n=== Example 2: Create Database ===")
	testDBName := "industrial_test_db"
	
	options := &DatabaseOptions{
		Days:      10,
		Keep:      "365",
		Cache:     16,
		Blocks:    6,
		MinRows:   100,
		MaxRows:   4096,
		WalLevel:  1,
		Fsync:     3000,
		Comp:      2,
		Precision: "ms",
		Replica:   1,
	}

	err = service.CreateDatabase(ctx, testDBName, options)
	if err != nil {
		log.Printf("Failed to create database: %v", err)
	} else {
		fmt.Printf("Successfully created database: %s\n", testDBName)
	}

	// Example 3: Get database information
	fmt.Println("\n=== Example 3: Get Database Info ===")
	dbInfo, err := service.GetDatabaseInfo(ctx, testDBName)
	if err != nil {
		log.Printf("Failed to get database info: %v", err)
	} else {
		fmt.Printf("Database Info:\n")
		fmt.Printf("  Name: %s\n", dbInfo.Name)
		fmt.Printf("  Created: %s\n", dbInfo.CreatedTime.Format("2006-01-02 15:04:05"))
		fmt.Printf("  Tables: %d\n", dbInfo.NTables)
		fmt.Printf("  VGroups: %d\n", dbInfo.VGroups)
		fmt.Printf("  Days: %d\n", dbInfo.Days)
		fmt.Printf("  Keep: %s\n", dbInfo.Keep)
		fmt.Printf("  Cache: %d MB\n", dbInfo.Cache)
		fmt.Printf("  Precision: %s\n", dbInfo.Precision)
		fmt.Printf("  Status: %s\n", dbInfo.Status)
	}

	// Example 4: Check if database exists
	fmt.Println("\n=== Example 4: Check Database Existence ===")
	exists, err := service.DatabaseExists(ctx, testDBName)
	if err != nil {
		log.Printf("Failed to check database existence: %v", err)
	} else {
		fmt.Printf("Database '%s' exists: %t\n", testDBName, exists)
	}

	// Check non-existent database
	exists, err = service.DatabaseExists(ctx, "non_existent_db")
	if err != nil {
		log.Printf("Failed to check database existence: %v", err)
	} else {
		fmt.Printf("Database 'non_existent_db' exists: %t\n", exists)
	}

	// Example 5: Create super table in the database
	fmt.Println("\n=== Example 5: Create Super Table ===")
	createSuperTableSQL := fmt.Sprintf(`
		USE %s;
		CREATE STABLE IF NOT EXISTS sensor_data (
			ts TIMESTAMP,
			temperature FLOAT,
			humidity FLOAT,
			pressure FLOAT,
			quality INT
		) TAGS (
			device_id NCHAR(64),
			location NCHAR(128),
			device_type NCHAR(32)
		);
	`, testDBName)

	_, err = manager.ExecuteNonQuery(ctx, createSuperTableSQL)
	if err != nil {
		log.Printf("Failed to create super table: %v", err)
	} else {
		fmt.Println("Successfully created super table: sensor_data")
	}

	// Example 6: Insert sample data
	fmt.Println("\n=== Example 6: Insert Sample Data ===")
	sampleData := []DataPoint{
		{
			DeviceID:  "sensor_001",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.6,
			Quality:   1,
			Tags: map[string]interface{}{
				"location":    "workshop_a",
				"device_type": "temperature_sensor",
			},
		},
		{
			DeviceID:  "sensor_002",
			PointName: "humidity",
			Timestamp: time.Now(),
			Value:     65.2,
			Quality:   1,
			Tags: map[string]interface{}{
				"location":    "workshop_a",
				"device_type": "humidity_sensor",
			},
		},
	}

	err = service.InsertCollectorData(ctx, "collector_001", sampleData)
	if err != nil {
		log.Printf("Failed to insert sample data: %v", err)
	} else {
		fmt.Printf("Successfully inserted %d data points\n", len(sampleData))
	}

	// Example 7: Query latest data
	fmt.Println("\n=== Example 7: Query Latest Data ===")
	latestData, err := service.QueryLatestData(ctx, []string{"collector_001"}, 10)
	if err != nil {
		log.Printf("Failed to query latest data: %v", err)
	} else {
		fmt.Printf("Retrieved %d latest data points:\n", len(latestData))
		for _, dp := range latestData {
			fmt.Printf("  Device: %s, Point: %s, Value: %v, Time: %s\n",
				dp.DeviceID, dp.PointName, dp.Value, dp.Timestamp.Format("15:04:05"))
		}
	}

	// Example 8: Database validation examples
	fmt.Println("\n=== Example 8: Database Name Validation ===")
	testNames := []string{
		"valid_database",
		"123invalid",
		"test-database",
		"_valid_name",
		"select",
		"",
		"very_long_database_name_that_exceeds_maximum_length_of_64_characters",
	}

	for _, name := range testNames {
		tempService := NewTDengineService(manager)
		err := tempService.validateDatabaseName(name)
		if err != nil {
			fmt.Printf("  '%s': INVALID - %s\n", name, err.Error())
		} else {
			fmt.Printf("  '%s': VALID\n", name)
		}
	}

	// Example 9: Database options validation
	fmt.Println("\n=== Example 9: Database Options Validation ===")
	testOptions := []*DatabaseOptions{
		{Days: 10, Keep: "365", Cache: 16, Precision: "ms"},
		{Days: -1}, // Invalid
		{WalLevel: 3}, // Invalid
		{Precision: "invalid"}, // Invalid
		{Cache: -5}, // Invalid
	}

	for i, opts := range testOptions {
		err := opts.Validate()
		if err != nil {
			fmt.Printf("  Options %d: INVALID - %s\n", i+1, err.Error())
		} else {
			fmt.Printf("  Options %d: VALID\n", i+1)
		}
	}

	// Example 10: Clean up - Drop the test database
	fmt.Println("\n=== Example 10: Clean Up ===")
	err = service.DropDatabase(ctx, testDBName)
	if err != nil {
		log.Printf("Failed to drop test database: %v", err)
	} else {
		fmt.Printf("Successfully dropped test database: %s\n", testDBName)
	}

	// Verify database was dropped
	exists, err = service.DatabaseExists(ctx, testDBName)
	if err != nil {
		log.Printf("Failed to verify database deletion: %v", err)
	} else {
		fmt.Printf("Database '%s' exists after deletion: %t\n", testDBName, exists)
	}

	fmt.Println("\n=== Database Management Example Complete ===")
}

// RunDatabaseManagementDemo runs the database management demonstration
func RunDatabaseManagementDemo() {
	fmt.Println("Starting TDengine Database Management API Demo...")
	fmt.Println("Note: This demo requires a running TDengine instance on localhost:6030")
	fmt.Println("Default credentials: root/taosdata")
	fmt.Println()

	DatabaseManagementExample()
}

// DatabaseAPIUsageExamples shows various API usage patterns
func DatabaseAPIUsageExamples() {
	fmt.Println("=== Database API Usage Examples ===")

	// Example HTTP requests that would be made to the API
	examples := []struct {
		method      string
		endpoint    string
		description string
		payload     string
	}{
		{
			method:      "GET",
			endpoint:    "/api/v1/tdengine/databases",
			description: "List all databases",
			payload:     "",
		},
		{
			method:      "POST",
			endpoint:    "/api/v1/tdengine/databases",
			description: "Create a new database",
			payload: `{
  "name": "industrial_data",
  "options": {
    "days": 10,
    "keep": "365",
    "cache": 16,
    "precision": "ms",
    "replica": 1
  }
}`,
		},
		{
			method:      "GET",
			endpoint:    "/api/v1/tdengine/databases/industrial_data",
			description: "Get database information",
			payload:     "",
		},
		{
			method:      "GET",
			endpoint:    "/api/v1/tdengine/databases/industrial_data/exists",
			description: "Check if database exists",
			payload:     "",
		},
		{
			method:      "GET",
			endpoint:    "/api/v1/tdengine/databases/industrial_data/statistics",
			description: "Get database statistics",
			payload:     "",
		},
		{
			method:      "POST",
			endpoint:    "/api/v1/tdengine/validate-name",
			description: "Validate database name",
			payload: `{
  "name": "test_database_123"
}`,
		},
		{
			method:      "DELETE",
			endpoint:    "/api/v1/tdengine/databases/industrial_data",
			description: "Drop a database",
			payload:     "",
		},
	}

	for _, example := range examples {
		fmt.Printf("%s %s\n", example.method, example.endpoint)
		fmt.Printf("Description: %s\n", example.description)
		if example.payload != "" {
			fmt.Printf("Payload:\n%s\n", example.payload)
		}
		fmt.Println()
	}
}