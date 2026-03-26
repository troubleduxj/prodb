package protocol

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// MQTTConfig represents MQTT-specific configuration
type MQTTConfig struct {
	Broker       string `json:"broker"`
	Port         int    `json:"port"`
	ClientID     string `json:"client_id"`
	Username     string `json:"username,omitempty"`
	Password     string `json:"password,omitempty"`
	
	// Connection settings
	KeepAlive    int  `json:"keep_alive,omitempty"`    // seconds
	CleanSession bool `json:"clean_session,omitempty"`
	AutoReconnect bool `json:"auto_reconnect,omitempty"`
	
	// TLS settings
	UseTLS       bool   `json:"use_tls,omitempty"`
	CertFile     string `json:"cert_file,omitempty"`
	KeyFile      string `json:"key_file,omitempty"`
	CAFile       string `json:"ca_file,omitempty"`
	
	// Advanced settings
	ConnectTimeout   int `json:"connect_timeout,omitempty"`   // seconds
	WriteTimeout     int `json:"write_timeout,omitempty"`     // seconds
	MaxReconnectDelay int `json:"max_reconnect_delay,omitempty"` // seconds
}

// TopicConfig represents configuration for a single topic subscription
type TopicConfig struct {
	Topic       string `json:"topic"`
	QoS         byte   `json:"qos"`         // 0, 1, or 2
	DataFormat  string `json:"data_format"` // "json", "raw", "csv"
	DeviceID    string `json:"device_id,omitempty"`
	PointName   string `json:"point_name,omitempty"`
	JSONPath    string `json:"json_path,omitempty"` // JSONPath expression for extracting data
}

// MQTTProtocolImpl implements the actual MQTT protocol functionality
type MQTTProtocolImpl struct {
	*BaseProtocol
	
	config       *MQTTConfig
	client       mqtt.Client
	topics       map[string]*TopicConfig
	dataBuffer   map[string][]DataValue
	bufferMutex  sync.RWMutex
	logger       *logger.Logger
	
	// Connection management
	connectionLost chan bool
	reconnectDone  chan bool
	ctx            context.Context
	cancel         context.CancelFunc
}

// NewMQTTProtocolImpl creates a new MQTT protocol implementation
func NewMQTTProtocolImpl(logger *logger.Logger) *MQTTProtocolImpl {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &MQTTProtocolImpl{
		BaseProtocol:   NewBaseProtocol("mqtt", logger),
		topics:         make(map[string]*TopicConfig),
		dataBuffer:     make(map[string][]DataValue),
		logger:         logger.WithGroup("mqtt"),
		connectionLost: make(chan bool, 1),
		reconnectDone:  make(chan bool, 1),
		ctx:            ctx,
		cancel:         cancel,
	}
}

// Connect establishes connection to MQTT broker
func (m *MQTTProtocolImpl) Connect(configMap map[string]interface{}) error {
	config, err := m.parseConfig(configMap)
	if err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}
	m.config = config
	
	// Parse topics from data points configuration
	if err := m.parseTopics(configMap); err != nil {
		return fmt.Errorf("failed to parse topics: %w", err)
	}
	
	// Create MQTT client options
	opts := m.createClientOptions()
	
	// Create MQTT client
	m.client = mqtt.NewClient(opts)
	
	m.logger.Info("Connecting to MQTT broker", 
		"broker", config.Broker, 
		"port", config.Port,
		"client_id", config.ClientID)
	
	// Connect to broker
	if token := m.client.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("failed to connect to MQTT broker: %w", token.Error())
	}
	
	m.SetConnected(true)
	m.logger.Info("Connected to MQTT broker")
	
	// Subscribe to topics
	if err := m.subscribeToTopics(); err != nil {
		m.Disconnect()
		return fmt.Errorf("failed to subscribe to topics: %w", err)
	}
	
	return nil
}

