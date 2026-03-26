package validation

import (
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestValidationService_ProcessDataValue(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	serviceConfig := &ValidationServiceConfig{
		EnableValidation:        true,
		EnableTransformation:    true,
		EnableQualityAssessment: true,
		BatchSize:               100,
		MaxConcurrency:          5,
		TimeoutSeconds:          30,
		RetryAttempts:           3,
	}

	service := NewValidationService(loggerInstance, serviceConfig)

	tests := []struct {
		name            string
		dataValue       protocol.DataValue
		expectedSuccess bool
	}{
		{
			name: "Valid data value",
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
			expectedSuccess: true,
		},
		{
			name: "Invalid data value (null)",
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
			expectedSuccess: false,
		},
		{
			name: "Boolean conversion",
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
			expectedSuccess: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.ProcessDataValue(&tt.dataValue)

			if result.Success != tt.expectedSuccess {
				t.Errorf("Expected Success=%v, got %v", tt.expectedSuccess, result.Success)
			}

			if result.ProcessedData == nil {
				t.Error("Expected ProcessedData to be non-nil")
			}

			if result.ProcessingTime < 0 {
				t.Error("Expected ProcessingTime to be non-negative")
			}

			// Check that all components were invoked
			if serviceConfig.EnableValidation && result.ValidationResult == nil {
				t.Error("Expected ValidationResult to be non-nil when validation is enabled")
			}

			if serviceConfig.EnableTransformation && result.Success && result.TransformationResult == nil {
				t.Error("Expected TransformationResult to be non-nil when transformation is enabled and successful")
			}

			if serviceConfig.EnableQualityAssessment && result.QualityResult == nil {
				t.Error("Expected QualityResult to be non-nil when quality assessment is enabled")
			}
		})
	}
}

func TestValidationService_ProcessDataBatch(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	// Create a batch of data values
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
		{
			DeviceID:  "device1",
			PointName: "enabled",
			Timestamp: time.Now(),
			Value:     "true",
			Quality:   1,
			DataType:  "bool",
			Unit:      "",
		},
	}

	results := service.ProcessDataBatch(dataValues)

	if len(results) != len(dataValues) {
		t.Errorf("Expected %d results, got %d", len(dataValues), len(results))
	}

	// Check individual results
	if !results[0].Success {
		t.Error("Expected first result to be successful")
	}

	if results[1].Success {
		t.Error("Expected second result to fail (null value)")
	}

	if !results[2].Success {
		t.Error("Expected third result to be successful (boolean conversion)")
	}
}

func TestValidationService_EnableDisable(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	// Test initial state
	if !service.IsEnabled() {
		t.Error("Expected service to be enabled by default")
	}

	// Test disable
	service.Disable()
	if service.IsEnabled() {
		t.Error("Expected service to be disabled")
	}

	// Test that processing still works but doesn't apply validation
	dataValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "temperature",
		Timestamp: time.Now(),
		Value:     nil, // This would normally fail validation
		Quality:   1,
		DataType:  "float64",
		Unit:      "°C",
	}

	result := service.ProcessDataValue(&dataValue)
	if !result.Success {
		t.Error("Expected processing to succeed when service is disabled")
	}

	// Test enable
	service.Enable()
	if !service.IsEnabled() {
		t.Error("Expected service to be enabled")
	}

	// Now validation should work again
	result = service.ProcessDataValue(&dataValue)
	if result.Success {
		t.Error("Expected processing to fail when service is enabled (null value)")
	}
}

func TestValidationService_AddRemoveRules(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	// Test adding validation rule
	customRule := NewRangeRule(10, 90)
	err := service.AddValidationRule("temperature", customRule)
	if err != nil {
		t.Errorf("Unexpected error adding validation rule: %v", err)
	}

	// Test data that should fail the custom rule
	dataValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "temp1",
		Timestamp: time.Now(),
		Value:     95.0, // Outside range
		Quality:   1,
		DataType:  "temperature",
		Unit:      "°C",
	}

	result := service.ProcessDataValue(&dataValue)
	if result.Success {
		t.Error("Expected validation to fail for out-of-range value")
	}

	// Test removing validation rule
	err = service.RemoveValidationRule("temperature", customRule.GetName())
	if err != nil {
		t.Errorf("Unexpected error removing validation rule: %v", err)
	}

	// Test adding transformation
	transformConfig := TransformationConfig{
		ScaleFactor: 2.0,
		Offset:      10.0,
	}
	err = service.AddTransformation("test_transform", transformConfig)
	if err != nil {
		t.Errorf("Unexpected error adding transformation: %v", err)
	}

	// Test removing transformation
	err = service.RemoveTransformation("test_transform")
	if err != nil {
		t.Errorf("Unexpected error removing transformation: %v", err)
	}
}

