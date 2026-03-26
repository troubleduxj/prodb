package tdengine

import (
	"crypto/rand"
	"fmt"
	"sync"
	"time"
)

// QueryMonitor provides query performance monitoring
type QueryMonitor struct {
	config   *QueryMonitorConfig
	queries  map[string]*QueryExecution
	stats    *QueryStatistics
	mutex    sync.RWMutex
}

// QueryMonitorConfig holds monitor configuration
type QueryMonitorConfig struct {
	Enabled              bool          `json:"enabled"`
	MaxQueryHistory      int           `json:"max_query_history"`
	SlowQueryThreshold   time.Duration `json:"slow_query_threshold"`
	EnableDetailedStats  bool          `json:"enable_detailed_stats"`
	RetentionPeriod      time.Duration `json:"retention_period"`
}

// QueryExecution represents a query execution record
type QueryExecution struct {
	ID          string        `json:"id"`
	Type        string        `json:"type"` // SQL, STRUCTURED, AGGREGATION
	SQL         string        `json:"sql"`
	StartTime   time.Time     `json:"start_time"`
	EndTime     time.Time     `json:"end_time"`
	Duration    time.Duration `json:"duration"`
	RowCount    int           `json:"row_count"`
	Status      string        `json:"status"` // RUNNING, SUCCESS, ERROR
	Error       string        `json:"error,omitempty"`
	CacheHit    bool          `json:"cache_hit"`
}

// QueryStatistics holds comprehensive query statistics
type QueryStatistics struct {
	TotalQueries     int64         `json:"total_queries"`
	SuccessfulQueries int64        `json:"successful_queries"`
	FailedQueries    int64         `json:"failed_queries"`
	CacheHits        int64         `json:"cache_hits"`
	SlowQueries      int64         `json:"slow_queries"`
	AverageLatency   time.Duration `json:"average_latency"`
	MaxLatency       time.Duration `json:"max_latency"`
	MinLatency       time.Duration `json:"min_latency"`
	TotalLatency     time.Duration `json:"total_latency"`
	QueryTypes       map[string]int64 `json:"query_types"`
	HourlyStats      map[string]*HourlyStats `json:"hourly_stats"`
	mutex            sync.RWMutex
}

// HourlyStats represents statistics for a specific hour
type HourlyStats struct {
	Hour         string        `json:"hour"`
	QueryCount   int64         `json:"query_count"`
	AvgLatency   time.Duration `json:"avg_latency"`
	ErrorCount   int64         `json:"error_count"`
	CacheHitRate float64       `json:"cache_hit_rate"`
}

// DefaultQueryMonitorConfig returns default monitor configuration
func DefaultQueryMonitorConfig() *QueryMonitorConfig {
	return &QueryMonitorConfig{
		Enabled:             true,
		MaxQueryHistory:     1000,
		SlowQueryThreshold:  5 * time.Second,
		EnableDetailedStats: true,
		RetentionPeriod:     24 * time.Hour,
	}
}

// NewQueryMonitor creates a new query monitor
func NewQueryMonitor(config *QueryMonitorConfig) *QueryMonitor {
	if config == nil {
		config = DefaultQueryMonitorConfig()
	}

	monitor := &QueryMonitor{
		config:  config,
		queries: make(map[string]*QueryExecution),
		stats: &QueryStatistics{
			QueryTypes:  make(map[string]int64),
			HourlyStats: make(map[string]*HourlyStats),
		},
	}

	// Start cleanup goroutine
	if config.Enabled && config.RetentionPeriod > 0 {
		go monitor.startCleanup()
	}

	return monitor
}

// GenerateQueryID generates a unique query ID
func (qm *QueryMonitor) GenerateQueryID() string {
	if !qm.config.Enabled {
		return ""
	}

	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("q_%x", bytes)
}

