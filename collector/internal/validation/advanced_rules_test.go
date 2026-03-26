package validation

import (
	"testing"
	"time"
)

func TestDataIntegrityRule_Validate(t *testing.T) {
	rule := NewDataIntegrityRule("crc32")
	context := ValidationContext{
		DataType:  "string",
		PointName: "data",
	}

	tests := []struct {
		name          string
		value         interface{}
		expectedValid bool
	}{
		{"Valid string", "normal data", true},
		{"String with null bytes", "data\x00corrupted", false},
		{"String with invalid bytes", "data\xFFcorrupted", false},
		{"Normal numeric value", 123.45, true},
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

func TestProtocolSpecificRule_Modbus(t *testing.T) {
	rules := map[string]interface{}{
		"validate_ranges": true,
	}
	rule := NewProtocolSpecificRule("modbus", rules)
	
	tests := []struct {
		name          string
		value         interface{}
		dataType      string
		expectedValid bool
	}{
		{"Valid INT16", 1000.0, "int16", true},
		{"INT16 too high", 40000.0, "int16", false},
		{"INT16 too low", -40000.0, "int16", false},
		{"Valid UINT16", 30000.0, "uint16", true},
		{"UINT16 negative", -100.0, "uint16", false},
		{"UINT16 too high", 70000.0, "uint16", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := ValidationContext{
				DataType:  tt.dataType,
				PointName: "register",
			}
			result := rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestProtocolSpecificRule_OPCUA(t *testing.T) {
	rules := map[string]interface{}{
		"check_status": true,
	}
	rule := NewProtocolSpecificRule("opcua", rules)
	
	tests := []struct {
		name           string
		value          interface{}
		statusCode     string
		expectedQuality int
	}{
		{"Good status", 25.5, "Good", 1},
		{"Good status code 0", 25.5, "0", 1},
		{"Bad status", 25.5, "Bad", 2},
		{"Uncertain status", 25.5, "Uncertain", 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := ValidationContext{
				DataType:  "float64",
				PointName: "temperature",
				Tags:      map[string]string{"status_code": tt.statusCode},
			}
			result := rule.Validate(tt.value, context)
			if result.Quality != tt.expectedQuality {
				t.Errorf("Expected Quality=%d, got %d", tt.expectedQuality, result.Quality)
			}
		})
	}
}

func TestProtocolSpecificRule_MQTT(t *testing.T) {
	rules := map[string]interface{}{
		"validate_json": true,
	}
	rule := NewProtocolSpecificRule("mqtt", rules)
	
	tests := []struct {
		name          string
		value         interface{}
		expectedValid bool
	}{
		{"Valid JSON", `{"temperature": 25.5, "humidity": 60}`, true},
		{"Invalid JSON", `{"temperature": 25.5, "humidity":}`, false},
		{"Non-JSON string", "simple text", true},
		{"Numeric value", 123.45, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := ValidationContext{
				DataType:  "string",
				PointName: "payload",
			}
			result := rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestPerformanceRule_Validate(t *testing.T) {
	maxProcessingTime := 10 * time.Millisecond
	maxDataPointsPerSec := 100
	rule := NewPerformanceRule(maxProcessingTime, maxDataPointsPerSec)
	
	context := ValidationContext{
		DataType:  "float64",
		PointName: "temperature",
	}

	// Test normal performance
	result := rule.Validate(25.5, context)
	if result.Quality != 1 {
		t.Errorf("Expected Quality=1 for normal performance, got %d", result.Quality)
	}

	// Test metadata presence
	if result.Metadata["processing_time"] == nil {
		t.Error("Expected processing_time in metadata")
	}
	if result.Metadata["data_points_per_sec"] == nil {
		t.Error("Expected data_points_per_sec in metadata")
	}
}

func TestBusinessLogicRule_Validate(t *testing.T) {
	rules := []BusinessRule{
		{
			Name:      "temperature_range",
			Condition: "temperature_sensor_range",
			Action:    "reject",
			Message:   "Temperature outside sensor range",
			Params: map[string]interface{}{
				"range": map[string]interface{}{
					"min": -20.0,
					"max": 80.0,
				},
			},
		},
		{
			Name:      "device_status",
			Condition: "device_status_values",
			Action:    "reject",
			Message:   "Invalid device status",
			Params: map[string]interface{}{
				"valid_values": []interface{}{"RUNNING", "STOPPED", "MAINTENANCE"},
			},
		},
	}
	
	rule := NewBusinessLogicRule(rules)
	
	tests := []struct {
		name          string
		value         interface{}
		pointName     string
		expectedValid bool
	}{
		{"Valid temperature", 25.0, "temperature", true},
		{"Temperature too high", 100.0, "temperature", false},
		{"Temperature too low", -30.0, "temperature", false},
		{"Valid status", "RUNNING", "status", true},
		{"Invalid status", "UNKNOWN", "status", false},
		{"Other data point", 123.45, "pressure", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := ValidationContext{
				DataType:  "float64",
				PointName: tt.pointName,
			}
			if tt.pointName == "status" {
				context.DataType = "string"
			}
			
			result := rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestRegexRule_Validate(t *testing.T) {
	// Test must match pattern
	mustMatchRule, err := NewRegexRule(`^[A-Z]{2,3}-\d{3,4}$`, true)
	if err != nil {
		t.Fatalf("Failed to create regex rule: %v", err)
	}

	// Test forbidden pattern
	forbiddenRule, err := NewRegexRule(`\b(password|secret|key)\b`, false)
	if err != nil {
		t.Fatalf("Failed to create regex rule: %v", err)
	}

	context := ValidationContext{
		DataType:  "string",
		PointName: "device_id",
	}

	tests := []struct {
		name          string
		rule          *RegexRule
		value         interface{}
		expectedValid bool
	}{
		{"Valid device ID", mustMatchRule, "AB-123", true},
		{"Invalid device ID", mustMatchRule, "invalid-id", false},
		{"Safe text", forbiddenRule, "normal text", true},
		{"Text with forbidden word", forbiddenRule, "my password is secret", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.rule.Validate(tt.value, context)
			if result.IsValid != tt.expectedValid {
				t.Errorf("Expected IsValid=%v, got %v", tt.expectedValid, result.IsValid)
			}
		})
	}
}

func TestStatisticalRule_ZScore(t *testing.T) {
	rule := NewStatisticalRule("zscore", 2.0, 5, 100)
	context := ValidationContext{
		DataType:  "float64",
		PointName: "temperature",
	}

	// Add some normal values to build history
	normalValues := []float64{20.0, 21.0, 19.5, 20.5, 22.0, 19.0, 21.5}
	for _, val := range normalValues {
		rule.Validate(val, context)
	}

	tests := []struct {
		name            string
		value           interface{}
		expectedQuality int
	}{
		{"Normal value", 20.5, 1},
		{"Outlier value", 50.0, 2}, // Should trigger warning
		{"Non-numeric value", "text", 1}, // Should be skipped
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Validate(tt.value, context)
			if result.Quality != tt.expectedQuality {
				t.Errorf("Expected Quality=%d, got %d", tt.expectedQuality, result.Quality)
			}
		})
	}
}

func TestStatisticalRule_IQR(t *testing.T) {
	rule := NewStatisticalRule("iqr", 1.5, 8, 100)
	context := ValidationContext{
		DataType:  "float64",
		PointName: "pressure",
	}

	// Add values to build sufficient history
	values := []float64{10, 12, 14, 15, 16, 18, 20, 22, 24, 25}
	for _, val := range values {
		rule.Validate(val, context)
	}

	// Test with outlier
	result := rule.Validate(100.0, context)
	if result.Quality != 2 {
		t.Errorf("Expected Quality=2 for outlier, got %d", result.Quality)
	}

	// Check metadata
	if result.Metadata["iqr"] == nil {
		t.Error("Expected IQR in metadata")
	}
}

func TestStatisticalRule_InsufficientData(t *testing.T) {
	rule := NewStatisticalRule("zscore", 2.0, 10, 100)
	context := ValidationContext{
		DataType:  "float64",
		PointName: "temperature",
	}

	// Test with insufficient data
	result := rule.Validate(25.0, context)
	if result.Quality != 1 {
		t.Errorf("Expected Quality=1 with insufficient data, got %d", result.Quality)
	}
	if len(result.Warnings) > 0 {
		t.Error("Expected no warnings with insufficient data")
	}
}

func BenchmarkAdvancedRules(b *testing.B) {
	// Benchmark protocol specific rule
	rules := map[string]interface{}{"validate_ranges": true}
	protocolRule := NewProtocolSpecificRule("modbus", rules)
	
	context := ValidationContext{
		DataType:  "int16",
		PointName: "register",
	}

	b.Run("ProtocolSpecificRule", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			protocolRule.Validate(1000.0, context)
		}
	})

	// Benchmark statistical rule
	statRule := NewStatisticalRule("zscore", 2.0, 5, 100)
	
	// Pre-populate with some data
	for i := 0; i < 10; i++ {
		statRule.Validate(float64(20+i), context)
	}

	b.Run("StatisticalRule", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			statRule.Validate(25.0, context)
		}
	})

	// Benchmark business logic rule
	businessRules := []BusinessRule{
		{
			Name:      "temperature_range",
			Condition: "temperature_sensor_range",
			Action:    "reject",
			Message:   "Temperature outside range",
			Params: map[string]interface{}{
				"range": map[string]interface{}{
					"min": -20.0,
					"max": 80.0,
				},
			},
		},
	}
	businessRule := NewBusinessLogicRule(businessRules)

	b.Run("BusinessLogicRule", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			businessRule.Validate(25.0, context)
		}
	})
}