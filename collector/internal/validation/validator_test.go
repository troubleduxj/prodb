package validation

import (
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestDataValidator_ValidateDataValue(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	config := &ValidatorConfig{
		EnableRangeValidation:   true,
		EnableFormatValidation:  true,
		EnableQualityAssessment: true,
		EnableTransformation:    true,
		MaxValidationErrors:     10,
		QualityThreshold:        0.8,
		AnomalyDetectionEnabled: true,
		AnomalyThreshold:        3.0,
	}

	validator := NewDataValidator(loggerInstance, config)

	tests := []struct {
		name            string
		dataValue       protocol.DataValue
		expectedValid   bool
		expectedQuality int
	}{
		{
			name: "Valid float value",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     25.5,
				Quality:   1,
				DataType:  "float64",
				Unit:      "°C",
				Tags:      map[string]string{"location": "room1"},
			},
			expectedValid:   true,
			expectedQuality: 1,
		},
		{
			name: "Null value",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     nil,
				Quality:   1,
				DataType:  "float64",
				Unit:      "°C",
				Tags:      map[string]string{"location": "room1"},
			},
			expectedValid:   false,
			expectedQuality: 0,
		},
		{
			name: "Empty string value",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "status",
				Timestamp: time.Now(),
				Value:     "",
				Quality:   1,
				DataType:  "string",
				Unit:      "",
				Tags:      map[string]string{"location": "room1"},
			},
			expectedValid:   false,
			expectedQuality: 0,
		},
		{
			name: "Valid boolean conversion",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "enabled",
				Timestamp: time.Now(),
				Value:     "true",
				Quality:   1,
				DataType:  "bool",
				Unit:      "",
				Tags:      map[string]string{"location": "room1"},
			},
			expectedValid:   true,
			expectedQuality: 1,
		},
		{
			name: "Invalid boolean conversion",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "enabled",
				Timestamp: time.Now(),
				Value:     "maybe",
				Quality:   1,
				DataType:  "bool",
				Unit:      "",
				Tags:      map[string]string{"location": "room1"},
			},
			expectedValid:   false,
			expectedQuality: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.ValidateDataValue(&tt.dataValue)

			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}

			if result.Quality != tt.expectedQuality {
				t.Errorf("Expected Quality=%d, got %d", tt.expectedQuality, result.Quality)
			}
		})
	}
}

