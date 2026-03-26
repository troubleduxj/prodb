package tdengine

import (
	"fmt"
	"time"
)

// TDengineConfig holds the configuration for TDengine connection
type TDengineConfig struct {
	Host         string        `json:"host" yaml:"host"`
	Port         int           `json:"port" yaml:"port"`
	Username     string        `json:"username" yaml:"username"`
	Password     string        `json:"password" yaml:"password"`
	Database     string        `json:"database" yaml:"database"`
	MaxOpenConns int           `json:"max_open_conns" yaml:"max_open_conns"`
	MaxIdleConns int           `json:"max_idle_conns" yaml:"max_idle_conns"`
	ConnTimeout  time.Duration `json:"conn_timeout" yaml:"conn_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout" yaml:"idle_timeout"`
	MaxLifetime  time.Duration `json:"max_lifetime" yaml:"max_lifetime"`
	
	// Health check configuration
	HealthCheckInterval time.Duration `json:"health_check_interval" yaml:"health_check_interval"`
	MaxRetries         int           `json:"max_retries" yaml:"max_retries"`
	RetryInterval      time.Duration `json:"retry_interval" yaml:"retry_interval"`
	
	// Auto-reconnection configuration
	EnableAutoReconnect bool          `json:"enable_auto_reconnect" yaml:"enable_auto_reconnect"`
	ReconnectInterval   time.Duration `json:"reconnect_interval" yaml:"reconnect_interval"`
	MaxReconnectAttempts int          `json:"max_reconnect_attempts" yaml:"max_reconnect_attempts"`
}

// DefaultTDengineConfig returns a default configuration
func DefaultTDengineConfig() *TDengineConfig {
	return &TDengineConfig{
		Host:         "localhost",
		Port:         6041, // REST connection port (not 6030 which is for native connection)
		Username:     "root",
		Password:     "taosdata",
		Database:     "",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnTimeout:  30 * time.Second,
		IdleTimeout:  10 * time.Minute,
		MaxLifetime:  1 * time.Hour,
		
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}
}

// Validate validates the configuration
func (c *TDengineConfig) Validate() error {
	if c.Host == "" {
		return ErrInvalidConfig("host cannot be empty")
	}
	if c.Port <= 0 || c.Port > 65535 {
		return ErrInvalidConfig("port must be between 1 and 65535")
	}
	if c.Username == "" {
		return ErrInvalidConfig("username cannot be empty")
	}
	if c.MaxOpenConns <= 0 {
		return ErrInvalidConfig("max_open_conns must be greater than 0")
	}
	if c.MaxIdleConns < 0 {
		return ErrInvalidConfig("max_idle_conns cannot be negative")
	}
	if c.MaxIdleConns > c.MaxOpenConns {
		return ErrInvalidConfig("max_idle_conns cannot be greater than max_open_conns")
	}
	return nil
}

// DSN returns the data source name for TDengine connection
func (c *TDengineConfig) DSN() string {
	// Use HTTP REST connection format to match the driver
	dsn := fmt.Sprintf("%s:%s@http(%s:%d)/", c.Username, c.Password, c.Host, c.Port)
	if c.Database != "" {
		dsn += c.Database
	}
	return dsn
}