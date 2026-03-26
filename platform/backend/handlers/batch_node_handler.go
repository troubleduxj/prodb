package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
)

// Use models from the models package
type NodePoint = models.NodePoint
type BatchOperation = models.BatchOperation

// ImportResult represents the result of an import operation
type ImportResult struct {
	Success      bool            `json:"success"`
	TotalRows    int             `json:"total_rows"`
	SuccessCount int             `json:"success_count"`
	ErrorCount   int             `json:"error_count"`
	Errors       []ImportError   `json:"errors"`
	Warnings     []ImportWarning `json:"warnings"`
	OperationID  string          `json:"operation_id"`
}

// ImportError represents an import error
type ImportError struct {
	Row     int    `json:"row"`
	Column  string `json:"column"`
	Value   string `json:"value"`
	Message string `json:"message"`
}

// ImportWarning represents an import warning
type ImportWarning struct {
	Row     int    `json:"row"`
	Column  string `json:"column"`
	Value   string `json:"value"`
	Message string `json:"message"`
}

// BatchUpdateRequest represents a batch update request
type BatchUpdateRequest struct {
	NodePointIDs []string               `json:"node_point_ids" binding:"required"`
	Updates      map[string]interface{} `json:"updates" binding:"required"`
}

// BatchDeleteRequest represents a batch delete request
type BatchDeleteRequest struct {
	NodePointIDs []string `json:"node_point_ids" binding:"required"`
}

// BatchEnableDisableRequest represents a batch enable/disable request
type BatchEnableDisableRequest struct {
	NodePointIDs []string `json:"node_point_ids" binding:"required"`
	Enabled      bool     `json:"enabled"`
}

// ExportRequest represents an export request
type ExportNodeRequest struct {
	CollectorID string   `json:"collector_id"`
	DeviceIDs   []string `json:"device_ids"`
	Enabled     *bool    `json:"enabled"`
	Format      string   `json:"format"` // csv, excel, json
}

// GetNodePoints returns node points with filtering and pagination
func GetNodePoints(c *gin.Context) {
	collectorID := c.Query("collector_id")
	deviceID := c.Query("device_id")
	enabled := c.Query("enabled")
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var nodePoints []NodePoint
	query := database.DB.Preload("Collector").Preload("Creator").
		Order("created_at DESC").
		Limit(limit).Offset(offset)

	if collectorID != "" {
		if collectorUUID, err := uuid.Parse(collectorID); err == nil {
			query = query.Where("collector_id = ?", collectorUUID)
		}
	}

	if deviceID != "" {
		query = query.Where("device_id = ?", deviceID)
	}

	if enabled != "" {
		if enabledBool, err := strconv.ParseBool(enabled); err == nil {
			query = query.Where("enabled = ?", enabledBool)
		}
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("point_name ILIKE ? OR description ILIKE ? OR address ILIKE ?", 
			searchPattern, searchPattern, searchPattern)
	}

	if err := query.Find(&nodePoints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve node points",
			"error":   err.Error(),
		})
		return
	}

	// Get total count for pagination
	var total int64
	countQuery := database.DB.Model(&NodePoint{})
	if collectorID != "" {
		if collectorUUID, err := uuid.Parse(collectorID); err == nil {
			countQuery = countQuery.Where("collector_id = ?", collectorUUID)
		}
	}
	if deviceID != "" {
		countQuery = countQuery.Where("device_id = ?", deviceID)
	}
	if enabled != "" {
		if enabledBool, err := strconv.ParseBool(enabled); err == nil {
			countQuery = countQuery.Where("enabled = ?", enabledBool)
		}
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		countQuery = countQuery.Where("point_name ILIKE ? OR description ILIKE ? OR address ILIKE ?", 
			searchPattern, searchPattern, searchPattern)
	}
	countQuery.Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"node_points": nodePoints,
		"total":       total,
		"limit":       limit,
		"offset":      offset,
	})
}