// Collect reads data from MQTT broker (returns buffered data)
func (m *MQTTProtocolImpl) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	if !m.IsConnected() {
		return nil, fmt.Errorf("not connected to MQTT broker")
	}
	
	m.bufferMutex.Lock()
	defer m.bufferMutex.Unlock()
	
	var allData []DataValue
	
	// Collect data from all topic buffers
	for topic, dataValues := range m.dataBuffer {
		if len(dataValues) > 0 {
			allData = append(allData, dataValues...)
			// Clear the buffer after collecting
			m.dataBuffer[topic] = nil
		}
	}
	
	m.logger.Debug("Collected MQTT data", "data_points", len(allData))
	
	return allData, nil
}

// Disconnect closes connection to MQTT broker
func (m *MQTTProtocolImpl) Disconnect() error {
	if !m.IsConnected() {
		return nil
	}
	
	m.logger.Info("Disconnecting from MQTT broker")
	
	// Cancel context to stop background routines
	if m.cancel != nil {
		m.cancel()
	}
	
	// Unsubscribe from all topics
	for topic := range m.topics {
		if token := m.client.Unsubscribe(topic); token.Wait() && token.Error() != nil {
			m.logger.Error("Failed to unsubscribe from topic", "topic", topic, "error", token.Error())
		}
	}
	
	// Disconnect client
	if m.client != nil && m.client.IsConnected() {
		m.client.Disconnect(250) // 250ms timeout
	}
	
	m.SetConnected(false)
	m.logger.Info("Disconnected from MQTT broker")
	
	return nil
}

