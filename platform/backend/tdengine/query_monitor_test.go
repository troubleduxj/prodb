package tdengine

import (
	"errors"
	"testing"
	"time"
)

func TestQueryMonitor_GenerateQueryID(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	id1 := monitor.GenerateQueryID()
	id2 := monitor.GenerateQueryID()

	if id1 == "" {
		t.Errorf("GenerateQueryID() expected non-empty ID, got empty string")
	}

	if id1 == id2 {
		t.Errorf("GenerateQueryID() expected unique IDs, got duplicate: %s", id1)
	}

	if len(id1) < 10 {
		t.Errorf("GenerateQueryID() expected ID length >= 10, got %d", len(id1))
	}
}

func TestQueryMonitor_StartEndQuery(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	queryID := monitor.GenerateQueryID()
	sql := "SELECT * FROM test_table"

	// Start query
	monitor.StartQuery(queryID, "SQL", sql)

	// Get execution record
	execution := monitor.GetQueryExecution(queryID)
	if execution == nil {
		t.Errorf("GetQueryExecution() expected execution record, got nil")
	}

	if execution.ID != queryID {
		t.Errorf("GetQueryExecution() ID = %s, want %s", execution.ID, queryID)
	}

	if execution.Type != "SQL" {
		t.Errorf("GetQueryExecution() Type = %s, want SQL", execution.Type)
	}

	if execution.SQL != sql {
		t.Errorf("GetQueryExecution() SQL = %s, want %s", execution.SQL, sql)
	}

	if execution.Status != "RUNNING" {
		t.Errorf("GetQueryExecution() Status = %s, want RUNNING", execution.Status)
	}

	// End query
	time.Sleep(10 * time.Millisecond) // Small delay to ensure duration > 0
	monitor.EndQuery(queryID)

	// Check updated execution
	execution = monitor.GetQueryExecution(queryID)
	if execution.Status != "SUCCESS" {
		t.Errorf("GetQueryExecution() Status after end = %s, want SUCCESS", execution.Status)
	}

	if execution.Duration <= 0 {
		t.Errorf("GetQueryExecution() Duration = %v, want > 0", execution.Duration)
	}

	if execution.EndTime.IsZero() {
		t.Errorf("GetQueryExecution() EndTime should not be zero after end")
	}
}

func TestQueryMonitor_RecordSuccess(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	queryID := monitor.GenerateQueryID()
	monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")

	rowCount := 100
	duration := 50 * time.Millisecond

	monitor.RecordSuccess(queryID, rowCount, duration)

	execution := monitor.GetQueryExecution(queryID)
	if execution.RowCount != rowCount {
		t.Errorf("RecordSuccess() RowCount = %d, want %d", execution.RowCount, rowCount)
	}

	if execution.Status != "SUCCESS" {
		t.Errorf("RecordSuccess() Status = %s, want SUCCESS", execution.Status)
	}

	if execution.Duration != duration {
		t.Errorf("RecordSuccess() Duration = %v, want %v", execution.Duration, duration)
	}

	// Check statistics
	stats := monitor.GetStatistics()
	if stats["successful_queries"].(int64) != 1 {
		t.Errorf("GetStatistics() successful_queries = %d, want 1", stats["successful_queries"])
	}
}

func TestQueryMonitor_RecordError(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	queryID := monitor.GenerateQueryID()
	monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")

	testError := errors.New("test error")
	monitor.RecordError(queryID, testError)

	execution := monitor.GetQueryExecution(queryID)
	if execution.Status != "ERROR" {
		t.Errorf("RecordError() Status = %s, want ERROR", execution.Status)
	}

	if execution.Error != testError.Error() {
		t.Errorf("RecordError() Error = %s, want %s", execution.Error, testError.Error())
	}

	// Check statistics
	stats := monitor.GetStatistics()
	if stats["failed_queries"].(int64) != 1 {
		t.Errorf("GetStatistics() failed_queries = %d, want 1", stats["failed_queries"])
	}
}

