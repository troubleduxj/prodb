package validation

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// DataIntegrityRule validates data integrity using checksums or hash validation
type DataIntegrityRule struct {
	name        string
	description string
	algorithm   string // "crc32", "md5", "sha256"
}

// NewDataIntegrityRule creates a new data integrity validation rule
func NewDataIntegrityRule(algorithm string) *DataIntegrityRule {
	return &DataIntegrityRule{
		name:        "data_integrity_rule",
		description: fmt.Sprintf("Validates data integrity using %s algorithm", algorithm),
		algorithm:   algorithm,
	}
}

func (r *DataIntegrityRule) GetName() string        { return r.name }
func (r *DataIntegrityRule) GetDescription() string { return r.description }

func (r *DataIntegrityRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// This is a placeholder for data integrity validation
	// In a real implementation, you would validate checksums or hashes
	// For now, we'll just check if the value is reasonable
	
	if str, ok := value.(string); ok {
		// Check for suspicious patterns that might indicate data corruption
		if strings.Contains(str, "\x00") || strings.Contains(str, "\xFF") {
			result.IsValid = false
			result.Quality = 0
			result.Errors = append(result.Errors, ValidationError{
				Type:        "data_corruption",
				Message:     "Data contains suspicious null or invalid characters",
				Field:       context.PointName,
				ActualValue: fmt.Sprintf("length: %d", len(str)),
			})
		}
	}

	return result
}

// ProtocolSpecificRule validates data according to protocol-specific rules
type ProtocolSpecificRule struct {
	name        string
	description string
	protocol    string
	rules       map[string]interface{}
}

// NewProtocolSpecificRule creates a protocol-specific validation rule
func NewProtocolSpecificRule(protocol string, rules map[string]interface{}) *ProtocolSpecificRule {
	return &ProtocolSpecificRule{
		name:        fmt.Sprintf("%s_protocol_rule", protocol),
		description: fmt.Sprintf("Validates data according to %s protocol specifications", protocol),
		protocol:    protocol,
		rules:       rules,
	}
}

func (r *ProtocolSpecificRule) GetName() string        { return r.name }
func (r *ProtocolSpecificRule) GetDescription() string { return r.description }

func (r *ProtocolSpecificRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	switch r.protocol {
	case "modbus":
		result = r.validateModbusData(value, context)
	case "opcua":
		result = r.validateOPCUAData(value, context)
	case "mqtt":
		result = r.validateMQTTData(value, context)
	default:
		// Generic validation
		result = r.validateGenericData(value, context)
	}

	return result
}

func (r *ProtocolSpecificRule) validateModbusData(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// Modbus-specific validation
	if numValue, err := convertToFloat64(value); err == nil {
		// Check for Modbus register value ranges
		if context.DataType == "int16" {
			if numValue < -32768 || numValue > 32767 {
				result.IsValid = false
				result.Quality = 0
				result.Errors = append(result.Errors, ValidationError{
					Type:        "modbus_range_error",
					Message:     "Value outside Modbus INT16 range (-32768 to 32767)",
					Field:       context.PointName,
					ActualValue: fmt.Sprintf("%.0f", numValue),
				})
			}
		} else if context.DataType == "uint16" {
			if numValue < 0 || numValue > 65535 {
				result.IsValid = false
				result.Quality = 0
				result.Errors = append(result.Errors, ValidationError{
					Type:        "modbus_range_error",
					Message:     "Value outside Modbus UINT16 range (0 to 65535)",
					Field:       context.PointName,
					ActualValue: fmt.Sprintf("%.0f", numValue),
				})
			}
		}
	}

	return result
}

