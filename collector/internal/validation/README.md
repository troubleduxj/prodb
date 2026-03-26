# Data Validation and Quality Control Framework

This package implements a comprehensive data validation and quality control framework for the ProDB collector system. It addresses requirements **2.7** (data format validation) and **10.2** (performance requirements for 1000+ data points/second).

## Overview

The validation framework provides:

- **Data Validation**: Range checks, format validation, type consistency
- **Data Transformation**: Unit conversion, value mapping, data standardization  
- **Quality Assessment**: Completeness, consistency, accuracy, timeliness evaluation
- **Anomaly Detection**: Statistical outlier detection using multiple methods
- **Protocol-Specific Validation**: Modbus, OPC-UA, MQTT protocol validation
- **Performance Monitoring**: Processing time and throughput monitoring
- **Configuration Management**: JSON-based configuration with hot reloading

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ ValidationService│    │   DataValidator  │    │ ValidationRules │
│                 │────│                  │────│                 │
│ - ProcessData   │    │ - ValidateValue  │    │ - RangeRule     │
│ - BatchProcess  │    │ - ApplyRules     │    │ - FormatRule    │
│ - Metrics       │    │ - Metrics        │    │ - RegexRule     │
└─────────────────┘    └──────────────────┘    │ - StatisticalRule│
         │                       │              │ - BusinessRule  │
         │                       │              └─────────────────┘
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ DataTransformer │    │ QualityAssessment│
│                 │    │                  │
│ - Transform     │    │ - AssessQuality  │
│ - UnitConvert   │    │ - OutlierDetect  │
│ - ValueMapping  │    │ - HistoryManager │
└─────────────────┘    └──────────────────┘
```

## Core Components

### 1. ValidationService

The main orchestrator that coordinates all validation components:

```go
service := validation.NewValidationService(logger, config)
result := service.ProcessDataValue(&dataValue)
```

### 2. DataValidator

Applies validation rules to data values:

```go
validator := validation.NewDataValidator(logger, config)
result := validator.ValidateDataValue(&dataValue)
```

### 3. DataTransformer

Handles data transformation and standardization:

```go
transformer := validation.NewDataTransformer(logger)
result := transformer.TransformDataValue(&dataValue)
```

### 4. QualityAssessment

Evaluates data quality across multiple dimensions:

```go
quality := validation.NewQualityAssessment(logger, config)
result := quality.AssessDataQuality(&dataValue)
```

## Validation Rules

### Built-in Rules

1. **NullValueRule** - Validates against null/empty values
2. **RangeRule** - Validates numeric values within specified ranges
3. **TimestampRule** - Validates timestamp reasonableness
4. **StringFormatRule** - Validates string format and length
5. **BooleanRule** - Validates and converts boolean values
6. **DataTypeConsistencyRule** - Ensures type consistency
7. **AnomalyDetectionRule** - Statistical outlier detection

### Advanced Rules

1. **DataIntegrityRule** - Detects data corruption
2. **ProtocolSpecificRule** - Protocol-specific validation (Modbus, OPC-UA, MQTT)
3. **PerformanceRule** - Monitors processing performance
4. **BusinessLogicRule** - Custom business logic validation
5. **RegexRule** - Regular expression pattern matching
6. **StatisticalRule** - Advanced statistical analysis (Z-score, IQR, Grubbs test)

### Custom Rules

Implement the `ValidationRule` interface:

```go
type CustomRule struct {
    name        string
    description string
}

func (r *CustomRule) Validate(value interface{}, context ValidationContext) ValidationResult {
    // Custom validation logic
    return ValidationResult{IsValid: true, Quality: 1}
}

func (r *CustomRule) GetName() string { return r.name }
func (r *CustomRule) GetDescription() string { return r.description }
```

## Data Transformation

### Unit Conversion

```go
// Temperature: Celsius to Fahrenheit
transform := TransformationConfig{
    ScaleFactor: 1.8,
    Offset:      32,
    UnitConversion: &UnitConversionConfig{
        SourceUnit: "°C",
        TargetUnit: "°F",
        Factor:     1.8,
        Offset:     32,
    },
    Precision: 2,
}
```

### Value Mapping

```go
// Status code mapping
transform := TransformationConfig{
    ValueMapping: map[string]interface{}{
        "1": "RUNNING",
        "0": "STOPPED",
        "2": "MAINTENANCE",
    },
}
```

## Quality Assessment

The framework evaluates data quality across four dimensions:

1. **Completeness** - Percentage of non-null values
2. **Consistency** - Data type and value consistency over time
3. **Accuracy** - Correctness based on quality flags and validation
4. **Timeliness** - Age of data relative to collection time

Quality scores range from 0.0 (poor) to 1.0 (excellent).

## Configuration

### JSON Configuration

```json
{
  "version": "1.0.0",
  "enabled": true,
  "rules": [
    {
      "name": "temperature_range",
      "type": "range",
      "data_types": ["temperature"],
      "enabled": true,
      "parameters": {
        "min": -40.0,
        "max": 125.0
      }
    }
  ],
  "transforms": [
    {
      "name": "status_mapping",
      "point_pattern": "*_status",
      "enabled": true,
      "transform": {
        "value_mapping": {
          "1": "RUNNING",
          "0": "STOPPED"
        }
      }
    }
  ]
}
```

### Loading Configuration

```go
manager := validation.NewValidationConfigManager("config.json")
err := manager.LoadConfig()
if err != nil {
    log.Fatal(err)
}

