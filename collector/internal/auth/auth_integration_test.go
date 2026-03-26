package auth

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// TestAuthManagerLifecycle tests the complete lifecycle of auth manager
func TestAuthManagerLifecycle(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)
	require.NotNil(t, authMgr)

	ctx := context.Background()

	// Start auth manager
	err = authMgr.Start(ctx)
	require.NoError(t, err)

	// Stop auth manager
	authMgr.Stop()
}

// TestAuthManagerTokenGeneration tests token generation
func TestAuthManagerTokenGeneration(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	// Get token
	token := authMgr.GetToken()
	assert.NotEmpty(t, token, "Token should not be empty")
}

// TestAuthManagerTokenRefresh tests token refresh mechanism
func TestAuthManagerTokenRefresh(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 1, // 1 second for testing
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()
	err = authMgr.Start(ctx)
	require.NoError(t, err)
	defer authMgr.Stop()

	// Get initial token
	token1 := authMgr.GetToken()

	// Wait for token refresh
	time.Sleep(2 * time.Second)

	// Get new token
	token2 := authMgr.GetToken()

	// Tokens should be different after refresh
	assert.NotEqual(t, token1, token2, "Token should be refreshed")
}

// TestAuthManagerDisabled tests auth manager when disabled
func TestAuthManagerDisabled(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              false,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()
	err = authMgr.Start(ctx)
	require.NoError(t, err)
	defer authMgr.Stop()

	// Token should still be available even when disabled
	token := authMgr.GetToken()
	assert.NotEmpty(t, token)
}

// TestAuthManagerConcurrentAccess tests concurrent access to auth manager
func TestAuthManagerConcurrentAccess(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()
	err = authMgr.Start(ctx)
	require.NoError(t, err)
	defer authMgr.Stop()

	// Concurrent token access
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = authMgr.GetToken()
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestAuthManagerContextCancellation tests context cancellation
func TestAuthManagerContextCancellation(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	err = authMgr.Start(ctx)
	require.NoError(t, err)

	// Cancel context
	cancel()

	// Wait a bit
	time.Sleep(100 * time.Millisecond)

	// Stop should work fine
	authMgr.Stop()
}

// TestAuthManagerMultipleStarts tests multiple start calls
func TestAuthManagerMultipleStarts(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()

	// First start
	err = authMgr.Start(ctx)
	require.NoError(t, err)

	// Second start should not error (idempotent)
	err = authMgr.Start(ctx)
	assert.NoError(t, err)

	authMgr.Stop()
}

// TestAuthManagerMultipleStops tests multiple stop calls
func TestAuthManagerMultipleStops(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()
	err = authMgr.Start(ctx)
	require.NoError(t, err)

	// First stop
	authMgr.Stop()

	// Second stop should not panic
	assert.NotPanics(t, func() {
		authMgr.Stop()
	})
}

// TestAuthManagerTokenPersistence tests token persistence across restarts
func TestAuthManagerTokenPersistence(t *testing.T) {
	log, err := logger.NewLogger(config.LoggerConfig{
		Level:  "info",
		Format: "json",
		Output: "stdout",
	})
	require.NoError(t, err)

	authConfig := config.AuthConfig{
		Enabled:              true,
		TokenRefreshInterval: 60,
	}

	authMgr, err := NewAuthManager(authConfig, log)
	require.NoError(t, err)

	ctx := context.Background()
	err = authMgr.Start(ctx)
	require.NoError(t, err)

	// Get token
	token1 := authMgr.GetToken()

	// Stop and restart
	authMgr.Stop()

	err = authMgr.Start(ctx)
	require.NoError(t, err)
	defer authMgr.Stop()

	// Get token again
	token2 := authMgr.GetToken()

	// Tokens should be different (new token generated)
	assert.NotEqual(t, token1, token2)
}
