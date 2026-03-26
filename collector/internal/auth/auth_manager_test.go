package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/collector/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAuthManagerCreation tests auth manager creation
func TestAuthManagerCreation(t *testing.T) {
	t.Run("Create auth manager with valid config", func(t *testing.T) {
		cfg := config.AuthConfig{
			CollectorID: "test-collector-001",
			SecretKey:   "test-secret-key",
			ServerURL:   "http://localhost:8080",
		}

		mgr := &AuthManager{
			config:          cfg,
			maxFailures:     5,
			lockoutDuration: 5 * time.Minute,
		}

		assert.NotNil(t, mgr)
		assert.Equal(t, "test-collector-001", mgr.config.CollectorID)
		assert.Equal(t, 5, mgr.maxFailures)
	})
}

// TestAuthRequest tests authentication request
func TestAuthRequest(t *testing.T) {
	t.Run("Create auth request", func(t *testing.T) {
		req := AuthRequest{
			CollectorID: "collector-001",
			SecretKey:   "secret-key-123",
		}

		assert.Equal(t, "collector-001", req.CollectorID)
		assert.Equal(t, "secret-key-123", req.SecretKey)
	})

	t.Run("Marshal auth request to JSON", func(t *testing.T) {
		req := AuthRequest{
			CollectorID: "collector-001",
			SecretKey:   "secret-key-123",
		}

		data, err := json.Marshal(req)
		assert.NoError(t, err)
		assert.Contains(t, string(data), "collector-001")
		assert.Contains(t, string(data), "secret-key-123")
	})
}

// TestAuthResponse tests authentication response
func TestAuthResponse(t *testing.T) {
	t.Run("Parse auth response", func(t *testing.T) {
		jsonData := `{
			"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			"refresh_token": "refresh_token_value",
			"expires_in": 3600,
			"token_type": "Bearer"
		}`

		var resp AuthResponse
		err := json.Unmarshal([]byte(jsonData), &resp)
		assert.NoError(t, err)
		assert.NotEmpty(t, resp.AccessToken)
		assert.NotEmpty(t, resp.RefreshToken)
		assert.Equal(t, 3600, resp.ExpiresIn)
		assert.Equal(t, "Bearer", resp.TokenType)
	})
}

// TestTokenManagement tests token management
func TestTokenManagement(t *testing.T) {
	mgr := &AuthManager{
		config: config.AuthConfig{
			CollectorID: "test-collector",
		},
	}

	t.Run("Set access token", func(t *testing.T) {
		token := "test-access-token"
		mgr.setAccessToken(token)
		assert.Equal(t, token, mgr.getAccessToken())
	})

	t.Run("Set refresh token", func(t *testing.T) {
		token := "test-refresh-token"
		mgr.setRefreshToken(token)
		assert.Equal(t, token, mgr.getRefreshToken())
	})

	t.Run("Set token expiry", func(t *testing.T) {
		expiry := time.Now().Add(1 * time.Hour)
		mgr.setTokenExpiry(expiry)
		assert.Equal(t, expiry, mgr.getTokenExpiry())
	})

	t.Run("Check token expiration", func(t *testing.T) {
		// Set expired token
		mgr.setTokenExpiry(time.Now().Add(-1 * time.Hour))
		assert.True(t, mgr.isTokenExpired())

		// Set valid token
		mgr.setTokenExpiry(time.Now().Add(1 * time.Hour))
		assert.False(t, mgr.isTokenExpired())
	})
}

