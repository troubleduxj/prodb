# SQLite Cache System Implementation

This document describes the enhanced SQLite cache system implementation for the ProDB Collector, which provides robust local data storage and store-and-forward functionality.

## Overview

The SQLite cache system is designed to handle network interruptions gracefully by storing collected data locally when the platform connection is unavailable, and automatically uploading cached data when connectivity is restored.

## Key Features

### 1. Enhanced Database Structure

- **Optimized table schema** with proper indexing for performance
- **Data size tracking** for efficient storage management
- **Priority-based storage** for critical data handling
- **Comprehensive statistics tracking** for monitoring

### 2. FIFO Cleanup Mechanism

- **Automatic cleanup** when record count exceeds configurable thresholds
- **Intelligent prioritization** - uploaded data is removed before pending data
- **Batch processing** to minimize database locks
- **Configurable cleanup batch sizes** for performance tuning

### 3. Disk Space Monitoring

- **Real-time disk space monitoring** with configurable check intervals
- **Warning and critical thresholds** for proactive management
- **Cross-platform disk usage detection**
- **Automatic storage health status tracking**

### 4. Capacity Management

- **Maximum cache size enforcement** with automatic cleanup
- **Record count limits** with FIFO cleanup
- **Database optimization** with VACUUM and ANALYZE operations
- **Retention policy enforcement** for old uploaded data

## Database Schema

### Main Data Cache Table

```sql
CREATE TABLE data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data_points TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    data_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_at DATETIME NULL,
    priority INTEGER DEFAULT 0
);
```

### Storage Statistics Table

```sql
CREATE TABLE storage_stats (
    id INTEGER PRIMARY KEY,
    total_records INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    oldest_record_timestamp INTEGER DEFAULT 0,
    last_cleanup DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_vacuum DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Performance Indexes

- **Primary indexes**: device_id, timestamp, uploaded_at, created_at, retry_count
- **Composite indexes**: uploaded_created, device_timestamp, priority_created
- **Partial indexes**: pending_upload, failed_retries (for filtered queries)

## Configuration

### Storage Configuration Options

```go
type StorageConfig struct {
    DatabasePath      string `json:"database_path"`      // Path to SQLite database file
    MaxCacheSize      int64  `json:"max_cache_size"`     // Maximum cache size in bytes
    RetentionDays     int    `json:"retention_days"`     // Days to retain uploaded data
    CleanupInterval   int    `json:"cleanup_interval"`   // Cleanup interval in seconds
    MaxRetries        int    `json:"max_retries"`        // Maximum retry attempts
    RetryDelay        int    `json:"retry_delay"`        // Retry delay in seconds
}
```

### Default Values

- **Database Path**: `./collector_cache.db`
- **Max Cache Size**: 1GB
- **Retention Days**: 7 days
- **Cleanup Interval**: 1 hour (3600 seconds)
- **Max Retries**: 3
- **Retry Delay**: 5 seconds

## Core Operations

### 1. Data Storage

```go
func (sc *StorageCache) Store(data []protocol.DataValue) error
```

- Groups data by device ID for efficient storage
- Checks disk space availability before storing
- Calculates and stores data size for capacity management
- Triggers FIFO cleanup when thresholds are exceeded

### 2. Data Retrieval

```go
func (sc *StorageCache) Retrieve(limit int) ([]CachedData, error)
```

- Retrieves pending (non-uploaded) data in FIFO order
- Handles timestamp conversion and JSON deserialization
- Returns structured data ready for upload

### 3. Upload Confirmation

```go
func (sc *StorageCache) MarkUploaded(ids []int64) error
```

- Marks successfully uploaded data with timestamp
- Updates metrics for tracking upload success
- Enables cleanup of uploaded data during retention cleanup

### 4. Retry Management

```go
func (sc *StorageCache) IncrementRetryCount(ids []int64) error
```

- Increments retry count for failed uploads
- Tracks upload failures for monitoring
- Supports exponential backoff retry strategies

## Advanced Features

### 1. FIFO Cleanup

The system implements intelligent FIFO cleanup with the following strategy:

1. **Threshold Detection**: Monitors record count against configurable limits
2. **Priority-based Removal**: Removes uploaded data before pending data
3. **Batch Processing**: Deletes records in configurable batch sizes
4. **Space Reclamation**: Performs VACUUM operations after large deletions

### 2. Disk Space Monitoring

Continuous monitoring includes:

- **Real-time Usage Tracking**: Updates disk space metrics every 30 seconds
- **Health Status Management**: Sets storage health based on usage thresholds
- **Warning Levels**: 80% usage warning, 95% usage critical
- **Automatic Protection**: Refuses new data storage when disk space is critical

### 3. Performance Optimization

- **Connection Pooling**: Efficient database connection management
- **Index Optimization**: Comprehensive indexing strategy for fast queries
- **Batch Operations**: Bulk insert/update/delete operations
- **Query Optimization**: Optimized SQL queries with proper WHERE clauses

### 4. Statistics and Monitoring

Comprehensive metrics tracking:

```go
type StorageMetrics struct {
    CachedDataCount     int64     `json:"cached_data_count"`
    TotalCached         int64     `json:"total_cached"`
    TotalUploaded       int64     `json:"total_uploaded"`
    TotalDeleted        int64     `json:"total_deleted"`
    DatabaseSize        int64     `json:"database_size_bytes"`
    AvailableDiskSpace  int64     `json:"available_disk_space_bytes"`
    TotalDiskSpace      int64     `json:"total_disk_space_bytes"`
    DiskSpacePercent    float64   `json:"disk_space_percent"`
    OldestRecordAge     int64     `json:"oldest_record_age_seconds"`
    StorageHealthy      bool      `json:"storage_healthy"`
    LastDiskCheck       time.Time `json:"last_disk_check"`
}
```

## Usage Examples

### Basic Usage

```go
// Create storage cache
cache, err := storage.NewStorageCache(config, logger)
if err != nil {
    return err
}