func TestQueryMonitor_RecordCacheHit(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	queryID := monitor.GenerateQueryID()
	monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")

	monitor.RecordCacheHit(queryID)

	execution := monitor.GetQueryExecution(queryID)
	if !execution.CacheHit {
		t.Errorf("RecordCacheHit() CacheHit = false, want true")
	}

	// Check statistics
	stats := monitor.GetStatistics()
	if stats["cache_hits"].(int64) != 1 {
		t.Errorf("GetStatistics() cache_hits = %d, want 1", stats["cache_hits"])
	}
}

func TestQueryMonitor_GetRecentQueries(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	// Add multiple queries
	queryIDs := make([]string, 5)
	for i := 0; i < 5; i++ {
		queryID := monitor.GenerateQueryID()
		queryIDs[i] = queryID
		monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")
		time.Sleep(1 * time.Millisecond) // Ensure different timestamps
		monitor.EndQuery(queryID)
	}

	// Get recent queries
	recent := monitor.GetRecentQueries(3)
	if len(recent) != 3 {
		t.Errorf("GetRecentQueries(3) returned %d queries, want 3", len(recent))
	}

	// Should be sorted by start time (most recent first)
	for i := 0; i < len(recent)-1; i++ {
		if recent[i].StartTime.Before(recent[i+1].StartTime) {
			t.Errorf("GetRecentQueries() not sorted by start time (most recent first)")
		}
	}

	// Test with limit larger than available queries
	all := monitor.GetRecentQueries(10)
	if len(all) != 5 {
		t.Errorf("GetRecentQueries(10) returned %d queries, want 5", len(all))
	}
}

func TestQueryMonitor_GetSlowQueries(t *testing.T) {
	config := &QueryMonitorConfig{
		Enabled:            true,
		SlowQueryThreshold: 100 * time.Millisecond,
	}
	monitor := NewQueryMonitor(config)

	// Add fast query
	fastID := monitor.GenerateQueryID()
	monitor.StartQuery(fastID, "SQL", "SELECT * FROM test_table")
	monitor.RecordSuccess(fastID, 10, 50*time.Millisecond)

	// Add slow query
	slowID := monitor.GenerateQueryID()
	monitor.StartQuery(slowID, "SQL", "SELECT * FROM large_table")
	monitor.RecordSuccess(slowID, 1000, 200*time.Millisecond)

	// Add another slow query
	slowID2 := monitor.GenerateQueryID()
	monitor.StartQuery(slowID2, "SQL", "SELECT * FROM huge_table")
	monitor.RecordSuccess(slowID2, 5000, 500*time.Millisecond)

	slowQueries := monitor.GetSlowQueries(10)
	if len(slowQueries) != 2 {
		t.Errorf("GetSlowQueries() returned %d queries, want 2", len(slowQueries))
	}

	// Should be sorted by duration (slowest first)
	if len(slowQueries) >= 2 && slowQueries[0].Duration < slowQueries[1].Duration {
		t.Errorf("GetSlowQueries() not sorted by duration (slowest first)")
	}

	// Check statistics
	stats := monitor.GetStatistics()
	if stats["slow_queries"].(int64) != 2 {
		t.Errorf("GetStatistics() slow_queries = %d, want 2", stats["slow_queries"])
	}
}