// CreateNodePoint creates a new node point
func CreateNodePoint(c *gin.Context) {
	var nodePoint NodePoint
	if err := c.ShouldBindJSON(&nodePoint); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Validate required fields
	if nodePoint.CollectorID == uuid.Nil || nodePoint.DeviceID == "" || 
	   nodePoint.PointName == "" || nodePoint.Address == "" || nodePoint.DataType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "CollectorID, DeviceID, PointName, Address, and DataType are required",
		})
		return
	}

	// Set defaults
	if nodePoint.ScanRate == 0 {
		nodePoint.ScanRate = 1000
	}
	if nodePoint.ScaleFactor == 0 {
		nodePoint.ScaleFactor = 1.0
	}

	nodePoint.CreatedBy = 1 // TODO: Get from authentication context

	if err := database.DB.Create(&nodePoint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create node point",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   nodePoint,
	})
}

// BatchUpdateNodePoints performs batch update on node points
func BatchUpdateNodePoints(c *gin.Context) {
	var request BatchUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Convert string IDs to UUIDs
	var nodePointUUIDs []uuid.UUID
	for _, id := range request.NodePointIDs {
		nodePointUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid node point ID format: %s", id),
			})
			return
		}
		nodePointUUIDs = append(nodePointUUIDs, nodePointUUID)
	}

	// Create batch operation record
	parametersJSON, _ := json.Marshal(map[string]interface{}{
		"node_point_ids": request.NodePointIDs,
		"updates":        request.Updates,
	})

	batchOp := BatchOperation{
		Type:         "update",
		Status:       "processing",
		TotalItems:   len(nodePointUUIDs),
		Parameters:   string(parametersJSON),
		CreatedBy:    1, // TODO: Get from authentication context
		StartedAt:    &[]time.Time{time.Now()}[0],
	}

	if err := database.DB.Create(&batchOp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create batch operation",
			"error":   err.Error(),
		})
		return
	}

	// Perform batch update asynchronously
	go performBatchUpdate(batchOp.ID, nodePointUUIDs, request.Updates)

	c.JSON(http.StatusAccepted, gin.H{
		"status":       "success",
		"message":      "Batch update operation started",
		"operation_id": batchOp.ID.String(),
	})
}

// BatchDeleteNodePoints performs batch delete on node points
func BatchDeleteNodePoints(c *gin.Context) {
	var request BatchDeleteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Convert string IDs to UUIDs
	var nodePointUUIDs []uuid.UUID
	for _, id := range request.NodePointIDs {
		nodePointUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid node point ID format: %s", id),
			})
			return
		}
		nodePointUUIDs = append(nodePointUUIDs, nodePointUUID)
	}

	// Create batch operation record
	parametersJSON, _ := json.Marshal(map[string]interface{}{
		"node_point_ids": request.NodePointIDs,
	})

	batchOp := BatchOperation{
		Type:         "delete",
		Status:       "processing",
		TotalItems:   len(nodePointUUIDs),
		Parameters:   string(parametersJSON),
		CreatedBy:    1, // TODO: Get from authentication context
		StartedAt:    &[]time.Time{time.Now()}[0],
	}

	if err := database.DB.Create(&batchOp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create batch operation",
			"error":   err.Error(),
		})
		return
	}

	// Perform batch delete asynchronously
	go performBatchDelete(batchOp.ID, nodePointUUIDs)

	c.JSON(http.StatusAccepted, gin.H{
		"status":       "success",
		"message":      "Batch delete operation started",
		"operation_id": batchOp.ID.String(),
	})
}

// BatchEnableDisableNodePoints performs batch enable/disable on node points
func BatchEnableDisableNodePoints(c *gin.Context) {
	var request BatchEnableDisableRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Convert string IDs to UUIDs
	var nodePointUUIDs []uuid.UUID
	for _, id := range request.NodePointIDs {
		nodePointUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid node point ID format: %s", id),
			})
			return
		}
		nodePointUUIDs = append(nodePointUUIDs, nodePointUUID)
	}

	// Perform batch enable/disable
	action := "disable"
	if request.Enabled {
		action = "enable"
	}

	result := database.DB.Model(&NodePoint{}).
		Where("id IN ?", nodePointUUIDs).
		Update("enabled", request.Enabled)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Failed to %s node points", action),
			"error":   result.Error.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully %sd %d node points", action, result.RowsAffected),
		"affected_count": result.RowsAffected,
	})
}

