package modbus

import (
	"encoding/binary"
	"fmt"
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestModbusProtocols_Minimal(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test TCP Protocol
	tcpProtocol := NewModbusTCPProtocol(logger)
	if tcpProtocol == nil {
		t.Fatal("NewModbusTCPProtocol returned nil")
	}

	if tcpProtocol.GetName() != "modbus_tcp" {
		t.Errorf("TCP protocol name = %s, want modbus_tcp", tcpProtocol.GetName())
	}

	// Test RTU Protocol
	rtuProtocol := NewModbusRTUProtocol(logger)
	if rtuProtocol == nil {
		t.Fatal("NewModbusRTUProtocol returned nil")
	}

	if rtuProtocol.GetName() != "modbus_rtu" {
		t.Errorf("RTU protocol name = %s, want modbus_rtu", rtuProtocol.GetName())
	}

	// Test TCP validation
	tcpConfig := map[string]interface{}{
		"host":     "192.168.1.100",
		"port":     float64(502),
		"slave_id": float64(1),
	}

	err = tcpProtocol.Validate(tcpConfig)
	if err != nil {
		t.Errorf("TCP Validate() error = %v", err)
	}

	// Test RTU validation
	rtuConfig := map[string]interface{}{
		"serial_port": "/dev/ttyUSB0",
		"baud_rate":   float64(9600),
		"slave_id":    float64(1),
	}

	err = rtuProtocol.Validate(rtuConfig)
	if err != nil {
		t.Errorf("RTU Validate() error = %v", err)
	}

	// Test RTU connection (mock)
	err = rtuProtocol.Connect(rtuConfig)
	if err != nil {
		t.Errorf("RTU Connect() error = %v", err)
	}

	if !rtuProtocol.IsConnected() {
		t.Error("RTU protocol should be connected")
	}

	err = rtuProtocol.Disconnect()
	if err != nil {
		t.Errorf("RTU Disconnect() error = %v", err)
	}

	if rtuProtocol.IsConnected() {
		t.Error("RTU protocol should be disconnected")
	}

	t.Log("All Modbus protocol tests passed")
}

func TestModbusAddressParsing(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	testCases := []struct {
		address     string
		expectError bool
		expectType  string
	}{
		{"40001", false, RegisterTypeHoldingRegister},
		{"30001", false, RegisterTypeInputRegister},
		{"10001", false, RegisterTypeDiscreteInput},
		{"1", false, RegisterTypeCoil},
		{"holding:100", false, RegisterTypeHoldingRegister},
		{"input:200", false, RegisterTypeInputRegister},
		{"coil:50", false, RegisterTypeCoil},
		{"discrete:75", false, RegisterTypeDiscreteInput},
		{"invalid", true, ""},
		{"99999", true, ""},
	}

	for _, tc := range testCases {
		t.Run(tc.address, func(t *testing.T) {
			addr, err := protocol.parseAddress(tc.address)

			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error for address %s, but got none", tc.address)
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error for address %s: %v", tc.address, err)
				return
			}

			if addr.RegisterType != tc.expectType {
				t.Errorf("Address %s: expected type %s, got %s",
					tc.address, tc.expectType, addr.RegisterType)
			}
		})
	}
}

func TestModbusDataConversion(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	testCases := []struct {
		name         string
		rawData      []byte
		dataType     string
		registerType string
		expected     interface{}
		expectError  bool
	}{
		{
			name:         "int16 from holding register",
			rawData:      []byte{0x01, 0x00}, // 256 in big-endian
			dataType:     "int16",
			registerType: RegisterTypeHoldingRegister,
			expected:     int16(256),
			expectError:  false,
		},
		{
			name:         "bool from coil true",
			rawData:      []byte{1},
			dataType:     "bool",
			registerType: RegisterTypeCoil,
			expected:     true,
			expectError:  false,
		},
		{
			name:         "bool from coil false",
			rawData:      []byte{0},
			dataType:     "bool",
			registerType: RegisterTypeCoil,
			expected:     false,
			expectError:  false,
		},
		{
			name:         "insufficient data for int16",
			rawData:      []byte{0x01},
			dataType:     "int16",
			registerType: RegisterTypeHoldingRegister,
			expected:     nil,
			expectError:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := protocol.convertRawData(tc.rawData, tc.dataType, tc.registerType)

			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if result != tc.expected {
				t.Errorf("Expected %v, got %v", tc.expected, result)
			}
		})
	}
}

