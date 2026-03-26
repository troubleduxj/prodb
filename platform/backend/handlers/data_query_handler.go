package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
	"prodb/platform/backend/tdengine"
)

// QueryRequest represents a structured query request
type QueryRequest struct {
	ConnectionID string                 `json:"connection_id,omitempty"`
	Database     string                 `json:"database" binding:"required"`
	Table        string                 `json:"table" binding:"required"`
	Columns      []string               `json:"columns"`
	Conditions   map[string]interface{} `json:"conditions"`
	TimeRange    *TimeRange             `json:"time_range"`
	GroupBy      []string               `json:"group_by"`
	OrderBy      []OrderBy              `json:"order_by"`
	Limit        int                    `json:"limit"`
	Offset       int                    `json:"offset"`
	Aggregation  *AggregationConfig     `json:"aggregation"`
}

// TimeRange represents a time range filter
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// OrderBy represents an order by clause
type OrderBy struct {
	Column string `json:"column"`
	Order  string `json:"order"` // ASC or DESC
}

// AggregationConfig represents aggregation configuration
type AggregationConfig struct {
	Functions []AggregationFunction `json:"functions"`
	Interval  string                `json:"interval,omitempty"` // For time-based aggregation
}

// AggregationFunction represents an aggregation function
type AggregationFunction struct {
	Function string `json:"function"` // COUNT, SUM, AVG, MIN, MAX, etc.
	Column   string `json:"column"`
	Alias    string `json:"alias,omitempty"`
}

// QueryResult represents the result of a query
type QueryResult struct {
	Columns       []string        `json:"columns"`
	Data          [][]interface{} `json:"data"`
	Total         int64           `json:"total"`
	ExecutionTime int64           `json:"execution_time"` // milliseconds
	Cached        bool            `json:"cached"`
}

// PaginatedQueryResult represents a paginated query result
type PaginatedQueryResult struct {
	QueryResult
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}

// SQLQueryRequest represents a raw SQL query request
type SQLQueryRequest struct {
	ConnectionID string `json:"connection_id,omitempty"`
	Database     string `json:"database"`
	SQL          string `json:"sql" binding:"required"`
	Parameters   []interface{} `json:"parameters"`
}

// Use models from the models package
type QueryTemplate = models.QueryTemplate
type QueryHistory = models.QueryHistory

// ExportRequest represents a data export request
type ExportRequest struct {
	QueryRequest
	Format   string            `json:"format" binding:"required"` // csv, excel, json
	Filename string            `json:"filename"`
	Options  map[string]interface{} `json:"options"`
}

// Use models from the models package
type ExportJob = models.ExportJob

// Helper function to get TDengine service from connection ID
func getTDengineServiceByConnectionID(connectionID string) (*tdengine.TDengineService, error) {
	var connection models.TDengineConnection
	
	if connectionID != "" {
		connUUID, err := uuid.Parse(connectionID)
		if err != nil {
			return nil, fmt.Errorf("invalid connection ID format")
		}
		
		if err := database.DB.Where("id = ?", connUUID).First(&connection).Error; err != nil {
			return nil, fmt.Errorf("connection not found")
		}
	} else {
		// Use default connection
		if err := database.DB.Where("is_default = ?", true).First(&connection).Error; err != nil {
			return nil, fmt.Errorf("no default connection found")
		}
	}

	// Create TDengine service
	config := &tdengine.TDengineConfig{
		Host:         connection.Host,
		Port:         connection.Port,
		Username:     connection.Username,
		Password:     connection.Password,
		Database:     connection.Database,
		MaxOpenConns: connection.MaxOpenConns,
		MaxIdleConns: connection.MaxIdleConns,
		ConnTimeout:  time.Duration(connection.ConnTimeout) * time.Second,
		
		// Health check configuration
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		
		// Auto-reconnection configuration
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}

	manager, err := tdengine.NewTDengineManager(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create TDengine manager: %w", err)
	}

	if err := manager.Start(); err != nil {
		return nil, fmt.Errorf("failed to start TDengine manager: %w", err)
	}

	service := tdengine.NewTDengineService(manager)
	return service, nil
}

