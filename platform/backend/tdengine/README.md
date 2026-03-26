# TDengine Connection Management

This package provides comprehensive TDengine connection management for the ProDB platform, including connection pooling, health monitoring, and automatic reconnection capabilities.

## Features

- **Connection Pool Management**: Efficient connection pooling with configurable limits
- **Health Monitoring**: Continuous health checks with customizable intervals
- **Auto-Reconnection**: Automatic reconnection with exponential backoff
- **Metrics Collection**: Detailed metrics for monitoring and debugging
- **Error Handling**: Comprehensive error handling with specific error types
- **Thread Safety**: All operations are thread-safe

## Components

### TDengineManager

The main component that orchestrates all TDengine operations:

```go
manager, err := tdengine.NewTDengineManager(config)
if err != nil {
    log.Fatal(err)
}

// Start the manager
if err := manager.Start(); err != nil {
    log.Fatal(err)
}
defer manager.Stop()

// Execute queries
ctx := context.Background()
rows, err := manager.ExecuteQuery(ctx, "SELECT * FROM metrics LIMIT 10")
if err != nil {
    log.Printf("Query failed: %v", err)
}
```

### Configuration

Configure TDengine connection parameters:

```go
config := &tdengine.TDengineConfig{
    Host:         "localhost",
    Port:         6030,
    Username:     "root",
    Password:     "taosdata",
    Database:     "test_db",
    MaxOpenConns: 10,
    MaxIdleConns: 5,
    ConnTimeout:  30 * time.Second,
    
    // Health check settings
    HealthCheckInterval: 30 * time.Second,
    MaxRetries:         3,
    RetryInterval:      5 * time.Second,
    
    // Auto-reconnection settings
    EnableAutoReconnect:  true,
    ReconnectInterval:    10 * time.Second,
    MaxReconnectAttempts: 5,
}
```

### Connection Pool

Manages a pool of database connections:

```go
// Get a connection
conn, err := manager.GetConnection(ctx)
if err != nil {
    return err
}
defer manager.ReleaseConnection(conn)

// Use the connection
rows, err := conn.QueryContext(ctx, "SELECT NOW()")
```

### Health Monitoring

Continuous monitoring of connection health:

```go
// Check current health status
status := manager.GetHealthStatus()
fmt.Printf("Healthy: %v, Last Check: %v\n", 
    status.IsHealthy, status.LastCheck)

// Force an immediate health check
status = manager.ForceHealthCheck()

// Check if healthy
if manager.IsHealthy() {
    fmt.Println("TDengine is healthy")
}
```

### Metrics and Statistics

Monitor connection pool and query performance:

```go
// Get pool statistics
poolStats := manager.GetPoolStats()
fmt.Printf("Active: %d, Total: %d\n", 
    poolStats.ActiveConnections, poolStats.TotalConnections)

// Get database metrics
metrics := manager.GetMetrics()
fmt.Printf("Queries: %d, Failed: %d\n", 
    metrics.QueriesExecuted, metrics.QueriesFailed)
```

### Event Callbacks

Set up callbacks for connection events:

```go
manager.SetEventCallbacks(
    func() { log.Println("Connected to TDengine") },
    func() { log.Println("Disconnected from TDengine") },
    func(err error) { log.Printf("TDengine error: %v", err) },
)
```

## Error Handling

The package provides specific error types for different scenarios:

```go
if err != nil {
    switch e := err.(type) {
    case *tdengine.TDengineError:
        switch e.Code {
        case tdengine.ErrCodeConnectionFailed:
            log.Println("Connection failed")
        case tdengine.ErrCodeHealthCheckFailed:
            log.Println("Health check failed")
        case tdengine.ErrCodePoolExhausted:
            log.Println("Connection pool exhausted")
        }
    default:
        log.Printf("Other error: %v", err)
    }
}
```

## Configuration Options

### Connection Settings

- `Host`: TDengine server hostname
- `Port`: TDengine server port (default: 6030)
- `Username`: Database username
- `Password`: Database password
- `Database`: Default database name
- `ConnTimeout`: Connection timeout duration

### Pool Settings

