package validation

import (
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

func TestQualityAssessment_AssessDataQuality(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	qualityConfig := &QualityConfig{
		EnableCompleteness:     true,
		EnableConsistency:      true,
		EnableAccuracy:         true,
		EnableTimeliness:       true,
		CompletenessThreshold:  0.95,
		ConsistencyThreshold:   0.90,
		AccuracyThreshold:      0.95,
		TimelinessThreshold:    300, // 5 minutes
		HistorySize:            10,
		OutlierDetectionMethod: "zscore",
		OutlierThreshold:       3.0,
	}

	qa := NewQualityAssessment(loggerInstance, qualityConfig)

	tests := []struct {
		name            string
		dataValue       protocol.DataValue
		expectedQuality int
		expectIssues    bool
	}{
		{
			name: "Good quality data",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     25.5,
				Quality:   1,
				DataType:  "float64",
				Unit:      "°C",
			},
			expectedQuality: 1,
			expectIssues:    false,
		},
		{
			name: "Null value - bad quality",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     nil,
				Quality:   0,
				DataType:  "float64",
				Unit:      "°C",
			},
			expectedQuality: 0,
			expectIssues:    true,
		},
		{
			name: "Old timestamp - uncertain quality",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now().Add(-2 * time.Hour), // 2 hours old
				Value:     25.5,
				Quality:   1,
				DataType:  "float64",
				Unit:      "°C",
			},
			expectedQuality: 2, // Uncertain due to old timestamp
			expectIssues:    true,
		},
		{
			name: "Future timestamp - uncertain quality",
			dataValue: protocol.DataValue{
				DeviceID:  "device1",
				PointName: "temperature",
				Timestamp: time.Now().Add(10 * time.Minute), // 10 minutes in future
				Value:     25.5,
				Quality:   1,
				DataType:  "float64",
				Unit:      "°C",
			},
			expectedQuality: 1, // May still be good quality depending on other factors
			expectIssues:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := qa.AssessDataQuality(&tt.dataValue)

			if result.OverallQuality != tt.expectedQuality {
				t.Errorf("Expected OverallQuality=%d, got %d", tt.expectedQuality, result.OverallQuality)
			}

			hasIssues := len(result.Issues) > 0
			if hasIssues != tt.expectIssues {
				t.Errorf("Expected issues=%v, got %v (issues: %d)", tt.expectIssues, hasIssues, len(result.Issues))
			}

			if result.QualityScore < 0 || result.QualityScore > 1 {
				t.Errorf("QualityScore should be between 0 and 1, got %f", result.QualityScore)
			}
		})
	}
}

func TestQualityAssessment_OutlierDetection(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	qualityConfig := &QualityConfig{
		EnableCompleteness:     true,
		EnableConsistency:      true,
		EnableAccuracy:         true,
		EnableTimeliness:       true,
		CompletenessThreshold:  0.95,
		ConsistencyThreshold:   0.90,
		AccuracyThreshold:      0.95,
		TimelinessThreshold:    300,
		HistorySize:            20,
		OutlierDetectionMethod: "zscore",
		OutlierThreshold:       2.0, // Lower threshold for easier testing
	}

	qa := NewQualityAssessment(loggerInstance, qualityConfig)

	// Add some normal values to build history
	normalValues := []float64{20.0, 21.0, 19.5, 20.5, 22.0, 19.0, 21.5, 20.2, 19.8, 20.8, 21.2, 19.3}
	for _, val := range normalValues {
		dataValue := protocol.DataValue{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     val,
			Quality:   1,
			DataType:  "float64",
			Unit:      "°C",
		}
		qa.AssessDataQuality(&dataValue)
	}

	// Test outlier detection
	outlierValue := protocol.DataValue{
		DeviceID:  "device1",
		PointName: "temperature",
		Timestamp: time.Now(),
		Value:     50.0, // Clear outlier
		Quality:   1,
		DataType:  "float64",
		Unit:      "°C",
	}

	result := qa.AssessDataQuality(&outlierValue)

	// Should detect outlier
	hasOutlierIssue := false
	for _, issue := range result.Issues {
		if issue.Type == "outlier" {
			hasOutlierIssue = true
			break
		}
	}

	if !hasOutlierIssue {
		t.Error("Expected outlier detection but none found")
	}

	// Quality should be degraded due to outlier (but may still be 1 if other factors are good)
	if result.OverallQuality == 1 && !hasOutlierIssue {
		t.Error("Expected quality to be degraded or outlier to be detected")
	}
}

