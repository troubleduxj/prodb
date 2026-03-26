package tdengine

import (
	"context"
	"fmt"
	"log"
	"time"
)

// QuerySystemExample demonstrates the usage of the flexible query system
func QuerySystemExample() {
	// Initialize TDengine service
	config := &TDengineConfig{
		Host:     "localhost",
		Port:     6030,
		Username: "root",
		Password: "taosdata",
		Database: "industrial_data",
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		log.Fatalf("Failed to create TDengine manager: %v", err)
	}

	service := NewTDengineService(manager)
	ctx := context.Background()

	// Example 1: Raw SQL Query
	fmt.Println("=== Example 1: Raw SQL Query ===")
	sqlRequest := &SQLQueryRequest{
		SQL:      "SELECT ts, value, quality FROM modbus_metrics WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59' LIMIT 100",
		Database: "industrial_data",
		Timeout:  30 * time.Second,
		UseCache: true,
	}

	result, err := service.ExecuteSQL(ctx, sqlRequest)
	if err != nil {
		log.Printf("SQL query failed: %v", err)
	} else {
		fmt.Printf("SQL Query Result: %d rows, Query Time: %v, Cached: %v\n", 
			result.Count, result.QueryTime, result.Cached)
	}

	// Example 2: Structured Query
	fmt.Println("\n=== Example 2: Structured Query ===")
	structuredRequest := &StructuredQueryRequest{
		Database: "industrial_data",
		Table:    "modbus_metrics",
		Columns:  []string{"ts", "value", "quality", "collector_id", "device_id"},
		Conditions: &QueryConditions{
			TimeRange: &TimeRangeCondition{
				Start: time.Now().Add(-24 * time.Hour),
				End:   time.Now(),
			},
			Tags: map[string]interface{}{
				"collector_id": "collector-001",
				"location":     "workshop_a",
			},
			Filters: map[string]*FilterCondition{
				"quality": {
					Operator: ">=",
					Value:    1,
				},
				"value": {
					Operator: ">",
					Value:    0,
				},
			},
			Logic: "AND",
		},
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "DESC"},
		},
		Limit:    500,
		UseCache: true,
	}

	result, err = service.ExecuteStructuredQuery(ctx, structuredRequest)
	if err != nil {
		log.Printf("Structured query failed: %v", err)
	} else {
		fmt.Printf("Structured Query Result: %d rows, Query Time: %v\n", 
			result.Count, result.QueryTime)
	}

	// Example 3: Aggregation Query with Time Window
	fmt.Println("\n=== Example 3: Aggregation Query with Time Window ===")
	aggregationRequest := &AggregationQueryRequest{
		Database: "industrial_data",
		Table:    "modbus_metrics",
		Aggregations: []AggregationFunction{
			{
				Function: "AVG",
				Column:   "value",
				Alias:    "avg_value",
			},
			{
				Function: "MAX",
				Column:   "value",
				Alias:    "max_value",
			},
			{
				Function: "MIN",
				Column:   "value",
				Alias:    "min_value",
			},
			{
				Function: "COUNT",
				Column:   "*",
				Alias:    "count",
			},
		},
		GroupBy: []string{"collector_id", "device_id"},
		TimeWindow: &TimeWindowConfig{
			Interval: "1h",
			Start:    time.Now().Add(-24 * time.Hour),
			End:      time.Now(),
			Fill:     "NULL",
		},
		Conditions: &QueryConditions{
			Tags: map[string]interface{}{
				"location": "workshop_a",
			},
		},
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "ASC"},
		},
		UseCache: true,
	}

	result, err = service.ExecuteAggregationQuery(ctx, aggregationRequest)
	if err != nil {
		log.Printf("Aggregation query failed: %v", err)
	} else {
		fmt.Printf("Aggregation Query Result: %d rows, Query Time: %v\n", 
			result.Count, result.QueryTime)
		
		// Display sample results
		if len(result.Rows) > 0 {
			fmt.Println("Sample aggregation results:")
			for i, row := range result.Rows {
				if i >= 3 { // Show only first 3 rows
					break
				}
				fmt.Printf("  Row %d: %v\n", i+1, row)
			}
		}
	}

	// Example 4: Paginated Query
	fmt.Println("\n=== Example 4: Paginated Query ===")
	paginatedRequest := &StructuredQueryRequest{
		Database: "industrial_data",
		Table:    "modbus_metrics",
		Columns:  []string{"ts", "value", "collector_id", "device_id"},
		Conditions: &QueryConditions{
			TimeRange: &TimeRangeCondition{
				Start: time.Now().Add(-2 * time.Hour),
				End:   time.Now(),
			},
		},
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "DESC"},
		},
		UseCache: true,
	}

	pagination := &PaginationRequest{
		Page: 1,
		Size: 50,
	}

	paginatedResult, err := service.ExecuteWithPagination(ctx, paginatedRequest, pagination)
	if err != nil {
		log.Printf("Paginated query failed: %v", err)
	} else {
		fmt.Printf("Paginated Query Result: Page %d/%d, %d rows, Total: %d\n", 
			paginatedResult.Page, paginatedResult.TotalPages, 
			paginatedResult.Count, paginatedResult.TotalCount)
		fmt.Printf("Has Next: %v, Has Previous: %v\n", 
			paginatedResult.HasNext, paginatedResult.HasPrev)
	}

	// Example 5: Query Latest Data by Tags
	fmt.Println("\n=== Example 5: Query Latest Data by Tags ===")
	tags := map[string]string{
		"collector_id": "collector-001",
		"device_type":  "plc",
	}

	result, err = service.QueryLatestByTags(ctx, "industrial_data", "modbus_metrics", tags, 20)
	if err != nil {
		log.Printf("Latest data query failed: %v", err)
	} else {
		fmt.Printf("Latest Data Query Result: %d rows\n", result.Count)
		if len(result.Rows) > 0 {
			fmt.Printf("Latest timestamp: %v\n", result.Rows[0]["ts"])
		}
	}

	// Example 6: Time Range Query
	fmt.Println("\n=== Example 6: Time Range Query ===")
	start := time.Now().Add(-4 * time.Hour)
	end := time.Now().Add(-2 * time.Hour)
	conditions := map[string]interface{}{
		"collector_id": "collector-001",
		"quality":      1,
	}

	result, err = service.QueryTimeRange(ctx, "industrial_data", "modbus_metrics", start, end, conditions)
	if err != nil {
		log.Printf("Time range query failed: %v", err)
	} else {
		fmt.Printf("Time Range Query Result: %d rows from %v to %v\n", 
			result.Count, start.Format("2006-01-02 15:04:05"), end.Format("2006-01-02 15:04:05"))
	}

	// Example 7: Aggregation with Time Window
	fmt.Println("\n=== Example 7: Aggregation with Time Window ===")
	result, err = service.QueryAggregationWithTimeWindow(
		ctx,
		"industrial_data",
		"modbus_metrics",
		"AVG",
		"value",
		"30m",
		time.Now().Add(-6*time.Hour),
		time.Now(),
		map[string]interface{}{
			"location": "workshop_a",
		},
	)
	if err != nil {
		log.Printf("Aggregation with time window query failed: %v", err)
	} else {
		fmt.Printf("Aggregation with Time Window Result: %d time windows\n", result.Count)
	}

	// Example 8: Query Performance Statistics
	fmt.Println("\n=== Example 8: Query Performance Statistics ===")
	queryStats := service.GetQueryStatistics()
	fmt.Printf("Query Statistics:\n")
	fmt.Printf("  Total Queries: %v\n", queryStats["total_queries"])
	fmt.Printf("  Successful Queries: %v\n", queryStats["successful_queries"])
	fmt.Printf("  Failed Queries: %v\n", queryStats["failed_queries"])
	fmt.Printf("  Cache Hit Rate: %v\n", queryStats["cache_hit_rate"])
	fmt.Printf("  Average Latency: %v\n", queryStats["average_latency"])

	// Example 9: Cache Statistics
	fmt.Println("\n=== Example 9: Cache Statistics ===")
	cacheStats := service.GetQueryCacheStatistics()
	fmt.Printf("Cache Statistics:\n")
	fmt.Printf("  Cache Enabled: %v\n", cacheStats["enabled"])
	fmt.Printf("  Cache Size: %v\n", cacheStats["size"])
	fmt.Printf("  Cache Hit Rate: %v\n", cacheStats["hit_rate"])
	fmt.Printf("  Cache Hits: %v\n", cacheStats["hits"])
	fmt.Printf("  Cache Misses: %v\n", cacheStats["misses"])

	// Example 10: Query Optimization Suggestions
	fmt.Println("\n=== Example 10: Query Optimization ===")
	querySystem := service.GetQuerySystem()
	
	// Test query optimization
	testSQL := "SELECT * FROM modbus_metrics WHERE device_id = 'device-001' ORDER BY ts DESC"
	optimizedSQL := querySystem.optimizer.OptimizeSQL(testSQL)
	fmt.Printf("Original SQL: %s\n", testSQL)
	fmt.Printf("Optimized SQL: %s\n", optimizedSQL)
	
	// Get optimization suggestions
	suggestions := querySystem.optimizer.GetOptimizationSuggestions(testSQL)
	fmt.Printf("Optimization Suggestions:\n")
	for i, suggestion := range suggestions {
		fmt.Printf("  %d. %s\n", i+1, suggestion)
	}
	
	// Estimate query cost
	cost := querySystem.optimizer.EstimateQueryCost(testSQL)
	fmt.Printf("Estimated Query Cost: %d\n", cost)

	fmt.Println("\n=== Query System Example Complete ===")
}

