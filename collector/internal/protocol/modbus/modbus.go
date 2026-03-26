package modbus

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// Modbus function codes
const (
	FuncCodeReadCoils            = 0x01
	FuncCodeReadDiscreteInputs   = 0x02
	FuncCodeReadHoldingRegisters = 0x03
	FuncCodeReadInputRegisters   = 0x04
)

// Modbus register types
const (
	RegisterTypeCoil            = "coil"
	RegisterTypeDiscreteInput   = "discrete_input"
	RegisterTypeInputRegister   = "input_register"
	RegisterTypeHoldingRegister = "holding_register"
)

// ModbusConfig represents Modbus-specific configuration
type ModbusConfig struct {
	Host    string `json:"host"`
	Port    int    `json:"port"`
	SlaveID byte   `json:"slave_id"`
	Timeout int    `json:"timeout"` // milliseconds

	// RTU specific
	SerialPort string `json:"serial_port,omitempty"`
	BaudRate   int    `json:"baud_rate,omitempty"`

	// Advanced settings
	RetryCount int `json:"retry_count,omitempty"`
	RetryDelay int `json:"retry_delay,omitempty"`
}

// ModbusAddress represents a parsed Modbus address
type ModbusAddress struct {
	RegisterType string
	Address      uint16
	Length       uint16
}

// ModbusTCPProtocol implements Modbus TCP protocol
type ModbusTCPProtocol struct {
	*protocol.BaseProtocol

	config  *ModbusConfig
	conn    net.Conn
	mutex   sync.Mutex
	transID uint16
	logger  *logger.Logger
}

// ModbusRTUProtocol implements Modbus RTU protocol
type ModbusRTUProtocol struct {
	*protocol.BaseProtocol

	config *ModbusConfig
	conn   io.ReadWriteCloser
	mutex  sync.Mutex
	logger *logger.Logger
}

// NewModbusTCPProtocol creates a new Modbus TCP protocol instance
func NewModbusTCPProtocol(logger *logger.Logger) *ModbusTCPProtocol {
	return &ModbusTCPProtocol{
		BaseProtocol: protocol.NewBaseProtocol("modbus_tcp", logger),
		logger:       logger.WithGroup("modbus_tcp"),
	}
}

// NewModbusRTUProtocol creates a new Modbus RTU protocol instance
func NewModbusRTUProtocol(logger *logger.Logger) *ModbusRTUProtocol {
	return &ModbusRTUProtocol{
		BaseProtocol: protocol.NewBaseProtocol("modbus_rtu", logger),
		logger:       logger.WithGroup("modbus_rtu"),
	}
}

// Connect establishes connection to Modbus TCP device
func (m *ModbusTCPProtocol) Connect(configMap map[string]interface{}) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	config, err := m.parseConfig(configMap)
	if err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}
	m.config = config

	address := fmt.Sprintf("%s:%d", config.Host, config.Port)
	timeout := time.Duration(config.Timeout) * time.Millisecond
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	m.logger.Info("Connecting to Modbus TCP device", "address", address)

	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", address, err)
	}

	m.conn = conn
	m.SetConnected(true)

	m.logger.Info("Connected to Modbus TCP device", "address", address)
	return nil
}

// Connect establishes connection to Modbus RTU device
func (m *ModbusRTUProtocol) Connect(configMap map[string]interface{}) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	config, err := m.parseConfig(configMap)
	if err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}
	m.config = config

	m.logger.Info("Connecting to Modbus RTU device (mock)", "serial_port", config.SerialPort)

	// Mock connection for RTU
	m.conn = &mockSerialConnection{}
	m.SetConnected(true)

	m.logger.Info("Connected to Modbus RTU device (mock)")
	return nil
}

