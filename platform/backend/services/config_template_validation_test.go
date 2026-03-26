package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConfigTemplateService_ValidateTemplateConfig(t *testing.T) {
	service := &ConfigTemplateService{}

	tests := []struct {
		name     string
		protocol string
		config   map[string]interface{}
		wantErr  bool
	}{
		{
			name:     "Valid Modbus config",
			protocol: "modbus_tcp",
			config: map[string]interface{}{
				"connection": map[string]interface{}{
					"host": "192.168.1.100",
					"port": 502,
				},
				"data_points": []interface{}{
					map[string]interface{}{
						"address":   "40001",
						"data_type": "float32",
					},
				},
			},
			wantErr: false,
		},
		{
			name:     "Invalid Modbus config - missing host",
			protocol: "modbus_tcp",
			config: map[string]interface{}{
				"connection": map[string]interface{}{
					"port": 502,
				},
			},
			wantErr: true,
		},
		{
			name:     "Valid OPC-UA config",
			protocol: "opcua",
			config: map[string]interface{}{
				"server_url": "opc.tcp://localhost:4840",
				"data_points": []interface{}{
					map[string]interface{}{
						"node_id": "ns=2;i=1001",
					},
				},
			},
			wantErr: false,
		},
		{
			name:     "Invalid OPC-UA config - missing server_url",
			protocol: "opcua",
			config: map[string]interface{}{
				"data_points": []interface{}{},
			},
			wantErr: true,
		},
		{
			name:     "Valid MQTT config",
			protocol: "mqtt",
			config: map[string]interface{}{
				"broker_url": "tcp://localhost:1883",
				"topics": []interface{}{
					map[string]interface{}{
						"topic": "sensor/temperature",
					},
				},
			},
			wantErr: false,
		},
		{
			name:     "Invalid MQTT config - missing broker_url",
			protocol: "mqtt",
			config: map[string]interface{}{
				"topics": []interface{}{},
			},
			wantErr: true,
		},
		{
			name:     "Unsupported protocol",
			protocol: "unknown",
			config:   map[string]interface{}{},
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateTemplateConfig(tt.protocol, tt.config)
			
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConfigTemplateService_ApplyParameters(t *testing.T) {
	service := &ConfigTemplateService{}

	templateConfig := map[string]interface{}{
		"connection": map[string]interface{}{
			"host": "{{host}}",
			"port": 502,
		},
		"data_points": []interface{}{
			map[string]interface{}{
				"name":    "{{point_name}}",
				"address": "{{address}}",
			},
		},
		"static_value": "no_replacement",
	}

	parameters := map[string]interface{}{
		"host":       "192.168.1.100",
		"point_name": "temperature",
		"address":    "40001",
	}

	result := service.applyParameters(templateConfig, parameters)

	// Check that parameters were applied correctly
	connection := result["connection"].(map[string]interface{})
	assert.Equal(t, "192.168.1.100", connection["host"])
	assert.Equal(t, 502, connection["port"])

	dataPoints := result["data_points"].([]interface{})
	firstPoint := dataPoints[0].(map[string]interface{})
	assert.Equal(t, "temperature", firstPoint["name"])
	assert.Equal(t, "40001", firstPoint["address"])

	// Check that non-parameterized values remain unchanged
	assert.Equal(t, "no_replacement", result["static_value"])
}

func TestConfigTemplateService_IsValidVersion(t *testing.T) {
	service := &ConfigTemplateService{}

	tests := []struct {
		name    string
		version string
		want    bool
	}{
		{"Valid version 1.0.0", "1.0.0", true},
		{"Valid version 2.1.3", "2.1.3", true},
		{"Valid version 10.20.30", "10.20.30", true},
		{"Invalid version 1.0", "1.0", false},
		{"Invalid version 1.0.0.1", "1.0.0.1", false},
		{"Invalid version v1.0.0", "v1.0.0", false},
		{"Invalid version 1.0.a", "1.0.a", false},
		{"Empty version", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.isValidVersion(tt.version)
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestConfigTemplateService_IncrementVersion(t *testing.T) {
	service := &ConfigTemplateService{}

	tests := []struct {
		name           string
		currentVersion string
		expected       string
	}{
		{"Increment 1.0.0", "1.0.0", "1.0.1"},
		{"Increment 1.0.5", "1.0.5", "1.0.6"},
		{"Increment 2.1.9", "2.1.9", "2.1.10"},
		{"Invalid version", "invalid", "1.0.1"},
		{"Partial version", "1.0", "1.0.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.incrementVersion(tt.currentVersion)
			assert.Equal(t, tt.expected, result)
		})
	}
}