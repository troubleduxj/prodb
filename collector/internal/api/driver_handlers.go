package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
)

// DriverHandler handles driver management API requests
type DriverHandler struct {
	protocolManager *protocol.ProtocolManager
	logger          *logger.Logger
	driversPath     string
}

// NewDriverHandler creates a new driver handler
func NewDriverHandler(protocolManager *protocol.ProtocolManager, logger *logger.Logger) *DriverHandler {
	return &DriverHandler{
		protocolManager: protocolManager,
		logger:          logger,
		driversPath:     "./drivers", // Default drivers directory
	}
}

// DriverInfo represents driver information
type DriverInfo struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	Version          string                 `json:"version"`
	Protocol         string                 `json:"protocol"`
	Status           string                 `json:"status"` // loaded, unloaded, error
	Description      string                 `json:"description"`
	Author           string                 `json:"author"`
	SupportedFeatures []string              `json:"supportedFeatures"`
	ConfigSchema     map[string]interface{} `json:"configSchema"`
	LastUpdated      time.Time              `json:"lastUpdated"`
	FilePath         string                 `json:"filePath"`
}

// DriverLoadRequest represents a driver load request
type DriverLoadRequest struct {
	DriverID string `json:"driverId"`
}

// DriverLoadResponse represents a driver load response
type DriverLoadResponse struct {
	Success   bool     `json:"success"`
	DriverID  string   `json:"driverId"`
	Error     string   `json:"error,omitempty"`
	Warnings  []string `json:"warnings,omitempty"`
}

// DriverInstallRequest represents a driver installation request
type DriverInstallRequest struct {
	DriverFile string `json:"driverFile"` // Base64 encoded driver content
	FileName   string `json:"fileName"`
}

// DriverInstallResponse represents a driver installation response
type DriverInstallResponse struct {
	Success    bool   `json:"success"`
	DriverID   string `json:"driverId"`
	FilePath   string `json:"filePath"`
	Error      string `json:"error,omitempty"`
	Installed  bool   `json:"installed"`
}

// DriverVersionInfo represents driver version information
type DriverVersionInfo struct {
	CurrentVersion   string    `json:"currentVersion"`
	LatestVersion    string    `json:"latestVersion"`
	UpdateAvailable bool      `json:"updateAvailable"`
	ReleaseDate      time.Time `json:"releaseDate"`
	ChangeLog        []string  `json:"changeLog"`
}

// DriverCompatibilityInfo represents driver compatibility information
type DriverCompatibilityInfo struct {
	Compatible       bool     `json:"compatible"`
	RequiredVersion  string   `json:"requiredVersion"`
	CurrentVersion   string   `json:"currentVersion"`
	Issues           []string `json:"issues"`
	Recommendations  []string `json:"recommendations"`
}

