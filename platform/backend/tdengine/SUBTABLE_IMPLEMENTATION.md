# TDengine Sub-table Management Implementation

This document describes the comprehensive sub-table management functionality implemented for the TDengine integration in the ProDB platform.

## Overview

Sub-tables in TDengine are child tables that inherit the schema from a super table but have their own unique tag values. This implementation provides automatic sub-table creation, lifecycle management, and advanced querying capabilities to support industrial data collection scenarios.

## Features

### 1. Automatic Sub-table Creation
- **Auto-creation from data points**: Automatically creates sub-tables when new devices send data
- **Intelligent naming**: Generates sub-table names based on collector ID and device ID
- **Tag extraction**: Automatically extracts and validates tags from data points
- **Idempotent operations**: Safe to call multiple times without creating duplicates

### 2. Manual Sub-table Management
- **Explicit creation**: Create sub-tables with specific names and tag values
- **Validation**: Comprehensive validation of sub-table names and tag values
- **Existence checking**: Check if sub-tables exist before operations
- **Detailed information**: Retrieve comprehensive sub-table metadata

### 3. Advanced Querying and Filtering
- **Pagination support**: List sub-tables with configurable page size
- **Tag-based filtering**: Find sub-tables matching specific tag criteria
- **Time-based filtering**: Filter by creation time and last update time
- **Record count filtering**: Filter by minimum/maximum record counts

### 4. Lifecycle Management
- **Age-based cleanup**: Automatically delete sub-tables older than specified age
- **Idle time cleanup**: Remove sub-tables that haven't been updated recently
- **Record count policies**: Manage sub-tables based on data volume
- **Archive support**: Archive data before deletion (configurable)
- **Notification system**: Notify before deletion operations

## API Reference

### Core Sub-table Operations

#### CreateSubTable
Creates a new sub-table with specified tags.

```go
func (s *TDengineService) CreateSubTable(
    ctx context.Context, 
    database, superTable, subTableName string, 
    tags map[string]interface{}, 
    options *SubTableOptions
) error
```

**Parameters:**
- `database`: Target database name
- `superTable`: Parent super table name
- `subTableName`: Name for the new sub-table
- `tags`: Tag values for the sub-table
- `options`: Creation options (e.g., IF NOT EXISTS)

**Example:**
```go
tags := map[string]interface{}{
    "collector_id": "collector-001",
    "device_id": "sensor-001",
    "location": "Workshop A",
}

err := service.CreateSubTable(ctx, "industrial_data", "sensor_metrics", "sensor_001", tags, nil)
```

#### AutoCreateSubTable
Automatically creates a sub-table from a data point.

```go
func (s *TDengineService) AutoCreateSubTable(
    ctx context.Context, 
    database, superTable string, 
    dataPoint DataPoint
) (string, error)
```

**Parameters:**
- `database`: Target database name
- `superTable`: Parent super table name
- `dataPoint`: Data point containing device and tag information

**Returns:**
- Sub-table name (generated or existing)
- Error if creation fails

**Example:**
```go
dataPoint := DataPoint{
    DeviceID: "sensor-001",
    Tags: map[string]interface{}{
        "collector_id": "collector-001",
        "location": "Workshop A",
    },
}

subTableName, err := service.AutoCreateSubTable(ctx, "industrial_data", "sensor_metrics", dataPoint)
```

#### ListSubTables
Returns a paginated list of sub-tables with optional filtering.

```go
func (s *TDengineService) ListSubTables(
    ctx context.Context, 
    database, superTable string, 
    filter *SubTableFilter, 
    page, size int
) (*PaginatedSubTableResult, error)
```

**Parameters:**
- `database`: Target database name
- `superTable`: Parent super table name
- `filter`: Optional filtering criteria
- `page`: Page number (1-based)
- `size`: Page size (max 1000)

**Example:**
```go
filter := &SubTableFilter{
    CreatedAfter: &yesterday,
    CreatedBefore: &now,
}

result, err := service.ListSubTables(ctx, "industrial_data", "sensor_metrics", filter, 1, 20)
```

#### GetSubTablesByTags
Finds sub-tables matching specific tag criteria.

```go
func (s *TDengineService) GetSubTablesByTags(
    ctx context.Context, 
    database, superTable string, 
    tagFilters map[string]interface{}
) ([]SubTableInfo, error)
```

**Example:**
```go
tagFilters := map[string]interface{}{
    "location": "Workshop A",
    "device_type": "temperature_sensor",
}

subTables, err := service.GetSubTablesByTags(ctx, "industrial_data", "sensor_metrics", tagFilters)
```

