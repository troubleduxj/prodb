# Heartbeat Monitoring System

## Overview

The heartbeat monitoring system provides comprehensive monitoring and alerting capabilities for data collectors in the ProDB platform. It tracks collector health, performance metrics, and automatically detects offline or problematic collectors.

## Architecture

### Components

1. **HeartbeatService** - Core service for processing heartbeats and monitoring collector status
2. **AlertService** - Manages alerts and notifications for collector issues
3. **HeartbeatHandler** - HTTP API handlers for heartbeat-related endpoints
4. **HeartbeatManager** (Collector-side) - Enhanced heartbeat client with metrics collection

### Database Models

- **CollectorHeartbeat** - Stores individual heartbeat records
- **CollectorStatus** - Tracks current collector status and statistics
- **CollectorMetricsHistory** - Historical performance metrics
- **CollectorAlert** - Alert records and management

## Features

### 1. Heartbeat Processing

- **Automatic Processing**: Collectors send periodic heartbeats with status and metrics
- **Metrics Collection**: System and application metrics are collected and stored
- **Status Tracking**: Real-time collector status monitoring
- **Historical Data**: Heartbeat and metrics history for trend analysis

### 2. Offline Detection

- **Configurable Thresholds**: Warning and offline thresholds (default: 3min warning, 5min offline)
- **Automatic Alerts**: Alerts triggered when collectors go offline or show warning signs
- **Status Transitions**: Tracks online/offline transitions and calculates uptime/downtime

### 3. Performance Monitoring

- **System Metrics**: CPU usage, memory usage, disk usage, network I/O
- **Application Metrics**: Buffer size, cached data count, connection status
- **Heartbeat Statistics**: Success rate, latency, consecutive failures

### 4. Alert Management

- **Multiple Severity Levels**: Critical, warning, info
- **Alert Types**: Offline, warning, high error rate, resource usage
- **Notification Channels**: Email, webhook, system log (extensible)
- **Alert Lifecycle**: Active → Acknowledged → Resolved

## API Endpoints

### Heartbeat Processing

```http
POST /api/v1/collectors/{id}/heartbeat
```

Process incoming heartbeat from collector.

**Request Body:**
```json
{
  "collector_id": "uuid",
  "timestamp": "2024-01-01T00:00:00Z",
  "status": "running",
  "metrics": {
    "cpu_usage": 25.5,
    "memory_usage": 1024000000,
    "uptime": 3600,
    "buffer_size": 100,
    "cached_data": 500
  }
}
```

### Status Monitoring

```http
GET /api/v1/collectors/{id}/status
```

Get current collector status and statistics.

**Response:**
```json
{
  "collector_id": "uuid",
  "status": "running",
  "last_heartbeat": "2024-01-01T00:00:00Z",
  "last_online": "2024-01-01T00:00:00Z",
  "consecutive_failures": 0,
  "total_uptime": 86400,
  "total_downtime": 0
}
```

### Heartbeat Statistics

```http
GET /api/v1/collectors/{id}/heartbeat/statistics?period=24h
```

Get heartbeat statistics for a specific period.

**Response:**
```json
{
  "collector_id": "uuid",
  "collector_name": "Factory A Collector",
  "status": "running",
  "uptime_percent": 99.5,
  "total_heartbeats": 1440,
  "missed_heartbeats": 7,
  "consecutive_failures": 0
}
```

### Metrics History

```http
GET /api/v1/collectors/{id}/metrics/history?since=24h&limit=1000
```

Get historical metrics data.

### Health Summary

```http
GET /api/v1/health/summary
```

Get overall collector health summary.

**Response:**
```json
{
  "total_collectors": 10,
  "online_collectors": 8,
  "offline_collectors": 1,
  "warning_collectors": 1,
  "overall_health": 80.0,
  "last_updated": "2024-01-01T00:00:00Z"
}
```

### Alert Management

```http
GET /api/v1/alerts/active
POST /api/v1/alerts/{id}/acknowledge
POST /api/v1/alerts/{id}/resolve
GET /api/v1/alerts/statistics?period=24h
```

## Configuration

### Heartbeat Service Configuration

```go
type HeartbeatConfig struct {
    OfflineThreshold  time.Duration // 5 minutes default
    WarningThreshold  time.Duration // 3 minutes default
    CleanupInterval   time.Duration // 1 hour default
    RetentionPeriod   time.Duration // 30 days default
}
```

### Collector Configuration