func TestValidationService_GetMetrics(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	// Process some data to generate metrics
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
		service.ProcessDataValue(&dv)
	}

	// Test service metrics
	metrics := service.GetMetrics()
	if metrics.TotalProcessed != 2 {
		t.Errorf("Expected TotalProcessed=2, got %d", metrics.TotalProcessed)
	}

	if metrics.ValidationErrors == 0 {
		t.Error("Expected some validation errors")
	}

	if metrics.AverageProcessingTime < 0 {
		t.Error("Expected non-negative average processing time")
	}

	// Test detailed metrics
	detailedMetrics := service.GetDetailedMetrics()
	if detailedMetrics["service"] == nil {
		t.Error("Expected service metrics in detailed metrics")
	}

	if detailedMetrics["validator"] == nil {
		t.Error("Expected validator metrics in detailed metrics")
	}

	if detailedMetrics["quality"] == nil {
		t.Error("Expected quality metrics in detailed metrics")
	}

	// Test metrics reset
	service.ResetMetrics()
	metrics = service.GetMetrics()
	if metrics.TotalProcessed != 0 {
		t.Errorf("Expected TotalProcessed=0 after reset, got %d", metrics.TotalProcessed)
	}
}

func TestValidationService_UpdateConfig(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	// Test updating config
	newConfig := &ValidationServiceConfig{
		EnableValidation:        false, // Disable validation
		EnableTransformation:    true,
		EnableQualityAssessment: true,
		BatchSize:               200,
		MaxConcurrency:          10,
		TimeoutSeconds:          60,
		RetryAttempts:           5,
	}

	err := service.UpdateConfig(newConfig)
	if err != nil {
		t.Errorf("Unexpected error updating config: %v", err)
	}

	// Test that config was applied
	config := service.GetConfig()
	if config.EnableValidation != false {
		t.Error("Expected validation to be disabled")
	}

	if config.BatchSize != 200 {
		t.Errorf("Expected BatchSize=200, got %d", config.BatchSize)
	}

	// Test nil config
	err = service.UpdateConfig(nil)
	if err == nil {
		t.Error("Expected error for nil config")
	}
}

func TestValidationService_HealthCheck(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	service := NewValidationService(loggerInstance, nil)

	health := service.HealthCheck()

	if health["enabled"] != true {
		t.Error("Expected service to be enabled in health check")
	}

	components, ok := health["components"].(map[string]bool)
	if !ok {
		t.Error("Expected components to be map[string]bool")
	} else {
		if !components["validator"] {
			t.Error("Expected validator component to be present")
		}
		if !components["transformer"] {
			t.Error("Expected transformer component to be present")
		}
		if !components["quality_assessment"] {
			t.Error("Expected quality_assessment component to be present")
		}
	}

	if health["metrics"] == nil {
		t.Error("Expected metrics in health check")
	}
}

func TestValidationService_ConcurrentProcessing(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "error", // Reduce log noise for concurrent test
		Format: "text",
		Output: "stdout",
	})

	serviceConfig := &ValidationServiceConfig{
		EnableValidation:        true,
		EnableTransformation:    true,
		EnableQualityAssessment: true,
		BatchSize:               10,
		MaxConcurrency:          3,
		TimeoutSeconds:          30,
		RetryAttempts:           3,
	}

	service := NewValidationService(loggerInstance, serviceConfig)

	// Create a large batch to test concurrent processing
	dataValues := make([]protocol.DataValue, 50)
	for i := range dataValues {
		dataValues[i] = protocol.DataValue{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.0 + float64(i)*0.1,
			Quality:   1,
			DataType:  "float64",
			Unit:      "°C",
		}
	}

	startTime := time.Now()
	results := service.ProcessDataBatch(dataValues)
	processingTime := time.Since(startTime)

	if len(results) != len(dataValues) {
		t.Errorf("Expected %d results, got %d", len(dataValues), len(results))
	}

	// All should be successful
	for i, result := range results {
		if !result.Success {
			t.Errorf("Expected result[%d] to be successful", i)
		}
	}

	// Processing should be reasonably fast with concurrency
	if processingTime > 5*time.Second {
		t.Errorf("Processing took too long: %v", processingTime)
	}

	t.Logf("Processed %d values in %v", len(dataValues), processingTime)
}