// Collect reads data from Modbus TCP device
func (m *ModbusTCPProtocol) Collect(points []config.DataPointConfig) ([]protocol.DataValue, error) {
	// Ensure connection is active
	if err := m.ensureConnection(); err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	m.logger.Debug("Collecting data from Modbus TCP", "points", len(points))

	dataValues := make([]protocol.DataValue, 0, len(points))
	now := time.Now()

	// Try batch optimization first
	if len(points) > 1 {
		if batchValues, err := m.collectBatch(points, now); err == nil {
			m.logger.Debug("Batch collection completed", "values_collected", len(batchValues))
			return batchValues, nil
		} else {
			m.logger.Warn("Batch collection failed, falling back to individual reads", "error", err)
		}
	}

	// Fall back to individual point collection
	for _, point := range points {
		value, err := m.collectSinglePoint(point, now)
		if err != nil {
			m.logger.Error("Failed to collect point", "point", point.Name, "error", err)
			// Create error value
			value = protocol.DataValue{
				DeviceID:  m.getDeviceID(),
				PointName: point.Name,
				Timestamp: now,
				Value:     nil,
				Quality:   0, // Bad quality
				DataType:  point.DataType,
				Unit:      point.Unit,
				Tags:      m.copyTags(point.Tags),
			}
		}
		dataValues = append(dataValues, value)
	}

	m.logger.Debug("Data collection completed", "values_collected", len(dataValues))
	return dataValues, nil
}

// collectBatch performs optimized batch reading
func (m *ModbusTCPProtocol) collectBatch(points []config.DataPointConfig, timestamp time.Time) ([]protocol.DataValue, error) {
	batches, err := m.optimizeBatchReads(points)
	if err != nil {
		return nil, fmt.Errorf("failed to optimize batch reads: %w", err)
	}

	dataValues := make([]protocol.DataValue, 0, len(points))

	for _, batch := range batches {
		batchAddr := &ModbusAddress{
			RegisterType: batch.RegisterType,
			Address:      batch.StartAddress,
			Length:       batch.Length,
		}

		// Read batch data
		rawData, err := m.readModbusData(batchAddr)
		if err != nil {
			return nil, fmt.Errorf("batch read failed: %w", err)
		}

		// Process each point in the batch
		for _, pointWithAddr := range batch.Points {
			point := pointWithAddr.Point

			// Calculate offset within batch data
			offset := int(pointWithAddr.Address.Address - batch.StartAddress)
			var pointData []byte

			switch batch.RegisterType {
			case RegisterTypeCoil, RegisterTypeDiscreteInput:
				// For bits, extract the specific bit
				byteIndex := offset / 8
				bitIndex := offset % 8
				if byteIndex < len(rawData) {
					bitValue := (rawData[byteIndex] >> bitIndex) & 0x01
					pointData = []byte{bitValue}
				} else {
					pointData = []byte{0}
				}

			case RegisterTypeInputRegister, RegisterTypeHoldingRegister:
				// For registers, extract 2 bytes per register
				regOffset := offset * 2
				if regOffset+1 < len(rawData) {
					pointData = rawData[regOffset : regOffset+2]
				} else {
					pointData = make([]byte, 2) // Default to zeros
				}
			}

			// Convert and scale data
			value, err := m.convertRawData(pointData, point.DataType, batch.RegisterType)
			if err != nil {
				m.logger.Error("Data conversion failed in batch", "point", point.Name, "error", err)
				value = nil
			} else {
				value = m.applyScaling(value, point.Scale, point.Offset)
			}

			dataValue := protocol.DataValue{
				DeviceID:  m.getDeviceID(),
				PointName: point.Name,
				Timestamp: timestamp,
				Value:     value,
				Quality:   1, // Good quality
				DataType:  point.DataType,
				Unit:      point.Unit,
				Tags:      m.copyTags(point.Tags),
				RawValue:  pointData,
			}

			if err != nil {
				dataValue.Quality = 0 // Bad quality on conversion error
			}

			dataValues = append(dataValues, dataValue)
		}
	}

	return dataValues, nil
}

// Collect reads data from Modbus RTU device
func (m *ModbusRTUProtocol) Collect(points []config.DataPointConfig) ([]protocol.DataValue, error) {
	if !m.IsConnected() {
		return nil, fmt.Errorf("not connected to Modbus RTU device")
	}

	m.logger.Debug("Collecting data from Modbus RTU", "points", len(points))

	dataValues := make([]protocol.DataValue, 0, len(points))
	now := time.Now()

	for _, point := range points {
		value := m.generateMockValue(point, now)
		dataValues = append(dataValues, value)
	}

	m.logger.Debug("Data collection completed (mock)", "values_collected", len(dataValues))
	return dataValues, nil
}

