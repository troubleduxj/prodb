package main

import (
	"fmt"
	"log"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/validation"
)

func main() {
	// Initialize logger
	loggerInstance, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		log.Fatal("Failed to create logger:", err)
	}

	fmt.Println("=== Data Validation and Quality Control Demo ===")

	// Create validation service
	validationService := validation.NewValidationService(loggerInstance, nil)

	// Add custom validation rules
	tempRule := validation.NewRangeRule(0, 100)
	err = validationService.AddValidationRule("temperature", tempRule)
	if err != nil {
		log.Printf("Error adding temperature rule: %v", err)
	} else {
		fmt.Println("✓ Added temperature range validation rule (0-100°C)")
	}

	// Create test data
	testData := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.0,
			Quality:   1,
			DataType:  "temperature",
			Unit:      "°C",
		},
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     150.0, // Out of range
			Quality:   1,
			DataType:  "temperature",
			Unit:      "°C",
		},
		{
			DeviceID:  "device1",
			PointName: "humidity",
			Timestamp: time.Now(),
			Value:     nil, // Invalid
			Quality:   0,
			DataType:  "float64",
			Unit:      "%",
		},
	}

	// Process data
	fmt.Println("\n--- Processing Results ---")
	for i, dataValue := range testData {
		result := validationService.ProcessDataValue(&dataValue)
		
		fmt.Printf("\nData Point %d: %s.%s\n", i+1, dataValue.DeviceID, dataValue.PointName)
		fmt.Printf("  Value: %v\n", dataValue.Value)
		fmt.Printf("  Success: %v\n", result.Success)
		fmt.Printf("  Quality: %d\n", result.ProcessedData.Quality)
		
		if len(result.Errors) > 0 {
			fmt.Printf("  Errors: %v\n", result.Errors)
		}
	}

	// Display metrics
	fmt.Println("\n--- Metrics ---")
	metrics := validationService.GetMetrics()
	fmt.Printf("Total Processed: %d\n", metrics.TotalProcessed)
	fmt.Printf("Validation Errors: %d\n", metrics.ValidationErrors)

	fmt.Println("\n=== Demo Complete ===")
}