service := validation.NewValidationService(logger, nil)
err = manager.ApplyConfigToService(service)
```

## Performance Requirements

The framework is designed to meet **requirement 10.2**:

- **Target**: 1000+ data points per second
- **Processing Time**: < 10ms per data point
- **Memory Usage**: Optimized with configurable history limits
- **Concurrency**: Supports concurrent batch processing

### Performance Monitoring

```go
// Built-in performance rule
rule := validation.NewPerformanceRule(
    10*time.Millisecond,  // Max processing time
    1000,                 // Max data points/sec
)
```

## Protocol-Specific Validation

### Modbus Validation

```go
rules := map[string]interface{}{
    "validate_ranges": true,
}
rule := validation.NewProtocolSpecificRule("modbus", rules)

// Validates:
// - INT16 range: -32768 to 32767
// - UINT16 range: 0 to 65535
// - Register type consistency
```

### OPC-UA Validation

```go
rules := map[string]interface{}{
    "check_status_codes": true,
}
rule := validation.NewProtocolSpecificRule("opcua", rules)

// Validates:
// - Status code values (Good, Bad, Uncertain)
// - Timestamp consistency
// - Node ID format
```

### MQTT Validation

```go
rules := map[string]interface{}{
    "validate_json": true,
}
rule := validation.NewProtocolSpecificRule("mqtt", rules)

// Validates:
// - JSON payload structure
// - QoS level consistency
// - Topic format
```

## Usage Examples

### Basic Usage

```go
// Create validation service
service := validation.NewValidationService(logger, nil)

// Process single data value
dataValue := protocol.DataValue{
    DeviceID:  "device1",
    PointName: "temperature",
    Value:     25.5,
    DataType:  "float64",
    Timestamp: time.Now(),
}

result := service.ProcessDataValue(&dataValue)
if !result.Success {
    log.Printf("Validation failed: %v", result.Errors)
}
```

### Batch Processing

```go
// Process multiple data values
dataValues := []protocol.DataValue{...}
results := service.ProcessDataBatch(dataValues)

successCount := 0
for _, result := range results {
    if result.Success {
        successCount++
    }
}
```

### Custom Rules

```go
// Add custom temperature range rule
tempRule := validation.NewRangeRule(0, 100)
service.AddValidationRule("temperature", tempRule)

// Add custom transformation
transform := validation.TransformationConfig{
    ScaleFactor: 1.8,
    Offset:      32,
}
service.AddTransformation("celsius_to_fahrenheit", transform)
```

### Metrics and Monitoring

```go
// Get service metrics
metrics := service.GetMetrics()
fmt.Printf("Processed: %d, Errors: %d, Avg Time: %.2fms\n",
    metrics.TotalProcessed,
    metrics.ValidationErrors,
    metrics.AverageProcessingTime)

// Get detailed metrics
detailed := service.GetDetailedMetrics()
validatorMetrics := detailed["validator"].(validation.ValidationMetrics)
qualityMetrics := detailed["quality"].(validation.QualityMetrics)
```

## Error Handling

The framework provides comprehensive error handling:

```go
type ValidationResult struct {
    IsValid     bool                   `json:"is_valid"`
    Quality     int                    `json:"quality"`
    Errors      []ValidationError      `json:"errors"`
    Warnings    []ValidationWarning    `json:"warnings"`
    Transformed interface{}            `json:"transformed"`
    Metadata    map[string]interface{} `json:"metadata"`
}
```

### Error Types

- **null_value** - Value is null or empty
- **range_violation** - Value outside valid range
- **type_mismatch** - Data type inconsistency
- **format_error** - Invalid format
- **business_rule_violation** - Business logic violation
- **statistical_outlier** - Statistical anomaly detected

## Testing

Run the test suite:

```bash
# Run all validation tests
go test ./internal/validation -v

# Run specific test
go test ./internal/validation -run TestValidationService -v

# Run benchmarks
go test ./internal/validation -bench=. -v
```

## Best Practices

1. **Configure Appropriate Thresholds**: Set validation ranges based on sensor specifications
2. **Monitor Performance**: Use built-in performance monitoring for requirement 10.2
3. **Handle Errors Gracefully**: Log validation errors but continue processing other data
4. **Use Quality Scores**: Implement quality-based data filtering in downstream systems
5. **Regular Configuration Updates**: Update validation rules as system requirements evolve
6. **Batch Processing**: Use batch processing for better performance with high data volumes

## Requirements Compliance

### Requirement 2.7
> "WHEN 采集到的数据格式不正确 THEN 采集器 SHALL 记录数据验证错误并继续处理其他数据"

**Implementation**: 
- Comprehensive format validation rules
- Error logging with detailed error information
- Graceful error handling that continues processing
- Validation metrics tracking

### Requirement 10.2  
> "WHEN 单个采集器每秒采集1000个数据点 THEN 系统 SHALL 能够稳定处理而不丢失数据"

**Implementation**:
- Performance monitoring with configurable thresholds
- Concurrent batch processing support
- Optimized validation algorithms
- Memory-efficient data structures
- Processing time < 10ms per data point target

## Future Enhancements

1. **Machine Learning Integration**: Adaptive anomaly detection
2. **Real-time Alerting**: Integration with alerting systems
3. **Data Lineage**: Track data transformation history
4. **Advanced Analytics**: Trend analysis and prediction
5. **Configuration UI**: Web-based configuration management