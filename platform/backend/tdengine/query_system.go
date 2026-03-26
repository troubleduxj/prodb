package tdengine

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// QuerySystem provides flexible data query capabilities
type QuerySystem struct {
	service     *TDengineService
	cache       *QueryCache
	optimizer   *QueryOptimizer
	monitor     *QueryMonitor
}

// NewQuerySystem creates a new query system
func NewQuerySystem(service *TDengineService, config *QuerySystemConfig) *QuerySystem {
	if config == nil {
		config = DefaultQuerySystemConfig()
	}

	return &QuerySystem{
		service:   service,
		cache:     NewQueryCache(config.CacheConfig),
		optimizer: NewQueryOptimizer(config.OptimizerConfig),
		monitor:   NewQueryMonitor(config.MonitorConfig),
	}
}

// QuerySystemConfig holds configuration for the query system
type QuerySystemConfig struct {
	CacheConfig     *QueryCacheConfig     `json:"cache_config"`
	OptimizerConfig *QueryOptimizerConfig `json:"optimizer_config"`
	MonitorConfig   *QueryMonitorConfig   `json:"monitor_config"`
}

// DefaultQuerySystemConfig returns default configuration
func DefaultQuerySystemConfig() *QuerySystemConfig {
	return &QuerySystemConfig{
		CacheConfig:     DefaultQueryCacheConfig(),
		OptimizerConfig: DefaultQueryOptimizerConfig(),
		MonitorConfig:   DefaultQueryMonitorConfig(),
	}
}

// QueryResult represents the result of a query
type QueryResult struct {
	Columns   []string                 `json:"columns"`
	Rows      []map[string]interface{} `json:"rows"`
	Count     int                      `json:"count"`
	QueryTime time.Duration            `json:"query_time"`
	Cached    bool                     `json:"cached"`
	QueryID   string                   `json:"query_id"`
}

