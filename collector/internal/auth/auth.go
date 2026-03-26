package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/security"
)

// AuthManager manages authentication with the platform
type AuthManager struct {
	config       config.AuthConfig
	logger       *logger.Logger
	httpClient   *http.Client
	
	// Security components
	keyManager   *security.KeyManager
	tlsManager   *security.TLSManager
	
	// Token management
	accessToken  string
	refreshToken string
	tokenExpiry  time.Time
	tokenClaims  *JWTClaims
	mutex        sync.RWMutex
	
	// Control
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	
	// Authentication failure tracking
	consecutiveFailures int
	lockoutUntil       time.Time
	lockoutDuration    time.Duration
	maxFailures        int
	
	// Metrics
	authAttempts int64
	authFailures int64
	lastAuthTime time.Time
	lockoutCount int64
}

// AuthRequest represents an authentication request
type AuthRequest struct {
	CollectorID string `json:"collector_id"`
	SecretKey   string `json:"secret_key"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// RefreshRequest represents a token refresh request
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// JWTHeader represents JWT header
type JWTHeader struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

// JWTClaims represents JWT claims
type JWTClaims struct {
	CollectorID string `json:"collector_id"`
	IssuedAt    int64  `json:"iat"`
	ExpiresAt   int64  `json:"exp"`
	TokenType   string `json:"type"`
	Issuer      string `json:"iss,omitempty"`
	Subject     string `json:"sub,omitempty"`
}

// AuthError represents authentication errors with specific types
type AuthError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

func (e *AuthError) Error() string {
	return fmt.Sprintf("auth error [%s]: %s (code: %d)", e.Type, e.Message, e.Code)
}

// Authentication error types
const (
	AuthErrorInvalidCredentials = "invalid_credentials"
	AuthErrorTokenExpired      = "token_expired"
	AuthErrorTokenInvalid      = "token_invalid"
	AuthErrorCollectorLocked   = "collector_locked"
	AuthErrorNetworkError      = "network_error"
	AuthErrorServerError       = "server_error"
)

// NewAuthManager creates a new authentication manager
func NewAuthManager(config config.AuthConfig, logger *logger.Logger) (*AuthManager, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
	// Initialize TLS manager
	tlsConfig := security.TLSConfig{
		InsecureSkipVerify: config.TLS.InsecureSkipVerify,
		CACertPath:         config.TLS.CACertPath,
		CACerts:            config.TLS.CACerts,
		ClientCertPath:     config.TLS.ClientCertPath,
		ClientKeyPath:      config.TLS.ClientKeyPath,
		ServerName:         config.TLS.ServerName,
		HandshakeTimeout:   time.Duration(config.TLS.HandshakeTimeout) * time.Second,
	}
	
	// Parse TLS versions
	if minVersion, err := parseTLSVersion(config.TLS.MinVersion); err == nil {
		tlsConfig.MinVersion = minVersion
	}
	if maxVersion, err := parseTLSVersion(config.TLS.MaxVersion); err == nil {
		tlsConfig.MaxVersion = maxVersion
	}
	
	tlsManager, err := security.NewTLSManager(tlsConfig, logger)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create TLS manager: %w", err)
	}
	
	// Initialize key manager
	keyManagerConfig := security.KeyManagerConfig{
		KeyStorePath:    config.Security.KeyStorePath,
		MasterKeyPath:   config.Security.MasterKeyPath,
		AutoGenerate:    config.Security.AutoGenerate,
		KeyRotationDays: config.Security.KeyRotationDays,
	}
	
	keyManager, err := security.NewKeyManager(keyManagerConfig, logger)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create key manager: %w", err)
	}
	
	// Create HTTP client with TLS configuration
	httpClient := tlsManager.CreateHTTPClient(30 * time.Second)
	
	return &AuthManager{
		config:          config,
		logger:          logger.WithGroup("auth_manager"),
		httpClient:      httpClient,
		keyManager:      keyManager,
		tlsManager:      tlsManager,
		ctx:             ctx,
		cancel:          cancel,
		lockoutDuration: 15 * time.Minute, // 15 minutes lockout
		maxFailures:     3,                 // Lock after 3 consecutive failures
	}, nil
}

// Start starts the authentication manager
func (am *AuthManager) Start(ctx context.Context) error {
	am.logger.Info("Starting authentication manager", "collector_id", am.config.CollectorID)
	
	// Check if authentication is disabled (standalone mode)
	if !am.config.Enabled {
		am.logger.Info("Authentication disabled - running in standalone mode")
		// Generate a dummy token for standalone mode
		am.mutex.Lock()
		am.accessToken = "standalone-mode-token"
		am.tokenExpiry = time.Now().Add(365 * 24 * time.Hour) // 1 year
		am.mutex.Unlock()
		am.logger.Info("Authentication manager started in standalone mode")
		return nil
	}
	
	// Perform initial authentication
	if err := am.authenticate(); err != nil {
		return fmt.Errorf("initial authentication failed: %w", err)
	}
	
	// Start token refresh routine
	am.wg.Add(1)
	go am.tokenRefreshRoutine()
	
	am.logger.Info("Authentication manager started")
	return nil
}

// Stop stops the authentication manager
func (am *AuthManager) Stop() {
	am.logger.Info("Stopping authentication manager")
	
	am.cancel()
	am.wg.Wait()
	
	// Close security components
	if am.keyManager != nil {
		if err := am.keyManager.Close(); err != nil {
			am.logger.Error("Failed to close key manager", "error", err)
		}
	}
	
	am.logger.Info("Authentication manager stopped")
}

// GetAccessToken returns the current access token
func (am *AuthManager) GetAccessToken() string {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	return am.accessToken
}

// IsAuthenticated returns true if the collector is authenticated
func (am *AuthManager) IsAuthenticated() bool {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	// Check if locked out
	if time.Now().Before(am.lockoutUntil) {
		return false
	}
	
	// Check if we have a valid token
	if am.accessToken == "" || am.tokenClaims == nil {
		return false
	}
	
	// Check token expiry with a small buffer (30 seconds)
	now := time.Now()
	expiryBuffer := 30 * time.Second
	return now.Add(expiryBuffer).Before(am.tokenExpiry)
}

// GetAuthHeader returns the authorization header value
func (am *AuthManager) GetAuthHeader() string {
	token := am.GetAccessToken()
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

// authenticate performs initial authentication with the platform
func (am *AuthManager) authenticate() error {
	// Check if collector is locked out
	if am.isLockedOut() {
		lockoutRemaining := time.Until(am.lockoutUntil)
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: fmt.Sprintf("collector is locked out for %v", lockoutRemaining.Round(time.Second)),
			Code:    423,
		}
	}
	
	am.logger.Info("Authenticating with platform", "endpoint", am.config.PlatformEndpoint)
	
	// Get secret key (potentially decrypted)
	secretKey, err := am.GetSecretKey()
	if err != nil {
		return fmt.Errorf("failed to get secret key: %w", err)
	}
	
	// Prepare authentication request
	authReq := AuthRequest{
		CollectorID: am.config.CollectorID,
		SecretKey:   secretKey,
	}
	
	// Retry authentication with exponential backoff
	var lastErr error
	delay := time.Duration(am.config.RetryDelay) * time.Second
	maxDelay := 5 * time.Minute // Maximum delay of 5 minutes
	
	for attempt := 0; attempt <= am.config.MaxRetries; attempt++ {
		am.authAttempts++
		
		// Check lockout status before each attempt
		if am.isLockedOut() {
			lockoutRemaining := time.Until(am.lockoutUntil)
			lastErr = &AuthError{
				Type:    AuthErrorCollectorLocked,
				Message: fmt.Sprintf("collector locked out for %v", lockoutRemaining.Round(time.Second)),
				Code:    423,
			}
			break
		}
		
		if attempt > 0 {
			am.logger.Info("Retrying authentication", "attempt", attempt, "delay", delay)
			
			// Use context-aware sleep to allow cancellation
			select {
			case <-am.ctx.Done():
				return am.ctx.Err()
			case <-time.After(delay):
			}
			
			// Exponential backoff with jitter and max delay
			delay = time.Duration(float64(delay) * 1.5)
			if delay > maxDelay {
				delay = maxDelay
			}
		}
		
		if err := am.performAuth(authReq); err != nil {
			lastErr = err
			am.logger.Error("Authentication attempt failed", "attempt", attempt, "error", err)
			
			// Record failure and check if we should lock out
			am.recordAuthFailure(err)
			continue
		}
		
		// Authentication successful
		am.recordAuthSuccess()
		am.logger.Info("Authentication successful")
		return nil
	}
	
	return fmt.Errorf("authentication failed after %d attempts: %w", am.config.MaxRetries+1, lastErr)
}

// performAuth performs a single authentication attempt
func (am *AuthManager) performAuth(authReq AuthRequest) error {
	// Marshal request
	reqBody, err := json.Marshal(authReq)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to marshal auth request: %v", err),
			Code:    500,
		}
	}
	
	// Create HTTP request
	url := am.config.PlatformEndpoint + "/api/v1/auth/collector/login"
	req, err := http.NewRequestWithContext(am.ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to create auth request: %v", err),
			Code:    500,
		}
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("ProDB-Collector/%s", "1.0.0"))
	
	// Send request
	resp, err := am.httpClient.Do(req)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to send auth request: %v", err),
			Code:    500,
		}
	}
	defer resp.Body.Close()
	
	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to read auth response: %v", err),
			Code:    500,
		}
	}
	
	// Handle different status codes
	switch resp.StatusCode {
	case http.StatusOK:
		// Success - continue to parse response
	case http.StatusUnauthorized:
		return &AuthError{
			Type:    AuthErrorInvalidCredentials,
			Message: "invalid collector credentials",
			Code:    401,
		}
	case http.StatusForbidden:
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: "collector access forbidden",
			Code:    403,
		}
	case http.StatusTooManyRequests:
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: "too many authentication attempts",
			Code:    429,
		}
	case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable:
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: fmt.Sprintf("server error: %d", resp.StatusCode),
			Code:    resp.StatusCode,
		}
	default:
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: fmt.Sprintf("unexpected status code %d: %s", resp.StatusCode, string(respBody)),
			Code:    resp.StatusCode,
		}
	}
	
	// Parse response
	var authResp AuthResponse
	if err := json.Unmarshal(respBody, &authResp); err != nil {
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: fmt.Sprintf("failed to parse auth response: %v", err),
			Code:    500,
		}
	}
	
	// Validate response
	if authResp.AccessToken == "" {
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: "empty access token in response",
			Code:    500,
		}
	}
	
	// Parse and validate the access token
	claims, err := am.parseJWTToken(authResp.AccessToken)
	if err != nil {
		return fmt.Errorf("invalid access token received: %w", err)
	}
	
	// Store tokens and claims
	am.mutex.Lock()
	am.accessToken = authResp.AccessToken
	am.refreshToken = authResp.RefreshToken
	am.tokenClaims = claims
	am.tokenExpiry = time.Unix(claims.ExpiresAt, 0)
	am.mutex.Unlock()
	
	am.logger.Debug("Tokens updated", 
		"expires_in", authResp.ExpiresIn,
		"token_type", authResp.TokenType,
		"expires_at", time.Unix(claims.ExpiresAt, 0))
	
	return nil
}

// refreshAccessToken refreshes the access token using the refresh token
func (am *AuthManager) refreshAccessToken() error {
	// Check if collector is locked out
	if am.isLockedOut() {
		lockoutRemaining := time.Until(am.lockoutUntil)
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: fmt.Sprintf("collector is locked out for %v", lockoutRemaining.Round(time.Second)),
			Code:    423,
		}
	}
	
	am.mutex.RLock()
	refreshToken := am.refreshToken
	am.mutex.RUnlock()
	
	if refreshToken == "" {
		am.logger.Warn("No refresh token available, attempting full authentication")
		return am.authenticate()
	}
	
	am.logger.Debug("Refreshing access token")
	
	// Prepare refresh request
	refreshReq := RefreshRequest{
		RefreshToken: refreshToken,
	}
	
	// Marshal request
	reqBody, err := json.Marshal(refreshReq)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to marshal refresh request: %v", err),
			Code:    500,
		}
	}
	
	// Create HTTP request
	url := am.config.PlatformEndpoint + am.config.TokenRefreshURL
	req, err := http.NewRequestWithContext(am.ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to create refresh request: %v", err),
			Code:    500,
		}
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("ProDB-Collector/%s", "1.0.0"))
	
	// Send request
	resp, err := am.httpClient.Do(req)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to send refresh request: %v", err),
			Code:    500,
		}
	}
	defer resp.Body.Close()
	
	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &AuthError{
			Type:    AuthErrorNetworkError,
			Message: fmt.Sprintf("failed to read refresh response: %v", err),
			Code:    500,
		}
	}
	
	// Handle different status codes
	switch resp.StatusCode {
	case http.StatusOK:
		// Success - continue to parse response
	case http.StatusUnauthorized:
		// Refresh token expired or invalid, try full authentication
		am.logger.Warn("Refresh token invalid or expired, attempting full authentication")
		return am.authenticate()
	case http.StatusForbidden:
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: "collector access forbidden",
			Code:    403,
		}
	case http.StatusTooManyRequests:
		return &AuthError{
			Type:    AuthErrorCollectorLocked,
			Message: "too many refresh attempts",
			Code:    429,
		}
	default:
		// For other errors, try full authentication as fallback
		am.logger.Warn("Token refresh failed, attempting full authentication", 
			"status", resp.StatusCode, "response", string(respBody))
		return am.authenticate()
	}
	
	// Parse response
	var authResp AuthResponse
	if err := json.Unmarshal(respBody, &authResp); err != nil {
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: fmt.Sprintf("failed to parse refresh response: %v", err),
			Code:    500,
		}
	}
	
	// Validate response
	if authResp.AccessToken == "" {
		return &AuthError{
			Type:    AuthErrorServerError,
			Message: "empty access token in refresh response",
			Code:    500,
		}
	}
	
	// Parse and validate the new access token
	claims, err := am.parseJWTToken(authResp.AccessToken)
	if err != nil {
		return fmt.Errorf("invalid access token received in refresh: %w", err)
	}
	
	// Update tokens and claims
	am.mutex.Lock()
	am.accessToken = authResp.AccessToken
	if authResp.RefreshToken != "" {
		am.refreshToken = authResp.RefreshToken
	}
	am.tokenClaims = claims
	am.tokenExpiry = time.Unix(claims.ExpiresAt, 0)
	am.mutex.Unlock()
	
	am.logger.Debug("Access token refreshed", 
		"expires_in", authResp.ExpiresIn,
		"expires_at", time.Unix(claims.ExpiresAt, 0))
	
	return nil
}

// tokenRefreshRoutine periodically refreshes the access token
func (am *AuthManager) tokenRefreshRoutine() {
	defer am.wg.Done()
	
	// Check token every minute
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-am.ctx.Done():
			return
			
		case <-ticker.C:
			am.checkAndRefreshToken()
		}
	}
}

// checkAndRefreshToken checks if token needs refresh and refreshes if necessary
func (am *AuthManager) checkAndRefreshToken() {
	// Skip if locked out
	if am.isLockedOut() {
		lockoutRemaining := time.Until(am.lockoutUntil)
		am.logger.Debug("Skipping token refresh due to lockout", 
			"lockout_remaining", lockoutRemaining.Round(time.Second))
		return
	}
	
	am.mutex.RLock()
	tokenExpiry := am.tokenExpiry
	hasToken := am.accessToken != ""
	am.mutex.RUnlock()
	
	// If no token, try to authenticate
	if !hasToken {
		am.logger.Debug("No access token available, attempting authentication")
		if err := am.authenticate(); err != nil {
			am.logger.Error("Failed to authenticate", "error", err)
		}
		return
	}
	
	// Refresh token if it expires within 5 minutes
	refreshThreshold := 5 * time.Minute
	timeUntilExpiry := time.Until(tokenExpiry)
	
	if timeUntilExpiry < refreshThreshold {
		am.logger.Debug("Token expiring soon, refreshing", 
			"expires_at", tokenExpiry,
			"time_until_expiry", timeUntilExpiry.Round(time.Second))
		
		if err := am.refreshAccessToken(); err != nil {
			am.logger.Error("Failed to refresh token", "error", err)
			
			// If refresh fails and token is already expired, try full authentication
			if timeUntilExpiry <= 0 {
				am.logger.Info("Token expired and refresh failed, attempting full authentication")
				if authErr := am.authenticate(); authErr != nil {
					am.logger.Error("Failed to re-authenticate after token expiry", "error", authErr)
				}
			}
		}
	}
}

// ForceTokenValidation forces validation of the current access token
func (am *AuthManager) ForceTokenValidation() error {
	return am.validateAccessToken()
}

// CreateAuthenticatedRequest creates an HTTP request with authentication header
func (am *AuthManager) CreateAuthenticatedRequest(method, url string, body io.Reader) (*http.Request, error) {
	// Validate current token before creating request
	if err := am.validateAccessToken(); err != nil {
		// Try to refresh token if validation fails
		if refreshErr := am.refreshAccessToken(); refreshErr != nil {
			return nil, fmt.Errorf("authentication failed: %w", refreshErr)
		}
	}
	
	req, err := http.NewRequestWithContext(am.ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	
	// Add authentication header
	authHeader := am.GetAuthHeader()
	if authHeader == "" {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "no valid authentication token available",
			Code:    401,
		}
	}
	
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("ProDB-Collector/%s", "1.0.0"))
	
	return req, nil
}

// parseJWTToken parses and validates a JWT token (basic validation without signature verification)
func (am *AuthManager) parseJWTToken(token string) (*JWTClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "invalid JWT token format",
			Code:    400,
		}
	}
	
	// Decode header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "failed to decode JWT header",
			Code:    400,
		}
	}
	
	var header JWTHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "failed to parse JWT header",
			Code:    400,
		}
	}
	
	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "failed to decode JWT payload",
			Code:    400,
		}
	}
	
	var claims JWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "failed to parse JWT claims",
			Code:    400,
		}
	}
	
	// Validate claims
	now := time.Now().Unix()
	if claims.ExpiresAt > 0 && now > claims.ExpiresAt {
		return nil, &AuthError{
			Type:    AuthErrorTokenExpired,
			Message: "token has expired",
			Code:    401,
		}
	}
	
	if claims.CollectorID != am.config.CollectorID {
		return nil, &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "token collector_id mismatch",
			Code:    401,
		}
	}
	
	return &claims, nil
}

// validateAccessToken validates the current access token
func (am *AuthManager) validateAccessToken() error {
	am.mutex.RLock()
	token := am.accessToken
	am.mutex.RUnlock()
	
	if token == "" {
		return &AuthError{
			Type:    AuthErrorTokenInvalid,
			Message: "no access token available",
			Code:    401,
		}
	}
	
	claims, err := am.parseJWTToken(token)
	if err != nil {
		return err
	}
	
	// Update token claims
	am.mutex.Lock()
	am.tokenClaims = claims
	am.tokenExpiry = time.Unix(claims.ExpiresAt, 0)
	am.mutex.Unlock()
	
	return nil
}

// isLockedOut checks if the collector is currently locked out
func (am *AuthManager) isLockedOut() bool {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	return time.Now().Before(am.lockoutUntil)
}

// recordAuthFailure records an authentication failure and handles lockout
func (am *AuthManager) recordAuthFailure(err error) {
	am.mutex.Lock()
	defer am.mutex.Unlock()
	
	am.authFailures++
	am.consecutiveFailures++
	
	if am.consecutiveFailures >= am.maxFailures {
		am.lockoutUntil = time.Now().Add(am.lockoutDuration)
		am.lockoutCount++
		am.logger.Error("Collector locked out due to consecutive authentication failures",
			"failures", am.consecutiveFailures,
			"lockout_until", am.lockoutUntil,
			"lockout_duration", am.lockoutDuration,
			"error", err)
	} else {
		am.logger.Warn("Authentication failure recorded",
			"consecutive_failures", am.consecutiveFailures,
			"max_failures", am.maxFailures,
			"error", err)
	}
}

// recordAuthSuccess records a successful authentication and resets failure counters
func (am *AuthManager) recordAuthSuccess() {
	am.mutex.Lock()
	defer am.mutex.Unlock()
	
	am.consecutiveFailures = 0
	am.lockoutUntil = time.Time{}
	am.lastAuthTime = time.Now()
	
	am.logger.Info("Authentication successful", "last_auth_time", am.lastAuthTime)
}

// GetTokenClaims returns the current token claims
func (am *AuthManager) GetTokenClaims() *JWTClaims {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	if am.tokenClaims == nil {
		return nil
	}
	
	// Return a copy to prevent external modification
	claims := *am.tokenClaims
	return &claims
}

// GetLockoutStatus returns the current lockout status
func (am *AuthManager) GetLockoutStatus() (bool, time.Time, int) {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	return am.isLockedOut(), am.lockoutUntil, am.consecutiveFailures
}

// ResetLockout manually resets the lockout status (for administrative use)
func (am *AuthManager) ResetLockout() {
	am.mutex.Lock()
	defer am.mutex.Unlock()
	
	am.consecutiveFailures = 0
	am.lockoutUntil = time.Time{}
	
	am.logger.Info("Authentication lockout manually reset")
}

// GetSecretKey retrieves the collector's secret key (decrypted if encrypted storage is enabled)
func (am *AuthManager) GetSecretKey() (string, error) {
	if am.config.Security.EncryptSecretKey && am.keyManager != nil {
		return am.keyManager.GetSecretKey(am.config.CollectorID)
	}
	return am.config.SecretKey, nil
}

// RotateSecretKey rotates the collector's secret key
func (am *AuthManager) RotateSecretKey() (string, error) {
	if am.keyManager == nil {
		return "", fmt.Errorf("key manager not available")
	}
	
	newSecretKey, err := am.keyManager.RotateSecretKey(am.config.CollectorID)
	if err != nil {
		return "", fmt.Errorf("failed to rotate secret key: %w", err)
	}
	
	am.logger.Info("Secret key rotated", "collector_id", am.config.CollectorID)
	
	return newSecretKey, nil
}

// ValidateTLSConnection validates the TLS connection to the platform
func (am *AuthManager) ValidateTLSConnection() error {
	if am.tlsManager == nil {
		return fmt.Errorf("TLS manager not available")
	}
	
	// Extract host from platform endpoint
	endpoint := am.config.PlatformEndpoint
	if strings.HasPrefix(endpoint, "https://") {
		endpoint = strings.TrimPrefix(endpoint, "https://")
	} else if strings.HasPrefix(endpoint, "http://") {
		return fmt.Errorf("TLS validation not applicable for HTTP endpoint")
	}
	
	// Add default port if not specified
	if !strings.Contains(endpoint, ":") {
		endpoint += ":443"
	}
	
	return am.tlsManager.ValidateTLSConnection(endpoint)
}

// GetSecurityMetrics returns security-related metrics
func (am *AuthManager) GetSecurityMetrics() map[string]interface{} {
	metrics := make(map[string]interface{})
	
	if am.tlsManager != nil {
		tlsMetrics := am.tlsManager.GetSecurityMetrics()
		for k, v := range tlsMetrics {
			metrics["tls_"+k] = v
		}
	}
	
	if am.keyManager != nil {
		keyMetrics := am.keyManager.ListKeys()
		metrics["managed_keys"] = len(keyMetrics)
		
		// Count active vs revoked keys
		activeKeys := 0
		revokedKeys := 0
		for _, metadata := range keyMetrics {
			if metadata.IsRevoked {
				revokedKeys++
			} else {
				activeKeys++
			}
		}
		metrics["active_keys"] = activeKeys
		metrics["revoked_keys"] = revokedKeys
	}
	
	return metrics
}

// parseTLSVersion parses a TLS version string to uint16
func parseTLSVersion(version string) (uint16, error) {
	switch version {
	case "1.0":
		return 0x0301, nil // TLS 1.0
	case "1.1":
		return 0x0302, nil // TLS 1.1
	case "1.2":
		return 0x0303, nil // TLS 1.2
	case "1.3":
		return 0x0304, nil // TLS 1.3
	default:
		return 0, fmt.Errorf("unsupported TLS version: %s", version)
	}
}

// GetMetrics returns authentication metrics
func (am *AuthManager) GetMetrics() map[string]interface{} {
	am.mutex.RLock()
	defer am.mutex.RUnlock()
	
	isLockedOut := time.Now().Before(am.lockoutUntil)
	
	metrics := map[string]interface{}{
		"auth_attempts":         am.authAttempts,
		"auth_failures":         am.authFailures,
		"consecutive_failures":  am.consecutiveFailures,
		"lockout_count":         am.lockoutCount,
		"is_locked_out":         isLockedOut,
		"lockout_until":         am.lockoutUntil,
		"last_auth_time":        am.lastAuthTime,
		"token_expiry":          am.tokenExpiry,
		"is_authenticated":      am.IsAuthenticated(),
	}
	
	if am.tokenClaims != nil {
		metrics["token_claims"] = map[string]interface{}{
			"collector_id": am.tokenClaims.CollectorID,
			"issued_at":    time.Unix(am.tokenClaims.IssuedAt, 0),
			"expires_at":   time.Unix(am.tokenClaims.ExpiresAt, 0),
			"token_type":   am.tokenClaims.TokenType,
		}
	}
	
	// Add security metrics
	securityMetrics := am.GetSecurityMetrics()
	for k, v := range securityMetrics {
		metrics["security_"+k] = v
	}
	
	return metrics
}