// DemoComplexQuery demonstrates a complex real-world query scenario
func DemoComplexQuery() {
	fmt.Println("\n=== Complex Query Demo ===")
	
	// This would typically be called with a real TDengine service
	// For demo purposes, we'll show the query structure
	
	complexRequest := &AggregationQueryRequest{
		Database: "industrial_data",
		Table:    "modbus_metrics",
		Aggregations: []AggregationFunction{
			{Function: "AVG", Column: "value", Alias: "avg_temperature"},
			{Function: "MAX", Column: "value", Alias: "max_temperature"},
			{Function: "MIN", Column: "value", Alias: "min_temperature"},
			{Function: "STDDEV", Column: "value", Alias: "temp_stddev"},
			{Function: "COUNT", Column: "*", Alias: "sample_count"},
		},
		GroupBy: []string{"collector_id", "device_id", "location"},
		TimeWindow: &TimeWindowConfig{
			Interval: "15m", // 15-minute intervals
			Start:    time.Now().Add(-7 * 24 * time.Hour), // Last 7 days
			End:      time.Now(),
			Fill:     "LINEAR", // Linear interpolation for missing values
		},
		Conditions: &QueryConditions{
			TimeRange: &TimeRangeCondition{
				Start: time.Now().Add(-7 * 24 * time.Hour),
				End:   time.Now(),
			},
			Tags: map[string]interface{}{
				"device_type": "temperature_sensor",
				"status":      "active",
			},
			Filters: map[string]*FilterCondition{
				"quality": {
					Operator: ">=",
					Value:    1,
				},
				"value": {
					Operator: ">=",
					Value:    -50, // Temperature range filter
				},
			},
			Logic: "AND",
		},
		OrderBy: []OrderByClause{
			{Column: "ts", Direction: "ASC"},
			{Column: "location", Direction: "ASC"},
		},
		Limit:    10000,
		UseCache: true,
	}

	fmt.Printf("Complex Query Configuration:\n")
	fmt.Printf("  Database: %s\n", complexRequest.Database)
	fmt.Printf("  Table: %s\n", complexRequest.Table)
	fmt.Printf("  Time Window: %s intervals\n", complexRequest.TimeWindow.Interval)
	fmt.Printf("  Time Range: %v to %v\n", 
		complexRequest.Conditions.TimeRange.Start.Format("2006-01-02 15:04:05"),
		complexRequest.Conditions.TimeRange.End.Format("2006-01-02 15:04:05"))
	fmt.Printf("  Aggregations: %d functions\n", len(complexRequest.Aggregations))
	fmt.Printf("  Group By: %v\n", complexRequest.GroupBy)
	fmt.Printf("  Filters: %d conditions\n", len(complexRequest.Conditions.Filters))
	fmt.Printf("  Cache Enabled: %v\n", complexRequest.UseCache)
}

