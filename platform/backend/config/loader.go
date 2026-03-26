package config

import (
	"encoding/json"
	"fmt"
	"os"
	"prodb/platform/backend/tdengine"
	"time"
)

// TDengineConfigJSON represents the JSON structure for TDengine configuration
type TDengineConfigJSON struct {
	Host                   string `json:"host"`
	Port                   int    `json:"port"`
	Username               string `json:"username"`
	Password               string `json:"password"`
	Database               string `json:"database"`
	MaxOpenConns           int    `json:"max_open_conns"`
	MaxIdleConns           int    `json:"max_idle_conns"`
	ConnTimeout            string `json:"conn_timeout"`
	IdleTimeout            string `json:"idle_timeout"`
	MaxLifetime            string `json:"max_lifetime"`
	HealthCheckInterval    string `json:"health_check_interval"`
	MaxRetries             int    `json:"max_retries"`
	RetryInterval          string `json:"retry_interval"`
	EnableAutoReconnect    bool   `json:"enable_auto_reconnect"`
	ReconnectInterval      string `json:"reconnect_interval"`
	MaxReconnectAttempts   int    `json:"max_reconnect_attempts"`
}

// LoadTDengineConfig loads TDengine configuration from JSON file
func LoadTDengineConfig(configPath string) (*tdengine.TDengineConfig, error) {
	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf("Config file %s not found, using default configuration\n", configPath)
		return tdengine.DefaultTDengineConfig(), nil
	}
	
	// Read config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}
	
	// Parse JSON
	var jsonConfig TDengineConfigJSON
	if err := json.Unmarshal(data, &jsonConfig); err != nil {
		return nil, fmt.Errorf("failed to parse config JSON: %v", err)
	}
	
	// Convert to TDengineConfig
	config, err := convertJSONToConfig(&jsonConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to convert config: %v", err)
	}
	
	return config, nil
}

// convertJSONToConfig converts JSON config to TDengineConfig
func convertJSONToConfig(jsonConfig *TDengineConfigJSON) (*tdengine.TDengineConfig, error) {
	config := &tdengine.TDengineConfig{
		Host:         jsonConfig.Host,
		Port:         jsonConfig.Port,
		Username:     jsonConfig.Username,
		Password:     jsonConfig.Password,
		Database:     jsonConfig.Database,
		MaxOpenConns: jsonConfig.MaxOpenConns,
		MaxIdleConns: jsonConfig.MaxIdleConns,
		MaxRetries:   jsonConfig.MaxRetries,
		EnableAutoReconnect:  jsonConfig.EnableAutoReconnect,
		MaxReconnectAttempts: jsonConfig.MaxReconnectAttempts,
	}
	
	// Parse duration strings
	var err error
	
	if config.ConnTimeout, err = time.ParseDuration(jsonConfig.ConnTimeout); err != nil {
		return nil, fmt.Errorf("invalid conn_timeout: %v", err)
	}
	
	if config.IdleTimeout, err = time.ParseDuration(jsonConfig.IdleTimeout); err != nil {
		return nil, fmt.Errorf("invalid idle_timeout: %v", err)
	}
	
	if config.MaxLifetime, err = time.ParseDuration(jsonConfig.MaxLifetime); err != nil {
		return nil, fmt.Errorf("invalid max_lifetime: %v", err)
	}
	
	if config.HealthCheckInterval, err = time.ParseDuration(jsonConfig.HealthCheckInterval); err != nil {
		return nil, fmt.Errorf("invalid health_check_interval: %v", err)
	}
	
	if config.RetryInterval, err = time.ParseDuration(jsonConfig.RetryInterval); err != nil {
		return nil, fmt.Errorf("invalid retry_interval: %v", err)
	}
	
	if config.ReconnectInterval, err = time.ParseDuration(jsonConfig.ReconnectInterval); err != nil {
		return nil, fmt.Errorf("invalid reconnect_interval: %v", err)
	}
	
	return config, nil
}

// SaveTDengineConfig saves TDengine configuration to JSON file
func SaveTDengineConfig(config *tdengine.TDengineConfig, configPath string) error {
	jsonConfig := &TDengineConfigJSON{
		Host:                   config.Host,
		Port:                   config.Port,
		Username:               config.Username,
		Password:               config.Password,
		Database:               config.Database,
		MaxOpenConns:           config.MaxOpenConns,
		MaxIdleConns:           config.MaxIdleConns,
		ConnTimeout:            config.ConnTimeout.String(),
		IdleTimeout:            config.IdleTimeout.String(),
		MaxLifetime:            config.MaxLifetime.String(),
		HealthCheckInterval:    config.HealthCheckInterval.String(),
		MaxRetries:             config.MaxRetries,
		RetryInterval:          config.RetryInterval.String(),
		EnableAutoReconnect:    config.EnableAutoReconnect,
		ReconnectInterval:      config.ReconnectInterval.String(),
		MaxReconnectAttempts:   config.MaxReconnectAttempts,
	}
	
	data, err := json.MarshalIndent(jsonConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}
	
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}
	
	return nil
}