func (r *ProtocolSpecificRule) validateOPCUAData(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// OPC-UA specific validation
	// Check for OPC-UA status codes in metadata
	if statusCode, exists := context.Tags["status_code"]; exists {
		if statusCode != "0" && statusCode != "Good" {
			result.Quality = 2 // Uncertain quality
			result.Warnings = append(result.Warnings, ValidationWarning{
				Type:    "opcua_status_warning",
				Message: fmt.Sprintf("OPC-UA status code indicates potential issue: %s", statusCode),
				Field:   context.PointName,
			})
		}
	}

	return result
}

func (r *ProtocolSpecificRule) validateMQTTData(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// MQTT specific validation
	if str, ok := value.(string); ok {
		// Check if it's valid JSON for MQTT payloads
		if strings.HasPrefix(str, "{") && strings.HasSuffix(str, "}") {
			// Basic JSON structure check
			if !r.isValidJSONStructure(str) {
				result.IsValid = false
				result.Quality = 0
				result.Errors = append(result.Errors, ValidationError{
					Type:        "mqtt_json_error",
					Message:     "Invalid JSON structure in MQTT payload",
					Field:       context.PointName,
					ActualValue: str,
				})
			}
		}
	}

	return result
}

func (r *ProtocolSpecificRule) validateGenericData(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// Generic protocol validation
	if value == nil {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:    "protocol_null_value",
			Message: "Protocol data cannot be null",
			Field:   context.PointName,
		})
	}

	return result
}

func (r *ProtocolSpecificRule) isValidJSONStructure(jsonStr string) bool {
	// Simple JSON structure validation
	openBraces := strings.Count(jsonStr, "{")
	closeBraces := strings.Count(jsonStr, "}")
	openBrackets := strings.Count(jsonStr, "[")
	closeBrackets := strings.Count(jsonStr, "]")
	
	return openBraces == closeBraces && openBrackets == closeBrackets
}

// PerformanceRule validates data processing performance requirements
type PerformanceRule struct {
	name               string
	description        string
	maxProcessingTime  time.Duration
	maxDataPointsPerSec int
	processingTimes    []time.Duration
	dataPointCounts    []int
	windowSize         int
}

// NewPerformanceRule creates a new performance validation rule
func NewPerformanceRule(maxProcessingTime time.Duration, maxDataPointsPerSec int) *PerformanceRule {
	return &PerformanceRule{
		name:                fmt.Sprintf("performance_rule_%dms_%ddps", maxProcessingTime.Milliseconds(), maxDataPointsPerSec),
		description:         fmt.Sprintf("Validates processing performance (max %v, max %d data points/sec)", maxProcessingTime, maxDataPointsPerSec),
		maxProcessingTime:   maxProcessingTime,
		maxDataPointsPerSec: maxDataPointsPerSec,
		processingTimes:     make([]time.Duration, 0),
		dataPointCounts:     make([]int, 0),
		windowSize:          60, // 60 second window
	}
}

func (r *PerformanceRule) GetName() string        { return r.name }
func (r *PerformanceRule) GetDescription() string { return r.description }

func (r *PerformanceRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1, Metadata: make(map[string]interface{})}

	// Record processing time (this would be set by the validation framework)
	processingTime := time.Millisecond * 1 // Placeholder - would be actual processing time
	r.addProcessingTime(processingTime)

	// Check processing time
	if processingTime > r.maxProcessingTime {
		result.Quality = 2 // Uncertain quality due to slow processing
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "slow_processing",
			Message: fmt.Sprintf("Processing time %v exceeds maximum %v", processingTime, r.maxProcessingTime),
			Field:   context.PointName,
		})
	}

	// Calculate current data points per second
	currentRate := r.calculateDataPointsPerSecond()
	result.Metadata["processing_time"] = processingTime
	result.Metadata["data_points_per_sec"] = currentRate

	if currentRate > float64(r.maxDataPointsPerSec) {
		result.Quality = 2 // Uncertain quality due to high load
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "high_data_rate",
			Message: fmt.Sprintf("Data rate %.1f points/sec exceeds maximum %d points/sec", currentRate, r.maxDataPointsPerSec),
			Field:   context.PointName,
		})
	}

	return result
}

