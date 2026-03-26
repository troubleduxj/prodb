package handlers

import (
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
type CollectorAuthStatus = models.CollectorAuthStatus
type AuthenticationRule = models.AuthenticationRule
type AuthenticationLog = models.AuthenticationLog

// AuthenticationStatistics represents authentication statistics
type AuthenticationStatistics struct {
	TotalCollectors    int64 `json:"total_collectors"`
	PendingAuth        int64 `json:"pending_auth"`
	ApprovedCollectors int64 `json:"approved_collectors"`
	RejectedCollectors int64 `json:"rejected_collectors"`
	ExpiredTokens      int64 `json:"expired_tokens"`
	SuspendedCollectors int64 `json:"suspended_collectors"`
	ActiveConnections  int64 `json:"active_connections"`
	TodayConnections   int64 `json:"today_connections"`
	TodayApprovals     int64 `json:"today_approvals"`
	TodayRejections    int64 `json:"today_rejections"`
}

// AuthRequest represents authentication request data
type AuthRequest struct {
	CollectorID string                 `json:"collector_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	IPAddress   string                 `json:"ip_address" binding:"required"`
	UserAgent   string                 `json:"user_agent"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// AuthApprovalRequest represents approval request data
type AuthApprovalRequest struct {
	CollectorIDs []string   `json:"collector_ids" binding:"required"`
	ExpiresAt    *time.Time `json:"expires_at"`
	Notes        string     `json:"notes"`
}

// AuthRejectionRequest represents rejection request data
type AuthRejectionRequest struct {
	CollectorIDs []string `json:"collector_ids" binding:"required"`
	Reason       string   `json:"reason" binding:"required"`
	Notes        string   `json:"notes"`
}

// AuthRuleRequest represents authentication rule request data
type AuthRuleRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Type        string                 `json:"type" binding:"required"`
	Config      map[string]interface{} `json:"config" binding:"required"`
	Enabled     bool                   `json:"enabled"`
	Priority    int                    `json:"priority"`
}

// GetPendingCollectors returns collectors pending authentication
func GetPendingCollectors(c *gin.Context) {
	var pendingCollectors []CollectorAuthStatus
	
	query := database.DB.Preload("Collector").Preload("Approver").Preload("Rejector").
		Where("status = ?", "pending").
		Order("connection_time ASC")

	if err := query.Find(&pendingCollectors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve pending collectors",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"collectors": pendingCollectors,
		"total":      len(pendingCollectors),
	})
}

// GetCollectorAuthStatus returns authentication status for all collectors
func GetCollectorAuthStatus(c *gin.Context) {
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var collectors []CollectorAuthStatus
	query := database.DB.Preload("Collector").Preload("Approver").Preload("Rejector").
		Order("connection_time DESC").
		Limit(limit).Offset(offset)

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&collectors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve collector authentication status",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"collectors": collectors,
		"total":      len(collectors),
	})
}

// ApproveCollectors approves collector authentication
func ApproveCollectors(c *gin.Context) {
	var request AuthApprovalRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	userID := uint(1) // TODO: Get from authentication context
	now := time.Now()
	
	// Convert string IDs to UUIDs
	var collectorUUIDs []uuid.UUID
	for _, id := range request.CollectorIDs {
		collectorUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid collector ID format: %s", id),
			})
			return
		}
		collectorUUIDs = append(collectorUUIDs, collectorUUID)
	}

	// Update collector authentication status
	updates := map[string]interface{}{
		"status":      "approved",
		"approved_by": userID,
		"approved_at": now,
		"auth_token":  uuid.New().String(), // Generate auth token
	}

	if request.ExpiresAt != nil {
		updates["expires_at"] = *request.ExpiresAt
	} else {
		// Default expiration: 30 days
		expiresAt := now.AddDate(0, 0, 30)
		updates["expires_at"] = expiresAt
	}

	result := database.DB.Model(&CollectorAuthStatus{}).
		Where("collector_id IN ?", collectorUUIDs).
		Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to approve collectors",
			"error":   result.Error.Error(),
		})
		return
	}

	// Log authentication actions
	for _, collectorUUID := range collectorUUIDs {
		logAuthAction(collectorUUID, "approve", "success", c.ClientIP(), c.GetHeader("User-Agent"), &userID, request.Notes)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully approved %d collectors", result.RowsAffected),
		"approved_count": result.RowsAffected,
	})
}

