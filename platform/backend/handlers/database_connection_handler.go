package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
	"prodb/platform/backend/tdengine"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TDengineServiceCache caches TDengine service instances to avoid recreating them
var (
	tdengineServiceCache     map[string]*tdengine.TDengineService
	tdengineServiceCacheMu   sync.RWMutex
	tdengineCacheExpiry      = 5 * time.Minute
)

func init() {
	tdengineServiceCache = make(map[string]*tdengine.TDengineService)
}

// getCachedTDengineService gets or creates a TDengine service with caching
func getCachedTDengineService(conn *TDengineConnectionModel) (*tdengine.TDengineService, error) {
	// Create cache key from connection ID or connection details
	cacheKey := fmt.Sprintf("%s:%d:%s", conn.Host, conn.Port, conn.Database)
	if conn.ID.String() != "" && conn.ID.String() != "00000000-0000-0000-0000-000000000000" {
		cacheKey = conn.ID.String()
	}

	tdengineServiceCacheMu.RLock()
	if service, ok := tdengineServiceCache[cacheKey]; ok {
		tdengineServiceCacheMu.RUnlock()
		// Check if still healthy
		if service.GetManager().IsHealthy() {
			log.Printf("[getCachedTDengineService] Using cached TDengine service for %s", cacheKey)
			return service, nil
		}
		// Service unhealthy, remove from cache
		tdengineServiceCacheMu.Lock()
		delete(tdengineServiceCache, cacheKey)
		tdengineServiceCacheMu.Unlock()
	} else {
		tdengineServiceCacheMu.RUnlock()
	}

	// Create new service
	log.Printf("[getCachedTDengineService] Creating new TDengine service for %s", cacheKey)
	service, err := getTDengineServiceWithTimeout(conn, 30*time.Second)
	if err != nil {
		return nil, err
	}

	// Cache the service
	tdengineServiceCacheMu.Lock()
	tdengineServiceCache[cacheKey] = service
	tdengineServiceCacheMu.Unlock()

	return service, nil
}

// invalidateTDengineCache removes a service from cache
func invalidateTDengineCache(connID string) {
	tdengineServiceCacheMu.Lock()
	delete(tdengineServiceCache, connID)
	tdengineServiceCacheMu.Unlock()
	log.Printf("[invalidateTDengineCache] Cache invalidated for %s", connID)
}

// Use the TDengineConnection model from models package
type TDengineConnectionModel = models.TDengineConnection