// Validate validates MQTT configuration
func (m *MQTTProtocolImpl) Validate(config map[string]interface{}) error {
	requiredFields := []string{"broker", "port"}
	for _, field := range requiredFields {
		if _, exists := config[field]; !exists {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	
	// Validate port range
	if port, ok := config["port"].(float64); ok {
		if port < 1 || port > 65535 {
			return fmt.Errorf("invalid port: %v", port)
		}
	}
	
	// Validate QoS levels in topics
	if topics, ok := config["topics"].([]interface{}); ok {
		for i, topicInterface := range topics {
			if topicMap, ok := topicInterface.(map[string]interface{}); ok {
				if qos, exists := topicMap["qos"]; exists {
					if qosFloat, ok := qos.(float64); ok {
						if qosFloat < 0 || qosFloat > 2 {
							return fmt.Errorf("invalid QoS level %v in topic %d", qosFloat, i)
						}
					}
				}
			}
		}
	}
	
	return nil
}

// parseConfig parses configuration map into MQTTConfig struct
func (m *MQTTProtocolImpl) parseConfig(configMap map[string]interface{}) (*MQTTConfig, error) {
	config := &MQTTConfig{
		Port:              1883,  // Default MQTT port
		KeepAlive:         60,    // Default keep alive
		CleanSession:      true,  // Default clean session
		AutoReconnect:     true,  // Default auto reconnect
		ConnectTimeout:    30,    // Default connect timeout
		WriteTimeout:      30,    // Default write timeout
		MaxReconnectDelay: 300,   // Default max reconnect delay (5 minutes)
	}
	
	if broker, ok := configMap["broker"].(string); ok {
		config.Broker = broker
	}
	
	if port, ok := configMap["port"].(float64); ok {
		config.Port = int(port)
	}
	
	if clientID, ok := configMap["client_id"].(string); ok {
		config.ClientID = clientID
	} else {
		// Generate default client ID
		config.ClientID = fmt.Sprintf("collector_%d", time.Now().Unix())
	}
	
	if username, ok := configMap["username"].(string); ok {
		config.Username = username
	}
	
	if password, ok := configMap["password"].(string); ok {
		config.Password = password
	}
	
	if keepAlive, ok := configMap["keep_alive"].(float64); ok {
		config.KeepAlive = int(keepAlive)
	}
	
	if cleanSession, ok := configMap["clean_session"].(bool); ok {
		config.CleanSession = cleanSession
	}
	
	if autoReconnect, ok := configMap["auto_reconnect"].(bool); ok {
		config.AutoReconnect = autoReconnect
	}
	
	if useTLS, ok := configMap["use_tls"].(bool); ok {
		config.UseTLS = useTLS
	}
	
	if certFile, ok := configMap["cert_file"].(string); ok {
		config.CertFile = certFile
	}
	
	if keyFile, ok := configMap["key_file"].(string); ok {
		config.KeyFile = keyFile
	}
	
	if caFile, ok := configMap["ca_file"].(string); ok {
		config.CAFile = caFile
	}
	
	if connectTimeout, ok := configMap["connect_timeout"].(float64); ok {
		config.ConnectTimeout = int(connectTimeout)
	}
	
	if writeTimeout, ok := configMap["write_timeout"].(float64); ok {
		config.WriteTimeout = int(writeTimeout)
	}
	
	if maxReconnectDelay, ok := configMap["max_reconnect_delay"].(float64); ok {
		config.MaxReconnectDelay = int(maxReconnectDelay)
	}
	
	return config, nil
}

// parseTopics parses topic configurations from the config map
func (m *MQTTProtocolImpl) parseTopics(configMap map[string]interface{}) error {
	topics, ok := configMap["topics"].([]interface{})
	if !ok {
		return fmt.Errorf("topics configuration not found or invalid")
	}
	
	for i, topicInterface := range topics {
		topicMap, ok := topicInterface.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid topic configuration at index %d", i)
		}
		
		topicConfig := &TopicConfig{
			QoS:        0,      // Default QoS
			DataFormat: "json", // Default data format
		}
		
		if topic, ok := topicMap["topic"].(string); ok {
			topicConfig.Topic = topic
		} else {
			return fmt.Errorf("missing topic name at index %d", i)
		}
		
		if qos, ok := topicMap["qos"].(float64); ok {
			topicConfig.QoS = byte(qos)
		}
		
		if dataFormat, ok := topicMap["data_format"].(string); ok {
			topicConfig.DataFormat = dataFormat
		}
		
		if deviceID, ok := topicMap["device_id"].(string); ok {
			topicConfig.DeviceID = deviceID
		}
		
		if pointName, ok := topicMap["point_name"].(string); ok {
			topicConfig.PointName = pointName
		}
		
		if jsonPath, ok := topicMap["json_path"].(string); ok {
			topicConfig.JSONPath = jsonPath
		}
		
		m.topics[topicConfig.Topic] = topicConfig
	}
	
	return nil
}

// createClientOptions creates MQTT client options
func (m *MQTTProtocolImpl) createClientOptions() *mqtt.ClientOptions {
	opts := mqtt.NewClientOptions()
	
	// Set broker URL
	brokerURL := fmt.Sprintf("tcp://%s:%d", m.config.Broker, m.config.Port)
	if m.config.UseTLS {
		brokerURL = fmt.Sprintf("ssl://%s:%d", m.config.Broker, m.config.Port)
	}
	opts.AddBroker(brokerURL)
	
	// Set client ID
	opts.SetClientID(m.config.ClientID)
	
	// Set credentials
	if m.config.Username != "" {
		opts.SetUsername(m.config.Username)
		if m.config.Password != "" {
			opts.SetPassword(m.config.Password)
		}
	}
	
	// Set connection options
	opts.SetKeepAlive(time.Duration(m.config.KeepAlive) * time.Second)
	opts.SetCleanSession(m.config.CleanSession)
	opts.SetAutoReconnect(m.config.AutoReconnect)
	opts.SetConnectTimeout(time.Duration(m.config.ConnectTimeout) * time.Second)
	opts.SetWriteTimeout(time.Duration(m.config.WriteTimeout) * time.Second)
	opts.SetMaxReconnectInterval(time.Duration(m.config.MaxReconnectDelay) * time.Second)
	
	// Set callback handlers
	opts.SetDefaultPublishHandler(m.defaultMessageHandler)
	opts.SetConnectionLostHandler(m.connectionLostHandler)
	opts.SetOnConnectHandler(m.onConnectHandler)
	opts.SetReconnectingHandler(m.reconnectingHandler)
	
	// Set TLS configuration if enabled
	if m.config.UseTLS {
		tlsConfig, err := m.createTLSConfig()
		if err != nil {
			m.logger.Error("Failed to create TLS config", "error", err)
		} else {
			opts.SetTLSConfig(tlsConfig)
		}
	}
	
	return opts
}

// subscribeToTopics subscribes to all configured topics
func (m *MQTTProtocolImpl) subscribeToTopics() error {
	for topic, topicConfig := range m.topics {
		m.logger.Info("Subscribing to topic", "topic", topic, "qos", topicConfig.QoS)
		
		token := m.client.Subscribe(topic, topicConfig.QoS, m.createMessageHandler(topicConfig))
		if token.Wait() && token.Error() != nil {
			return fmt.Errorf("failed to subscribe to topic %s: %w", topic, token.Error())
		}
		
		// Initialize data buffer for this topic
		m.bufferMutex.Lock()
		m.dataBuffer[topic] = make([]DataValue, 0)
		m.bufferMutex.Unlock()
		
		m.logger.Info("Successfully subscribed to topic", "topic", topic)
	}
	
	return nil
}

// createMessageHandler creates a message handler for a specific topic
func (m *MQTTProtocolImpl) createMessageHandler(topicConfig *TopicConfig) mqtt.MessageHandler {
	return func(client mqtt.Client, msg mqtt.Message) {
		m.logger.Debug("Received MQTT message", 
			"topic", msg.Topic(), 
			"qos", msg.Qos(),
			"retained", msg.Retained(),
			"payload_length", len(msg.Payload()))
		
		// Parse message data
		dataValues, err := m.parseMessage(msg, topicConfig)
		if err != nil {
			m.logger.Error("Failed to parse MQTT message", 
				"topic", msg.Topic(), 
				"error", err)
			return
		}
		
		// Add to buffer
		m.bufferMutex.Lock()
		m.dataBuffer[msg.Topic()] = append(m.dataBuffer[msg.Topic()], dataValues...)
		m.bufferMutex.Unlock()
		
		m.logger.Debug("Buffered MQTT data", 
			"topic", msg.Topic(), 
			"data_points", len(dataValues))
	}
}

// parseMessage parses an MQTT message into data values
func (m *MQTTProtocolImpl) parseMessage(msg mqtt.Message, topicConfig *TopicConfig) ([]DataValue, error) {
	now := time.Now()
	payload := msg.Payload()
	
	switch topicConfig.DataFormat {
	case "json":
		return m.parseJSONMessage(payload, msg.Topic(), topicConfig, now)
	case "raw":
		return m.parseRawMessage(payload, msg.Topic(), topicConfig, now)
	case "csv":
		return m.parseCSVMessage(payload, msg.Topic(), topicConfig, now)
	default:
		return nil, fmt.Errorf("unsupported data format: %s", topicConfig.DataFormat)
	}
}

// parseJSONMessage parses JSON formatted message
func (m *MQTTProtocolImpl) parseJSONMessage(payload []byte, topic string, topicConfig *TopicConfig, timestamp time.Time) ([]DataValue, error) {
	var jsonData interface{}
	if err := json.Unmarshal(payload, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}
	
	var dataValues []DataValue
	
	// If JSONPath is specified, extract specific value
	if topicConfig.JSONPath != "" {
		value, err := m.extractJSONPath(jsonData, topicConfig.JSONPath)
		if err != nil {
			return nil, fmt.Errorf("failed to extract JSONPath %s: %w", topicConfig.JSONPath, err)
		}
		
		dataValue := DataValue{
			DeviceID:  m.getDeviceID(topicConfig, topic),
			PointName: m.getPointName(topicConfig, topic),
			Timestamp: timestamp,
			Value:     value,
			Quality:   1,
			DataType:  m.inferDataType(value),
			Unit:      "",
			Tags:      m.createTags(topicConfig, topic),
			RawValue:  string(payload),
		}
		
		dataValues = append(dataValues, dataValue)
	} else {
		// Parse entire JSON object
		if jsonMap, ok := jsonData.(map[string]interface{}); ok {
			for key, value := range jsonMap {
				dataValue := DataValue{
					DeviceID:  m.getDeviceID(topicConfig, topic),
					PointName: key,
					Timestamp: timestamp,
					Value:     value,
					Quality:   1,
					DataType:  m.inferDataType(value),
					Unit:      "",
					Tags:      m.createTags(topicConfig, topic),
					RawValue:  string(payload),
				}
				
				dataValues = append(dataValues, dataValue)
			}
		} else {
			// Single value JSON
			dataValue := DataValue{
				DeviceID:  m.getDeviceID(topicConfig, topic),
				PointName: m.getPointName(topicConfig, topic),
				Timestamp: timestamp,
				Value:     jsonData,
				Quality:   1,
				DataType:  m.inferDataType(jsonData),
				Unit:      "",
				Tags:      m.createTags(topicConfig, topic),
				RawValue:  string(payload),
			}
			
			dataValues = append(dataValues, dataValue)
		}
	}
	
	return dataValues, nil
}

// parseRawMessage parses raw message data
func (m *MQTTProtocolImpl) parseRawMessage(payload []byte, topic string, topicConfig *TopicConfig, timestamp time.Time) ([]DataValue, error) {
	dataValue := DataValue{
		DeviceID:  m.getDeviceID(topicConfig, topic),
		PointName: m.getPointName(topicConfig, topic),
		Timestamp: timestamp,
		Value:     string(payload),
		Quality:   1,
		DataType:  "string",
		Unit:      "",
		Tags:      m.createTags(topicConfig, topic),
		RawValue:  string(payload),
	}
	
	return []DataValue{dataValue}, nil
}

// parseCSVMessage parses CSV formatted message
func (m *MQTTProtocolImpl) parseCSVMessage(payload []byte, topic string, topicConfig *TopicConfig, timestamp time.Time) ([]DataValue, error) {
	csvData := string(payload)
	lines := strings.Split(strings.TrimSpace(csvData), "\n")
	
	var dataValues []DataValue
	
	for i, line := range lines {
		fields := strings.Split(line, ",")
		for j, field := range fields {
			value := strings.TrimSpace(field)
			
			// Try to convert to number
			var parsedValue interface{} = value
			if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
				parsedValue = floatVal
			}
			
			dataValue := DataValue{
				DeviceID:  m.getDeviceID(topicConfig, topic),
				PointName: fmt.Sprintf("%s_row%d_col%d", m.getPointName(topicConfig, topic), i, j),
				Timestamp: timestamp,
				Value:     parsedValue,
				Quality:   1,
				DataType:  m.inferDataType(parsedValue),
				Unit:      "",
				Tags:      m.createTags(topicConfig, topic),
				RawValue:  string(payload),
			}
			
			dataValues = append(dataValues, dataValue)
		}
	}
	
	return dataValues, nil
}

