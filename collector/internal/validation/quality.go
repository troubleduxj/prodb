package validation

import (
	"fmt"
	"math"
	"sort"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// QualityAssessment handles data quality evaluation
type QualityAssessment struct {
	logger         *logger.Logger
	config         *QualityConfig
	metrics        *QualityMetrics
	historyManager *DataHistoryManager
}

// QualityConfig contains quality assessment configuration
type QualityConfig struct {
	EnableCompleteness     bool    `json:"enable_completeness"`
	EnableConsistency      bool    `json:"enable_consistency"`
	EnableAccuracy         bool    `json:"enable_accuracy"`
	EnableTimeliness       bool    `json:"enable_timeliness"`
	CompletenessThreshold  float64 `json:"completeness_threshold"`
	ConsistencyThreshold   float64 `json:"consistency_threshold"`
	AccuracyThreshold      float64 `json:"accuracy_threshold"`
	TimelinessThreshold    int64   `json:"timeliness_threshold"` // seconds
	HistorySize           int     `json:"history_size"`
	OutlierDetectionMethod string  `json:"outlier_detection_method"` // "zscore", "iqr", "isolation"
	OutlierThreshold      float64 `json:"outlier_threshold"`
}

// QualityMetrics tracks quality assessment metrics
type QualityMetrics struct {
	CompletenessScore float64 `json:"completeness_score"`
	ConsistencyScore  float64 `json:"consistency_score"`
	AccuracyScore     float64 `json:"accuracy_score"`
	TimelinessScore   float64 `json:"timeliness_score"`
	OverallScore      float64 `json:"overall_score"`
	TotalAssessments  int64   `json:"total_assessments"`
	QualityIssues     int64   `json:"quality_issues"`
	OutliersDetected  int64   `json:"outliers_detected"`
}

// QualityResult contains the result of quality assessment
type QualityResult struct {
	OverallQuality   int                    `json:"overall_quality"`    // 0=bad, 1=good, 2=uncertain
	QualityScore     float64                `json:"quality_score"`      // 0.0 to 1.0
	Issues           []QualityIssue         `json:"issues,omitempty"`
	Recommendations  []string               `json:"recommendations,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	AssessmentTime   time.Time              `json:"assessment_time"`
}

// QualityIssue represents a data quality issue
type QualityIssue struct {
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`    // "low", "medium", "high", "critical"
	Description string    `json:"description"`
	Field       string    `json:"field,omitempty"`
	Value       string    `json:"value,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// DataHistoryManager manages historical data for quality assessment
type DataHistoryManager struct {
	history    map[string]*PointHistory
	maxSize    int
	logger     *logger.Logger
}

// PointHistory stores historical data for a specific data point
type PointHistory struct {
	Values     []HistoricalValue `json:"values"`
	Statistics *StatisticalData  `json:"statistics"`
	LastUpdate time.Time         `json:"last_update"`
}

// HistoricalValue represents a historical data value
type HistoricalValue struct {
	Value     interface{} `json:"value"`
	Quality   int         `json:"quality"`
	Timestamp time.Time   `json:"timestamp"`
}

// StatisticalData contains statistical information about historical data
type StatisticalData struct {
	Mean       float64   `json:"mean"`
	Median     float64   `json:"median"`
	StdDev     float64   `json:"std_dev"`
	Min        float64   `json:"min"`
	Max        float64   `json:"max"`
	Count      int       `json:"count"`
	LastUpdate time.Time `json:"last_update"`
}

// NewQualityAssessment creates a new quality assessment instance
func NewQualityAssessment(logger *logger.Logger, config *QualityConfig) *QualityAssessment {
	if config == nil {
		config = &QualityConfig{
			EnableCompleteness:     true,
			EnableConsistency:      true,
			EnableAccuracy:         true,
			EnableTimeliness:       true,
			CompletenessThreshold:  0.95,
			ConsistencyThreshold:   0.90,
			AccuracyThreshold:      0.95,
			TimelinessThreshold:    300, // 5 minutes
			HistorySize:           100,
			OutlierDetectionMethod: "zscore",
			OutlierThreshold:      3.0,
		}
	}

	return &QualityAssessment{
		logger:         logger.WithGroup("quality"),
		config:         config,
		metrics:        &QualityMetrics{},
		historyManager: NewDataHistoryManager(config.HistorySize, logger),
	}
}

// AssessDataQuality performs comprehensive quality assessment on data value
func (qa *QualityAssessment) AssessDataQuality(dataValue *protocol.DataValue) QualityResult {
	qa.metrics.TotalAssessments++
	
	result := QualityResult{
		OverallQuality:  1, // Start with good quality
		QualityScore:    1.0,
		Issues:          make([]QualityIssue, 0),
		Recommendations: make([]string, 0),
		Metadata:        make(map[string]interface{}),
		AssessmentTime:  time.Now(),
	}

	pointKey := fmt.Sprintf("%s_%s", dataValue.DeviceID, dataValue.PointName)

	// Add current value to history
	qa.historyManager.AddValue(pointKey, dataValue.Value, dataValue.Quality, dataValue.Timestamp)

	// Get historical data for this point
	history := qa.historyManager.GetHistory(pointKey)

	// Perform quality assessments
	scores := make(map[string]float64)

	// 1. Completeness Assessment
	if qa.config.EnableCompleteness {
		completenessScore := qa.assessCompleteness(dataValue, history)
		scores["completeness"] = completenessScore
		if completenessScore < qa.config.CompletenessThreshold {
			result.Issues = append(result.Issues, QualityIssue{
				Type:        "completeness",
				Severity:    qa.getSeverity(completenessScore, qa.config.CompletenessThreshold),
				Description: fmt.Sprintf("Data completeness score %.2f is below threshold %.2f", completenessScore, qa.config.CompletenessThreshold),
				Field:       dataValue.PointName,
				Timestamp:   time.Now(),
			})
		}
	}

	// 2. Consistency Assessment
	if qa.config.EnableConsistency {
		consistencyScore := qa.assessConsistency(dataValue, history)
		scores["consistency"] = consistencyScore
		if consistencyScore < qa.config.ConsistencyThreshold {
			result.Issues = append(result.Issues, QualityIssue{
				Type:        "consistency",
				Severity:    qa.getSeverity(consistencyScore, qa.config.ConsistencyThreshold),
				Description: fmt.Sprintf("Data consistency score %.2f is below threshold %.2f", consistencyScore, qa.config.ConsistencyThreshold),
				Field:       dataValue.PointName,
				Timestamp:   time.Now(),
			})
		}
	}

	// 3. Accuracy Assessment
	if qa.config.EnableAccuracy {
		accuracyScore := qa.assessAccuracy(dataValue, history)
		scores["accuracy"] = accuracyScore
		if accuracyScore < qa.config.AccuracyThreshold {
			result.Issues = append(result.Issues, QualityIssue{
				Type:        "accuracy",
				Severity:    qa.getSeverity(accuracyScore, qa.config.AccuracyThreshold),
				Description: fmt.Sprintf("Data accuracy score %.2f is below threshold %.2f", accuracyScore, qa.config.AccuracyThreshold),
				Field:       dataValue.PointName,
				Timestamp:   time.Now(),
			})
		}
	}

	// 4. Timeliness Assessment
	if qa.config.EnableTimeliness {
		timelinessScore := qa.assessTimeliness(dataValue)
		scores["timeliness"] = timelinessScore
		if timelinessScore < 0.8 { // Fixed threshold for timeliness
			result.Issues = append(result.Issues, QualityIssue{
				Type:        "timeliness",
				Severity:    qa.getSeverity(timelinessScore, 0.8),
				Description: fmt.Sprintf("Data timeliness score %.2f indicates delayed data", timelinessScore),
				Field:       "timestamp",
				Timestamp:   time.Now(),
			})
		}
	}

	// 5. Outlier Detection
	isOutlier, outlierScore := qa.detectOutliers(dataValue, history)
	if isOutlier {
		qa.metrics.OutliersDetected++
		result.Issues = append(result.Issues, QualityIssue{
			Type:        "outlier",
			Severity:    "medium",
			Description: fmt.Sprintf("Value appears to be an outlier (score: %.2f)", outlierScore),
			Field:       dataValue.PointName,
			Value:       fmt.Sprintf("%v", dataValue.Value),
			Timestamp:   time.Now(),
		})
		scores["outlier"] = 1.0 - outlierScore // Invert outlier score
	} else {
		scores["outlier"] = 1.0
	}

	// Calculate overall quality score
	result.QualityScore = qa.calculateOverallScore(scores)
	result.OverallQuality = qa.scoreToQuality(result.QualityScore)

	// Generate recommendations
	result.Recommendations = qa.generateRecommendations(result.Issues)

	// Update metrics
	qa.updateMetrics(result)

	// Add metadata
	result.Metadata["scores"] = scores
	result.Metadata["history_size"] = len(history.Values)
	if history.Statistics != nil {
		result.Metadata["statistics"] = history.Statistics
	}

	qa.logger.Debug("Quality assessment completed",
		"point", dataValue.PointName,
		"quality_score", result.QualityScore,
		"overall_quality", result.OverallQuality,
		"issues", len(result.Issues))

	return result
}

// assessCompleteness evaluates data completeness
func (qa *QualityAssessment) assessCompleteness(dataValue *protocol.DataValue, history *PointHistory) float64 {
	if len(history.Values) == 0 {
		return 1.0 // First value, assume complete
	}

	// Check for null or empty values
	if dataValue.Value == nil {
		return 0.0
	}

	if str, ok := dataValue.Value.(string); ok && str == "" {
		return 0.0
	}

	// Calculate completeness based on expected vs actual data points
	// This is a simplified implementation - in practice, you might compare against expected intervals
	nonNullCount := 0
	totalCount := len(history.Values)

	for _, val := range history.Values {
		if val.Value != nil {
			if str, ok := val.Value.(string); !ok || str != "" {
				nonNullCount++
			}
		}
	}

	if totalCount == 0 {
		return 1.0
	}

	return float64(nonNullCount) / float64(totalCount)
}

// assessConsistency evaluates data consistency
func (qa *QualityAssessment) assessConsistency(dataValue *protocol.DataValue, history *PointHistory) float64 {
	if len(history.Values) < 2 {
		return 1.0 // Need at least 2 values for consistency check
	}

	// Check data type consistency
	currentType := fmt.Sprintf("%T", dataValue.Value)
	consistentTypeCount := 0

	for _, val := range history.Values {
		if fmt.Sprintf("%T", val.Value) == currentType {
			consistentTypeCount++
		}
	}

	typeConsistency := float64(consistentTypeCount) / float64(len(history.Values))

	// Check value range consistency for numeric data
	rangeConsistency := 1.0
	if numValue, err := convertToFloat64(dataValue.Value); err == nil && history.Statistics != nil {
		// Check if value is within reasonable range based on historical data
		if history.Statistics.StdDev > 0 {
			zScore := math.Abs(numValue-history.Statistics.Mean) / history.Statistics.StdDev
			if zScore > 2.0 { // More than 2 standard deviations
				rangeConsistency = math.Max(0.0, 1.0-((zScore-2.0)/4.0)) // Gradually decrease score
			}
		}
	}

	// Combine type and range consistency
	return (typeConsistency + rangeConsistency) / 2.0
}

// assessAccuracy evaluates data accuracy
func (qa *QualityAssessment) assessAccuracy(dataValue *protocol.DataValue, history *PointHistory) float64 {
	// Accuracy assessment is challenging without ground truth
	// We use proxy measures like:
	
	score := 1.0

	// 1. Check if value is within reasonable bounds for the data type
	if numValue, err := convertToFloat64(dataValue.Value); err == nil {
		if math.IsInf(numValue, 0) || math.IsNaN(numValue) {
			score *= 0.0 // Invalid numeric values
		} else if math.Abs(numValue) > 1e10 {
			score *= 0.5 // Suspiciously large values
		}
	}

	// 2. Check quality flag from the source
	switch dataValue.Quality {
	case 0: // Bad quality
		score *= 0.0
	case 1: // Good quality
		score *= 1.0
	case 2: // Uncertain quality
		score *= 0.7
	default:
		score *= 0.5
	}

	// 3. Check for duplicate consecutive values (might indicate stuck sensor)
	if len(history.Values) > 0 {
		lastValue := history.Values[len(history.Values)-1].Value
		if fmt.Sprintf("%v", dataValue.Value) == fmt.Sprintf("%v", lastValue) {
			duplicateCount := 1
			for i := len(history.Values) - 1; i >= 0; i-- {
				if fmt.Sprintf("%v", history.Values[i].Value) == fmt.Sprintf("%v", dataValue.Value) {
					duplicateCount++
				} else {
					break
				}
			}
			if duplicateCount > 5 { // More than 5 consecutive identical values
				score *= math.Max(0.3, 1.0-float64(duplicateCount-5)*0.1)
			}
		}
	}

	return math.Max(0.0, math.Min(1.0, score))
}

// assessTimeliness evaluates data timeliness
func (qa *QualityAssessment) assessTimeliness(dataValue *protocol.DataValue) float64 {
	now := time.Now()
	age := now.Sub(dataValue.Timestamp).Seconds()

	if age < 0 {
		// Future timestamp - suspicious
		return 0.5
	}

	if age <= float64(qa.config.TimelinessThreshold) {
		return 1.0 // Within acceptable time window
	}

	// Gradually decrease score based on age
	maxAge := float64(qa.config.TimelinessThreshold) * 10 // 10x threshold is minimum score
	if age >= maxAge {
		return 0.1 // Minimum score for very old data
	}

	return math.Max(0.1, 1.0-(age-float64(qa.config.TimelinessThreshold))/(maxAge-float64(qa.config.TimelinessThreshold))*0.9)
}

// detectOutliers detects outliers in the data
func (qa *QualityAssessment) detectOutliers(dataValue *protocol.DataValue, history *PointHistory) (bool, float64) {
	numValue, err := convertToFloat64(dataValue.Value)
	if err != nil {
		return false, 0.0 // Can't detect outliers in non-numeric data
	}

	if len(history.Values) < 10 || history.Statistics == nil {
		return false, 0.0 // Need sufficient history for outlier detection
	}

	switch qa.config.OutlierDetectionMethod {
	case "zscore":
		return qa.detectOutliersZScore(numValue, history.Statistics)
	case "iqr":
		return qa.detectOutliersIQR(numValue, history)
	default:
		return qa.detectOutliersZScore(numValue, history.Statistics)
	}
}

// detectOutliersZScore detects outliers using Z-score method
func (qa *QualityAssessment) detectOutliersZScore(value float64, stats *StatisticalData) (bool, float64) {
	if stats.StdDev == 0 {
		return false, 0.0
	}

	zScore := math.Abs(value-stats.Mean) / stats.StdDev
	isOutlier := zScore > qa.config.OutlierThreshold
	
	return isOutlier, zScore / qa.config.OutlierThreshold
}

// detectOutliersIQR detects outliers using Interquartile Range method
func (qa *QualityAssessment) detectOutliersIQR(value float64, history *PointHistory) (bool, float64) {
	values := make([]float64, 0, len(history.Values))
	for _, val := range history.Values {
		if numVal, err := convertToFloat64(val.Value); err == nil {
			values = append(values, numVal)
		}
	}

	if len(values) < 4 {
		return false, 0.0
	}

	sort.Float64s(values)
	
	q1Index := len(values) / 4
	q3Index := 3 * len(values) / 4
	
	q1 := values[q1Index]
	q3 := values[q3Index]
	iqr := q3 - q1
	
	lowerBound := q1 - 1.5*iqr
	upperBound := q3 + 1.5*iqr
	
	isOutlier := value < lowerBound || value > upperBound
	
	// Calculate outlier score
	var score float64
	if value < lowerBound {
		score = (lowerBound - value) / iqr
	} else if value > upperBound {
		score = (value - upperBound) / iqr
	}
	
	return isOutlier, score
}

// calculateOverallScore calculates overall quality score from individual scores
func (qa *QualityAssessment) calculateOverallScore(scores map[string]float64) float64 {
	if len(scores) == 0 {
		return 1.0
	}

	// Weighted average of scores
	weights := map[string]float64{
		"completeness": 0.25,
		"consistency":  0.25,
		"accuracy":     0.30,
		"timeliness":   0.15,
		"outlier":      0.05,
	}

	totalScore := 0.0
	totalWeight := 0.0

	for metric, score := range scores {
		if weight, exists := weights[metric]; exists {
			totalScore += score * weight
			totalWeight += weight
		}
	}

	if totalWeight == 0 {
		return 1.0
	}

	return totalScore / totalWeight
}

// scoreToQuality converts quality score to quality level
func (qa *QualityAssessment) scoreToQuality(score float64) int {
	if score >= 0.8 {
		return 1 // Good quality
	} else if score >= 0.5 {
		return 2 // Uncertain quality
	} else {
		return 0 // Bad quality
	}
}

// getSeverity determines severity level based on score and threshold
func (qa *QualityAssessment) getSeverity(score, threshold float64) string {
	diff := threshold - score
	if diff <= 0.1 {
		return "low"
	} else if diff <= 0.3 {
		return "medium"
	} else if diff <= 0.5 {
		return "high"
	} else {
		return "critical"
	}
}

// generateRecommendations generates recommendations based on quality issues
func (qa *QualityAssessment) generateRecommendations(issues []QualityIssue) []string {
	recommendations := make([]string, 0)
	issueTypes := make(map[string]bool)

	for _, issue := range issues {
		if !issueTypes[issue.Type] {
			issueTypes[issue.Type] = true
			
			switch issue.Type {
			case "completeness":
				recommendations = append(recommendations, "Check data source connectivity and ensure regular data collection")
			case "consistency":
				recommendations = append(recommendations, "Verify data source configuration and check for sensor calibration issues")
			case "accuracy":
				recommendations = append(recommendations, "Validate sensor readings and check for hardware malfunctions")
			case "timeliness":
				recommendations = append(recommendations, "Check network connectivity and reduce data collection intervals")
			case "outlier":
				recommendations = append(recommendations, "Investigate potential sensor issues or environmental factors causing unusual readings")
			}
		}
	}

	return recommendations
}

// updateMetrics updates quality assessment metrics
func (qa *QualityAssessment) updateMetrics(result QualityResult) {
	qa.metrics.OverallScore = (qa.metrics.OverallScore*float64(qa.metrics.TotalAssessments-1) + result.QualityScore) / float64(qa.metrics.TotalAssessments)
	
	if len(result.Issues) > 0 {
		qa.metrics.QualityIssues++
	}

	// Update individual metric scores (simplified)
	if scores, ok := result.Metadata["scores"].(map[string]float64); ok {
		if completeness, exists := scores["completeness"]; exists {
			qa.metrics.CompletenessScore = (qa.metrics.CompletenessScore + completeness) / 2.0
		}
		if consistency, exists := scores["consistency"]; exists {
			qa.metrics.ConsistencyScore = (qa.metrics.ConsistencyScore + consistency) / 2.0
		}
		if accuracy, exists := scores["accuracy"]; exists {
			qa.metrics.AccuracyScore = (qa.metrics.AccuracyScore + accuracy) / 2.0
		}
		if timeliness, exists := scores["timeliness"]; exists {
			qa.metrics.TimelinessScore = (qa.metrics.TimelinessScore + timeliness) / 2.0
		}
	}
}

// GetMetrics returns quality assessment metrics
func (qa *QualityAssessment) GetMetrics() QualityMetrics {
	return *qa.metrics
}

// ResetMetrics resets quality assessment metrics
func (qa *QualityAssessment) ResetMetrics() {
	qa.metrics = &QualityMetrics{}
}

// NewDataHistoryManager creates a new data history manager
func NewDataHistoryManager(maxSize int, logger *logger.Logger) *DataHistoryManager {
	return &DataHistoryManager{
		history: make(map[string]*PointHistory),
		maxSize: maxSize,
		logger:  logger.WithGroup("history"),
	}
}

// AddValue adds a value to the history
func (dhm *DataHistoryManager) AddValue(pointKey string, value interface{}, quality int, timestamp time.Time) {
	if dhm.history[pointKey] == nil {
		dhm.history[pointKey] = &PointHistory{
			Values: make([]HistoricalValue, 0, dhm.maxSize),
		}
	}

	history := dhm.history[pointKey]
	
	// Add new value
	history.Values = append(history.Values, HistoricalValue{
		Value:     value,
		Quality:   quality,
		Timestamp: timestamp,
	})

	// Maintain max size
	if len(history.Values) > dhm.maxSize {
		history.Values = history.Values[1:]
	}

	// Update statistics
	dhm.updateStatistics(pointKey)
	history.LastUpdate = time.Now()
}

// GetHistory returns history for a point
func (dhm *DataHistoryManager) GetHistory(pointKey string) *PointHistory {
	if history, exists := dhm.history[pointKey]; exists {
		return history
	}
	return &PointHistory{Values: make([]HistoricalValue, 0)}
}

// updateStatistics updates statistical data for a point
func (dhm *DataHistoryManager) updateStatistics(pointKey string) {
	history := dhm.history[pointKey]
	if len(history.Values) == 0 {
		return
	}

	// Extract numeric values
	numericValues := make([]float64, 0, len(history.Values))
	for _, val := range history.Values {
		if numVal, err := convertToFloat64(val.Value); err == nil {
			numericValues = append(numericValues, numVal)
		}
	}

	if len(numericValues) == 0 {
		return
	}

	// Calculate statistics
	stats := &StatisticalData{
		Count:      len(numericValues),
		LastUpdate: time.Now(),
	}

	// Calculate mean
	sum := 0.0
	for _, val := range numericValues {
		sum += val
	}
	stats.Mean = sum / float64(len(numericValues))

	// Calculate min and max
	stats.Min = numericValues[0]
	stats.Max = numericValues[0]
	for _, val := range numericValues {
		if val < stats.Min {
			stats.Min = val
		}
		if val > stats.Max {
			stats.Max = val
		}
	}

	// Calculate standard deviation
	sumSquares := 0.0
	for _, val := range numericValues {
		diff := val - stats.Mean
		sumSquares += diff * diff
	}
	if len(numericValues) > 1 {
		stats.StdDev = math.Sqrt(sumSquares / float64(len(numericValues)-1))
	}

	// Calculate median
	sortedValues := make([]float64, len(numericValues))
	copy(sortedValues, numericValues)
	sort.Float64s(sortedValues)
	
	if len(sortedValues)%2 == 0 {
		mid := len(sortedValues) / 2
		stats.Median = (sortedValues[mid-1] + sortedValues[mid]) / 2.0
	} else {
		stats.Median = sortedValues[len(sortedValues)/2]
	}

	history.Statistics = stats
}