package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"prodb/platform/backend/tdengine"

	"github.com/gin-gonic/gin"
)

// TDengineHandler handles TDengine-related HTTP requests
type TDengineHandler struct {
	service *tdengine.TDengineService
}

// NewTDengineHandler creates a new TDengine handler
func NewTDengineHandler(service *tdengine.TDengineService) *TDengineHandler {
	return &TDengineHandler{
		service: service,
	}
}

// GetHealthStatus returns the current health status of TDengine
func (h *TDengineHandler) GetHealthStatus(c *gin.Context) {
	status := h.service.GetHealthStatus()
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   status,
	})
}

// GetMetrics returns TDengine operation metrics
func (h *TDengineHandler) GetMetrics(c *gin.Context) {
	metrics := h.service.GetMetrics()
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   metrics,
	})
}

// ExecuteQuery executes a custom SQL query
func (h *TDengineHandler) ExecuteQuery(c *gin.Context) {
	var request struct {
		SQL      string        `json:"sql" binding:"required"`
		Database string        `json:"database"`
		Timeout  time.Duration `json:"timeout"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	// Log the received SQL for debugging
	log.Printf("[ExecuteQuery] Received SQL: %s, Database: %s", request.SQL, request.Database)

	// Set default timeout if not provided
	if request.Timeout == 0 {
		request.Timeout = 30 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), request.Timeout)
	defer cancel()

	// For this implementation, we'll use the manager directly
	// In a real application, you might want to add more validation and security checks
	manager := h.service.GetManager()
	rows, err := manager.ExecuteQuery(ctx, request.SQL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Query execution failed",
			"error":   err.Error(),
		})
		return
	}
	defer rows.Close()

	// Convert rows to JSON-friendly format
	columns, err := rows.Columns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get column information",
			"error":   err.Error(),
		})
		return
	}

	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to scan row",
				"error":   err.Error(),
			})
			return
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"columns": columns,
			"rows":    results,
			"count":   len(results),
		},
	})
}

// GetLatestData returns the latest data for specified collectors
func (h *TDengineHandler) GetLatestData(c *gin.Context) {
	collectorIDs := c.QueryArray("collector_id")
	if len(collectorIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "At least one collector_id is required",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	data, err := h.service.QueryLatestData(ctx, collectorIDs, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to query latest data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"points": data,
			"count":  len(data),
		},
	})
}

// InsertData inserts data from collectors
func (h *TDengineHandler) InsertData(c *gin.Context) {
	var request struct {
		CollectorID string                   `json:"collector_id" binding:"required"`
		DataPoints  []tdengine.DataPoint     `json:"data_points" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := h.service.InsertCollectorData(ctx, request.CollectorID, request.DataPoints)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to insert data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Data inserted successfully",
		"count":   len(request.DataPoints),
	})
}

// GetDatabases returns list of databases with detailed information
func (h *TDengineHandler) GetDatabases(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	databases, err := h.service.ListDatabases(ctx)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"databases": databases,
			"count":     len(databases),
		},
	})
}

// GetDatabaseInfo returns detailed information about a specific database
func (h *TDengineHandler) GetDatabaseInfo(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dbInfo, err := h.service.GetDatabaseInfo(ctx, dbName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Database not found",
				"error":   err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get database information",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   dbInfo,
	})
}

