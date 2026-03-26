package tdengine

import (
	"context"
	"log"
	"time"
)

// ExampleIntegration demonstrates how to integrate TDengine manager into the main application
func ExampleIntegration() {
	// Create TDengine configuration
	config := &TDengineConfig{
		Host:         "localhost",
		Port:         6030,
		Username:     "root",
		Password:     "taosdata",
		Database:     "industrial_data",
		MaxOpenConns: 20,
		MaxIdleConns: 10,
		ConnTimeout:  30 * time.Second,
		IdleTimeout:  10 * time.Minute,
		MaxLifetime:  1 * time.Hour,
		
		// Health check configuration
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		
		// Auto-reconnection configuration
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}

	// Create TDengine manager
	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}

	// Set up event callbacks for monitoring
	manager.SetEventCallbacks(
		func() {
			log.Println("✅ TDengine connected successfully")
		},
		func() {
			log.Println("❌ TDengine disconnected")
		},
		func(err error) {
			log.Printf("⚠️  TDengine error: %v", err)
		},
	)

	// Start the manager
	if err := manager.Start(); err != nil {
		log.Fatalf("Failed to start TDengine manager: %v", err)
	}
	defer manager.Stop()

	log.Println("TDengine manager started successfully")

	// Example: Create database and tables
	if err := createDatabaseSchema(manager); err != nil {
		log.Printf("Failed to create database schema: %v", err)
	}

	// Example: Insert sample data
	if err := insertSampleData(manager); err != nil {
		log.Printf("Failed to insert sample data: %v", err)
	}

	// Example: Query data
	if err := queryData(manager); err != nil {
		log.Printf("Failed to query data: %v", err)
	}

	// Monitor health and metrics
	monitorHealth(manager)
}

// createDatabaseSchema creates the necessary database and tables
func createDatabaseSchema(manager *TDengineManager) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create database if not exists
	_, err := manager.ExecuteNonQuery(ctx, `
		CREATE DATABASE IF NOT EXISTS industrial_data 
		PRECISION 'ms' 
		KEEP 365 
		DAYS 10 
		BLOCKS 6 
		CACHE 16 
		COMP 2
	`)
	if err != nil {
		return err
	}

	// Use the database
	_, err = manager.ExecuteNonQuery(ctx, "USE industrial_data")
	if err != nil {
		return err
	}

	// Create super table for Modbus metrics
	_, err = manager.ExecuteNonQuery(ctx, `
		CREATE STABLE IF NOT EXISTS modbus_metrics (
			ts TIMESTAMP,
			value DOUBLE,
			quality INT,
			data_type TINYINT,
			raw_value NCHAR(64)
		) TAGS (
			collector_id NCHAR(64),
			device_id NCHAR(64),
			point_name NCHAR(128),
			location NCHAR(64),
			device_type NCHAR(32),
			unit NCHAR(16)
		)
	`)
	if err != nil {
		return err
	}

	// Create super table for OPC-UA metrics
	_, err = manager.ExecuteNonQuery(ctx, `
		CREATE STABLE IF NOT EXISTS opcua_metrics (
			ts TIMESTAMP,
			value DOUBLE,
			status_code INT,
			source_timestamp TIMESTAMP,
			server_timestamp TIMESTAMP
		) TAGS (
			collector_id NCHAR(64),
			server_uri NCHAR(256),
			node_id NCHAR(128),
			namespace_index INT,
			data_type NCHAR(32)
		)
	`)
	if err != nil {
		return err
	}

	// Create super table for system metrics
	_, err = manager.ExecuteNonQuery(ctx, `
		CREATE STABLE IF NOT EXISTS system_metrics (
			ts TIMESTAMP,
			cpu_usage DOUBLE,
			memory_usage DOUBLE,
			disk_usage DOUBLE,
			network_in DOUBLE,
			network_out DOUBLE
		) TAGS (
			collector_id NCHAR(64),
			hostname NCHAR(128),
			os_type NCHAR(32)
		)
	`)

	log.Println("Database schema created successfully")
	return err
}