// Helper methods and event handlers
func (m *MQTTProtocolImpl) extractJSONPath(data interface{}, path string) (interface{}, error) {
	// Simple JSONPath implementation - supports basic dot notation
	if path == "" || path == "$" {
		return data, nil
	}
	
	// Remove leading $ if present
	if strings.HasPrefix(path, "$.") {
		path = path[2:]
	} else if strings.HasPrefix(path, "$") {
		path = path[1:]
	}
	
	parts := strings.Split(path, ".")
	current := data
	
	for _, part := range parts {
		// Handle array access like "sensors[0]"
		if strings.Contains(part, "[") && strings.Contains(part, "]") {
			arrayPart := part[:strings.Index(part, "[")]
			indexPart := part[strings.Index(part, "[")+1 : strings.Index(part, "]")]
			
			index, err := strconv.Atoi(indexPart)
			if err != nil {
				return nil, fmt.Errorf("invalid array index: %s", indexPart)
			}
			
			// Get array field
			if arrayPart != "" {
				if currentMap, ok := current.(map[string]interface{}); ok {
					current = currentMap[arrayPart]
				} else {
					return nil, fmt.Errorf("cannot access field %s on non-object", arrayPart)
				}
			}
			
			// Access array element
			if currentArray, ok := current.([]interface{}); ok {
				if index < 0 || index >= len(currentArray) {
					return nil, fmt.Errorf("array index %d out of bounds", index)
				}
				current = currentArray[index]
			} else {
				return nil, fmt.Errorf("cannot access array index on non-array")
			}
		} else {
			// Simple field access
			if currentMap, ok := current.(map[string]interface{}); ok {
				current = currentMap[part]
			} else {
				return nil, fmt.Errorf("cannot access field %s on non-object", part)
			}
		}
		
		if current == nil {
			return nil, fmt.Errorf("field not found: %s", part)
		}
	}
	
	return current, nil
}

