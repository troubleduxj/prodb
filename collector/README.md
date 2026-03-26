# ProDB Collector

The ProDB Collector is a modular data collection agent that supports multiple industrial protocols and provides reliable data collection with store-and-forward capabilities.

## Architecture

The collector is built with a pluggable architecture consisting of the following core components:

### Core Components

- **Collector Core** (`internal/core`): Main collector orchestration and lifecycle management
- **Configuration Management** (`internal/config`): Centralized configuration loading and validation
- **Logging System** (`internal/logger`): Structured logging with configurable outputs
- **Protocol Manager** (`internal/protocol`): Pluggable protocol implementations
- **Data Buffer** (`internal/buffer`): In-memory data buffering and batching
- **Storage Cache** (`internal/storage`): SQLite-based store-and-forward mechanism
- **Authentication** (`internal/auth`): JWT-based authentication with the platform
- **Communication** (`internal/communication`): HTTP client for platform communication

### Supported Protocols

- **Modbus TCP**: Industrial Ethernet-based Modbus communication
- **Modbus RTU**: Serial-based Modbus communication
- **OPC-UA**: OPC Unified Architecture protocol
- **MQTT**: Message Queuing Telemetry Transport protocol

## Configuration

The collector can be configured through:

1. **JSON Configuration File**: Comprehensive configuration with all options
2. **Environment Variables**: Basic configuration for containerized deployments
3. **Platform Sync**: Dynamic configuration updates from the management platform

### Environment Variables

Required environment variables:
- `COLLECTOR_ID`: Unique identifier for the collector
- `SECRET_KEY`: Authentication secret key
- `PLATFORM_API_ENDPOINT`: Platform API endpoint URL

Optional environment variables:
- `COLLECTOR_NAME`: Human-readable collector name
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOCAL_DB_PATH`: Path to SQLite cache database
- `HEARTBEAT_INTERVAL`: Heartbeat interval in seconds

### Configuration File

See `config.example.json` for a complete configuration example.

## Features

### Store-and-Forward
- Local SQLite cache for offline data storage
- Automatic retry with exponential backoff
- Configurable retention policies
- Disk space management

### Authentication & Security
- JWT-based authentication
- Automatic token refresh
- Secure communication with HTTPS
- Configurable retry policies

### Data Collection
- Multi-protocol support with pluggable architecture
- Configurable collection intervals
- Data validation and quality control
- Batch processing for efficiency

### Monitoring & Observability
- Structured logging with multiple outputs
- Performance metrics collection
- Health monitoring and heartbeat
- Real-time status reporting

## Usage

### Basic Usage

1. Set required environment variables:
```bash
export COLLECTOR_ID="your-collector-id"
export SECRET_KEY="your-secret-key"
export PLATFORM_API_ENDPOINT="http://your-platform:8088"
```

2. Run the collector:
```bash
./collector
```

### Using Configuration File

1. Create a configuration file based on `config.example.json`
2. Run with configuration file:
```bash
COLLECTOR_CONFIG="./config.json" ./collector
```

### Docker Usage

```bash
docker run -d \
  -e COLLECTOR_ID="collector-001" \
  -e SECRET_KEY="your-secret-key" \
  -e PLATFORM_API_ENDPOINT="http://platform:8088" \
  -v ./data:/data \
  prodb/collector
```

## Development

### Building

```bash
go build -o collector .
```

### Testing

```bash
go test ./...
```

### Adding New Protocols

1. Implement the `Protocol` interface in `internal/protocol`
2. Register the protocol in `registerBuiltinProtocols()`
3. Add protocol-specific configuration validation

## API Endpoints

The collector exposes a web interface on port 8093 for configuration management:

- `GET /`: Configuration web interface
- `POST /save`: Save configuration
- `POST /shutdown`: Graceful shutdown

## Logging

The collector supports structured logging with the following levels:
- `debug`: Detailed debugging information
- `info`: General information messages
- `warn`: Warning messages
- `error`: Error messages

Logs can be output to:
- `stdout`: Standard output (default)
- `file`: Log file with rotation support

## Metrics

The collector collects and reports various metrics:

### System Metrics
- CPU usage
- Memory usage
- Disk usage
- Network statistics

### Collection Metrics
- Data points collected per second
- Collection success/failure rates
- Protocol connection status
- Buffer utilization

### Storage Metrics
- Cache size and utilization
- Upload success/failure rates
- Retry counts
- Data retention statistics

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify COLLECTOR_ID and SECRET_KEY
   - Check platform connectivity
   - Review authentication logs

2. **Protocol Connection Issues**
   - Verify network connectivity to devices
   - Check protocol-specific configuration
   - Review firewall settings

3. **Storage Issues**
   - Check disk space availability
   - Verify database file permissions
   - Review cache configuration

### Log Analysis

Enable debug logging for detailed troubleshooting:
```bash
export LOG_LEVEL="debug"
./collector
```

## License

This project is part of the ProDB platform.