// CreateDatabase creates a new database with comprehensive options and validation
func (h *TDengineHandler) CreateDatabase(c *gin.Context) {
	var request struct {
		Name    string                     `json:"name" binding:"required"`
		Options *tdengine.DatabaseOptions `json:"options,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	// Validate database name
	if strings.TrimSpace(request.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name cannot be empty",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if database already exists
	exists, err := h.service.DatabaseExists(ctx, request.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	if exists {
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"message": "Database already exists",
			"name":    request.Name,
		})
		return
	}

	// Create database with options
	err = h.service.CreateDatabase(ctx, request.Name, request.Options)
	if err != nil {
		if strings.Contains(err.Error(), "invalid database options") {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid database options",
				"error":   err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create database",
			"error":   err.Error(),
		})
		return
	}

	// Get the created database info
	dbInfo, err := h.service.GetDatabaseInfo(ctx, request.Name)
	if err != nil {
		// Database was created but we couldn't get info - still success
		c.JSON(http.StatusCreated, gin.H{
			"status":  "success",
			"message": "Database created successfully",
			"name":    request.Name,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Database created successfully",
		"data":    dbInfo,
	})
}

// DropDatabase drops a database with proper validation and error handling
func (h *TDengineHandler) DropDatabase(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if database exists before attempting to drop
	exists, err := h.service.DatabaseExists(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Database not found",
			"name":    dbName,
		})
		return
	}

	// Get database info before dropping (for response)
	dbInfo, _ := h.service.GetDatabaseInfo(ctx, dbName)

	// Drop the database
	err = h.service.DropDatabase(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to drop database",
			"error":   err.Error(),
		})
		return
	}

	response := gin.H{
		"status":  "success",
		"message": "Database dropped successfully",
		"name":    dbName,
	}

	if dbInfo != nil {
		response["dropped_database_info"] = dbInfo
	}

	c.JSON(http.StatusOK, response)
}

// CheckDatabaseExists checks if a database exists
func (h *TDengineHandler) CheckDatabaseExists(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	exists, err := h.service.DatabaseExists(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"name":   dbName,
			"exists": exists,
		},
	})
}

// GetSuperTables returns list of super tables in a database
func (h *TDengineHandler) GetSuperTables(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	manager := h.service.GetManager()
	
	// Try to use the specified database and query super tables
	_, err := manager.ExecuteNonQuery(ctx, "USE "+dbName)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to use database",
			"error":   err.Error(),
		})
		return
	}

	rows, err := manager.ExecuteQuery(ctx, "SHOW STABLES")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to query super tables",
			"error":   err.Error(),
		})
		return
	}
	defer rows.Close()

	var tables []map[string]interface{}
	columns, _ := rows.Columns()
	
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		table := make(map[string]interface{})
		for i, col := range columns {
			table[col] = values[i]
		}
		tables = append(tables, table)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database":     dbName,
			"supertables": tables,
			"count":       len(tables),
		},
	})
}


// ValidateDatabaseName validates database name according to TDengine rules
func (h *TDengineHandler) ValidateDatabaseName(c *gin.Context) {
	var request struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	// Validate database name using basic validation
	isValid, errorMsg := h.validateDatabaseNameBasic(request.Name)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"name":    request.Name,
			"valid":   isValid,
			"message": errorMsg,
		},
	})
}

// validateDatabaseNameBasic performs basic database name validation
func (h *TDengineHandler) validateDatabaseNameBasic(name string) (bool, string) {
	if len(name) == 0 {
		return false, "Database name cannot be empty"
	}
	
	if len(name) > 64 {
		return false, "Database name cannot exceed 64 characters"
	}
	
	// Check for valid characters (alphanumeric and underscore)
	for i, r := range name {
		if i == 0 {
			// First character must be letter or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_') {
				return false, "Database name must start with a letter or underscore"
			}
		} else {
			// Subsequent characters can be letters, digits, or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
				return false, "Database name can only contain letters, digits, and underscores"
			}
		}
	}
	
	// Check for reserved keywords
	reservedKeywords := []string{
		"select", "insert", "update", "delete", "create", "drop", "alter", "show",
		"use", "database", "table", "index", "view", "trigger", "procedure",
		"function", "user", "role", "grant", "revoke", "commit", "rollback",
	}
	
	lowerName := strings.ToLower(name)
	for _, keyword := range reservedKeywords {
		if lowerName == keyword {
			return false, "Database name cannot be a reserved keyword: " + keyword
		}
	}
	
	return true, "Database name is valid"
}

// GetDatabaseStatistics returns statistics about database usage
func (h *TDengineHandler) GetDatabaseStatistics(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if database exists
	exists, err := h.service.DatabaseExists(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Database not found",
			"name":    dbName,
		})
		return
	}

	// Get database info
	dbInfo, err := h.service.GetDatabaseInfo(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get database information",
			"error":   err.Error(),
		})
		return
	}

	// Get additional statistics by querying the database
	manager := h.service.GetManager()
	
	// Use the database
	_, err = manager.ExecuteNonQuery(ctx, "USE "+dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to use database",
			"error":   err.Error(),
		})
		return
	}

	// Get super tables count
	stableRows, err := manager.ExecuteQuery(ctx, "SHOW STABLES")
	if err == nil {
		stableCount := 0
		for stableRows.Next() {
			stableCount++
		}
		stableRows.Close()
		dbInfo.NTables = stableCount // Update with actual super table count
	}

	// Get regular tables count
	tableRows, err := manager.ExecuteQuery(ctx, "SHOW TABLES")
	regularTableCount := 0
	if err == nil {
		for tableRows.Next() {
			regularTableCount++
		}
		tableRows.Close()
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database_info":       dbInfo,
			"super_tables_count":  dbInfo.NTables,
			"regular_tables_count": regularTableCount,
			"total_tables_count":  dbInfo.NTables + regularTableCount,
		},
	})
}

// CreateSuperTable creates a new super table with comprehensive validation
func (h *TDengineHandler) CreateSuperTable(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	var request struct {
		Schema  *tdengine.SuperTableSchema  `json:"schema" binding:"required"`
		Options *tdengine.SuperTableOptions `json:"options,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if database exists
	exists, err := h.service.DatabaseExists(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Database not found",
			"database": dbName,
		})
		return
	}

	// Check if super table already exists
	stExists, err := h.service.SuperTableExists(ctx, dbName, request.Schema.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if stExists {
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"message": "Super table already exists",
			"database": dbName,
			"supertable": request.Schema.Name,
		})
		return
	}

	// Create super table
	err = h.service.CreateSuperTable(ctx, dbName, request.Schema, request.Options)
	if err != nil {
		if strings.Contains(err.Error(), "invalid super table schema") {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid super table schema",
				"error":   err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create super table",
			"error":   err.Error(),
		})
		return
	}

	// Get the created super table info
	stInfo, err := h.service.GetSuperTableInfo(ctx, dbName, request.Schema.Name)
	if err != nil {
		// Super table was created but we couldn't get info - still success
		c.JSON(http.StatusCreated, gin.H{
			"status":  "success",
			"message": "Super table created successfully",
			"database": dbName,
			"supertable": request.Schema.Name,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Super table created successfully",
		"data":    stInfo,
	})
}

