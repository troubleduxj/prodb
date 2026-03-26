package validation

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// NullValueRule validates against null/empty values
type NullValueRule struct {
	name        string
	description string
}

// NewNullValueRule creates a new null value validation rule
func NewNullValueRule() *NullValueRule {
	return &NullValueRule{
		name:        "null_value_rule",
		description: "Validates that values are not null or empty",
	}
}

func (r *NullValueRule) GetName() string        { return r.name }
func (r *NullValueRule) GetDescription() string { return r.description }

func (r *NullValueRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	if value == nil {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:    "null_value",
			Message: "Value is null",
			Field:   context.PointName,
		})
		return result
	}

	// Check for empty strings
	if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "empty_value",
			Message:     "Value is empty string",
			Field:       context.PointName,
			ActualValue: fmt.Sprintf("%v", value),
		})
	}

	return result
}

// RangeRule validates numeric values within a specified range
type RangeRule struct {
	name        string
	description string
	min         float64
	max         float64
}

// NewRangeRule creates a new range validation rule
func NewRangeRule(min, max float64) *RangeRule {
	return &RangeRule{
		name:        "range_rule",
		description: fmt.Sprintf("Validates numeric values within range [%.2f, %.2f]", min, max),
		min:         min,
		max:         max,
	}
}

func (r *RangeRule) GetName() string        { return r.name }
func (r *RangeRule) GetDescription() string { return r.description }

func (r *RangeRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	numValue, err := convertToFloat64(value)
	if err != nil {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "conversion_warning",
			Message: fmt.Sprintf("Cannot convert value to numeric for range validation: %v", err),
			Field:   context.PointName,
		})
		return result
	}

	if numValue < r.min || numValue > r.max {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "range_violation",
			Message:     fmt.Sprintf("Value %.2f is outside valid range [%.2f, %.2f]", numValue, r.min, r.max),
			Field:       context.PointName,
			ActualValue: fmt.Sprintf("%.2f", numValue),
		})
	}

	return result
}

// TimestampRule validates timestamp values
type TimestampRule struct {
	name        string
	description string
	maxAge      time.Duration
	maxFuture   time.Duration
}

// NewTimestampRule creates a new timestamp validation rule
func NewTimestampRule() *TimestampRule {
	return &TimestampRule{
		name:        "timestamp_rule",
		description: "Validates timestamp values for reasonable time ranges",
		maxAge:      24 * time.Hour,  // Data older than 24 hours is suspicious
		maxFuture:   5 * time.Minute, // Data more than 5 minutes in future is suspicious
	}
}

func (r *TimestampRule) GetName() string        { return r.name }
func (r *TimestampRule) GetDescription() string { return r.description }

func (r *TimestampRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}
	now := time.Now()

	// Check if timestamp is too old
	if now.Sub(context.Timestamp) > r.maxAge {
		result.Quality = 2 // Uncertain quality
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "old_timestamp",
			Message: fmt.Sprintf("Timestamp is older than %v", r.maxAge),
			Field:   "timestamp",
		})
	}

	// Check if timestamp is too far in the future
	if context.Timestamp.Sub(now) > r.maxFuture {
		result.Quality = 2 // Uncertain quality
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "future_timestamp",
			Message: fmt.Sprintf("Timestamp is more than %v in the future", r.maxFuture),
			Field:   "timestamp",
		})
	}

	return result
}

// StringFormatRule validates string format
type StringFormatRule struct {
	name        string
	description string
	pattern     *regexp.Regexp
	maxLength   int
}

// NewStringFormatRule creates a new string format validation rule
func NewStringFormatRule() *StringFormatRule {
	return &StringFormatRule{
		name:        "string_format_rule",
		description: "Validates string format and length",
		maxLength:   1000, // Maximum string length
	}
}

// NewStringFormatRuleWithPattern creates a string format rule with custom pattern
func NewStringFormatRuleWithPattern(pattern string, maxLength int) (*StringFormatRule, error) {
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %v", err)
	}

	return &StringFormatRule{
		name:        "string_format_rule_custom",
		description: fmt.Sprintf("Validates string format with pattern: %s", pattern),
		pattern:     regex,
		maxLength:   maxLength,
	}, nil
}

func (r *StringFormatRule) GetName() string        { return r.name }
func (r *StringFormatRule) GetDescription() string { return r.description }

