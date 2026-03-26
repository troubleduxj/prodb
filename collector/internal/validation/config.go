package validation

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"time"
)

// ValidationConfig represents the complete validation configuration
type ValidationConfig struct {
	Version     string                    `json:"version"`
	Enabled     bool                      `json:"enabled"`
	Rules       []RuleConfig              `json:"rules"`
	Transforms  []TransformConfig         `json:"transforms"`
	Quality     QualityAssessmentConfig   `json:"quality"`
	Performance PerformanceConfig         `json:"performance"`
	Protocols   map[string]ProtocolConfig `json:"protocols"`
}

// RuleConfig represents configuration for a validation rule
type RuleConfig struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // "range", "format", "regex", "business", "statistical", etc.
	DataTypes   []string               `json:"data_types"`
	Enabled     bool                   `json:"enabled"`
	Parameters  map[string]interface{} `json:"parameters"`
	Description string                 `json:"description"`
}

// TransformConfig represents configuration for data transformation
type TransformConfig struct {
	Name         string                 `json:"name"`
	PointPattern string                 `json:"point_pattern"` // Pattern to match point names
	Enabled      bool                   `json:"enabled"`
	Transform    TransformationConfig   `json:"transform"`
	Description  string                 `json:"description"`
}

// QualityAssessmentConfig represents quality assessment configuration
type QualityAssessmentConfig struct {
	Enabled                bool                   `json:"enabled"`
	CompletenessThreshold  float64                `json:"completeness_threshold"`
	ConsistencyThreshold   float64                `json:"consistency_threshold"`
	AccuracyThreshold      float64                `json:"accuracy_threshold"`
	TimelinessThreshold    int64                  `json:"timeliness_threshold"`
	OutlierDetection       OutlierDetectionConfig `json:"outlier_detection"`
	HistorySize           int                    `json:"history_size"`
}

// OutlierDetectionConfig represents outlier detection configuration
type OutlierDetectionConfig struct {
	Enabled   bool    `json:"enabled"`
	Method    string  `json:"method"`    // "zscore", "iqr", "isolation"
	Threshold float64 `json:"threshold"`
}

// PerformanceConfig represents performance monitoring configuration
type PerformanceConfig struct {
	Enabled                bool          `json:"enabled"`
	MaxProcessingTime      time.Duration `json:"max_processing_time"`
	MaxDataPointsPerSecond int           `json:"max_data_points_per_second"`
	MonitoringWindow       time.Duration `json:"monitoring_window"`
}

// ProtocolConfig represents protocol-specific validation configuration
type ProtocolConfig struct {
	Enabled bool                   `json:"enabled"`
	Rules   map[string]interface{} `json:"rules"`
}

// ValidationConfigManager manages validation configuration
type ValidationConfigManager struct {
	config     *ValidationConfig
	configPath string
}

// NewValidationConfigManager creates a new validation configuration manager
func NewValidationConfigManager(configPath string) *ValidationConfigManager {
	return &ValidationConfigManager{
		configPath: configPath,
	}
}