// GetSuperTableInfo returns detailed information about a specific super table
func (h *TDengineHandler) GetSuperTableInfo(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stInfo, err := h.service.GetSuperTableInfo(ctx, dbName, stName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Super table not found",
				"database": dbName,
				"supertable": stName,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get super table information",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stInfo,
	})
}

// GetSuperTableSchema returns the schema of a super table
func (h *TDengineHandler) GetSuperTableSchema(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	schema, err := h.service.GetSuperTableSchema(ctx, dbName, stName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Super table not found",
				"database": dbName,
				"supertable": stName,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get super table schema",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   schema,
	})
}

// ListSuperTablesDetailed returns list of super tables with detailed information
func (h *TDengineHandler) ListSuperTablesDetailed(c *gin.Context) {
	dbName := c.Param("database")
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if database exists
	exists, err := h.service.DatabaseExists(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check database existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Database not found",
			"database": dbName,
		})
		return
	}

	superTables, err := h.service.ListSuperTables(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to list super tables",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database":     dbName,
			"supertables": superTables,
			"count":       len(superTables),
		},
	})
}

// DropSuperTable drops a super table with proper validation
func (h *TDengineHandler) DropSuperTable(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists before attempting to drop
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Get super table info before dropping (for response)
	stInfo, _ := h.service.GetSuperTableInfo(ctx, dbName, stName)

	// Drop the super table
	err = h.service.DropSuperTable(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to drop super table",
			"error":   err.Error(),
		})
		return
	}

	response := gin.H{
		"status":  "success",
		"message": "Super table dropped successfully",
		"database": dbName,
		"supertable": stName,
	}

	if stInfo != nil {
		response["dropped_supertable_info"] = stInfo
	}

	c.JSON(http.StatusOK, response)
}

