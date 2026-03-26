package security

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"prodb/collector/internal/logger"
)

// TLSConfig contains TLS configuration options
type TLSConfig struct {
	// Certificate verification
	InsecureSkipVerify bool     `json:"insecure_skip_verify"`
	CACertPath         string   `json:"ca_cert_path"`
	CACerts            []string `json:"ca_certs"`
	
	// Client certificate authentication
	ClientCertPath string `json:"client_cert_path"`
	ClientKeyPath  string `json:"client_key_path"`
	
	// TLS version constraints
	MinVersion uint16 `json:"min_version"`
	MaxVersion uint16 `json:"max_version"`
	
	// Cipher suites (optional)
	CipherSuites []uint16 `json:"cipher_suites"`
	
	// Server name for SNI
	ServerName string `json:"server_name"`
	
	// Timeouts
	HandshakeTimeout time.Duration `json:"handshake_timeout"`
}

// TLSManager manages TLS configuration and certificate handling
type TLSManager struct {
	config TLSConfig
	logger *logger.Logger
	
	// Cached TLS config
	tlsConfig *tls.Config
	
	// Certificate pool
	caCertPool *x509.CertPool
}

// NewTLSManager creates a new TLS manager
func NewTLSManager(config TLSConfig, logger *logger.Logger) (*TLSManager, error) {
	tm := &TLSManager{
		config: config,
		logger: logger.WithGroup("tls_manager"),
	}
	
	// Set default values
	if config.MinVersion == 0 {
		tm.config.MinVersion = tls.VersionTLS12
	}
	if config.HandshakeTimeout == 0 {
		tm.config.HandshakeTimeout = 10 * time.Second
	}
	
	// Initialize TLS configuration
	if err := tm.initializeTLSConfig(); err != nil {
		return nil, fmt.Errorf("failed to initialize TLS config: %w", err)
	}
	
	tm.logger.Info("TLS manager initialized",
		"min_version", tm.getTLSVersionString(tm.config.MinVersion),
		"max_version", tm.getTLSVersionString(tm.config.MaxVersion),
		"insecure_skip_verify", tm.config.InsecureSkipVerify)
	
	return tm, nil
}

// initializeTLSConfig initializes the TLS configuration
func (tm *TLSManager) initializeTLSConfig() error {
	tlsConfig := &tls.Config{
		MinVersion:         tm.config.MinVersion,
		MaxVersion:         tm.config.MaxVersion,
		InsecureSkipVerify: tm.config.InsecureSkipVerify,
		ServerName:         tm.config.ServerName,
	}
	
	// Set cipher suites if specified
	if len(tm.config.CipherSuites) > 0 {
		tlsConfig.CipherSuites = tm.config.CipherSuites
	}
	
	// Load CA certificates
	if err := tm.loadCACertificates(); err != nil {
		return fmt.Errorf("failed to load CA certificates: %w", err)
	}
	
	if tm.caCertPool != nil {
		tlsConfig.RootCAs = tm.caCertPool
	}
	
	// Load client certificate if specified
	if tm.config.ClientCertPath != "" && tm.config.ClientKeyPath != "" {
		cert, err := tls.LoadX509KeyPair(tm.config.ClientCertPath, tm.config.ClientKeyPath)
		if err != nil {
			return fmt.Errorf("failed to load client certificate: %w", err)
		}
		
		tlsConfig.Certificates = []tls.Certificate{cert}
		tm.logger.Info("Client certificate loaded", 
			"cert_path", tm.config.ClientCertPath,
			"key_path", tm.config.ClientKeyPath)
	}
	
	tm.tlsConfig = tlsConfig
	
	return nil
}

