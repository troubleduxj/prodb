package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// CollectorConfig represents the complete collector configuration
type CollectorConfig struct {
	CollectorID       string                 `json:"collector_id"`
	Name              string                 `json:"name"`
	Version           string                 `json:"version"`
	HeartbeatInterval int                    `json:"heartbeat_interval"` // seconds
	
	// Component configurations
	Auth            AuthConfig             `json:"auth"`
	Logger          LoggerConfig           `json:"logger"`
	Buffer          BufferConfig           `json:"buffer"`
	Storage         StorageConfig          `json:"storage"`
	Platform        PlatformConfig         `json:"platform"`
	
	// Collection tasks
	CollectionTasks []CollectionTaskConfig `json:"collection_tasks"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Enabled           bool          `json:"enabled"` // Enable/disable authentication
	CollectorID       string        `json:"collector_id"`
	SecretKey         string        `json:"secret_key"`
	PlatformEndpoint  string        `json:"platform_endpoint"`
	TokenRefreshURL   string        `json:"token_refresh_url"`
	TokenRefreshInterval int        `json:"token_refresh_interval"` // seconds
	MaxRetries        int           `json:"max_retries"`
	RetryDelay        int           `json:"retry_delay"` // seconds
	TLS               TLSConfig     `json:"tls"`
	Security          SecurityConfig `json:"security"`
}

// TLSConfig represents TLS configuration
type TLSConfig struct {
	InsecureSkipVerify bool     `json:"insecure_skip_verify"`
	CACertPath         string   `json:"ca_cert_path"`
	CACerts            []string `json:"ca_certs"`
	ClientCertPath     string   `json:"client_cert_path"`
	ClientKeyPath      string   `json:"client_key_path"`
	MinVersion         string   `json:"min_version"`
	MaxVersion         string   `json:"max_version"`
	ServerName         string   `json:"server_name"`
	HandshakeTimeout   int      `json:"handshake_timeout"` // seconds
}

// SecurityConfig represents security configuration
type SecurityConfig struct {
	KeyStorePath     string `json:"key_store_path"`
	MasterKeyPath    string `json:"master_key_path"`
	AutoGenerate     bool   `json:"auto_generate"`
	KeyRotationDays  int    `json:"key_rotation_days"`
	EncryptSecretKey bool   `json:"encrypt_secret_key"`
}

// LoggerConfig represents logging configuration
type LoggerConfig struct {
	Level      string `json:"level"`      // debug, info, warn, error
	Format     string `json:"format"`     // json, text
	Output     string `json:"output"`     // stdout, file
	FilePath   string `json:"file_path"`  // log file path when output is file
	MaxSize    int    `json:"max_size"`   // MB
	MaxBackups int    `json:"max_backups"`
	MaxAge     int    `json:"max_age"`    // days
}

// BufferConfig represents data buffer configuration
type BufferConfig struct {
	MaxSize       int `json:"max_size"`        // maximum number of data points
	FlushInterval int `json:"flush_interval"`  // seconds
	FlushBatchSize int `json:"flush_batch_size"` // number of points per batch
}

// StorageConfig represents local storage configuration
type StorageConfig struct {
	DatabasePath      string `json:"database_path"`
	MaxCacheSize      int64  `json:"max_cache_size"`      // bytes
	RetentionDays     int    `json:"retention_days"`
	CleanupInterval   int    `json:"cleanup_interval"`    // seconds
	MaxRetries        int    `json:"max_retries"`
	RetryDelay        int    `json:"retry_delay"`         // seconds
}

// PlatformConfig represents platform communication configuration
type PlatformConfig struct {
	BaseURL           string `json:"base_url"`
	DataUploadURL     string `json:"data_upload_url"`
	ConfigSyncURL     string `json:"config_sync_url"`
	HeartbeatURL      string `json:"heartbeat_url"`
	Timeout           int    `json:"timeout"`           // seconds
	MaxRetries        int    `json:"max_retries"`
	RetryDelay        int    `json:"retry_delay"`       // seconds
	EnableCompression bool   `json:"enable_compression"`
}

// CollectionTaskConfig represents a data collection task configuration
type CollectionTaskConfig struct {
	TaskID      string                 `json:"task_id"`
	Name        string                 `json:"name"`
	Protocol    string                 `json:"protocol"`    // modbus_tcp, modbus_rtu, opcua, mqtt
	Enabled     bool                   `json:"enabled"`
	Schedule    ScheduleConfig         `json:"schedule"`
	Connection  map[string]interface{} `json:"connection"`  // protocol-specific connection parameters
	DataPoints  []DataPointConfig      `json:"data_points"`
	Target      TargetConfig           `json:"target"`
}

// ScheduleConfig represents task scheduling configuration
type ScheduleConfig struct {
	Interval int    `json:"interval"` // collection interval
	Unit     string `json:"unit"`     // seconds, minutes, hours
}

// DataPointConfig represents a data point configuration
type DataPointConfig struct {
	Name     string      `json:"name"`
	Address  string      `json:"address"`   // protocol-specific address
	DataType string      `json:"data_type"` // int16, int32, float32, float64, bool, string
	Scale    float64     `json:"scale"`     // scaling factor
	Offset   float64     `json:"offset"`    // offset value
	Unit     string      `json:"unit"`      // measurement unit
	Tags     map[string]string `json:"tags"` // additional tags
}

// TargetConfig represents data target configuration
type TargetConfig struct {
	Database   string            `json:"database"`
	SuperTable string            `json:"super_table"`
	Tags       map[string]string `json:"tags"`
}

// LoadConfig loads configuration from file
func LoadConfig(configPath string) (*CollectorConfig, error) {
	// First try to load from file
	if configPath != "" {
		if config, err := loadConfigFromFile(configPath); err == nil {
			return config, nil
		}
	}

	// Fallback to environment variables and defaults
	return loadConfigFromEnv()
}

// loadConfigFromFile loads configuration from JSON file
func loadConfigFromFile(configPath string) (*CollectorConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config CollectorConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

// loadConfigFromEnv loads configuration from environment variables with defaults
func loadConfigFromEnv() (*CollectorConfig, error) {
	collectorID := getEnvOrDefault("COLLECTOR_ID", "")
	if collectorID == "" {
		return nil, fmt.Errorf("COLLECTOR_ID environment variable is required")
	}

	secretKey := getEnvOrDefault("SECRET_KEY", "")
	if secretKey == "" {
		return nil, fmt.Errorf("SECRET_KEY environment variable is required")
	}

	config := &CollectorConfig{
		CollectorID:       collectorID,
		Name:              getEnvOrDefault("COLLECTOR_NAME", "ProDB Collector"),
		Version:           getEnvOrDefault("COLLECTOR_VERSION", "1.0.0"),
		HeartbeatInterval: getEnvIntOrDefault("HEARTBEAT_INTERVAL", 60),
		
		Auth: AuthConfig{
			CollectorID:      collectorID,
			SecretKey:        secretKey,
			PlatformEndpoint: getEnvOrDefault("PLATFORM_API_ENDPOINT", "https://localhost:8088"),
			TokenRefreshURL:  getEnvOrDefault("TOKEN_REFRESH_URL", "/api/v1/auth/collector/refresh"),
			MaxRetries:       getEnvIntOrDefault("AUTH_MAX_RETRIES", 3),
			RetryDelay:       getEnvIntOrDefault("AUTH_RETRY_DELAY", 5),
			TLS: TLSConfig{
				InsecureSkipVerify: getEnvBoolOrDefault("TLS_INSECURE_SKIP_VERIFY", false),
				CACertPath:         getEnvOrDefault("TLS_CA_CERT_PATH", ""),
				ClientCertPath:     getEnvOrDefault("TLS_CLIENT_CERT_PATH", ""),
				ClientKeyPath:      getEnvOrDefault("TLS_CLIENT_KEY_PATH", ""),
				MinVersion:         getEnvOrDefault("TLS_MIN_VERSION", "1.2"),
				MaxVersion:         getEnvOrDefault("TLS_MAX_VERSION", "1.3"),
				ServerName:         getEnvOrDefault("TLS_SERVER_NAME", ""),
				HandshakeTimeout:   getEnvIntOrDefault("TLS_HANDSHAKE_TIMEOUT", 10),
			},
			Security: SecurityConfig{
				KeyStorePath:     getEnvOrDefault("SECURITY_KEY_STORE_PATH", "./keys"),
				MasterKeyPath:    getEnvOrDefault("SECURITY_MASTER_KEY_PATH", "./keys/master.key"),
				AutoGenerate:     getEnvBoolOrDefault("SECURITY_AUTO_GENERATE", true),
				KeyRotationDays:  getEnvIntOrDefault("SECURITY_KEY_ROTATION_DAYS", 90),
				EncryptSecretKey: getEnvBoolOrDefault("SECURITY_ENCRYPT_SECRET_KEY", true),
			},
		},
		
		Logger: LoggerConfig{
			Level:      getEnvOrDefault("LOG_LEVEL", "info"),
			Format:     getEnvOrDefault("LOG_FORMAT", "json"),
			Output:     getEnvOrDefault("LOG_OUTPUT", "stdout"),
			FilePath:   getEnvOrDefault("LOG_FILE_PATH", "./logs/collector.log"),
			MaxSize:    getEnvIntOrDefault("LOG_MAX_SIZE", 100),
			MaxBackups: getEnvIntOrDefault("LOG_MAX_BACKUPS", 3),
			MaxAge:     getEnvIntOrDefault("LOG_MAX_AGE", 30),
		},
		
		Buffer: BufferConfig{
			MaxSize:        getEnvIntOrDefault("BUFFER_MAX_SIZE", 10000),
			FlushInterval:  getEnvIntOrDefault("BUFFER_FLUSH_INTERVAL", 30),
			FlushBatchSize: getEnvIntOrDefault("BUFFER_FLUSH_BATCH_SIZE", 1000),
		},
		
		Storage: StorageConfig{
			DatabasePath:    getEnvOrDefault("LOCAL_DB_PATH", "./collector_cache.db"),
			MaxCacheSize:    int64(getEnvIntOrDefault("STORAGE_MAX_CACHE_SIZE", 1024*1024*1024)), // 1GB
			RetentionDays:   getEnvIntOrDefault("STORAGE_RETENTION_DAYS", 7),
			CleanupInterval: getEnvIntOrDefault("STORAGE_CLEANUP_INTERVAL", 3600), // 1 hour
			MaxRetries:      getEnvIntOrDefault("STORAGE_MAX_RETRIES", 3),
			RetryDelay:      getEnvIntOrDefault("STORAGE_RETRY_DELAY", 5),
		},
		
		Platform: PlatformConfig{
			BaseURL:           getEnvOrDefault("PLATFORM_API_ENDPOINT", "http://localhost:8088"),
			DataUploadURL:     getEnvOrDefault("DATA_UPLOAD_URL", "/api/v1/data/batch"),
			ConfigSyncURL:     getEnvOrDefault("CONFIG_SYNC_URL", "/api/v1/collectors/%s/config"),
			HeartbeatURL:      getEnvOrDefault("HEARTBEAT_URL", "/api/v1/collectors/%s/heartbeat"),
			Timeout:           getEnvIntOrDefault("PLATFORM_TIMEOUT", 30),
			MaxRetries:        getEnvIntOrDefault("PLATFORM_MAX_RETRIES", 3),
			RetryDelay:        getEnvIntOrDefault("PLATFORM_RETRY_DELAY", 5),
			EnableCompression: getEnvBoolOrDefault("PLATFORM_ENABLE_COMPRESSION", true),
		},
		
		CollectionTasks: []CollectionTaskConfig{}, // Will be loaded from platform
	}

	return config, nil
}

// Validate validates the configuration
func (c *CollectorConfig) Validate() error {
	if c.CollectorID == "" {
		return fmt.Errorf("collector_id is required")
	}
	
	// Only validate auth fields if authentication is enabled
	if c.Auth.Enabled {
		if c.Auth.SecretKey == "" {
			return fmt.Errorf("auth.secret_key is required when auth is enabled")
		}
		
		if c.Auth.PlatformEndpoint == "" {
			return fmt.Errorf("auth.platform_endpoint is required when auth is enabled")
		}
	}
	
	if c.HeartbeatInterval <= 0 {
		return fmt.Errorf("heartbeat_interval must be positive")
	}
	
	if c.Buffer.MaxSize <= 0 {
		return fmt.Errorf("buffer.max_size must be positive")
	}
	
	// Storage database path is optional in standalone mode
	// if c.Storage.DatabasePath == "" {
	// 	return fmt.Errorf("storage.database_path is required")
	// }
	
	// Validate collection tasks
	for i, task := range c.CollectionTasks {
		if err := task.Validate(); err != nil {
			return fmt.Errorf("collection_tasks[%d]: %w", i, err)
		}
	}
	
	return nil
}

// Validate validates a collection task configuration
func (t *CollectionTaskConfig) Validate() error {
	if t.TaskID == "" {
		return fmt.Errorf("task_id is required")
	}
	
	if t.Name == "" {
		return fmt.Errorf("name is required")
	}
	
	if t.Protocol == "" {
		return fmt.Errorf("protocol is required")
	}
	
	validProtocols := map[string]bool{
		"modbus_tcp": true,
		"modbus_rtu": true,
		"opcua":      true,
		"mqtt":       true,
	}
	
	if !validProtocols[t.Protocol] {
		return fmt.Errorf("invalid protocol: %s", t.Protocol)
	}
	
	if t.Schedule.Interval <= 0 {
		return fmt.Errorf("schedule.interval must be positive")
	}
	
	validUnits := map[string]bool{
		"seconds": true,
		"minutes": true,
		"hours":   true,
	}
	
	if !validUnits[t.Schedule.Unit] {
		return fmt.Errorf("invalid schedule.unit: %s", t.Schedule.Unit)
	}
	
	if len(t.DataPoints) == 0 {
		return fmt.Errorf("at least one data point is required")
	}
	
	for i, dp := range t.DataPoints {
		if err := dp.Validate(); err != nil {
			return fmt.Errorf("data_points[%d]: %w", i, err)
		}
	}
	
	return nil
}

// Validate validates a data point configuration
func (d *DataPointConfig) Validate() error {
	if d.Name == "" {
		return fmt.Errorf("name is required")
	}
	
	if d.Address == "" {
		return fmt.Errorf("address is required")
	}
	
	validDataTypes := map[string]bool{
		"int16":   true,
		"int32":   true,
		"float32": true,
		"float64": true,
		"bool":    true,
		"string":  true,
	}
	
	if !validDataTypes[d.DataType] {
		return fmt.Errorf("invalid data_type: %s", d.DataType)
	}
	
	return nil
}

// GetScheduleInterval returns the schedule interval in duration
func (s *ScheduleConfig) GetScheduleInterval() time.Duration {
	switch s.Unit {
	case "minutes":
		return time.Duration(s.Interval) * time.Minute
	case "hours":
		return time.Duration(s.Interval) * time.Hour
	default: // seconds
		return time.Duration(s.Interval) * time.Second
	}
}

// Helper functions for environment variables
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := parseIntFromString(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1"
	}
	return defaultValue
}

func parseIntFromString(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}