// AlterSuperTable modifies a super table structure
func (h *TDengineHandler) AlterSuperTable(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request tdengine.AlterSuperTableRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Perform the alteration
	err = h.service.AlterSuperTable(ctx, dbName, stName, &request)
	if err != nil {
		if strings.Contains(err.Error(), "invalid") {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid alteration request",
				"error":   err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to alter super table",
			"error":   err.Error(),
		})
		return
	}

	// Get updated super table info
	stInfo, err := h.service.GetSuperTableInfo(ctx, dbName, stName)
	if err != nil {
		// Alteration was successful but we couldn't get updated info
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Super table altered successfully",
			"database": dbName,
			"supertable": stName,
			"action": request.Action,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Super table altered successfully",
		"data":    stInfo,
		"action":  request.Action,
	})
}

// CheckSuperTableExists checks if a super table exists
func (h *TDengineHandler) CheckSuperTableExists(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database":    dbName,
			"supertable": stName,
			"exists":     exists,
		},
	})
}

// ValidateSuperTableSchema validates a super table schema
func (h *TDengineHandler) ValidateSuperTableSchema(c *gin.Context) {
	var request struct {
		Schema *tdengine.SuperTableSchema `json:"schema" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	// Validate schema
	err := request.Schema.Validate()
	isValid := err == nil
	var errorMsg string
	if err != nil {
		errorMsg = err.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"schema": request.Schema,
			"valid":  isValid,
			"message": errorMsg,
		},
	})
}

// ExecuteStructuredQuery executes a structured query
func (h *TDengineHandler) ExecuteStructuredQuery(c *gin.Context) {
	var request tdengine.StructuredQueryRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := h.service.ExecuteStructuredQuery(ctx, &request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute structured query",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// ExecuteAggregationQuery executes an aggregation query
func (h *TDengineHandler) ExecuteAggregationQuery(c *gin.Context) {
	var request tdengine.AggregationQueryRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	result, err := h.service.ExecuteAggregationQuery(ctx, &request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute aggregation query",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// ExecuteQueryWithPagination executes a query with pagination
func (h *TDengineHandler) ExecuteQueryWithPagination(c *gin.Context) {
	var request struct {
		Query      tdengine.StructuredQueryRequest `json:"query" binding:"required"`
		Pagination tdengine.PaginationRequest      `json:"pagination"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := h.service.ExecuteWithPagination(ctx, &request.Query, &request.Pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute paginated query",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// QueryLatestByTags queries latest data by tag filters
func (h *TDengineHandler) QueryLatestByTags(c *gin.Context) {
	database := c.Query("database")
	table := c.Query("table")
	
	if database == "" || table == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and table parameters are required",
		})
		return
	}

	// Parse tags from query parameters
	tags := make(map[string]string)
	for key, values := range c.Request.URL.Query() {
		if key != "database" && key != "table" && key != "limit" {
			if len(values) > 0 {
				tags[key] = values[0]
			}
		}
	}

	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := h.service.QueryLatestByTags(ctx, database, table, tags, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to query latest data by tags",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// QueryTimeRange queries data within a time range
func (h *TDengineHandler) QueryTimeRange(c *gin.Context) {
	var request struct {
		Database   string                 `json:"database" binding:"required"`
		Table      string                 `json:"table" binding:"required"`
		StartTime  time.Time              `json:"start_time" binding:"required"`
		EndTime    time.Time              `json:"end_time" binding:"required"`
		Conditions map[string]interface{} `json:"conditions"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := h.service.QueryTimeRange(ctx, request.Database, request.Table, request.StartTime, request.EndTime, request.Conditions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to query time range data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// QueryAggregationWithTimeWindow queries aggregated data with time windows
func (h *TDengineHandler) QueryAggregationWithTimeWindow(c *gin.Context) {
	var request struct {
		Database   string                 `json:"database" binding:"required"`
		Table      string                 `json:"table" binding:"required"`
		AggFunc    string                 `json:"agg_func" binding:"required"`
		Column     string                 `json:"column" binding:"required"`
		Interval   string                 `json:"interval" binding:"required"`
		StartTime  time.Time              `json:"start_time" binding:"required"`
		EndTime    time.Time              `json:"end_time" binding:"required"`
		Conditions map[string]interface{} `json:"conditions"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	result, err := h.service.QueryAggregationWithTimeWindow(
		ctx,
		request.Database,
		request.Table,
		request.AggFunc,
		request.Column,
		request.Interval,
		request.StartTime,
		request.EndTime,
		request.Conditions,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to query aggregation with time window",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// GetQueryStatistics returns query performance statistics
func (h *TDengineHandler) GetQueryStatistics(c *gin.Context) {
	stats := h.service.GetQueryStatistics()
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stats,
	})
}

// GetQueryCacheStatistics returns query cache statistics
func (h *TDengineHandler) GetQueryCacheStatistics(c *gin.Context) {
	stats := h.service.GetQueryCacheStatistics()
	
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stats,
	})
}

// ClearQueryCache clears the query cache
func (h *TDengineHandler) ClearQueryCache(c *gin.Context) {
	h.service.ClearQueryCache()
	
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Query cache cleared successfully",
	})
}

