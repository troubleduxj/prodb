package validation

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// DataTransformer handles data transformation and standardization
type DataTransformer struct {
	logger            *logger.Logger
	transformationMap map[string]TransformationConfig
	unitConverter     *UnitConverter
}

// TransformationConfig defines transformation rules for data points
type TransformationConfig struct {
	SourceDataType   string                 `json:"source_data_type"`
	TargetDataType   string                 `json:"target_data_type"`
	ScaleFactor      float64                `json:"scale_factor"`
	Offset           float64                `json:"offset"`
	UnitConversion   *UnitConversionConfig  `json:"unit_conversion,omitempty"`
	ValueMapping     map[string]interface{} `json:"value_mapping,omitempty"`
	FormatTemplate   string                 `json:"format_template,omitempty"`
	Precision        int                    `json:"precision"`
	CustomFunction   string                 `json:"custom_function,omitempty"`
}

// UnitConversionConfig defines unit conversion rules
type UnitConversionConfig struct {
	SourceUnit string  `json:"source_unit"`
	TargetUnit string  `json:"target_unit"`
	Factor     float64 `json:"factor"`
	Offset     float64 `json:"offset"`
}

// TransformationResult contains the result of data transformation
type TransformationResult struct {
	Success         bool        `json:"success"`
	TransformedData interface{} `json:"transformed_data"`
	OriginalData    interface{} `json:"original_data"`
	AppliedRules    []string    `json:"applied_rules"`
	Errors          []string    `json:"errors,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// NewDataTransformer creates a new data transformer
func NewDataTransformer(logger *logger.Logger) *DataTransformer {
	transformer := &DataTransformer{
		logger:            logger.WithGroup("transformer"),
		transformationMap: make(map[string]TransformationConfig),
		unitConverter:     NewUnitConverter(),
	}

	// Initialize default transformations
	transformer.initializeDefaultTransformations()

	return transformer
}

// TransformDataValue transforms a single data value
func (dt *DataTransformer) TransformDataValue(dataValue *protocol.DataValue) TransformationResult {
	result := TransformationResult{
		Success:      true,
		OriginalData: dataValue.Value,
		AppliedRules: make([]string, 0),
		Metadata:     make(map[string]interface{}),
	}

	// Get transformation config for this point
	configKey := fmt.Sprintf("%s_%s", dataValue.DeviceID, dataValue.PointName)
	config, exists := dt.transformationMap[configKey]
	if !exists {
		// Try generic config based on data type
		config, exists = dt.transformationMap[dataValue.DataType]
		if !exists {
			// No transformation needed
			result.TransformedData = dataValue.Value
			return result
		}
	}

	// Apply transformations in sequence
	transformedValue := dataValue.Value

	// 1. Data type conversion
	if config.TargetDataType != "" && config.TargetDataType != dataValue.DataType {
		converted, err := dt.convertDataType(transformedValue, config.TargetDataType)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Data type conversion failed: %v", err))
			return result
		}
		transformedValue = converted
		result.AppliedRules = append(result.AppliedRules, "data_type_conversion")
		dataValue.DataType = config.TargetDataType
	}

	// 2. Scale and offset transformation
	if config.ScaleFactor != 0 || config.Offset != 0 {
		scaled, err := dt.applyScaleAndOffset(transformedValue, config.ScaleFactor, config.Offset)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Scale/offset transformation failed: %v", err))
			return result
		}
		transformedValue = scaled
		result.AppliedRules = append(result.AppliedRules, "scale_offset")
		result.Metadata["scale_factor"] = config.ScaleFactor
		result.Metadata["offset"] = config.Offset
	}

	// 3. Unit conversion
	if config.UnitConversion != nil {
		converted, err := dt.unitConverter.Convert(transformedValue, config.UnitConversion)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Unit conversion failed: %v", err))
			return result
		}
		transformedValue = converted
		result.AppliedRules = append(result.AppliedRules, "unit_conversion")
		dataValue.Unit = config.UnitConversion.TargetUnit
		result.Metadata["unit_conversion"] = map[string]string{
			"from": config.UnitConversion.SourceUnit,
			"to":   config.UnitConversion.TargetUnit,
		}
	}

	// 4. Value mapping
	if len(config.ValueMapping) > 0 {
		mapped, err := dt.applyValueMapping(transformedValue, config.ValueMapping)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Value mapping failed: %v", err))
			return result
		}
		transformedValue = mapped
		result.AppliedRules = append(result.AppliedRules, "value_mapping")
	}

	// 5. Precision adjustment
	if config.Precision > 0 {
		adjusted, err := dt.adjustPrecision(transformedValue, config.Precision)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Precision adjustment failed: %v", err))
			return result
		}
		transformedValue = adjusted
		result.AppliedRules = append(result.AppliedRules, "precision_adjustment")
		result.Metadata["precision"] = config.Precision
	}

	// 6. Format template application
	if config.FormatTemplate != "" {
		formatted, err := dt.applyFormatTemplate(transformedValue, config.FormatTemplate)
		if err != nil {
			result.Success = false
			result.Errors = append(result.Errors, fmt.Sprintf("Format template failed: %v", err))
			return result
		}
		transformedValue = formatted
		result.AppliedRules = append(result.AppliedRules, "format_template")
	}

	result.TransformedData = transformedValue

	dt.logger.Debug("Data transformation completed",
		"point", dataValue.PointName,
		"original", result.OriginalData,
		"transformed", result.TransformedData,
		"rules", result.AppliedRules)

	return result
}

// AddTransformation adds a transformation configuration
func (dt *DataTransformer) AddTransformation(key string, config TransformationConfig) {
	dt.transformationMap[key] = config
	dt.logger.Info("Added transformation configuration", "key", key)
}

// RemoveTransformation removes a transformation configuration
func (dt *DataTransformer) RemoveTransformation(key string) {
	delete(dt.transformationMap, key)
	dt.logger.Info("Removed transformation configuration", "key", key)
}

// convertDataType converts value to target data type
func (dt *DataTransformer) convertDataType(value interface{}, targetType string) (interface{}, error) {
	switch targetType {
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
			return strconv.ParseBool(strings.ToLower(strings.TrimSpace(v)))
		case int, int32, int64:
			return v != 0, nil
		case float32, float64:
			return v != 0.0, nil
		default:
			return false, fmt.Errorf("cannot convert %T to bool", value)
		}
	default:
		return value, nil
	}
}

// applyScaleAndOffset applies scale factor and offset to numeric values
func (dt *DataTransformer) applyScaleAndOffset(value interface{}, scale, offset float64) (interface{}, error) {
	numValue, err := convertToFloat64(value)
	if err != nil {
		return nil, fmt.Errorf("cannot apply scale/offset to non-numeric value: %v", err)
	}

	result := numValue
	if scale != 0 {
		result *= scale
	}
	if offset != 0 {
		result += offset
	}

	return result, nil
}

// applyValueMapping applies value mapping transformation
func (dt *DataTransformer) applyValueMapping(value interface{}, mapping map[string]interface{}) (interface{}, error) {
	key := fmt.Sprintf("%v", value)
	if mappedValue, exists := mapping[key]; exists {
		return mappedValue, nil
	}
	
	// If no mapping found, return original value
	return value, nil
}

// adjustPrecision adjusts the precision of numeric values
func (dt *DataTransformer) adjustPrecision(value interface{}, precision int) (interface{}, error) {
	numValue, err := convertToFloat64(value)
	if err != nil {
		return value, nil // Return original value if not numeric
	}

	multiplier := math.Pow(10, float64(precision))
	return math.Round(numValue*multiplier) / multiplier, nil
}

// applyFormatTemplate applies format template to value
func (dt *DataTransformer) applyFormatTemplate(value interface{}, template string) (interface{}, error) {
	// Simple template replacement - can be extended for more complex templates
	result := strings.ReplaceAll(template, "{value}", fmt.Sprintf("%v", value))
	result = strings.ReplaceAll(result, "{timestamp}", time.Now().Format(time.RFC3339))
	
	return result, nil
}

// initializeDefaultTransformations sets up default transformation rules
func (dt *DataTransformer) initializeDefaultTransformations() {
	// Temperature conversions
	dt.AddTransformation("temperature_c_to_f", TransformationConfig{
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
	})

	// Pressure conversions
	dt.AddTransformation("pressure_bar_to_psi", TransformationConfig{
		SourceDataType: "float64",
		TargetDataType: "float64",
		ScaleFactor:    14.5038,
		UnitConversion: &UnitConversionConfig{
			SourceUnit: "bar",
			TargetUnit: "psi",
			Factor:     14.5038,
		},
		Precision: 2,
	})

	// Boolean value mappings
	dt.AddTransformation("bool", TransformationConfig{
		ValueMapping: map[string]interface{}{
			"1":       true,
			"0":       false,
			"true":    true,
			"false":   false,
			"on":      true,
			"off":     false,
			"enabled": true,
			"disabled": false,
		},
	})

	dt.logger.Info("Initialized default transformation rules")
}

// UnitConverter handles unit conversions
type UnitConverter struct {
	conversions map[string]map[string]ConversionRule
}

// ConversionRule defines a unit conversion rule
type ConversionRule struct {
	Factor float64 `json:"factor"`
	Offset float64 `json:"offset"`
}

// NewUnitConverter creates a new unit converter
func NewUnitConverter() *UnitConverter {
	uc := &UnitConverter{
		conversions: make(map[string]map[string]ConversionRule),
	}
	uc.initializeConversions()
	return uc
}

// Convert converts a value from one unit to another
func (uc *UnitConverter) Convert(value interface{}, config *UnitConversionConfig) (interface{}, error) {
	numValue, err := convertToFloat64(value)
	if err != nil {
		return nil, fmt.Errorf("cannot convert non-numeric value for unit conversion: %v", err)
	}

	// Check if we have a predefined conversion rule
	if sourceMap, exists := uc.conversions[config.SourceUnit]; exists {
		if rule, exists := sourceMap[config.TargetUnit]; exists {
			result := numValue * rule.Factor + rule.Offset
			return result, nil
		}
	}

	// Use the provided conversion config
	result := numValue * config.Factor + config.Offset
	return result, nil
}

// AddConversion adds a unit conversion rule
func (uc *UnitConverter) AddConversion(sourceUnit, targetUnit string, factor, offset float64) {
	if uc.conversions[sourceUnit] == nil {
		uc.conversions[sourceUnit] = make(map[string]ConversionRule)
	}
	uc.conversions[sourceUnit][targetUnit] = ConversionRule{
		Factor: factor,
		Offset: offset,
	}
}

// initializeConversions sets up common unit conversions
func (uc *UnitConverter) initializeConversions() {
	// Temperature conversions
	uc.AddConversion("°C", "°F", 1.8, 32)
	uc.AddConversion("°F", "°C", 0.5556, -17.7778)
	uc.AddConversion("°C", "K", 1, 273.15)
	uc.AddConversion("K", "°C", 1, -273.15)

	// Pressure conversions
	uc.AddConversion("bar", "psi", 14.5038, 0)
	uc.AddConversion("psi", "bar", 0.0689476, 0)
	uc.AddConversion("Pa", "bar", 0.00001, 0)
	uc.AddConversion("bar", "Pa", 100000, 0)

	// Length conversions
	uc.AddConversion("m", "ft", 3.28084, 0)
	uc.AddConversion("ft", "m", 0.3048, 0)
	uc.AddConversion("mm", "in", 0.0393701, 0)
	uc.AddConversion("in", "mm", 25.4, 0)

	// Flow rate conversions
	uc.AddConversion("m³/h", "gpm", 4.40287, 0)
	uc.AddConversion("gpm", "m³/h", 0.227125, 0)
	uc.AddConversion("l/min", "gpm", 0.264172, 0)
	uc.AddConversion("gpm", "l/min", 3.78541, 0)

	// Power conversions
	uc.AddConversion("kW", "hp", 1.34102, 0)
	uc.AddConversion("hp", "kW", 0.745699, 0)
	uc.AddConversion("W", "BTU/h", 3.41214, 0)
	uc.AddConversion("BTU/h", "W", 0.293071, 0)
}