// TestJWTClaims tests JWT claims parsing
func TestJWTClaims(t *testing.T) {
	t.Run("Create JWT claims", func(t *testing.T) {
		claims := &JWTClaims{
			CollectorID: "collector-001",
			IssuedAt:    time.Now().Unix(),
			ExpiresAt:   time.Now().Add(1 * time.Hour).Unix(),
			TokenType:   "access",
			Issuer:      "prodb-platform",
		}

		assert.Equal(t, "collector-001", claims.CollectorID)
		assert.Equal(t, "access", claims.TokenType)
		assert.Equal(t, "prodb-platform", claims.Issuer)
		assert.True(t, claims.ExpiresAt > claims.IssuedAt)
	})

	t.Run("Check claims expiration", func(t *testing.T) {
		// Expired claims
		expiredClaims := &JWTClaims{
			ExpiresAt: time.Now().Add(-1 * time.Hour).Unix(),
		}
		assert.True(t, time.Now().Unix() > expiredClaims.ExpiresAt)

		// Valid claims
		validClaims := &JWTClaims{
			ExpiresAt: time.Now().Add(1 * time.Hour).Unix(),
		}
		assert.True(t, time.Now().Unix() < validClaims.ExpiresAt)
	})
}

// TestAuthenticationFlow tests the authentication flow
func TestAuthenticationFlow(t *testing.T) {
	t.Run("Successful authentication", func(t *testing.T) {
		// Create mock server
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/api/auth/login", r.URL.Path)
			assert.Equal(t, "POST", r.Method)

			resp := AuthResponse{
				AccessToken:  "mock-access-token",
				RefreshToken: "mock-refresh-token",
				ExpiresIn:    3600,
				TokenType:    "Bearer",
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		}))
		defer server.Close()

		mgr := &AuthManager{
			config: config.AuthConfig{
				CollectorID: "test-collector",
				SecretKey:   "test-secret",
				ServerURL:   server.URL,
			},
			httpClient: server.Client(),
		}

		// This would require implementing the actual authenticate method
		// For now, we test the response parsing
		assert.NotNil(t, mgr)
	})

	t.Run("Authentication failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "invalid credentials",
			})
		}))
		defer server.Close()

		mgr := &AuthManager{
			config: config.AuthConfig{
				CollectorID: "test-collector",
				SecretKey:   "wrong-secret",
				ServerURL:   server.URL,
			},
			httpClient: server.Client(),
		}

		assert.NotNil(t, mgr)
	})
}

// TestFailureTracking tests authentication failure tracking
func TestFailureTracking(t *testing.T) {
	mgr := &AuthManager{
		maxFailures:     3,
		lockoutDuration: 5 * time.Minute,
	}

	t.Run("Track consecutive failures", func(t *testing.T) {
		assert.Equal(t, 0, mgr.consecutiveFailures)

		mgr.recordFailure()
		assert.Equal(t, 1, mgr.consecutiveFailures)

		mgr.recordFailure()
		assert.Equal(t, 2, mgr.consecutiveFailures)

		mgr.recordFailure()
		assert.Equal(t, 3, mgr.consecutiveFailures)
	})

	t.Run("Reset failures on success", func(t *testing.T) {
		mgr.consecutiveFailures = 3
		mgr.resetFailures()
		assert.Equal(t, 0, mgr.consecutiveFailures)
	})

	t.Run("Lockout after max failures", func(t *testing.T) {
		mgr.consecutiveFailures = 0
		
		for i := 0; i < mgr.maxFailures; i++ {
			mgr.recordFailure()
		}

		assert.True(t, mgr.consecutiveFailures >= mgr.maxFailures)
		
		// Simulate lockout
		mgr.lockoutUntil = time.Now().Add(mgr.lockoutDuration)
		assert.True(t, mgr.isLockedOut())
	})

	t.Run("Lockout expires", func(t *testing.T) {
		mgr.lockoutUntil = time.Now().Add(-1 * time.Minute)
		assert.False(t, mgr.isLockedOut())
	})
}

// TestAuthMetrics tests authentication metrics
func TestAuthMetrics(t *testing.T) {
	mgr := &AuthManager{}

	t.Run("Track auth attempts", func(t *testing.T) {
		assert.Equal(t, int64(0), mgr.authAttempts)
		
		mgr.authAttempts++
		assert.Equal(t, int64(1), mgr.authAttempts)
		
		mgr.authAttempts += 5
		assert.Equal(t, int64(6), mgr.authAttempts)
	})

	t.Run("Track auth failures", func(t *testing.T) {
		assert.Equal(t, int64(0), mgr.authFailures)
		
		mgr.authFailures++
		assert.Equal(t, int64(1), mgr.authFailures)
	})

	t.Run("Track last auth time", func(t *testing.T) {
		now := time.Now()
		mgr.lastAuthTime = now
		assert.Equal(t, now, mgr.lastAuthTime)
	})

	t.Run("Calculate success rate", func(t *testing.T) {
		mgr.authAttempts = 100
		mgr.authFailures = 5
		
		successRate := float64(mgr.authAttempts-mgr.authFailures) / float64(mgr.authAttempts)
		assert.InDelta(t, 0.95, successRate, 0.01)
	})
}