// loadCACertificates loads CA certificates from various sources
func (tm *TLSManager) loadCACertificates() error {
	// Start with system cert pool
	caCertPool, err := x509.SystemCertPool()
	if err != nil {
		tm.logger.Warn("Failed to load system cert pool, using empty pool", "error", err)
		caCertPool = x509.NewCertPool()
	}
	
	// Load CA certificate from file
	if tm.config.CACertPath != "" {
		caCert, err := ioutil.ReadFile(tm.config.CACertPath)
		if err != nil {
			return fmt.Errorf("failed to read CA certificate file: %w", err)
		}
		
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return fmt.Errorf("failed to parse CA certificate from file: %s", tm.config.CACertPath)
		}
		
		tm.logger.Info("CA certificate loaded from file", "path", tm.config.CACertPath)
	}
	
	// Load CA certificates from inline PEM data
	for i, caCertPEM := range tm.config.CACerts {
		if !caCertPool.AppendCertsFromPEM([]byte(caCertPEM)) {
			return fmt.Errorf("failed to parse CA certificate %d from inline PEM", i)
		}
		
		tm.logger.Debug("CA certificate loaded from inline PEM", "index", i)
	}
	
	tm.caCertPool = caCertPool
	
	return nil
}

// GetTLSConfig returns the configured TLS config
func (tm *TLSManager) GetTLSConfig() *tls.Config {
	// Return a copy to prevent external modification
	if tm.tlsConfig == nil {
		return nil
	}
	
	return tm.tlsConfig.Clone()
}

// CreateHTTPClient creates an HTTP client with the configured TLS settings
func (tm *TLSManager) CreateHTTPClient(timeout time.Duration) *http.Client {
	transport := &http.Transport{
		TLSClientConfig:   tm.GetTLSConfig(),
		TLSHandshakeTimeout: tm.config.HandshakeTimeout,
		DisableKeepAlives: false,
		MaxIdleConns:      10,
		IdleConnTimeout:   90 * time.Second,
	}
	
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
}