// collectSinglePoint collects data from a single point
func (m *ModbusTCPProtocol) collectSinglePoint(point config.DataPointConfig, timestamp time.Time) (protocol.DataValue, error) {
	addr, err := m.parseAddress(point.Address)
	if err != nil {
		return protocol.DataValue{}, fmt.Errorf("invalid address %s: %w", point.Address, err)
	}

	// Perform actual Modbus TCP read operation
	rawData, err := m.readModbusData(addr)
	if err != nil {
		return protocol.DataValue{}, fmt.Errorf("modbus read failed: %w", err)
	}

	value, err := m.convertRawData(rawData, point.DataType, addr.RegisterType)
	if err != nil {
		return protocol.DataValue{}, fmt.Errorf("data conversion failed: %w", err)
	}

	value = m.applyScaling(value, point.Scale, point.Offset)

	return protocol.DataValue{
		DeviceID:  m.getDeviceID(),
		PointName: point.Name,
		Timestamp: timestamp,
		Value:     value,
		Quality:   1, // Good quality
		DataType:  point.DataType,
		Unit:      point.Unit,
		Tags:      m.copyTags(point.Tags),
		RawValue:  rawData,
	}, nil
}

// parseAddress parses a Modbus address string
func (m *ModbusTCPProtocol) parseAddress(addressStr string) (*ModbusAddress, error) {
	addr := &ModbusAddress{Length: 1}

	if strings.Contains(addressStr, ":") {
		parts := strings.Split(addressStr, ":")
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid address format: %s", addressStr)
		}

		registerType := strings.ToLower(parts[0])
		switch registerType {
		case "holding", "holding_register":
			addr.RegisterType = RegisterTypeHoldingRegister
		case "input", "input_register":
			addr.RegisterType = RegisterTypeInputRegister
		case "coil":
			addr.RegisterType = RegisterTypeCoil
		case "discrete", "discrete_input":
			addr.RegisterType = RegisterTypeDiscreteInput
		default:
			return nil, fmt.Errorf("unknown register type: %s", registerType)
		}

		address, err := strconv.ParseUint(parts[1], 10, 16)
		if err != nil {
			return nil, fmt.Errorf("invalid address number: %s", parts[1])
		}
		addr.Address = uint16(address)
	} else {
		address, err := strconv.ParseUint(addressStr, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("invalid address: %s", addressStr)
		}

		if address < 1 {
			return nil, fmt.Errorf("address must be >= 1")
		}

		switch {
		case address >= 1 && address <= 9999:
			addr.RegisterType = RegisterTypeCoil
			addr.Address = uint16(address - 1)
		case address >= 10001 && address <= 19999:
			addr.RegisterType = RegisterTypeDiscreteInput
			addr.Address = uint16(address - 10001)
		case address >= 30001 && address <= 39999:
			addr.RegisterType = RegisterTypeInputRegister
			addr.Address = uint16(address - 30001)
		case address >= 40001 && address <= 49999:
			addr.RegisterType = RegisterTypeHoldingRegister
			addr.Address = uint16(address - 40001)
		default:
			return nil, fmt.Errorf("address %d out of valid range", address)
		}
	}

	return addr, nil
}

// convertRawData converts raw bytes to typed value
func (m *ModbusTCPProtocol) convertRawData(rawData []byte, dataType, registerType string) (interface{}, error) {
	switch registerType {
	case RegisterTypeCoil, RegisterTypeDiscreteInput:
		if len(rawData) == 0 {
			return false, nil
		}
		return rawData[0] != 0, nil

	case RegisterTypeInputRegister, RegisterTypeHoldingRegister:
		switch dataType {
		case "bool":
			if len(rawData) < 2 {
				return false, fmt.Errorf("insufficient data for bool")
			}
			value := binary.BigEndian.Uint16(rawData[0:2])
			return value != 0, nil

		case "int16":
			if len(rawData) < 2 {
				return int16(0), fmt.Errorf("insufficient data for int16")
			}
			return int16(binary.BigEndian.Uint16(rawData[0:2])), nil

		case "int32":
			if len(rawData) < 4 {
				return int32(0), fmt.Errorf("insufficient data for int32")
			}
			return int32(binary.BigEndian.Uint32(rawData[0:4])), nil

		case "float32":
			if len(rawData) < 4 {
				return float32(0), fmt.Errorf("insufficient data for float32")
			}
			bits := binary.BigEndian.Uint32(rawData[0:4])
			return math.Float32frombits(bits), nil

		case "float64":
			if len(rawData) < 8 {
				return float64(0), fmt.Errorf("insufficient data for float64")
			}
			bits := binary.BigEndian.Uint64(rawData[0:8])
			return math.Float64frombits(bits), nil

		case "string":
			str := string(rawData)
			if nullIndex := strings.Index(str, "\x00"); nullIndex >= 0 {
				str = str[:nullIndex]
			}
			return str, nil

		default:
			return nil, fmt.Errorf("unsupported data type: %s", dataType)
		}

	default:
		return nil, fmt.Errorf("unsupported register type: %s", registerType)
	}
}