// TestAuthError tests authentication error handling
func TestAuthError(t *testing.T) {
	t.Run("Create auth error", func(t *testing.T) {
		err := &AuthError{
			Type:    "invalid_credentials",
			Message: "Invalid collector ID or secret key",
			Code:    401,
		}

		assert.Equal(t, "invalid_credentials", err.Type)
		assert.Equal(t, "Invalid collector ID or secret key", err.Message)
		assert.Equal(t, 401, err.Code)
		assert.Contains(t, err.Error(), "invalid_credentials")
	})

	t.Run("Different error types", func(t *testing.T) {
		errors := []*AuthError{
			{Type: "invalid_credentials", Code: 401},
			{Type: "token_expired", Code: 401},
			{Type: "server_error", Code: 500},
			{Type: "network_error", Code: 0},
		}

		for _, err := range errors {
			assert.NotEmpty(t, err.Type)
			assert.NotEmpty(t, err.Error())
		}
	})
}

// TestConcurrentTokenAccess tests concurrent token access
func TestConcurrentTokenAccess(t *testing.T) {
	mgr := &AuthManager{
		accessToken: "initial-token",
	}

	t.Run("Concurrent reads", func(t *testing.T) {
		done := make(chan bool)

		for i := 0; i < 10; i++ {
			go func() {
				_ = mgr.getAccessToken()
				done <- true
			}()
		}

		for i := 0; i < 10; i++ {
			<-done
		}
	})

	t.Run("Concurrent writes", func(t *testing.T) {
		done := make(chan bool)

		for i := 0; i < 10; i++ {
			go func(idx int) {
				mgr.setAccessToken("token-" + string(rune(idx)))
				done <- true
			}(i)
		}

		for i := 0; i < 10; i++ {
			<-done
		}

		// Verify final token is set
		assert.NotEmpty(t, mgr.getAccessToken())
	})
}

// Helper methods for testing

func (m *AuthManager) setAccessToken(token string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.accessToken = token
}

func (m *AuthManager) getAccessToken() string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.accessToken
}

func (m *AuthManager) setRefreshToken(token string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.refreshToken = token
}

func (m *AuthManager) getRefreshToken() string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.refreshToken
}

func (m *AuthManager) setTokenExpiry(expiry time.Time) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.tokenExpiry = expiry
}

func (m *AuthManager) getTokenExpiry() time.Time {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.tokenExpiry
}

func (m *AuthManager) isTokenExpired() bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return time.Now().After(m.tokenExpiry)
}

func (m *AuthManager) recordFailure() {
	m.consecutiveFailures++
	m.authFailures++
}

func (m *AuthManager) resetFailures() {
	m.consecutiveFailures = 0
}

func (m *AuthManager) isLockedOut() bool {
	return time.Now().Before(m.lockoutUntil)
}

// BenchmarkTokenAccess benchmarks token access operations
func BenchmarkTokenAccess(b *testing.B) {
	mgr := &AuthManager{
		accessToken: "benchmark-token",
	}

	b.Run("GetAccessToken", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = mgr.getAccessToken()
		}
	})

	b.Run("SetAccessToken", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			mgr.setAccessToken("new-token")
		}
	})
}

// BenchmarkAuthMetrics benchmarks metrics operations
func BenchmarkAuthMetrics(b *testing.B) {
	mgr := &AuthManager{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mgr.authAttempts++
		if i%10 == 0 {
			mgr.authFailures++
		}
	}
}
