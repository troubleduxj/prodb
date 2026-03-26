package main

import (
	"fmt"
	"log"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol/opcua"
)

func main() {
	fmt.Println("OPC-UA Protocol Demo")
	fmt.Println("===================")

	// Initialize logger
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	// Create OPC-UA protocol instance
	protocol := opcua.NewOPCUAProtocol(logger)
	fmt.Printf("Created OPC-UA protocol: %s\n", protocol.GetName())

	// Configure connection
	connectionConfig := map[string]interface{}{
		"endpoint":         "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode":    "None",
		"security_policy":  "None",
		"auth_mode":        "Anonymous",
		"request_timeout":  10000,
		"session_timeout": 60000,
	}

	// Validate configuration
	fmt.Println("\nValidating configuration...")
	if err := protocol.Validate(connectionConfig); err != nil {
		log.Fatalf("Configuration validation failed: %v", err)
	}
	fmt.Println("Configuration is valid")

	// Connect to OPC-UA server
	fmt.Println("\nConnecting to OPC-UA server...")
	if err := protocol.Connect(connectionConfig); err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	fmt.Printf("Connected: %v\n", protocol.IsConnected())

	// Define data points to collect
	dataPoints := []config.DataPointConfig{
		{
			Name:     "temperature_sensor",
			Address:  "ns=2;i=1001",
			DataType: "float32",
			Unit:     "°C",
			Scale:    0.1,
			Offset:   0,
			Tags: map[string]string{
				"location":    "reactor_1",
				"sensor_type": "temperature",
			},
		},
		{
			Name:     "pressure_sensor",
			Address:  "ns=2;i=1002",
			DataType: "float32",
			Unit:     "bar",
			Scale:    0.01,
			Offset:   0,
			Tags: map[string]string{
				"location":    "reactor_1",
				"sensor_type": "pressure",
			},
		},
		{
			Name:     "pump_status",
			Address:  "ns=2;i=2001",
			DataType: "bool",
			Unit:     "",
			Tags: map[string]string{
				"location":    "pump_station",
				"device_type": "pump",
			},
		},
		{
			Name:     "high_freq_sensor",
			Address:  "ns=2;i=5001",
			DataType: "float32",
			Unit:     "Hz",
			Tags: map[string]string{
				"location":        "vibration_monitor",
				"sensor_type":     "accelerometer",
				"collection_mode": "subscription",
				"sampling_interval": "1000",
			},
		},
	}

	// Collect data multiple times
	fmt.Println("\nCollecting data...")
	for i := 0; i < 3; i++ {
		fmt.Printf("\n--- Collection cycle %d ---\n", i+1)
		
		dataValues, err := protocol.Collect(dataPoints)
		if err != nil {
			log.Printf("Failed to collect data: %v", err)
			continue
		}

		for _, value := range dataValues {
			fmt.Printf("Point: %-20s | Value: %-15v | Quality: %d | Type: %-8s | Unit: %-5s | Device: %s\n",
				value.PointName,
				value.Value,
				value.Quality,
				value.DataType,
				value.Unit,
				value.DeviceID,
			)
		}

		time.Sleep(2 * time.Second)
	}

	// Show protocol metrics
	fmt.Println("\n--- Protocol Metrics ---")
	metrics := protocol.GetMetrics()
	for key, value := range metrics {
		fmt.Printf("%-20s: %v\n", key, value)
	}

	// Disconnect
	fmt.Println("\nDisconnecting...")
	if err := protocol.Disconnect(); err != nil {
		log.Printf("Failed to disconnect: %v", err)
	}
	fmt.Printf("Connected: %v\n", protocol.IsConnected())

	fmt.Println("\nDemo completed successfully!")
}