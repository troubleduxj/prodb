package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"prodb/collector/internal/core"
	"prodb/collector/internal/logger"
)

// ConfigResponse represents the collector configuration response
type ConfigResponse struct {
	CollectorID       string `json:"collector_id"`
	Name              string `json:"name"`
	PlatformURL       string `json:"platform_url"`
	AgentID           string `json:"agent_id"`
	AccessToken       string `json:"access_token"`
	HeartbeatInterval int    `json:"heartbeat_interval"`
	BufferSize        int    `json:"buffer_size"`
	SyncInterval      int    `json:"sync_interval"`
}

// ConfigUpdateRequest represents a configuration update request
type ConfigUpdateRequest struct {
	PlatformURL       string `json:"platform_url"`
	AgentID           string `json:"agent_id"`
	AccessToken       string `json:"access_token"`
	BufferSize        int    `json:"buffer_size"`
	SyncInterval      int    `json:"sync_interval"`
}

// ConnectionTestResponse represents connection test response
type ConnectionTestResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Timestamp int64  `json:"timestamp"`
}

// APIHandler handles HTTP API requests for the collector
type APIHandler struct {
	collector *core.Collector
	logger    *logger.Logger
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(collector *core.Collector, logger *logger.Logger) *APIHandler {
	return &APIHandler{
		collector: collector,
		logger:    logger,
	}
}

// SystemStatusResponse represents the system status API response
type SystemStatusResponse struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Status       string    `json:"status"`
	Uptime       int64     `json:"uptime"`
	DataPoints   int64     `json:"dataPoints"`
	ErrorCount   int64     `json:"errorCount"`
	LastUpdate   time.Time `json:"lastUpdate"`
	MemoryUsage  float64   `json:"memoryUsage"`
	CPUUsage     float64   `json:"cpuUsage"`
	NetworkOnline bool     `json:"networkOnline"`
	SyncHealthy  bool      `json:"syncHealthy"`
}

// InterfaceStatusResponse represents interface status information
type InterfaceStatusResponse struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Status      string                 `json:"status"`
	DataRate    float64                `json:"dataRate"`
	ErrorRate   float64                `json:"errorRate"`
	LastData    time.Time              `json:"lastData"`
	Config      map[string]interface{} `json:"config"`
	QuickActions []string              `json:"quickActions"`
}

// DataFlowMetricsResponse represents data flow monitoring information
type DataFlowMetricsResponse struct {
	CollectionRate    float64   `json:"collectionRate"`
	ErrorRate         float64   `json:"errorRate"`
	BufferUtilization float64   `json:"bufferUtilization"`
	CacheHitRate      float64   `json:"cacheHitRate"`
	NetworkLatency    float64   `json:"networkLatency"`
	LastSync          time.Time `json:"lastSync"`
	SyncStatus        string    `json:"syncStatus"`
}

// LogEntry represents a log entry for API responses
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Component string    `json:"component"`
	Error     string    `json:"error,omitempty"`
}