// ValidateSuperTableCompatibility validates schema compatibility
func (h *TDengineHandler) ValidateSuperTableCompatibility(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request struct {
		NewSchema *tdengine.SuperTableSchema `json:"new_schema" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Validate compatibility
	err := h.service.ValidateSuperTableCompatibility(ctx, dbName, stName, request.NewSchema)
	isCompatible := err == nil
	var errorMsg string
	if err != nil {
		errorMsg = err.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database":    dbName,
			"supertable": stName,
			"new_schema": request.NewSchema,
			"compatible": isCompatible,
			"message":    errorMsg,
		},
	})
}

// ===== SUB-TABLE MANAGEMENT HANDLERS =====

// CreateSubTable creates a new sub-table with specified tags
func (h *TDengineHandler) CreateSubTable(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request struct {
		Name    string                 `json:"name" binding:"required"`
		Tags    map[string]interface{} `json:"tags" binding:"required"`
		Options *tdengine.SubTableOptions `json:"options,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Check if sub-table already exists
	subExists, err := h.service.SubTableExists(ctx, dbName, request.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check sub-table existence",
			"error":   err.Error(),
		})
		return
	}

	if subExists {
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"message": "Sub-table already exists",
			"database": dbName,
			"subtable": request.Name,
		})
		return
	}

	// Create sub-table
	err = h.service.CreateSubTable(ctx, dbName, stName, request.Name, request.Tags, request.Options)
	if err != nil {
		if strings.Contains(err.Error(), "invalid") {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid sub-table parameters",
				"error":   err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create sub-table",
			"error":   err.Error(),
		})
		return
	}

	// Get the created sub-table info
	subInfo, err := h.service.GetSubTableInfo(ctx, dbName, request.Name)
	if err != nil {
		// Sub-table was created but we couldn't get info - still success
		c.JSON(http.StatusCreated, gin.H{
			"status":  "success",
			"message": "Sub-table created successfully",
			"database": dbName,
			"supertable": stName,
			"subtable": request.Name,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Sub-table created successfully",
		"data":    subInfo,
	})
}

// ListSubTables returns a paginated list of sub-tables for a super table
func (h *TDengineHandler) ListSubTables(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	sizeStr := c.DefaultQuery("size", "20")
	
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	
	size, err := strconv.Atoi(sizeStr)
	if err != nil || size < 1 || size > 1000 {
		size = 20
	}

	// Parse filter parameters
	filter := &tdengine.SubTableFilter{}
	
	if createdAfter := c.Query("created_after"); createdAfter != "" {
		if t, err := time.Parse(time.RFC3339, createdAfter); err == nil {
			filter.CreatedAfter = &t
		}
	}
	
	if createdBefore := c.Query("created_before"); createdBefore != "" {
		if t, err := time.Parse(time.RFC3339, createdBefore); err == nil {
			filter.CreatedBefore = &t
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// List sub-tables
	result, err := h.service.ListSubTables(ctx, dbName, stName, filter, page, size)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Failed to list sub tables",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// GetSubTableInfo returns detailed information about a specific sub-table
func (h *TDengineHandler) GetSubTableInfo(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Sub-table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	subInfo, err := h.service.GetSubTableInfo(ctx, dbName, subTableName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Sub-table not found",
				"database": dbName,
				"subtable": subTableName,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get sub-table information",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   subInfo,
	})
}

// DropSubTable drops a sub-table
func (h *TDengineHandler) DropSubTable(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Sub-table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if sub-table exists before attempting to drop
	exists, err := h.service.SubTableExists(ctx, dbName, subTableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check sub-table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Sub-table not found",
			"database": dbName,
			"subtable": subTableName,
		})
		return
	}

	// Get sub-table info before dropping (for response)
	subInfo, _ := h.service.GetSubTableInfo(ctx, dbName, subTableName)

	// Drop the sub-table
	err = h.service.DropSubTable(ctx, dbName, subTableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to drop sub-table",
			"error":   err.Error(),
		})
		return
	}

	response := gin.H{
		"status":  "success",
		"message": "Sub-table dropped successfully",
		"database": dbName,
		"subtable": subTableName,
	}

	if subInfo != nil {
		response["dropped_subtable_info"] = subInfo
	}

	c.JSON(http.StatusOK, response)
}