// applyScaling applies scaling and offset to a numeric value
func (m *ModbusTCPProtocol) applyScaling(value interface{}, scale, offset float64) interface{} {
	if scale == 0 && offset == 0 {
		return value
	}

	var numValue float64
	var ok bool

	switch v := value.(type) {
	case int16:
		numValue = float64(v)
		ok = true
	case int32:
		numValue = float64(v)
		ok = true
	case float32:
		numValue = float64(v)
		ok = true
	case float64:
		numValue = v
		ok = true
	}

	if !ok {
		return value
	}

	if scale != 0 {
		numValue *= scale
	}

	if offset != 0 {
		numValue += offset
	}

	return numValue
}

// generateMockValue generates a mock value for RTU testing
func (m *ModbusRTUProtocol) generateMockValue(point config.DataPointConfig, timestamp time.Time) protocol.DataValue {
	var value interface{}

	switch point.DataType {
	case "float32", "float64":
		value = 25.5 + float64(timestamp.Unix()%100)/10.0
	case "int16", "int32":
		value = int32(timestamp.Unix() % 1000)
	case "bool":
		value = (timestamp.Unix() % 2) == 0
	default:
		value = fmt.Sprintf("mock_rtu_value_%d", timestamp.Unix())
	}

	value = m.applyScaling(value, point.Scale, point.Offset)

	return protocol.DataValue{
		DeviceID:  m.getDeviceID(),
		PointName: point.Name,
		Timestamp: timestamp,
		Value:     value,
		Quality:   1,
		DataType:  point.DataType,
		Unit:      point.Unit,
		Tags:      m.copyTags(point.Tags),
	}
}

// Disconnect closes connection to Modbus TCP device
func (m *ModbusTCPProtocol) Disconnect() error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if !m.IsConnected() {
		return nil
	}

	m.logger.Info("Disconnecting from Modbus TCP device")

	if m.conn != nil {
		if err := m.conn.Close(); err != nil {
			m.logger.Error("Error closing connection", "error", err)
		}
		m.conn = nil
	}

	m.SetConnected(false)
	m.logger.Info("Disconnected from Modbus TCP device")

	return nil
}

// Disconnect closes connection to Modbus RTU device
func (m *ModbusRTUProtocol) Disconnect() error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if !m.IsConnected() {
		return nil
	}

	m.logger.Info("Disconnecting from Modbus RTU device")

	if m.conn != nil {
		if err := m.conn.Close(); err != nil {
			m.logger.Error("Error closing connection", "error", err)
		}
		m.conn = nil
	}

	m.SetConnected(false)
	m.logger.Info("Disconnected from Modbus RTU device")

	return nil
}

// Validate validates Modbus TCP configuration
func (m *ModbusTCPProtocol) Validate(config map[string]interface{}) error {
	requiredFields := []string{"host", "port", "slave_id"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}

	if port, ok := config["port"].(float64); ok {
		if port < 1 || port > 65535 {
			return fmt.Errorf("invalid port: %v", port)
		}
	}

	if slaveID, ok := config["slave_id"].(float64); ok {
		if slaveID < 1 || slaveID > 255 {
			return fmt.Errorf("invalid slave_id: %v", slaveID)
		}
	}

	return nil
}

