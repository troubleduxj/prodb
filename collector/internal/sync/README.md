# Network Monitoring and Data Synchronization

This package implements comprehensive network status detection and data synchronization functionality for the ProDB collector system. It provides reliable store-and-forward capabilities with exponential backoff retry strategies and failure handling.

## Overview

The sync package consists of three main components:

1. **NetworkMonitor** - Monitors network connectivity to the platform
2. **DataSyncService** - Manages data synchronization with exponential backoff retry
3. **SyncManager** - Coordinates both components and provides unified management

## Features

### Network Monitoring
- **Real-time connectivity monitoring** - Continuous health checks to platform endpoints
- **Status change callbacks** - Event-driven notifications for online/offline transitions
- **Comprehensive metrics** - Uptime percentage, response times, failure counts
- **Configurable check intervals** - Adjustable monitoring frequency
- **Force check capability** - Manual connectivity verification

### Data Synchronization
- **Batch upload optimization** - Efficient bulk data transfer
- **Exponential backoff retry** - Intelligent retry strategy with jitter
- **Permanent failure detection** - Avoids retrying unrecoverable errors
- **Network-aware operation** - Automatic sync when network comes online
- **Comprehensive metrics** - Success rates, response times, pending data counts

### Store-and-Forward Mechanism
- **Automatic caching** - Data stored locally when network is unavailable
- **FIFO cleanup** - Oldest data removed when cache limits exceeded
- **Batch confirmation** - Data marked as uploaded only after successful confirmation
- **Retry count tracking** - Failed uploads tracked for analysis

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SyncManager   │────│  NetworkMonitor  │────│  Platform API   │
│                 │    │                  │    │                 │
│  - Coordinates  │    │  - Health checks │    │  - /health      │
│  - Aggregates   │    │  - Status events │    │  - /data/batch  │
│  - Health eval  │    │  - Metrics       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ DataSyncService │────│  StorageCache    │────│  SQLite Cache   │
│                 │    │                  │    │                 │
│  - Batch sync   │    │  - Local storage │    │  - Persistent   │
│  - Retry logic  │    │  - FIFO cleanup  │    │  - Indexed      │
│  - Metrics      │    │  - Confirmation  │    │  - Optimized    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Configuration

### Platform Configuration
```json
{
  "platform": {
    "base_url": "https://platform.example.com",
    "data_upload_url": "/api/v1/data/batch",
    "timeout": 30,
    "max_retries": 3,
    "retry_delay": 5,
    "enable_compression": true
  }
}
```

### Network Monitor Settings
- **Check Interval**: 30 seconds (configurable)
- **Timeout**: Based on platform timeout configuration
- **Health Endpoint**: `/api/v1/health`

### Data Sync Settings
- **Batch Size**: 1000 records per batch
- **Base Retry Delay**: Configurable (default: 5 seconds)
- **Max Retry Delay**: 5 minutes
- **Backoff Factor**: 2.0 (exponential)
- **Jitter**: ±10% to prevent thundering herd

## Usage

### Basic Setup

```go
// Create components
networkMonitor := NewNetworkMonitor(platformConfig, logger)
dataSyncService := NewDataSyncService(platformConfig, storageCache, platformClient, networkMonitor, logger)
syncManager := NewSyncManager(platformConfig, storageCache, platformClient, logger)

// Start the sync manager (starts all components)
if err := syncManager.Start(); err != nil {
    log.Fatal("Failed to start sync manager:", err)
}
defer syncManager.Stop()
```

### Manual Operations

```go
// Check network status
if syncManager.IsNetworkOnline() {
    fmt.Println("Network is online")
}

// Trigger immediate sync
syncManager.TriggerSync()

// Wait for network to come online
err := syncManager.WaitForNetworkOnline(30 * time.Second)
if err != nil {
    fmt.Println("Network did not come online within timeout")
}

// Force network connectivity check
err := syncManager.ForceNetworkCheck()
if err != nil {
    fmt.Println("Network check failed:", err)
}
```

### Monitoring and Metrics

```go
// Get aggregated metrics
metrics := syncManager.GetAggregatedMetrics()
fmt.Printf("Overall Health: %s\n", metrics.OverallHealth)
fmt.Printf("Network Uptime: %.2f%%\n", metrics.NetworkUptime)
fmt.Printf("Sync Success Rate: %.2f%%\n", metrics.SyncSuccessRate)
fmt.Printf("Pending Data: %d records\n", metrics.TotalPendingData)

// Get detailed status
status := syncManager.GetDetailedStatus()
for key, value := range status {
    fmt.Printf("%s: %v\n", key, value)
}

// Get health summary
summary := syncManager.GetHealthSummary()
fmt.Println("Health Summary:", summary)
```

### Event Callbacks

```go
// Set up network status change callbacks
networkMonitor.SetOnStatusChangeCallback(func(oldStatus, newStatus NetworkStatus) {
    log.Printf("Network status changed: %s -> %s", oldStatus, newStatus)
})

networkMonitor.SetOnOnlineCallback(func() {
    log.Println("Network came online - triggering data sync")
})

networkMonitor.SetOnOfflineCallback(func() {
    log.Println("Network went offline - enabling store-and-forward mode")
})
```