```json
{
  "heartbeat_interval": 60,
  "collector_id": "uuid",
  "platform": {
    "base_url": "https://platform.example.com",
    "heartbeat_url": "/api/v1/collectors/%s/heartbeat"
  }
}
```

## Collector-Side Implementation

### Enhanced HeartbeatManager

The collector-side heartbeat manager provides:

- **Automatic Heartbeats**: Configurable interval (default 60 seconds)
- **Metrics Collection**: System and application metrics
- **Network Awareness**: Skips heartbeats when network is offline
- **Statistics Tracking**: Success rate, latency, failure counts
- **Health Status**: Overall heartbeat health assessment

### Usage Example

```go
// Create heartbeat manager
heartbeatMgr := heartbeat.NewHeartbeatManager(config, platformClient, logger)

// Start heartbeat service
err := heartbeatMgr.Start(ctx)
if err != nil {
    log.Fatal("Failed to start heartbeat manager:", err)
}

// Send manual heartbeat with additional metrics
additionalMetrics := map[string]interface{}{
    "custom_metric": 42.0,
    "data_points_collected": 1000,
}
err = heartbeatMgr.SendHeartbeat("running", additionalMetrics)

// Get heartbeat statistics
stats := heartbeatMgr.GetStats()
fmt.Printf("Total sent: %d, Failed: %d\n", stats.TotalSent, stats.TotalFailed)

// Stop heartbeat service
heartbeatMgr.Stop()
```

## Monitoring and Alerting

### Alert Types

1. **collector_offline** - Collector hasn't sent heartbeat within offline threshold
2. **collector_warning** - Collector heartbeat is delayed but within offline threshold
3. **high_error_rate** - High rate of failed operations or connections
4. **resource_usage** - High CPU, memory, or disk usage

### Notification Channels

1. **LogNotifier** - Logs alerts to system log (default)
2. **EmailNotifier** - Sends email notifications (configurable)
3. **WebhookNotifier** - Sends HTTP webhook notifications (configurable)

### Adding Custom Notifiers

```go
// Implement AlertNotifier interface
type CustomNotifier struct {
    // Configuration fields
}

func (cn *CustomNotifier) SendAlert(alert models.CollectorAlert) error {
    // Custom notification logic
    return nil
}

func (cn *CustomNotifier) GetType() string {
    return "custom"
}

// Add to alert service
alertService.AddNotifier(&CustomNotifier{})
```

## Data Retention

- **Heartbeat Records**: Configurable retention (default 30 days)
- **Metrics History**: Configurable retention (default 30 days)
- **Resolved Alerts**: Cleaned up after retention period
- **Automatic Cleanup**: Runs periodically (default every hour)

## Performance Considerations

- **Batch Processing**: Heartbeats processed individually but metrics stored efficiently
- **Database Indexing**: Proper indexes on timestamp and collector_id fields
- **Cleanup Process**: Regular cleanup prevents database bloat
- **Connection Pooling**: Efficient database connection management

## Troubleshooting

### Common Issues

1. **Collectors Not Sending Heartbeats**
   - Check network connectivity
   - Verify collector configuration
   - Check authentication tokens

2. **False Offline Alerts**
   - Adjust offline threshold
   - Check network stability
   - Review collector logs

3. **High Database Usage**
   - Reduce retention period
   - Increase cleanup frequency
   - Optimize database queries

### Monitoring Queries

```sql
-- Check collector status
SELECT c.name, cs.status, cs.last_heartbeat, cs.consecutive_failures
FROM collectors c
LEFT JOIN collector_status cs ON c.id = cs.collector_id
ORDER BY cs.last_heartbeat DESC;

-- Alert statistics
SELECT alert_type, severity, COUNT(*) as count
FROM collector_alerts
WHERE fired_at >= NOW() - INTERVAL '24 hours'
GROUP BY alert_type, severity;

-- Heartbeat frequency by collector
SELECT collector_id, COUNT(*) as heartbeat_count,
       MIN(timestamp) as first_heartbeat,
       MAX(timestamp) as last_heartbeat
FROM collector_heartbeats
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY collector_id;
```

## Future Enhancements

1. **Predictive Alerting** - ML-based anomaly detection
2. **Custom Metrics** - User-defined metrics and thresholds
3. **Dashboard Integration** - Real-time monitoring dashboards
4. **Mobile Notifications** - Push notifications for critical alerts
5. **Escalation Policies** - Multi-level alert escalation
6. **Maintenance Windows** - Scheduled maintenance mode