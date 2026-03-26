package opcua

import (
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestOPCUAProtocol_Minimal(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test protocol creation
	protocol := NewOPCUAProtocol(logger)
	if protocol == nil {
		t.Fatal("NewOPCUAProtocol returned nil")
	}

	if protocol.GetName() != "opcua" {
		t.Errorf("Protocol name = %s, want opcua", protocol.GetName())
	}

	if protocol.IsConnected() {
		t.Error("Expected protocol to be disconnected initially")
	}

	// Test validation
	validConfig := map[string]interface{}{
		"endpoint": "opc.tcp://localhost:4840/freeopcua/server/",
	}

	err = protocol.Validate(validConfig)
	if err != nil {
		t.Errorf("Validate() error = %v", err)
	}

	// Test invalid config
	invalidConfig := map[string]interface{}{
		"security_mode": "None",
	}

	err = protocol.Validate(invalidConfig)
	if err == nil {
		t.Error("Expected validation error for missing endpoint")
	}

	// Test connection
	err = protocol.Connect(validConfig)
	if err != nil {
		t.Fatalf("Connect() error = %v", err)
	}

	if !protocol.IsConnected() {
		t.Error("Expected protocol to be connected after Connect()")
	}

	// Test data collection
	points := []config.DataPointConfig{
		{
			Name:     "test_point",
			Address:  "ns=2;i=1001",
			DataType: "float32",
			Unit:     "°C",
		},
	}

	dataValues, err := protocol.Collect(points)
	if err != nil {
		t.Fatalf("Collect() error = %v", err)
	}

	if len(dataValues) != len(points) {
		t.Errorf("Expected %d data values, got %d", len(points), len(dataValues))
	}

	// Test disconnect
	err = protocol.Disconnect()
	if err != nil {
		t.Fatalf("Disconnect() error = %v", err)
	}

	if protocol.IsConnected() {
		t.Error("Expected protocol to be disconnected after Disconnect()")
	}

	t.Log("All OPC-UA protocol tests passed")
}

func TestOPCUAProtocol_DataTypes(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	connectConfig := map[string]interface{}{
		"endpoint":      "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode": "None",
		"auth_mode":     "Anonymous",
	}

	err = protocol.Connect(connectConfig)
	if err != nil {
		t.Fatalf("Connect() error = %v", err)
	}
	defer protocol.Disconnect()

	points := []config.DataPointConfig{
		{Name: "bool_point", Address: "ns=2;i=1001", DataType: "bool"},
		{Name: "int32_point", Address: "ns=2;i=1002", DataType: "int32"},
		{Name: "float32_point", Address: "ns=2;i=1003", DataType: "float32"},
		{Name: "float64_point", Address: "ns=2;i=1004", DataType: "float64"},
		{Name: "string_point", Address: "ns=2;i=1005", DataType: "string"},
	}

	dataValues, err := protocol.Collect(points)
	if err != nil {
		t.Fatalf("Collect() error = %v", err)
	}

	if len(dataValues) != len(points) {
		t.Errorf("Expected %d data values, got %d", len(points), len(dataValues))
	}

	// Check data types
	for i, value := range dataValues {
		switch points[i].DataType {
		case "bool":
			if _, ok := value.Value.(bool); !ok {
				t.Errorf("Expected bool value for %s, got %T", points[i].Name, value.Value)
			}
		case "int32":
			if _, ok := value.Value.(int32); !ok {
				t.Errorf("Expected int32 value for %s, got %T", points[i].Name, value.Value)
			}
		case "float32", "float64":
			if _, ok := value.Value.(float64); !ok {
				t.Errorf("Expected float64 value for %s, got %T", points[i].Name, value.Value)
			}
		case "string":
			if _, ok := value.Value.(string); !ok {
				t.Errorf("Expected string value for %s, got %T", points[i].Name, value.Value)
			}
		}
	}
}

func TestOPCUAProtocol_Scaling(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	tests := []struct {
		name     string
		value    interface{}
		scale    float64
		offset   float64
		expected interface{}
	}{
		{
			name:     "no scaling",
			value:    float64(100),
			scale:    0,
			offset:   0,
			expected: float64(100),
		},
		{
			name:     "scale only",
			value:    float64(100),
			scale:    0.1,
			offset:   0,
			expected: float64(10),
		},
		{
			name:     "offset only",
			value:    float64(100),
			scale:    0,
			offset:   -273.15,
			expected: float64(-173.14999999999998), // Account for floating point precision
		},
		{
			name:     "scale and offset",
			value:    float64(1000),
			scale:    0.1,
			offset:   -273.15,
			expected: float64(-173.14999999999998), // Account for floating point precision
		},
		{
			name:     "int32 value",
			value:    int32(100),
			scale:    0.1,
			offset:   0,
			expected: float64(10),
		},
		{
			name:     "non-numeric value",
			value:    "test",
			scale:    0.1,
			offset:   10,
			expected: "test",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := protocol.applyScaling(tt.value, tt.scale, tt.offset)
			if result != tt.expected {
				t.Errorf("applyScaling() = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestOPCUAProtocol_Subscription(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	tests := []struct {
		name     string
		point    config.DataPointConfig
		expected bool
	}{
		{
			name: "no subscription tags",
			point: config.DataPointConfig{
				Name:    "test_point",
				Address: "ns=2;i=1001",
				Tags:    map[string]string{},
			},
			expected: false,
		},
		{
			name: "explicit subscription mode",
			point: config.DataPointConfig{
				Name:    "test_point",
				Address: "ns=2;i=1001",
				Tags: map[string]string{
					"collection_mode": "subscription",
				},
			},
			expected: true,
		},
		{
			name: "high frequency sampling",
			point: config.DataPointConfig{
				Name:    "test_point",
				Address: "ns=2;i=1001",
				Tags: map[string]string{
					"sampling_interval": "1000",
				},
			},
			expected: true,
		},
		{
			name: "low frequency sampling",
			point: config.DataPointConfig{
				Name:    "test_point",
				Address: "ns=2;i=1001",
				Tags: map[string]string{
					"sampling_interval": "10000",
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := protocol.shouldUseSubscription(tt.point)
			if result != tt.expected {
				t.Errorf("shouldUseSubscription() = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestOPCUAProtocol_Metrics(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	metrics := protocol.GetMetrics()

	expectedKeys := []string{
		"connect_count",
		"disconnect_count",
		"read_count",
		"write_count",
		"error_count",
		"subscriptions",
	}

	for _, key := range expectedKeys {
		if _, exists := metrics[key]; !exists {
			t.Errorf("Expected metric key '%s' not found", key)
		}
	}

	// Test metrics after connection
	connectConfig := map[string]interface{}{
		"endpoint":      "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode": "None",
		"auth_mode":     "Anonymous",
	}

	err = protocol.Connect(connectConfig)
	if err != nil {
		t.Fatalf("Connect() error = %v", err)
	}
	defer protocol.Disconnect()

	metrics = protocol.GetMetrics()

	if connectCount, ok := metrics["connect_count"].(int64); !ok || connectCount != 1 {
		t.Errorf("Expected connect_count to be 1, got %v", metrics["connect_count"])
	}

	if sessionID, exists := metrics["session_id"]; !exists {
		t.Error("Expected session_id in metrics after connection")
	} else if sessionID == "" {
		t.Error("Expected non-empty session_id")
	}
}

func TestOPCUAProtocol_ConnectionManagement(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	// Test initial state
	if protocol.IsConnected() {
		t.Error("Protocol should not be connected initially")
	}

	// Test connection with valid config
	config := map[string]interface{}{
		"endpoint":      "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode": "None",
		"auth_mode":     "Anonymous",
	}

	err = protocol.Connect(config)
	if err != nil {
		t.Fatalf("Connect() error = %v", err)
	}

	if !protocol.IsConnected() {
		t.Error("Protocol should be connected after Connect()")
	}

	// Test disconnection
	err = protocol.Disconnect()
	if err != nil {
		t.Fatalf("Disconnect() error = %v", err)
	}

	if protocol.IsConnected() {
		t.Error("Protocol should not be connected after Disconnect()")
	}
}

func TestOPCUAProtocol_NodeBrowsing(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	// Test node browsing (mock implementation)
	nodes, err := protocol.browseNodes("ns=0;i=85") // Objects folder
	if err != nil {
		t.Fatalf("browseNodes() error = %v", err)
	}

	if len(nodes) == 0 {
		t.Error("Expected at least one node from browsing")
	}

	// Check node structure
	for _, node := range nodes {
		if node.NodeID == "" {
			t.Error("Node should have a NodeID")
		}
		if node.BrowseName == "" {
			t.Error("Node should have a BrowseName")
		}
		if node.DataType == "" {
			t.Error("Node should have a DataType")
		}
	}
}

func TestOPCUAProtocol_AdvancedConfiguration(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	// Test advanced configuration
	advancedConfig := map[string]interface{}{
		"endpoint":                      "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode":                 "SignAndEncrypt",
		"security_policy":               "Basic256Sha256",
		"auth_mode":                     "Username",
		"username":                      "testuser",
		"password":                      "testpass",
		"request_timeout":               float64(15000),
		"session_timeout":               float64(120000),
		"keepalive_interval":            float64(5000),
		"publishing_interval":           float64(500),
		"max_notifications_per_publish": float64(200),
		"lifetime_count":                float64(7200),
		"max_keepalive_count":           float64(20),
	}

	err = protocol.Validate(advancedConfig)
	if err != nil {
		t.Errorf("Validate() error = %v", err)
	}

	// Test connection with advanced config (will use mock mode)
	err = protocol.Connect(advancedConfig)
	if err != nil {
		t.Fatalf("Connect() with advanced config error = %v", err)
	}
	defer protocol.Disconnect()

	// Verify configuration was parsed correctly
	if protocol.config.SecurityMode != "SignAndEncrypt" {
		t.Errorf("Expected SecurityMode 'SignAndEncrypt', got '%s'", protocol.config.SecurityMode)
	}

	if protocol.config.AuthMode != "Username" {
		t.Errorf("Expected AuthMode 'Username', got '%s'", protocol.config.AuthMode)
	}

	if protocol.config.Username != "testuser" {
		t.Errorf("Expected Username 'testuser', got '%s'", protocol.config.Username)
	}

	if protocol.config.RequestTimeout != 15000 {
		t.Errorf("Expected RequestTimeout 15000, got %d", protocol.config.RequestTimeout)
	}
}

func TestOPCUAProtocol_SubscriptionManagement(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	protocol := NewOPCUAProtocol(logger)

	connectConfig := map[string]interface{}{
		"endpoint":      "opc.tcp://localhost:4840/freeopcua/server/",
		"security_mode": "None",
		"auth_mode":     "Anonymous",
	}

	err = protocol.Connect(connectConfig)
	if err != nil {
		t.Fatalf("Connect() error = %v", err)
	}
	defer protocol.Disconnect()

	// Test subscription decision logic
	testPoint := config.DataPointConfig{
		Name:     "high_freq_sensor",
		Address:  "ns=2;i=5001",
		DataType: "float32",
		Tags: map[string]string{
			"collection_mode":   "subscription",
			"sampling_interval": "100",
		},
	}

	shouldUseSubscription := protocol.shouldUseSubscription(testPoint)
	if !shouldUseSubscription {
		t.Error("Expected point to use subscription mode")
	}

	// Test basic subscription functionality
	err = protocol.ensureSubscription(testPoint)
	if err != nil {
		t.Fatalf("ensureSubscription() error = %v", err)
	}

	// Verify subscription was created
	metrics := protocol.GetMetrics()
	if subscriptions, ok := metrics["subscriptions"].(int); !ok || subscriptions == 0 {
		t.Error("Expected at least one subscription to be created")
	}
}
