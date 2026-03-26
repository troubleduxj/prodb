package validation

import (
	"math"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// ValidationResult represents the result of data validation
type ValidationResult struct {
	IsValid     bool                   `json:"is_valid"`
	Quality     int                    `json:"quality"` // 0=bad, 1=good, 2=uncertain
	Errors      []ValidationError      `json:"errors,omitempty"`
	Warnings    []ValidationWarning    `json:"warnings,omitempty"`
	Transformed interface{}            `json:"transformed,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Type        string `json:"type"`
	Message     string `json:"message"`
	Field       string `json:"field,omitempty"`
	ActualValue string `json:"actual_value,omitempty"`
}

// ValidationWarning represents a validation warning
type ValidationWarning struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

// ValidationRule interface defines a validation rule
type ValidationRule interface {
	Validate(value interface{}, context ValidationContext) ValidationResult
	GetName() string
	GetDescription() string
}

// ValidationContext provides context for validation
type ValidationContext struct {
	DataType     string            `json:"data_type"`
	Unit         string            `json:"unit"`
	PointName    string            `json:"point_name"`
	DeviceID     string            `json:"device_id"`
	Tags         map[string]string `json:"tags"`
	Timestamp    time.Time         `json:"timestamp"`
	PreviousData []interface{}     `json:"previous_data,omitempty"`
}

// DataValidator is the main validation engine
type DataValidator struct {
	rules   map[string][]ValidationRule
	logger  *logger.Logger
	config  *ValidatorConfig
	metrics *ValidationMetrics
}

// ValidatorConfig contains validator configuration
type ValidatorConfig struct {
	EnableRangeValidation   bool    `json:"enable_range_validation"`
	EnableFormatValidation  bool    `json:"enable_format_validation"`
	EnableQualityAssessment bool    `json:"enable_quality_assessment"`
	EnableTransformation    bool    `json:"enable_transformation"`
	MaxValidationErrors     int     `json:"max_validation_errors"`
	QualityThreshold        float64 `json:"quality_threshold"`
	AnomalyDetectionEnabled bool    `json:"anomaly_detection_enabled"`
	AnomalyThreshold        float64 `json:"anomaly_threshold"`
}

// ValidationMetrics tracks validation statistics
type ValidationMetrics struct {
	TotalValidations  int64   `json:"total_validations"`
	ValidData         int64   `json:"valid_data"`
	InvalidData       int64   `json:"invalid_data"`
	TransformedData   int64   `json:"transformed_data"`
	AnomaliesDetected int64   `json:"anomalies_detected"`
	QualityScore      float64 `json:"quality_score"`
}

// NewDataValidator creates a new data validator
func NewDataValidator(logger *logger.Logger, config *ValidatorConfig) *DataValidator {
	if config == nil {
		config = &ValidatorConfig{
			EnableRangeValidation:   true,
			EnableFormatValidation:  true,
			EnableQualityAssessment: true,
			EnableTransformation:    true,
			MaxValidationErrors:     10,
			QualityThreshold:        0.8,
			AnomalyDetectionEnabled: true,
			AnomalyThreshold:        3.0, // 3 standard deviations
		}
	}

	validator := &DataValidator{
		rules:   make(map[string][]ValidationRule),
		logger:  logger.WithGroup("validator"),
		config:  config,
		metrics: &ValidationMetrics{},
	}

	// Initialize default rules
	validator.initializeDefaultRules()

	return validator
}

// ValidateDataValue validates a single data value
func (dv *DataValidator) ValidateDataValue(dataValue *protocol.DataValue) ValidationResult {
	dv.metrics.TotalValidations++

	context := ValidationContext{
		DataType:  dataValue.DataType,
		Unit:      dataValue.Unit,
		PointName: dataValue.PointName,
		DeviceID:  dataValue.DeviceID,
		Tags:      dataValue.Tags,
		Timestamp: dataValue.Timestamp,
	}

	result := ValidationResult{
		IsValid:  true,
		Quality:  1, // Start with good quality
		Metadata: make(map[string]interface{}),
	}

	// Get rules for this data type
	rules := dv.getRulesForDataType(dataValue.DataType)

	// Apply validation rules
	for _, rule := range rules {
		ruleResult := rule.Validate(dataValue.Value, context)

		// Merge results
		if !ruleResult.IsValid {
			result.IsValid = false
			result.Errors = append(result.Errors, ruleResult.Errors...)
		}

		result.Warnings = append(result.Warnings, ruleResult.Warnings...)

		// Update quality based on rule results
		if ruleResult.Quality < result.Quality {
			result.Quality = ruleResult.Quality
		}

		// Handle transformation
		if ruleResult.Transformed != nil {
			result.Transformed = ruleResult.Transformed
			dv.metrics.TransformedData++
		}

		// Merge metadata
		for k, v := range ruleResult.Metadata {
			result.Metadata[k] = v
		}
	}

	// Update metrics
	if result.IsValid {
		dv.metrics.ValidData++
	} else {
		dv.metrics.InvalidData++
	}

	// Update quality score
	dv.updateQualityScore(result.Quality)

	// Apply transformation if enabled and available
	if dv.config.EnableTransformation && result.Transformed != nil {
		dataValue.Value = result.Transformed
		dataValue.RawValue = dataValue.Value // Store original value
	}

	// Update data value quality
	dataValue.Quality = result.Quality

	dv.logger.Debug("Data validation completed",
		"point", dataValue.PointName,
		"valid", result.IsValid,
		"quality", result.Quality,
		"errors", len(result.Errors),
		"warnings", len(result.Warnings))

	return result
}

// ValidateDataBatch validates a batch of data values
func (dv *DataValidator) ValidateDataBatch(dataValues []protocol.DataValue) []ValidationResult {
	results := make([]ValidationResult, len(dataValues))

	for i, dataValue := range dataValues {
		results[i] = dv.ValidateDataValue(&dataValue)
	}

	return results
}

// AddRule adds a validation rule for a specific data type
func (dv *DataValidator) AddRule(dataType string, rule ValidationRule) {
	if dv.rules[dataType] == nil {
		dv.rules[dataType] = make([]ValidationRule, 0)
	}
	dv.rules[dataType] = append(dv.rules[dataType], rule)

	dv.logger.Info("Added validation rule",
		"data_type", dataType,
		"rule", rule.GetName())
}

// RemoveRule removes a validation rule for a specific data type
func (dv *DataValidator) RemoveRule(dataType string, ruleName string) {
	if rules, exists := dv.rules[dataType]; exists {
		for i, rule := range rules {
			if rule.GetName() == ruleName {
				dv.rules[dataType] = append(rules[:i], rules[i+1:]...)
				dv.logger.Info("Removed validation rule",
					"data_type", dataType,
					"rule", ruleName)
				break
			}
		}
	}
}

// GetMetrics returns validation metrics
func (dv *DataValidator) GetMetrics() ValidationMetrics {
	return *dv.metrics
}

// ResetMetrics resets validation metrics
func (dv *DataValidator) ResetMetrics() {
	dv.metrics = &ValidationMetrics{}
}

// getRulesForDataType returns validation rules for a specific data type
func (dv *DataValidator) getRulesForDataType(dataType string) []ValidationRule {
	rules := make([]ValidationRule, 0)

	// Add specific rules for this data type
	if typeRules, exists := dv.rules[dataType]; exists {
		rules = append(rules, typeRules...)
	}

	// Add generic rules
	if genericRules, exists := dv.rules["*"]; exists {
		rules = append(rules, genericRules...)
	}

	return rules
}

// updateQualityScore updates the overall quality score
func (dv *DataValidator) updateQualityScore(quality int) {
	if dv.metrics.TotalValidations == 0 {
		return
	}

	// Calculate weighted average quality score
	currentScore := dv.metrics.QualityScore
	newScore := float64(quality)

	// Use exponential moving average
	alpha := 0.1 // Smoothing factor
	dv.metrics.QualityScore = alpha*newScore + (1-alpha)*currentScore
}

// initializeDefaultRules initializes default validation rules
func (dv *DataValidator) initializeDefaultRules() {
	// Add null/empty value rule for all types
	dv.AddRule("*", NewNullValueRule())

	// Add timestamp validation rule
	dv.AddRule("*", NewTimestampRule())

	// Add numeric range rules
	dv.AddRule("float32", NewRangeRule(-math.MaxFloat32, math.MaxFloat32))
	dv.AddRule("float64", NewRangeRule(-math.MaxFloat64, math.MaxFloat64))
	dv.AddRule("int16", NewRangeRule(-32768, 32767))
	dv.AddRule("int32", NewRangeRule(-2147483648, 2147483647))

	// Add format validation rules
	dv.AddRule("string", NewStringFormatRule())
	dv.AddRule("bool", NewBooleanRule())

	// Add data type consistency rule
	dv.AddRule("*", NewDataTypeConsistencyRule())

	dv.logger.Info("Initialized default validation rules")
}