// ImportNodePoints imports node points from CSV/Excel file
func ImportNodePoints(c *gin.Context) {
	// Get file from form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "No file uploaded",
			"error":   err.Error(),
		})
		return
	}
	defer file.Close()

	// Validate file type
	filename := header.Filename
	if !strings.HasSuffix(strings.ToLower(filename), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Only CSV files are supported",
		})
		return
	}

	// Parse CSV
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Failed to parse CSV file",
			"error":   err.Error(),
		})
		return
	}

	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "CSV file must contain at least a header row and one data row",
		})
		return
	}

	// Create batch operation record
	parametersJSON, _ := json.Marshal(map[string]interface{}{
		"filename":   filename,
		"total_rows": len(records) - 1, // Exclude header
	})

	batchOp := BatchOperation{
		Type:         "import",
		Status:       "processing",
		TotalItems:   len(records) - 1,
		Parameters:   string(parametersJSON),
		CreatedBy:    1, // TODO: Get from authentication context
		StartedAt:    &[]time.Time{time.Now()}[0],
	}

	if err := database.DB.Create(&batchOp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create batch operation",
			"error":   err.Error(),
		})
		return
	}

	// Process import asynchronously
	go performImport(batchOp.ID, records)

	c.JSON(http.StatusAccepted, gin.H{
		"status":       "success",
		"message":      "Import operation started",
		"operation_id": batchOp.ID.String(),
		"total_rows":   len(records) - 1,
	})
}

// ExportNodePoints exports node points to CSV/Excel
func ExportNodePoints(c *gin.Context) {
	var request ExportNodeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Build query
	query := database.DB.Preload("Collector")

	if request.CollectorID != "" {
		if collectorUUID, err := uuid.Parse(request.CollectorID); err == nil {
			query = query.Where("collector_id = ?", collectorUUID)
		}
	}

	if len(request.DeviceIDs) > 0 {
		query = query.Where("device_id IN ?", request.DeviceIDs)
	}

	if request.Enabled != nil {
		query = query.Where("enabled = ?", *request.Enabled)
	}

	var nodePoints []NodePoint
	if err := query.Find(&nodePoints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve node points for export",
			"error":   err.Error(),
		})
		return
	}

	// Export based on format
	format := request.Format
	if format == "" {
		format = "csv"
	}

	switch format {
	case "csv":
		exportNodePointsCSV(c, nodePoints)
	case "json":
		exportNodePointsJSON(c, nodePoints)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Unsupported export format. Supported formats: csv, json",
		})
	}
}

// GetBatchOperationStatus returns the status of a batch operation
func GetBatchOperationStatus(c *gin.Context) {
	id := c.Param("id")
	
	operationUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid operation ID format",
		})
		return
	}

	var operation BatchOperation
	if err := database.DB.Preload("Creator").Where("id = ?", operationUUID).First(&operation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Batch operation not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve batch operation",
				"error":   err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   operation,
	})
}

// GetBatchOperations returns batch operations with filtering and pagination
func GetBatchOperations(c *gin.Context) {
	operationType := c.Query("type")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var operations []BatchOperation
	query := database.DB.Preload("Creator").
		Order("created_at DESC").
		Limit(limit).Offset(offset)

	if operationType != "" {
		query = query.Where("type = ?", operationType)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&operations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve batch operations",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"operations": operations,
		"total":      len(operations),
	})
}

