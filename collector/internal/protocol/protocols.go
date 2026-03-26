package protocol

import (
	"fmt"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol/mqtt"
)

// BaseProtocol provides common functionality for all protocols
type BaseProtocol struct {
	name      string
	logger    *logger.Logger
	connected bool
}

// NewBaseProtocol creates a new base protocol
func NewBaseProtocol(name string, logger *logger.Logger) *BaseProtocol {
	return &BaseProtocol{
		name:   name,
		logger: logger.WithGroup("protocol").With("protocol", name),
	}
}

// GetName returns the protocol name
func (bp *BaseProtocol) GetName() string {
	return bp.name
}

// IsConnected returns the connection status
func (bp *BaseProtocol) IsConnected() bool {
	return bp.connected
}

// setConnected sets the connection status
func (bp *BaseProtocol) setConnected(connected bool) {
	bp.connected = connected
}

// SetConnected sets the connection status (public method)
func (bp *BaseProtocol) SetConnected(connected bool) {
	bp.connected = connected
}

// Placeholder Modbus protocols - actual implementations are in modbus package
// These are kept for backward compatibility and will delegate to the real implementations

// ModbusTCPProtocol placeholder
type ModbusTCPProtocol struct {
	*BaseProtocol
}

// NewModbusTCPProtocol creates a placeholder Modbus TCP protocol instance
func NewModbusTCPProtocol(logger *logger.Logger) *ModbusTCPProtocol {
	return &ModbusTCPProtocol{
		BaseProtocol: NewBaseProtocol("modbus_tcp", logger),
	}
}

// Connect - placeholder implementation
func (m *ModbusTCPProtocol) Connect(config map[string]interface{}) error {
	m.logger.Info("Using placeholder Modbus TCP implementation")
	m.setConnected(true)
	return nil
}

// Collect - placeholder implementation
func (m *ModbusTCPProtocol) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	return m.generateMockData(points, "placeholder_modbus_tcp")
}

// Disconnect - placeholder implementation
func (m *ModbusTCPProtocol) Disconnect() error {
	m.setConnected(false)
	return nil
}

// Validate - placeholder implementation
func (m *ModbusTCPProtocol) Validate(config map[string]interface{}) error {
	requiredFields := []string{"host", "port", "slave_id"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	return nil
}

// ModbusRTUProtocol placeholder
type ModbusRTUProtocol struct {
	*BaseProtocol
}

// NewModbusRTUProtocol creates a placeholder Modbus RTU protocol instance
func NewModbusRTUProtocol(logger *logger.Logger) *ModbusRTUProtocol {
	return &ModbusRTUProtocol{
		BaseProtocol: NewBaseProtocol("modbus_rtu", logger),
	}
}

// Connect - placeholder implementation
func (m *ModbusRTUProtocol) Connect(config map[string]interface{}) error {
	m.logger.Info("Using placeholder Modbus RTU implementation")
	m.setConnected(true)
	return nil
}

// Collect - placeholder implementation
func (m *ModbusRTUProtocol) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	return m.generateMockData(points, "placeholder_modbus_rtu")
}

// Disconnect - placeholder implementation
func (m *ModbusRTUProtocol) Disconnect() error {
	m.setConnected(false)
	return nil
}

// Validate - placeholder implementation
func (m *ModbusRTUProtocol) Validate(config map[string]interface{}) error {
	requiredFields := []string{"serial_port", "baud_rate", "slave_id"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	return nil
}

// OPCUAProtocol placeholder - actual implementation is in opcua package
type OPCUAProtocol struct {
	*BaseProtocol
}

// NewOPCUAProtocol creates a placeholder OPC-UA protocol instance
func NewOPCUAProtocol(logger *logger.Logger) *OPCUAProtocol {
	return &OPCUAProtocol{
		BaseProtocol: NewBaseProtocol("opcua", logger),
	}
}

// Connect - placeholder implementation
func (o *OPCUAProtocol) Connect(config map[string]interface{}) error {
	o.logger.Info("Using placeholder OPC-UA implementation")
	o.setConnected(true)
	return nil
}

// Collect - placeholder implementation
func (o *OPCUAProtocol) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	return o.generateMockData(points, "placeholder_opcua")
}

// Disconnect - placeholder implementation
func (o *OPCUAProtocol) Disconnect() error {
	o.setConnected(false)
	return nil
}

// Validate - placeholder implementation
func (o *OPCUAProtocol) Validate(config map[string]interface{}) error {
	requiredFields := []string{"endpoint"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	return nil
}

// MQTTProtocol implements MQTT protocol (wrapper for actual implementation)
type MQTTProtocol struct {
	impl *mqtt.MQTTProtocol
}

// NewMQTTProtocol creates a new MQTT protocol instance
func NewMQTTProtocol(logger *logger.Logger) *MQTTProtocol {
	return &MQTTProtocol{
		impl: mqtt.NewMQTTProtocol(logger),
	}
}

// Connect establishes connection to MQTT broker
func (m *MQTTProtocol) Connect(config map[string]interface{}) error {
	return m.impl.Connect(config)
}

// Collect reads data from MQTT broker
func (m *MQTTProtocol) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	mqttData, err := m.impl.Collect(points)
	if err != nil {
		return nil, err
	}

	// Convert mqtt.DataValue to protocol.DataValue
	protocolData := make([]DataValue, len(mqttData))
	for i, data := range mqttData {
		protocolData[i] = DataValue{
			DeviceID:  data.DeviceID,
			PointName: data.PointName,
			Timestamp: data.Timestamp,
			Value:     data.Value,
			Quality:   data.Quality,
			DataType:  data.DataType,
			Unit:      data.Unit,
			Tags:      data.Tags,
			RawValue:  data.RawValue,
		}
	}

	return protocolData, nil
}

// Disconnect closes connection to MQTT broker
func (m *MQTTProtocol) Disconnect() error {
	return m.impl.Disconnect()
}

// IsConnected returns true if the protocol is currently connected
func (m *MQTTProtocol) IsConnected() bool {
	return m.impl.IsConnected()
}

// GetName returns the protocol name
func (m *MQTTProtocol) GetName() string {
	return m.impl.GetName()
}

// Validate validates MQTT configuration
func (m *MQTTProtocol) Validate(config map[string]interface{}) error {
	return m.impl.Validate(config)
}

// generateMockData generates mock data for testing (shared helper method)
func (bp *BaseProtocol) generateMockData(points []config.DataPointConfig, deviceID string) ([]DataValue, error) {
	dataValues := make([]DataValue, 0, len(points))
	now := time.Now()

	for _, point := range points {
		var value interface{}
		switch point.DataType {
		case "float32", "float64":
			value = 25.5 + float64(now.Unix()%100)/10.0
		case "int16", "int32":
			value = int32(now.Unix() % 1000)
		case "bool":
			value = (now.Unix() % 2) == 0
		default:
			value = fmt.Sprintf("mock_value_%d", now.Unix())
		}

		dataValue := DataValue{
			DeviceID:  deviceID,
			PointName: point.Name,
			Timestamp: now,
			Value:     value,
			Quality:   1,
			DataType:  point.DataType,
			Unit:      point.Unit,
			Tags:      make(map[string]string),
		}

		for k, v := range point.Tags {
			dataValue.Tags[k] = v
		}

		dataValues = append(dataValues, dataValue)
	}

	return dataValues, nil
}