// RejectCollectors rejects collector authentication
func RejectCollectors(c *gin.Context) {
	var request AuthRejectionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	userID := uint(1) // TODO: Get from authentication context
	now := time.Now()
	
	// Convert string IDs to UUIDs
	var collectorUUIDs []uuid.UUID
	for _, id := range request.CollectorIDs {
		collectorUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid collector ID format: %s", id),
			})
			return
		}
		collectorUUIDs = append(collectorUUIDs, collectorUUID)
	}

	// Update collector authentication status
	updates := map[string]interface{}{
		"status":           "rejected",
		"rejected_by":      userID,
		"rejected_at":      now,
		"rejection_reason": request.Reason,
	}

	result := database.DB.Model(&CollectorAuthStatus{}).
		Where("collector_id IN ?", collectorUUIDs).
		Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to reject collectors",
			"error":   result.Error.Error(),
		})
		return
	}

	// Log authentication actions
	for _, collectorUUID := range collectorUUIDs {
		logAuthAction(collectorUUID, "reject", "success", c.ClientIP(), c.GetHeader("User-Agent"), &userID, request.Reason)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully rejected %d collectors", result.RowsAffected),
		"rejected_count": result.RowsAffected,
	})
}

// SuspendCollectors suspends collector authentication
func SuspendCollectors(c *gin.Context) {
	var request struct {
		CollectorIDs []string `json:"collector_ids" binding:"required"`
		Reason       string   `json:"reason" binding:"required"`
		Notes        string   `json:"notes"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	userID := uint(1) // TODO: Get from authentication context
	now := time.Now()
	
	// Convert string IDs to UUIDs
	var collectorUUIDs []uuid.UUID
	for _, id := range request.CollectorIDs {
		collectorUUID, err := uuid.Parse(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Invalid collector ID format: %s", id),
			})
			return
		}
		collectorUUIDs = append(collectorUUIDs, collectorUUID)
	}

	// Update collector authentication status
	updates := map[string]interface{}{
		"status":           "suspended",
		"rejected_by":      userID,
		"rejected_at":      now,
		"rejection_reason": request.Reason,
	}

	result := database.DB.Model(&CollectorAuthStatus{}).
		Where("collector_id IN ? AND status IN ?", collectorUUIDs, []string{"approved", "pending"}).
		Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to suspend collectors",
			"error":   result.Error.Error(),
		})
		return
	}

	// Log authentication actions
	for _, collectorUUID := range collectorUUIDs {
		logAuthAction(collectorUUID, "suspend", "success", c.ClientIP(), c.GetHeader("User-Agent"), &userID, request.Reason)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully suspended %d collectors", result.RowsAffected),
		"suspended_count": result.RowsAffected,
	})
}

// GetAuthenticationRules returns authentication rules
func GetAuthenticationRules(c *gin.Context) {
	var rules []AuthenticationRule
	
	query := database.DB.Preload("Creator").Order("priority DESC, created_at ASC")

	if err := query.Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve authentication rules",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"rules":  rules,
		"total":  len(rules),
	})
}

// CreateAuthenticationRule creates a new authentication rule
func CreateAuthenticationRule(c *gin.Context) {
	var request AuthRuleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Validate rule type
	validTypes := []string{"ip_whitelist", "certificate", "token", "manual", "auto_approve"}
	isValidType := false
	for _, validType := range validTypes {
		if request.Type == validType {
			isValidType = true
			break
		}
	}

	if !isValidType {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid rule type. Valid types: " + strings.Join(validTypes, ", "),
		})
		return
	}

	// Serialize config to JSON
	configJSON, err := json.Marshal(request.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to serialize rule config",
			"error":   err.Error(),
		})
		return
	}

	// Create authentication rule
	rule := AuthenticationRule{
		Name:        request.Name,
		Description: request.Description,
		Type:        request.Type,
		Config:      string(configJSON),
		Enabled:     request.Enabled,
		Priority:    request.Priority,
		CreatedBy:   1, // TODO: Get from authentication context
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create authentication rule",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   rule,
	})
}

// UpdateAuthenticationRule updates an authentication rule
func UpdateAuthenticationRule(c *gin.Context) {
	id := c.Param("id")
	
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid rule ID format",
		})
		return
	}

	var request AuthRuleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	// Find existing rule
	var existingRule AuthenticationRule
	if err := database.DB.Where("id = ?", ruleUUID).First(&existingRule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Authentication rule not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve authentication rule",
				"error":   err.Error(),
			})
		}
		return
	}

	// Serialize config to JSON
	configJSON, err := json.Marshal(request.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to serialize rule config",
			"error":   err.Error(),
		})
		return
	}

	// Update rule
	existingRule.Name = request.Name
	existingRule.Description = request.Description
	existingRule.Type = request.Type
	existingRule.Config = string(configJSON)
	existingRule.Enabled = request.Enabled
	existingRule.Priority = request.Priority

	if err := database.DB.Save(&existingRule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to update authentication rule",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   existingRule,
	})
}

// DeleteAuthenticationRule deletes an authentication rule
func DeleteAuthenticationRule(c *gin.Context) {
	id := c.Param("id")
	
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid rule ID format",
		})
		return
	}

	// Check if rule exists
	var rule AuthenticationRule
	if err := database.DB.Where("id = ?", ruleUUID).First(&rule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Authentication rule not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve authentication rule",
				"error":   err.Error(),
			})
		}
		return
	}

	// Delete the rule
	if err := database.DB.Delete(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to delete authentication rule",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Authentication rule deleted successfully",
	})
}

// GetAuthenticationLogs returns authentication logs
func GetAuthenticationLogs(c *gin.Context) {
	collectorID := c.Query("collector_id")
	action := c.Query("action")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var logs []AuthenticationLog
	query := database.DB.Preload("Collector").Preload("User").
		Order("created_at DESC").
		Limit(limit).Offset(offset)

	if collectorID != "" {
		if collectorUUID, err := uuid.Parse(collectorID); err == nil {
			query = query.Where("collector_id = ?", collectorUUID)
		}
	}

	if action != "" {
		query = query.Where("action = ?", action)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to retrieve authentication logs",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"logs":   logs,
		"total":  len(logs),
	})
}

// GetAuthenticationStatistics returns authentication statistics
func GetAuthenticationStatistics(c *gin.Context) {
	var stats AuthenticationStatistics
	
	// Get total collectors
	database.DB.Model(&CollectorAuthStatus{}).Count(&stats.TotalCollectors)
	
	// Get status counts
	database.DB.Model(&CollectorAuthStatus{}).Where("status = ?", "pending").Count(&stats.PendingAuth)
	database.DB.Model(&CollectorAuthStatus{}).Where("status = ?", "approved").Count(&stats.ApprovedCollectors)
	database.DB.Model(&CollectorAuthStatus{}).Where("status = ?", "rejected").Count(&stats.RejectedCollectors)
	database.DB.Model(&CollectorAuthStatus{}).Where("status = ?", "suspended").Count(&stats.SuspendedCollectors)
	
	// Get expired tokens
	database.DB.Model(&CollectorAuthStatus{}).
		Where("status = ? AND expires_at < ?", "approved", time.Now()).
		Count(&stats.ExpiredTokens)
	
	// Get active connections (approved and not expired)
	database.DB.Model(&CollectorAuthStatus{}).
		Where("status = ? AND (expires_at IS NULL OR expires_at > ?)", "approved", time.Now()).
		Count(&stats.ActiveConnections)
	
	// Get today's statistics
	today := time.Now().Truncate(24 * time.Hour)
	database.DB.Model(&CollectorAuthStatus{}).
		Where("connection_time >= ?", today).
		Count(&stats.TodayConnections)
	
	database.DB.Model(&CollectorAuthStatus{}).
		Where("approved_at >= ?", today).
		Count(&stats.TodayApprovals)
	
	database.DB.Model(&CollectorAuthStatus{}).
		Where("rejected_at >= ?", today).
		Count(&stats.TodayRejections)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stats,
	})
}

// RegisterCollectorAuth registers a collector for authentication
func RegisterCollectorAuth(c *gin.Context) {
	var request AuthRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request data",
			"error":   err.Error(),
		})
		return
	}

	collectorUUID, err := uuid.Parse(request.CollectorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid collector ID format",
		})
		return
	}

	// Check if collector exists
	var collector models.Collector
	if err := database.DB.Where("id = ?", collectorUUID).First(&collector).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Collector not found",
		})
		return
	}

	// Serialize metadata to JSON
	var metadataJSON string
	if request.Metadata != nil {
		if metadataBytes, err := json.Marshal(request.Metadata); err == nil {
			metadataJSON = string(metadataBytes)
		}
	}

	// Check if authentication status already exists
	var existingAuth CollectorAuthStatus
	if err := database.DB.Where("collector_id = ?", collectorUUID).First(&existingAuth).Error; err == nil {
		// Update existing record
		existingAuth.Name = request.Name
		existingAuth.IPAddress = request.IPAddress
		existingAuth.UserAgent = request.UserAgent
		existingAuth.ConnectionTime = time.Now()
		existingAuth.Metadata = metadataJSON
		
		if err := database.DB.Save(&existingAuth).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to update collector authentication status",
				"error":   err.Error(),
			})
			return
		}

		// Log authentication action
		logAuthAction(collectorUUID, "connect", "success", request.IPAddress, request.UserAgent, nil, "Reconnection")

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data":   existingAuth,
		})
		return
	}

	// Create new authentication status
	authStatus := CollectorAuthStatus{
		CollectorID:    collectorUUID,
		Name:           request.Name,
		IPAddress:      request.IPAddress,
		UserAgent:      request.UserAgent,
		ConnectionTime: time.Now(),
		Status:         "pending",
		Metadata:       metadataJSON,
	}

	if err := database.DB.Create(&authStatus).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to create collector authentication status",
			"error":   err.Error(),
		})
		return
	}

	// Log authentication action
	logAuthAction(collectorUUID, "connect", "success", request.IPAddress, request.UserAgent, nil, "Initial connection")

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   authStatus,
	})
}

// Helper function to log authentication actions
func logAuthAction(collectorID uuid.UUID, action, status, ipAddress, userAgent string, userID *uint, message string) {
	details := map[string]interface{}{
		"timestamp": time.Now(),
	}
	
	if detailsJSON, err := json.Marshal(details); err == nil {
		log := AuthenticationLog{
			CollectorID: collectorID,
			Action:      action,
			Status:      status,
			IPAddress:   ipAddress,
			UserAgent:   userAgent,
			UserID:      userID,
			Details:     string(detailsJSON),
			Message:     message,
		}
		
		database.DB.Create(&log)
	}
}

// CleanupExpiredTokens cleans up expired authentication tokens
func CleanupExpiredTokens(c *gin.Context) {
	now := time.Now()
	
	result := database.DB.Model(&CollectorAuthStatus{}).
		Where("status = ? AND expires_at < ?", "approved", now).
		Update("status", "expired")

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to cleanup expired tokens",
			"error":   result.Error.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Successfully expired %d tokens", result.RowsAffected),
		"expired_count": result.RowsAffected,
	})
}