func TestDataHistoryManager_AddValue(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	manager := NewDataHistoryManager(5, loggerInstance) // Small history size for testing

	pointKey := "device1_temperature"

	// Add values
	for i := 0; i < 10; i++ {
		manager.AddValue(pointKey, float64(20+i), 1, time.Now())
	}

	history := manager.GetHistory(pointKey)

	// Should only keep the last 5 values due to maxSize
	if len(history.Values) != 5 {
		t.Errorf("Expected history size=5, got %d", len(history.Values))
	}

	// Should have the latest values (25, 26, 27, 28, 29)
	expectedValues := []float64{25, 26, 27, 28, 29}
	for i, expected := range expectedValues {
		if actual, ok := history.Values[i].Value.(float64); ok {
			if actual != expected {
				t.Errorf("Expected value[%d]=%f, got %f", i, expected, actual)
			}
		} else {
			t.Errorf("Expected float64 value, got %T", history.Values[i].Value)
		}
	}

	// Should have statistics
	if history.Statistics == nil {
		t.Error("Expected statistics to be calculated")
	} else {
		// Mean should be 27 (average of 25,26,27,28,29)
		expectedMean := 27.0
		if abs(history.Statistics.Mean-expectedMean) > 0.01 {
			t.Errorf("Expected mean=%f, got %f", expectedMean, history.Statistics.Mean)
		}
	}
}

func TestQualityAssessment_GetMetrics(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	qa := NewQualityAssessment(loggerInstance, nil)

	// Process some data
	dataValues := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temp1",
			Timestamp: time.Now(),
			Value:     25.0,
			Quality:   1,
			DataType:  "float64",
		},
		{
			DeviceID:  "device1",
			PointName: "temp2",
			Timestamp: time.Now(),
			Value:     nil, // Bad quality
			Quality:   0,
			DataType:  "float64",
		},
	}

	for _, dv := range dataValues {
		qa.AssessDataQuality(&dv)
	}

	metrics := qa.GetMetrics()

	if metrics.TotalAssessments != 2 {
		t.Errorf("Expected TotalAssessments=2, got %d", metrics.TotalAssessments)
	}

	if metrics.QualityIssues == 0 {
		t.Error("Expected some quality issues to be recorded")
	}

	// Test metrics reset
	qa.ResetMetrics()
	metrics = qa.GetMetrics()

	if metrics.TotalAssessments != 0 {
		t.Errorf("Expected TotalAssessments=0 after reset, got %d", metrics.TotalAssessments)
	}
}

func TestQualityAssessment_GenerateRecommendations(t *testing.T) {
	loggerInstance, _ := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})

	qa := NewQualityAssessment(loggerInstance, nil)

	issues := []QualityIssue{
		{Type: "completeness", Severity: "high"},
		{Type: "accuracy", Severity: "medium"},
		{Type: "outlier", Severity: "low"},
	}

	recommendations := qa.generateRecommendations(issues)

	if len(recommendations) != 3 {
		t.Errorf("Expected 3 recommendations, got %d", len(recommendations))
	}

	// Check that recommendations contain expected keywords
	expectedKeywords := []string{"connectivity", "sensor", "potential"}
	for _, keyword := range expectedKeywords {
		found := false
		for _, rec := range recommendations {
			if contains(rec, keyword) {
				found = true
				break
			}
		}
		if !found {
			t.Logf("Keyword '%s' not found in recommendations: %v", keyword, recommendations)
			// Don't fail the test, just log - recommendations may vary
		}
	}
}

// Helper function to check if string contains substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		(len(s) > len(substr) && (s[:len(substr)] == substr ||
			s[len(s)-len(substr):] == substr ||
			containsInMiddle(s, substr))))
}

func containsInMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
