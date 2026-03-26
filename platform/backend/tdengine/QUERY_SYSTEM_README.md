# TDengine Flexible Query System

## Overview

The TDengine Flexible Query System provides a comprehensive, high-performance data querying solution for time-series data. It offers multiple query interfaces, intelligent caching, query optimization, and performance monitoring capabilities.

## Features

### 🚀 Multiple Query Interfaces
- **Raw SQL Queries**: Execute custom SQL with full TDengine syntax support
- **Structured Queries**: Build queries programmatically with type-safe interfaces
- **Aggregation Queries**: Specialized interface for time-series aggregations
- **Pagination Support**: Efficient pagination for large result sets

### ⚡ Performance Optimization
- **Query Optimizer**: Automatic SQL optimization with multiple optimization rules
- **Intelligent Caching**: LRU cache with TTL support and hit rate monitoring
- **Query Monitoring**: Comprehensive performance tracking and slow query detection
- **Connection Pooling**: Efficient database connection management

### 📊 Advanced Features
- **Time Window Queries**: Built-in support for time-based aggregations
- **Tag-based Filtering**: Optimized queries using TDengine's tag indexing
- **Query Statistics**: Real-time performance metrics and analytics
- **Error Handling**: Robust error handling with retry mechanisms

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Query System  │    │  Query Cache    │    │ Query Optimizer │
│                 │    │                 │    │                 │
│ - SQL Interface │    │ - LRU Eviction  │    │ - Rule Engine   │
│ - Structured    │◄──►│ - TTL Support   │◄──►│ - Cost Estimation│
│ - Aggregation   │    │ - Hit Rate      │    │ - Suggestions   │
│ - Pagination    │    │   Tracking      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Query Monitor   │
                    │                 │
                    │ - Execution     │
                    │   Tracking      │
                    │ - Performance   │
                    │   Metrics       │
                    │ - Slow Query    │
                    │   Detection     │
                    └─────────────────┘
```

## Quick Start

### Basic Setup

```go
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
    log.Fatal(err)
}

service := NewTDengineService(manager)
```

### Raw SQL Query

```go
sqlRequest := &SQLQueryRequest{
    SQL:      "SELECT ts, value FROM modbus_metrics WHERE ts >= '2024-01-01 00:00:00' LIMIT 100",
    Database: "industrial_data",
    Timeout:  30 * time.Second,
    UseCache: true,
}

result, err := service.ExecuteSQL(ctx, sqlRequest)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Query returned %d rows in %v\n", result.Count, result.QueryTime)
```

### Structured Query

```go
structuredRequest := &StructuredQueryRequest{
    Database: "industrial_data",
    Table:    "modbus_metrics",
    Columns:  []string{"ts", "value", "quality"},
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
            "quality": {Operator: ">=", Value: 1},
            "value":   {Operator: ">", Value: 0},
        },
    },
    OrderBy: []OrderByClause{
        {Column: "ts", Direction: "DESC"},
    },
    Limit:    500,
    UseCache: true,
}

result, err := service.ExecuteStructuredQuery(ctx, structuredRequest)
```

### Aggregation Query with Time Windows

```go
aggregationRequest := &AggregationQueryRequest{
    Database: "industrial_data",
    Table:    "modbus_metrics",
    Aggregations: []AggregationFunction{
        {Function: "AVG", Column: "value", Alias: "avg_value"},
        {Function: "MAX", Column: "value", Alias: "max_value"},
        {Function: "COUNT", Column: "*", Alias: "count"},
    },
    TimeWindow: &TimeWindowConfig{
        Interval: "1h",
        Start:    time.Now().Add(-24 * time.Hour),
        End:      time.Now(),
        Fill:     "NULL",
    },
    GroupBy: []string{"collector_id", "device_id"},
    UseCache: true,
}

result, err := service.ExecuteAggregationQuery(ctx, aggregationRequest)
```

### Paginated Query

```go
pagination := &PaginationRequest{
    Page: 1,
    Size: 50,
}

paginatedResult, err := service.ExecuteWithPagination(ctx, structuredRequest, pagination)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Page %d/%d, %d rows, Total: %d\n", 
    paginatedResult.Page, paginatedResult.TotalPages, 
    paginatedResult.Count, paginatedResult.TotalCount)
```

## Query Optimization

### Automatic Optimization Rules

The query optimizer applies several optimization rules automatically:

1. **Time Partitioning**: Adds partition pruning hints for time-based queries
2. **Column Pruning**: Optimizes column selection to reduce data transfer
3. **Predicate Pushdown**: Pushes filter conditions down to reduce scanning
4. **Index Hints**: Adds tag index hints for tag-based queries
5. **Aggregation Optimization**: Optimizes aggregation function execution

### Manual Optimization

```go
querySystem := service.GetQuerySystem()

// Get optimization suggestions
suggestions := querySystem.optimizer.GetOptimizationSuggestions(sql)
for _, suggestion := range suggestions {
    fmt.Printf("Suggestion: %s\n", suggestion)
}