func (r *PerformanceRule) addProcessingTime(duration time.Duration) {
	r.processingTimes = append(r.processingTimes, duration)
	r.dataPointCounts = append(r.dataPointCounts, 1)

	// Keep only recent data within the window
	if len(r.processingTimes) > r.windowSize {
		r.processingTimes = r.processingTimes[1:]
		r.dataPointCounts = r.dataPointCounts[1:]
	}
}

func (r *PerformanceRule) calculateDataPointsPerSecond() float64 {
	if len(r.dataPointCounts) == 0 {
		return 0
	}

	totalPoints := 0
	for _, count := range r.dataPointCounts {
		totalPoints += count
	}

	// Assume each entry represents 1 second (simplified)
	windowSeconds := float64(len(r.dataPointCounts))
	if windowSeconds == 0 {
		return 0
	}

	return float64(totalPoints) / windowSeconds
}

// BusinessLogicRule validates data according to business logic rules
type BusinessLogicRule struct {
	name        string
	description string
	rules       []BusinessRule
}

type BusinessRule struct {
	Name      string                 `json:"name"`
	Condition string                 `json:"condition"` // Simple condition expression
	Action    string                 `json:"action"`    // "reject", "warn", "transform"
	Message   string                 `json:"message"`
	Params    map[string]interface{} `json:"params"`
}

// NewBusinessLogicRule creates a new business logic validation rule
func NewBusinessLogicRule(rules []BusinessRule) *BusinessLogicRule {
	return &BusinessLogicRule{
		name:        "business_logic_rule",
		description: "Validates data according to business logic rules",
		rules:       rules,
	}
}

func (r *BusinessLogicRule) GetName() string        { return r.name }
func (r *BusinessLogicRule) GetDescription() string { return r.description }

func (r *BusinessLogicRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	for _, rule := range r.rules {
		ruleResult := r.evaluateBusinessRule(rule, value, context)
		if !ruleResult.IsValid {
			result.IsValid = false
			result.Quality = 0
			result.Errors = append(result.Errors, ruleResult.Errors...)
		}
		result.Warnings = append(result.Warnings, ruleResult.Warnings...)
	}

	return result
}

func (r *BusinessLogicRule) evaluateBusinessRule(rule BusinessRule, value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	// Simple business rule evaluation
	switch rule.Condition {
	case "temperature_sensor_range":
		if numValue, err := convertToFloat64(value); err == nil {
			if context.PointName == "temperature" {
				minTemp := -40.0
				maxTemp := 125.0
				if params, ok := rule.Params["range"].(map[string]interface{}); ok {
					if min, ok := params["min"].(float64); ok {
						minTemp = min
					}
					if max, ok := params["max"].(float64); ok {
						maxTemp = max
					}
				}
				
				if numValue < minTemp || numValue > maxTemp {
					if rule.Action == "reject" {
						result.IsValid = false
						result.Quality = 0
						result.Errors = append(result.Errors, ValidationError{
							Type:        "business_rule_violation",
							Message:     rule.Message,
							Field:       context.PointName,
							ActualValue: fmt.Sprintf("%.2f", numValue),
						})
					} else if rule.Action == "warn" {
						result.Warnings = append(result.Warnings, ValidationWarning{
							Type:    "business_rule_warning",
							Message: rule.Message,
							Field:   context.PointName,
						})
					}
				}
			}
		}
	case "pressure_sensor_range":
		if numValue, err := convertToFloat64(value); err == nil {
			if context.PointName == "pressure" {
				minPressure := 0.0
				maxPressure := 1000.0
				if params, ok := rule.Params["range"].(map[string]interface{}); ok {
					if min, ok := params["min"].(float64); ok {
						minPressure = min
					}
					if max, ok := params["max"].(float64); ok {
						maxPressure = max
					}
				}
				
				if numValue < minPressure || numValue > maxPressure {
					if rule.Action == "reject" {
						result.IsValid = false
						result.Quality = 0
						result.Errors = append(result.Errors, ValidationError{
							Type:        "business_rule_violation",
							Message:     rule.Message,
							Field:       context.PointName,
							ActualValue: fmt.Sprintf("%.2f", numValue),
						})
					}
				}
			}
		}
	case "device_status_values":
		if str, ok := value.(string); ok {
			validStatuses := []string{"RUNNING", "STOPPED", "MAINTENANCE", "ERROR"}
			if params, ok := rule.Params["valid_values"].([]interface{}); ok {
				validStatuses = make([]string, len(params))
				for i, v := range params {
					if s, ok := v.(string); ok {
						validStatuses[i] = s
					}
				}
			}
			
			isValid := false
			for _, status := range validStatuses {
				if strings.EqualFold(str, status) {
					isValid = true
					break
				}
			}
			
			if !isValid {
				result.IsValid = false
				result.Quality = 0
				result.Errors = append(result.Errors, ValidationError{
					Type:        "business_rule_violation",
					Message:     fmt.Sprintf("%s. Valid values: %v", rule.Message, validStatuses),
					Field:       context.PointName,
					ActualValue: str,
				})
			}
		}
	}

	return result
}

