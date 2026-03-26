package mqtt

import (
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestMQTTProtocol_Minimal(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test MQTT Protocol creation
	protocol := NewMQTTProtocol(logger)
	if protocol == nil {
		t.Fatal("Failed to create MQTT protocol")
	}

	// Test protocol name
	if protocol.GetName() != "mqtt" {
		t.Errorf("Expected protocol name 'mqtt', got '%s'", protocol.GetName())
	}

	// Test initial connection status
	if protocol.IsConnected() {
		t.Error("Protocol should not be connected initially")
	}

	// Test configuration validation
	t.Run("ValidateConfig", func(t *testing.T) {
		// Valid configuration
		validConfig := map[string]interface{}{
			"broker": "localhost",
			"port":   float64(1883),
			"topics": []interface{}{
				map[string]interface{}{
					"topic":       "test/topic",
					"qos":         float64(1),
					"data_format": "json",
				},
			},
		}

		if err := protocol.Validate(validConfig); err != nil {
			t.Errorf("Valid configuration should pass validation: %v", err)
		}

		// Invalid configuration - missing broker
		invalidConfig := map[string]interface{}{
			"port": float64(1883),
		}

		if err := protocol.Validate(invalidConfig); err == nil {
			t.Error("Invalid configuration should fail validation")
		}

		// Invalid configuration - invalid port
		invalidPortConfig := map[string]interface{}{
			"broker": "localhost",
			"port":   float64(70000),
		}

		if err := protocol.Validate(invalidPortConfig); err == nil {
			t.Error("Invalid port configuration should fail validation")
		}
	})

	// Test disconnect when not connected
	if err := protocol.Disconnect(); err != nil {
		t.Errorf("Disconnect should not error when not connected: %v", err)
	}
}

func TestMQTTProtocol_ConfigValidation(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error", // Reduce logging for tests
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewMQTTProtocol(logger)

	tests := []struct {
		name        string
		config      map[string]interface{}
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid basic config",
			config: map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
			},
			expectError: false,
		},
		{
			name: "missing broker",
			config: map[string]interface{}{
				"port": float64(1883),
			},
			expectError: true,
		},
		{
			name: "missing port",
			config: map[string]interface{}{
				"broker": "localhost",
			},
			expectError: true,
		},
		{
			name: "invalid port range",
			config: map[string]interface{}{
				"broker": "localhost",
				"port":   float64(70000),
			},
			expectError: true,
		},
		{
			name: "valid with topics",
			config: map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic":       "sensors/temperature",
						"qos":         float64(1),
						"data_format": "json",
					},
				},
			},
			expectError: false,
		},
		{
			name: "invalid QoS in topics",
			config: map[string]interface{}{
				"broker": "localhost",
				"port":   float64(1883),
				"topics": []interface{}{
					map[string]interface{}{
						"topic": "test/topic",
						"qos":   float64(3), // Invalid QoS
					},
				},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := protocol.Validate(tt.config)

			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

// Benchmark test for protocol creation
func BenchmarkMQTTProtocol_Creation(b *testing.B) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		b.Fatalf("Failed to create logger: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		protocol := NewMQTTProtocol(logger)
		if protocol == nil {
			b.Fatal("Failed to create protocol")
		}
	}
}

// Benchmark test for configuration validation
func BenchmarkMQTTProtocol_Validation(b *testing.B) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		b.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewMQTTProtocol(logger)
	config := map[string]interface{}{
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

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := protocol.Validate(config); err != nil {
			b.Fatalf("Validation failed: %v", err)
		}
	}
}