### Lifecycle Management

#### ApplyLifecyclePolicy
Applies lifecycle management policies to sub-tables.

```go
func (s *TDengineService) ApplyLifecyclePolicy(
    ctx context.Context, 
    database, superTable string, 
    policy *SubTableLifecyclePolicy
) error
```

**Example:**
```go
maxAge := 30 * 24 * time.Hour // 30 days
maxIdleTime := 7 * 24 * time.Hour // 7 days
minRecords := int64(100)

policy := &SubTableLifecyclePolicy{
    AutoCleanup: true,
    MaxAge: &maxAge,
    MaxIdleTime: &maxIdleTime,
    MinRecords: &minRecords,
    ArchiveOldData: true,
    NotifyBeforeDelete: true,
}

err := service.ApplyLifecyclePolicy(ctx, "industrial_data", "sensor_metrics", policy)
```

### Data Insertion with Auto Sub-table Management

#### InsertDataWithAutoSubTable
Inserts data with automatic sub-table creation and management.

```go
func (s *TDengineService) InsertDataWithAutoSubTable(
    ctx context.Context, 
    database, superTable string, 
    dataPoints []DataPoint
) error
```

**Example:**
```go
dataPoints := []DataPoint{
    {
        DeviceID: "sensor-001",
        Timestamp: time.Now(),
        Value: 25.6,
        Tags: map[string]interface{}{
            "collector_id": "collector-001",
            "location": "Workshop A",
        },
    },
}

err := service.InsertDataWithAutoSubTable(ctx, "industrial_data", "sensor_metrics", dataPoints)
```

## Data Structures

### SubTableInfo
Contains comprehensive information about a sub-table.

```go
type SubTableInfo struct {
    Name         string                 `json:"name"`
    SuperTable   string                 `json:"supertable"`
    Database     string                 `json:"database"`
    CreatedTime  time.Time              `json:"created_time"`
    Tags         map[string]interface{} `json:"tags"`
    LastUpdate   time.Time              `json:"last_update"`
    RecordCount  int64                  `json:"record_count"`
}
```

### SubTableFilter
Defines filtering criteria for sub-table queries.

```go
type SubTableFilter struct {
    SuperTable    string                 `json:"supertable,omitempty"`
    Tags          map[string]interface{} `json:"tags,omitempty"`
    CreatedAfter  *time.Time             `json:"created_after,omitempty"`
    CreatedBefore *time.Time             `json:"created_before,omitempty"`
    UpdatedAfter  *time.Time             `json:"updated_after,omitempty"`
    UpdatedBefore *time.Time             `json:"updated_before,omitempty"`
    MinRecords    *int64                 `json:"min_records,omitempty"`
    MaxRecords    *int64                 `json:"max_records,omitempty"`
}
```

### SubTableLifecyclePolicy
Defines lifecycle management policies.

```go
type SubTableLifecyclePolicy struct {
    MaxAge             *time.Duration `json:"max_age,omitempty"`
    MaxIdleTime        *time.Duration `json:"max_idle_time,omitempty"`
    MinRecords         *int64         `json:"min_records,omitempty"`
    MaxRecords         *int64         `json:"max_records,omitempty"`
    AutoCleanup        bool           `json:"auto_cleanup"`
    ArchiveOldData     bool           `json:"archive_old_data"`
    NotifyBeforeDelete bool           `json:"notify_before_delete"`
}
```

## HTTP API Endpoints

### Sub-table Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tdengine/databases/{database}/supertables/{supertable}/subtables` | Create sub-table |
| GET | `/api/v1/tdengine/databases/{database}/supertables/{supertable}/subtables` | List sub-tables |
| GET | `/api/v1/tdengine/databases/{database}/subtables/{subtable}` | Get sub-table info |
| DELETE | `/api/v1/tdengine/databases/{database}/subtables/{subtable}` | Drop sub-table |
| POST | `/api/v1/tdengine/databases/{database}/supertables/{supertable}/subtables/by-tags` | Find by tags |
| GET | `/api/v1/tdengine/databases/{database}/subtables/{subtable}/exists` | Check existence |
| POST | `/api/v1/tdengine/databases/{database}/supertables/{supertable}/lifecycle` | Apply lifecycle policy |
| POST | `/api/v1/tdengine/databases/{database}/supertables/{supertable}/auto-create` | Auto-create from data |

### Example API Requests

#### Create Sub-table
```http
POST /api/v1/tdengine/databases/industrial_data/supertables/sensor_metrics/subtables
Content-Type: application/json

{
  "name": "sensor_workshop_a_001",
  "tags": {
    "collector_id": "collector-001",
    "device_id": "sensor-001",
    "location": "Workshop A",
    "device_type": "temperature_sensor"
  },
  "options": {
    "if_not_exists": true
  }
}
```