// GetNodePointTemplate returns a CSV template for importing node points
func GetNodePointTemplate(c *gin.Context) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=\"node_point_template.csv\"")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write header
	headers := []string{
		"collector_id", "device_id", "point_name", "address", "data_type",
		"unit", "description", "enabled", "scan_rate", "scale_factor",
		"offset", "min_value", "max_value", "tags",
	}
	writer.Write(headers)

	// Write example row
	example := []string{
		"550e8400-e29b-41d4-a716-446655440000", // collector_id
		"PLC001",                                // device_id
		"Temperature_01",                        // point_name
		"40001",                                 // address
		"FLOAT",                                 // data_type
		"°C",                                    // unit
		"Temperature sensor 1",                 // description
		"true",                                  // enabled
		"1000",                                  // scan_rate
		"1.0",                                   // scale_factor
		"0.0",                                   // offset
		"-50.0",                                 // min_value
		"150.0",                                 // max_value
		"{\"location\":\"Room1\",\"type\":\"sensor\"}", // tags
	}
	writer.Write(example)
}

// Helper functions

func performBatchUpdate(operationID uuid.UUID, nodePointUUIDs []uuid.UUID, updates map[string]interface{}) {
	var successCount, errorCount int
	var errors []string

	for _, nodePointUUID := range nodePointUUIDs {
		if err := database.DB.Model(&NodePoint{}).Where("id = ?", nodePointUUID).Updates(updates).Error; err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Failed to update node point %s: %s", nodePointUUID.String(), err.Error()))
		} else {
			successCount++
		}

		// Update progress
		processedItems := successCount + errorCount
		progress := int((float64(processedItems) / float64(len(nodePointUUIDs))) * 100)
		
		database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
			"processed_items": processedItems,
			"success_count":   successCount,
			"error_count":     errorCount,
			"progress":        progress,
		})
	}

	// Mark operation as completed
	now := time.Now()
	status := "completed"
	if errorCount > 0 {
		status = "completed_with_errors"
	}

	errorDetailsJSON, _ := json.Marshal(errors)
	database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
		"status":        status,
		"completed_at":  now,
		"error_details": string(errorDetailsJSON),
	})
}

func performBatchDelete(operationID uuid.UUID, nodePointUUIDs []uuid.UUID) {
	var successCount, errorCount int
	var errors []string

	for _, nodePointUUID := range nodePointUUIDs {
		if err := database.DB.Delete(&NodePoint{}, nodePointUUID).Error; err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Failed to delete node point %s: %s", nodePointUUID.String(), err.Error()))
		} else {
			successCount++
		}

		// Update progress
		processedItems := successCount + errorCount
		progress := int((float64(processedItems) / float64(len(nodePointUUIDs))) * 100)
		
		database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
			"processed_items": processedItems,
			"success_count":   successCount,
			"error_count":     errorCount,
			"progress":        progress,
		})
	}

	// Mark operation as completed
	now := time.Now()
	status := "completed"
	if errorCount > 0 {
		status = "completed_with_errors"
	}

	errorDetailsJSON, _ := json.Marshal(errors)
	database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
		"status":        status,
		"completed_at":  now,
		"error_details": string(errorDetailsJSON),
	})
}