func TestQueryMonitor_GetStatistics(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	// Initial statistics
	stats := monitor.GetStatistics()
	if stats["total_queries"].(int64) != 0 {
		t.Errorf("Initial total_queries = %d, want 0", stats["total_queries"])
	}

	// Add some queries
	for i := 0; i < 3; i++ {
		queryID := monitor.GenerateQueryID()
		monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")
		if i < 2 {
			monitor.RecordSuccess(queryID, 100, 50*time.Millisecond)
		} else {
			monitor.RecordError(queryID, errors.New("test error"))
		}
	}

	// Add cache hit
	cacheID := monitor.GenerateQueryID()
	monitor.StartQuery(cacheID, "SQL", "SELECT * FROM test_table")
	monitor.RecordCacheHit(cacheID)
	monitor.RecordSuccess(cacheID, 50, 10*time.Millisecond)

	stats = monitor.GetStatistics()

	if stats["total_queries"].(int64) != 4 {
		t.Errorf("total_queries = %d, want 4", stats["total_queries"])
	}

	if stats["successful_queries"].(int64) != 3 {
		t.Errorf("successful_queries = %d, want 3", stats["successful_queries"])
	}

	if stats["failed_queries"].(int64) != 1 {
		t.Errorf("failed_queries = %d, want 1", stats["failed_queries"])
	}

	if stats["cache_hits"].(int64) != 1 {
		t.Errorf("cache_hits = %d, want 1", stats["cache_hits"])
	}

	successRate := stats["success_rate"].(float64)
	expectedSuccessRate := 3.0 / 4.0
	if successRate != expectedSuccessRate {
		t.Errorf("success_rate = %f, want %f", successRate, expectedSuccessRate)
	}

	cacheHitRate := stats["cache_hit_rate"].(float64)
	expectedCacheHitRate := 1.0 / 4.0
	if cacheHitRate != expectedCacheHitRate {
		t.Errorf("cache_hit_rate = %f, want %f", cacheHitRate, expectedCacheHitRate)
	}
}

func TestQueryMonitor_GetPerformanceMetrics(t *testing.T) {
	monitor := NewQueryMonitor(nil)

	// Add queries of different types
	sqlID := monitor.GenerateQueryID()
	monitor.StartQuery(sqlID, "SQL", "SELECT * FROM test_table")
	monitor.RecordSuccess(sqlID, 100, 50*time.Millisecond)

	structuredID := monitor.GenerateQueryID()
	monitor.StartQuery(structuredID, "STRUCTURED", "")
	monitor.RecordSuccess(structuredID, 200, 75*time.Millisecond)

	aggID := monitor.GenerateQueryID()
	monitor.StartQuery(aggID, "AGGREGATION", "")
	monitor.RecordError(aggID, errors.New("test error"))

	metrics := monitor.GetPerformanceMetrics()

	if metrics["recent_queries_count"].(int) != 3 {
		t.Errorf("recent_queries_count = %d, want 3", metrics["recent_queries_count"])
	}

	queryTypeDistribution := metrics["query_type_distribution"].(map[string]int)
	if queryTypeDistribution["SQL"] != 1 {
		t.Errorf("query_type_distribution[SQL] = %d, want 1", queryTypeDistribution["SQL"])
	}
	if queryTypeDistribution["STRUCTURED"] != 1 {
		t.Errorf("query_type_distribution[STRUCTURED] = %d, want 1", queryTypeDistribution["STRUCTURED"])
	}
	if queryTypeDistribution["AGGREGATION"] != 1 {
		t.Errorf("query_type_distribution[AGGREGATION] = %d, want 1", queryTypeDistribution["AGGREGATION"])
	}

	statusDistribution := metrics["status_distribution"].(map[string]int)
	if statusDistribution["SUCCESS"] != 2 {
		t.Errorf("status_distribution[SUCCESS] = %d, want 2", statusDistribution["SUCCESS"])
	}
	if statusDistribution["ERROR"] != 1 {
		t.Errorf("status_distribution[ERROR] = %d, want 1", statusDistribution["ERROR"])
	}
}

func TestQueryMonitor_Disabled(t *testing.T) {
	config := &QueryMonitorConfig{
		Enabled: false,
	}
	monitor := NewQueryMonitor(config)

	// Operations should not record anything when disabled
	queryID := monitor.GenerateQueryID()
	if queryID != "" {
		t.Errorf("GenerateQueryID() when disabled expected empty string, got %s", queryID)
	}

	monitor.StartQuery("test-id", "SQL", "SELECT * FROM test_table")
	execution := monitor.GetQueryExecution("test-id")
	if execution != nil {
		t.Errorf("GetQueryExecution() when disabled expected nil, got %v", execution)
	}

	stats := monitor.GetStatistics()
	if stats["enabled"].(bool) != false {
		t.Errorf("GetStatistics() enabled = %v, want false", stats["enabled"])
	}
}