// Estimate query cost
cost := querySystem.optimizer.EstimateQueryCost(sql)
fmt.Printf("Estimated cost: %d\n", cost)

// Apply optimizations
optimizedSQL := querySystem.optimizer.OptimizeSQL(sql)
```

## Caching

### Cache Configuration

```go
cacheConfig := &QueryCacheConfig{
    MaxSize:         1000,              // Maximum number of cached queries
    DefaultTTL:      5 * time.Minute,   // Default cache TTL
    CleanupInterval: 1 * time.Minute,   // Cleanup frequency
    Enabled:         true,              // Enable/disable caching
}

querySystem := NewQuerySystem(service, &QuerySystemConfig{
    CacheConfig: cacheConfig,
})
```

### Cache Operations

```go
// Get cache statistics
cacheStats := service.GetQueryCacheStatistics()
fmt.Printf("Cache hit rate: %v\n", cacheStats["hit_rate"])

// Clear cache
service.ClearQueryCache()

// Check if caching is enabled
if querySystem.cache.IsEnabled() {
    fmt.Println("Caching is enabled")
}
```

## Performance Monitoring

### Query Statistics

```go
// Get comprehensive query statistics
stats := service.GetQueryStatistics()
fmt.Printf("Total queries: %v\n", stats["total_queries"])
fmt.Printf("Success rate: %v\n", stats["success_rate"])
fmt.Printf("Average latency: %v\n", stats["average_latency"])
fmt.Printf("Cache hit rate: %v\n", stats["cache_hit_rate"])
```

### Query Execution Tracking

```go
querySystem := service.GetQuerySystem()

// Get recent queries
recentQueries := querySystem.monitor.GetRecentQueries(10)
for _, query := range recentQueries {
    fmt.Printf("Query: %s, Duration: %v, Status: %s\n", 
        query.Type, query.Duration, query.Status)
}

// Get slow queries
slowQueries := querySystem.monitor.GetSlowQueries(5)
for _, query := range slowQueries {
    fmt.Printf("Slow query: %s, Duration: %v\n", 
        query.SQL, query.Duration)
}
```

### Performance Metrics

```go
// Get detailed performance metrics
metrics := querySystem.monitor.GetPerformanceMetrics()
fmt.Printf("Query type distribution: %v\n", metrics["query_type_distribution"])
fmt.Printf("Status distribution: %v\n", metrics["status_distribution"])

// Get hourly statistics
hourlyStats := querySystem.monitor.GetHourlyStatistics()
for hour, stats := range hourlyStats {
    fmt.Printf("Hour %s: %d queries, %.2f%% errors\n", 
        hour, stats.QueryCount, float64(stats.ErrorCount)/float64(stats.QueryCount)*100)
}
```

## Configuration

### Query System Configuration

```go
config := &QuerySystemConfig{
    CacheConfig: &QueryCacheConfig{
        MaxSize:         1000,
        DefaultTTL:      5 * time.Minute,
        CleanupInterval: 1 * time.Minute,
        Enabled:         true,
    },
    OptimizerConfig: &QueryOptimizerConfig{
        Enabled:                 true,
        EnableIndexHints:        true,
        EnableTimePartitioning:  true,
        EnableColumnPruning:     true,
        EnablePredicatePushdown: true,
    },
    MonitorConfig: &QueryMonitorConfig{
        Enabled:             true,
        MaxQueryHistory:     1000,
        SlowQueryThreshold:  5 * time.Second,
        EnableDetailedStats: true,
        RetentionPeriod:     24 * time.Hour,
    },
}

querySystem := NewQuerySystem(service, config)
```

## API Reference

### Core Interfaces

#### SQLQueryRequest
```go
type SQLQueryRequest struct {
    SQL      string        `json:"sql" binding:"required"`
    Database string        `json:"database"`
    Timeout  time.Duration `json:"timeout"`
    UseCache bool          `json:"use_cache"`
}
```

#### StructuredQueryRequest
```go
type StructuredQueryRequest struct {
    Database   string           `json:"database" binding:"required"`
    Table      string           `json:"table" binding:"required"`
    Columns    []string         `json:"columns"`
    Conditions *QueryConditions `json:"conditions"`
    OrderBy    []OrderByClause  `json:"order_by"`
    GroupBy    []string         `json:"group_by"`
    Having     *QueryConditions `json:"having"`
    Limit      int              `json:"limit"`
    Offset     int              `json:"offset"`
    UseCache   bool             `json:"use_cache"`
}
```

#### AggregationQueryRequest
```go
type AggregationQueryRequest struct {
    Database     string                `json:"database" binding:"required"`
    Table        string                `json:"table" binding:"required"`
    Aggregations []AggregationFunction `json:"aggregations" binding:"required"`
    GroupBy      []string              `json:"group_by"`
    TimeWindow   *TimeWindowConfig     `json:"time_window"`
    Conditions   *QueryConditions      `json:"conditions"`
    OrderBy      []OrderByClause       `json:"order_by"`
    Limit        int                   `json:"limit"`
    UseCache     bool                  `json:"use_cache"`
}
```

#### QueryResult
```go
type QueryResult struct {
    Columns   []string                 `json:"columns"`
    Rows      []map[string]interface{} `json:"rows"`
    Count     int                      `json:"count"`
    QueryTime time.Duration            `json:"query_time"`
    Cached    bool                     `json:"cached"`
    QueryID   string                   `json:"query_id"`
}
```

### Service Methods

```go
// Core query methods
ExecuteSQL(ctx context.Context, req *SQLQueryRequest) (*QueryResult, error)
ExecuteStructuredQuery(ctx context.Context, req *StructuredQueryRequest) (*QueryResult, error)
ExecuteAggregationQuery(ctx context.Context, req *AggregationQueryRequest) (*QueryResult, error)
ExecuteWithPagination(ctx context.Context, req *StructuredQueryRequest, pagination *PaginationRequest) (*PaginatedResult, error)

