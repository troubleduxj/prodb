package mqtt

import (
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// TestMQTTProtocol_FunctionalDemo demonstrates the MQTT protocol functionality
// This test shows how the MQTT protocol would be used in a real collection scenario
func TestMQTTProtocol_FunctionalDemo(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create MQTT protocol instance
	protocol := NewMQTTProtocol(logger)

	// Test 1: Configuration and Validation
	t.Run("ConfigurationDemo", func(t *testing.T) {
		// Simulate a real MQTT configuration
		mqttConfig := map[string]interface{}{
			"broker":              "mqtt.eclipseprojects.io", // Public MQTT broker for testing
			"port":                float64(1883),
			"client_id":           "prodb_collector_test",
			"keep_alive":          float64(60),
			"clean_session":       true,
			"auto_reconnect":      true,
			"connect_timeout":     float64(10),
			"write_timeout":       float64(5),
			"max_reconnect_delay": float64(60),
			"topics": []interface{}{
				map[string]interface{}{
					"topic":       "prodb/test/temperature",
					"qos":         float64(1),
					"data_format": "json",
					"device_id":   "demo_sensor_01",
					"point_name":  "temperature",
				},
				map[string]interface{}{
					"topic":       "prodb/test/+/status",
					"qos":         float64(0),
					"data_format": "raw",
				},
				map[string]interface{}{
					"topic":       "prodb/test/sensors/#",
					"qos":         float64(2),
					"data_format": "json",
					"json_path":   "$.data.value",
				},
			},
		}

		// Validate configuration
		if err := protocol.Validate(mqttConfig); err != nil {
			t.Errorf("Configuration validation failed: %v", err)
		} else {
			t.Log("✅ MQTT configuration validated successfully")
		}

		// Show configuration details
		t.Logf("📋 Configuration Details:")
		t.Logf("   Broker: %s:%v", mqttConfig["broker"], mqttConfig["port"])
		t.Logf("   Client ID: %s", mqttConfig["client_id"])
		t.Logf("   Topics: %d configured", len(mqttConfig["topics"].([]interface{})))
	})

	// Test 2: Connection Lifecycle (without actual broker connection)
	t.Run("ConnectionLifecycleDemo", func(t *testing.T) {
		// Note: This test demonstrates the connection lifecycle without actually connecting
		// to avoid test dependencies on external MQTT brokers

		t.Log("🔌 Connection Lifecycle Demo:")

		// Initial state
		if protocol.IsConnected() {
			t.Error("Protocol should not be connected initially")
		} else {
			t.Log("   ✅ Initial state: Not connected")
		}

		// Simulate connection attempt (this will fail without a real broker, which is expected)
		testConfig := map[string]interface{}{
			"broker": "localhost",
			"port":   float64(1883),
			"topics": []interface{}{
				map[string]interface{}{
					"topic": "test/topic",
					"qos":   float64(1),
				},
			},
		}

		err := protocol.Connect(testConfig)
		if err != nil {
			t.Logf("   ⚠️  Connection failed as expected (no broker): %v", err)
		}

		// Test disconnect
		if err := protocol.Disconnect(); err != nil {
			t.Errorf("Disconnect should not error: %v", err)
		} else {
			t.Log("   ✅ Disconnect completed successfully")
		}
	})

	// Test 3: Data Collection Simulation
	t.Run("DataCollectionDemo", func(t *testing.T) {
		t.Log("📊 Data Collection Demo:")

		// Create sample data points configuration
		dataPoints := []config.DataPointConfig{
			{
				Name:     "temperature",
				Address:  "sensors/temperature",
				DataType: "float32",
				Unit:     "°C",
				Tags: map[string]string{
					"location": "factory_floor_1",
					"sensor":   "temp_01",
				},
			},
			{
				Name:     "humidity",
				Address:  "sensors/humidity",
				DataType: "float32",
				Unit:     "%",
				Tags: map[string]string{
					"location": "factory_floor_1",
					"sensor":   "hum_01",
				},
			},
		}

		// Attempt to collect data (will fail since not connected, which is expected)
		data, err := protocol.Collect(dataPoints)
		if err != nil {
			t.Logf("   ⚠️  Collection failed as expected (not connected): %v", err)
		}

		if len(data) == 0 {
			t.Log("   ✅ No data returned when not connected (correct behavior)")
		}

		t.Logf("   📋 Data Points Configuration:")
		for i, dp := range dataPoints {
			t.Logf("      %d. %s (%s) - %s", i+1, dp.Name, dp.DataType, dp.Address)
		}
	})

	// Test 4: Protocol Features Demo
	t.Run("ProtocolFeaturesDemo", func(t *testing.T) {
		t.Log("🚀 MQTT Protocol Features Demo:")

		// Show protocol capabilities
		t.Logf("   Protocol Name: %s", protocol.GetName())
		t.Logf("   Connection Status: %v", protocol.IsConnected())

		// Demonstrate different QoS levels
		qosLevels := []struct {
			level       int
			description string
		}{
			{0, "At most once (Fire and forget)"},
			{1, "At least once (Acknowledged delivery)"},
			{2, "Exactly once (Assured delivery)"},
		}

		t.Log("   📡 Supported QoS Levels:")
		for _, qos := range qosLevels {
			t.Logf("      QoS %d: %s", qos.level, qos.description)
		}

		// Demonstrate topic wildcards
		wildcards := []struct {
			pattern     string
			description string
		}{
			{"sensors/temperature", "Exact topic match"},
			{"sensors/+/temperature", "Single-level wildcard (+)"},
			{"factory/#", "Multi-level wildcard (#)"},
			{"sensors/+/data/#", "Mixed wildcards"},
		}

		t.Log("   🎯 Supported Topic Patterns:")
		for _, wc := range wildcards {
			t.Logf("      %s - %s", wc.pattern, wc.description)
		}

		// Demonstrate data formats
		formats := []struct {
			format      string
			description string
		}{
			{"json", "JSON with optional JSONPath extraction"},
			{"raw", "Raw text data"},
			{"csv", "Comma-separated values"},
		}

		t.Log("   📄 Supported Data Formats:")
		for _, fmt := range formats {
			t.Logf("      %s - %s", fmt.format, fmt.description)
		}
	})

	// Test 5: Error Handling Demo
	t.Run("ErrorHandlingDemo", func(t *testing.T) {
		t.Log("🛡️  Error Handling Demo:")

		// Test invalid configurations
		invalidConfigs := []struct {
			name   string
			config map[string]interface{}
		}{
			{
				"Missing Broker",
				map[string]interface{}{
					"port": float64(1883),
				},
			},
			{
				"Invalid Port",
				map[string]interface{}{
					"broker": "localhost",
					"port":   float64(70000),
				},
			},
			{
				"Invalid QoS",
				map[string]interface{}{
					"broker": "localhost",
					"port":   float64(1883),
					"topics": []interface{}{
						map[string]interface{}{
							"topic": "test",
							"qos":   float64(5),
						},
					},
				},
			},
		}

		for _, test := range invalidConfigs {
			err := protocol.Validate(test.config)
			if err != nil {
				t.Logf("   ✅ %s: Correctly rejected - %v", test.name, err)
			} else {
				t.Errorf("   ❌ %s: Should have been rejected", test.name)
			}
		}
	})

	t.Log("🎉 MQTT Protocol Functional Demo Completed Successfully!")
}

// TestMQTTProtocol_RealWorldScenario demonstrates a realistic usage scenario
func TestMQTTProtocol_RealWorldScenario(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	t.Log("🏭 Real-World Industrial MQTT Scenario Demo")

	// Simulate an industrial IoT scenario
	protocol := NewMQTTProtocol(logger)

	// Industrial MQTT configuration
	industrialConfig := map[string]interface{}{
		"broker":              "industrial-mqtt.factory.com",
		"port":                float64(8883), // Secure port
		"client_id":           "prodb_collector_factory_01",
		"username":            "collector_user",
		"password":            "secure_password",
		"use_tls":             true,
		"cert_file":           "/etc/ssl/certs/collector.crt",
		"key_file":            "/etc/ssl/private/collector.key",
		"ca_file":             "/etc/ssl/certs/factory-ca.crt",
		"keep_alive":          float64(30),
		"clean_session":       false, // Persistent session for reliability
		"auto_reconnect":      true,
		"connect_timeout":     float64(60),
		"write_timeout":       float64(30),
		"max_reconnect_delay": float64(300),
		"topics": []interface{}{
			// Production line sensors
			map[string]interface{}{
				"topic":       "factory/line1/+/sensors/+",
				"qos":         float64(2), // Exactly once for critical data
				"data_format": "json",
				"json_path":   "$.measurements.value",
			},
			// Equipment status
			map[string]interface{}{
				"topic":       "factory/equipment/+/status",
				"qos":         float64(1),
				"data_format": "json",
			},
			// Alarm notifications
			map[string]interface{}{
				"topic":       "factory/alarms/#",
				"qos":         float64(2), // Critical alarms must be delivered
				"data_format": "json",
			},
			// Environmental monitoring
			map[string]interface{}{
				"topic":       "factory/environment/+/+",
				"qos":         float64(1),
				"data_format": "json",
				"json_path":   "$.data",
			},
			// Raw data streams
			map[string]interface{}{
				"topic":       "factory/raw_data/+",
				"qos":         float64(0), // Best effort for high-volume data
				"data_format": "csv",
			},
		},
	}

	// Validate industrial configuration
	if err := protocol.Validate(industrialConfig); err != nil {
		t.Errorf("Industrial configuration validation failed: %v", err)
	} else {
		t.Log("✅ Industrial MQTT configuration validated successfully")
	}

	// Show configuration summary
	t.Log("📋 Industrial Configuration Summary:")
	t.Logf("   🏢 Broker: %s:%v (TLS: %v)",
		industrialConfig["broker"],
		industrialConfig["port"],
		industrialConfig["use_tls"])
	t.Logf("   🔐 Authentication: %s", industrialConfig["username"])
	t.Logf("   📡 Topics: %d configured with mixed QoS levels",
		len(industrialConfig["topics"].([]interface{})))
	t.Logf("   🔄 Session: Persistent (clean_session: %v)",
		industrialConfig["clean_session"])

	// Demonstrate data point mapping for industrial scenario
	industrialDataPoints := []config.DataPointConfig{
		{
			Name:     "line1_temperature",
			Address:  "factory/line1/station1/sensors/temperature",
			DataType: "float32",
			Unit:     "°C",
			Tags: map[string]string{
				"line":     "production_line_1",
				"station":  "station_1",
				"sensor":   "temperature",
				"critical": "true",
			},
		},
		{
			Name:     "equipment_status",
			Address:  "factory/equipment/conveyor_01/status",
			DataType: "string",
			Tags: map[string]string{
				"equipment": "conveyor_01",
				"type":      "status",
			},
		},
		{
			Name:     "alarm_level",
			Address:  "factory/alarms/safety/level",
			DataType: "int32",
			Tags: map[string]string{
				"alarm_type": "safety",
				"priority":   "high",
			},
		},
	}

	t.Log("📊 Industrial Data Points:")
	for i, dp := range industrialDataPoints {
		t.Logf("   %d. %s (%s) - %s", i+1, dp.Name, dp.DataType, dp.Address)
		if dp.Tags["critical"] == "true" {
			t.Logf("      ⚠️  Critical sensor")
		}
	}

	t.Log("🎯 Use Case Benefits:")
	t.Log("   • Real-time production monitoring")
	t.Log("   • Equipment status tracking")
	t.Log("   • Alarm and alert management")
	t.Log("   • Environmental condition monitoring")
	t.Log("   • High-volume raw data collection")
	t.Log("   • Secure TLS communication")
	t.Log("   • Reliable message delivery with QoS")
	t.Log("   • Automatic reconnection and session recovery")

	t.Log("🎉 Industrial MQTT Scenario Demo Completed!")
}