// DemoQueryOptimization shows query optimization features
func DemoQueryOptimization() {
	fmt.Println("\n=== Query Optimization Demo ===")
	
	optimizer := NewQueryOptimizer(nil)
	
	testQueries := []string{
		"SELECT * FROM modbus_metrics WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59'",
		"SELECT * FROM modbus_metrics WHERE collector_id = 'collector-001'",
		"SELECT COUNT(*) FROM modbus_metrics GROUP BY device_id",
		"SELECT * FROM modbus_metrics ORDER BY ts DESC",
		"SELECT DISTINCT device_id FROM modbus_metrics",
	}
	
	for i, query := range testQueries {
		fmt.Printf("\nQuery %d:\n", i+1)
		fmt.Printf("  Original: %s\n", query)
		
		optimized := optimizer.OptimizeSQL(query)
		fmt.Printf("  Optimized: %s\n", optimized)
		
		cost := optimizer.EstimateQueryCost(query)
		fmt.Printf("  Estimated Cost: %d\n", cost)
		
		suggestions := optimizer.GetOptimizationSuggestions(query)
		if len(suggestions) > 0 {
			fmt.Printf("  Suggestions:\n")
			for _, suggestion := range suggestions {
				fmt.Printf("    - %s\n", suggestion)
			}
		}
	}
}

