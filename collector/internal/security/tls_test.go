package security

import (
	"crypto/tls"
	"net/http"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestTLSManager_BasicConfiguration(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	tlsConfig := TLSConfig{
		InsecureSkipVerify: false,
		MinVersion:         tls.VersionTLS12,
		MaxVersion:         tls.VersionTLS13,
		HandshakeTimeout:   10 * time.Second,
	}
	
	tm, err := NewTLSManager(tlsConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create TLS manager: %v", err)
	}
	
	// Test TLS config retrieval
	config := tm.GetTLSConfig()
	if config == nil {
		t.Errorf("Expected TLS config to be non-nil")
	}
	
	if config.MinVersion != tls.VersionTLS12 {
		t.Errorf("Expected min version TLS 1.2, got %d", config.MinVersion)
	}
	
	if config.MaxVersion != tls.VersionTLS13 {
		t.Errorf("Expected max version TLS 1.3, got %d", config.MaxVersion)
	}
	
	if config.InsecureSkipVerify != false {
		t.Errorf("Expected InsecureSkipVerify to be false")
	}
}

func TestTLSManager_HTTPClientCreation(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	tlsConfig := TLSConfig{
		InsecureSkipVerify: true, // For testing
		MinVersion:         tls.VersionTLS12,
		HandshakeTimeout:   5 * time.Second,
	}
	
	tm, err := NewTLSManager(tlsConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create TLS manager: %v", err)
	}
	
	// Create HTTP client
	client := tm.CreateHTTPClient(30 * time.Second)
	if client == nil {
		t.Errorf("Expected HTTP client to be non-nil")
	}
	
	if client.Timeout != 30*time.Second {
		t.Errorf("Expected client timeout to be 30s, got %v", client.Timeout)
	}
	
	// Check transport configuration
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Errorf("Expected HTTP transport to be *http.Transport")
	}
	
	if transport.TLSClientConfig == nil {
		t.Errorf("Expected TLS client config to be set")
	}
	
	if transport.TLSHandshakeTimeout != 5*time.Second {
		t.Errorf("Expected TLS handshake timeout to be 5s, got %v", transport.TLSHandshakeTimeout)
	}
}

func TestTLSManager_SecurityMetrics(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	tlsConfig := TLSConfig{
		InsecureSkipVerify: false,
		MinVersion:         tls.VersionTLS12,
		MaxVersion:         tls.VersionTLS13,
		ServerName:         "example.com",
		HandshakeTimeout:   10 * time.Second,
		CipherSuites:       []uint16{tls.TLS_AES_256_GCM_SHA384, tls.TLS_CHACHA20_POLY1305_SHA256},
	}
	
	tm, err := NewTLSManager(tlsConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create TLS manager: %v", err)
	}
	
	metrics := tm.GetSecurityMetrics()
	
	expectedFields := []string{
		"tls_min_version", "tls_max_version", "insecure_skip_verify",
		"client_cert_configured", "ca_cert_configured", "handshake_timeout",
		"server_name", "cipher_suites",
	}
	
	for _, field := range expectedFields {
		if _, exists := metrics[field]; !exists {
			t.Errorf("Expected metric field '%s' to exist", field)
		}
	}
	
	if metrics["tls_min_version"] != "TLS 1.2" {
		t.Errorf("Expected min version 'TLS 1.2', got %v", metrics["tls_min_version"])
	}
	
	if metrics["tls_max_version"] != "TLS 1.3" {
		t.Errorf("Expected max version 'TLS 1.3', got %v", metrics["tls_max_version"])
	}
	
	if metrics["server_name"] != "example.com" {
		t.Errorf("Expected server name 'example.com', got %v", metrics["server_name"])
	}
	
	cipherSuites, ok := metrics["cipher_suites"].([]string)
	if !ok {
		t.Errorf("Expected cipher_suites to be []string")
	} else if len(cipherSuites) != 2 {
		t.Errorf("Expected 2 cipher suites, got %d", len(cipherSuites))
	}
}

func TestTLSManager_InsecureMode(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	tlsConfig := TLSConfig{
		InsecureSkipVerify: true,
		MinVersion:         tls.VersionTLS10, // Intentionally low for testing
	}
	
	tm, err := NewTLSManager(tlsConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create TLS manager: %v", err)
	}
	
	config := tm.GetTLSConfig()
	if !config.InsecureSkipVerify {
		t.Errorf("Expected InsecureSkipVerify to be true")
	}
	
	if config.MinVersion != tls.VersionTLS10 {
		t.Errorf("Expected min version TLS 1.0, got %d", config.MinVersion)
	}
	
	metrics := tm.GetSecurityMetrics()
	if metrics["insecure_skip_verify"] != true {
		t.Errorf("Expected insecure_skip_verify to be true in metrics")
	}
}

func TestTLSManager_DefaultValues(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	// Create TLS manager with minimal config
	tlsConfig := TLSConfig{}
	
	tm, err := NewTLSManager(tlsConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create TLS manager: %v", err)
	}
	
	// Check that defaults are applied
	if tm.config.MinVersion != tls.VersionTLS12 {
		t.Errorf("Expected default min version TLS 1.2, got %d", tm.config.MinVersion)
	}
	
	if tm.config.HandshakeTimeout != 10*time.Second {
		t.Errorf("Expected default handshake timeout 10s, got %v", tm.config.HandshakeTimeout)
	}
	
	config := tm.GetTLSConfig()
	if config.MinVersion != tls.VersionTLS12 {
		t.Errorf("Expected TLS config min version TLS 1.2, got %d", config.MinVersion)
	}
}