func (m *MQTTProtocolImpl) inferDataType(value interface{}) string {
	switch value.(type) {
	case bool:
		return "bool"
	case int, int8, int16, int32, int64:
		return "int32"
	case uint, uint8, uint16, uint32, uint64:
		return "int32"
	case float32:
		return "float32"
	case float64:
		return "float64"
	case string:
		return "string"
	default:
		return "string"
	}
}

func (m *MQTTProtocolImpl) getDeviceID(topicConfig *TopicConfig, topic string) string {
	if topicConfig.DeviceID != "" {
		return topicConfig.DeviceID
	}
	return fmt.Sprintf("mqtt_%s_%s", m.config.ClientID, m.sanitizeTopicForID(topic))
}

func (m *MQTTProtocolImpl) getPointName(topicConfig *TopicConfig, topic string) string {
	if topicConfig.PointName != "" {
		return topicConfig.PointName
	}
	return m.sanitizeTopicForID(topic)
}

func (m *MQTTProtocolImpl) sanitizeTopicForID(topic string) string {
	sanitized := strings.ReplaceAll(topic, "/", "_")
	sanitized = strings.ReplaceAll(sanitized, "+", "plus")
	sanitized = strings.ReplaceAll(sanitized, "#", "hash")
	sanitized = strings.ReplaceAll(sanitized, " ", "_")
	return sanitized
}