func performImport(operationID uuid.UUID, records [][]string) {
	headers := records[0]
	dataRows := records[1:]
	
	var successCount, errorCount int
	var errors []ImportError
	var warnings []ImportWarning

	// Create header map for easy lookup
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[strings.ToLower(strings.TrimSpace(header))] = i
	}

	for rowIndex, row := range dataRows {
		nodePoint := NodePoint{
			CreatedBy: 1, // TODO: Get from authentication context
		}

		// Parse collector_id
		if colIndex, exists := headerMap["collector_id"]; exists && colIndex < len(row) {
			if collectorUUID, err := uuid.Parse(strings.TrimSpace(row[colIndex])); err == nil {
				nodePoint.CollectorID = collectorUUID
			} else {
				errors = append(errors, ImportError{
					Row:     rowIndex + 2, // +2 because we start from 0 and skip header
					Column:  "collector_id",
					Value:   row[colIndex],
					Message: "Invalid UUID format",
				})
				errorCount++
				continue
			}
		} else {
			errors = append(errors, ImportError{
				Row:     rowIndex + 2,
				Column:  "collector_id",
				Value:   "",
				Message: "Required field missing",
			})
			errorCount++
			continue
		}

		// Parse other required fields
		if colIndex, exists := headerMap["device_id"]; exists && colIndex < len(row) {
			nodePoint.DeviceID = strings.TrimSpace(row[colIndex])
		}
		if colIndex, exists := headerMap["point_name"]; exists && colIndex < len(row) {
			nodePoint.PointName = strings.TrimSpace(row[colIndex])
		}
		if colIndex, exists := headerMap["address"]; exists && colIndex < len(row) {
			nodePoint.Address = strings.TrimSpace(row[colIndex])
		}
		if colIndex, exists := headerMap["data_type"]; exists && colIndex < len(row) {
			nodePoint.DataType = strings.TrimSpace(row[colIndex])
		}

		// Validate required fields
		if nodePoint.DeviceID == "" || nodePoint.PointName == "" || 
		   nodePoint.Address == "" || nodePoint.DataType == "" {
			errors = append(errors, ImportError{
				Row:     rowIndex + 2,
				Column:  "required_fields",
				Value:   "",
				Message: "DeviceID, PointName, Address, and DataType are required",
			})
			errorCount++
			continue
		}

		// Parse optional fields
		if colIndex, exists := headerMap["unit"]; exists && colIndex < len(row) {
			nodePoint.Unit = strings.TrimSpace(row[colIndex])
		}
		if colIndex, exists := headerMap["description"]; exists && colIndex < len(row) {
			nodePoint.Description = strings.TrimSpace(row[colIndex])
		}
		if colIndex, exists := headerMap["enabled"]; exists && colIndex < len(row) {
			if enabled, err := strconv.ParseBool(strings.TrimSpace(row[colIndex])); err == nil {
				nodePoint.Enabled = enabled
			} else {
				nodePoint.Enabled = true // Default
				warnings = append(warnings, ImportWarning{
					Row:     rowIndex + 2,
					Column:  "enabled",
					Value:   row[colIndex],
					Message: "Invalid boolean value, defaulting to true",
				})
			}
		} else {
			nodePoint.Enabled = true // Default
		}

		// Parse numeric fields
		if colIndex, exists := headerMap["scan_rate"]; exists && colIndex < len(row) {
			if scanRate, err := strconv.Atoi(strings.TrimSpace(row[colIndex])); err == nil {
				nodePoint.ScanRate = scanRate
			} else {
				nodePoint.ScanRate = 1000 // Default
			}
		} else {
			nodePoint.ScanRate = 1000 // Default
		}

		if colIndex, exists := headerMap["scale_factor"]; exists && colIndex < len(row) {
			if scaleFactor, err := strconv.ParseFloat(strings.TrimSpace(row[colIndex]), 64); err == nil {
				nodePoint.ScaleFactor = scaleFactor
			} else {
				nodePoint.ScaleFactor = 1.0 // Default
			}
		} else {
			nodePoint.ScaleFactor = 1.0 // Default
		}

		if colIndex, exists := headerMap["offset"]; exists && colIndex < len(row) {
			if offset, err := strconv.ParseFloat(strings.TrimSpace(row[colIndex]), 64); err == nil {
				nodePoint.Offset = offset
			}
		}

		if colIndex, exists := headerMap["min_value"]; exists && colIndex < len(row) && strings.TrimSpace(row[colIndex]) != "" {
			if minValue, err := strconv.ParseFloat(strings.TrimSpace(row[colIndex]), 64); err == nil {
				nodePoint.MinValue = &minValue
			}
		}

		if colIndex, exists := headerMap["max_value"]; exists && colIndex < len(row) && strings.TrimSpace(row[colIndex]) != "" {
			if maxValue, err := strconv.ParseFloat(strings.TrimSpace(row[colIndex]), 64); err == nil {
				nodePoint.MaxValue = &maxValue
			}
		}

		// Parse tags JSON
		if colIndex, exists := headerMap["tags"]; exists && colIndex < len(row) && strings.TrimSpace(row[colIndex]) != "" {
			tagsStr := strings.TrimSpace(row[colIndex])
			if json.Valid([]byte(tagsStr)) {
				nodePoint.Tags = tagsStr
			} else {
				warnings = append(warnings, ImportWarning{
					Row:     rowIndex + 2,
					Column:  "tags",
					Value:   tagsStr,
					Message: "Invalid JSON format for tags",
				})
			}
		}

		// Create node point
		if err := database.DB.Create(&nodePoint).Error; err != nil {
			errors = append(errors, ImportError{
				Row:     rowIndex + 2,
				Column:  "database",
				Value:   "",
				Message: err.Error(),
			})
			errorCount++
		} else {
			successCount++
		}

		// Update progress
		processedItems := successCount + errorCount
		progress := int((float64(processedItems) / float64(len(dataRows))) * 100)
		
		database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
			"processed_items": processedItems,
			"success_count":   successCount,
			"error_count":     errorCount,
			"progress":        progress,
		})
	}

	// Mark operation as completed
	now := time.Now()
	status := "completed"
	if errorCount > 0 {
		status = "completed_with_errors"
	}

	result := ImportResult{
		Success:      errorCount == 0,
		TotalRows:    len(dataRows),
		SuccessCount: successCount,
		ErrorCount:   errorCount,
		Errors:       errors,
		Warnings:     warnings,
		OperationID:  operationID.String(),
	}

	errorDetailsJSON, _ := json.Marshal(result)
	database.DB.Model(&BatchOperation{}).Where("id = ?", operationID).Updates(map[string]interface{}{
		"status":        status,
		"completed_at":  now,
		"error_details": string(errorDetailsJSON),
	})
}

