# TDengine Database Management API Documentation

This document describes the comprehensive database management API endpoints implemented for TDengine integration.

## Base URL

All endpoints are prefixed with `/api/v1/tdengine`

## Authentication

All endpoints require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

## Database Management Endpoints

### 1. List Databases

**GET** `/databases`

Returns a list of all databases with detailed information.

**Response:**
```json
{
  "status": "success",
  "data": {
    "databases": [
      {
        "name": "industrial_data",
        "created_time": "2024-01-01T00:00:00Z",
        "ntables": 150,
        "vgroups": 4,
        "replica": 1,
        "quorum": 1,
        "days": 10,
        "keep": "365,365,365",
        "cache": 16,
        "blocks": 6,
        "minrows": 100,
        "maxrows": 4096,
        "wallevel": 1,
        "fsync": 3000,
        "comp": 2,
        "precision": "ms",
        "status": "ready"
      }
    ],
    "count": 1
  }
}
```

### 2. Get Database Information

**GET** `/databases/{name}`

Returns detailed information about a specific database.

**Parameters:**
- `name` (path): Database name

**Response:**
```json
{
  "status": "success",
  "data": {
    "name": "industrial_data",
    "created_time": "2024-01-01T00:00:00Z",
    "ntables": 150,
    "vgroups": 4,
    "replica": 1,
    "quorum": 1,
    "days": 10,
    "keep": "365,365,365",
    "cache": 16,
    "blocks": 6,
    "minrows": 100,
    "maxrows": 4096,
    "wallevel": 1,
    "fsync": 3000,
    "comp": 2,
    "precision": "ms",
    "status": "ready"
  }
}
```

**Error Responses:**
- `404 Not Found`: Database not found
- `500 Internal Server Error`: Database query failed

### 3. Create Database

**POST** `/databases`

Creates a new database with optional configuration parameters.

**Request Body:**
```json
{
  "name": "new_database",
  "options": {
    "days": 10,
    "keep": "365",
    "cache": 16,
    "blocks": 6,
    "minrows": 100,
    "maxrows": 4096,
    "wallevel": 1,
    "fsync": 3000,
    "comp": 2,
    "precision": "ms",
    "replica": 1,
    "quorum": 1
  }
}
```

**Request Parameters:**
- `name` (required): Database name (must follow TDengine naming rules)
- `options` (optional): Database configuration options

**Database Options:**
- `days`: Number of days to keep data in memory (default: 10)
- `keep`: Data retention period in days (default: 365)
- `cache`: Cache size in MB (default: 16)
- `blocks`: Number of blocks per vnode (default: 6)
- `minrows`: Minimum rows per file block (default: 100)
- `maxrows`: Maximum rows per file block (default: 4096)
- `wallevel`: WAL level (0, 1, or 2, default: 1)
- `fsync`: Fsync period in milliseconds (default: 3000)
- `comp`: Compression algorithm (0, 1, or 2, default: 2)
- `precision`: Time precision ('ms', 'us', or 'ns', default: 'ms')
- `replica`: Number of replicas (default: 1)
- `quorum`: Quorum for replica (default: 1)

**Response:**
```json
{
  "status": "success",
  "message": "Database created successfully",
  "data": {
    "name": "new_database",
    "created_time": "2024-01-01T00:00:00Z",
    "ntables": 0,
    "vgroups": 1,
    "replica": 1,
    "quorum": 1,
    "days": 10,
    "keep": "365",
    "cache": 16,
    "blocks": 6,
    "minrows": 100,
    "maxrows": 4096,
    "wallevel": 1,
    "fsync": 3000,
    "comp": 2,
    "precision": "ms",
    "status": "ready"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request format or database name
- `409 Conflict`: Database already exists
- `500 Internal Server Error`: Database creation failed

### 4. Drop Database

**DELETE** `/databases/{name}`

Drops an existing database.

**Parameters:**
- `name` (path): Database name

**Response:**
```json
{
  "status": "success",
  "message": "Database dropped successfully",
  "name": "database_name",
  "dropped_database_info": {
    "name": "database_name",
    "created_time": "2024-01-01T00:00:00Z",
    "ntables": 150,
    "status": "ready"
  }
}
```

**Error Responses:**
- `404 Not Found`: Database not found
- `500 Internal Server Error`: Database deletion failed

### 5. Check Database Existence

**GET** `/databases/{name}/exists`

Checks if a database exists.

**Parameters:**
- `name` (path): Database name

**Response:**
```json
{
  "status": "success",
  "data": {
    "name": "database_name",
    "exists": true
  }
}
```

### 6. Get Database Statistics

**GET** `/databases/{name}/statistics`

Returns comprehensive statistics about a database.

**Parameters:**
- `name` (path): Database name

**Response:**
```json
{
  "status": "success",
  "data": {
    "database_info": {
      "name": "industrial_data",
      "created_time": "2024-01-01T00:00:00Z",
      "ntables": 150,
      "vgroups": 4,
      "replica": 1,
      "quorum": 1,
      "days": 10,
      "keep": "365,365,365",
      "cache": 16,
      "blocks": 6,
      "minrows": 100,
      "maxrows": 4096,
      "wallevel": 1,
      "fsync": 3000,
      "comp": 2,
      "precision": "ms",
      "status": "ready"
    },
    "super_tables_count": 5,
    "regular_tables_count": 145,
    "total_tables_count": 150
  }
}
```

**Error Responses:**
- `404 Not Found`: Database not found
- `500 Internal Server Error`: Statistics query failed

### 7. Validate Database Name

**POST** `/validate-name`

Validates a database name according to TDengine naming rules.

**Request Body:**
```json
{
  "name": "test_database_123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "name": "test_database_123",
    "valid": true,
    "message": "Database name is valid"
  }
}
```

**Validation Rules:**
- Name cannot be empty
- Name cannot exceed 64 characters
- Name must start with a letter or underscore
- Name can only contain letters, digits, and underscores
- Name cannot be a reserved keyword

**Invalid Name Response:**
```json
{
  "status": "success",
  "data": {
    "name": "123invalid",
    "valid": false,
    "message": "Database name must start with a letter or underscore"
  }
}
```

## Health and Monitoring Endpoints

### 8. Get Health Status

**GET** `/health`

Returns the current health status of the TDengine connection.

**Response:**
```json
{
  "status": "success",
  "data": {
    "is_healthy": true,
    "last_check": "2024-01-01T12:00:00Z",
    "uptime": 3600000,
    "error_message": null
  }
}
```

### 9. Get Metrics

**GET** `/metrics`

Returns database operation metrics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "connections_active": 5,
    "connections_total": 10,
    "queries_executed": 1500,
    "queries_failed": 2,
    "query_duration_ns": 250000000,
    "last_query_time": "2024-01-01T12:00:00Z",
    "health_check_count": 120,
    "reconnection_count": 0,
    "last_reconnection": "0001-01-01T00:00:00Z"
  }
}
```