// StartQuery records the start of a query execution
func (qm *QueryMonitor) StartQuery(queryID, queryType, sql string) {
	if !qm.config.Enabled || queryID == "" {
		return
	}

	execution := &QueryExecution{
		ID:        queryID,
		Type:      queryType,
		SQL:       sql,
		StartTime: time.Now(),
		Status:    "RUNNING",
	}

	qm.mutex.Lock()
	qm.queries[queryID] = execution
	qm.mutex.Unlock()

	// Update statistics
	qm.stats.mutex.Lock()
	qm.stats.TotalQueries++
	qm.stats.QueryTypes[queryType]++
	qm.stats.mutex.Unlock()
}

// EndQuery records the end of a query execution
func (qm *QueryMonitor) EndQuery(queryID string) {
	if !qm.config.Enabled || queryID == "" {
		return
	}

	qm.mutex.Lock()
	execution, exists := qm.queries[queryID]
	if !exists {
		qm.mutex.Unlock()
		return
	}

	execution.EndTime = time.Now()
	execution.Duration = execution.EndTime.Sub(execution.StartTime)
	if execution.Status == "RUNNING" {
		execution.Status = "SUCCESS"
	}
	qm.mutex.Unlock()

	// Update statistics
	qm.updateLatencyStats(execution.Duration)
	
	// Check for slow query
	if execution.Duration > qm.config.SlowQueryThreshold {
		qm.recordSlowQuery()
	}

	// Update hourly statistics
	qm.updateHourlyStats(execution)
}

// RecordSuccess records a successful query
func (qm *QueryMonitor) RecordSuccess(queryID string, rowCount int, duration time.Duration) {
	if !qm.config.Enabled || queryID == "" {
		return
	}

	qm.mutex.Lock()
	if execution, exists := qm.queries[queryID]; exists {
		execution.RowCount = rowCount
		execution.Status = "SUCCESS"
		execution.Duration = duration
	}
	qm.mutex.Unlock()

	qm.stats.mutex.Lock()
	qm.stats.SuccessfulQueries++
	qm.stats.mutex.Unlock()

	// Update latency stats and check for slow query
	qm.updateLatencyStats(duration)
	
	// Check for slow query
	if duration > qm.config.SlowQueryThreshold {
		qm.recordSlowQuery()
	}
}

// RecordError records a query error
func (qm *QueryMonitor) RecordError(queryID string, err error) {
	if !qm.config.Enabled || queryID == "" {
		return
	}

	qm.mutex.Lock()
	if execution, exists := qm.queries[queryID]; exists {
		execution.Status = "ERROR"
		execution.Error = err.Error()
	}
	qm.mutex.Unlock()

	qm.stats.mutex.Lock()
	qm.stats.FailedQueries++
	qm.stats.mutex.Unlock()
}

// RecordCacheHit records a cache hit
func (qm *QueryMonitor) RecordCacheHit(queryID string) {
	if !qm.config.Enabled || queryID == "" {
		return
	}

	qm.mutex.Lock()
	if execution, exists := qm.queries[queryID]; exists {
		execution.CacheHit = true
	}
	qm.mutex.Unlock()

	qm.stats.mutex.Lock()
	qm.stats.CacheHits++
	qm.stats.mutex.Unlock()
}

// GetQueryExecution returns a specific query execution
func (qm *QueryMonitor) GetQueryExecution(queryID string) *QueryExecution {
	qm.mutex.RLock()
	defer qm.mutex.RUnlock()

	if execution, exists := qm.queries[queryID]; exists {
		// Return a copy
		execCopy := *execution
		return &execCopy
	}

	return nil
}

// GetRecentQueries returns recent query executions
func (qm *QueryMonitor) GetRecentQueries(limit int) []*QueryExecution {
	if limit <= 0 {
		limit = 100
	}

	qm.mutex.RLock()
	defer qm.mutex.RUnlock()

	var executions []*QueryExecution
	for _, execution := range qm.queries {
		executions = append(executions, execution)
	}

	// Sort by start time (most recent first)
	for i := 0; i < len(executions)-1; i++ {
		for j := i + 1; j < len(executions); j++ {
			if executions[i].StartTime.Before(executions[j].StartTime) {
				executions[i], executions[j] = executions[j], executions[i]
			}
		}
	}

	if len(executions) > limit {
		executions = executions[:limit]
	}

	return executions
}