// ExecuteStructuredQuery executes a structured query
func ExecuteStructuredQuery(c *gin.Context) {
	var request QueryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	startTime := time.Now()

	// Get TDengine service
	service, err := getTDengineServiceByConnectionID(request.ConnectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Build structured query request
	structuredReq := &tdengine.StructuredQueryRequest{
		Database: request.Database,
		Table:    request.Table,
		Columns:  request.Columns,
		GroupBy:  request.GroupBy,
		Limit:    request.Limit,
		Offset:   request.Offset,
	}

	// Add conditions if specified
	if request.Conditions != nil || request.TimeRange != nil {
		structuredReq.Conditions = &tdengine.QueryConditions{
			Logic: "AND",
		}
		
		if request.Conditions != nil {
			structuredReq.Conditions.Tags = request.Conditions
		}
		
		// Add time range if specified
		if request.TimeRange != nil {
			structuredReq.Conditions.TimeRange = &tdengine.TimeRangeCondition{
				Start: request.TimeRange.Start,
				End:   request.TimeRange.End,
			}
		}
	}

	// Add order by if specified
	if len(request.OrderBy) > 0 {
		structuredReq.OrderBy = make([]tdengine.OrderByClause, len(request.OrderBy))
		for i, ob := range request.OrderBy {
			structuredReq.OrderBy[i] = tdengine.OrderByClause{
				Column:    ob.Column,
				Direction: ob.Order,
			}
		}
	}

	// Execute query
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := service.ExecuteStructuredQuery(ctx, structuredReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute query",
			"error":   err.Error(),
		})
		return
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Convert result to API format - convert rows to data array
	var data [][]interface{}
	for _, row := range result.Rows {
		rowData := make([]interface{}, len(result.Columns))
		for i, col := range result.Columns {
			rowData[i] = row[col]
		}
		data = append(data, rowData)
	}

	queryResult := QueryResult{
		Columns:       result.Columns,
		Data:          data,
		Total:         int64(len(data)),
		ExecutionTime: executionTime,
		Cached:        result.Cached,
	}

	// Save query history (optional, could be async)
	go saveQueryHistory(1, request, "structured", executionTime, int64(len(data)), true, "")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   queryResult,
	})
}

// ExecuteSQLQuery executes a raw SQL query
func ExecuteSQLQuery(c *gin.Context) {
	var request SQLQueryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	startTime := time.Now()

	// Get TDengine service
	service, err := getTDengineServiceByConnectionID(request.ConnectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Build SQL query request
	sqlReq := &tdengine.SQLQueryRequest{
		SQL:      request.SQL,
		Database: request.Database,
	}

	// Execute query
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := service.ExecuteSQL(ctx, sqlReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute SQL query",
			"error":   err.Error(),
		})
		return
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Convert result to API format - convert rows to data array
	var data [][]interface{}
	for _, row := range result.Rows {
		rowData := make([]interface{}, len(result.Columns))
		for i, col := range result.Columns {
			rowData[i] = row[col]
		}
		data = append(data, rowData)
	}

	queryResult := QueryResult{
		Columns:       result.Columns,
		Data:          data,
		Total:         int64(len(data)),
		ExecutionTime: executionTime,
		Cached:        result.Cached,
	}

	// Save query history (optional, could be async)
	go saveQueryHistory(1, request.SQL, "sql", executionTime, int64(len(data)), true, "")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   queryResult,
	})
}