func TestModbusScaling(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	testCases := []struct {
		name     string
		value    interface{}
		scale    float64
		offset   float64
		expected interface{}
	}{
		{
			name:     "no scaling",
			value:    int16(100),
			scale:    0,
			offset:   0,
			expected: int16(100),
		},
		{
			name:     "scale only",
			value:    int16(100),
			scale:    0.1,
			offset:   0,
			expected: 10.0,
		},
		{
			name:     "offset only",
			value:    int16(100),
			scale:    0,
			offset:   50,
			expected: 150.0,
		},
		{
			name:     "scale and offset",
			value:    int16(100),
			scale:    0.1,
			offset:   5,
			expected: 15.0,
		},
		{
			name:     "non-numeric value unchanged",
			value:    "hello",
			scale:    0.1,
			offset:   5,
			expected: "hello",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := protocol.applyScaling(tc.value, tc.scale, tc.offset)
			if result != tc.expected {
				t.Errorf("Expected %v, got %v", tc.expected, result)
			}
		})
	}
}

func TestModbusBatchOptimization(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	// Test points with consecutive addresses
	points := []config.DataPointConfig{
		{
			Name:     "temp1",
			Address:  "40001",
			DataType: "float32",
		},
		{
			Name:     "temp2",
			Address:  "40002",
			DataType: "float32",
		},
		{
			Name:     "pressure",
			Address:  "40005",
			DataType: "int16",
		},
		{
			Name:     "status1",
			Address:  "coil:1",
			DataType: "bool",
		},
		{
			Name:     "status2",
			Address:  "coil:2",
			DataType: "bool",
		},
	}

	batches, err := protocol.optimizeBatchReads(points)
	if err != nil {
		t.Errorf("optimizeBatchReads() error = %v", err)
		return
	}

	// Should create separate batches for different register types
	if len(batches) < 2 {
		t.Errorf("Expected at least 2 batches (holding registers and coils), got %d", len(batches))
	}

	// Check that points are grouped correctly
	var holdingRegisterBatch, coilBatch *BatchReadRequest
	for i := range batches {
		switch batches[i].RegisterType {
		case RegisterTypeHoldingRegister:
			holdingRegisterBatch = &batches[i]
		case RegisterTypeCoil:
			coilBatch = &batches[i]
		}
	}

	if holdingRegisterBatch == nil {
		t.Error("Expected holding register batch")
	} else if len(holdingRegisterBatch.Points) != 3 {
		t.Errorf("Expected 3 holding register points, got %d", len(holdingRegisterBatch.Points))
	}

	if coilBatch == nil {
		t.Error("Expected coil batch")
	} else if len(coilBatch.Points) != 2 {
		t.Errorf("Expected 2 coil points, got %d", len(coilBatch.Points))
	}
}

func TestModbusRequestBuilding(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	// Set up config for request building
	protocol.config = &ModbusConfig{
		SlaveID: 1,
	}

	testCases := []struct {
		name         string
		addr         *ModbusAddress
		expectedFunc byte
		expectedLen  int
	}{
		{
			name: "holding register request",
			addr: &ModbusAddress{
				RegisterType: RegisterTypeHoldingRegister,
				Address:      100,
				Length:       1,
			},
			expectedFunc: FuncCodeReadHoldingRegisters,
			expectedLen:  12, // MBAP header (7) + PDU (5)
		},
		{
			name: "input register request",
			addr: &ModbusAddress{
				RegisterType: RegisterTypeInputRegister,
				Address:      200,
				Length:       2,
			},
			expectedFunc: FuncCodeReadInputRegisters,
			expectedLen:  12,
		},
		{
			name: "coil request",
			addr: &ModbusAddress{
				RegisterType: RegisterTypeCoil,
				Address:      50,
				Length:       8,
			},
			expectedFunc: FuncCodeReadCoils,
			expectedLen:  12,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			request, err := protocol.buildModbusRequest(tc.addr)
			if err != nil {
				t.Errorf("buildModbusRequest() error = %v", err)
				return
			}

			if len(request) != tc.expectedLen {
				t.Errorf("Expected request length %d, got %d", tc.expectedLen, len(request))
			}

			// Check function code (byte 7 in MBAP + PDU)
			if request[7] != tc.expectedFunc {
				t.Errorf("Expected function code 0x%02X, got 0x%02X", tc.expectedFunc, request[7])
			}

			// Check slave ID (byte 6)
			if request[6] != 1 {
				t.Errorf("Expected slave ID 1, got %d", request[6])
			}

			// Check address (bytes 8-9)
			address := binary.BigEndian.Uint16(request[8:10])
			if address != tc.addr.Address {
				t.Errorf("Expected address %d, got %d", tc.addr.Address, address)
			}

			// Check length (bytes 10-11)
			length := binary.BigEndian.Uint16(request[10:12])
			if length != tc.addr.Length {
				t.Errorf("Expected length %d, got %d", tc.addr.Length, length)
			}
		})
	}
}