// GetDrivers handles GET /api/v1/drivers
func (h *DriverHandler) GetDrivers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	drivers := h.getAvailableDrivers()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(drivers); err != nil {
		h.logger.Error("Failed to encode drivers response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// LoadDriver handles POST /api/v1/drivers/load
func (h *DriverHandler) LoadDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request DriverLoadRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response := h.loadDriver(request.DriverID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode driver load response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// UnloadDriver handles POST /api/v1/drivers/unload
func (h *DriverHandler) UnloadDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request DriverLoadRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response := h.unloadDriver(request.DriverID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode driver unload response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// InstallDriver handles POST /api/v1/drivers/install
func (h *DriverHandler) InstallDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request DriverInstallRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response := h.installDriver(request)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode driver install response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// GetDriverVersions handles GET /api/v1/drivers/{id}/versions
func (h *DriverHandler) GetDriverVersions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract driver ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	driverID := pathParts[4]

	versionInfo := h.getDriverVersionInfo(driverID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(versionInfo); err != nil {
		h.logger.Error("Failed to encode driver versions response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// CheckDriverCompatibility handles GET /api/v1/drivers/{id}/compatibility
func (h *DriverHandler) CheckDriverCompatibility(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract driver ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}
	driverID := pathParts[4]

	compatibilityInfo := h.checkDriverCompatibility(driverID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(compatibilityInfo); err != nil {
		h.logger.Error("Failed to encode driver compatibility response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// getAvailableDrivers returns a list of available drivers
func (h *DriverHandler) getAvailableDrivers() []DriverInfo {
	// This is a simplified implementation
	// In a real system, you would scan the drivers directory and load driver metadata
	
	drivers := []DriverInfo{
		{
			ID:          "opcua-driver-v1",
			Name:        "OPC UA Driver",
			Version:     "1.2.3",
			Protocol:    "OPC_UA",
			Status:      "loaded",
			Description: "Standard OPC UA protocol driver",
			Author:      "ProDB Team",
			SupportedFeatures: []string{"read", "write", "subscribe", "browse"},
			ConfigSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"endpoint": map[string]interface{}{
						"type": "string",
					},
					"securityPolicy": map[string]interface{}{
						"type": "string",
						"enum": []string{"None", "Basic128Rsa15"},
					},
				},
			},
			LastUpdated: time.Now().AddDate(0, 0, -10),
			FilePath:    "/drivers/opcua-driver.js",
		},
		{
			ID:          "modbus-tcp-driver-v1",
			Name:        "Modbus TCP Driver",
			Version:     "2.1.0",
			Protocol:    "MODBUS_TCP",
			Status:      "loaded",
			Description: "Modbus TCP protocol driver",
			Author:      "ProDB Team",
			SupportedFeatures: []string{"read", "write"},
			ConfigSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"host": map[string]interface{}{
						"type": "string",
					},
					"port": map[string]interface{}{
						"type": "integer",
						"default": 502,
					},
					"slaveId": map[string]interface{}{
						"type": "integer",
					},
				},
			},
			LastUpdated: time.Now().AddDate(0, 0, -5),
			FilePath:    "/drivers/modbus-tcp-driver.js",
		},
		{
			ID:          "mqtt-driver-v1",
			Name:        "MQTT Driver",
			Version:     "1.5.2",
			Protocol:    "MQTT",
			Status:      "loaded",
			Description: "MQTT protocol driver",
			Author:      "ProDB Team",
			SupportedFeatures: []string{"subscribe", "publish"},
			ConfigSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"broker": map[string]interface{}{
						"type": "string",
					},
					"port": map[string]interface{}{
						"type": "integer",
						"default": 1883,
					},
					"clientId": map[string]interface{}{
						"type": "string",
					},
				},
			},
			LastUpdated: time.Now().AddDate(0, 0, -2),
			FilePath:    "/drivers/mqtt-driver.js",
		},
	}

	return drivers
}

// loadDriver loads a driver by ID
func (h *DriverHandler) loadDriver(driverID string) DriverLoadResponse {
	h.logger.Info("Loading driver", "driver_id", driverID)
	
	// Simulate driver loading
	// In a real implementation, you would:
	// 1. Find the driver file
	// 2. Load and validate the driver
	// 3. Register it with the protocol manager
	
	switch driverID {
	case "opcua-driver-v1", "modbus-tcp-driver-v1", "mqtt-driver-v1":
		return DriverLoadResponse{
			Success:  true,
			DriverID: driverID,
		}
	default:
		return DriverLoadResponse{
			Success:  false,
			DriverID: driverID,
			Error:    fmt.Sprintf("Driver not found: %s", driverID),
		}
	}
}

// unloadDriver unloads a driver by ID
func (h *DriverHandler) unloadDriver(driverID string) DriverLoadResponse {
	h.logger.Info("Unloading driver", "driver_id", driverID)
	
	// Simulate driver unloading
	// In a real implementation, you would:
	// 1. Stop all tasks using this driver
	// 2. Unregister the driver from the protocol manager
	// 3. Clean up resources
	
	return DriverLoadResponse{
		Success:  true,
		DriverID: driverID,
	}
}

// installDriver installs a new driver
func (h *DriverHandler) installDriver(request DriverInstallRequest) DriverInstallResponse {
	h.logger.Info("Installing driver", "filename", request.FileName)
	
	// Create drivers directory if it doesn't exist
	if err := os.MkdirAll(h.driversPath, 0755); err != nil {
		return DriverInstallResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create drivers directory: %v", err),
		}
	}
	
	// Generate driver ID from filename
	driverID := strings.TrimSuffix(request.FileName, filepath.Ext(request.FileName))
	filePath := filepath.Join(h.driversPath, request.FileName)
	
	// In a real implementation, you would:
	// 1. Decode the base64 driver file
	// 2. Validate the driver format and signature
	// 3. Check for conflicts with existing drivers
	// 4. Save the driver file
	// 5. Load and register the driver
	
	// Simulate successful installation
	return DriverInstallResponse{
		Success:   true,
		DriverID:  driverID,
		FilePath:  filePath,
		Installed: true,
	}
}

// getDriverVersionInfo returns version information for a driver
func (h *DriverHandler) getDriverVersionInfo(driverID string) DriverVersionInfo {
	// Simulate version check
	// In a real implementation, you would check against a driver repository
	
	return DriverVersionInfo{
		CurrentVersion:   "1.2.3",
		LatestVersion:    "1.3.0",
		UpdateAvailable: true,
		ReleaseDate:      time.Now().AddDate(0, 0, -7),
		ChangeLog: []string{
			"Fixed connection timeout issues",
			"Added support for new data types",
			"Improved error handling",
		},
	}
}

// checkDriverCompatibility checks driver compatibility
func (h *DriverHandler) checkDriverCompatibility(driverID string) DriverCompatibilityInfo {
	// Simulate compatibility check
	// In a real implementation, you would check:
	// 1. Collector version compatibility
	// 2. Operating system compatibility
	// 3. Dependency requirements
	// 4. Configuration schema compatibility
	
	return DriverCompatibilityInfo{
		Compatible:      true,
		RequiredVersion: "1.0.0",
		CurrentVersion:  "1.2.3",
		Issues:          []string{},
		Recommendations: []string{
			"Consider updating to the latest version for improved performance",
		},
	}
}

// UploadDriverFile handles file upload for driver installation
func (h *DriverHandler) UploadDriverFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("driver")
	if err != nil {
		http.Error(w, "Failed to get file from form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create drivers directory if it doesn't exist
	if err := os.MkdirAll(h.driversPath, 0755); err != nil {
		http.Error(w, "Failed to create drivers directory", http.StatusInternalServerError)
		return
	}

	// Create destination file
	filePath := filepath.Join(h.driversPath, header.Filename)
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to create destination file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy uploaded file to destination
	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Generate driver ID
	driverID := strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))

	response := DriverInstallResponse{
		Success:   true,
		DriverID:  driverID,
		FilePath:  filePath,
		Installed: true,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Error("Failed to encode driver upload response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	h.logger.Info("Driver file uploaded successfully", "filename", header.Filename, "path", filePath)
}

// RegisterDriverRoutes registers driver management API routes
func (h *DriverHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/drivers", h.GetDrivers)
	mux.HandleFunc("/api/v1/drivers/load", h.LoadDriver)
	mux.HandleFunc("/api/v1/drivers/unload", h.UnloadDriver)
	mux.HandleFunc("/api/v1/drivers/install", h.InstallDriver)
	mux.HandleFunc("/api/v1/drivers/upload", h.UploadDriverFile)
	
	// Note: These routes with path parameters would need a more sophisticated router
	// For now, they're handled in the individual methods by parsing the URL path
	mux.HandleFunc("/api/v1/drivers/", func(w http.ResponseWriter, r *http.Request) {
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) >= 6 {
			switch pathParts[5] {
			case "versions":
				h.GetDriverVersions(w, r)
			case "compatibility":
				h.CheckDriverCompatibility(w, r)
			default:
				http.NotFound(w, r)
			}
		} else {
			http.NotFound(w, r)
		}
	})
}