## Data Operation Endpoints

### 10. Execute Custom Query

**POST** `/query`

Executes a custom SQL query.

**Request Body:**
```json
{
  "sql": "SELECT * FROM modbus_metrics WHERE ts >= '2024-01-01 00:00:00' LIMIT 100",
  "database": "industrial_data",
  "timeout": 30000
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "columns": ["ts", "value", "quality", "collector_id", "device_id"],
    "rows": [
      {
        "ts": "2024-01-01T00:00:00Z",
        "value": 25.6,
        "quality": 1,
        "collector_id": "collector-001",
        "device_id": "device-001"
      }
    ],
    "count": 1
  }
}
```

### 11. Get Latest Data

**GET** `/data/latest`

Retrieves the latest data for specified collectors.

**Query Parameters:**
- `collector_id` (required, multiple): Collector IDs to query
- `limit` (optional): Maximum number of records (default: 100)

**Example:**
```
GET /data/latest?collector_id=collector-001&collector_id=collector-002&limit=50
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "points": [
      {
        "device_id": "device-001",
        "point_name": "temperature",
        "timestamp": "2024-01-01T12:00:00Z",
        "value": 25.6,
        "quality": 1,
        "tags": {
          "collector_id": "collector-001"
        }
      }
    ],
    "count": 1
  }
}
```

### 12. Insert Data

**POST** `/data/insert`

Inserts data from collectors.

**Request Body:**
```json
{
  "collector_id": "collector-001",
  "data_points": [
    {
      "device_id": "device-001",
      "point_name": "temperature",
      "timestamp": "2024-01-01T12:00:00Z",
      "value": 25.6,
      "quality": 1,
      "tags": {
        "location": "workshop_a",
        "device_type": "sensor"
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Data inserted successfully",
  "count": 1
}
```

## Super Table Management

### 13. Get Super Tables

**GET** `/databases/{database}/supertables`

Returns a list of super tables in the specified database.

**Parameters:**
- `database` (path): Database name

**Response:**
```json
{
  "status": "success",
  "data": {
    "database": "industrial_data",
    "supertables": [
      {
        "name": "modbus_metrics",
        "created_time": "2024-01-01T00:00:00Z",
        "columns": [
          {"name": "ts", "type": "TIMESTAMP", "length": 8},
          {"name": "value", "type": "DOUBLE", "length": 8},
          {"name": "quality", "type": "INT", "length": 4}
        ],
        "tags": [
          {"name": "collector_id", "type": "NCHAR", "length": 64},
          {"name": "device_id", "type": "NCHAR", "length": 64}
        ],
        "subtable_count": 25
      }
    ],
    "count": 1
  }
}
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "error": "Detailed error information"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request format or parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server-side error

## Usage Examples

### Creating a Database with Custom Options

```bash
curl -X POST http://localhost:8088/api/v1/tdengine/databases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sensor_data",
    "options": {
      "days": 7,
      "keep": "730",
      "cache": 32,
      "precision": "ms",
      "replica": 1
    }
  }'
```

### Validating Database Name

```bash
curl -X POST http://localhost:8088/api/v1/tdengine/validate-name \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_database_123"
  }'
```

### Getting Database Statistics

```bash
curl -X GET http://localhost:8088/api/v1/tdengine/databases/industrial_data/statistics \
  -H "Authorization: Bearer <token>"
```

### Checking Database Existence

```bash
curl -X GET http://localhost:8088/api/v1/tdengine/databases/test_db/exists \
  -H "Authorization: Bearer <token>"
```

## Implementation Notes

1. **Parameter Validation**: All database names and options are validated before execution
2. **Error Handling**: Comprehensive error handling with detailed error messages
3. **Connection Management**: Automatic connection pooling and health monitoring
4. **Security**: All operations require proper authentication
5. **Performance**: Optimized queries and connection reuse
6. **Logging**: All operations are logged for debugging and monitoring

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 6.2**: Database CRUD operations with comprehensive API interfaces
- **Requirement 6.6**: Database listing, querying, and detailed information retrieval
- **Parameter Validation**: Robust validation for database creation parameters
- **Error Handling**: Comprehensive error handling and user-friendly error messages

The API provides a complete database management interface that allows users to:
- Create, read, update, and delete databases
- Validate database names and options
- Monitor database health and performance
- Query database statistics and metadata
- Manage data insertion and retrieval operations