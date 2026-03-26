# Monitoring and Alerting System

## Overview

The ProDB monitoring and alerting system provides comprehensive monitoring capabilities for data collectors, including heartbeat monitoring, performance tracking, alert rule management, and capacity planning. The system is designed to ensure high availability and optimal performance of the data collection infrastructure.

## Architecture

### Core Components

1. **HeartbeatService** - Monitors collector connectivity and basic health
2. **AlertService** - Manages alert lifecycle and notifications
3. **AlertRulesEngine** - Evaluates conditions and triggers alerts
4. **PerformanceMonitor** - Tracks performance metrics and trends

### Data Flow

```
Collector → Heartbeat → HeartbeatService → AlertRulesEngine → AlertService → Notifications
                    ↓
                PerformanceMonitor → Metrics Storage → Trend Analysis → Capacity Planning
```

## Features

### 1. Heartbeat Monitoring

#### Capabilities
- **Real-time Status Tracking**: Monitor collector online/offline status
- **Metrics Collection**: Gather system and application metrics
- **Historical Analysis**: Track uptime/downtime patterns
- **Automatic Alerts**: Trigger alerts for offline collectors

#### Key Metrics
- Last heartbeat timestamp
- Consecutive failures count
- Total uptime/downtime
- Heartbeat success rate
- Average response latency

#### Configuration
```json
{
  "offline_threshold": "5m",
  "warning_threshold": "3m",
  "cleanup_interval": "1h",
  "retention_period": "30d"
}
```

### 2. Alert Rules Engine

#### Rule Types
- **Threshold-based**: CPU > 80%, Memory > 90%
- **Status-based**: Collector offline, Connection failed
- **Trend-based**: Increasing error rate, Degrading performance
- **Custom**: User-defined conditions with flexible syntax

#### Rule Syntax
```javascript
// Simple comparisons
cpu_usage > 80
memory_usage_percent > 90
status == 'offline'

// Complex conditions (future enhancement)
cpu_usage > 80 && memory_usage_percent > 85
error_rate > 0.1 || consecutive_failures > 3
```

#### Rule Management
- **CRUD Operations**: Create, read, update, delete rules
- **Enable/Disable**: Toggle rules without deletion
- **Templates**: Predefined rule templates for common scenarios
- **Testing**: Test rules against sample data
- **Versioning**: Track rule changes and history

#### Default Rules
1. **Collector Offline** - Critical alert when collector goes offline
2. **High CPU Usage** - Warning when CPU usage exceeds 80%
3. **High Memory Usage** - Warning when memory usage exceeds 90%
4. **High Error Rate** - Warning when error rate exceeds 10%
5. **Consecutive Failures** - Critical alert for multiple heartbeat failures

### 3. Performance Monitoring

#### System Metrics
- **CPU Usage**: Percentage utilization
- **Memory Usage**: Used/total memory and percentage
- **Disk Usage**: Used/total disk space and percentage
- **Network I/O**: Bytes in/out, latency
- **Application Metrics**: Goroutines, heap usage, GC pauses

#### Collector-Specific Metrics
- **Data Points per Second**: Collection rate
- **Active/Failed Connections**: Connection health
- **Buffer Size**: Data buffer utilization
- **Cached Data Count**: Local cache status
- **Error Rate**: Percentage of failed operations

#### Performance Analysis
- **Trend Analysis**: Identify increasing/decreasing/stable trends
- **Anomaly Detection**: Detect values beyond normal ranges
- **Health Scoring**: Overall health score (0-100)
- **Capacity Planning**: Predict future resource needs

#### Thresholds
```json
{
  "cpu_usage_warning": 80.0,
  "cpu_usage_critical": 95.0,
  "memory_usage_warning": 85.0,
  "memory_usage_critical": 95.0,
  "disk_usage_warning": 80.0,
  "disk_usage_critical": 90.0,
  "error_rate_warning": 5.0,
  "error_rate_critical": 10.0
}
```