// ExecuteQueryWithPagination executes a query with pagination
func ExecuteQueryWithPagination(c *gin.Context) {
	var request QueryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 100
	}

	// Set pagination in request
	request.Limit = pageSize
	request.Offset = (page - 1) * pageSize

	startTime := time.Now()

	// Get TDengine service
	service, err := getTDengineServiceByConnectionID(request.ConnectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Build structured query request
	structuredReq := &tdengine.StructuredQueryRequest{
		Database: request.Database,
		Table:    request.Table,
		Columns:  request.Columns,
		GroupBy:  request.GroupBy,
		Limit:    request.Limit,
		Offset:   request.Offset,
	}

	// Add conditions if specified
	if request.Conditions != nil || request.TimeRange != nil {
		structuredReq.Conditions = &tdengine.QueryConditions{
			Logic: "AND",
		}
		
		if request.Conditions != nil {
			structuredReq.Conditions.Tags = request.Conditions
		}
		
		// Add time range if specified
		if request.TimeRange != nil {
			structuredReq.Conditions.TimeRange = &tdengine.TimeRangeCondition{
				Start: request.TimeRange.Start,
				End:   request.TimeRange.End,
			}
		}
	}

	// Add order by if specified
	if len(request.OrderBy) > 0 {
		structuredReq.OrderBy = make([]tdengine.OrderByClause, len(request.OrderBy))
		for i, ob := range request.OrderBy {
			structuredReq.OrderBy[i] = tdengine.OrderByClause{
				Column:    ob.Column,
				Direction: ob.Order,
			}
		}
	}

	// Execute query with pagination
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	paginationReq := &tdengine.PaginationRequest{
		Page: page,
		Size: pageSize,
	}

	result, err := service.ExecuteWithPagination(ctx, structuredReq, paginationReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute paginated query",
			"error":   err.Error(),
		})
		return
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Convert result to API format - convert rows to data array
	var data [][]interface{}
	for _, row := range result.Rows {
		rowData := make([]interface{}, len(result.Columns))
		for i, col := range result.Columns {
			rowData[i] = row[col]
		}
		data = append(data, rowData)
	}

	// Convert result to API format
	paginatedResult := PaginatedQueryResult{
		QueryResult: QueryResult{
			Columns:       result.Columns,
			Data:          data,
			Total:         int64(result.TotalCount),
			ExecutionTime: executionTime,
			Cached:        result.Cached,
		},
		Page:       page,
		PageSize:   pageSize,
		TotalPages: result.TotalPages,
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   paginatedResult,
	})
}