// RegexRule validates data using regular expressions
type RegexRule struct {
	name        string
	description string
	pattern     *regexp.Regexp
	mustMatch   bool
}

// NewRegexRule creates a new regex validation rule
func NewRegexRule(pattern string, mustMatch bool) (*RegexRule, error) {
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %v", err)
	}

	return &RegexRule{
		name:        "regex_rule",
		description: fmt.Sprintf("Validates data using regex pattern: %s", pattern),
		pattern:     regex,
		mustMatch:   mustMatch,
	}, nil
}

func (r *RegexRule) GetName() string        { return r.name }
func (r *RegexRule) GetDescription() string { return r.description }

func (r *RegexRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1}

	str := fmt.Sprintf("%v", value)
	matches := r.pattern.MatchString(str)

	if r.mustMatch && !matches {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "regex_mismatch",
			Message:     "Value does not match required pattern",
			Field:       context.PointName,
			ActualValue: str,
		})
	} else if !r.mustMatch && matches {
		result.IsValid = false
		result.Quality = 0
		result.Errors = append(result.Errors, ValidationError{
			Type:        "regex_forbidden_match",
			Message:     "Value matches forbidden pattern",
			Field:       context.PointName,
			ActualValue: str,
		})
	}

	return result
}

// StatisticalRule validates data using statistical methods
type StatisticalRule struct {
	name           string
	description    string
	method         string // "zscore", "iqr", "grubbs"
	threshold      float64
	minSampleSize  int
	history        []float64
	maxHistorySize int
}

// NewStatisticalRule creates a new statistical validation rule
func NewStatisticalRule(method string, threshold float64, minSampleSize int, maxHistorySize int) *StatisticalRule {
	return &StatisticalRule{
		name:           fmt.Sprintf("statistical_rule_%s", method),
		description:    fmt.Sprintf("Validates data using %s statistical method (threshold: %.2f)", method, threshold),
		method:         method,
		threshold:      threshold,
		minSampleSize:  minSampleSize,
		history:        make([]float64, 0, maxHistorySize),
		maxHistorySize: maxHistorySize,
	}
}

func (r *StatisticalRule) GetName() string        { return r.name }
func (r *StatisticalRule) GetDescription() string { return r.description }

func (r *StatisticalRule) Validate(value interface{}, context ValidationContext) ValidationResult {
	result := ValidationResult{IsValid: true, Quality: 1, Metadata: make(map[string]interface{})}

	numValue, err := convertToFloat64(value)
	if err != nil {
		return result // Skip statistical validation for non-numeric values
	}

	// Add to history
	r.addToHistory(numValue)

	// Need minimum sample size for statistical analysis
	if len(r.history) < r.minSampleSize {
		return result
	}

	switch r.method {
	case "zscore":
		result = r.validateZScore(numValue, result)
	case "iqr":
		result = r.validateIQR(numValue, result)
	case "grubbs":
		result = r.validateGrubbs(numValue, result)
	}

	return result
}