// GetSlowQueries returns queries that exceeded the slow query threshold
func (qm *QueryMonitor) GetSlowQueries(limit int) []*QueryExecution {
	if limit <= 0 {
		limit = 50
	}

	qm.mutex.RLock()
	defer qm.mutex.RUnlock()

	var slowQueries []*QueryExecution
	for _, execution := range qm.queries {
		if execution.Duration > qm.config.SlowQueryThreshold {
			slowQueries = append(slowQueries, execution)
		}
	}

	// Sort by duration (slowest first)
	for i := 0; i < len(slowQueries)-1; i++ {
		for j := i + 1; j < len(slowQueries); j++ {
			if slowQueries[i].Duration < slowQueries[j].Duration {
				slowQueries[i], slowQueries[j] = slowQueries[j], slowQueries[i]
			}
		}
	}

	if len(slowQueries) > limit {
		slowQueries = slowQueries[:limit]
	}

	return slowQueries
}

// GetStatistics returns comprehensive query statistics
func (qm *QueryMonitor) GetStatistics() map[string]interface{} {
	qm.stats.mutex.RLock()
	defer qm.stats.mutex.RUnlock()

	qm.mutex.RLock()
	activeQueries := len(qm.queries)
	qm.mutex.RUnlock()

	successRate := float64(0)
	if qm.stats.TotalQueries > 0 {
		successRate = float64(qm.stats.SuccessfulQueries) / float64(qm.stats.TotalQueries)
	}

	cacheHitRate := float64(0)
	if qm.stats.TotalQueries > 0 {
		cacheHitRate = float64(qm.stats.CacheHits) / float64(qm.stats.TotalQueries)
	}

	return map[string]interface{}{
		"enabled":            qm.config.Enabled,
		"total_queries":      qm.stats.TotalQueries,
		"successful_queries": qm.stats.SuccessfulQueries,
		"failed_queries":     qm.stats.FailedQueries,
		"success_rate":       successRate,
		"cache_hits":         qm.stats.CacheHits,
		"cache_hit_rate":     cacheHitRate,
		"slow_queries":       qm.stats.SlowQueries,
		"average_latency":    qm.stats.AverageLatency.String(),
		"max_latency":        qm.stats.MaxLatency.String(),
		"min_latency":        qm.stats.MinLatency.String(),
		"active_queries":     activeQueries,
		"query_types":        qm.stats.QueryTypes,
		"slow_query_threshold": qm.config.SlowQueryThreshold.String(),
	}
}

// GetHourlyStatistics returns hourly query statistics
func (qm *QueryMonitor) GetHourlyStatistics() map[string]*HourlyStats {
	qm.stats.mutex.RLock()
	defer qm.stats.mutex.RUnlock()

	// Return a copy of hourly stats
	result := make(map[string]*HourlyStats)
	for k, v := range qm.stats.HourlyStats {
		statsCopy := *v
		result[k] = &statsCopy
	}

	return result
}

// GetPerformanceMetrics returns detailed performance metrics
func (qm *QueryMonitor) GetPerformanceMetrics() map[string]interface{} {
	recent := qm.GetRecentQueries(100)
	slow := qm.GetSlowQueries(10)

	var totalDuration time.Duration
	var queryTypeCount = make(map[string]int)
	var statusCount = make(map[string]int)

	for _, query := range recent {
		totalDuration += query.Duration
		queryTypeCount[query.Type]++
		statusCount[query.Status]++
	}

	avgDuration := time.Duration(0)
	if len(recent) > 0 {
		avgDuration = totalDuration / time.Duration(len(recent))
	}

	return map[string]interface{}{
		"recent_queries_count":    len(recent),
		"slow_queries_count":      len(slow),
		"average_duration":        avgDuration.String(),
		"query_type_distribution": queryTypeCount,
		"status_distribution":     statusCount,
		"slowest_queries":         slow,
	}
}

