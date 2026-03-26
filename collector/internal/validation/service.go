package validation

import (
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// ValidationService is the main service that coordinates all validation components
type ValidationService struct {
	validator         *DataValidator
	transformer       *DataTransformer
	qualityAssessment *QualityAssessment
	logger            *logger.Logger
	config            *ValidationServiceConfig
	metrics           *ValidationServiceMetrics
	mu                sync.RWMutex
	enabled           bool
}

// ValidationServiceConfig contains configuration for the validation service
type ValidationServiceConfig struct {
	EnableValidation        bool                `json:"enable_validation"`
	EnableTransformation    bool                `json:"enable_transformation"`
	EnableQualityAssessment bool                `json:"enable_quality_assessment"`
	ValidatorConfig         *ValidatorConfig    `json:"validator_config,omitempty"`
	QualityConfig          *QualityConfig      `json:"quality_config,omitempty"`
	BatchSize              int                 `json:"batch_size"`
	MaxConcurrency         int                 `json:"max_concurrency"`
	TimeoutSeconds         int                 `json:"timeout_seconds"`
	RetryAttempts          int                 `json:"retry_attempts"`
}

// ValidationServiceMetrics contains metrics for the validation service
type ValidationServiceMetrics struct {
	TotalProcessed       int64   `json:"total_processed"`
	TotalValidated       int64   `json:"total_validated"`
	TotalTransformed     int64   `json:"total_transformed"`
	TotalQualityChecked  int64   `json:"total_quality_checked"`
	ValidationErrors     int64   `json:"validation_errors"`
	TransformationErrors int64   `json:"transformation_errors"`
	QualityIssues        int64   `json:"quality_issues"`
	AverageProcessingTime float64 `json:"average_processing_time_ms"`
	LastProcessedTime    time.Time `json:"last_processed_time"`
}

// ProcessingResult contains the result of data processing
type ProcessingResult struct {
	Success            bool                   `json:"success"`
	ProcessedData      *protocol.DataValue    `json:"processed_data"`
	ValidationResult   *ValidationResult      `json:"validation_result,omitempty"`
	TransformationResult *TransformationResult `json:"transformation_result,omitempty"`
	QualityResult      *QualityResult         `json:"quality_result,omitempty"`
	ProcessingTime     time.Duration          `json:"processing_time"`
	Errors             []string               `json:"errors,omitempty"`
}

// NewValidationService creates a new validation service
func NewValidationService(logger *logger.Logger, config *ValidationServiceConfig) *ValidationService {
	if config == nil {
		config = &ValidationServiceConfig{
			EnableValidation:        true,
			EnableTransformation:    true,
			EnableQualityAssessment: true,
			BatchSize:              100,
			MaxConcurrency:         10,
			TimeoutSeconds:         30,
			RetryAttempts:          3,
		}
	}

	service := &ValidationService{
		logger:  logger.WithGroup("validation_service"),
		config:  config,
		metrics: &ValidationServiceMetrics{},
		enabled: true,
	}

	// Initialize components
	if config.EnableValidation {
		service.validator = NewDataValidator(logger, config.ValidatorConfig)
	}

	if config.EnableTransformation {
		service.transformer = NewDataTransformer(logger)
	}

	if config.EnableQualityAssessment {
		service.qualityAssessment = NewQualityAssessment(logger, config.QualityConfig)
	}

	service.logger.Info("Validation service initialized",
		"validation_enabled", config.EnableValidation,
		"transformation_enabled", config.EnableTransformation,
		"quality_assessment_enabled", config.EnableQualityAssessment)

	return service
}

// ProcessDataValue processes a single data value through the validation pipeline
func (vs *ValidationService) ProcessDataValue(dataValue *protocol.DataValue) ProcessingResult {
	startTime := time.Now()
	vs.mu.Lock()
	vs.metrics.TotalProcessed++
	vs.mu.Unlock()

	result := ProcessingResult{
		Success:       true,
		ProcessedData: dataValue,
		Errors:        make([]string, 0),
	}

	if !vs.enabled {
		result.ProcessingTime = time.Since(startTime)
		return result
	}

	// Create a copy of the data value to avoid modifying the original
	processedData := *dataValue

	// Step 1: Data Validation
	if vs.config.EnableValidation && vs.validator != nil {
		validationResult := vs.validator.ValidateDataValue(&processedData)
		result.ValidationResult = &validationResult

		vs.mu.Lock()
		vs.metrics.TotalValidated++
		if !validationResult.IsValid {
			vs.metrics.ValidationErrors++
			result.Success = false
			for _, err := range validationResult.Errors {
				result.Errors = append(result.Errors, fmt.Sprintf("Validation error: %s", err.Message))
			}
		}
		vs.mu.Unlock()

		vs.logger.Debug("Data validation completed",
			"point", dataValue.PointName,
			"valid", validationResult.IsValid,
			"quality", validationResult.Quality,
			"errors", len(validationResult.Errors))
	}

	// Step 2: Data Transformation (only if validation passed or is disabled)
	if vs.config.EnableTransformation && vs.transformer != nil && result.Success {
		transformationResult := vs.transformer.TransformDataValue(&processedData)
		result.TransformationResult = &transformationResult

		vs.mu.Lock()
		vs.metrics.TotalTransformed++
		if !transformationResult.Success {
			vs.metrics.TransformationErrors++
			result.Success = false
			result.Errors = append(result.Errors, transformationResult.Errors...)
		}
		vs.mu.Unlock()

		vs.logger.Debug("Data transformation completed",
			"point", dataValue.PointName,
			"success", transformationResult.Success,
			"rules_applied", len(transformationResult.AppliedRules))
	}

	// Step 3: Quality Assessment
	if vs.config.EnableQualityAssessment && vs.qualityAssessment != nil {
		qualityResult := vs.qualityAssessment.AssessDataQuality(&processedData)
		result.QualityResult = &qualityResult

		vs.mu.Lock()
		vs.metrics.TotalQualityChecked++
		if len(qualityResult.Issues) > 0 {
			vs.metrics.QualityIssues++
		}
		vs.mu.Unlock()

		// Update data value quality based on assessment
		processedData.Quality = qualityResult.OverallQuality

		vs.logger.Debug("Quality assessment completed",
			"point", dataValue.PointName,
			"quality_score", qualityResult.QualityScore,
			"overall_quality", qualityResult.OverallQuality,
			"issues", len(qualityResult.Issues))
	}

	result.ProcessedData = &processedData
	result.ProcessingTime = time.Since(startTime)

	// Update metrics
	vs.mu.Lock()
	vs.metrics.LastProcessedTime = time.Now()
	vs.updateAverageProcessingTime(result.ProcessingTime)
	vs.mu.Unlock()

	return result
}

// ProcessDataBatch processes a batch of data values
func (vs *ValidationService) ProcessDataBatch(dataValues []protocol.DataValue) []ProcessingResult {
	if len(dataValues) == 0 {
		return []ProcessingResult{}
	}

	results := make([]ProcessingResult, len(dataValues))
	
	// Process in batches to control memory usage
	batchSize := vs.config.BatchSize
	if batchSize <= 0 {
		batchSize = 100
	}

	for i := 0; i < len(dataValues); i += batchSize {
		end := i + batchSize
		if end > len(dataValues) {
			end = len(dataValues)
		}

		// Process batch
		vs.processBatch(dataValues[i:end], results[i:end])
	}

	return results
}

// processBatch processes a single batch of data values
func (vs *ValidationService) processBatch(batch []protocol.DataValue, results []ProcessingResult) {
	// Use goroutines for concurrent processing if enabled
	if vs.config.MaxConcurrency > 1 {
		vs.processBatchConcurrent(batch, results)
	} else {
		vs.processBatchSequential(batch, results)
	}
}

// processBatchSequential processes batch sequentially
func (vs *ValidationService) processBatchSequential(batch []protocol.DataValue, results []ProcessingResult) {
	for i, dataValue := range batch {
		results[i] = vs.ProcessDataValue(&dataValue)
	}
}

// processBatchConcurrent processes batch concurrently
func (vs *ValidationService) processBatchConcurrent(batch []protocol.DataValue, results []ProcessingResult) {
	semaphore := make(chan struct{}, vs.config.MaxConcurrency)
	var wg sync.WaitGroup

	for i, dataValue := range batch {
		wg.Add(1)
		go func(index int, dv protocol.DataValue) {
			defer wg.Done()
			semaphore <- struct{}{} // Acquire
			defer func() { <-semaphore }() // Release

			results[index] = vs.ProcessDataValue(&dv)
		}(i, dataValue)
	}

	wg.Wait()
}

// AddValidationRule adds a validation rule
func (vs *ValidationService) AddValidationRule(dataType string, rule ValidationRule) error {
	if vs.validator == nil {
		return fmt.Errorf("validation is not enabled")
	}
	
	vs.validator.AddRule(dataType, rule)
	return nil
}

// RemoveValidationRule removes a validation rule
func (vs *ValidationService) RemoveValidationRule(dataType string, ruleName string) error {
	if vs.validator == nil {
		return fmt.Errorf("validation is not enabled")
	}
	
	vs.validator.RemoveRule(dataType, ruleName)
	return nil
}

// AddTransformation adds a transformation configuration
func (vs *ValidationService) AddTransformation(key string, config TransformationConfig) error {
	if vs.transformer == nil {
		return fmt.Errorf("transformation is not enabled")
	}
	
	vs.transformer.AddTransformation(key, config)
	return nil
}

// RemoveTransformation removes a transformation configuration
func (vs *ValidationService) RemoveTransformation(key string) error {
	if vs.transformer == nil {
		return fmt.Errorf("transformation is not enabled")
	}
	
	vs.transformer.RemoveTransformation(key)
	return nil
}

// Enable enables the validation service
func (vs *ValidationService) Enable() {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	vs.enabled = true
	vs.logger.Info("Validation service enabled")
}

// Disable disables the validation service
func (vs *ValidationService) Disable() {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	vs.enabled = false
	vs.logger.Info("Validation service disabled")
}

// IsEnabled returns whether the validation service is enabled
func (vs *ValidationService) IsEnabled() bool {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.enabled
}

// GetMetrics returns validation service metrics
func (vs *ValidationService) GetMetrics() ValidationServiceMetrics {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return *vs.metrics
}

// GetDetailedMetrics returns detailed metrics from all components
func (vs *ValidationService) GetDetailedMetrics() map[string]interface{} {
	metrics := make(map[string]interface{})
	
	vs.mu.RLock()
	metrics["service"] = *vs.metrics
	vs.mu.RUnlock()

	if vs.validator != nil {
		metrics["validator"] = vs.validator.GetMetrics()
	}

	if vs.qualityAssessment != nil {
		metrics["quality"] = vs.qualityAssessment.GetMetrics()
	}

	return metrics
}

// ResetMetrics resets all metrics
func (vs *ValidationService) ResetMetrics() {
	vs.mu.Lock()
	vs.metrics = &ValidationServiceMetrics{}
	vs.mu.Unlock()

	if vs.validator != nil {
		vs.validator.ResetMetrics()
	}

	if vs.qualityAssessment != nil {
		vs.qualityAssessment.ResetMetrics()
	}

	vs.logger.Info("Validation service metrics reset")
}

// updateAverageProcessingTime updates the average processing time
func (vs *ValidationService) updateAverageProcessingTime(processingTime time.Duration) {
	processingTimeMs := float64(processingTime.Nanoseconds()) / 1e6
	
	if vs.metrics.AverageProcessingTime == 0 {
		vs.metrics.AverageProcessingTime = processingTimeMs
	} else {
		// Use exponential moving average
		alpha := 0.1
		vs.metrics.AverageProcessingTime = alpha*processingTimeMs + (1-alpha)*vs.metrics.AverageProcessingTime
	}
}

// GetConfig returns the current configuration
func (vs *ValidationService) GetConfig() ValidationServiceConfig {
	return *vs.config
}

// UpdateConfig updates the service configuration
func (vs *ValidationService) UpdateConfig(config *ValidationServiceConfig) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
	}

	vs.mu.Lock()
	defer vs.mu.Unlock()

	vs.config = config

	// Reinitialize components if needed
	if config.EnableValidation && vs.validator == nil {
		vs.validator = NewDataValidator(vs.logger, config.ValidatorConfig)
	} else if !config.EnableValidation {
		vs.validator = nil
	}

	if config.EnableTransformation && vs.transformer == nil {
		vs.transformer = NewDataTransformer(vs.logger)
	} else if !config.EnableTransformation {
		vs.transformer = nil
	}

	if config.EnableQualityAssessment && vs.qualityAssessment == nil {
		vs.qualityAssessment = NewQualityAssessment(vs.logger, config.QualityConfig)
	} else if !config.EnableQualityAssessment {
		vs.qualityAssessment = nil
	}

	vs.logger.Info("Validation service configuration updated",
		"validation_enabled", config.EnableValidation,
		"transformation_enabled", config.EnableTransformation,
		"quality_assessment_enabled", config.EnableQualityAssessment)

	return nil
}

// HealthCheck performs a health check on the validation service
func (vs *ValidationService) HealthCheck() map[string]interface{} {
	health := map[string]interface{}{
		"enabled": vs.enabled,
		"components": map[string]bool{
			"validator":          vs.validator != nil,
			"transformer":        vs.transformer != nil,
			"quality_assessment": vs.qualityAssessment != nil,
		},
		"metrics": vs.GetMetrics(),
		"last_activity": vs.metrics.LastProcessedTime,
	}

	return health
}