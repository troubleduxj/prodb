package mqtt

import (
	"fmt"
	"strings"
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestMQTTProtocol_Integration(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test MQTT Protocol creation and basic functionality
	protocol := NewMQTTProtocol(logger)
	if protocol == nil {
		t.Fatal("Failed to create MQTT protocol")
	}

	// Test protocol interface compliance
	if protocol.GetName() != "mqtt" {
		t.Errorf("Expected protocol name 'mqtt', got '%s'", protocol.GetName())
	}

	// Test initial connection status
	if protocol.IsConnected() {
		t.Error("Protocol should not be connected initially")
	}

	// Test configuration validation with comprehensive config
	t.Run("ComprehensiveConfigValidation", func(t *testing.T) {
		config := map[string]interface{}{
			"broker":              "localhost",
			"port":                float64(1883),
			"client_id":           "test_client",
			"username":            "test_user",
			"password":            "test_pass",
			"keep_alive":          float64(60),
			"clean_session":       true,
			"auto_reconnect":      true,
			"connect_timeout":     float64(30),
			"write_timeout":       float64(30),
			"max_reconnect_delay": float64(300),
			"topics": []interface{}{
				map[string]interface{}{
					"topic":       "sensors/temperature",
					"qos":         float64(1),
					"data_format": "json",
					"device_id":   "temp_sensor_01",
					"point_name":  "temperature",
				},
				map[string]interface{}{
					"topic":       "sensors/+/humidity",
					"qos":         float64(2),
					"data_format": "json",
					"json_path":   "$.data.value",
				},
				map[string]interface{}{
					"topic":       "factory/#",
					"qos":         float64(0),
					"data_format": "raw",
				},
			},
		}

		if err := protocol.Validate(config); err != nil {
			t.Errorf("Comprehensive configuration should pass validation: %v", err)
		}
	})

	// Test TLS configuration validation
	t.Run("TLSConfigValidation", func(t *testing.T) {
		tlsConfig := map[string]interface{}{
			"broker":    "secure-mqtt.example.com",
			"port":      float64(8883),
			"client_id": "secure_client",
			"use_tls":   true,
			"cert_file": "/path/to/client.crt",
			"key_file":  "/path/to/client.key",
			"ca_file":   "/path/to/ca.crt",
			"topics": []interface{}{
				map[string]interface{}{
					"topic":       "secure/data",
					"qos":         float64(2),
					"data_format": "json",
				},
			},
		}

		if err := protocol.Validate(tlsConfig); err != nil {
			t.Errorf("TLS configuration should pass validation: %v", err)
		}
	})

	// Test data collection without connection (should return empty data)
	t.Run("CollectWithoutConnection", func(t *testing.T) {
		dataPoints := []config.DataPointConfig{
			{
				Name:     "temperature",
				Address:  "sensors/temperature",
				DataType: "float32",
				Unit:     "°C",
			},
		}

		data, err := protocol.Collect(dataPoints)
		if err == nil {
			t.Error("Collect should fail when not connected")
		}
		if len(data) != 0 {
			t.Error("Should return empty data when not connected")
		}
	})

	// Test disconnect when not connected
	t.Run("DisconnectWhenNotConnected", func(t *testing.T) {
		if err := protocol.Disconnect(); err != nil {
			t.Errorf("Disconnect should not error when not connected: %v", err)
		}
	})
}

func TestMQTTProtocol_DataFormatHandling(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error", // Reduce logging for tests
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewMQTTProtocol(logger)

	// Test different data format configurations
	testCases := []struct {
		name        string
		dataFormat  string
		expectError bool
	}{
		{"JSON format", "json", false},
		{"Raw format", "raw", false},
		{"CSV format", "csv", false},
		{"Invalid format", "xml", false}, // Should not error in validation, but might in parsing
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			config := map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic":       "test/topic",
						"qos":         float64(1),
						"data_format": tc.dataFormat,
					},
				},
			}

			err := protocol.Validate(config)
			if tc.expectError && err == nil {
				t.Error("Expected validation error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Unexpected validation error: %v", err)
			}
		})
	}
}

func TestMQTTProtocol_QoSLevels(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewMQTTProtocol(logger)

	// Test all valid QoS levels
	validQoSLevels := []float64{0, 1, 2}
	for _, qos := range validQoSLevels {
		t.Run(fmt.Sprintf("QoS_%v", qos), func(t *testing.T) {
			config := map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic": "test/topic",
						"qos":   qos,
					},
				},
			}

			if err := protocol.Validate(config); err != nil {
				t.Errorf("QoS %v should be valid: %v", qos, err)
			}
		})
	}

	// Test invalid QoS levels
	invalidQoSLevels := []float64{-1, 3, 4, 10}
	for _, qos := range invalidQoSLevels {
		t.Run(fmt.Sprintf("InvalidQoS_%v", qos), func(t *testing.T) {
			config := map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic": "test/topic",
						"qos":   qos,
					},
				},
			}

			if err := protocol.Validate(config); err == nil {
				t.Errorf("QoS %v should be invalid", qos)
			}
		})
	}
}

func TestMQTTProtocol_TopicWildcards(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewMQTTProtocol(logger)

	// Test various topic patterns including wildcards
	topicPatterns := []string{
		"sensors/temperature",   // Exact topic
		"sensors/+/temperature", // Single-level wildcard
		"sensors/+/+",           // Multiple single-level wildcards
		"factory/#",             // Multi-level wildcard
		"factory/floor1/#",      // Multi-level wildcard with prefix
		"sensors/+/data/#",      // Mixed wildcards
		"+/+/+",                 // All single-level wildcards
		"#",                     // Root multi-level wildcard
	}

	for _, topic := range topicPatterns {
		t.Run(fmt.Sprintf("Topic_%s", strings.ReplaceAll(topic, "/", "_")), func(t *testing.T) {
			config := map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic": topic,
						"qos":   float64(1),
					},
				},
			}

			if err := protocol.Validate(config); err != nil {
				t.Errorf("Topic pattern '%s' should be valid: %v", topic, err)
			}
		})
	}
}

// Additional benchmark tests can be added here if needed
// Note: Basic benchmark tests are already in mqtt_minimal_test.go