func TestRangeRule_Validate(t *testing.T) {
	rule := NewRangeRule(0, 100)
	context := ValidationContext{
		DataType:  "float64",
		PointName: "temperature",
	}

	tests := []struct {
		name          string
		value         interface{}
		expectedValid bool
	}{
		{"Valid value in range", 50.0, true},
		{"Value at lower bound", 0.0, true},
		{"Value at upper bound", 100.0, true},
		{"Value below range", -10.0, false},
		{"Value above range", 150.0, false},
		{"Non-numeric value", "not a number", true}, // Should pass with warning
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestStringFormatRule_Validate(t *testing.T) {
	rule := NewStringFormatRule()
	context := ValidationContext{
		DataType:  "string",
		PointName: "message",
	}

	tests := []struct {
		name          string
		value         interface{}
		expectedValid bool
	}{
		{"Valid string", "Hello World", true},
		{"Empty string", "", true}, // Empty strings are handled by NullValueRule
		{"Very long string", string(make([]byte, 2000)), false},
		{"Non-string value", 123, true}, // Should skip validation
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestBooleanRule_Validate(t *testing.T) {
	rule := NewBooleanRule()
	context := ValidationContext{
		DataType:  "bool",
		PointName: "enabled",
	}

	tests := []struct {
		name                string
		value               interface{}
		expectedValid       bool
		expectedTransformed interface{}
	}{
		{"Boolean true", true, true, nil},
		{"Boolean false", false, true, nil},
		{"String true", "true", true, true},
		{"String false", "false", true, false},
		{"String yes", "yes", true, true},
		{"String no", "no", true, false},
		{"String 1", "1", true, true},
		{"String 0", "0", true, false},
		{"Integer 1", 1, true, true},
		{"Integer 0", 0, true, false},
		{"Float 1.0", 1.0, true, true},
		{"Float 0.0", 0.0, true, false},
		{"Invalid string", "maybe", false, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Validate(tt.value, context)

			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}

			if tt.expectedTransformed != nil && result.Transformed != tt.expectedTransformed {
				t.Errorf("Expected Transformed=%v, got %v", tt.expectedTransformed, result.Transformed)
			}
		})
	}
}

func TestAnomalyDetectionRule_Validate(t *testing.T) {
	rule := NewAnomalyDetectionRule(3.0, 10)
	context := ValidationContext{
		DataType:  "float64",
		PointName: "temperature",
	}

	// Add some normal values to build history
	normalValues := []float64{20.0, 21.0, 19.5, 20.5, 22.0, 19.0, 21.5, 20.2, 19.8, 20.8}
	for _, val := range normalValues {
		rule.Validate(val, context)
	}

	tests := []struct {
		name            string
		value           interface{}
		expectedWarning bool
	}{
		{"Normal value", 20.5, false},
		{"Slight outlier", 25.0, true}, // Will trigger with the dataset we have
		{"Clear outlier", 50.0, true},  // Should trigger anomaly detection
		{"Negative outlier", -10.0, true},
		{"Non-numeric value", "not a number", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Validate(tt.value, context)

			hasAnomalyWarning := false
			for _, warning := range result.Warnings {
				if warning.Type == "anomaly_detected" {
					hasAnomalyWarning = true
					break
				}
			}

			if hasAnomalyWarning != tt.expectedWarning {
				t.Errorf("Expected anomaly warning=%v, got %v", tt.expectedWarning, hasAnomalyWarning)
			}
		})
	}
}

func TestDataValidator_AddRemoveRule(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	validator := NewDataValidator(loggerInstance, nil)

	// Test adding a rule
	customRule := NewRangeRule(10, 90)
	validator.AddRule("temperature", customRule)

	// Test that the rule is applied
	dataValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "temp1",
		Timestamp: time.Now(),
		Value:     95.0, // Outside range
		Quality:   1,
		DataType:  "temperature",
		Unit:      "°C",
	}

	result := validator.ValidateDataValue(&dataValue)
	if result.IsValid {
		t.Error("Expected validation to fail for out-of-range value")
	}

	// Test removing the rule
	validator.RemoveRule("temperature", customRule.GetName())

	// Test that the rule is no longer applied
	result = validator.ValidateDataValue(&dataValue)
	// Should still fail due to default rules, but not due to our custom range rule
}

func TestDataValidator_Metrics(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	validator := NewDataValidator(loggerInstance, nil)

	// Process some data values
	dataValues := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temp1",
			Timestamp: time.Now(),
			Value:     25.0,
			Quality:   1,
			DataType:  "float64",
			Unit:      "°C",
		},
		{
			DeviceID:  "device1",
			PointName: "temp2",
			Timestamp: time.Now(),
			Value:     nil, // Invalid
			Quality:   1,
			DataType:  "float64",
			Unit:      "°C",
		},
	}

	for _, dv := range dataValues {
		validator.ValidateDataValue(&dv)
	}

	metrics := validator.GetMetrics()

	if metrics.TotalValidations != 2 {
		t.Errorf("Expected TotalValidations=2, got %d", metrics.TotalValidations)
	}

	if metrics.ValidData != 1 {
		t.Errorf("Expected ValidData=1, got %d", metrics.ValidData)
	}

	if metrics.InvalidData != 1 {
		t.Errorf("Expected InvalidData=1, got %d", metrics.InvalidData)
	}

	// Test metrics reset
	validator.ResetMetrics()
	metrics = validator.GetMetrics()

	if metrics.TotalValidations != 0 {
		t.Errorf("Expected TotalValidations=0 after reset, got %d", metrics.TotalValidations)
	}
}

func BenchmarkDataValidator_ValidateDataValue(b *testing.B) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	validator := NewDataValidator(loggerInstance, nil)

	dataValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "temperature",
		Timestamp: time.Now(),
		Value:     25.5,
		Quality:   1,
		DataType:  "float64",
		Unit:      "°C",
		Tags:      map[string]string{"location": "room1"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		validator.ValidateDataValue(&dataValue)
	}
}

func BenchmarkDataValidator_ValidateDataBatch(b *testing.B) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "error",
		Format: "text",
		Output: "stdout",
	})
	validator := NewDataValidator(loggerInstance, nil)

	// Create a batch of data values
	dataValues := make([]protocol.DataValue, 100)
	for i := range dataValues {
		dataValues[i] = protocol.DataValue{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.5 + float64(i)*0.1,
			Quality:   1,
			DataType:  "float64",
			Unit:      "°C",
			Tags:      map[string]string{"location": "room1"},
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		validator.ValidateDataBatch(dataValues)
	}
}
