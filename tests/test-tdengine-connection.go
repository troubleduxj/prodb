package main

import (
	"fmt"
	"log"
	"prodb/platform/backend/tdengine"
	"time"
)

func main() {
	fmt.Println("Testing TDengine connection to 192.168.237.145:6041 (REST)...")
	
	// Create TDengine configuration
	config := &tdengine.TDengineConfig{
		Host:         "192.168.237.145",
		Port:         6041, // REST connection port
		Username:     "root",
		Password:     "taosdata",
		Database:     "",
		MaxOpenConns: 5,
		MaxIdleConns: 2,
		ConnTimeout:  10 * time.Second,
		
		// Health check configuration
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		
		// Auto-reconnection configuration
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 3,
	}
	
	// Validate configuration
	if err := config.Validate(); err != nil {
		log.Fatalf("Configuration validation failed: %v", err)
	}
	
	fmt.Printf("Configuration validated successfully\n")
	fmt.Printf("DSN: %s\n", config.DSN())
	
	// Create TDengine manager
	manager, err := tdengine.NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}
	
	fmt.Println("TDengine manager created successfully")
	
	// Start the manager
	if err := manager.Start(); err != nil {
		log.Fatalf("Failed to start TDengine manager: %v", err)
	}
	
	fmt.Println("TDengine manager started successfully")
	defer manager.Stop()
	
	// Test connection
	fmt.Println("Testing connection...")
	conn, err := manager.GetConnection()
	if err != nil {
		log.Fatalf("Failed to get connection: %v", err)
	}
	defer conn.Close()
	
	fmt.Println("Connection established successfully!")
	
	// Test basic query
	fmt.Println("Testing basic query...")
	rows, err := conn.Query("SELECT SERVER_VERSION()")
	if err != nil {
		log.Printf("Query failed: %v", err)
	} else {
		defer rows.Close()
		if rows.Next() {
			var version string
			if err := rows.Scan(&version); err != nil {
				log.Printf("Failed to scan result: %v", err)
			} else {
				fmt.Printf("TDengine server version: %s\n", version)
			}
		}
	}
	
	// Get health status
	fmt.Println("Checking health status...")
	status := manager.GetHealthStatus()
	fmt.Printf("Health Status:\n")
	fmt.Printf("  Healthy: %v\n", status.IsHealthy)
	fmt.Printf("  Last Check: %v\n", status.LastCheck)
	fmt.Printf("  Uptime: %v\n", status.Uptime)
	fmt.Printf("  Error: %v\n", status.Error)
	
	// Get metrics
	fmt.Println("Getting metrics...")
	metrics := manager.GetMetrics()
	fmt.Printf("Metrics:\n")
	fmt.Printf("  Active Connections: %d\n", metrics.ActiveConnections)
	fmt.Printf("  Total Connections: %d\n", metrics.TotalConnections)
	fmt.Printf("  Failed Connections: %d\n", metrics.FailedConnections)
	fmt.Printf("  Reconnect Count: %d\n", metrics.ReconnectCount)
	
	fmt.Println("\nTDengine connection test completed successfully!")
}