// GetSubTablesByTags returns sub-tables that match specified tag criteria
func (h *TDengineHandler) GetSubTablesByTags(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request struct {
		Tags map[string]interface{} `json:"tags" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Get sub-tables by tags
	subTables, err := h.service.GetSubTablesByTags(ctx, dbName, stName, request.Tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get sub-tables by tags",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database":    dbName,
			"supertable": stName,
			"tag_filters": request.Tags,
			"subtables":   subTables,
			"count":       len(subTables),
		},
	})
}

// CheckSubTableExists checks if a sub-table exists
func (h *TDengineHandler) CheckSubTableExists(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Sub-table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	exists, err := h.service.SubTableExists(ctx, dbName, subTableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check sub-table existence",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"database": dbName,
			"subtable": subTableName,
			"exists":   exists,
		},
	})
}

// ApplySubTableLifecyclePolicy applies lifecycle management policies to sub-tables
func (h *TDengineHandler) ApplySubTableLifecyclePolicy(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request struct {
		Policy *tdengine.SubTableLifecyclePolicy `json:"policy" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // Longer timeout for lifecycle operations
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Apply lifecycle policy
	err = h.service.ApplyLifecyclePolicy(ctx, dbName, stName, request.Policy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to apply lifecycle policy",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Lifecycle policy applied successfully",
		"database": dbName,
		"supertable": stName,
		"policy": request.Policy,
	})
}

// AutoCreateSubTableFromData automatically creates sub-table from data point
func (h *TDengineHandler) AutoCreateSubTableFromData(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	var request struct {
		DataPoint tdengine.DataPoint `json:"data_point" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request format",
			"error":   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Auto-create sub-table
	subTableName, err := h.service.AutoCreateSubTable(ctx, dbName, stName, request.DataPoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to auto-create sub-table",
			"error":   err.Error(),
		})
		return
	}

	// Get the created/existing sub-table info
	subInfo, err := h.service.GetSubTableInfo(ctx, dbName, subTableName)
	if err != nil {
		// Sub-table was created but we couldn't get info - still success
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Sub-table auto-created successfully",
			"database": dbName,
			"supertable": stName,
			"subtable": subTableName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Sub-table auto-created successfully",
		"data":    subInfo,
	})
}

// GetSuperTableStatistics returns statistics about a super table
func (h *TDengineHandler) GetSuperTableStatistics(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")
	
	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}
	
	if stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Super table name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if super table exists
	exists, err := h.service.SuperTableExists(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to check super table existence",
			"error":   err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Super table not found",
			"database": dbName,
			"supertable": stName,
		})
		return
	}

	// Get super table info
	stInfo, err := h.service.GetSuperTableInfo(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get super table information",
			"error":   err.Error(),
		})
		return
	}

	// Get sub-table count
	subTableCount, err := h.service.GetSubTableCount(ctx, dbName, stName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get sub-table count",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"supertable_info": stInfo,
			"subtable_count":  subTableCount,
			"column_count":    len(stInfo.Columns),
			"tag_count":       len(stInfo.Tags),
		},
	})
}

// GetTables returns list of all tables in a database
func (h *TDengineHandler) GetTables(c *gin.Context) {
	database := c.Query("database")
	if database == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database parameter is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tables, err := h.service.ListTables(ctx, database)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get tables",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"tables":  tables,
			"total":   len(tables),
			"database": database,
		},
	})
}

// UpdateSubTableTag updates a tag value for a sub-table
// PUT /api/v1/tdengine/db/:database/subtables/:subtable/tags/:tag
func (h *TDengineHandler) UpdateSubTableTag(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")
	tagName := c.Param("tag")

	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	if subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Sub-table name is required",
		})
		return
	}

	if tagName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Tag name is required",
		})
		return
	}

	var request struct {
		Value interface{} `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body: " + err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Update the tag value
	err := h.service.UpdateSubTableTag(ctx, dbName, subTableName, tagName, request.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to update tag value",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Tag value updated successfully",
		"data": gin.H{
			"database":   dbName,
			"subtable":   subTableName,
			"tag":        tagName,
			"value":      request.Value,
		},
	})
}