// SaveQueryTemplate saves a query template
func SaveQueryTemplate(c *gin.Context) {
	var request struct {
		Name        string       `json:"name" binding:"required"`
		Description string       `json:"description"`
		Query       QueryRequest `json:"query" binding:"required"`
		IsPublic    bool         `json:"is_public"`
		Tags        []string     `json:"tags"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Serialize query to JSON
	queryJSON, err := json.Marshal(request.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to serialize query",
			"error":   err.Error(),
		})
		return
	}

	// Serialize tags to JSON
	tagsJSON, err := json.Marshal(request.Tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to serialize tags",
			"error":   err.Error(),
		})
		return
	}

	// Create query template
	template := QueryTemplate{
		Name:        request.Name,
		Description: request.Description,
		Query:       string(queryJSON),
		CreatedBy:   1, // TODO: Get from authentication context
		IsPublic:    request.IsPublic,
		Tags:        string(tagsJSON),
	}

	if err := database.DB.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to save query template",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   template,
	})
}

// GetQueryTemplates returns saved query templates
func GetQueryTemplates(c *gin.Context) {
	userID := c.Query("user_id")
	isPublic := c.Query("public")

	var templates []QueryTemplate
	query := database.DB.Preload("Creator")

	if isPublic == "true" {
		query = query.Where("is_public = ?", true)
	} else if userID != "" {
		uid, _ := strconv.Atoi(userID)
		query = query.Where("created_by = ? OR is_public = ?", uid, true)
	}

	if err := query.Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve query templates",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"templates": templates,
		"total":     len(templates),
	})
}

// GetQueryTemplate returns a specific query template
func GetQueryTemplate(c *gin.Context) {
	id := c.Param("id")
	
	templateUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid template ID format",
		})
		return
	}

	var template QueryTemplate
	if err := database.DB.Preload("Creator").Where("id = ?", templateUUID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Query template not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve query template",
				"error":   err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   template,
	})
}

// DeleteQueryTemplate deletes a query template
func DeleteQueryTemplate(c *gin.Context) {
	id := c.Param("id")
	
	templateUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid template ID format",
		})
		return
	}

	// Check if template exists
	var template QueryTemplate
	if err := database.DB.Where("id = ?", templateUUID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Query template not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve query template",
				"error":   err.Error(),
			})
		}
		return
	}

	// Delete the template
	if err := database.DB.Delete(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete query template",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Query template deleted successfully",
	})
}

// ExportData exports query results to various formats
func ExportData(c *gin.Context) {
	var request ExportRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Validate format
	if request.Format != "csv" && request.Format != "json" && request.Format != "excel" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Unsupported export format. Supported formats: csv, json, excel",
		})
		return
	}

	// Get TDengine service
	service, err := getTDengineServiceByConnectionID(request.ConnectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to TDengine",
			"error":   err.Error(),
		})
		return
	}
	defer service.GetManager().Stop()

	// Build structured query request
	structuredReq := &tdengine.StructuredQueryRequest{
		Database: request.Database,
		Table:    request.Table,
		Columns:  request.Columns,
		GroupBy:  request.GroupBy,
		Limit:    request.Limit,
		Offset:   request.Offset,
	}

	// Add conditions if specified
	if request.Conditions != nil || request.TimeRange != nil {
		structuredReq.Conditions = &tdengine.QueryConditions{
			Logic: "AND",
		}
		
		if request.Conditions != nil {
			structuredReq.Conditions.Tags = request.Conditions
		}
		
		// Add time range if specified
		if request.TimeRange != nil {
			structuredReq.Conditions.TimeRange = &tdengine.TimeRangeCondition{
				Start: request.TimeRange.Start,
				End:   request.TimeRange.End,
			}
		}
	}

	// Execute query
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second) // 5 minutes for export
	defer cancel()

	result, err := service.ExecuteStructuredQuery(ctx, structuredReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to execute query for export",
			"error":   err.Error(),
		})
		return
	}

	// Generate filename if not provided
	filename := request.Filename
	if filename == "" {
		filename = fmt.Sprintf("export_%s_%s_%d", request.Database, request.Table, time.Now().Unix())
	}

	// Export based on format
	switch request.Format {
	case "csv":
		exportCSV(c, result, filename)
	case "json":
		exportJSON(c, result, filename)
	case "excel":
		// TODO: Implement Excel export
		c.JSON(http.StatusNotImplemented, gin.H{
			"status":  "error",
			"message": "Excel export not yet implemented",
		})
	}
}

// exportCSV exports data as CSV
func exportCSV(c *gin.Context, result *tdengine.QueryResult, filename string) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", filename))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write headers
	if err := writer.Write(result.Columns); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to write CSV headers",
			"error":   err.Error(),
		})
		return
	}

	// Write data
	for _, row := range result.Rows {
		record := make([]string, len(result.Columns))
		for i, col := range result.Columns {
			if val, exists := row[col]; exists && val != nil {
				record[i] = fmt.Sprintf("%v", val)
			} else {
				record[i] = ""
			}
		}
		if err := writer.Write(record); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to write CSV data",
				"error":   err.Error(),
			})
			return
		}
	}
}

// exportJSON exports data as JSON
func exportJSON(c *gin.Context, result *tdengine.QueryResult, filename string) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.json\"", filename))

	exportData := map[string]interface{}{
		"columns":     result.Columns,
		"data":        result.Rows,
		"total":       len(result.Rows),
		"exported_at": time.Now(),
	}

	if err := json.NewEncoder(c.Writer).Encode(exportData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to export JSON data",
			"error":   err.Error(),
		})
		return
	}
}

// GetQueryHistory returns query execution history
func GetQueryHistory(c *gin.Context) {
	userID := c.Query("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var history []QueryHistory
	query := database.DB.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset)

	if userID != "" {
		uid, _ := strconv.Atoi(userID)
		query = query.Where("user_id = ?", uid)
	}

	if err := query.Find(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve query history",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"history": history,
		"total":   len(history),
	})
}

// Helper function to save query history
func saveQueryHistory(userID uint, query interface{}, queryType string, executionTime int64, rowCount int64, success bool, errorMessage string) {
	var queryStr string
	
	switch q := query.(type) {
	case string:
		queryStr = q
	case QueryRequest:
		if queryJSON, err := json.Marshal(q); err == nil {
			queryStr = string(queryJSON)
		}
	default:
		if queryJSON, err := json.Marshal(q); err == nil {
			queryStr = string(queryJSON)
		}
	}

	history := QueryHistory{
		UserID:        userID,
		Query:         queryStr,
		QueryType:     queryType,
		ExecutionTime: executionTime,
		RowCount:      rowCount,
		Success:       success,
		ErrorMessage:  errorMessage,
	}

	database.DB.Create(&history)
}