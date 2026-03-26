package communication

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"prodb/collector/internal/auth"
	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// PlatformClient handles communication with the platform
type PlatformClient struct {
	config     config.PlatformConfig
	logger     *logger.Logger
	httpClient *http.Client
	authMgr    *auth.AuthManager
}

// HeartbeatRequest represents a heartbeat request
type HeartbeatRequest struct {
	CollectorID string                 `json:"collector_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Status      string                 `json:"status"`
	Metrics     map[string]interface{} `json:"metrics"`
}

// DataUploadRequest represents a data upload request
type DataUploadRequest struct {
	CollectorID string                 `json:"collector_id"`
	Timestamp   time.Time              `json:"timestamp"`
	DataPoints  []protocol.DataValue   `json:"data_points"`
}

// ConfigSyncResponse represents a configuration sync response
type ConfigSyncResponse struct {
	Version  string                        `json:"version"`
	Config   config.CollectorConfig        `json:"config"`
	Checksum string                        `json:"checksum"`
}

// NewPlatformClient creates a new platform client
func NewPlatformClient(config config.PlatformConfig, authMgr *auth.AuthManager, logger *logger.Logger) *PlatformClient {
	httpClient := &http.Client{
		Timeout: time.Duration(config.Timeout) * time.Second,
	}
	
	return &PlatformClient{
		config:     config,
		logger:     logger.WithGroup("platform_client"),
		httpClient: httpClient,
		authMgr:    authMgr,
	}
}

// SendHeartbeat sends a heartbeat to the platform
func (pc *PlatformClient) SendHeartbeat(collectorID string, status string, metrics map[string]interface{}) error {
	pc.logger.Debug("Sending heartbeat", "collector_id", collectorID, "status", status)
	
	// Prepare heartbeat request
	heartbeat := HeartbeatRequest{
		CollectorID: collectorID,
		Timestamp:   time.Now(),
		Status:      status,
		Metrics:     metrics,
	}
	
	// Marshal request
	reqBody, err := json.Marshal(heartbeat)
	if err != nil {
		return fmt.Errorf("failed to marshal heartbeat request: %w", err)
	}
	
	// Create URL
	url := pc.config.BaseURL + fmt.Sprintf(pc.config.HeartbeatURL, collectorID)
	
	// Send request with retry
	return pc.sendRequestWithRetry("POST", url, bytes.NewBuffer(reqBody), nil)
}

// UploadData uploads data to the platform
func (pc *PlatformClient) UploadData(collectorID string, data []protocol.DataValue) error {
	if len(data) == 0 {
		return nil
	}
	
	pc.logger.Debug("Uploading data", "collector_id", collectorID, "data_points", len(data))
	
	// Prepare upload request
	uploadReq := DataUploadRequest{
		CollectorID: collectorID,
		Timestamp:   time.Now(),
		DataPoints:  data,
	}
	
	// Marshal request
	reqBody, err := json.Marshal(uploadReq)
	if err != nil {
		return fmt.Errorf("failed to marshal upload request: %w", err)
	}
	
	// Create URL
	url := pc.config.BaseURL + pc.config.DataUploadURL
	
	// Send request with retry
	return pc.sendRequestWithRetry("POST", url, bytes.NewBuffer(reqBody), nil)
}

// SyncConfiguration syncs configuration from the platform
func (pc *PlatformClient) SyncConfiguration(collectorID string) (*config.CollectorConfig, error) {
	pc.logger.Debug("Syncing configuration", "collector_id", collectorID)
	
	// Create URL
	url := pc.config.BaseURL + fmt.Sprintf(pc.config.ConfigSyncURL, collectorID)
	
	// Prepare response container
	var configResp ConfigSyncResponse
	
	// Send request with retry
	if err := pc.sendRequestWithRetry("GET", url, nil, &configResp); err != nil {
		return nil, err
	}
	
	pc.logger.Debug("Configuration synced", "version", configResp.Version)
	
	return &configResp.Config, nil
}

// sendRequestWithRetry sends an HTTP request with retry logic
func (pc *PlatformClient) sendRequestWithRetry(method, url string, body io.Reader, response interface{}) error {
	var lastErr error
	delay := time.Duration(pc.config.RetryDelay) * time.Second
	
	for attempt := 0; attempt <= pc.config.MaxRetries; attempt++ {
		if attempt > 0 {
			pc.logger.Debug("Retrying request", "attempt", attempt, "delay", delay)
			time.Sleep(delay)
			delay *= 2 // Exponential backoff
		}
		
		if err := pc.sendRequest(method, url, body, response); err != nil {
			lastErr = err
			pc.logger.Warn("Request attempt failed", "attempt", attempt, "error", err)
			continue
		}
		
		// Request successful
		return nil
	}
	
	return fmt.Errorf("request failed after %d attempts: %w", pc.config.MaxRetries+1, lastErr)
}

// sendRequest sends a single HTTP request
func (pc *PlatformClient) sendRequest(method, url string, body io.Reader, response interface{}) error {
	// Create authenticated request
	req, err := pc.authMgr.CreateAuthenticatedRequest(method, url, body)
	if err != nil {
		return fmt.Errorf("failed to create authenticated request: %w", err)
	}
	
	// Add compression header if enabled
	if pc.config.EnableCompression {
		req.Header.Set("Accept-Encoding", "gzip")
		if body != nil {
			req.Header.Set("Content-Encoding", "gzip")
		}
	}
	
	// Send request
	resp, err := pc.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()
	
	// Check status code
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}
	
	// Parse response if needed
	if response != nil {
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read response body: %w", err)
		}
		
		if err := json.Unmarshal(respBody, response); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}
	
	return nil
}

// Ping tests connectivity to the platform
func (pc *PlatformClient) Ping() error {
	url := pc.config.BaseURL + "/api/v1/health"
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create ping request: %w", err)
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req = req.WithContext(ctx)
	
	resp, err := pc.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to ping platform: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("platform ping failed with status %d", resp.StatusCode)
	}
	
	return nil
}