// Convenience methods
QueryLatestByTags(ctx context.Context, database, table string, tags map[string]string, limit int) (*QueryResult, error)
QueryTimeRange(ctx context.Context, database, table string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error)
QueryAggregationWithTimeWindow(ctx context.Context, database, table, aggFunc, column, interval string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error)

// Statistics and management
GetQueryStatistics() map[string]interface{}
GetQueryCacheStatistics() map[string]interface{}
ClearQueryCache()
```

## Best Practices

### Query Performance

1. **Use Time Range Filters**: Always include time range conditions for better performance
2. **Limit Result Sets**: Use LIMIT clauses to prevent large result sets
3. **Select Specific Columns**: Avoid SELECT * when possible
4. **Use Tag Indexing**: Filter by tag columns for optimal performance
5. **Enable Caching**: Use caching for frequently executed queries

### Cache Management

1. **Set Appropriate TTL**: Balance between data freshness and cache efficiency
2. **Monitor Hit Rates**: Aim for cache hit rates above 70%
3. **Size Cache Appropriately**: Set cache size based on available memory
4. **Clear Cache When Needed**: Clear cache after schema changes

### Monitoring

1. **Track Slow Queries**: Monitor queries exceeding performance thresholds
2. **Analyze Query Patterns**: Use statistics to identify optimization opportunities
3. **Set Alerts**: Configure alerts for high error rates or slow performance
4. **Regular Cleanup**: Ensure monitoring data doesn't consume excessive resources

## Error Handling

The query system provides comprehensive error handling:

```go
result, err := service.ExecuteSQL(ctx, request)
if err != nil {
    switch {
    case strings.Contains(err.Error(), "timeout"):
        // Handle timeout errors
        log.Printf("Query timeout: %v", err)
    case strings.Contains(err.Error(), "syntax"):
        // Handle SQL syntax errors
        log.Printf("SQL syntax error: %v", err)
    case strings.Contains(err.Error(), "connection"):
        // Handle connection errors
        log.Printf("Database connection error: %v", err)
    default:
        // Handle other errors
        log.Printf("Query error: %v", err)
    }
    return
}
```

## Testing

Run the test suite:

```bash
# Run all query system tests
go test -v ./platform/backend/tdengine -run TestQuerySystem

# Run specific component tests
go test -v ./platform/backend/tdengine -run TestQueryCache
go test -v ./platform/backend/tdengine -run TestQueryOptimizer
go test -v ./platform/backend/tdengine -run TestQueryMonitor

# Run with coverage
go test -v -cover ./platform/backend/tdengine
```

## Examples

See `query_system_example.go` for comprehensive usage examples including:

- Basic query operations
- Complex aggregation queries
- Performance monitoring
- Cache management
- Query optimization

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce cache size or enable more aggressive cleanup
2. **Slow Queries**: Enable query optimization and monitor slow query logs
3. **Low Cache Hit Rate**: Increase cache TTL or review query patterns
4. **Connection Timeouts**: Increase timeout values or check network connectivity

### Debug Mode

Enable debug logging for detailed query information:

```go
// Enable detailed monitoring
config := &QueryMonitorConfig{
    Enabled:             true,
    EnableDetailedStats: true,
}
```

## Performance Benchmarks

Typical performance characteristics:

- **Simple Queries**: < 10ms
- **Aggregation Queries**: 50-200ms
- **Complex Time Window Queries**: 100-500ms
- **Cache Hit Latency**: < 1ms
- **Cache Miss Overhead**: 2-5ms

## Contributing

When contributing to the query system:

1. Add comprehensive tests for new features
2. Update documentation for API changes
3. Follow existing code patterns and conventions
4. Ensure backward compatibility when possible
5. Add performance benchmarks for new query types

## License

This query system is part of the ProDB project and follows the same licensing terms.