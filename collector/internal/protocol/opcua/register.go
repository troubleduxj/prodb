package opcua

import (
	"prodb/collector/internal/logger"
)

// ProtocolRegistrar defines the interface for registering protocols
type ProtocolRegistrar interface {
	RegisterProtocol(name string, protocol interface{}) error
}

// RegisterWithManager registers the OPC-UA protocol with the protocol manager
func RegisterWithManager(registrar ProtocolRegistrar, logger *logger.Logger) error {
	protocol := NewOPCUAProtocol(logger)
	return registrar.RegisterProtocol("opcua", protocol)
}

// RegisterOPCUAProtocolFunc is a function type for registering protocols
type RegisterOPCUAProtocolFunc func(registrar ProtocolRegistrar, logger *logger.Logger) error

// GetOPCUAProtocolRegistrar returns the registration function
func GetOPCUAProtocolRegistrar() RegisterOPCUAProtocolFunc {
	return RegisterWithManager
}