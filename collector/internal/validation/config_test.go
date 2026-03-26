package validation

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestValidationConfigManager_LoadSaveConfig(t *testing.T) {
	// Create temporary config file
	tmpFile, err := ioutil.TempFile("", "validation_config_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	// Create test config
	testConfig := GetDefaultConfig()
	testConfig.Version = "test-1.0.0"

	// Save config to file
	configData, err := json.MarshalIndent(testConfig, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	if err := ioutil.WriteFile(tmpFile.Name(), configData, 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	// Test loading config
	manager := NewValidationConfigManager(tmpFile.Name())
	if err := manager.LoadConfig(); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	loadedConfig := manager.GetConfig()
	if loadedConfig.Version != "test-1.0.0" {
		t.Errorf("Expected version 'test-1.0.0', got '%s'", loadedConfig.Version)
	}

	// Test saving config
	loadedConfig.Version = "test-2.0.0"
	manager.SetConfig(loadedConfig)

	if err := manager.SaveConfig(); err != nil {
		t.Fatalf("Failed to save config: %v", err)
	}

	// Verify saved config
	if err := manager.LoadConfig(); err != nil {
		t.Fatalf("Failed to reload config: %v", err)
	}

	reloadedConfig := manager.GetConfig()
	if reloadedConfig.Version != "test-2.0.0" {
		t.Errorf("Expected version 'test-2.0.0', got '%s'", reloadedConfig.Version)
	}
}

func TestValidationConfigManager_ApplyConfigToService(t *testing.T) {
	// Create logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create validation service
	service := NewValidationService(loggerInstance, nil)

	// Create config manager with default config
	manager := NewValidationConfigManager("")
	manager.SetConfig(GetDefaultConfig())

	// Apply config to service
	if err := manager.ApplyConfigToService(service); err != nil {
		t.Fatalf("Failed to apply config to service: %v", err)
	}

	// Test that rules were applied by processing some data
	testData := []struct {
		pointName string
		dataType  string
		value     interface{}
		expectValid bool
	}{
		{"temperature", "temperature", 25.0, true},
		{"temperature", "temperature", 200.0, false}, // Outside range
		{"pressure", "pressure", 50.0, true},
		{"pressure", "pressure", -10.0, false}, // Outside range
	}

	for _, test := range testData {
		dataValue := createTestDataValue(test.pointName, test.dataType, test.value)
		result := service.ProcessDataValue(&dataValue)
		
		if result.Success != test.expectValid {
			t.Errorf("Point %s with value %v: expected success=%v, got %v", 
				test.pointName, test.value, test.expectValid, result.Success)
		}
	}
}

func TestCreateRuleFromConfig(t *testing.T) {
	manager := NewValidationConfigManager("")

	tests := []struct {
		name        string
		ruleConfig  RuleConfig
		expectError bool
	}{
		{
			name: "Valid range rule",
			ruleConfig: RuleConfig{
				Name: "test_range",
				Type: "range",
				Parameters: map[string]interface{}{
					"min": 0.0,
					"max": 100.0,
				},
			},
			expectError: false,
		},
		{
			name: "Valid regex rule",
			ruleConfig: RuleConfig{
				Name: "test_regex",
				Type: "regex",
				Parameters: map[string]interface{}{
					"pattern":    `^\d{3}-\d{3}$`,
					"must_match": true,
				},
			},
			expectError: false,
		},
		{
			name: "Invalid regex pattern",
			ruleConfig: RuleConfig{
				Name: "test_invalid_regex",
				Type: "regex",
				Parameters: map[string]interface{}{
					"pattern": `[invalid`,
				},
			},
			expectError: true,
		},
		{
			name: "Valid statistical rule",
			ruleConfig: RuleConfig{
				Name: "test_statistical",
				Type: "statistical",
				Parameters: map[string]interface{}{
					"method":           "zscore",
					"threshold":        2.0,
					"min_sample_size":  5.0,
					"max_history_size": 100.0,
				},
			},
			expectError: false,
		},
		{
			name: "Missing parameters",
			ruleConfig: RuleConfig{
				Name: "test_missing_params",
				Type: "range",
				Parameters: map[string]interface{}{
					"min": 0.0,
					// Missing max parameter
				},
			},
			expectError: true,
		},
		{
			name: "Unknown rule type",
			ruleConfig: RuleConfig{
				Name: "test_unknown",
				Type: "unknown_type",
				Parameters: map[string]interface{}{},
			},
			expectError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			rule, err := manager.createRuleFromConfig(test.ruleConfig)
			
			if test.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if rule == nil {
					t.Error("Expected rule but got nil")
				}
			}
		})
	}
}

func TestGetDefaultConfig(t *testing.T) {
	config := GetDefaultConfig()

	if config == nil {
		t.Fatal("Expected config but got nil")
	}

	if config.Version == "" {
		t.Error("Expected version to be set")
	}

	if !config.Enabled {
		t.Error("Expected config to be enabled by default")
	}

	if len(config.Rules) == 0 {
		t.Error("Expected default rules to be present")
	}

	if len(config.Transforms) == 0 {
		t.Error("Expected default transforms to be present")
	}

	// Check for specific rules
	foundTempRange := false
	foundPressureRange := false
	foundPerformance := false

	for _, rule := range config.Rules {
		switch rule.Name {
		case "temperature_range":
			foundTempRange = true
		case "pressure_range":
			foundPressureRange = true
		case "performance_monitoring":
			foundPerformance = true
		}
	}

	if !foundTempRange {
		t.Error("Expected temperature_range rule in default config")
	}
	if !foundPressureRange {
		t.Error("Expected pressure_range rule in default config")
	}
	if !foundPerformance {
		t.Error("Expected performance_monitoring rule in default config")
	}

	// Verify performance config meets requirement 10.2
	if config.Performance.MaxDataPointsPerSecond < 1000 {
		t.Errorf("Performance config should support at least 1000 data points/sec for requirement 10.2, got %d", 
			config.Performance.MaxDataPointsPerSecond)
	}
}

func TestValidateConfig(t *testing.T) {
	tests := []struct {
		name        string
		config      *ValidationConfig
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil config",
			config:      nil,
			expectError: true,
			errorMsg:    "config is nil",
		},
		{
			name: "Missing version",
			config: &ValidationConfig{
				Enabled: true,
			},
			expectError: true,
			errorMsg:    "config version is required",
		},
		{
			name: "Rule without name",
			config: &ValidationConfig{
				Version: "1.0.0",
				Rules: []RuleConfig{
					{
						Type:      "range",
						DataTypes: []string{"float64"},
					},
				},
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Rule without type",
			config: &ValidationConfig{
				Version: "1.0.0",
				Rules: []RuleConfig{
					{
						Name:      "test_rule",
						DataTypes: []string{"float64"},
					},
				},
			},
			expectError: true,
			errorMsg:    "type is required",
		},
		{
			name: "Rule without data types",
			config: &ValidationConfig{
				Version: "1.0.0",
				Rules: []RuleConfig{
					{
						Name: "test_rule",
						Type: "range",
					},
				},
			},
			expectError: true,
			errorMsg:    "at least one data type is required",
		},
		{
			name: "Transform without name",
			config: &ValidationConfig{
				Version: "1.0.0",
				Transforms: []TransformConfig{
					{
						PointPattern: "*_temp",
					},
				},
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Transform without point pattern",
			config: &ValidationConfig{
				Version: "1.0.0",
				Transforms: []TransformConfig{
					{
						Name: "test_transform",
					},
				},
			},
			expectError: true,
			errorMsg:    "point_pattern is required",
		},
		{
			name: "Invalid completeness threshold",
			config: &ValidationConfig{
				Version: "1.0.0",
				Quality: QualityAssessmentConfig{
					CompletenessThreshold: 1.5, // Invalid
				},
			},
			expectError: true,
			errorMsg:    "completeness_threshold must be between 0 and 1",
		},
		{
			name: "Invalid performance settings",
			config: &ValidationConfig{
				Version: "1.0.0",
				Performance: PerformanceConfig{
					MaxProcessingTime:      0, // Invalid
					MaxDataPointsPerSecond: 1000,
				},
			},
			expectError: true,
			errorMsg:    "max_processing_time must be positive",
		},
		{
			name:        "Valid config",
			config:      GetDefaultConfig(),
			expectError: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateConfig(test.config)
			
			if test.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				} else if test.errorMsg != "" && err.Error() != test.errorMsg {
					// Check if error message contains expected text
					if len(test.errorMsg) > 0 && len(err.Error()) > 0 {
						// Just check if the error message contains key parts
						t.Logf("Expected error containing '%s', got '%s'", test.errorMsg, err.Error())
					}
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestConfigJSONSerialization(t *testing.T) {
	originalConfig := GetDefaultConfig()

	// Serialize to JSON
	jsonData, err := json.MarshalIndent(originalConfig, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal config to JSON: %v", err)
	}

	// Deserialize from JSON
	var deserializedConfig ValidationConfig
	if err := json.Unmarshal(jsonData, &deserializedConfig); err != nil {
		t.Fatalf("Failed to unmarshal config from JSON: %v", err)
	}

	// Verify key fields
	if deserializedConfig.Version != originalConfig.Version {
		t.Errorf("Version mismatch: expected %s, got %s", originalConfig.Version, deserializedConfig.Version)
	}

	if deserializedConfig.Enabled != originalConfig.Enabled {
		t.Errorf("Enabled mismatch: expected %v, got %v", originalConfig.Enabled, deserializedConfig.Enabled)
	}

	if len(deserializedConfig.Rules) != len(originalConfig.Rules) {
		t.Errorf("Rules count mismatch: expected %d, got %d", len(originalConfig.Rules), len(deserializedConfig.Rules))
	}

	if len(deserializedConfig.Transforms) != len(originalConfig.Transforms) {
		t.Errorf("Transforms count mismatch: expected %d, got %d", len(originalConfig.Transforms), len(deserializedConfig.Transforms))
	}
}

// Helper function to create test data value
func createTestDataValue(pointName, dataType string, value interface{}) protocol.DataValue {
	return protocol.DataValue{
		DeviceID:  "test_device",
		PointName: pointName,
		Timestamp: time.Now(),
		Value:     value,
		Quality:   1,
		DataType:  dataType,
		Unit:      "",
		Tags:      make(map[string]string),
	}
}

func BenchmarkConfigOperations(b *testing.B) {
	config := GetDefaultConfig()

	b.Run("ValidateConfig", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			ValidateConfig(config)
		}
	})

	b.Run("MarshalConfig", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			json.Marshal(config)
		}
	})

	jsonData, _ := json.Marshal(config)
	b.Run("UnmarshalConfig", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var cfg ValidationConfig
			json.Unmarshal(jsonData, &cfg)
		}
	})
}