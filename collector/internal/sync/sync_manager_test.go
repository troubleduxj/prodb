package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/collector/internal/communication"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	"prodb/collector/internal/storage"
)

func TestSyncManager_Basic(t *testing.T) {
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
			// Mock authentication endpoint
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0b3JfaWQiOiJ0ZXN0LWNvbGxlY3RvciIsImlhdCI6MTczNTAyNzIwMCwiZXhwIjoyNzM1MDI3MjAwLCJ0eXBlIjoiYWNjZXNzIn0.mock-signature",
				"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0b3JfaWQiOiJ0ZXN0LWNvbGxlY3RvciIsImlhdCI6MTczNTAyNzIwMCwiZXhwIjoyNzM1MDI3MjAwLCJ0eXBlIjoiYWNjZXNzIn0.mock-signature",
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

	// Create auth manager (mock)
	authMgr, err := createTestAuthManager(server.URL, log)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}

	// Create platform client
	platformClient := communication.NewPlatformClient(platformConfig, authMgr, log)

	// Create sync manager
	syncManager := NewSyncManager(platformConfig, storageCache, platformClient, log)

	// Start sync manager
	if err := syncManager.Start(); err != nil {
		t.Fatalf("Failed to start sync manager: %v", err)
	}
	defer syncManager.Stop()

	// Wait for initialization
	time.Sleep(200 * time.Millisecond)

	// Check initial status
	if !syncManager.IsNetworkOnline() {
		t.Errorf("Expected network to be online")
	}

	if !syncManager.IsHealthy() {
		t.Errorf("Expected system to be healthy initially")
	}

	// Add test data
	testData := []protocol.DataValue{
		{
			DeviceID:  "device1",
			PointName: "temperature",
			Timestamp: time.Now(),
			Value:     25.5,
			Quality:   1,
		},
	}

	if err := storageCache.Store(testData); err != nil {
		t.Fatalf("Failed to store test data: %v", err)
	}

	// Trigger sync
	syncManager.TriggerSync()

	// Wait for sync to complete
	time.Sleep(1 * time.Second)

	// Check that data was uploaded
	if len(uploadedData) == 0 {
		t.Errorf("Expected data to be uploaded")
	}

	// Check aggregated metrics
	metrics := syncManager.GetAggregatedMetrics()
	if metrics.OverallHealth != "healthy" {
		t.Errorf("Expected overall health to be healthy, got %s", metrics.OverallHealth)
	}

	if metrics.NetworkMetrics.Status != NetworkStatusOnline {
		t.Errorf("Expected network status to be online")
	}

	if metrics.SyncMetrics.SuccessfulSyncs == 0 {
		t.Errorf("Expected successful syncs > 0")
	}
}

func TestSyncManager_GetHealthSummary(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
		} else if r.URL.Path == "/api/v1/auth/collector/login" && r.Method == "POST" {
			// Mock authentication endpoint
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0b3JfaWQiOiJ0ZXN0LWNvbGxlY3RvciIsImlhdCI6MTczNTAyNzIwMCwiZXhwIjoyNzM1MDI3MjAwLCJ0eXBlIjoiYWNjZXNzIn0.mock-signature",
				"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0b3JfaWQiOiJ0ZXN0LWNvbGxlY3RvciIsImlhdCI6MTczNTAyNzIwMCwiZXhwIjoyNzM1MDI3MjAwLCJ0eXBlIjoiYWNjZXNzIn0.mock-signature",
				"expires_in": 3600,
				"token_type": "Bearer"
			}`))
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

	if err := storageCache.Start(nil); err != nil {
		t.Fatalf("Failed to start storage cache: %v", err)
	}
	defer storageCache.Stop()

	// Create platform config
	platformConfig := config.PlatformConfig{
		BaseURL: server.URL,
		Timeout: 5,
	}

	// Create auth manager (mock)
	authMgr, err := createTestAuthManager(server.URL, log)
	if err != nil {
		t.Fatalf("Failed to create auth manager: %v", err)
	}

	// Create platform client
	platformClient := communication.NewPlatformClient(platformConfig, authMgr, log)

	// Create sync manager
	syncManager := NewSyncManager(platformConfig, storageCache, platformClient, log)

	// Start sync manager
	if err := syncManager.Start(); err != nil {
		t.Fatalf("Failed to start sync manager: %v", err)
	}
	defer syncManager.Stop()

	// Wait for initialization
	time.Sleep(200 * time.Millisecond)

	// Get health summary
	summary := syncManager.GetHealthSummary()
	if summary == "" {
		t.Errorf("Expected non-empty health summary")
	}

	// Get detailed status
	status := syncManager.GetDetailedStatus()
	if len(status) == 0 {
		t.Errorf("Expected non-empty detailed status")
	}

	// Check that expected fields are present
	expectedFields := []string{
		"overall_health",
		"network_status",
		"network_uptime",
		"pending_data_count",
		"sync_success_rate",
		"storage_healthy",
	}

	for _, field := range expectedFields {
		if _, exists := status[field]; !exists {
			t.Errorf("Expected field %s in detailed status", field)
		}
	}
}