func (m *MQTTProtocolImpl) createTags(topicConfig *TopicConfig, topic string) map[string]string {
	tags := make(map[string]string)
	tags["mqtt_topic"] = topic
	tags["mqtt_qos"] = fmt.Sprintf("%d", topicConfig.QoS)
	tags["mqtt_client_id"] = m.config.ClientID
	tags["mqtt_broker"] = fmt.Sprintf("%s:%d", m.config.Broker, m.config.Port)
	tags["data_format"] = topicConfig.DataFormat
	return tags
}

func (m *MQTTProtocolImpl) createTLSConfig() (*tls.Config, error) {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
	}
	
	// Load client certificate if specified
	if m.config.CertFile != "" && m.config.KeyFile != "" {
		cert, err := tls.LoadX509KeyPair(m.config.CertFile, m.config.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}
	
	// Load CA certificate if specified
	if m.config.CAFile != "" {
		caCert, err := ioutil.ReadFile(m.config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}
		
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}
	
	return tlsConfig, nil
}

// Event handlers
func (m *MQTTProtocolImpl) defaultMessageHandler(client mqtt.Client, msg mqtt.Message) {
	m.logger.Debug("Received message on unhandled topic", 
		"topic", msg.Topic(), 
		"payload_length", len(msg.Payload()))
}

func (m *MQTTProtocolImpl) connectionLostHandler(client mqtt.Client, err error) {
	m.logger.Error("MQTT connection lost", "error", err)
	m.SetConnected(false)
	
	select {
	case m.connectionLost <- true:
	default:
	}
}

func (m *MQTTProtocolImpl) onConnectHandler(client mqtt.Client) {
	m.logger.Info("MQTT connection established")
	m.SetConnected(true)
	
	go func() {
		if err := m.subscribeToTopics(); err != nil {
			m.logger.Error("Failed to resubscribe to topics after reconnection", "error", err)
		}
	}()
	
	select {
	case m.reconnectDone <- true:
	default:
	}
}

func (m *MQTTProtocolImpl) reconnectingHandler(client mqtt.Client, opts *mqtt.ClientOptions) {
	m.logger.Info("Attempting to reconnect to MQTT broker")
}