// GetDatabaseConfig returns the configuration of a database
// GET /api/v1/tdengine/databases/:database/config
func (h *TDengineHandler) GetDatabaseConfig(c *gin.Context) {
	dbName := c.Param("database")

	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	config, err := h.service.GetDatabaseConfig(ctx, dbName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get database config",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   config,
	})
}

// UpdateDatabaseConfig updates the configuration of a database
// PUT /api/v1/tdengine/databases/:database/config
func (h *TDengineHandler) UpdateDatabaseConfig(c *gin.Context) {
	dbName := c.Param("database")

	if dbName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database name is required",
		})
		return
	}

	var config tdengine.DatabaseConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body: " + err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := h.service.UpdateDatabaseConfig(ctx, dbName, &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to update database config",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Database config updated successfully",
	})
}

// GetSuperTablePreview returns preview data for a super table
// GET /api/v1/tdengine/db/:database/supertables/:supertable/preview
func (h *TDengineHandler) GetSuperTablePreview(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")

	if dbName == "" || stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and super table names are required",
		})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	preview, err := h.service.GetSuperTablePreview(ctx, dbName, stName, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get super table preview",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   preview,
	})
}

// GetSubTablePreview returns preview data for a sub table
// GET /api/v1/tdengine/db/:database/subtables/:subtable/preview
func (h *TDengineHandler) GetSubTablePreview(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")

	if dbName == "" || subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and sub table names are required",
		})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	preview, err := h.service.GetSubTablePreview(ctx, dbName, subTableName, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get sub table preview",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   preview,
	})
}

// BulkUpdateSubTableTags updates multiple tag values for a sub table
// PUT /api/v1/tdengine/db/:database/subtables/:subtable/tags
func (h *TDengineHandler) BulkUpdateSubTableTags(c *gin.Context) {
	dbName := c.Param("database")
	subTableName := c.Param("subtable")

	if dbName == "" || subTableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and sub table names are required",
		})
		return
	}

	var request struct {
		Tags map[string]interface{} `json:"tags" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body: " + err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := h.service.BulkUpdateSubTableTags(ctx, dbName, subTableName, request.Tags); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to update tags",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Tags updated successfully",
		"data": gin.H{
			"database": dbName,
			"subtable": subTableName,
			"tags":     request.Tags,
		},
	})
}

// AlterSuperTableSchema modifies super table schema
// POST /api/v1/tdengine/db/:database/supertables/:supertable/schema
func (h *TDengineHandler) AlterSuperTableSchema(c *gin.Context) {
	dbName := c.Param("database")
	stName := c.Param("supertable")

	if dbName == "" || stName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and super table names are required",
		})
		return
	}

	var request tdengine.SchemaAlterRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body: " + err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := h.service.AlterSuperTableSchema(ctx, dbName, stName, &request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to alter schema",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Schema altered successfully",
	})
}

// AnalyzeDataQuality performs data quality analysis on a table
// GET /api/v1/tdengine/db/:database/tables/:table/quality
func (h *TDengineHandler) AnalyzeDataQuality(c *gin.Context) {
	dbName := c.Param("database")
	tableName := c.Param("table")

	if dbName == "" || tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Database and table names are required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	metrics, err := h.service.AnalyzeDataQuality(ctx, dbName, tableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to analyze data quality",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   metrics,
	})
}