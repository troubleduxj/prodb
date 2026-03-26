# MQTT Protocol Implementation

This package implements MQTT protocol support for the ProDB data collector, providing comprehensive MQTT client functionality with support for multiple QoS levels, topic wildcards, JSON data parsing, and automatic reconnection.

## Features

### Core MQTT Features
- **Multiple QoS Levels**: Support for QoS 0 (At most once), QoS 1 (At least once), and QoS 2 (Exactly once)
- **Topic Wildcards**: Support for MQTT topic wildcards (`+` for single level, `#` for multi-level)
- **Auto-Reconnection**: Automatic reconnection with exponential backoff on connection loss
- **Session Recovery**: Clean session and persistent session support
- **TLS/SSL Support**: Secure connections with client certificates and CA validation

### Data Processing Features
- **JSON Data Parsing**: Automatic parsing of JSON payloads with JSONPath support
- **Multiple Data Formats**: Support for JSON, raw text, and CSV data formats
- **Data Buffering**: Internal buffering of received messages for batch processing
- **Data Type Inference**: Automatic data type detection for received values

### Connection Management
- **Connection Monitoring**: Real-time connection status monitoring
- **Heartbeat/Keep-Alive**: Configurable keep-alive intervals
- **Connection Timeouts**: Configurable connection and write timeouts
- **Graceful Disconnection**: Proper cleanup on disconnection

## Configuration

### Basic Configuration

```json
{
  "protocol": "mqtt",
  "connection": {
    "broker": "localhost",
    "port": 1883,
    "client_id": "collector_001",
    "username": "user",
    "password": "pass",
    "keep_alive": 60,
    "clean_session": true,
    "auto_reconnect": true
  },
  "topics": [
    {
      "topic": "sensors/temperature",
      "qos": 1,
      "data_format": "json",
      "device_id": "sensor_001",
      "point_name": "temperature"
    }
  ]
}
```

### Advanced Configuration

```json
{
  "protocol": "mqtt",
  "connection": {
    "broker": "mqtt.example.com",
    "port": 8883,
    "client_id": "collector_secure",
    "username": "collector",
    "password": "secure_password",
    "use_tls": true,
    "cert_file": "/path/to/client.crt",
    "key_file": "/path/to/client.key",
    "ca_file": "/path/to/ca.crt",
    "keep_alive": 30,
    "clean_session": false,
    "auto_reconnect": true,
    "connect_timeout": 30,
    "write_timeout": 30,
    "max_reconnect_delay": 300
  },
  "topics": [
    {
      "topic": "factory/+/sensors/+",
      "qos": 2,
      "data_format": "json",
      "json_path": "$.data.value"
    },
    {
      "topic": "devices/raw_data",
      "qos": 0,
      "data_format": "raw",
      "device_id": "raw_device"
    },
    {
      "topic": "csv/data_stream",
      "qos": 1,
      "data_format": "csv"
    }
  ]
}
```

## Configuration Parameters

### Connection Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `broker` | string | - | MQTT broker hostname or IP address (required) |
| `port` | int | 1883 | MQTT broker port |
| `client_id` | string | auto-generated | MQTT client identifier |
| `username` | string | - | Username for authentication |
| `password` | string | - | Password for authentication |
| `keep_alive` | int | 60 | Keep-alive interval in seconds |
| `clean_session` | bool | true | Clean session flag |
| `auto_reconnect` | bool | true | Enable automatic reconnection |
| `connect_timeout` | int | 30 | Connection timeout in seconds |
| `write_timeout` | int | 30 | Write timeout in seconds |
| `max_reconnect_delay` | int | 300 | Maximum reconnection delay in seconds |

### TLS Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `use_tls` | bool | false | Enable TLS/SSL connection |
| `cert_file` | string | - | Path to client certificate file |
| `key_file` | string | - | Path to client private key file |
| `ca_file` | string | - | Path to CA certificate file |

### Topic Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topic` | string | - | MQTT topic to subscribe to (required) |
| `qos` | int | 0 | Quality of Service level (0, 1, or 2) |
| `data_format` | string | "json" | Data format: "json", "raw", or "csv" |
| `device_id` | string | auto-generated | Device identifier for data points |
| `point_name` | string | auto-generated | Point name for data points |
| `json_path` | string | - | JSONPath expression for extracting specific values |

## Data Formats

### JSON Format

The MQTT protocol can parse JSON payloads automatically. You can extract specific values using JSONPath expressions.

