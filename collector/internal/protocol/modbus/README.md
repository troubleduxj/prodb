# Modbus Protocol Implementation

This package implements Modbus TCP and RTU protocol support for the ProDB data collector.

## Features

### Modbus TCP
- **Full Modbus TCP protocol implementation** with real TCP communication
- Support for all standard function codes:
  - 0x01: Read Coils
  - 0x02: Read Discrete Inputs
  - 0x03: Read Holding Registers
  - 0x04: Read Input Registers
- **Advanced connection management** with automatic reconnection and health checks
- **Intelligent batch optimization** for consecutive register reads
- **Comprehensive error handling** with Modbus exception code parsing
- **Configurable retry mechanisms** with exponential backoff
- **Data type conversion** (int16, int32, float32, float64, bool, string)
- **Scaling and offset support** with precision handling
- **Connection pooling ready** architecture for high-throughput scenarios

### Modbus RTU
- Mock implementation for testing (requires serial library for production)
- Configuration validation
- Same data processing capabilities as TCP
- Ready for serial port integration

## Configuration

### Modbus TCP Configuration
```json
{
  "host": "192.168.1.100",
  "port": 502,
  "slave_id": 1,
  "timeout": 5000,
  "retry_count": 3,
  "retry_delay": 100
}
```

### Modbus RTU Configuration
```json
{
  "serial_port": "/dev/ttyUSB0",
  "baud_rate": 9600,
  "data_bits": 8,
  "stop_bits": 1,
  "parity": "N",
  "slave_id": 1,
  "timeout": 5000,
  "retry_count": 3,
  "retry_delay": 100
}
```

## Address Formats

The implementation supports multiple address formats:

### Traditional 5-digit Format
- `1-9999`: Coils (0x references)
- `10001-19999`: Discrete Inputs (1x references)
- `30001-39999`: Input Registers (3x references)
- `40001-49999`: Holding Registers (4x references)

### Explicit Format
- `coil:1`: Coil at address 1
- `discrete:100`: Discrete input at address 100
- `input:200`: Input register at address 200
- `holding:300`: Holding register at address 300

## Data Types

Supported data types with automatic conversion:

- `bool`: Boolean value (from coils, discrete inputs, or register != 0)
- `int16`: 16-bit signed integer (1 register)
- `int32`: 32-bit signed integer (2 registers)
- `float32`: 32-bit IEEE 754 float (2 registers)
- `float64`: 64-bit IEEE 754 float (4 registers)
- `string`: ASCII string (multiple registers)

## Data Point Configuration

```json
{
  "name": "temperature",
  "address": "40001",
  "data_type": "float32",
  "scale": 0.1,
  "offset": 0,
  "unit": "°C",
  "tags": {
    "location": "workshop_a",
    "equipment": "furnace_01"
  }
}
```

### Scaling and Offset
- `scale`: Multiply raw value by this factor
- `offset`: Add this value after scaling
- Formula: `final_value = (raw_value * scale) + offset`

## Error Handling

The implementation includes comprehensive error handling:

- Connection timeouts and retries
- Modbus exception codes
- Data validation and conversion errors
- Network disconnection recovery
- Invalid configuration detection

## Testing

Run the test suite:
```bash
go test ./internal/protocol/modbus -v
```

The tests cover:
- Protocol validation
- Address parsing
- Data conversion
- Scaling calculations
- Connection management
- Error conditions

## Usage Example

```go
package main

import (
    "prodb/collector/internal/config"
    "prodb/collector/internal/logger"
    "prodb/collector/internal/protocol/modbus"
)

func main() {
    // Create logger
    logger, _ := logger.NewLogger(config.LoggerConfig{
        Level: "info",
        Format: "json",
        Output: "stdout",
    })
    
    // Create Modbus TCP protocol
    protocol := modbus.NewModbusTCPProtocol(logger)
    
    // Configure connection
    config := map[string]interface{}{
        "host":     "192.168.1.100",
        "port":     502,
        "slave_id": 1,
        "timeout":  5000,
    }
    
    // Connect
    err := protocol.Connect(config)
    if err != nil {
        panic(err)
    }
    defer protocol.Disconnect()
    
    // Define data points
    points := []config.DataPointConfig{
        {
            Name:     "temperature",
            Address:  "40001",
            DataType: "float32",
            Scale:    0.1,
            Unit:     "°C",
        },
    }
    
    // Collect data
    values, err := protocol.Collect(points)
    if err != nil {
        panic(err)
    }
    
    // Process values
    for _, value := range values {
        fmt.Printf("%s: %v %s\n", value.PointName, value.Value, value.Unit)
    }
}
```

## Production Considerations

### Modbus TCP
- **Production-ready implementation** with real TCP communication
- **Automatic connection management** handles network interruptions gracefully
- **Intelligent batch optimization** reduces network overhead for multiple reads
- **Comprehensive error handling** with proper Modbus exception processing
- **Configurable retry mechanisms** with exponential backoff for reliability
- Monitor network latency and adjust timeouts accordingly
- Connection pooling architecture ready for high-throughput scenarios

### Modbus RTU
- Requires integration with a serial port library (e.g., `github.com/tarm/serial`)
- Current implementation uses mock connections for testing
- Serial port configuration must match device settings exactly
- Same advanced features as TCP (batch optimization, error handling) ready for serial implementation

### Performance Optimization
- **Intelligent batch reading** automatically groups consecutive registers
- **Connection health monitoring** prevents unnecessary reconnections
- **Efficient data conversion** with minimal memory allocation
- **Configurable timeouts and retries** optimize for different network conditions
- Monitor memory usage with large numbers of data points
- Use appropriate collection intervals to avoid overwhelming devices

### Security
- Modbus protocol has no built-in security
- Use VPNs or secure networks for Modbus TCP
- Implement firewall rules to restrict access
- Consider Modbus security extensions for critical applications

## Recent Enhancements ✅

1. **✅ Intelligent Batch Optimization**: Automatically groups consecutive registers for optimal performance
2. **✅ Real TCP Communication**: Full Modbus TCP protocol implementation with actual network communication
3. **✅ Advanced Connection Management**: Automatic reconnection, health checks, and connection pooling ready
4. **✅ Comprehensive Error Handling**: Proper Modbus exception parsing and retry mechanisms
5. **✅ Production-Ready Features**: Configurable timeouts, retry logic, and robust error recovery

## Future Enhancements

1. **Serial Port Support**: Complete RTU implementation with real serial communication
2. **Write Operations**: Add support for writing to Modbus devices
4. **Device Discovery**: Automatic device scanning and configuration
5. **Protocol Extensions**: Support for vendor-specific extensions
6. **Performance Metrics**: Detailed timing and throughput monitoring