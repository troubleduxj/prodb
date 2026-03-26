package validation

import (
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestDataTransformer_TransformDataValue(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	transformer := NewDataTransformer(loggerInstance)

	tests := []struct {
		name                 string
		dataValue            protocol.DataValue
		transformationKey    string
		transformationConfig TransformationConfig
		expectedSuccess      bool
		expectedValue        interface{}
	}{
		{
			name: "Scale and offset transformation",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     25.0,
				DataType:  "float64",
				Unit:      "°C",
			},
			transformationKey: "device1_temperature",
			transformationConfig: TransformationConfig{
				ScaleFactor: 1.8,
				Offset:      32,
				Precision:   2,
			},
			expectedSuccess: true,
			expectedValue:   77.0, // (25 * 1.8) + 32
		},
		{
			name: "Unit conversion",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "pressure",
				Timestamp: time.Now(),
				Value:     1.0,
				DataType:  "float64",
				Unit:      "bar",
			},
			transformationKey: "device1_pressure",
			transformationConfig: TransformationConfig{
				UnitConversion: &UnitConversionConfig{
					SourceUnit: "bar",
					TargetUnit: "psi",
					Factor:     14.5038,
					Offset:     0,
				},
				Precision: 2,
			},
			expectedSuccess: true,
			expectedValue:   14.5,
		},
		{
			name: "Value mapping transformation",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "status",
				Timestamp: time.Now(),
				Value:     "1",
				DataType:  "string",
			},
			transformationKey: "device1_status",
			transformationConfig: TransformationConfig{
				ValueMapping: map[string]interface{}{
					"1": "ON",
					"0": "OFF",
				},
			},
			expectedSuccess: true,
			expectedValue:   "ON",
		},
		{
			name: "Data type conversion",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "count",
				Timestamp: time.Now(),
				Value:     "123",
				DataType:  "string",
			},
			transformationKey: "device1_count",
			transformationConfig: TransformationConfig{
				SourceDataType: "string",
				TargetDataType: "int32",
			},
			expectedSuccess: true,
			expectedValue:   int32(123),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Add transformation configuration
			transformer.AddTransformation(tt.transformationKey, tt.transformationConfig)

			result := transformer.TransformDataValue(&tt.dataValue)

			if result.Success != tt.expectedSuccess {
				t.Errorf("Expected Success=%v, got %v", tt.expectedSuccess, result.Success)
			}

			if tt.expectedSuccess && result.TransformedData != tt.expectedValue {
				t.Errorf("Expected TransformedData=%v, got %v", tt.expectedValue, result.TransformedData)
			}

			// Clean up
			transformer.RemoveTransformation(tt.transformationKey)
		})
	}
}

func TestUnitConverter_Convert(t *testing.T) {
	converter := NewUnitConverter()

	tests := []struct {
		name           string
		value          interface{}
		config         *UnitConversionConfig
		expectedResult float64
		expectError    bool
	}{
		{
			name:  "Celsius to Fahrenheit",
			value: 25.0,
			config: &UnitConversionConfig{
				SourceUnit: "°C",
				TargetUnit: "°F",
				Factor:     1.8,
				Offset:     32,
			},
			expectedResult: 77.0,
			expectError:    false,
		},
		{
			name:  "Bar to PSI",
			value: 2.0,
			config: &UnitConversionConfig{
				SourceUnit: "bar",
				TargetUnit: "psi",
				Factor:     14.5038,
				Offset:     0,
			},
			expectedResult: 29.0076,
			expectError:    false,
		},
		{
			name:  "Non-numeric value",
			value: "not a number",
			config: &UnitConversionConfig{
				SourceUnit: "°C",
				TargetUnit: "°F",
				Factor:     1.8,
				Offset:     32,
			},
			expectedResult: 0,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := converter.Convert(tt.value, tt.config)

			if tt.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if resultFloat, ok := result.(float64); ok {
				if abs(resultFloat-tt.expectedResult) > 0.01 {
					t.Errorf("Expected result=%.2f, got %.2f", tt.expectedResult, resultFloat)
				}
			} else {
				t.Errorf("Expected float64 result, got %T", result)
			}
		})
	}
}

func TestDataTransformer_AddRemoveTransformation(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	transformer := NewDataTransformer(loggerInstance)

	config := TransformationConfig{
		ScaleFactor: 2.0,
		Offset:      10.0,
	}

	// Test adding transformation
	transformer.AddTransformation("test_key", config)

	dataValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "test",
		Value:     5.0,
		DataType:  "float64",
	}

	// Should not apply transformation since key doesn't match
	result := transformer.TransformDataValue(&dataValue)
	if result.TransformedData != 5.0 {
		t.Errorf("Expected no transformation, but got %v", result.TransformedData)
	}

	// Test removing transformation
	transformer.RemoveTransformation("test_key")

	// Should still not apply transformation
	result = transformer.TransformDataValue(&dataValue)
	if result.TransformedData != 5.0 {
		t.Errorf("Expected no transformation after removal, but got %v", result.TransformedData)
	}
}

// Helper function for floating point comparison
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