func (r *StringFormatRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	str, ok := value.(string)
	if !ok {
		return result // Not a string, skip validation
	}

	// Check length
	if len(str) > r.maxLength {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "string_too_long",
			Message:     fmt.Sprintf("String length %d exceeds maximum %d", len(str), r.maxLength),
			Field:       context.PointName,
			ActualValue: fmt.Sprintf("length: %d", len(str)),
		})
	}

	// Check pattern if specified
	if r.pattern != nil && !r.pattern.MatchString(str) {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "pattern_mismatch",
			Message:     "String does not match required pattern",
			Field:       context.PointName,
			ActualValue: str,
		})
	}

	return result
}

// BooleanRule validates boolean values
type BooleanRule struct {
	name        string
	description string
}

// NewBooleanRule creates a new boolean validation rule
func NewBooleanRule() *BooleanRule {
	return &BooleanRule{
		name:        "boolean_rule",
		description: "Validates boolean values and converts string representations",
	}
}

func (r *BooleanRule) GetName() string        { return r.name }
func (r *BooleanRule) GetDescription() string { return r.description }

func (r *BooleanRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	switch v := value.(type) {
	case bool:
		// Already a boolean, no transformation needed
		return result
	case string:
		// Try to convert string to boolean
		lower := strings.ToLower(strings.TrimSpace(v))
		switch lower {
		case "true", "1", "yes", "on", "enabled":
			result.Transformed = true
		case "false", "0", "no", "off", "disabled":
			result.Transformed = false
		default:
			result.IsValid = false
			result.Quality = 0
			result.Errors = append(result.Errors, ValidationError{
				Type:        "invalid_boolean",
				Message:     fmt.Sprintf("Cannot convert '%s' to boolean", v),
				Field:       context.PointName,
				ActualValue: v,
			})
		}
	case int, int32, int64:
		// Convert integer to boolean
		intVal := reflect.ValueOf(v).Int()
		result.Transformed = intVal != 0
	case float32, float64:
		// Convert float to boolean
		floatVal := reflect.ValueOf(v).Float()
		result.Transformed = floatVal != 0.0
	default:
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "invalid_boolean_type",
			Message:     fmt.Sprintf("Cannot convert type %T to boolean", v),
			Field:       context.PointName,
			ActualValue: fmt.Sprintf("%v", v),
		})
	}

	return result
}

// DataTypeConsistencyRule validates data type consistency
type DataTypeConsistencyRule struct {
	name        string
	description string
}

// NewDataTypeConsistencyRule creates a new data type consistency rule
func NewDataTypeConsistencyRule() *DataTypeConsistencyRule {
	return &DataTypeConsistencyRule{
		name:        "data_type_consistency_rule",
		description: "Validates that actual value type matches expected data type",
	}
}

func (r *DataTypeConsistencyRule) GetName() string        { return r.name }
func (r *DataTypeConsistencyRule) GetDescription() string { return r.description }

func (r *DataTypeConsistencyRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	expectedType := context.DataType
	actualType := getValueType(value)

	// Check type consistency
	if !isTypeCompatible(expectedType, actualType) {
		// Try to transform the value to the expected type
		transformed, err := transformValue(value, expectedType)
		if err != nil {
			result.IsValid = false
			result.Quality = 0
			result.Errors = append(result.Errors, ValidationError{
				Type:        "type_mismatch",
				Message:     fmt.Sprintf("Expected type %s but got %s, transformation failed: %v", expectedType, actualType, err),
				Field:       context.PointName,
				ActualValue: fmt.Sprintf("%v (%s)", value, actualType),
			})
		} else {
			result.Transformed = transformed
			result.Warnings = append(result.Warnings, ValidationWarning{
				Type:    "type_transformation",
				Message: fmt.Sprintf("Transformed value from %s to %s", actualType, expectedType),
				Field:   context.PointName,
			})
		}
	}

	return result
}

// AnomalyDetectionRule detects anomalies in numeric data
type AnomalyDetectionRule struct {
	name        string
	description string
	threshold   float64
	history     []float64
	maxHistory  int
}