### 4. Alert Management

#### Alert Lifecycle
1. **Active** - Alert is fired and needs attention
2. **Acknowledged** - Alert has been seen by an operator
3. **Resolved** - Issue has been fixed

#### Notification Channels
- **Log Notifier** - System log entries (default)
- **Email Notifier** - Email notifications (configurable)
- **Webhook Notifier** - HTTP webhook calls (configurable)
- **Custom Notifiers** - Extensible notification system

#### Alert Aggregation
- **Deduplication** - Prevent duplicate alerts for same issue
- **Throttling** - Limit alert frequency per rule
- **Auto-resolution** - Automatically resolve alerts when conditions clear

## API Endpoints

### Heartbeat Monitoring

```http
# Process heartbeat from collector
POST /api/v1/collectors/{id}/heartbeat

# Get collector status
GET /api/v1/collectors/{id}/status

# Get heartbeat statistics
GET /api/v1/collectors/{id}/heartbeat/statistics?period=24h

# Get metrics history
GET /api/v1/collectors/{id}/metrics/history?since=24h&limit=1000

# Get recent heartbeats
GET /api/v1/collectors/{id}/heartbeat/recent?limit=50

# Get health summary
GET /api/v1/health/summary
```

### Alert Management

```http
# Get active alerts
GET /api/v1/alerts/active

# Acknowledge alert
POST /api/v1/alerts/{id}/acknowledge

# Resolve alert
POST /api/v1/alerts/{id}/resolve

# Get alert statistics
GET /api/v1/alerts/statistics?period=24h

# Get collector alerts
GET /api/v1/collectors/{id}/alerts?limit=100
```

### Alert Rules

```http
# List all rules
GET /api/v1/alert-rules

# Create rule
POST /api/v1/alert-rules

# Get specific rule
GET /api/v1/alert-rules/{id}

# Update rule
PUT /api/v1/alert-rules/{id}

# Delete rule
DELETE /api/v1/alert-rules/{id}

# Enable/disable rule
POST /api/v1/alert-rules/{id}/enable
POST /api/v1/alert-rules/{id}/disable

# Get rule templates
GET /api/v1/alert-rules/templates

# Test rule condition
POST /api/v1/alert-rules/test

# Create from template
POST /api/v1/alert-rules/from-template

# Get rule statistics
GET /api/v1/alert-rules/statistics

# Get evaluation history
GET /api/v1/alert-rules/evaluation-history
```

### Performance Monitoring

```http
# Get performance metrics
GET /api/v1/collectors/{id}/performance/metrics?since=24h&limit=1000

# Get performance trend
GET /api/v1/collectors/{id}/performance/trend?metric=cpu_usage&period=7d

# Get capacity plan
GET /api/v1/collectors/{id}/performance/capacity-plan

# Get monitoring statistics
GET /api/v1/performance/monitoring/stats

# Get/update thresholds
GET /api/v1/performance/thresholds
PUT /api/v1/performance/thresholds

# Get performance summary
GET /api/v1/performance/summary

# Get performance alerts
GET /api/v1/performance/alerts

# Get resource utilization
GET /api/v1/performance/resource-utilization

# Get recommendations
GET /api/v1/performance/recommendations
```

## Configuration

### Service Configuration

```go
// Heartbeat service configuration
heartbeatConfig := services.HeartbeatConfig{
    OfflineThreshold:  5 * time.Minute,
    WarningThreshold:  3 * time.Minute,
    CleanupInterval:   1 * time.Hour,
    RetentionPeriod:   30 * 24 * time.Hour,
}

// Performance monitoring configuration
performanceConfig := services.PerformanceConfig{
    MonitoringInterval: 1 * time.Minute,
    RetentionPeriod:    30 * 24 * time.Hour,
}
```

### Database Schema

The system uses the following database tables:

- **collector_heartbeats** - Individual heartbeat records
- **collector_status** - Current collector status and statistics
- **collector_metrics_history** - Historical performance metrics
- **collector_alerts** - Alert records and management