// insertSampleData inserts sample data into the tables
func insertSampleData(manager *TDengineManager) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Insert sample Modbus data
	_, err := manager.ExecuteNonQuery(ctx, `
		INSERT INTO d_collector_001_temp USING modbus_metrics TAGS 
		('collector-001', 'device-001', 'temperature', 'workshop_a', 'plc', '°C')
		VALUES 
		(NOW, 25.6, 1, 1, '25.6'),
		(NOW-1s, 25.4, 1, 1, '25.4'),
		(NOW-2s, 25.8, 1, 1, '25.8')
	`)
	if err != nil {
		return err
	}

	// Insert sample OPC-UA data
	_, err = manager.ExecuteNonQuery(ctx, `
		INSERT INTO d_opcua_server_001 USING opcua_metrics TAGS 
		('collector-001', 'opc.tcp://localhost:4840', 'ns=2;i=1001', 2, 'Double')
		VALUES 
		(NOW, 100.5, 0, NOW, NOW),
		(NOW-1s, 99.8, 0, NOW-1s, NOW-1s),
		(NOW-2s, 101.2, 0, NOW-2s, NOW-2s)
	`)
	if err != nil {
		return err
	}

	// Insert sample system metrics
	_, err = manager.ExecuteNonQuery(ctx, `
		INSERT INTO d_system_collector_001 USING system_metrics TAGS 
		('collector-001', 'collector-host-001', 'linux')
		VALUES 
		(NOW, 45.2, 68.5, 78.9, 1024.0, 512.0),
		(NOW-1s, 44.8, 67.9, 78.9, 1020.0, 510.0),
		(NOW-2s, 46.1, 69.2, 78.9, 1028.0, 515.0)
	`)

	log.Println("Sample data inserted successfully")
	return err
}

// queryData demonstrates various query operations
func queryData(manager *TDengineManager) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Query latest Modbus data
	rows, err := manager.ExecuteQuery(ctx, `
		SELECT ts, value, quality, location, device_type 
		FROM modbus_metrics 
		WHERE ts >= NOW - 1h 
		ORDER BY ts DESC 
		LIMIT 10
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	log.Println("Latest Modbus data:")
	for rows.Next() {
		var ts time.Time
		var value float64
		var quality int
		var location, deviceType string

		if err := rows.Scan(&ts, &value, &quality, &location, &deviceType); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		log.Printf("  %v: %.2f (quality=%d, location=%s, type=%s)",
			ts.Format("2006-01-02 15:04:05"), value, quality, location, deviceType)
	}

	// Query aggregated data
	rows, err = manager.ExecuteQuery(ctx, `
		SELECT 
			collector_id,
			AVG(value) as avg_value,
			MAX(value) as max_value,
			MIN(value) as min_value,
			COUNT(*) as count
		FROM modbus_metrics 
		WHERE ts >= NOW - 1h 
		GROUP BY collector_id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	log.Println("Aggregated Modbus data:")
	for rows.Next() {
		var collectorID string
		var avgValue, maxValue, minValue float64
		var count int64

		if err := rows.Scan(&collectorID, &avgValue, &maxValue, &minValue, &count); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		log.Printf("  Collector %s: avg=%.2f, max=%.2f, min=%.2f, count=%d",
			collectorID, avgValue, maxValue, minValue, count)
	}

	return nil
}

// monitorHealth demonstrates health monitoring
func monitorHealth(manager *TDengineManager) {
	// Get current health status
	status := manager.GetHealthStatus()
	log.Printf("Health Status: healthy=%v, last_check=%v, consecutive_failures=%d",
		status.IsHealthy, status.LastCheck.Format("15:04:05"), status.ConsecutiveFailures)

	// Get pool statistics
	poolStats := manager.GetPoolStats()
	log.Printf("Pool Stats: active=%d, idle=%d, total=%d, created=%d, destroyed=%d",
		poolStats.ActiveConnections, poolStats.IdleConnections, poolStats.TotalConnections,
		poolStats.ConnectionsCreated, poolStats.ConnectionsDestroyed)

	// Get database metrics
	metrics := manager.GetMetrics()
	log.Printf("DB Metrics: queries=%d, failed=%d, avg_duration=%.2fms",
		metrics.QueriesExecuted, metrics.QueriesFailed,
		float64(metrics.QueryDuration)/float64(metrics.QueriesExecuted)/1e6)

	// Get reconnection stats
	reconnectCount, lastReconnect := manager.GetReconnectStats()
	log.Printf("Reconnect Stats: count=%d, last_attempt=%v, is_reconnecting=%v",
		reconnectCount, lastReconnect.Format("15:04:05"), manager.IsReconnecting())
}

// ExampleDataPoint represents a single data point for the example
type ExampleDataPoint struct {
	Timestamp   time.Time   `json:"timestamp"`
	Value       float64     `json:"value"`
	Quality     int         `json:"quality"`
	DataType    int         `json:"data_type"`
	RawValue    string      `json:"raw_value"`
	CollectorID string      `json:"collector_id"`
	DeviceID    string      `json:"device_id"`
	PointName   string      `json:"point_name"`
	Location    string      `json:"location"`
	DeviceType  string      `json:"device_type"`
	Unit        string      `json:"unit"`
	SuperTable  string      `json:"super_table"`
}