// Start cache with background routines
err = cache.Start(ctx)
if err != nil {
    return err
}
defer cache.Stop()

// Store data
data := []protocol.DataValue{
    {DeviceID: "device1", PointName: "temp", Value: 25.5, Quality: 1, Timestamp: time.Now()},
}
err = cache.Store(data)

// Retrieve pending data
cachedData, err := cache.Retrieve(100)

// Mark as uploaded
ids := []int64{cachedData[0].ID}
err = cache.MarkUploaded(ids)
```

### Advanced Operations

```go
// Get detailed statistics
stats, err := cache.GetCacheStatistics()
fmt.Printf("Pending records: %d\n", stats.PendingRecords)

// Get disk space information
diskInfo, err := cache.GetDiskSpaceInfo()
fmt.Printf("Disk usage: %.2f%%\n", diskInfo.UsagePercent)

// Optimize database
err = cache.OptimizeDatabase()

// Purge old uploaded data
deletedCount, err := cache.PurgeUploadedData(24 * time.Hour)
```

## Error Handling

The system includes comprehensive error handling for:

- **Database Connection Issues**: Automatic reconnection and retry logic
- **Disk Space Exhaustion**: Graceful degradation and warning notifications
- **Concurrent Access**: Proper locking and transaction management
- **Data Corruption**: Validation and recovery mechanisms

## Performance Considerations

### Optimization Strategies

1. **Batch Operations**: Use batch inserts/updates for better performance
2. **Index Maintenance**: Regular ANALYZE operations for query optimization
3. **Connection Reuse**: Efficient database connection management
4. **Memory Management**: Controlled memory usage for large datasets

### Scalability Limits

- **Maximum Records**: Tested up to 1M records with good performance
- **Database Size**: Supports multi-GB databases efficiently
- **Concurrent Access**: Thread-safe operations with proper locking
- **Memory Usage**: Configurable limits to prevent memory exhaustion

## Testing

The implementation includes comprehensive tests covering:

- **Basic Operations**: Store, retrieve, mark uploaded, retry increment
- **FIFO Cleanup**: Threshold-based cleanup with proper prioritization
- **Disk Monitoring**: Space usage tracking and health status
- **Error Scenarios**: Database locks, disk full, corruption recovery
- **Performance**: Large dataset handling and concurrent operations

Run tests with:

```bash
go test -v ./internal/storage
```

## Requirements Compliance

This implementation satisfies the following requirements from the specification:

- **Requirement 3.2**: Local SQLite data storage when network is unavailable
- **Requirement 3.3**: FIFO cleanup when cache exceeds configured thresholds  
- **Requirement 3.7**: Disk space monitoring and storage capacity management

The enhanced SQLite cache system provides a robust foundation for reliable data collection and store-and-forward functionality in industrial environments.