// Validate validates Modbus RTU configuration
func (m *ModbusRTUProtocol) Validate(config map[string]interface{}) error {
	requiredFields := []string{"serial_port", "baud_rate", "slave_id"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}

	if baudRate, ok := config["baud_rate"].(float64); ok {
		validBaudRates := []float64{9600, 19200, 38400, 57600, 115200}
		valid := false
		for _, rate := range validBaudRates {
			if baudRate == rate {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Errorf("invalid baud_rate: %v", baudRate)
		}
	}

	if slaveID, ok := config["slave_id"].(float64); ok {
		if slaveID < 1 || slaveID > 255 {
			return fmt.Errorf("invalid slave_id: %v", slaveID)
		}
	}

	return nil
}

// parseConfig parses configuration map into ModbusConfig struct
func (m *ModbusTCPProtocol) parseConfig(configMap map[string]interface{}) (*ModbusConfig, error) {
	config := &ModbusConfig{
		Timeout:    5000, // Default 5 seconds
		RetryCount: 3,    // Default retry count
		RetryDelay: 100,  // Default retry delay (ms)
	}

	if host, ok := configMap["host"].(string); ok {
		config.Host = host
	}

	if port, ok := configMap["port"].(float64); ok {
		config.Port = int(port)
	}

	if slaveID, ok := configMap["slave_id"].(float64); ok {
		config.SlaveID = byte(slaveID)
	}

	if timeout, ok := configMap["timeout"].(float64); ok {
		config.Timeout = int(timeout)
	}

	return config, nil
}

// parseConfig parses configuration map into ModbusConfig struct for RTU
func (m *ModbusRTUProtocol) parseConfig(configMap map[string]interface{}) (*ModbusConfig, error) {
	config := &ModbusConfig{
		BaudRate:   9600, // Default baud rate
		Timeout:    5000, // Default 5 seconds
		RetryCount: 3,    // Default retry count
		RetryDelay: 100,  // Default retry delay (ms)
	}

	if serialPort, ok := configMap["serial_port"].(string); ok {
		config.SerialPort = serialPort
	}

	if baudRate, ok := configMap["baud_rate"].(float64); ok {
		config.BaudRate = int(baudRate)
	}

	if slaveID, ok := configMap["slave_id"].(float64); ok {
		config.SlaveID = byte(slaveID)
	}

	if timeout, ok := configMap["timeout"].(float64); ok {
		config.Timeout = int(timeout)
	}

	return config, nil
}

// Helper methods
func (m *ModbusTCPProtocol) getDeviceID() string {
	return fmt.Sprintf("modbus_tcp_%s_%d_%d", m.config.Host, m.config.Port, m.config.SlaveID)
}

func (m *ModbusRTUProtocol) getDeviceID() string {
	return fmt.Sprintf("modbus_rtu_%s_%d", m.config.SerialPort, m.config.SlaveID)
}

func (m *ModbusTCPProtocol) copyTags(tags map[string]string) map[string]string {
	result := make(map[string]string)
	for k, v := range tags {
		result[k] = v
	}
	return result
}

func (m *ModbusRTUProtocol) copyTags(tags map[string]string) map[string]string {
	result := make(map[string]string)
	for k, v := range tags {
		result[k] = v
	}
	return result
}

func (m *ModbusRTUProtocol) applyScaling(value interface{}, scale, offset float64) interface{} {
	if scale == 0 && offset == 0 {
		return value
	}

	var numValue float64
	var ok bool

	switch v := value.(type) {
	case int16:
		numValue = float64(v)
		ok = true
	case int32:
		numValue = float64(v)
		ok = true
	case float32:
		numValue = float64(v)
		ok = true
	case float64:
		numValue = v
		ok = true
	}

	if !ok {
		return value
	}

	if scale != 0 {
		numValue *= scale
	}

	if offset != 0 {
		numValue += offset
	}

	return numValue
}

// readModbusData performs actual Modbus TCP read operation
func (m *ModbusTCPProtocol) readModbusData(addr *ModbusAddress) ([]byte, error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if !m.IsConnected() || m.conn == nil {
		return nil, fmt.Errorf("not connected to Modbus device")
	}

	// Build Modbus TCP request
	request, err := m.buildModbusRequest(addr)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	// Send request with retry logic
	var response []byte
	for attempt := 0; attempt <= m.config.RetryCount; attempt++ {
		if attempt > 0 {
			m.logger.Debug("Retrying Modbus request", "attempt", attempt, "address", addr.Address)
			time.Sleep(time.Duration(m.config.RetryDelay) * time.Millisecond)
		}

		// Set timeout for this operation
		if err := m.conn.SetDeadline(time.Now().Add(time.Duration(m.config.Timeout) * time.Millisecond)); err != nil {
			m.logger.Error("Failed to set connection deadline", "error", err)
			continue
		}

		// Send request
		_, err = m.conn.Write(request)
		if err != nil {
			m.logger.Error("Failed to write Modbus request", "error", err, "attempt", attempt)
			if attempt == m.config.RetryCount {
				return nil, fmt.Errorf("failed to write request after %d attempts: %w", m.config.RetryCount+1, err)
			}
			continue
		}

		// Read response
		response, err = m.readModbusResponse()
		if err != nil {
			m.logger.Error("Failed to read Modbus response", "error", err, "attempt", attempt)
			if attempt == m.config.RetryCount {
				return nil, fmt.Errorf("failed to read response after %d attempts: %w", m.config.RetryCount+1, err)
			}
			continue
		}

		// Success
		break
	}

	// Parse response and extract data
	data, err := m.parseModbusResponse(response, addr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return data, nil
}

// buildModbusRequest builds a Modbus TCP request packet
func (m *ModbusTCPProtocol) buildModbusRequest(addr *ModbusAddress) ([]byte, error) {
	// Increment transaction ID
	m.transID++

	var functionCode byte
	switch addr.RegisterType {
	case RegisterTypeCoil:
		functionCode = FuncCodeReadCoils
	case RegisterTypeDiscreteInput:
		functionCode = FuncCodeReadDiscreteInputs
	case RegisterTypeInputRegister:
		functionCode = FuncCodeReadInputRegisters
	case RegisterTypeHoldingRegister:
		functionCode = FuncCodeReadHoldingRegisters
	default:
		return nil, fmt.Errorf("unsupported register type: %s", addr.RegisterType)
	}

	// Build Modbus TCP ADU (Application Data Unit)
	// MBAP Header (7 bytes) + PDU (Protocol Data Unit)
	request := make([]byte, 12)

	// MBAP Header
	binary.BigEndian.PutUint16(request[0:2], m.transID) // Transaction ID
	binary.BigEndian.PutUint16(request[2:4], 0)         // Protocol ID (always 0 for Modbus)
	binary.BigEndian.PutUint16(request[4:6], 6)         // Length (6 bytes following)
	request[6] = m.config.SlaveID                       // Unit ID

	// PDU
	request[7] = functionCode                               // Function Code
	binary.BigEndian.PutUint16(request[8:10], addr.Address) // Starting Address
	binary.BigEndian.PutUint16(request[10:12], addr.Length) // Quantity

	return request, nil
}

// readModbusResponse reads and validates Modbus TCP response
func (m *ModbusTCPProtocol) readModbusResponse() ([]byte, error) {
	// Read MBAP header first (7 bytes)
	header := make([]byte, 7)
	_, err := io.ReadFull(m.conn, header)
	if err != nil {
		return nil, fmt.Errorf("failed to read MBAP header: %w", err)
	}

	// Parse MBAP header
	transID := binary.BigEndian.Uint16(header[0:2])
	protocolID := binary.BigEndian.Uint16(header[2:4])
	length := binary.BigEndian.Uint16(header[4:6])
	unitID := header[6]

	// Validate header
	if transID != m.transID {
		return nil, fmt.Errorf("transaction ID mismatch: expected %d, got %d", m.transID, transID)
	}
	if protocolID != 0 {
		return nil, fmt.Errorf("invalid protocol ID: %d", protocolID)
	}
	if unitID != m.config.SlaveID {
		return nil, fmt.Errorf("unit ID mismatch: expected %d, got %d", m.config.SlaveID, unitID)
	}

	// Read PDU (length - 1 byte for unit ID)
	pduLength := int(length) - 1
	if pduLength <= 0 || pduLength > 253 {
		return nil, fmt.Errorf("invalid PDU length: %d", pduLength)
	}

	pdu := make([]byte, pduLength)
	_, err = io.ReadFull(m.conn, pdu)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDU: %w", err)
	}

	// Check for exception response
	if len(pdu) >= 2 && (pdu[0]&0x80) != 0 {
		exceptionCode := pdu[1]
		return nil, fmt.Errorf("modbus exception: %s", m.getExceptionMessage(exceptionCode))
	}

	return pdu, nil
}

// parseModbusResponse extracts data from Modbus response PDU
func (m *ModbusTCPProtocol) parseModbusResponse(pdu []byte, addr *ModbusAddress) ([]byte, error) {
	if len(pdu) < 2 {
		return nil, fmt.Errorf("PDU too short: %d bytes", len(pdu))
	}

	functionCode := pdu[0]

	switch addr.RegisterType {
	case RegisterTypeCoil, RegisterTypeDiscreteInput:
		if len(pdu) < 3 {
			return nil, fmt.Errorf("insufficient data for coil/discrete response")
		}
		byteCount := pdu[1]
		if len(pdu) < int(2+byteCount) {
			return nil, fmt.Errorf("PDU length mismatch: expected %d, got %d", 2+byteCount, len(pdu))
		}

		// Extract bit data (for single bit, return first bit of first byte)
		data := pdu[2 : 2+byteCount]
		if len(data) > 0 {
			return []byte{data[0] & 0x01}, nil
		}
		return []byte{0}, nil

	case RegisterTypeInputRegister, RegisterTypeHoldingRegister:
		if len(pdu) < 3 {
			return nil, fmt.Errorf("insufficient data for register response")
		}
		byteCount := pdu[1]
		if len(pdu) < int(2+byteCount) {
			return nil, fmt.Errorf("PDU length mismatch: expected %d, got %d", 2+byteCount, len(pdu))
		}

		// Extract register data
		return pdu[2 : 2+byteCount], nil

	default:
		return nil, fmt.Errorf("unsupported function code: 0x%02X", functionCode)
	}
}

// getExceptionMessage returns human-readable exception message
func (m *ModbusTCPProtocol) getExceptionMessage(code byte) string {
	switch code {
	case 0x01:
		return "Illegal Function"
	case 0x02:
		return "Illegal Data Address"
	case 0x03:
		return "Illegal Data Value"
	case 0x04:
		return "Slave Device Failure"
	case 0x05:
		return "Acknowledge"
	case 0x06:
		return "Slave Device Busy"
	case 0x08:
		return "Memory Parity Error"
	case 0x0A:
		return "Gateway Path Unavailable"
	case 0x0B:
		return "Gateway Target Device Failed to Respond"
	default:
		return fmt.Sprintf("Unknown Exception Code: 0x%02X", code)
	}
}

// Batch optimization methods
func (m *ModbusTCPProtocol) optimizeBatchReads(points []config.DataPointConfig) ([]BatchReadRequest, error) {
	// Group points by register type and consecutive addresses
	groups := make(map[string][]config.DataPointConfig)

	for _, point := range points {
		addr, err := m.parseAddress(point.Address)
		if err != nil {
			continue // Skip invalid addresses
		}

		key := fmt.Sprintf("%s", addr.RegisterType)
		groups[key] = append(groups[key], point)
	}

	var batches []BatchReadRequest
	for registerType, groupPoints := range groups {
		// Sort points by address for consecutive reading
		sortedPoints := make([]PointWithAddress, 0, len(groupPoints))
		for _, point := range groupPoints {
			addr, _ := m.parseAddress(point.Address)
			sortedPoints = append(sortedPoints, PointWithAddress{
				Point:   point,
				Address: addr,
			})
		}

		// Sort by address
		for i := 0; i < len(sortedPoints)-1; i++ {
			for j := i + 1; j < len(sortedPoints); j++ {
				if sortedPoints[i].Address.Address > sortedPoints[j].Address.Address {
					sortedPoints[i], sortedPoints[j] = sortedPoints[j], sortedPoints[i]
				}
			}
		}

		// Create batches for consecutive addresses
		if len(sortedPoints) > 0 {
			batch := BatchReadRequest{
				RegisterType: registerType,
				StartAddress: sortedPoints[0].Address.Address,
				Points:       []PointWithAddress{sortedPoints[0]},
			}

			for i := 1; i < len(sortedPoints); i++ {
				currentAddr := sortedPoints[i].Address.Address
				lastAddr := batch.StartAddress + uint16(len(batch.Points)) - 1

				// If addresses are consecutive (within reasonable range), add to batch
				if currentAddr <= lastAddr+10 { // Allow small gaps
					batch.Points = append(batch.Points, sortedPoints[i])
				} else {
					// Finalize current batch and start new one
					batch.Length = uint16(len(batch.Points))
					batches = append(batches, batch)

					batch = BatchReadRequest{
						RegisterType: registerType,
						StartAddress: currentAddr,
						Points:       []PointWithAddress{sortedPoints[i]},
					}
				}
			}

			// Add final batch
			batch.Length = uint16(len(batch.Points))
			batches = append(batches, batch)
		}
	}

	return batches, nil
}

// BatchReadRequest represents a batch read operation
type BatchReadRequest struct {
	RegisterType string
	StartAddress uint16
	Length       uint16
	Points       []PointWithAddress
}

// PointWithAddress combines a data point with its parsed address
type PointWithAddress struct {
	Point   config.DataPointConfig
	Address *ModbusAddress
}

// Connection management with automatic reconnection
func (m *ModbusTCPProtocol) ensureConnection() error {
	if m.IsConnected() && m.conn != nil {
		// Test connection with a simple read
		if err := m.testConnection(); err == nil {
			return nil // Connection is good
		}

		// Connection is bad, close it
		m.logger.Warn("Connection test failed, reconnecting")
		m.closeConnection()
	}

	// Reconnect
	return m.reconnect()
}

// testConnection tests if the connection is still alive
func (m *ModbusTCPProtocol) testConnection() error {
	if m.conn == nil {
		return fmt.Errorf("no connection")
	}

	// Set a short timeout for the test
	if err := m.conn.SetDeadline(time.Now().Add(1 * time.Second)); err != nil {
		return err
	}

	// Try to read a single coil (minimal request)
	testAddr := &ModbusAddress{
		RegisterType: RegisterTypeCoil,
		Address:      0,
		Length:       1,
	}

	request, err := m.buildModbusRequest(testAddr)
	if err != nil {
		return err
	}

	_, err = m.conn.Write(request)
	if err != nil {
		return err
	}

	_, err = m.readModbusResponse()
	return err
}

// closeConnection safely closes the current connection
func (m *ModbusTCPProtocol) closeConnection() {
	if m.conn != nil {
		m.conn.Close()
		m.conn = nil
	}
	m.SetConnected(false)
}

// reconnect attempts to reconnect to the Modbus device
func (m *ModbusTCPProtocol) reconnect() error {
	if m.config == nil {
		return fmt.Errorf("no configuration available for reconnection")
	}

	address := fmt.Sprintf("%s:%d", m.config.Host, m.config.Port)
	timeout := time.Duration(m.config.Timeout) * time.Millisecond

	m.logger.Info("Attempting to reconnect to Modbus TCP device", "address", address)

	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return fmt.Errorf("failed to reconnect to %s: %w", address, err)
	}

	m.conn = conn
	m.SetConnected(true)

	m.logger.Info("Successfully reconnected to Modbus TCP device", "address", address)
	return nil
}

// mockSerialConnection is a mock implementation for RTU testing
type mockSerialConnection struct{}

func (m *mockSerialConnection) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

func (m *mockSerialConnection) Write(p []byte) (n int, err error) {
	return len(p), nil
}

func (m *mockSerialConnection) Close() error {
	return nil
}

// RegisterModbusProtocols registers Modbus protocols with the protocol manager
func RegisterModbusProtocols(registerFunc func(string, interface{}) error, logger *logger.Logger) error {
	if err := registerFunc("modbus_tcp", NewModbusTCPProtocol(logger)); err != nil {
		return err
	}
	if err := registerFunc("modbus_rtu", NewModbusRTUProtocol(logger)); err != nil {
		return err
	}
	return nil
}