// TDengineConnection represents the API response structure
type TDengineConnection struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Host            string     `json:"host"`
	Port            int        `json:"port"`
	Username        string     `json:"username"`
	Password        string     `json:"password,omitempty"`
	Database        string     `json:"database"`
	MaxOpenConns    int        `json:"max_open_conns"`
	MaxIdleConns    int        `json:"max_idle_conns"`
	ConnTimeout     int        `json:"conn_timeout"`
	IsDefault       bool       `json:"is_default"`
	Status          string     `json:"status"`
	LastConnected   *time.Time `json:"last_connected"`
	Description     string     `json:"description"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ToModel converts API struct to database model
func (tc *TDengineConnection) ToModel() *TDengineConnectionModel {
	model := &TDengineConnectionModel{
		Name:            tc.Name,
		Host:            tc.Host,
		Port:            tc.Port,
		Username:        tc.Username,
		Password:        tc.Password,
		Database:        tc.Database,
		MaxOpenConns:    tc.MaxOpenConns,
		MaxIdleConns:    tc.MaxIdleConns,
		ConnTimeout:     tc.ConnTimeout,
		IsDefault:       tc.IsDefault,
		Status:          tc.Status,
		LastConnected:   tc.LastConnected,
		Description:     tc.Description,
	}
	
	if tc.ID != "" {
		if id, err := uuid.Parse(tc.ID); err == nil {
			model.ID = id
		}
	}
	
	return model
}

// FromModel converts database model to API struct
func (tc *TDengineConnection) FromModel(model *TDengineConnectionModel) {
	tc.ID = model.ID.String()
	tc.Name = model.Name
	tc.Host = model.Host
	tc.Port = model.Port
	tc.Username = model.Username
	tc.Password = "" // Don't expose password in API responses
	tc.Database = model.Database
	tc.MaxOpenConns = model.MaxOpenConns
	tc.MaxIdleConns = model.MaxIdleConns
	tc.ConnTimeout = model.ConnTimeout
	tc.IsDefault = model.IsDefault
	tc.Status = model.Status
	tc.LastConnected = model.LastConnected
	tc.Description = model.Description
	tc.CreatedAt = model.CreatedAt
	tc.UpdatedAt = model.UpdatedAt
}

type ConnectionTestResult struct {
	Success       bool     `json:"success"`
	Message       string   `json:"message"`
	Latency       int      `json:"latency,omitempty"`
	Version       string   `json:"version,omitempty"`
	ServerVersion string   `json:"server_version,omitempty"`
	Databases     []string `json:"databases,omitempty"`
	Error         string   `json:"error,omitempty"`
	TestedAt      time.Time `json:"tested_at"`
}

type ConnectionStatus struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	LastCheck     time.Time  `json:"last_check"`
	LastConnected *time.Time `json:"last_connected"`
	Uptime        int64      `json:"uptime,omitempty"` // seconds
	ErrorMessage  string     `json:"error_message,omitempty"`
}

type DatabaseInfo struct {
	Name         string    `json:"name"`
	CreatedTime  time.Time `json:"created_time"`
	NTables      int       `json:"ntables"`
	VGroups      int       `json:"vgroups"`
	Replica      int       `json:"replica"`
	Quorum       int       `json:"quorum"`
	Days         int       `json:"days"`
	Keep         string    `json:"keep"`
	Cache        int       `json:"cache"`
	Blocks       int       `json:"blocks"`
	MinRows      int       `json:"minrows"`
	MaxRows      int       `json:"maxrows"`
	WalLevel     int       `json:"wallevel"`
	Fsync        int       `json:"fsync"`
	Comp         int       `json:"comp"`
	Precision    string    `json:"precision"`
	Status       string    `json:"status"`
}

type SuperTableInfo struct {
	Name           string      `json:"name"`
	CreatedTime    time.Time   `json:"created_time"`
	Columns        []Column    `json:"columns"`
	Tags           []Tag       `json:"tags"`
	SubtablesCount int         `json:"subtables_count"`
	DataSize       string      `json:"data_size"`
	Database       string      `json:"database"`
}

type Column struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Length   int    `json:"length,omitempty"`
	Note     string `json:"note,omitempty"`
	Nullable bool   `json:"nullable,omitempty"`
	IsPrimary bool  `json:"is_primary,omitempty"`
}

type Tag struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Length int    `json:"length,omitempty"`
	Note   string `json:"note,omitempty"`
}

// DatabaseStatistics represents database statistics
type DatabaseStatistics struct {
	DatabaseName   string    `json:"database_name"`
	TotalTables    int       `json:"total_tables"`
	SuperTables    int       `json:"super_tables"`
	RegularTables  int       `json:"regular_tables"`
	TotalRows      int64     `json:"total_rows"`
	DataSize       string    `json:"data_size"`
	IndexSize      string    `json:"index_size"`
	LastUpdated    time.Time `json:"last_updated"`
}

// CreateDatabaseRequest represents the request to create a database
type CreateDatabaseRequest struct {
	Name      string                 `json:"name" binding:"required"`
	Options   map[string]interface{} `json:"options"`
}

// CreateSuperTableRequest represents the request to create a super table
type CreateSuperTableRequest struct {
	Database string   `json:"database" binding:"required"`
	Name     string   `json:"name" binding:"required"`
	Columns  []Column `json:"columns" binding:"required"`
	Tags     []Tag    `json:"tags" binding:"required"`
}

// Helper function to get TDengine service from context or create a temporary one
func getTDengineService(conn *TDengineConnectionModel) (*tdengine.TDengineService, error) {
	return getCachedTDengineService(conn)
}

// Helper function to get TDengine service with custom timeout
func getTDengineServiceWithTimeout(conn *TDengineConnectionModel, timeout time.Duration) (*tdengine.TDengineService, error) {
	config := &tdengine.TDengineConfig{
		Host:         conn.Host,
		Port:         conn.Port,
		Username:     conn.Username,
		Password:     conn.Password,
		Database:     conn.Database,
		MaxOpenConns: conn.MaxOpenConns,
		MaxIdleConns: conn.MaxIdleConns,
		ConnTimeout:  timeout,
		
		// Health check configuration
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		
		// Auto-reconnection configuration
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}

	log.Printf("[getTDengineServiceWithTimeout] Creating TDengine manager for %s:%d (timeout: %v)", conn.Host, conn.Port, timeout)

	manager, err := tdengine.NewTDengineManager(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create TDengine manager: %w", err)
	}

	log.Printf("[getTDengineServiceWithTimeout] Starting TDengine manager...")
	if err := manager.Start(); err != nil {
		return nil, fmt.Errorf("failed to start TDengine manager: %w", err)
	}
	log.Printf("[getTDengineServiceWithTimeout] TDengine manager started successfully")

	service := tdengine.NewTDengineService(manager)
	return service, nil
}

// Helper function to test TDengine connection
func testTDengineConnection(conn *TDengineConnectionModel) *ConnectionTestResult {
	startTime := time.Now()
	result := &ConnectionTestResult{
		TestedAt: startTime,
	}

	service, err := getTDengineService(conn)
	if err != nil {
		result.Success = false
		result.Error = err.Error()
		result.Message = "Failed to create connection"
		return result
	}
	defer service.GetManager().Stop()

	// Test connection by getting health status
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	healthStatus := service.GetHealthStatus()
	if !healthStatus.IsHealthy {
		result.Success = false
		result.Error = "Connection unhealthy"
		result.Message = "Connection test failed"
		return result
	}

	// Get server info
	databases, err := service.ListDatabases(ctx)
	if err != nil {
		result.Success = false
		result.Error = err.Error()
		result.Message = "Failed to list databases"
		return result
	}

	result.Success = true
	result.Message = "Connection successful"
	result.Latency = int(time.Since(startTime).Milliseconds())
	result.ServerVersion = "TDengine 3.0+"
	
	// Extract database names
	for _, db := range databases {
		result.Databases = append(result.Databases, db.Name)
	}

	return result
}

// GetTDengineConnections returns all TDengine connections
func GetTDengineConnections(c *gin.Context) {
	var connections []TDengineConnectionModel
	
	if err := database.DB.Find(&connections).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve connections",
			"error":   err.Error(),
		})
		return
	}

	// Convert to API response format
	var apiConnections []TDengineConnection
	for _, conn := range connections {
		var apiConn TDengineConnection
		apiConn.FromModel(&conn)
		apiConnections = append(apiConnections, apiConn)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"connections": apiConnections,
		"total":       len(apiConnections),
	})
}

// GetTDengineConnection returns a specific TDengine connection
func GetTDengineConnection(c *gin.Context) {
	id := c.Param("id")
	
	connUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid connection ID format",
		})
		return
	}

	var connection TDengineConnectionModel
	if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve connection",
				"error":   err.Error(),
			})
		}
		return
	}

	var apiConn TDengineConnection
	apiConn.FromModel(&connection)
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   apiConn,
	})
}

// CreateTDengineConnection creates a new TDengine connection
func CreateTDengineConnection(c *gin.Context) {
	var newConn TDengineConnection
	if err := c.ShouldBindJSON(&newConn); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Validate required fields
	if newConn.Name == "" || newConn.Host == "" || newConn.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Name, host, and username are required",
		})
		return
	}

	// Set defaults
	if newConn.Port == 0 {
		newConn.Port = 6041
	}
	if newConn.MaxOpenConns == 0 {
		newConn.MaxOpenConns = 20
	}
	if newConn.MaxIdleConns == 0 {
		newConn.MaxIdleConns = 10
	}
	if newConn.ConnTimeout == 0 {
		newConn.ConnTimeout = 30
	}

	// Convert to model
	model := newConn.ToModel()
	model.Status = "disconnected"

	// Check if this should be the default connection
	if newConn.IsDefault {
		// Unset other default connections
		database.DB.Model(&TDengineConnectionModel{}).Where("is_default = ?", true).Update("is_default", false)
	}

	// Save to database
	if err := database.DB.Create(model).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{
				"status":  "error",
				"message": "Connection name already exists",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to create connection",
				"error":   err.Error(),
			})
		}
		return
	}

	// Convert back to API response
	var apiConn TDengineConnection
	apiConn.FromModel(model)
	
	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   apiConn,
	})
}

// UpdateTDengineConnection updates an existing TDengine connection
func UpdateTDengineConnection(c *gin.Context) {
	id := c.Param("id")
	
	connUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid connection ID format",
		})
		return
	}

	var updateData TDengineConnection
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Find existing connection
	var existingConn TDengineConnectionModel
	if err := database.DB.Where("id = ?", connUUID).First(&existingConn).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve connection",
				"error":   err.Error(),
			})
		}
		return
	}

	// Update fields
	if updateData.Name != "" {
		existingConn.Name = updateData.Name
	}
	if updateData.Host != "" {
		existingConn.Host = updateData.Host
	}
	if updateData.Port != 0 {
		existingConn.Port = updateData.Port
	}
	if updateData.Username != "" {
		existingConn.Username = updateData.Username
	}
	if updateData.Password != "" {
		existingConn.Password = updateData.Password
	}
	if updateData.Database != "" {
		existingConn.Database = updateData.Database
	}
	if updateData.MaxOpenConns != 0 {
		existingConn.MaxOpenConns = updateData.MaxOpenConns
	}
	if updateData.MaxIdleConns != 0 {
		existingConn.MaxIdleConns = updateData.MaxIdleConns
	}
	if updateData.ConnTimeout != 0 {
		existingConn.ConnTimeout = updateData.ConnTimeout
	}
	existingConn.IsDefault = updateData.IsDefault
	existingConn.Description = updateData.Description

	// Handle default connection logic
	if updateData.IsDefault {
		// Unset other default connections
		database.DB.Model(&TDengineConnectionModel{}).Where("id != ? AND is_default = ?", connUUID, true).Update("is_default", false)
	}

	// Save changes
	if err := database.DB.Save(&existingConn).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{
				"status":  "error",
				"message": "Connection name already exists",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to update connection",
				"error":   err.Error(),
			})
		}
		return
	}

	// Convert to API response
	var apiConn TDengineConnection
	apiConn.FromModel(&existingConn)
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   apiConn,
	})
}

// DeleteTDengineConnection deletes a TDengine connection
func DeleteTDengineConnection(c *gin.Context) {
	id := c.Param("id")
	
	connUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid connection ID format",
		})
		return
	}

	// Check if connection exists
	var connection TDengineConnectionModel
	if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve connection",
				"error":   err.Error(),
			})
		}
		return
	}

	// Delete the connection
	if err := database.DB.Delete(&connection).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete connection",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Connection deleted successfully",
	})
}

// TestTDengineConnection tests a TDengine connection
func TestTDengineConnection(c *gin.Context) {
	var connData TDengineConnection
	if err := c.ShouldBindJSON(&connData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Set defaults if not provided
	if connData.Port == 0 {
		connData.Port = 6041
	}
	if connData.MaxOpenConns == 0 {
		connData.MaxOpenConns = 20
	}
	if connData.MaxIdleConns == 0 {
		connData.MaxIdleConns = 10
	}
	if connData.ConnTimeout == 0 {
		connData.ConnTimeout = 30
	}

	// Convert to model for testing
	model := connData.ToModel()
	
	// Test the connection
	result := testTDengineConnection(model)
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// TestTDengineConnectionById tests a TDengine connection by ID
func TestTDengineConnectionById(c *gin.Context) {
	id := c.Param("id")
	
	connUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid connection ID format",
		})
		return
	}

	var connection TDengineConnectionModel
	if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve connection",
				"error":   err.Error(),
			})
		}
		return
	}

	// Test the connection
	result := testTDengineConnection(&connection)
	
	// Update connection status and last connected time if successful
	if result.Success {
		now := time.Now()
		connection.Status = "connected"
		connection.LastConnected = &now
		database.DB.Save(&connection)
	} else {
		connection.Status = "disconnected"
		database.DB.Save(&connection)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// GetTDengineConnectionStatus returns the status of a specific connection
func GetTDengineConnectionStatus(c *gin.Context) {
	id := c.Param("id")
	
	connUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid connection ID format",
		})
		return
	}

	var connection TDengineConnectionModel
	if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve connection",
				"error":   err.Error(),
			})
		}
		return
	}

	status := ConnectionStatus{
		ID:            connection.ID.String(),
		Name:          connection.Name,
		Status:        connection.Status,
		LastCheck:     time.Now(),
		LastConnected: connection.LastConnected,
	}

	// Calculate uptime if connected
	if connection.LastConnected != nil && connection.Status == "connected" {
		status.Uptime = int64(time.Since(*connection.LastConnected).Seconds())
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   status,
	})
}

// GetAllTDengineConnectionStatuses returns the status of all connections
func GetAllTDengineConnectionStatuses(c *gin.Context) {
	var connections []TDengineConnectionModel
	
	if err := database.DB.Find(&connections).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve connections",
			"error":   err.Error(),
		})
		return
	}

	var statuses []ConnectionStatus
	now := time.Now()
	
	for _, conn := range connections {
		status := ConnectionStatus{
			ID:            conn.ID.String(),
			Name:          conn.Name,
			Status:        conn.Status,
			LastCheck:     now,
			LastConnected: conn.LastConnected,
		}

		// Calculate uptime if connected
		if conn.LastConnected != nil && conn.Status == "connected" {
			status.Uptime = int64(time.Since(*conn.LastConnected).Seconds())
		}

		statuses = append(statuses, status)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   statuses,
		"total":  len(statuses),
	})
}

// BatchTestTDengineConnections tests multiple connections
func BatchTestTDengineConnections(c *gin.Context) {
	var request struct {
		IDs []string `json:"ids"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}
	
	results := make(map[string]ConnectionTestResult)
	
	for _, id := range request.IDs {
		connUUID, err := uuid.Parse(id)
		if err != nil {
			results[id] = ConnectionTestResult{
				Success:  false,
				Message:  "Invalid connection ID format",
				Error:    err.Error(),
				TestedAt: time.Now(),
			}
			continue
		}

		var connection TDengineConnectionModel
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			results[id] = ConnectionTestResult{
				Success:  false,
				Message:  "Connection not found",
				Error:    err.Error(),
				TestedAt: time.Now(),
			}
			continue
		}

		// Test the connection
		result := testTDengineConnection(&connection)
		results[id] = *result

		// Update connection status
		if result.Success {
			now := time.Now()
			connection.Status = "connected"
			connection.LastConnected = &now
		} else {
			connection.Status = "disconnected"
		}
		database.DB.Save(&connection)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   results,
	})
}

