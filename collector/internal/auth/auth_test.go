package auth

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// createTestJWT creates a test JWT token for testing
func createTestJWT(collectorID string, expiresIn int64) string {
	header := JWTHeader{
		Algorithm: "HS256",
		Type:      "JWT",
	}
	
	claims := JWTClaims{
		CollectorID: collectorID,
		IssuedAt:    time.Now().Unix(),
		ExpiresAt:   time.Now().Unix() + expiresIn,
		TokenType:   "access",
	}
	
	headerBytes, _ := json.Marshal(header)
	claimsBytes, _ := json.Marshal(claims)
	
	headerB64 := base64.RawURLEncoding.EncodeToString(headerBytes)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsBytes)
	
	// For testing, we'll use a dummy signature
	signature := base64.RawURLEncoding.EncodeToString([]byte("dummy-signature"))
	
	return fmt.Sprintf("%s.%s.%s", headerB64, claimsB64, signature)
}

func TestAuthManager_ParseJWTToken(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: "http://localhost:8088",
		MaxRetries:       3,
		RetryDelay:       1,
		TLS: config.TLSConfig{
			InsecureSkipVerify: true, // For testing
		},
		Security: config.SecurityConfig{
			KeyStorePath:     "./test-keys",
			MasterKeyPath:    "./test-keys/master.key",
			AutoGenerate:     true,
			KeyRotationDays:  90,
			EncryptSecretKey: false, // Keep simple for tests
		},
	}
	
	authManager, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	tests := []struct {
		name        string
		token       string
		expectError bool
		errorType   string
	}{
		{
			name:        "Valid token",
			token:       createTestJWT("test-collector", 3600),
			expectError: false,
		},
		{
			name:        "Expired token",
			token:       createTestJWT("test-collector", -3600),
			expectError: true,
			errorType:   AuthErrorTokenExpired,
		},
		{
			name:        "Wrong collector ID",
			token:       createTestJWT("wrong-collector", 3600),
			expectError: true,
			errorType:   AuthErrorTokenInvalid,
		},
		{
			name:        "Invalid token format",
			token:       "invalid.token",
			expectError: true,
			errorType:   AuthErrorTokenInvalid,
		},
		{
			name:        "Empty token",
			token:       "",
			expectError: true,
			errorType:   AuthErrorTokenInvalid,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := authManager.parseJWTToken(tt.token)
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
					return
				}
				
				if authErr, ok := err.(*AuthError); ok {
					if authErr.Type != tt.errorType {
						t.Errorf("Expected error type %s, got %s", tt.errorType, authErr.Type)
					}
				} else {
					t.Errorf("Expected AuthError, got %T", err)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
					return
				}
				
				if claims == nil {
					t.Errorf("Expected claims but got nil")
					return
				}
				
				if claims.CollectorID != "test-collector" {
					t.Errorf("Expected collector ID 'test-collector', got '%s'", claims.CollectorID)
				}
			}
		})
	}
}

func TestAuthManager_LockoutMechanism(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: "http://localhost:8088",
		MaxRetries:       3,
		RetryDelay:       1,
		TLS: config.TLSConfig{
			InsecureSkipVerify: true,
		},
		Security: config.SecurityConfig{
			KeyStorePath:     "./test-keys",
			MasterKeyPath:    "./test-keys/master.key",
			AutoGenerate:     true,
			KeyRotationDays:  90,
			EncryptSecretKey: false,
		},
	}
	
	authManager, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	// Test initial state
	isLocked, _, failures := authManager.GetLockoutStatus()
	if isLocked {
		t.Errorf("Expected not locked initially")
	}
	if failures != 0 {
		t.Errorf("Expected 0 failures initially, got %d", failures)
	}
	
	// Record failures
	testError := &AuthError{Type: AuthErrorInvalidCredentials, Message: "test", Code: 401}
	
	// Record failures up to the limit
	for i := 0; i < authManager.maxFailures; i++ {
		authManager.recordAuthFailure(testError)
	}
	
	// Should be locked out now
	isLocked, lockoutUntil, failures := authManager.GetLockoutStatus()
	if !isLocked {
		t.Errorf("Expected to be locked out after %d failures", authManager.maxFailures)
	}
	if failures != authManager.maxFailures {
		t.Errorf("Expected %d failures, got %d", authManager.maxFailures, failures)
	}
	if lockoutUntil.IsZero() {
		t.Errorf("Expected lockout time to be set")
	}
	
	// Test reset
	authManager.ResetLockout()
	isLocked, _, failures = authManager.GetLockoutStatus()
	if isLocked {
		t.Errorf("Expected not locked after reset")
	}
	if failures != 0 {
		t.Errorf("Expected 0 failures after reset, got %d", failures)
	}
	
	// Test successful auth resets failures
	authManager.recordAuthFailure(testError)
	authManager.recordAuthFailure(testError)
	authManager.recordAuthSuccess()
	
	_, _, failures = authManager.GetLockoutStatus()
	if failures != 0 {
		t.Errorf("Expected 0 failures after successful auth, got %d", failures)
	}
}