// PaginatedResult represents a paginated query result
type PaginatedResult struct {
	*QueryResult
	Page       int  `json:"page"`
	Size       int  `json:"size"`
	TotalPages int  `json:"total_pages"`
	TotalCount int  `json:"total_count"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// SQLQueryRequest represents a raw SQL query request
type SQLQueryRequest struct {
	SQL      string        `json:"sql" binding:"required"`
	Database string        `json:"database"`
	Timeout  time.Duration `json:"timeout"`
	UseCache bool          `json:"use_cache"`
}

// StructuredQueryRequest represents a structured query request
type StructuredQueryRequest struct {
	Database   string                 `json:"database" binding:"required"`
	Table      string                 `json:"table" binding:"required"`
	Columns    []string               `json:"columns"`
	Conditions *QueryConditions       `json:"conditions"`
	OrderBy    []OrderByClause        `json:"order_by"`
	GroupBy    []string               `json:"group_by"`
	Having     *QueryConditions       `json:"having"`
	Limit      int                    `json:"limit"`
	Offset     int                    `json:"offset"`
	UseCache   bool                   `json:"use_cache"`
}

// QueryConditions represents query conditions
type QueryConditions struct {
	TimeRange *TimeRangeCondition            `json:"time_range"`
	Tags      map[string]interface{}         `json:"tags"`
	Filters   map[string]*FilterCondition    `json:"filters"`
	Logic     string                         `json:"logic"` // AND, OR
}

// TimeRangeCondition represents time range filtering
type TimeRangeCondition struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// FilterCondition represents a filter condition
type FilterCondition struct {
	Operator string      `json:"operator"` // =, !=, >, <, >=, <=, IN, NOT IN, LIKE, NOT LIKE
	Value    interface{} `json:"value"`
}

// OrderByClause represents an order by clause
type OrderByClause struct {
	Column    string `json:"column"`
	Direction string `json:"direction"` // ASC, DESC
}

// AggregationQueryRequest represents an aggregation query request
type AggregationQueryRequest struct {
	Database     string                 `json:"database" binding:"required"`
	Table        string                 `json:"table" binding:"required"`
	Aggregations []AggregationFunction  `json:"aggregations" binding:"required"`
	GroupBy      []string               `json:"group_by"`
	TimeWindow   *TimeWindowConfig      `json:"time_window"`
	Conditions   *QueryConditions       `json:"conditions"`
	OrderBy      []OrderByClause        `json:"order_by"`
	Limit        int                    `json:"limit"`
	UseCache     bool                   `json:"use_cache"`
}

// AggregationFunction represents an aggregation function
type AggregationFunction struct {
	Function string `json:"function"` // COUNT, SUM, AVG, MAX, MIN, STDDEV, etc.
	Column   string `json:"column"`
	Alias    string `json:"alias"`
}

// TimeWindowConfig represents time window configuration
type TimeWindowConfig struct {
	Interval string    `json:"interval"` // 1s, 1m, 1h, 1d, etc.
	Start    time.Time `json:"start"`
	End      time.Time `json:"end"`
	Fill     string    `json:"fill"` // NULL, PREV, LINEAR, etc.
}

// PaginationRequest represents pagination parameters
type PaginationRequest struct {
	Page int `json:"page"`
	Size int `json:"size"`
}

// ExecuteSQL executes a raw SQL query
func (qs *QuerySystem) ExecuteSQL(ctx context.Context, req *SQLQueryRequest) (*QueryResult, error) {
	// Generate query ID for monitoring
	queryID := qs.monitor.GenerateQueryID()
	
	// Start monitoring
	qs.monitor.StartQuery(queryID, "SQL", req.SQL)
	defer qs.monitor.EndQuery(queryID)

	// Check cache if enabled
	if req.UseCache {
		if cached := qs.cache.Get(req.SQL); cached != nil {
			qs.monitor.RecordCacheHit(queryID)
			cached.Cached = true
			cached.QueryID = queryID
			return cached, nil
		}
	}

	// Set timeout
	timeout := req.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	queryCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Optimize query if possible
	optimizedSQL := qs.optimizer.OptimizeSQL(req.SQL)
	
	// Execute query
	start := time.Now()
	rows, err := qs.service.GetManager().ExecuteQuery(queryCtx, optimizedSQL)
	if err != nil {
		qs.monitor.RecordError(queryID, err)
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	// Process results
	result, err := qs.processRows(rows)
	if err != nil {
		qs.monitor.RecordError(queryID, err)
		return nil, fmt.Errorf("failed to process query results: %w", err)
	}

	result.QueryTime = time.Since(start)
	result.QueryID = queryID
	result.Cached = false

	// Cache result if enabled
	if req.UseCache {
		qs.cache.Set(req.SQL, result)
	}

	qs.monitor.RecordSuccess(queryID, result.Count, result.QueryTime)
	return result, nil
}

// ExecuteStructuredQuery executes a structured query
func (qs *QuerySystem) ExecuteStructuredQuery(ctx context.Context, req *StructuredQueryRequest) (*QueryResult, error) {
	// Generate SQL from structured request
	sql, err := qs.buildStructuredSQL(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build SQL from structured query: %w", err)
	}

	// Execute as SQL query
	sqlReq := &SQLQueryRequest{
		SQL:      sql,
		Database: req.Database,
		Timeout:  30 * time.Second,
		UseCache: req.UseCache,
	}

	return qs.ExecuteSQL(ctx, sqlReq)
}

// ExecuteAggregationQuery executes an aggregation query
func (qs *QuerySystem) ExecuteAggregationQuery(ctx context.Context, req *AggregationQueryRequest) (*QueryResult, error) {
	// Generate SQL from aggregation request
	sql, err := qs.buildAggregationSQL(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build SQL from aggregation query: %w", err)
	}

	// Execute as SQL query
	sqlReq := &SQLQueryRequest{
		SQL:      sql,
		Database: req.Database,
		Timeout:  60 * time.Second, // Longer timeout for aggregation queries
		UseCache: req.UseCache,
	}

	return qs.ExecuteSQL(ctx, sqlReq)
}

// ExecuteWithPagination executes a query with pagination
func (qs *QuerySystem) ExecuteWithPagination(ctx context.Context, req *StructuredQueryRequest, pagination *PaginationRequest) (*PaginatedResult, error) {
	if pagination.Page <= 0 {
		pagination.Page = 1
	}
	if pagination.Size <= 0 {
		pagination.Size = 20
	}
	if pagination.Size > 1000 {
		pagination.Size = 1000 // Max page size
	}

	// First, get total count
	countReq := &StructuredQueryRequest{
		Database:   req.Database,
		Table:      req.Table,
		Columns:    []string{"COUNT(*) as total_count"},
		Conditions: req.Conditions,
		UseCache:   req.UseCache,
	}

	countResult, err := qs.ExecuteStructuredQuery(ctx, countReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	totalCount := 0
	if len(countResult.Rows) > 0 {
		if count, ok := countResult.Rows[0]["total_count"].(int64); ok {
			totalCount = int(count)
		}
	}

	// Calculate pagination
	totalPages := (totalCount + pagination.Size - 1) / pagination.Size
	offset := (pagination.Page - 1) * pagination.Size

	// Execute main query with limit and offset
	req.Limit = pagination.Size
	req.Offset = offset

	result, err := qs.ExecuteStructuredQuery(ctx, req)
	if err != nil {
		return nil, err
	}

	return &PaginatedResult{
		QueryResult: result,
		Page:        pagination.Page,
		Size:        pagination.Size,
		TotalPages:  totalPages,
		TotalCount:  totalCount,
		HasNext:     pagination.Page < totalPages,
		HasPrev:     pagination.Page > 1,
	}, nil
}

// QueryLatestByTags queries latest data by tag filters
func (qs *QuerySystem) QueryLatestByTags(ctx context.Context, database, table string, tags map[string]string, limit int) (*QueryResult, error) {
	conditions := &QueryConditions{
		Tags: make(map[string]interface{}),
	}
	
	for k, v := range tags {
		conditions.Tags[k] = v
	}

	req := &StructuredQueryRequest{
		Database:   database,
		Table:      table,
		Conditions: conditions,
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "DESC"},
		},
		Limit:    limit,
		UseCache: true,
	}

	return qs.ExecuteStructuredQuery(ctx, req)
}

// QueryTimeRange queries data within a time range
func (qs *QuerySystem) QueryTimeRange(ctx context.Context, database, table string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error) {
	queryConditions := &QueryConditions{
		TimeRange: &TimeRangeCondition{
			Start: start,
			End:   end,
		},
	}

	if conditions != nil {
		queryConditions.Tags = conditions
	}

	req := &StructuredQueryRequest{
		Database:   database,
		Table:      table,
		Conditions: queryConditions,
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "ASC"},
		},
		UseCache: true,
	}

	return qs.ExecuteStructuredQuery(ctx, req)
}

// QueryAggregationWithTimeWindow queries aggregated data with time windows
func (qs *QuerySystem) QueryAggregationWithTimeWindow(ctx context.Context, database, table, aggFunc, column, interval string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error) {
	queryConditions := &QueryConditions{
		TimeRange: &TimeRangeCondition{
			Start: start,
			End:   end,
		},
	}

	if conditions != nil {
		queryConditions.Tags = conditions
	}

	req := &AggregationQueryRequest{
		Database: database,
		Table:    table,
		Aggregations: []AggregationFunction{
			{
				Function: aggFunc,
				Column:   column,
				Alias:    fmt.Sprintf("%s_%s", aggFunc, column),
			},
		},
		TimeWindow: &TimeWindowConfig{
			Interval: interval,
			Start:    start,
			End:      end,
			Fill:     "NULL",
		},
		Conditions: queryConditions,
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "ASC"},
		},
		UseCache: true,
	}

	return qs.ExecuteAggregationQuery(ctx, req)
}

// GetQueryStatistics returns query performance statistics
func (qs *QuerySystem) GetQueryStatistics() map[string]interface{} {
	return qs.monitor.GetStatistics()
}

// GetCacheStatistics returns cache performance statistics
func (qs *QuerySystem) GetCacheStatistics() map[string]interface{} {
	return qs.cache.GetStatistics()
}

// ClearCache clears the query cache
func (qs *QuerySystem) ClearCache() {
	qs.cache.Clear()
}

// processRows processes SQL rows into QueryResult
func (qs *QuerySystem) processRows(rows *sql.Rows) (*QueryResult, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	return &QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   len(results),
	}, nil
}

// buildStructuredSQL builds SQL from structured query request
func (qs *QuerySystem) buildStructuredSQL(req *StructuredQueryRequest) (string, error) {
	var sql strings.Builder

	// SELECT clause
	sql.WriteString("SELECT ")
	if len(req.Columns) > 0 {
		sql.WriteString(strings.Join(req.Columns, ", "))
	} else {
		sql.WriteString("*")
	}

	// FROM clause
	sql.WriteString(fmt.Sprintf(" FROM %s", req.Table))

	// WHERE clause
	if req.Conditions != nil {
		whereClause, err := qs.buildWhereClause(req.Conditions)
		if err != nil {
			return "", err
		}
		if whereClause != "" {
			sql.WriteString(" WHERE " + whereClause)
		}
	}

	// GROUP BY clause
	if len(req.GroupBy) > 0 {
		sql.WriteString(" GROUP BY " + strings.Join(req.GroupBy, ", "))
	}

	// HAVING clause
	if req.Having != nil {
		havingClause, err := qs.buildWhereClause(req.Having)
		if err != nil {
			return "", err
		}
		if havingClause != "" {
			sql.WriteString(" HAVING " + havingClause)
		}
	}

	// ORDER BY clause
	if len(req.OrderBy) > 0 {
		var orderClauses []string
		for _, order := range req.OrderBy {
			direction := "ASC"
			if strings.ToUpper(order.Direction) == "DESC" {
				direction = "DESC"
			}
			orderClauses = append(orderClauses, fmt.Sprintf("%s %s", order.Column, direction))
		}
		sql.WriteString(" ORDER BY " + strings.Join(orderClauses, ", "))
	}

	// LIMIT clause
	if req.Limit > 0 {
		sql.WriteString(fmt.Sprintf(" LIMIT %d", req.Limit))
		if req.Offset > 0 {
			sql.WriteString(fmt.Sprintf(" OFFSET %d", req.Offset))
		}
	}

	return sql.String(), nil
}

// buildAggregationSQL builds SQL from aggregation query request
func (qs *QuerySystem) buildAggregationSQL(req *AggregationQueryRequest) (string, error) {
	var sql strings.Builder

	// SELECT clause with aggregations
	sql.WriteString("SELECT ")
	
	var selectClauses []string
	
	// Add time window if specified
	if req.TimeWindow != nil {
		selectClauses = append(selectClauses, fmt.Sprintf("_wstart as ts"))
	}
	
	// Add group by columns
	for _, col := range req.GroupBy {
		selectClauses = append(selectClauses, col)
	}
	
	// Add aggregation functions
	for _, agg := range req.Aggregations {
		alias := agg.Alias
		if alias == "" {
			alias = fmt.Sprintf("%s_%s", strings.ToLower(agg.Function), agg.Column)
		}
		selectClauses = append(selectClauses, fmt.Sprintf("%s(%s) as %s", agg.Function, agg.Column, alias))
	}
	
	sql.WriteString(strings.Join(selectClauses, ", "))

	// FROM clause
	sql.WriteString(fmt.Sprintf(" FROM %s", req.Table))

	// WHERE clause
	if req.Conditions != nil {
		whereClause, err := qs.buildWhereClause(req.Conditions)
		if err != nil {
			return "", err
		}
		if whereClause != "" {
			sql.WriteString(" WHERE " + whereClause)
		}
	}

	// Time window clause
	if req.TimeWindow != nil {
		sql.WriteString(fmt.Sprintf(" INTERVAL(%s)", req.TimeWindow.Interval))
		if req.TimeWindow.Fill != "" {
			sql.WriteString(fmt.Sprintf(" FILL(%s)", req.TimeWindow.Fill))
		}
	}

	// GROUP BY clause
	if len(req.GroupBy) > 0 {
		sql.WriteString(" GROUP BY " + strings.Join(req.GroupBy, ", "))
	}

	// ORDER BY clause
	if len(req.OrderBy) > 0 {
		var orderClauses []string
		for _, order := range req.OrderBy {
			direction := "ASC"
			if strings.ToUpper(order.Direction) == "DESC" {
				direction = "DESC"
			}
			orderClauses = append(orderClauses, fmt.Sprintf("%s %s", order.Column, direction))
		}
		sql.WriteString(" ORDER BY " + strings.Join(orderClauses, ", "))
	}

	// LIMIT clause
	if req.Limit > 0 {
		sql.WriteString(fmt.Sprintf(" LIMIT %d", req.Limit))
	}

	return sql.String(), nil
}

// buildWhereClause builds WHERE clause from conditions
func (qs *QuerySystem) buildWhereClause(conditions *QueryConditions) (string, error) {
	var clauses []string

	// Time range condition
	if conditions.TimeRange != nil {
		timeClause := fmt.Sprintf("ts >= '%s' AND ts <= '%s'",
			conditions.TimeRange.Start.Format("2006-01-02 15:04:05.000"),
			conditions.TimeRange.End.Format("2006-01-02 15:04:05.000"))
		clauses = append(clauses, timeClause)
	}

	// Tag conditions
	for key, value := range conditions.Tags {
		clause := fmt.Sprintf("%s = '%v'", key, value)
		clauses = append(clauses, clause)
	}

	// Filter conditions
	for key, filter := range conditions.Filters {
		clause, err := qs.buildFilterClause(key, filter)
		if err != nil {
			return "", err
		}
		clauses = append(clauses, clause)
	}

	if len(clauses) == 0 {
		return "", nil
	}

	logic := "AND"
	if conditions.Logic != "" {
		logic = strings.ToUpper(conditions.Logic)
	}

	return strings.Join(clauses, " "+logic+" "), nil
}

// buildFilterClause builds a filter clause
func (qs *QuerySystem) buildFilterClause(column string, filter *FilterCondition) (string, error) {
	switch strings.ToUpper(filter.Operator) {
	case "=", "!=", ">", "<", ">=", "<=":
		return fmt.Sprintf("%s %s '%v'", column, filter.Operator, filter.Value), nil
	case "IN":
		if values, ok := filter.Value.([]interface{}); ok {
			var valueStrs []string
			for _, v := range values {
				valueStrs = append(valueStrs, fmt.Sprintf("'%v'", v))
			}
			return fmt.Sprintf("%s IN (%s)", column, strings.Join(valueStrs, ", ")), nil
		}
		return "", fmt.Errorf("IN operator requires array value")
	case "NOT IN":
		if values, ok := filter.Value.([]interface{}); ok {
			var valueStrs []string
			for _, v := range values {
				valueStrs = append(valueStrs, fmt.Sprintf("'%v'", v))
			}
			return fmt.Sprintf("%s NOT IN (%s)", column, strings.Join(valueStrs, ", ")), nil
		}
		return "", fmt.Errorf("NOT IN operator requires array value")
	case "LIKE", "NOT LIKE":
		return fmt.Sprintf("%s %s '%v'", column, filter.Operator, filter.Value), nil
	default:
		return "", fmt.Errorf("unsupported operator: %s", filter.Operator)
	}
}