func exportNodePointsCSV(c *gin.Context, nodePoints []NodePoint) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=\"node_points_export.csv\"")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write headers
	headers := []string{
		"id", "collector_id", "collector_name", "device_id", "point_name", "address", "data_type",
		"unit", "description", "enabled", "scan_rate", "scale_factor", "offset",
		"min_value", "max_value", "tags", "created_at", "updated_at",
	}
	writer.Write(headers)

	// Write data
	for _, np := range nodePoints {
		record := []string{
			np.ID.String(),
			np.CollectorID.String(),
			"", // collector_name - will be filled if preloaded
			np.DeviceID,
			np.PointName,
			np.Address,
			np.DataType,
			np.Unit,
			np.Description,
			strconv.FormatBool(np.Enabled),
			strconv.Itoa(np.ScanRate),
			strconv.FormatFloat(np.ScaleFactor, 'f', -1, 64),
			strconv.FormatFloat(np.Offset, 'f', -1, 64),
		}

		if np.MinValue != nil {
			record = append(record, strconv.FormatFloat(*np.MinValue, 'f', -1, 64))
		} else {
			record = append(record, "")
		}

		if np.MaxValue != nil {
			record = append(record, strconv.FormatFloat(*np.MaxValue, 'f', -1, 64))
		} else {
			record = append(record, "")
		}

		record = append(record, np.Tags)
		record = append(record, np.CreatedAt.Format(time.RFC3339))
		record = append(record, np.UpdatedAt.Format(time.RFC3339))

		// Fill collector name if available
		if np.Collector.Name != "" {
			record[2] = np.Collector.Name
		}

		writer.Write(record)
	}
}

func exportNodePointsJSON(c *gin.Context, nodePoints []NodePoint) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=\"node_points_export.json\"")

	exportData := map[string]interface{}{
		"node_points":  nodePoints,
		"total":        len(nodePoints),
		"exported_at":  time.Now(),
	}

	json.NewEncoder(c.Writer).Encode(exportData)
}