package main

import (
	"encoding/json"
	"fmt"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// DemoSensorData represents sample sensor data for demonstration
type DemoSensorData struct {
	Timestamp   string  `json:"timestamp"`
	Temperature float64 `json:"temperature"`
	Humidity    float64 `json:"humidity"`
	Pressure    float64 `json:"pressure"`
	DeviceID    string  `json:"device_id"`
	Location    string  `json:"location"`
}

func main() {
	fmt.Println("MQTT Protocol Demo")
	fmt.Println("==================")

	// Initialize logger
	logger := logger.NewLogger("debug")

	// Create MQTT protocol instance
	mqttProtocol := protocol.NewMQTTProtocol(logger)

	// Demo basic configuration validation
	fmt.Println("\n1. Configuration Validation Demo")
	demonstrateValidation(mqttProtocol)

	// Demo data format handling
	fmt.Println("\n2. Data Format Handling Demo")
	demonstrateDataFormats()

	// Demo JSONPath extraction
	fmt.Println("\n3. JSONPath Extraction Demo")
	demonstrateJSONPath()

	fmt.Println("\nDemo completed!")
	fmt.Println("Note: This demo shows MQTT protocol capabilities.")
	fmt.Println("To test with a real MQTT broker, configure the connection parameters.")
}

func demonstrateValidation(protocol *protocol.MQTTProtocol) {
	fmt.Println("Testing configuration validation...")

	// Test valid configuration
	validConfig := map[string]interface{}{
		"broker": "localhost",
		"port":   float64(1883),
		"topics": []interface{}{
			map[string]interface{}{
				"topic":       "sensors/temperature",
				"qos":         float64(1),
				"data_format": "json",
			},
		},
	}

	if err := protocol.Validate(validConfig); err != nil {
		fmt.Printf("❌ Valid config failed validation: %v\n", err)
	} else {
		fmt.Println("✅ Valid configuration passed validation")
	}

	// Test invalid configuration
	invalidConfig := map[string]interface{}{
		"port": float64(1883), // Missing broker
	}

	if err := protocol.Validate(invalidConfig); err != nil {
		fmt.Printf("✅ Invalid config correctly rejected: %v\n", err)
	} else {
		fmt.Println("❌ Invalid config incorrectly accepted")
	}
}

func demonstrateDataFormats() {
	fmt.Println("Demonstrating different data formats...")

	// JSON format example
	jsonData := DemoSensorData{
		Timestamp:   time.Now().Format(time.RFC3339),
		Temperature: 25.6,
		Humidity:    65.2,
		Pressure:    1013.25,
		DeviceID:    "sensor_001",
		Location:    "factory_floor_1",
	}

	jsonBytes, _ := json.MarshalIndent(jsonData, "", "  ")
	fmt.Printf("JSON Format:\n%s\n\n", string(jsonBytes))

	// Raw format example
	rawData := "Temperature: 25.6°C, Humidity: 65.2%, Status: OK"
	fmt.Printf("Raw Format:\n%s\n\n", rawData)

	// CSV format example
	csvData := "25.6,65.2,1013.25,OK"
	fmt.Printf("CSV Format:\n%s\n\n", csvData)
}

func demonstrateJSONPath() {
	fmt.Println("Demonstrating JSONPath extraction...")

	complexJSON := `{
  "payload": {
    "sensors": [
      {
        "id": "temp_01",
        "readings": {
          "temperature": 25.6,
          "humidity": 65.2
        }
      },
      {
        "id": "pressure_01", 
        "readings": {
          "pressure": 1013.25,
          "altitude": 120.5
        }
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-01T12:00:00Z",
    "source": "factory_controller"
  }
}`

	fmt.Printf("Complex JSON structure:\n%s\n\n", complexJSON)

	fmt.Println("JSONPath examples:")
	fmt.Println("$.payload.sensors[0].readings.temperature -> Extract first sensor temperature")
	fmt.Println("$.payload.sensors[1].readings.pressure -> Extract second sensor pressure")
	fmt.Println("$.metadata.timestamp -> Extract timestamp")
	fmt.Println("$.metadata.source -> Extract data source")
}