// LoadConfig loads validation configuration from file
func (vcm *ValidationConfigManager) LoadConfig() error {
	data, err := ioutil.ReadFile(vcm.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	var config ValidationConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	vcm.config = &config
	return nil
}

// SaveConfig saves validation configuration to file
func (vcm *ValidationConfigManager) SaveConfig() error {
	if vcm.config == nil {
		return fmt.Errorf("no config to save")
	}

	data, err := json.MarshalIndent(vcm.config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := ioutil.WriteFile(vcm.configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}

	return nil
}

// GetConfig returns the current configuration
func (vcm *ValidationConfigManager) GetConfig() *ValidationConfig {
	return vcm.config
}

// SetConfig sets the configuration
func (vcm *ValidationConfigManager) SetConfig(config *ValidationConfig) {
	vcm.config = config
}

// ApplyConfigToService applies the configuration to a validation service
func (vcm *ValidationConfigManager) ApplyConfigToService(service *ValidationService) error {
	if vcm.config == nil {
		return fmt.Errorf("no config loaded")
	}

	// Apply rules
	for _, ruleConfig := range vcm.config.Rules {
		if !ruleConfig.Enabled {
			continue
		}

		rule, err := vcm.createRuleFromConfig(ruleConfig)
		if err != nil {
			return fmt.Errorf("failed to create rule %s: %v", ruleConfig.Name, err)
		}

		for _, dataType := range ruleConfig.DataTypes {
			if err := service.AddValidationRule(dataType, rule); err != nil {
				return fmt.Errorf("failed to add rule %s for type %s: %v", ruleConfig.Name, dataType, err)
			}
		}
	}

	// Apply transformations
	for _, transformConfig := range vcm.config.Transforms {
		if !transformConfig.Enabled {
			continue
		}

		if err := service.AddTransformation(transformConfig.PointPattern, transformConfig.Transform); err != nil {
			return fmt.Errorf("failed to add transformation %s: %v", transformConfig.Name, err)
		}
	}

	return nil
}

// createRuleFromConfig creates a validation rule from configuration
func (vcm *ValidationConfigManager) createRuleFromConfig(config RuleConfig) (ValidationRule, error) {
	switch config.Type {
	case "range":
		min, ok1 := config.Parameters["min"].(float64)
		max, ok2 := config.Parameters["max"].(float64)
		if !ok1 || !ok2 {
			return nil, fmt.Errorf("range rule requires min and max parameters")
		}
		return NewRangeRule(min, max), nil

	case "regex":
		pattern, ok1 := config.Parameters["pattern"].(string)
		mustMatch, ok2 := config.Parameters["must_match"].(bool)
		if !ok1 {
			return nil, fmt.Errorf("regex rule requires pattern parameter")
		}
		if !ok2 {
			mustMatch = true // Default to must match
		}
		return NewRegexRule(pattern, mustMatch)

	case "statistical":
		method, ok1 := config.Parameters["method"].(string)
		threshold, ok2 := config.Parameters["threshold"].(float64)
		minSampleSize, ok3 := config.Parameters["min_sample_size"].(float64)
		maxHistorySize, ok4 := config.Parameters["max_history_size"].(float64)
		
		if !ok1 || !ok2 {
			return nil, fmt.Errorf("statistical rule requires method and threshold parameters")
		}
		if !ok3 {
			minSampleSize = 10 // Default
		}
		if !ok4 {
			maxHistorySize = 1000 // Default
		}
		
		return NewStatisticalRule(method, threshold, int(minSampleSize), int(maxHistorySize)), nil

	case "business":
		rulesData, ok := config.Parameters["rules"].([]interface{})
		if !ok {
			return nil, fmt.Errorf("business rule requires rules parameter")
		}
		
		var businessRules []BusinessRule
		for _, ruleData := range rulesData {
			ruleMap, ok := ruleData.(map[string]interface{})
			if !ok {
				continue
			}
			
			businessRule := BusinessRule{
				Name:      getString(ruleMap, "name"),
				Condition: getString(ruleMap, "condition"),
				Action:    getString(ruleMap, "action"),
				Message:   getString(ruleMap, "message"),
				Params:    getMap(ruleMap, "params"),
			}
			businessRules = append(businessRules, businessRule)
		}
		
		return NewBusinessLogicRule(businessRules), nil

	case "protocol":
		protocol, ok1 := config.Parameters["protocol"].(string)
		rules, ok2 := config.Parameters["rules"].(map[string]interface{})
		if !ok1 || !ok2 {
			return nil, fmt.Errorf("protocol rule requires protocol and rules parameters")
		}
		return NewProtocolSpecificRule(protocol, rules), nil

	case "integrity":
		algorithm, ok := config.Parameters["algorithm"].(string)
		if !ok {
			algorithm = "crc32" // Default
		}
		return NewDataIntegrityRule(algorithm), nil

	case "performance":
		maxProcessingTimeMs, ok1 := config.Parameters["max_processing_time_ms"].(float64)
		maxDataPointsPerSec, ok2 := config.Parameters["max_data_points_per_sec"].(float64)
		if !ok1 || !ok2 {
			return nil, fmt.Errorf("performance rule requires max_processing_time_ms and max_data_points_per_sec parameters")
		}
		
		maxProcessingTime := time.Duration(maxProcessingTimeMs) * time.Millisecond
		return NewPerformanceRule(maxProcessingTime, int(maxDataPointsPerSec)), nil

	default:
		return nil, fmt.Errorf("unknown rule type: %s", config.Type)
	}
}

// Helper functions for type conversion
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if val, ok := m[key].(map[string]interface{}); ok {
		return val
	}
	return make(map[string]interface{})
}

// GetDefaultConfig returns a default validation configuration
func GetDefaultConfig() *ValidationConfig {
	return &ValidationConfig{
		Version: "1.0.0",
		Enabled: true,
		Rules: []RuleConfig{
			{
				Name:      "temperature_range",
				Type:      "range",
				DataTypes: []string{"temperature"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"min": -40.0,
					"max": 125.0,
				},
				Description: "Temperature sensor range validation",
			},
			{
				Name:      "pressure_range",
				Type:      "range",
				DataTypes: []string{"pressure"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"min": 0.0,
					"max": 1000.0,
				},
				Description: "Pressure sensor range validation",
			},
			{
				Name:      "device_id_format",
				Type:      "regex",
				DataTypes: []string{"device_id"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"pattern":    `^[A-Z]{2,3}-\d{3,4}$`,
					"must_match": true,
				},
				Description: "Device ID format validation",
			},
			{
				Name:      "temperature_outlier_detection",
				Type:      "statistical",
				DataTypes: []string{"temperature"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"method":           "zscore",
					"threshold":        3.0,
					"min_sample_size":  10.0,
					"max_history_size": 1000.0,
				},
				Description: "Temperature outlier detection using Z-score",
			},
			{
				Name:      "modbus_protocol_validation",
				Type:      "protocol",
				DataTypes: []string{"int16", "uint16", "int32", "uint32"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"protocol": "modbus",
					"rules": map[string]interface{}{
						"validate_ranges": true,
					},
				},
				Description: "Modbus protocol specific validation",
			},
			{
				Name:      "performance_monitoring",
				Type:      "performance",
				DataTypes: []string{"*"},
				Enabled:   true,
				Parameters: map[string]interface{}{
					"max_processing_time_ms": 10.0,
					"max_data_points_per_sec": 1000.0,
				},
				Description: "Performance monitoring for requirement 10.2",
			},
		},
		Transforms: []TransformConfig{
			{
				Name:         "temperature_celsius_to_fahrenheit",
				PointPattern: "*_temperature_c",
				Enabled:      false, // Disabled by default
				Transform: TransformationConfig{
					SourceDataType: "float64",
					TargetDataType: "float64",
					ScaleFactor:    1.8,
					Offset:         32,
					UnitConversion: &UnitConversionConfig{
						SourceUnit: "°C",
						TargetUnit: "°F",
						Factor:     1.8,
						Offset:     32,
					},
					Precision: 2,
				},
				Description: "Convert Celsius to Fahrenheit",
			},
			{
				Name:         "status_value_mapping",
				PointPattern: "*_status",
				Enabled:      true,
				Transform: TransformationConfig{
					ValueMapping: map[string]interface{}{
						"1":     "RUNNING",
						"0":     "STOPPED",
						"true":  "RUNNING",
						"false": "STOPPED",
					},
				},
				Description: "Map status values to readable strings",
			},
		},
		Quality: QualityAssessmentConfig{
			Enabled:               true,
			CompletenessThreshold: 0.95,
			ConsistencyThreshold:  0.90,
			AccuracyThreshold:     0.95,
			TimelinessThreshold:   300, // 5 minutes
			OutlierDetection: OutlierDetectionConfig{
				Enabled:   true,
				Method:    "zscore",
				Threshold: 3.0,
			},
			HistorySize: 100,
		},
		Performance: PerformanceConfig{
			Enabled:                true,
			MaxProcessingTime:      10 * time.Millisecond,
			MaxDataPointsPerSecond: 1000, // Requirement 10.2
			MonitoringWindow:       60 * time.Second,
		},
		Protocols: map[string]ProtocolConfig{
			"modbus": {
				Enabled: true,
				Rules: map[string]interface{}{
					"validate_ranges":     true,
					"check_register_type": true,
				},
			},
			"opcua": {
				Enabled: true,
				Rules: map[string]interface{}{
					"check_status_codes": true,
					"validate_timestamps": true,
				},
			},
			"mqtt": {
				Enabled: true,
				Rules: map[string]interface{}{
					"validate_json":   true,
					"check_qos_level": true,
				},
			},
		},
	}
}

// ValidateConfig validates the configuration for correctness
func ValidateConfig(config *ValidationConfig) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}

	if config.Version == "" {
		return fmt.Errorf("config version is required")
	}

	// Validate rules
	for i, rule := range config.Rules {
		if rule.Name == "" {
			return fmt.Errorf("rule %d: name is required", i)
		}
		if rule.Type == "" {
			return fmt.Errorf("rule %s: type is required", rule.Name)
		}
		if len(rule.DataTypes) == 0 {
			return fmt.Errorf("rule %s: at least one data type is required", rule.Name)
		}
	}

	// Validate transforms
	for i, transform := range config.Transforms {
		if transform.Name == "" {
			return fmt.Errorf("transform %d: name is required", i)
		}
		if transform.PointPattern == "" {
			return fmt.Errorf("transform %s: point_pattern is required", transform.Name)
		}
	}

	// Validate quality thresholds
	if config.Quality.CompletenessThreshold < 0 || config.Quality.CompletenessThreshold > 1 {
		return fmt.Errorf("completeness_threshold must be between 0 and 1")
	}
	if config.Quality.ConsistencyThreshold < 0 || config.Quality.ConsistencyThreshold > 1 {
		return fmt.Errorf("consistency_threshold must be between 0 and 1")
	}
	if config.Quality.AccuracyThreshold < 0 || config.Quality.AccuracyThreshold > 1 {
		return fmt.Errorf("accuracy_threshold must be between 0 and 1")
	}

	// Validate performance settings
	if config.Performance.MaxProcessingTime <= 0 {
		return fmt.Errorf("max_processing_time must be positive")
	}
	if config.Performance.MaxDataPointsPerSecond <= 0 {
		return fmt.Errorf("max_data_points_per_second must be positive")
	}

	return nil
}