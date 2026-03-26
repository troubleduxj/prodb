package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConfigDeliveryService_ValidateConfiguration(t *testing.T) {
	service := &ConfigDeliveryService{}

	tests := []struct {
		name    string
		config  map[string]interface{}
		wantErr bool
	}{
		{
			name:    "Empty configuration",
			config:  nil,
			wantErr: true,
		},
		{
			name:    "Valid basic configuration",
			config:  map[string]interface{}{
				"heartbeat_interval": 60.0,
				"data_buffer_size":   1000.0,
			},
			wantErr: false,
		},
		{
			name: "Valid configuration with collection tasks",
			config: map[string]interface{}{
				"heartbeat_interval": 60.0,
				"data_buffer_size":   1000.0,
				"collection_tasks": []interface{}{
					map[string]interface{}{
						"name":     "Temperature Sensor",
						"protocol": "modbus_tcp",
						"config": map[string]interface{}{
							"host": "192.168.1.100",
							"port": 502,
						},
						"schedule": map[string]interface{}{
							"interval": 5.0,
							"unit":     "seconds",
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "Invalid heartbeat interval - too low",
			config: map[string]interface{}{
				"heartbeat_interval": 5.0,
			},
			wantErr: true,
		},
		{
			name: "Invalid heartbeat interval - too high",
			config: map[string]interface{}{
				"heartbeat_interval": 4000.0,
			},
			wantErr: true,
		},
		{
			name: "Invalid data buffer size - too low",
			config: map[string]interface{}{
				"data_buffer_size": 50.0,
			},
			wantErr: true,
		},
		{
			name: "Invalid data buffer size - too high",
			config: map[string]interface{}{
				"data_buffer_size": 200000.0,
			},
			wantErr: true,
		},
		{
			name: "Invalid collection task - missing name",
			config: map[string]interface{}{
				"collection_tasks": []interface{}{
					map[string]interface{}{
						"protocol": "modbus_tcp",
						"config":   map[string]interface{}{},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid collection task - missing protocol",
			config: map[string]interface{}{
				"collection_tasks": []interface{}{
					map[string]interface{}{
						"name":   "Test Task",
						"config": map[string]interface{}{},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid collection task - unsupported protocol",
			config: map[string]interface{}{
				"collection_tasks": []interface{}{
					map[string]interface{}{
						"name":     "Test Task",
						"protocol": "unknown_protocol",
						"config":   map[string]interface{}{},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid collection task - invalid schedule interval",
			config: map[string]interface{}{
				"collection_tasks": []interface{}{
					map[string]interface{}{
						"name":     "Test Task",
						"protocol": "modbus_tcp",
						"config":   map[string]interface{}{},
						"schedule": map[string]interface{}{
							"interval": 0.5,
						},
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateConfiguration(tt.config)
			
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConfigDeliveryService_ValidateCollectionTask(t *testing.T) {
	service := &ConfigDeliveryService{}

	tests := []struct {
		name    string
		task    map[string]interface{}
		wantErr bool
	}{
		{
			name: "Valid Modbus task",
			task: map[string]interface{}{
				"name":     "Temperature Sensor",
				"protocol": "modbus_tcp",
				"config": map[string]interface{}{
					"host": "192.168.1.100",
					"port": 502,
				},
				"schedule": map[string]interface{}{
					"interval": 5.0,
					"unit":     "seconds",
				},
			},
			wantErr: false,
		},
		{
			name: "Valid OPC-UA task",
			task: map[string]interface{}{
				"name":     "Pressure Sensor",
				"protocol": "opcua",
				"config": map[string]interface{}{
					"server_url": "opc.tcp://localhost:4840",
				},
			},
			wantErr: false,
		},
		{
			name: "Valid MQTT task",
			task: map[string]interface{}{
				"name":     "IoT Sensor",
				"protocol": "mqtt",
				"config": map[string]interface{}{
					"broker_url": "tcp://localhost:1883",
					"topic":      "sensor/data",
				},
			},
			wantErr: false,
		},
		{
			name: "Missing name",
			task: map[string]interface{}{
				"protocol": "modbus_tcp",
				"config":   map[string]interface{}{},
			},
			wantErr: true,
		},
		{
			name: "Missing protocol",
			task: map[string]interface{}{
				"name":   "Test Task",
				"config": map[string]interface{}{},
			},
			wantErr: true,
		},
		{
			name: "Missing config",
			task: map[string]interface{}{
				"name":     "Test Task",
				"protocol": "modbus_tcp",
			},
			wantErr: true,
		},
		{
			name: "Invalid protocol type",
			task: map[string]interface{}{
				"name":     "Test Task",
				"protocol": 123,
				"config":   map[string]interface{}{},
			},
			wantErr: true,
		},
		{
			name: "Unsupported protocol",
			task: map[string]interface{}{
				"name":     "Test Task",
				"protocol": "unknown_protocol",
				"config":   map[string]interface{}{},
			},
			wantErr: true,
		},
		{
			name: "Invalid schedule interval - too low",
			task: map[string]interface{}{
				"name":     "Test Task",
				"protocol": "modbus_tcp",
				"config":   map[string]interface{}{},
				"schedule": map[string]interface{}{
					"interval": 0.5,
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid schedule interval - too high",
			task: map[string]interface{}{
				"name":     "Test Task",
				"protocol": "modbus_tcp",
				"config":   map[string]interface{}{},
				"schedule": map[string]interface{}{
					"interval": 4000.0,
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateCollectionTask(tt.task)
			
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConfigDeliveryService_GenerateVersion(t *testing.T) {
	service := &ConfigDeliveryService{}

	version1 := service.generateVersion()
	version2 := service.generateVersion()

	// Versions should be different (assuming they're generated at different times)
	// and should start with 'v'
	assert.True(t, len(version1) > 1)
	assert.True(t, len(version2) > 1)
	assert.True(t, version1[0] == 'v')
	assert.True(t, version2[0] == 'v')
}

func TestConfigDeliveryService_CalculateChecksum(t *testing.T) {
	service := &ConfigDeliveryService{}

	data1 := []byte(`{"test": "data"}`)
	data2 := []byte(`{"test": "data"}`)
	data3 := []byte(`{"test": "different"}`)

	checksum1 := service.calculateChecksum(data1)
	checksum2 := service.calculateChecksum(data2)
	checksum3 := service.calculateChecksum(data3)

	// Same data should produce same checksum
	assert.Equal(t, checksum1, checksum2)
	
	// Different data should produce different checksum
	assert.NotEqual(t, checksum1, checksum3)
	
	// Checksum should be 32 characters (MD5 hex)
	assert.Equal(t, 32, len(checksum1))
}