// DemoQueryMonitoring shows query monitoring features
func DemoQueryMonitoring() {
	fmt.Println("\n=== Query Monitoring Demo ===")
	
	monitor := NewQueryMonitor(nil)
	
	// Simulate some queries
	for i := 0; i < 5; i++ {
		queryID := monitor.GenerateQueryID()
		queryType := []string{"SQL", "STRUCTURED", "AGGREGATION"}[i%3]
		
		monitor.StartQuery(queryID, queryType, fmt.Sprintf("SELECT * FROM table_%d", i))
		
		// Simulate query execution time
		time.Sleep(time.Duration(10+i*5) * time.Millisecond)
		
		if i%4 == 0 {
			// Simulate error
			monitor.RecordError(queryID, fmt.Errorf("simulated error for query %d", i))
		} else {
			// Simulate success
			monitor.RecordSuccess(queryID, 100+i*50, time.Duration(10+i*5)*time.Millisecond)
		}
		
		if i%3 == 0 {
			// Simulate cache hit
			monitor.RecordCacheHit(queryID)
		}
		
		monitor.EndQuery(queryID)
	}
	
	// Display monitoring results
	stats := monitor.GetStatistics()
	fmt.Printf("Monitoring Statistics:\n")
	fmt.Printf("  Total Queries: %v\n", stats["total_queries"])
	fmt.Printf("  Success Rate: %.2f%%\n", stats["success_rate"].(float64)*100)
	fmt.Printf("  Cache Hit Rate: %.2f%%\n", stats["cache_hit_rate"].(float64)*100)
	fmt.Printf("  Average Latency: %v\n", stats["average_latency"])
	
	recentQueries := monitor.GetRecentQueries(3)
	fmt.Printf("\nRecent Queries:\n")
	for i, query := range recentQueries {
		fmt.Printf("  %d. Type: %s, Status: %s, Duration: %v\n", 
			i+1, query.Type, query.Status, query.Duration)
	}
	
	performanceMetrics := monitor.GetPerformanceMetrics()
	fmt.Printf("\nPerformance Metrics:\n")
	fmt.Printf("  Query Type Distribution: %v\n", performanceMetrics["query_type_distribution"])
	fmt.Printf("  Status Distribution: %v\n", performanceMetrics["status_distribution"])
}