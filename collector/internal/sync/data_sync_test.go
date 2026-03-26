package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/communication"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/storage"
)

// Helper function to create a mock auth manager
func createTestAuthManager(serverURL string, logger *logger.Logger) (*auth.AuthManager, error) {
	authConfig := config.AuthConfig{
		CollectorID:      "test-collector",
		SecretKey:        "test-secret",
		PlatformEndpoint: serverURL,
		Security: config.SecurityConfig{
			AutoGenerate: true,
		},
	}
	return auth.NewAuthManager(authConfig, logger)
}

func TestDataSyncService_Basic(t *testing.T) {
	// Create test server
	uploadedData := make([]communication.DataUploadRequest, 0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/data/batch" && r.Method == "POST" {
			var req communication.DataUploadRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
				uploadedData = append(uploadedData, req)
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"success": true}`))
			} else {
				w.WriteHeader(http.StatusBadRequest)
			}
		} else if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
		} else if r.URL.Path == "/api/v1/auth/collector/login" && r.Method == "POST" {
			// Mock authentication endpoint with valid JWT format
			// JWT with future expiration: {"collector_id":"test-collector","iat":1735027200,"exp":2735027200,"type":"access"}
			mockJWT := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0b3JfaWQiOiJ0ZXN0LWNvbGxlY3RvciIsImlhdCI6MTczNTAyNzIwMCwiZXhwIjoyNzM1MDI3MjAwLCJ0eXBlIjoiYWNjZXNzIn0.mock-signature"
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"access_token": "` + mockJWT + `",
				"refresh_token": "` + mockJWT + `",
				"expires_in": 3600,
				"token_type": "Bearer"
			}`))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create logger
	logConfig := config.LoggerConfig{
		Level:  "debug",
		Format: "text",
		Output: "stdout",
	}
	log, err := logger.NewLogger(logConfig)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Create storage cache
	storageConfig := config.StorageConfig{
		DatabasePath:    ":memory:",
		MaxCacheSize:    1024 * 1024,
		RetentionDays:   7,
		CleanupInterval: 3600,
	}
	storageCache, err := storage.NewStorageCache(storageConfig, log)
	if err != nil {
		t.Fatalf("Failed to create storage cache: %v", err)
	}

	// Start storage cache
	if err := storageCache.Start(nil); err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer storageCache.Stop()

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL:       server.URL,
		DataUploadURL: "/api/v1/data/batch",
		Timeout:       5,
		MaxRetries:    3,
		RetryDelay:    1,
	}

	// Create auth manager
	authMgr, err := createTestAuthManager(server.URL, log)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}

	// Create platform client
	platformClient := communication.NewPlatformClient(platformConfig, authMgr, log)

	// Create network monitor
	networkMonitor := NewNetworkMonitor(platformConfig, log)
	if err := networkMonitor.Start(); err != nil {
		t.Fatalf("Failed to start network monitor: %v", err)
	}
	defer networkMonitor.Stop()

	// Wait for network to be online
	time.Sleep(100 * time.Millisecond)

	// Create data sync service
	dataSyncService := NewDataSyncService(platformConfig, storageCache, platformClient, networkMonitor, log)

	// Add some test data to storage
	testData := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.5,
			Quality:   1,
		},
		{
			DeviceID:  "device1",
			PointName: "pressure",
			Timestamp: time.Now(),
			Value:     1013.25,
			Quality:   1,
		},
	}

	if err := storageCache.Store(testData); err != nil {
		t.Fatalf("Failed to store test data: %v", err)
	}

	// Start sync service
	if err := dataSyncService.Start(); err != nil {
		t.Fatalf("Failed to start data sync service: %v", err)
	}
	defer dataSyncService.Stop()

	// Trigger sync
	dataSyncService.TriggerSync()

	// Wait for sync to complete
	time.Sleep(500 * time.Millisecond)

	// Check that data was uploaded
	if len(uploadedData) == 0 {
		t.Errorf("Expected data to be uploaded")
	}

	// Check metrics
	metrics := dataSyncService.GetMetrics()
	if metrics.TotalSyncAttempts == 0 {
		t.Errorf("Expected sync attempts > 0")
	}

	if metrics.SuccessfulSyncs == 0 {
		t.Errorf("Expected successful syncs > 0")
	}

	if metrics.TotalDataPointsSynced == 0 {
		t.Errorf("Expected data points synced > 0")
	}
}

func TestExponentialBackoffStrategy(t *testing.T) {
	strategy := &ExponentialBackoffStrategy{
		baseDelay:     1 * time.Second,
		maxDelay:      10 * time.Second,
		backoffFactor: 2.0,
		maxRetries:    5,
		jitterEnabled: false, // Disable jitter for predictable testing
	}

	// Test delay calculation
	testCases := []struct {
		attempt  int
		expected time.Duration
	}{
		{0, 1 * time.Second},
		{1, 2 * time.Second},
		{2, 4 * time.Second},
		{3, 8 * time.Second},
		{4, 10 * time.Second}, // Capped at maxDelay
		{5, 10 * time.Second}, // Still capped
	}

	for _, tc := range testCases {
		actual := strategy.calculateDelay(tc.attempt)
		if actual != tc.expected {
			t.Errorf("Attempt %d: expected delay %v, got %v", tc.attempt, tc.expected, actual)
		}
	}
}