// GetSystemStatus handles GET /api/v1/status
func (h *APIHandler) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metrics := h.collector.GetMetrics()
	
	response := SystemStatusResponse{
		ID:            h.collector.ID,
		Name:          "ProDB Collector",
		Status:        metrics.Status,
		Uptime:        metrics.Uptime,
		DataPoints:    metrics.BufferMetrics.TotalReceived,
		ErrorCount:    0, // TODO: Add error count from metrics
		LastUpdate:    time.Now(),
		MemoryUsage:   float64(metrics.StorageMetrics.DatabaseSize) / 1024 / 1024, // Convert to MB
		CPUUsage:      0.0, // TODO: Implement CPU usage monitoring
		NetworkOnline: metrics.NetworkOnline,
		SyncHealthy:   metrics.SyncHealthy,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode system status response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// GetInterfaces handles GET /api/v1/interfaces
func (h *APIHandler) GetInterfaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metrics := h.collector.GetMetrics()
	interfaces := make([]InterfaceStatusResponse, 0)

	// Convert protocol metrics to interface status
	for taskID, taskMetric := range metrics.ProtocolMetrics.TaskMetrics {
		status := "disconnected"
		if taskMetric.ErrorCount == 0 && taskMetric.RunCount > 0 {
			status = "connected"
		}
		if taskMetric.ErrorCount > 0 {
			status = "error"
		}

		quickActions := []string{"start", "stop", "test", "configure"}
		if status == "connected" {
			quickActions = []string{"stop", "test", "configure"}
		} else {
			quickActions = []string{"start", "test", "configure"}
		}

		interfaces = append(interfaces, InterfaceStatusResponse{
			ID:           taskID,
			Name:         fmt.Sprintf("Task %s", taskID),
			Type:         "protocol_task", // Generic type since we don't have protocol type in metrics
			Status:       status,
			DataRate:     0.0, // TODO: Calculate from run frequency
			ErrorRate:    taskMetric.SuccessRate,
			LastData:     taskMetric.LastRun,
			Config:       make(map[string]interface{}), // Empty config for now
			QuickActions: quickActions,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(interfaces); err != nil {
		h.logger.Error("Failed to encode interfaces response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// GetDataFlowMetrics handles GET /api/v1/monitoring/dataflow
func (h *APIHandler) GetDataFlowMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metrics := h.collector.GetMetrics()
	
	// Calculate collection rate from buffer metrics
	collectionRate := 0.0
	if metrics.BufferMetrics.TotalReceived > 0 {
		// Estimate rate based on total received (simplified calculation)
		collectionRate = float64(metrics.BufferMetrics.TotalReceived) / float64(metrics.Uptime+1) // +1 to avoid division by zero
	}
	
	response := DataFlowMetricsResponse{
		CollectionRate:    collectionRate,
		ErrorRate:         0.0, // TODO: Calculate error rate from protocol metrics
		BufferUtilization: metrics.BufferMetrics.BufferUtilization,
		CacheHitRate:      metrics.StorageMetrics.CacheHitRate,
		NetworkLatency:    0.0, // TODO: Add network latency metrics
		LastSync:          time.Now(), // TODO: Get actual last sync time
		SyncStatus:        h.collector.GetSyncHealthSummary(),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode data flow metrics response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// GetLogs handles GET /api/v1/logs
func (h *APIHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	levelFilter := r.URL.Query().Get("level")
	componentFilter := r.URL.Query().Get("component")

	limit := 100 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	// Get logs from logger (this would need to be implemented in the logger)
	logs := h.getRecentLogs(limit, levelFilter, componentFilter)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(logs); err != nil {
		h.logger.Error("Failed to encode logs response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// GetHeartbeatStatus handles GET /api/v1/monitoring/heartbeat
func (h *APIHandler) GetHeartbeatStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats := h.collector.GetHeartbeatStats()
	health := h.collector.GetHeartbeatHealth()

	response := map[string]interface{}{
		"stats":  stats,
		"health": health,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode heartbeat status response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// TriggerSync handles POST /api/v1/sync/trigger
func (h *APIHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	h.collector.TriggerDataSync()

	response := map[string]interface{}{
		"success": true,
		"message": "Data sync triggered successfully",
		"timestamp": time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode sync trigger response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// getRecentLogs retrieves recent log entries (placeholder implementation)
func (h *APIHandler) getRecentLogs(limit int, levelFilter, componentFilter string) []LogEntry {
	// This is a placeholder implementation
	// In a real implementation, you would retrieve logs from the logger's storage
	logs := []LogEntry{
		{
			Timestamp: time.Now().Add(-5 * time.Minute),
			Level:     "INFO",
			Message:   "Collector started successfully",
			Component: "core",
		},
		{
			Timestamp: time.Now().Add(-3 * time.Minute),
			Level:     "INFO",
			Message:   "Protocol manager initialized",
			Component: "protocol",
		},
		{
			Timestamp: time.Now().Add(-1 * time.Minute),
			Level:     "DEBUG",
			Message:   "Data sync completed",
			Component: "sync",
		},
	}

	// Apply filters
	filteredLogs := make([]LogEntry, 0)
	for _, log := range logs {
		if levelFilter != "" && log.Level != levelFilter {
			continue
		}
		if componentFilter != "" && log.Component != componentFilter {
			continue
		}
		filteredLogs = append(filteredLogs, log)
		if len(filteredLogs) >= limit {
			break
		}
	}

	return filteredLogs
}

// RegisterRoutes registers all API routes
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	// Health check API
	mux.HandleFunc("/api/v1/health", h.GetHealth)
	
	// Configuration APIs
	mux.HandleFunc("/api/v1/config", h.HandleConfig)
	mux.HandleFunc("/api/v1/config/test", h.TestConnection)
	
	// System status and monitoring APIs
	mux.HandleFunc("/api/v1/status", h.GetSystemStatus)
	mux.HandleFunc("/api/v1/interfaces", h.GetInterfaces)
	mux.HandleFunc("/api/v1/monitoring/dataflow", h.GetDataFlowMetrics)
	mux.HandleFunc("/api/v1/monitoring/heartbeat", h.GetHeartbeatStatus)
	mux.HandleFunc("/api/v1/logs", h.GetLogs)
	mux.HandleFunc("/api/v1/sync/trigger", h.TriggerSync)
	
	// Protocol testing APIs
	protocolTestHandler := NewProtocolTestHandler(h.logger)
	protocolTestHandler.RegisterRoutes(mux)
	
	// Driver management APIs
	driverHandler := NewDriverHandler(h.collector.GetProtocolManager(), h.logger)
	driverHandler.RegisterRoutes(mux)
}

// HandleConfig handles GET /api/v1/config and POST /api/v1/config
func (h *APIHandler) HandleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetConfig(w, r)
	case http.MethodPost:
		h.UpdateConfig(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// GetConfig handles GET /api/v1/config
func (h *APIHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config := h.collector.GetConfig()
	
	response := ConfigResponse{
		CollectorID:       config.CollectorID,
		Name:              config.Name,
		PlatformURL:       config.Auth.PlatformEndpoint,
		AgentID:           config.CollectorID,
		AccessToken:       config.Auth.SecretKey,
		HeartbeatInterval: config.HeartbeatInterval,
		BufferSize:        config.Buffer.MaxSize,
		SyncInterval:      config.Buffer.FlushInterval,
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode config response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// UpdateConfig handles POST /api/v1/config
func (h *APIHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req ConfigUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("Failed to decode config request", "error", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Validate required fields
	if req.PlatformURL == "" {
		http.Error(w, "Platform URL is required", http.StatusBadRequest)
		return
	}
	if req.AgentID == "" {
		http.Error(w, "Agent ID is required", http.StatusBadRequest)
		return
	}
	if req.AccessToken == "" {
		http.Error(w, "Access Token is required", http.StatusBadRequest)
		return
	}
	
	// Update configuration
	config := h.collector.GetConfig()
	config.Auth.PlatformEndpoint = req.PlatformURL
	config.CollectorID = req.AgentID
	config.Auth.CollectorID = req.AgentID
	config.Auth.SecretKey = req.AccessToken
	if req.BufferSize > 0 {
		config.Buffer.MaxSize = req.BufferSize
	}
	if req.SyncInterval > 0 {
		config.Buffer.FlushInterval = req.SyncInterval
	}
	
	// Save configuration to file
	if err := h.saveConfigToFile(config); err != nil {
		h.logger.Error("Failed to save config", "error", err)
		http.Error(w, "Failed to save configuration", http.StatusInternalServerError)
		return
	}
	
	response := map[string]interface{}{
		"success": true,
		"message": "Configuration saved successfully",
		"timestamp": time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// saveConfigToFile saves configuration to config.json
func (h *APIHandler) saveConfigToFile(config interface{}) error {
	data, err := json.MarshalIndent(config, "", "    ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	
	if err := os.WriteFile("config.json", data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}
	
	return nil
}

// TestConnection handles GET /api/v1/config/test
func (h *APIHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var platformURL string
	if r.Method == http.MethodPost {
		var req struct {
			PlatformURL string `json:"platform_url"`
		}
		body, err := io.ReadAll(r.Body)
		if err == nil && len(body) > 0 {
			json.Unmarshal(body, &req)
			platformURL = req.PlatformURL
		}
	}
	
	// If no URL provided in request, use current config
	if platformURL == "" {
		config := h.collector.GetConfig()
		platformURL = config.Auth.PlatformEndpoint
	}
	
	// Perform connection test
	success := false
	message := "Connection failed"
	
	if platformURL != "" {
		// Try to connect to the platform
		client := &http.Client{
			Timeout: 10 * time.Second,
		}
		resp, err := client.Get(platformURL + "/api/v1/health")
		if err != nil {
			message = fmt.Sprintf("Connection failed: %v", err)
		} else {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				success = true
				message = "Connection successful"
			} else {
				message = fmt.Sprintf("Platform returned status: %d", resp.StatusCode)
			}
		}
	} else {
		message = "Platform URL not configured"
	}
	
	response := ConnectionTestResponse{
		Success:   success,
		Message:   message,
		Timestamp: time.Now().Unix(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetHealth handles GET /api/v1/health
func (h *APIHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]interface{}{
		"status":  "healthy",
		"service": "ProDB Collector",
		"time":    time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}