func TestModbusExceptionHandling(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	testCases := []struct {
		code     byte
		expected string
	}{
		{0x01, "Illegal Function"},
		{0x02, "Illegal Data Address"},
		{0x03, "Illegal Data Value"},
		{0x04, "Slave Device Failure"},
		{0x05, "Acknowledge"},
		{0x06, "Slave Device Busy"},
		{0x08, "Memory Parity Error"},
		{0x0A, "Gateway Path Unavailable"},
		{0x0B, "Gateway Target Device Failed to Respond"},
		{0xFF, "Unknown Exception Code: 0xFF"},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("exception_0x%02X", tc.code), func(t *testing.T) {
			message := protocol.getExceptionMessage(tc.code)
			if message != tc.expected {
				t.Errorf("Expected '%s', got '%s'", tc.expected, message)
			}
		})
	}
}

func TestModbusConnectionManagement(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	// Test initial state
	if protocol.IsConnected() {
		t.Error("Protocol should not be connected initially")
	}

	// Test connection without config
	err = protocol.ensureConnection()
	if err == nil {
		t.Error("ensureConnection() should fail without config")
	}

	// Test with invalid config (should fail to connect)
	protocol.config = &ModbusConfig{
		Host:    "invalid-host-12345",
		Port:    99999,
		SlaveID: 1,
		Timeout: 1000,
	}

	err = protocol.ensureConnection()
	if err == nil {
		t.Error("ensureConnection() should fail with invalid host")
	}
}

func TestModbusAdvancedDataTypes(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewModbusTCPProtocol(logger)

	testCases := []struct {
		name         string
		rawData      []byte
		dataType     string
		registerType string
		expected     interface{}
		expectError  bool
	}{
		{
			name:         "int32 from holding registers",
			rawData:      []byte{0x00, 0x01, 0x00, 0x00}, // 65536 in big-endian
			dataType:     "int32",
			registerType: RegisterTypeHoldingRegister,
			expected:     int32(65536),
			expectError:  false,
		},
		{
			name:         "float32 from holding registers",
			rawData:      []byte{0x42, 0xC8, 0x00, 0x00}, // 100.0 in IEEE 754
			dataType:     "float32",
			registerType: RegisterTypeHoldingRegister,
			expected:     float32(100.0),
			expectError:  false,
		},
		{
			name:         "string from holding registers",
			rawData:      []byte{'H', 'e', 'l', 'l', 'o', '\x00'},
			dataType:     "string",
			registerType: RegisterTypeHoldingRegister,
			expected:     "Hello",
			expectError:  false,
		},
		{
			name:         "insufficient data for int32",
			rawData:      []byte{0x00, 0x01},
			dataType:     "int32",
			registerType: RegisterTypeHoldingRegister,
			expected:     nil,
			expectError:  true,
		},
		{
			name:         "unsupported data type",
			rawData:      []byte{0x00, 0x01},
			dataType:     "unsupported",
			registerType: RegisterTypeHoldingRegister,
			expected:     nil,
			expectError:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := protocol.convertRawData(tc.rawData, tc.dataType, tc.registerType)

			if tc.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if result != tc.expected {
				t.Errorf("Expected %v (%T), got %v (%T)", tc.expected, tc.expected, result, result)
			}
		})
	}
}