**Example JSON payload:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "sensors": [
    {
      "id": "temp_01",
      "value": 25.6,
      "unit": "°C"
    },
    {
      "id": "humidity_01", 
      "value": 65.2,
      "unit": "%"
    }
  ]
}
```

**JSONPath examples:**
- `$.sensors[0].value` - Extract first sensor value (25.6)
- `$.sensors[1].value` - Extract second sensor value (65.2)
- `$.timestamp` - Extract timestamp

### Raw Format

Raw format treats the entire payload as a string value.

### CSV Format

CSV format parses comma-separated values and creates data points for each field.

**Example CSV payload:**
```
25.6,65.2,1013.25
```

This creates three data points: `row0_col0`, `row0_col1`, `row0_col2`.

## Topic Wildcards

MQTT supports two types of wildcards:

- **Single-level wildcard (`+`)**: Matches any single topic level
  - `sensors/+/temperature` matches `sensors/room1/temperature`, `sensors/room2/temperature`
  
- **Multi-level wildcard (`#`)**: Matches any number of topic levels
  - `factory/#` matches `factory/floor1/machine1`, `factory/floor2/machine3/sensor1`

## Usage Examples

### Basic Temperature Sensor

```json
{
  "protocol": "mqtt",
  "connection": {
    "broker": "192.168.1.100",
    "port": 1883,
    "client_id": "temp_collector"
  },
  "topics": [
    {
      "topic": "sensors/temperature",
      "qos": 1,
      "data_format": "json",
      "device_id": "temp_sensor_01"
    }
  ]
}
```

### Multiple Sensors with Wildcards

```json
{
  "protocol": "mqtt",
  "connection": {
    "broker": "mqtt.factory.com",
    "port": 1883,
    "client_id": "factory_collector"
  },
  "topics": [
    {
      "topic": "factory/+/sensors/+",
      "qos": 2,
      "data_format": "json",
      "json_path": "$.value"
    }
  ]
}
```

### Secure Connection with TLS

```json
{
  "protocol": "mqtt",
  "connection": {
    "broker": "secure-mqtt.example.com",
    "port": 8883,
    "client_id": "secure_collector",
    "username": "collector_user",
    "password": "secure_password",
    "use_tls": true,
    "ca_file": "/etc/ssl/certs/mqtt-ca.crt"
  },
  "topics": [
    {
      "topic": "secure/data/#",
      "qos": 1,
      "data_format": "json"
    }
  ]
}
```

## Error Handling

The MQTT protocol implementation includes comprehensive error handling:

- **Connection Errors**: Automatic retry with exponential backoff
- **Subscription Errors**: Logged and reported to the platform
- **Data Parsing Errors**: Invalid messages are logged but don't stop processing
- **TLS Errors**: Certificate validation errors are reported
- **Network Errors**: Connection loss detection and automatic reconnection

## Monitoring and Diagnostics

The protocol provides detailed status information:

```go
status := mqttProtocol.GetConnectionStatus()
// Returns:
// {
//   "connected": true,
//   "broker": "localhost:1883",
//   "client_id": "collector_001",
//   "subscribed_topics": 3,
//   "client_connected": true,
//   "buffered_messages": 15,
//   "buffer_by_topic": {
//     "sensors/temp": 5,
//     "sensors/humidity": 10
//   }
// }
```

## Performance Considerations

- **Buffer Management**: Messages are buffered in memory until collected
- **QoS Impact**: Higher QoS levels provide better reliability but lower throughput
- **Topic Wildcards**: Broad wildcards may receive many messages
- **JSON Parsing**: Complex JSON structures may impact performance
- **TLS Overhead**: Secure connections have additional CPU overhead

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check broker address and port
   - Verify network connectivity
   - Check authentication credentials

2. **No Messages Received**
   - Verify topic subscription
   - Check QoS levels
   - Ensure messages are being published to the topic

3. **TLS Connection Errors**
   - Verify certificate files exist and are readable
   - Check certificate validity and CA chain
   - Ensure broker supports TLS on the specified port

4. **High Memory Usage**
   - Check message buffer sizes
   - Reduce collection frequency
   - Clear buffers regularly

### Debug Logging

Enable debug logging to troubleshoot issues:

```json
{
  "log_level": "debug"
}
```

This will log detailed information about:
- Connection attempts and status
- Message reception and parsing
- Subscription status
- Error details