- `MaxOpenConns`: Maximum number of open connections
- `MaxIdleConns`: Maximum number of idle connections
- `IdleTimeout`: Maximum time a connection can be idle
- `MaxLifetime`: Maximum lifetime of a connection

### Health Check Settings

- `HealthCheckInterval`: Interval between health checks
- `MaxRetries`: Maximum retry attempts for failed operations
- `RetryInterval`: Interval between retry attempts

### Reconnection Settings

- `EnableAutoReconnect`: Enable automatic reconnection
- `ReconnectInterval`: Base interval for reconnection attempts
- `MaxReconnectAttempts`: Maximum reconnection attempts

## Usage Examples

### Basic Usage

```go
package main

import (
    "context"
    "log"
    "time"
    
    "prodb/platform/backend/tdengine"
)

func main() {
    // Create configuration
    config := tdengine.DefaultTDengineConfig()
    config.Host = "your-tdengine-host"
    config.Database = "your_database"
    
    // Create manager
    manager, err := tdengine.NewTDengineManager(config)
    if err != nil {
        log.Fatal(err)
    }
    
    // Start manager
    if err := manager.Start(); err != nil {
        log.Fatal(err)
    }
    defer manager.Stop()
    
    // Execute query
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    
    rows, err := manager.ExecuteQuery(ctx, "SHOW DATABASES")
    if err != nil {
        log.Printf("Query failed: %v", err)
        return
    }
    defer rows.Close()
    
    // Process results
    for rows.Next() {
        var dbName string
        if err := rows.Scan(&dbName); err != nil {
            log.Printf("Scan error: %v", err)
            continue
        }
        log.Printf("Database: %s", dbName)
    }
}
```

### Advanced Usage with Monitoring

```go
package main

import (
    "context"
    "log"
    "time"
    
    "prodb/platform/backend/tdengine"
)

func main() {
    config := tdengine.DefaultTDengineConfig()
    config.HealthCheckInterval = 15 * time.Second
    config.EnableAutoReconnect = true
    
    manager, err := tdengine.NewTDengineManager(config)
    if err != nil {
        log.Fatal(err)
    }
    
    // Set up event callbacks
    manager.SetEventCallbacks(
        func() { log.Println("✅ Connected to TDengine") },
        func() { log.Println("❌ Disconnected from TDengine") },
        func(err error) { log.Printf("⚠️  TDengine error: %v", err) },
    )
    
    if err := manager.Start(); err != nil {
        log.Fatal(err)
    }
    defer manager.Stop()
    
    // Monitor health in a separate goroutine
    go func() {
        ticker := time.NewTicker(30 * time.Second)
        defer ticker.Stop()
        
        for range ticker.C {
            status := manager.GetHealthStatus()
            metrics := manager.GetMetrics()
            poolStats := manager.GetPoolStats()
            
            log.Printf("Health: %v, Queries: %d, Active Conns: %d",
                status.IsHealthy, metrics.QueriesExecuted, poolStats.ActiveConnections)
        }
    }()
    
    // Your application logic here
    select {}
}
```

## Testing

Run the tests with:

```bash
cd platform/backend/tdengine
go test -v
```

For benchmarks:

```bash
go test -bench=. -benchmem
```

## Requirements

- Go 1.19 or later
- TDengine 3.0+ server
- TDengine Go driver v3.5.1+

## Thread Safety

All operations in this package are thread-safe and can be used concurrently from multiple goroutines.

## Performance Considerations

- Connection pooling reduces connection overhead
- Health checks run in background to avoid blocking operations
- Automatic reconnection prevents application downtime
- Metrics collection has minimal performance impact

## Troubleshooting

### Connection Issues

1. Verify TDengine server is running and accessible
2. Check network connectivity and firewall settings
3. Validate credentials and database permissions
4. Review connection timeout settings

### Pool Exhaustion

1. Increase `MaxOpenConns` if needed
2. Ensure connections are properly released
3. Monitor connection usage patterns
4. Check for connection leaks in application code

### Health Check Failures

1. Verify TDengine server health
2. Check network stability
3. Review health check interval settings
4. Monitor server resource usage