// VerifyCertificate manually verifies a certificate against the configured CA pool
func (tm *TLSManager) VerifyCertificate(cert *x509.Certificate, serverName string) error {
	if tm.config.InsecureSkipVerify {
		tm.logger.Warn("Certificate verification skipped (insecure mode)")
		return nil
	}
	
	opts := x509.VerifyOptions{
		Roots:     tm.caCertPool,
		DNSName:   serverName,
		KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	
	_, err := cert.Verify(opts)
	if err != nil {
		return fmt.Errorf("certificate verification failed: %w", err)
	}
	
	tm.logger.Debug("Certificate verification successful", "server_name", serverName)
	
	return nil
}

// GetCertificateInfo returns information about a certificate
func (tm *TLSManager) GetCertificateInfo(cert *x509.Certificate) map[string]interface{} {
	return map[string]interface{}{
		"subject":            cert.Subject.String(),
		"issuer":             cert.Issuer.String(),
		"serial_number":      cert.SerialNumber.String(),
		"not_before":         cert.NotBefore,
		"not_after":          cert.NotAfter,
		"dns_names":          cert.DNSNames,
		"ip_addresses":       cert.IPAddresses,
		"signature_algorithm": cert.SignatureAlgorithm.String(),
		"public_key_algorithm": cert.PublicKeyAlgorithm.String(),
		"is_ca":              cert.IsCA,
		"key_usage":          tm.getKeyUsageStrings(cert.KeyUsage),
		"ext_key_usage":      tm.getExtKeyUsageStrings(cert.ExtKeyUsage),
	}
}

// ValidateTLSConnection validates a TLS connection to a server
func (tm *TLSManager) ValidateTLSConnection(serverAddr string) error {
	conn, err := tls.Dial("tcp", serverAddr, tm.GetTLSConfig())
	if err != nil {
		return fmt.Errorf("TLS connection failed: %w", err)
	}
	defer conn.Close()
	
	// Get connection state
	state := conn.ConnectionState()
	
	tm.logger.Info("TLS connection validated",
		"server_addr", serverAddr,
		"tls_version", tm.getTLSVersionString(state.Version),
		"cipher_suite", tls.CipherSuiteName(state.CipherSuite),
		"server_certificates", len(state.PeerCertificates))
	
	// Log certificate information
	if len(state.PeerCertificates) > 0 {
		cert := state.PeerCertificates[0]
		certInfo := tm.GetCertificateInfo(cert)
		tm.logger.Debug("Server certificate info", "certificate", certInfo)
	}
	
	return nil
}

// ReloadCertificates reloads certificates (useful for certificate rotation)
func (tm *TLSManager) ReloadCertificates() error {
	tm.logger.Info("Reloading certificates")
	
	if err := tm.initializeTLSConfig(); err != nil {
		return fmt.Errorf("failed to reload TLS config: %w", err)
	}
	
	tm.logger.Info("Certificates reloaded successfully")
	
	return nil
}

// getTLSVersionString returns a human-readable TLS version string
func (tm *TLSManager) getTLSVersionString(version uint16) string {
	switch version {
	case tls.VersionTLS10:
		return "TLS 1.0"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS13:
		return "TLS 1.3"
	default:
		return fmt.Sprintf("Unknown (0x%04x)", version)
	}
}

// getKeyUsageStrings returns human-readable key usage strings
func (tm *TLSManager) getKeyUsageStrings(keyUsage x509.KeyUsage) []string {
	var usages []string
	
	if keyUsage&x509.KeyUsageDigitalSignature != 0 {
		usages = append(usages, "Digital Signature")
	}
	if keyUsage&x509.KeyUsageContentCommitment != 0 {
		usages = append(usages, "Content Commitment")
	}
	if keyUsage&x509.KeyUsageKeyEncipherment != 0 {
		usages = append(usages, "Key Encipherment")
	}
	if keyUsage&x509.KeyUsageDataEncipherment != 0 {
		usages = append(usages, "Data Encipherment")
	}
	if keyUsage&x509.KeyUsageKeyAgreement != 0 {
		usages = append(usages, "Key Agreement")
	}
	if keyUsage&x509.KeyUsageCertSign != 0 {
		usages = append(usages, "Certificate Sign")
	}
	if keyUsage&x509.KeyUsageCRLSign != 0 {
		usages = append(usages, "CRL Sign")
	}
	if keyUsage&x509.KeyUsageEncipherOnly != 0 {
		usages = append(usages, "Encipher Only")
	}
	if keyUsage&x509.KeyUsageDecipherOnly != 0 {
		usages = append(usages, "Decipher Only")
	}
	
	return usages
}

// getExtKeyUsageStrings returns human-readable extended key usage strings
func (tm *TLSManager) getExtKeyUsageStrings(extKeyUsage []x509.ExtKeyUsage) []string {
	var usages []string
	
	for _, usage := range extKeyUsage {
		switch usage {
		case x509.ExtKeyUsageServerAuth:
			usages = append(usages, "Server Authentication")
		case x509.ExtKeyUsageClientAuth:
			usages = append(usages, "Client Authentication")
		case x509.ExtKeyUsageCodeSigning:
			usages = append(usages, "Code Signing")
		case x509.ExtKeyUsageEmailProtection:
			usages = append(usages, "Email Protection")
		case x509.ExtKeyUsageTimeStamping:
			usages = append(usages, "Time Stamping")
		case x509.ExtKeyUsageOCSPSigning:
			usages = append(usages, "OCSP Signing")
		default:
			usages = append(usages, fmt.Sprintf("Unknown (%v)", usage))
		}
	}
	
	return usages
}

// GetSecurityMetrics returns security-related metrics
func (tm *TLSManager) GetSecurityMetrics() map[string]interface{} {
	metrics := map[string]interface{}{
		"tls_min_version":        tm.getTLSVersionString(tm.config.MinVersion),
		"tls_max_version":        tm.getTLSVersionString(tm.config.MaxVersion),
		"insecure_skip_verify":   tm.config.InsecureSkipVerify,
		"client_cert_configured": tm.config.ClientCertPath != "" && tm.config.ClientKeyPath != "",
		"ca_cert_configured":     tm.config.CACertPath != "" || len(tm.config.CACerts) > 0,
		"handshake_timeout":      tm.config.HandshakeTimeout,
	}
	
	if tm.config.ServerName != "" {
		metrics["server_name"] = tm.config.ServerName
	}
	
	if len(tm.config.CipherSuites) > 0 {
		var cipherNames []string
		for _, suite := range tm.config.CipherSuites {
			cipherNames = append(cipherNames, tls.CipherSuiteName(suite))
		}
		metrics["cipher_suites"] = cipherNames
	}
	
	return metrics
}