#### List Sub-tables with Pagination
```http
GET /api/v1/tdengine/databases/industrial_data/supertables/sensor_metrics/subtables?page=1&size=20&created_after=2024-01-01T00:00:00Z
```

#### Find Sub-tables by Tags
```http
POST /api/v1/tdengine/databases/industrial_data/supertables/sensor_metrics/subtables/by-tags
Content-Type: application/json

{
  "tags": {
    "location": "Workshop A",
    "device_type": "temperature_sensor"
  }
}
```

#### Apply Lifecycle Policy
```http
POST /api/v1/tdengine/databases/industrial_data/supertables/sensor_metrics/lifecycle
Content-Type: application/json

{
  "policy": {
    "auto_cleanup": true,
    "max_age": "720h",
    "max_idle_time": "168h",
    "min_records": 100,
    "archive_old_data": true,
    "notify_before_delete": true
  }
}
```

## Usage Patterns

### 1. Industrial Data Collection
```go
// Collector receives data from multiple devices
collectorID := "industrial-collector-001"
dataPoints := []DataPoint{
    {
        DeviceID: "plc-001",
        PointName: "motor_speed",
        Value: 1450.5,
        Tags: map[string]interface{}{
            "location": "Production Line 1",
            "device_type": "plc",
        },
    },
}

// Insert with automatic sub-table management
err := service.InsertCollectorData(ctx, collectorID, dataPoints)
```

### 2. Device Management
```go
// Find all sensors in a specific location
tagFilters := map[string]interface{}{
    "location": "Workshop A",
    "device_type": "sensor",
}

sensors, err := service.GetSubTablesByTags(ctx, "industrial_data", "sensor_metrics", tagFilters)

// Process each sensor
for _, sensor := range sensors {
    fmt.Printf("Sensor: %s, Last Update: %s\n", sensor.Name, sensor.LastUpdate)
}
```

### 3. Maintenance and Cleanup
```go
// Set up automatic cleanup for old data
policy := &SubTableLifecyclePolicy{
    AutoCleanup: true,
    MaxAge: &maxAge,
    MaxIdleTime: &maxIdleTime,
    ArchiveOldData: true,
}

// Apply to all sensor metrics
err := service.ApplyLifecyclePolicy(ctx, "industrial_data", "sensor_metrics", policy)
```

## Best Practices

### 1. Naming Conventions
- Use consistent naming patterns for sub-tables
- Include collector ID and device ID in names
- Avoid special characters and spaces
- Keep names under 192 characters

### 2. Tag Management
- Use meaningful tag names that reflect the data hierarchy
- Include location, device type, and manufacturer information
- Validate tag values before insertion
- Use consistent data types for tag values

### 3. Performance Optimization
- Use pagination for large result sets
- Apply appropriate filters to reduce query scope
- Monitor sub-table count and implement lifecycle policies
- Use batch operations for multiple sub-table operations

### 4. Error Handling
- Always check for sub-table existence before operations
- Handle tag validation errors gracefully
- Implement retry logic for transient failures
- Log operations for debugging and auditing

### 5. Lifecycle Management
- Implement appropriate retention policies
- Monitor disk usage and sub-table growth
- Archive important data before deletion
- Set up notifications for cleanup operations

## Testing

The implementation includes comprehensive tests covering:

- Sub-table creation and validation
- Auto-creation from data points
- Pagination and filtering
- Tag-based queries
- Lifecycle policy application
- Error handling scenarios

Run tests with:
```bash
go test ./platform/backend/tdengine -v -run TestSubTable
```

## Examples

See `subtable_example.go` for comprehensive usage examples including:
- Database and super table setup
- Manual and automatic sub-table creation
- Data insertion with auto-management
- Advanced querying and filtering
- Lifecycle management
- Real-world collector scenarios

Run examples with:
```go
import "prodb/platform/backend/tdengine"

tdengine.RunAllSubTableExamples()
```

## Integration with Collector System

The sub-table management integrates seamlessly with the collector system:

1. **Data Ingestion**: Collectors send data points with device and tag information
2. **Auto-creation**: Sub-tables are automatically created for new devices
3. **Tag Management**: Device metadata is stored as sub-table tags
4. **Lifecycle**: Old or unused sub-tables are automatically cleaned up
5. **Querying**: Data can be queried by device, location, or other tag criteria

This provides a scalable and maintainable solution for managing industrial IoT data in TDengine.