// NewAnomalyDetectionRule creates a new anomaly detection rule
func NewAnomalyDetectionRule(threshold float64, maxHistory int) *AnomalyDetectionRule {
	return &AnomalyDetectionRule{
		name:        "anomaly_detection_rule",
		description: fmt.Sprintf("Detects anomalies using statistical analysis (threshold: %.2f)", threshold),
		threshold:   threshold,
		history:     make([]float64, 0, maxHistory),
		maxHistory:  maxHistory,
	}
}

func (r *AnomalyDetectionRule) GetName() string        { return r.name }
func (r *AnomalyDetectionRule) GetDescription() string { return r.description }

func (r *AnomalyDetectionRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	numValue, err := convertToFloat64(value)
	if err != nil {
		return result // Skip anomaly detection for non-numeric values
	}

	// Need at least 3 historical values for meaningful statistics
	if len(r.history) < 3 {
		r.addToHistory(numValue)
		return result
	}

	// Calculate mean and standard deviation
	mean := r.calculateMean()
	stdDev := r.calculateStdDev(mean)

	// Check if current value is an anomaly
	if stdDev > 0 {
		zScore := math.Abs(numValue-mean) / stdDev
		if zScore > r.threshold {
			result.Quality = 2 // Uncertain quality
			result.Warnings = append(result.Warnings, ValidationWarning{
				Type:    "anomaly_detected",
				Message: fmt.Sprintf("Potential anomaly detected (z-score: %.2f)", zScore),
				Field:   context.PointName,
			})
			if result.Metadata == nil {
				result.Metadata = make(map[string]interface{})
			}
			result.Metadata["z_score"] = zScore
			result.Metadata["mean"] = mean
			result.Metadata["std_dev"] = stdDev
		}
	}

	// Add current value to history
	r.addToHistory(numValue)

	return result
}

func (r *AnomalyDetectionRule) addToHistory(value float64) {
	r.history = append(r.history, value)
	if len(r.history) > r.maxHistory {
		r.history = r.history[1:] // Remove oldest value
	}
}

func (r *AnomalyDetectionRule) calculateMean() float64 {
	if len(r.history) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range r.history {
		sum += v
	}
	return sum / float64(len(r.history))
}

func (r *AnomalyDetectionRule) calculateStdDev(mean float64) float64 {
	if len(r.history) <= 1 {
		return 0
	}
	sumSquares := 0.0
	for _, v := range r.history {
		diff := v - mean
		sumSquares += diff * diff
	}
	variance := sumSquares / float64(len(r.history)-1)
	return math.Sqrt(variance)
}

// Helper functions

// convertToFloat64 converts various numeric types to float64
func convertToFloat64(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", value)
	}
}

// getValueType returns the type name of a value
func getValueType(value interface{}) string {
	if value == nil {
		return "null"
	}
	return reflect.TypeOf(value).String()
}

// isTypeCompatible checks if actual type is compatible with expected type
func isTypeCompatible(expected, actual string) bool {
	// Exact match
	if expected == actual {
		return true
	}

	// Compatible numeric types
	numericTypes := map[string]bool{
		"int": true, "int32": true, "int64": true,
		"float32": true, "float64": true,
	}

	if numericTypes[expected] && numericTypes[actual] {
		return true
	}

	// String can be converted to most types
	if actual == "string" {
		return true
	}

	return false
}

// transformValue transforms a value to the expected type
func transformValue(value interface{}, expectedType string) (interface{}, error) {
	switch expectedType {
	case "float32":
		f64, err := convertToFloat64(value)
		if err != nil {
			return nil, err
		}
		return float32(f64), nil
	case "float64":
		return convertToFloat64(value)
	case "int32":
		f64, err := convertToFloat64(value)
		if err != nil {
			return nil, err
		}
		return int32(f64), nil
	case "int64":
		f64, err := convertToFloat64(value)
		if err != nil {
			return nil, err
		}
		return int64(f64), nil
	case "string":
		return fmt.Sprintf("%v", value), nil
	case "bool":
		switch v := value.(type) {
		case bool:
			return v, nil
		case string:
			return strconv.ParseBool(v)
		case int, int32, int64:
			return reflect.ValueOf(v).Int() != 0, nil
		case float32, float64:
			return reflect.ValueOf(v).Float() != 0.0, nil
		default:
			return false, fmt.Errorf("cannot convert %T to bool", value)
		}
	default:
		return value, nil // Return as-is for unknown types
	}
}