## Usage Examples

### Creating Alert Rules

```bash
# Create a CPU usage alert rule
curl -X POST http://localhost:8088/api/v1/alert-rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High CPU Usage",
    "description": "Alert when CPU usage exceeds 80%",
    "condition": "cpu_usage > 80",
    "severity": "warning",
    "enabled": true,
    "actions": [
      {
        "type": "log",
        "enabled": true,
        "template": "High CPU usage detected: {{cpu_usage}}%"
      }
    ]
  }'
```

### Testing Alert Rules

```bash
# Test a rule condition
curl -X POST http://localhost:8088/api/v1/alert-rules/test \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "cpu_usage > 80",
    "test_data": {
      "cpu_usage": 85.5,
      "memory_usage": 70.2
    }
  }'
```

### Getting Performance Trends

```bash
# Get CPU usage trend for last 7 days
curl "http://localhost:8088/api/v1/collectors/{collector-id}/performance/trend?metric=cpu_usage&period=168h"
```

### Updating Performance Thresholds

```bash
# Update performance thresholds
curl -X PUT http://localhost:8088/api/v1/performance/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "cpu_usage_warning": 75.0,
    "cpu_usage_critical": 90.0,
    "memory_usage_warning": 80.0,
    "memory_usage_critical": 95.0
  }'
```

## Monitoring Best Practices

### 1. Threshold Configuration
- Set warning thresholds at 80% of capacity
- Set critical thresholds at 95% of capacity
- Adjust thresholds based on historical data
- Review and update thresholds regularly

### 2. Alert Management
- Acknowledge alerts promptly to avoid noise
- Resolve alerts when issues are fixed
- Use throttling to prevent alert storms
- Set up escalation for critical alerts

### 3. Performance Monitoring
- Monitor trends over time, not just current values
- Use capacity planning to predict future needs
- Set up alerts for anomalous behavior
- Regular review of performance metrics

### 4. Data Retention
- Keep detailed metrics for 30 days
- Archive summary data for longer periods
- Clean up old data regularly
- Monitor storage usage

## Troubleshooting

### Common Issues

1. **Missing Heartbeats**
   - Check network connectivity
   - Verify collector configuration
   - Review authentication status
   - Check collector logs

2. **False Alerts**
   - Review threshold settings
   - Check for data quality issues
   - Verify rule conditions
   - Adjust throttling settings

3. **Performance Issues**
   - Monitor database performance
   - Check memory usage
   - Review query efficiency
   - Optimize data retention

### Diagnostic Queries

```sql
-- Check collector status
SELECT c.name, cs.status, cs.last_heartbeat, cs.consecutive_failures
FROM collectors c
LEFT JOIN collector_status cs ON c.id = cs.collector_id
ORDER BY cs.last_heartbeat DESC;

-- Alert frequency by type
SELECT alert_type, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (resolved_at - fired_at))) as avg_duration
FROM collector_alerts
WHERE fired_at >= NOW() - INTERVAL '24 hours'
GROUP BY alert_type;

-- Performance metrics summary
SELECT collector_id, 
       AVG(cpu_usage) as avg_cpu,
       AVG(memory_usage) as avg_memory,
       COUNT(*) as metric_count
FROM collector_metrics_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY collector_id;
```

## Future Enhancements

1. **Machine Learning Integration**
   - Anomaly detection using ML models
   - Predictive alerting
   - Automated threshold adjustment

2. **Advanced Analytics**
   - Correlation analysis between metrics
   - Root cause analysis
   - Performance optimization recommendations

3. **Enhanced Notifications**
   - Mobile push notifications
   - Slack/Teams integration
   - SMS notifications for critical alerts

4. **Dashboard Integration**
   - Real-time monitoring dashboards
   - Custom metric visualizations
   - Interactive performance analysis

5. **Multi-tenancy Support**
   - Tenant-specific thresholds
   - Isolated alert management
   - Role-based access control