func TestQueryMonitor_HourlyStatistics(t *testing.T) {
	config := &QueryMonitorConfig{
		Enabled:             true,
		EnableDetailedStats: true,
	}
	monitor := NewQueryMonitor(config)

	// Add some queries
	for i := 0; i < 3; i++ {
		queryID := monitor.GenerateQueryID()
		monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")
		if i < 2 {
			monitor.RecordSuccess(queryID, 100, 50*time.Millisecond)
		} else {
			monitor.RecordError(queryID, errors.New("test error"))
		}
		monitor.EndQuery(queryID)
	}

	hourlyStats := monitor.GetHourlyStatistics()
	if len(hourlyStats) == 0 {
		t.Errorf("GetHourlyStatistics() expected at least one hour entry, got empty map")
	}

	// Check that current hour has statistics
	currentHour := time.Now().Format("2006-01-02-15")
	if stats, exists := hourlyStats[currentHour]; exists {
		if stats.QueryCount != 3 {
			t.Errorf("HourlyStats QueryCount = %d, want 3", stats.QueryCount)
		}
		if stats.ErrorCount != 1 {
			t.Errorf("HourlyStats ErrorCount = %d, want 1", stats.ErrorCount)
		}
	} else {
		t.Errorf("GetHourlyStatistics() missing entry for current hour %s", currentHour)
	}
}

func TestQueryMonitor_MaxQueryHistory(t *testing.T) {
	config := &QueryMonitorConfig{
		Enabled:         true,
		MaxQueryHistory: 3,
		RetentionPeriod: 1 * time.Hour, // Long retention to test max history limit
	}
	monitor := NewQueryMonitor(config)

	// Add more queries than max history
	queryIDs := make([]string, 5)
	for i := 0; i < 5; i++ {
		queryID := monitor.GenerateQueryID()
		queryIDs[i] = queryID
		monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")
		monitor.EndQuery(queryID)
		time.Sleep(1 * time.Millisecond) // Ensure different timestamps
	}

	// Trigger cleanup manually (in real scenario this would be done by cleanup goroutine)
	monitor.cleanup()

	// Should only keep the most recent queries up to MaxQueryHistory
	recent := monitor.GetRecentQueries(10)
	if len(recent) > config.MaxQueryHistory {
		t.Errorf("GetRecentQueries() after cleanup returned %d queries, want <= %d", len(recent), config.MaxQueryHistory)
	}

	// The oldest queries should be removed
	for i := 0; i < 2; i++ { // First 2 queries should be removed
		if monitor.GetQueryExecution(queryIDs[i]) != nil {
			t.Errorf("GetQueryExecution() expected oldest query %s to be removed", queryIDs[i])
		}
	}
}

func TestQueryMonitor_RetentionPeriod(t *testing.T) {
	config := &QueryMonitorConfig{
		Enabled:         true,
		RetentionPeriod: 100 * time.Millisecond,
	}
	monitor := NewQueryMonitor(config)

	queryID := monitor.GenerateQueryID()
	monitor.StartQuery(queryID, "SQL", "SELECT * FROM test_table")
	monitor.EndQuery(queryID)

	// Should be available immediately
	if monitor.GetQueryExecution(queryID) == nil {
		t.Errorf("GetQueryExecution() expected query to be available immediately")
	}

	// Wait for retention period to pass
	time.Sleep(150 * time.Millisecond)

	// Trigger cleanup
	monitor.cleanup()

	// Should be removed after retention period
	if monitor.GetQueryExecution(queryID) != nil {
		t.Errorf("GetQueryExecution() expected query to be removed after retention period")
	}
}