func (r *StatisticalRule) addToHistory(value float64) {
	r.history = append(r.history, value)
	if len(r.history) > r.maxHistorySize {
		r.history = r.history[1:]
	}
}

func (r *StatisticalRule) validateZScore(value float64, result ValidationResult) ValidationResult {
	mean := r.calculateMean()
	stdDev := r.calculateStdDev(mean)

	if stdDev > 0 {
		zScore := math.Abs(value-mean) / stdDev
		result.Metadata["z_score"] = zScore
		result.Metadata["mean"] = mean
		result.Metadata["std_dev"] = stdDev

		if zScore > r.threshold {
			result.Quality = 2 // Uncertain quality
			result.Warnings = append(result.Warnings, ValidationWarning{
				Type:    "statistical_outlier",
				Message: fmt.Sprintf("Value is statistical outlier (z-score: %.2f)", zScore),
			})
		}
	}

	return result
}

func (r *StatisticalRule) validateIQR(value float64, result ValidationResult) ValidationResult {
	sortedHistory := make([]float64, len(r.history))
	copy(sortedHistory, r.history)
	
	// Simple sort
	for i := 0; i < len(sortedHistory); i++ {
		for j := i + 1; j < len(sortedHistory); j++ {
			if sortedHistory[i] > sortedHistory[j] {
				sortedHistory[i], sortedHistory[j] = sortedHistory[j], sortedHistory[i]
			}
		}
	}

	n := len(sortedHistory)
	q1 := sortedHistory[n/4]
	q3 := sortedHistory[3*n/4]
	iqr := q3 - q1

	lowerBound := q1 - r.threshold*iqr
	upperBound := q3 + r.threshold*iqr

	result.Metadata["q1"] = q1
	result.Metadata["q3"] = q3
	result.Metadata["iqr"] = iqr
	result.Metadata["lower_bound"] = lowerBound
	result.Metadata["upper_bound"] = upperBound

	if value < lowerBound || value > upperBound {
		result.Quality = 2 // Uncertain quality
		result.Warnings = append(result.Warnings, ValidationWarning{
			Type:    "statistical_outlier",
			Message: fmt.Sprintf("Value outside IQR bounds [%.2f, %.2f]", lowerBound, upperBound),
		})
	}

	return result
}

func (r *StatisticalRule) validateGrubbs(value float64, result ValidationResult) ValidationResult {
	// Simplified Grubbs test implementation
	mean := r.calculateMean()
	stdDev := r.calculateStdDev(mean)

	if stdDev > 0 {
		n := float64(len(r.history))
		maxDeviation := math.Abs(value - mean)
		grubbsStatistic := maxDeviation / stdDev

		// Critical value approximation for Grubbs test
		criticalValue := ((n - 1) / math.Sqrt(n)) * math.Sqrt(r.threshold*r.threshold/(n-2+r.threshold*r.threshold))

		result.Metadata["grubbs_statistic"] = grubbsStatistic
		result.Metadata["critical_value"] = criticalValue

		if grubbsStatistic > criticalValue {
			result.Quality = 2 // Uncertain quality
			result.Warnings = append(result.Warnings, ValidationWarning{
				Type:    "statistical_outlier",
				Message: fmt.Sprintf("Value is statistical outlier (Grubbs: %.2f > %.2f)", grubbsStatistic, criticalValue),
			})
		}
	}

	return result
}

func (r *StatisticalRule) calculateMean() float64 {
	if len(r.history) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range r.history {
		sum += v
	}
	return sum / float64(len(r.history))
}

func (r *StatisticalRule) calculateStdDev(mean float64) float64 {
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