// updateLatencyStats updates latency statistics
func (qm *QueryMonitor) updateLatencyStats(duration time.Duration) {
	qm.stats.mutex.Lock()
	defer qm.stats.mutex.Unlock()

	qm.stats.TotalLatency += duration

	if qm.stats.MaxLatency == 0 || duration > qm.stats.MaxLatency {
		qm.stats.MaxLatency = duration
	}

	if qm.stats.MinLatency == 0 || duration < qm.stats.MinLatency {
		qm.stats.MinLatency = duration
	}

	if qm.stats.SuccessfulQueries > 0 {
		qm.stats.AverageLatency = qm.stats.TotalLatency / time.Duration(qm.stats.SuccessfulQueries)
	}
}

// recordSlowQuery records a slow query
func (qm *QueryMonitor) recordSlowQuery() {
	qm.stats.mutex.Lock()
	qm.stats.SlowQueries++
	qm.stats.mutex.Unlock()
}

// updateHourlyStats updates hourly statistics
func (qm *QueryMonitor) updateHourlyStats(execution *QueryExecution) {
	if !qm.config.EnableDetailedStats {
		return
	}

	hour := execution.StartTime.Format("2006-01-02-15")

	qm.stats.mutex.Lock()
	defer qm.stats.mutex.Unlock()

	stats, exists := qm.stats.HourlyStats[hour]
	if !exists {
		stats = &HourlyStats{
			Hour: hour,
		}
		qm.stats.HourlyStats[hour] = stats
	}

	stats.QueryCount++
	
	if execution.Status == "ERROR" {
		stats.ErrorCount++
	}

	if execution.CacheHit {
		// Update cache hit rate
		totalHits := float64(stats.QueryCount - stats.ErrorCount)
		if totalHits > 0 {
			cacheHits := totalHits * stats.CacheHitRate + 1
			stats.CacheHitRate = cacheHits / totalHits
		}
	}

	// Update average latency
	if execution.Duration > 0 {
		totalLatency := stats.AvgLatency * time.Duration(stats.QueryCount-1)
		stats.AvgLatency = (totalLatency + execution.Duration) / time.Duration(stats.QueryCount)
	}
}

// startCleanup starts the cleanup goroutine
func (qm *QueryMonitor) startCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		qm.cleanup()
	}
}

// cleanup removes old query records
func (qm *QueryMonitor) cleanup() {
	cutoff := time.Now().Add(-qm.config.RetentionPeriod)

	qm.mutex.Lock()
	defer qm.mutex.Unlock()

	var toDelete []string
	for id, execution := range qm.queries {
		if execution.StartTime.Before(cutoff) {
			toDelete = append(toDelete, id)
		}
	}

	for _, id := range toDelete {
		delete(qm.queries, id)
	}

	// Cleanup hourly stats older than retention period
	qm.stats.mutex.Lock()
	defer qm.stats.mutex.Unlock()

	for hour := range qm.stats.HourlyStats {
		if hourTime, err := time.Parse("2006-01-02-15", hour); err == nil {
			if hourTime.Before(cutoff) {
				delete(qm.stats.HourlyStats, hour)
			}
		}
	}

	// Limit query history size
	if len(qm.queries) > qm.config.MaxQueryHistory {
		// Remove oldest queries
		var executions []*QueryExecution
		for _, execution := range qm.queries {
			executions = append(executions, execution)
		}

		// Sort by start time (oldest first)
		for i := 0; i < len(executions)-1; i++ {
			for j := i + 1; j < len(executions); j++ {
				if executions[i].StartTime.After(executions[j].StartTime) {
					executions[i], executions[j] = executions[j], executions[i]
				}
			}
		}

		// Remove excess queries
		excess := len(executions) - qm.config.MaxQueryHistory
		for i := 0; i < excess; i++ {
			delete(qm.queries, executions[i].ID)
		}
	}
}