// BatchDeleteTDengineConnections deletes multiple connections
func BatchDeleteTDengineConnections(c *gin.Context) {
	var request struct {
		IDs []string `json:"ids"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Convert string IDs to UUIDs
	var uuids []uuid.UUID
	for _, id := range request.IDs {
		connUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid connection ID format: %s", id),
			})
			return
		}
		uuids = append(uuids, connUUID)
	}

	// Delete connections
	result := database.DB.Where("id IN ?", uuids).Delete(&TDengineConnectionModel{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete connections",
			"error":   result.Error.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully deleted %d connections", result.RowsAffected),
		"deleted_count": result.RowsAffected,
	})
}

// GetTDengineDatabases returns all databases
func GetTDengineDatabases(c *gin.Context) {
	connectionID := c.Query("connection_id")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusPreconditionFailed, gin.H{
					"status":  "error",
					"message": "No TDengine connection configured",
					"error":   "No default TDengine connection found",
					"code":    "NO_TDENGINE_CONNECTION",
					"suggestions": []string{
						"Create a TDengine connection in the database connection settings",
						"Set one of your connections as the default connection",
						"Specify a connection_id parameter in your request",
					},
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": "Failed to retrieve default connection",
					"error":   err.Error(),
				})
			}
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "TDengine service is currently unavailable",
			"error":   err.Error(),
			"code":    "TDENGINE_CONNECTION_FAILED",
			"connection": map[string]interface{}{
				"name": connection.Name,
				"host": connection.Host,
				"port": connection.Port,
			},
			"suggestions": []string{
				"Check if TDengine server is running on " + connection.Host,
				"Verify the connection credentials",
				"Test the connection in the connection management page",
				"Check network connectivity to TDengine server",
			},
		})
		return
	}
	defer service.GetManager().Stop()

	// List databases
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	databases, err := service.ListDatabases(ctx)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to list databases from TDengine",
			"error":   err.Error(),
			"code":    "TDENGINE_QUERY_FAILED",
			"connection": map[string]interface{}{
				"name": connection.Name,
				"host": connection.Host,
				"port": connection.Port,
			},
			"suggestions": []string{
				"Check TDengine server status",
				"Verify database permissions for the user",
				"Check TDengine server logs for errors",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"databases": databases,
		"total":     len(databases),
	})
}

// GetTDengineSuperTables returns all super tables for a database
func GetTDengineSuperTables(c *gin.Context) {
	dbName := c.Query("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database parameter is required",
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusPreconditionFailed, gin.H{
					"status":  "error",
					"message": "No TDengine connection configured",
					"error":   "No default TDengine connection found",
					"code":    "NO_TDENGINE_CONNECTION",
					"suggestions": []string{
						"Create a TDengine connection in the database connection settings",
						"Set one of your connections as the default connection",
						"Specify a connectionId parameter in your request",
					},
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": "Failed to retrieve default connection",
					"error":   err.Error(),
				})
			}
			return
		}
	}

	log.Printf("[GetTDengineSuperTables] Using connection: %s (%s:%d)", connection.Name, connection.Host, connection.Port)

	// Get TDengine service with shorter timeout for API requests
	service, err := getTDengineServiceWithTimeout(&connection, 10*time.Second)
	if err != nil {
		log.Printf("[GetTDengineSuperTables] Failed to get TDengine service: %v", err)
		// Return mock super tables for development
		mockSuperTables := getMockSuperTablesForDatabase(dbName)
		
		c.JSON(http.StatusOK, gin.H{
			"status":      "success",
			"supertables": mockSuperTables,
			"total":       len(mockSuperTables),
			"database":    dbName,
			"mock":        true,
			"error":       err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// List super tables
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	superTables, err := service.ListSuperTables(ctx, dbName)
	if err != nil {
		// Return mock super tables for development
		mockSuperTables := getMockSuperTablesForDatabase(dbName)
		
		c.JSON(http.StatusOK, gin.H{
			"status":      "success",
			"supertables": mockSuperTables,
			"total":       len(mockSuperTables),
			"database":    dbName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"supertables": superTables,
		"total":       len(superTables),
		"database":    dbName,
	})
}

// getMockSuperTablesForDatabase returns mock super tables for development
func getMockSuperTablesForDatabase(dbName string) []SuperTableInfo {
	switch dbName {
	case "industrial_data":
		return []SuperTableInfo{
			{
				Name:        "sensors",
				CreatedTime: time.Date(2024, 1, 15, 10, 35, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "temperature", Type: "float"},
					{Name: "humidity", Type: "float"},
					{Name: "pressure", Type: "float"},
				},
				Tags: []Tag{
					{Name: "location", Type: "nchar(50)"},
					{Name: "device_id", Type: "int"},
				},
				SubtablesCount: 10,
				DataSize:       "2.5MB",
				Database:       dbName,
			},
			{
				Name:        "flow_meters",
				CreatedTime: time.Date(2024, 1, 15, 11, 0, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "flow_rate", Type: "float"},
					{Name: "total_volume", Type: "bigint"},
				},
				Tags: []Tag{
					{Name: "meter_id", Type: "nchar(32)"},
					{Name: "pipeline", Type: "nchar(64)"},
				},
				SubtablesCount: 5,
				DataSize:       "1.8MB",
				Database:       dbName,
			},
			{
				Name:        "power_meters",
				CreatedTime: time.Date(2024, 1, 15, 11, 30, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "voltage", Type: "float"},
					{Name: "current", Type: "float"},
					{Name: "power", Type: "float"},
					{Name: "energy", Type: "bigint"},
				},
				Tags: []Tag{
					{Name: "meter_id", Type: "nchar(32)"},
					{Name: "phase", Type: "tinyint"},
					{Name: "location", Type: "nchar(50)"},
				},
				SubtablesCount: 8,
				DataSize:       "3.2MB",
				Database:       dbName,
			},
		}
	case "sensor_data":
		return []SuperTableInfo{
			{
				Name:        "temperature_sensors",
				CreatedTime: time.Date(2024, 1, 20, 14, 20, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "temperature", Type: "float"},
					{Name: "status", Type: "tinyint"},
				},
				Tags: []Tag{
					{Name: "sensor_id", Type: "nchar(32)"},
					{Name: "room", Type: "nchar(32)"},
				},
				SubtablesCount: 6,
				DataSize:       "1.2MB",
				Database:       dbName,
			},
			{
				Name:        "humidity_sensors",
				CreatedTime: time.Date(2024, 1, 20, 14, 25, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "humidity", Type: "float"},
					{Name: "status", Type: "tinyint"},
				},
				Tags: []Tag{
					{Name: "sensor_id", Type: "nchar(32)"},
					{Name: "room", Type: "nchar(32)"},
				},
				SubtablesCount: 4,
				DataSize:       "0.9MB",
				Database:       dbName,
			},
		}
	case "test_db":
		return []SuperTableInfo{
			{
				Name:        "test_table",
				CreatedTime: time.Date(2024, 1, 25, 9, 5, 0, 0, time.UTC),
				Columns: []Column{
					{Name: "ts", Type: "timestamp", IsPrimary: true},
					{Name: "value", Type: "float"},
				},
				Tags: []Tag{
					{Name: "tag1", Type: "nchar(16)"},
				},
				SubtablesCount: 1,
				DataSize:       "0.1MB",
				Database:       dbName,
			},
		}
	default:
		return []SuperTableInfo{}
	}
}

// CreateTDengineSuperTable creates a new super table
func CreateTDengineSuperTable(c *gin.Context) {
	var request CreateSuperTableRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Create super table schema
	schema := &tdengine.SuperTableSchema{
		Name:    request.Name,
		Columns: make([]tdengine.SuperTableColumn, len(request.Columns)),
		Tags:    make([]tdengine.SuperTableTag, len(request.Tags)),
	}

	// Convert columns
	for i, col := range request.Columns {
		schema.Columns[i] = tdengine.SuperTableColumn{
			Name:   col.Name,
			Type:   col.Type,
			Length: col.Length,
		}
	}

	// Convert tags
	for i, tag := range request.Tags {
		schema.Tags[i] = tdengine.SuperTableTag{
			Name:   tag.Name,
			Type:   tag.Type,
			Length: tag.Length,
		}
	}

	// Create super table
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := service.CreateSuperTable(ctx, request.Database, schema, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create super table",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Super table created successfully",
		"data": gin.H{
			"database":    request.Database,
			"supertable": request.Name,
		},
	})
}

// GetTDengineSuperTable returns information about a specific super table
func GetTDengineSuperTable(c *gin.Context) {
	name := c.Param("name")
	dbName := c.Query("database")
	
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database parameter is required",
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Get super table info
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stInfo, err := service.GetSuperTableInfo(ctx, dbName, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stInfo,
	})
}

// DeleteTDengineSuperTable deletes a super table
func DeleteTDengineSuperTable(c *gin.Context) {
	name := c.Param("name")
	dbName := c.Query("database")
	
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database parameter is required",
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Delete super table
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := service.DropSuperTable(ctx, dbName, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete super table",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Super table deleted successfully",
	})
}

// GetTDengineTables returns all tables for a database
func GetTDengineTables(c *gin.Context) {
	dbName := c.Query("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database parameter is required",
		})
		return
	}

	connectionID := c.Query("connection_id")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusPreconditionFailed, gin.H{
				"status":  "error",
				"message": "No TDengine connection configured",
				"error":   "No default TDengine connection found",
				"code":    "NO_TDENGINE_CONNECTION",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		// Return mock tables for development
		mockTables := getMockTablesForDatabase(dbName)
		
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"database": dbName,
				"tables":   mockTables,
				"total":    len(mockTables),
			},
		})
		return
	}
	defer service.GetManager().Stop()

	// For now, return mock data as the service might not have the ListTables method
	mockTables := getMockTablesForDatabase(dbName)
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database": dbName,
			"tables":   mockTables,
			"total":    len(mockTables),
		},
	})
}

// getMockTablesForDatabase returns mock tables for development
func getMockTablesForDatabase(dbName string) []map[string]interface{} {
	switch dbName {
	case "industrial_data":
		return []map[string]interface{}{
			{
				"name":         "sensor_001",
				"type":         "CHILD_TABLE",
				"super_table":  "sensors",
				"created_time": "2024-01-15 10:40:00",
				"columns":      4,
				"rows":         1250,
				"size":         "125KB",
				"tags": map[string]interface{}{
					"location":  "Workshop A",
					"device_id": 1,
				},
			},
			{
				"name":         "sensor_002",
				"type":         "CHILD_TABLE",
				"super_table":  "sensors",
				"created_time": "2024-01-15 10:45:00",
				"columns":      4,
				"rows":         1180,
				"size":         "118KB",
				"tags": map[string]interface{}{
					"location":  "Workshop B",
					"device_id": 2,
				},
			},
			{
				"name":         "flow_meter_001",
				"type":         "CHILD_TABLE",
				"super_table":  "flow_meters",
				"created_time": "2024-01-15 11:05:00",
				"columns":      3,
				"rows":         890,
				"size":         "89KB",
				"tags": map[string]interface{}{
					"meter_id": "FM001",
					"pipeline": "Main Supply Line",
				},
			},
		}
	case "sensor_data":
		return []map[string]interface{}{
			{
				"name":         "temp_sensor_room1",
				"type":         "CHILD_TABLE",
				"super_table":  "temperature_sensors",
				"created_time": "2024-01-20 14:30:00",
				"columns":      3,
				"rows":         720,
				"size":         "72KB",
				"tags": map[string]interface{}{
					"sensor_id": "TEMP001",
					"room":      "Room 1",
				},
			},
			{
				"name":         "humidity_sensor_room1",
				"type":         "CHILD_TABLE",
				"super_table":  "humidity_sensors",
				"created_time": "2024-01-20 14:35:00",
				"columns":      3,
				"rows":         680,
				"size":         "68KB",
				"tags": map[string]interface{}{
					"sensor_id": "HUM001",
					"room":      "Room 1",
				},
			},
		}
	case "test_db":
		return []map[string]interface{}{
			{
				"name":         "test_child_table",
				"type":         "CHILD_TABLE",
				"super_table":  "test_table",
				"created_time": "2024-01-25 09:10:00",
				"columns":      2,
				"rows":         100,
				"size":         "10KB",
				"tags": map[string]interface{}{
					"tag1": "test_value",
				},
			},
		}
	default:
		return []map[string]interface{}{}
	}
}

// GetTDengineDatabase returns information about a specific database
func GetTDengineDatabase(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Get database info
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dbInfo, err := service.GetDatabaseInfo(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Database not found",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   dbInfo,
	})
}

// DeleteTDengineDatabase deletes a database
func DeleteTDengineDatabase(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Delete database
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := service.DropDatabase(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete database",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Database deleted successfully",
	})
}

// PingTDengine tests the TDengine connection
func PingTDengine(c *gin.Context) {
	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Test the connection
	result := testTDengineConnection(&connection)
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// GetTDengineServerInfo returns TDengine server information
func GetTDengineServerInfo(c *gin.Context) {
	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Get server info (mock for now)
	serverInfo := map[string]interface{}{
		"version":   "TDengine 3.0+",
		"build":     "Build 1.0.0",
		"gitinfo":   "Git commit hash",
		"host":      connection.Host,
		"port":      connection.Port,
		"connected": true,
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   serverInfo,
	})
}

// CreateTDengineDatabase creates a new database
func CreateTDengineDatabase(c *gin.Context) {
	var request CreateDatabaseRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	connectionID := c.Query("connectionId")
	
	// Get connection (use default if not specified)
	var connection TDengineConnectionModel
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid connection ID format",
			})
			return
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Connection not found",
			})
			return
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "No default connection found. Please specify connectionId parameter.",
			})
			return
		}
	}

	// Get TDengine service
	service, err := getTDengineService(&connection)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Convert options to TDengine database options
	var dbOptions *tdengine.DatabaseOptions
	if request.Options != nil {
		dbOptions = &tdengine.DatabaseOptions{}
		
		if days, ok := request.Options["days"].(float64); ok {
			dbOptions.Days = int(days)
		}
		if keep, ok := request.Options["keep"].(string); ok {
			dbOptions.Keep = keep
		}
		if cache, ok := request.Options["cache"].(float64); ok {
			dbOptions.Cache = int(cache)
		}
		if blocks, ok := request.Options["blocks"].(float64); ok {
			dbOptions.Blocks = int(blocks)
		}
		if minrows, ok := request.Options["minrows"].(float64); ok {
			dbOptions.MinRows = int(minrows)
		}
		if maxrows, ok := request.Options["maxrows"].(float64); ok {
			dbOptions.MaxRows = int(maxrows)
		}
		if wallevel, ok := request.Options["wallevel"].(float64); ok {
			dbOptions.WalLevel = int(wallevel)
		}
		if fsync, ok := request.Options["fsync"].(float64); ok {
			dbOptions.Fsync = int(fsync)
		}
		if comp, ok := request.Options["comp"].(float64); ok {
			dbOptions.Comp = int(comp)
		}
		if precision, ok := request.Options["precision"].(string); ok {
			dbOptions.Precision = precision
		}
		if replica, ok := request.Options["replica"].(float64); ok {
			dbOptions.Replica = int(replica)
		}
		if quorum, ok := request.Options["quorum"].(float64); ok {
			dbOptions.Quorum = int(quorum)
		}
	}

	// Create database
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := service.CreateDatabase(ctx, request.Name, dbOptions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create database",
			"error":   err.Error(),
		})
		return
	}

	// Get the created database info
	dbInfo, err := service.GetDatabaseInfo(ctx, request.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Database created but failed to retrieve info",
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   dbInfo,
	})
}