func TestAuthManager_Authentication(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/auth/collector/login" {
			var authReq AuthRequest
			if err := json.NewDecoder(r.Body).Decode(&authReq); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			
			if authReq.CollectorID == "test-collector" && authReq.SecretKey == "test-secret" {
				response := AuthResponse{
					AccessToken:  createTestJWT("test-collector", 3600),
					RefreshToken: createTestJWT("test-collector", 7200),
					ExpiresIn:    3600,
					TokenType:    "Bearer",
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "invalid credentials"})
			}
		}
	}))
	defer server.Close()
	
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: server.URL,
		MaxRetries:       3,
		RetryDelay:       1,
		TLS: config.TLSConfig{
			InsecureSkipVerify: true,
		},
		Security: config.SecurityConfig{
			KeyStorePath:     "./test-keys",
			MasterKeyPath:    "./test-keys/master.key",
			AutoGenerate:     true,
			KeyRotationDays:  90,
			EncryptSecretKey: false,
		},
	}
	
	authManager, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	// Test successful authentication
	err = authManager.authenticate()
	if err != nil {
		t.Errorf("Authentication failed: %v", err)
	}
	
	if !authManager.IsAuthenticated() {
		t.Errorf("Expected to be authenticated")
	}
	
	token := authManager.GetAccessToken()
	if token == "" {
		t.Errorf("Expected access token")
	}
	
	claims := authManager.GetTokenClaims()
	if claims == nil {
		t.Errorf("Expected token claims")
	} else if claims.CollectorID != "test-collector" {
		t.Errorf("Expected collector ID 'test-collector', got '%s'", claims.CollectorID)
	}
	
	// Test authentication with wrong credentials
	authConfig.SecretKey = "wrong-secret"
	authManager2, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	err = authManager2.authenticate()
	if err == nil {
		t.Errorf("Expected authentication to fail with wrong credentials")
	}
	
	if authErr, ok := err.(*AuthError); ok {
		if authErr.Type != AuthErrorInvalidCredentials {
			t.Errorf("Expected invalid credentials error, got %s", authErr.Type)
		}
	}
}

func TestAuthManager_CreateAuthenticatedRequest(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: "http://localhost:8088",
		MaxRetries:       3,
		RetryDelay:       1,
		TLS: config.TLSConfig{
			InsecureSkipVerify: true,
		},
		Security: config.SecurityConfig{
			KeyStorePath:     "./test-keys",
			MasterKeyPath:    "./test-keys/master.key",
			AutoGenerate:     true,
			KeyRotationDays:  90,
			EncryptSecretKey: false,
		},
	}
	
	authManager, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	// Set a valid token manually for testing
	validToken := createTestJWT("test-collector", 3600)
	claims, _ := authManager.parseJWTToken(validToken)
	
	authManager.mutex.Lock()
	authManager.accessToken = validToken
	authManager.tokenClaims = claims
	authManager.tokenExpiry = time.Unix(claims.ExpiresAt, 0)
	authManager.mutex.Unlock()
	
	// Test creating authenticated request
	req, err := authManager.CreateAuthenticatedRequest("GET", "http://example.com/api", nil)
	if err != nil {
		t.Errorf("Failed to create authenticated request: %v", err)
	}
	
	authHeader := req.Header.Get("Authorization")
	expectedHeader := "Bearer " + validToken
	if authHeader != expectedHeader {
		t.Errorf("Expected auth header '%s', got '%s'", expectedHeader, authHeader)
	}
	
	userAgent := req.Header.Get("User-Agent")
	if userAgent == "" {
		t.Errorf("Expected User-Agent header to be set")
	}
}

func TestAuthManager_Metrics(t *testing.T) {
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: "http://localhost:8088",
		MaxRetries:       3,
		RetryDelay:       1,
		TLS: config.TLSConfig{
			InsecureSkipVerify: true,
		},
		Security: config.SecurityConfig{
			KeyStorePath:     "./test-keys",
			MasterKeyPath:    "./test-keys/master.key",
			AutoGenerate:     true,
			KeyRotationDays:  90,
			EncryptSecretKey: false,
		},
	}
	
	authManager, err := NewAuthManager(authConfig, logger)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}
	
	// Record some failures
	testError := &AuthError{Type: AuthErrorInvalidCredentials, Message: "test", Code: 401}
	authManager.recordAuthFailure(testError)
	authManager.recordAuthFailure(testError)
	
	// Record success
	authManager.recordAuthSuccess()
	
	metrics := authManager.GetMetrics()
	
	expectedFields := []string{
		"auth_attempts", "auth_failures", "consecutive_failures",
		"lockout_count", "is_locked_out", "lockout_until",
		"last_auth_time", "token_expiry", "is_authenticated",
	}
	
	for _, field := range expectedFields {
		if _, exists := metrics[field]; !exists {
			t.Errorf("Expected metric field '%s' to exist", field)
		}
	}
	
	if metrics["auth_failures"].(int64) != 2 {
		t.Errorf("Expected 2 auth failures, got %v", metrics["auth_failures"])
	}
	
	if metrics["consecutive_failures"].(int) != 0 {
		t.Errorf("Expected 0 consecutive failures after success, got %v", metrics["consecutive_failures"])
	}
}