## Health Evaluation

The system evaluates overall health based on multiple factors:

### Healthy System
- Network status: Online
- Storage: Healthy (sufficient disk space)
- Sync success rate: > 80%
- Last successful sync: < 30 minutes ago (if data pending)

### Degraded System
- Network status: Degraded or intermittent issues
- Sync success rate: 50-80%
- Last successful sync: 30 minutes - 2 hours ago
- Moderate pending data: < 50,000 records

### Unhealthy System
- Network status: Offline
- Storage: Critical disk space issues
- Sync success rate: < 50%
- Last successful sync: > 2 hours ago
- High pending data: > 50,000 records

## Retry Strategy

### Exponential Backoff Algorithm
```
delay = baseDelay * (backoffFactor ^ attempt)
delay = min(delay, maxDelay)
delay += jitter (±10%)
```

### Retry Sequence Example
- Attempt 1: Immediate
- Attempt 2: 5 seconds + jitter
- Attempt 3: 10 seconds + jitter
- Attempt 4: 20 seconds + jitter
- Attempt 5: 40 seconds + jitter
- Attempt 6+: 5 minutes + jitter (capped)

### Permanent Failure Detection
The system detects permanent failures and avoids retrying:
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 400 (Bad Request)
- HTTP 404 (Not Found)

## Error Handling

### Network Errors
- Connection timeouts
- DNS resolution failures
- Connection refused
- TLS handshake failures

### Platform Errors
- Authentication failures
- Rate limiting (HTTP 429)
- Server errors (HTTP 5xx)
- Malformed responses

### Storage Errors
- Disk space exhaustion
- Database corruption
- File system errors
- Permission issues

## Performance Considerations

### Network Monitoring
- Lightweight health checks (HEAD requests when possible)
- Configurable check intervals to balance responsiveness vs. load
- Efficient connection reuse
- Timeout management to prevent hanging

### Data Synchronization
- Batch processing for efficiency
- Compression support for large payloads
- Connection pooling for concurrent uploads
- Memory-efficient streaming for large datasets

### Storage Operations
- Indexed database queries for fast retrieval
- Batch database operations
- Automatic cleanup and optimization
- Disk space monitoring and management

## Testing

The package includes comprehensive tests covering:

### Unit Tests
- Network connectivity scenarios
- Retry logic validation
- Metrics calculation
- Health evaluation algorithms

### Integration Tests
- End-to-end sync workflows
- Network failure and recovery
- Storage cache integration
- Platform API interaction

### Performance Tests
- High-volume data synchronization
- Concurrent operation handling
- Memory usage optimization
- Database performance

## Metrics and Monitoring

### Network Metrics
```json
{
  "status": "online",
  "last_check": "2024-01-01T12:00:00Z",
  "total_checks": 1000,
  "successful_checks": 950,
  "failed_checks": 50,
  "consecutive_failures": 0,
  "uptime_percent": 95.0,
  "response_time": "150ms",
  "last_error": ""
}
```

### Sync Metrics
```json
{
  "total_sync_attempts": 100,
  "successful_syncs": 95,
  "failed_syncs": 5,
  "total_data_points_synced": 50000,
  "last_sync_time": "2024-01-01T12:00:00Z",
  "last_successful_sync": "2024-01-01T11:55:00Z",
  "current_retry_count": 0,
  "average_response_time": "2.5s",
  "pending_data_count": 1500,
  "sync_in_progress": false
}
```

### Aggregated Metrics
```json
{
  "overall_health": "healthy",
  "network_uptime": 95.0,
  "sync_success_rate": 95.0,
  "total_pending_data": 1500,
  "last_successful_sync": "2024-01-01T11:55:00Z",
  "next_scheduled_sync": "2024-01-01T12:05:00Z"
}
```

## Best Practices

### Configuration
- Set appropriate timeouts based on network conditions
- Configure retry limits to balance reliability vs. resource usage
- Monitor disk space and set appropriate cache limits
- Use compression for large data transfers

### Monitoring
- Monitor network uptime and response times
- Track sync success rates and failure patterns
- Set up alerts for prolonged offline periods
- Monitor pending data accumulation

### Troubleshooting
- Check network connectivity and DNS resolution
- Verify platform endpoint availability
- Monitor disk space and storage health
- Review authentication token validity
- Analyze retry patterns and failure types

## Dependencies

- `prodb/collector/internal/config` - Configuration management
- `prodb/collector/internal/logger` - Logging framework
- `prodb/collector/internal/storage` - Local storage cache
- `prodb/collector/internal/communication` - Platform communication
- `prodb/collector/internal/protocol` - Data protocol definitions

## Future Enhancements

- **Adaptive retry strategies** - Dynamic adjustment based on failure patterns
- **Priority-based sync** - Critical data prioritization
- **Compression optimization** - Intelligent compression selection
- **Bandwidth throttling** - Rate limiting for network-constrained environments
- **Multi-endpoint support** - Failover to backup platform endpoints
- **Advanced health scoring** - Machine learning-based health prediction