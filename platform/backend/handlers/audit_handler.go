package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"prodb/platform/backend/services"
)

// AuditHandler handles audit-related HTTP requests
type AuditHandler struct {
	auditService *services.AuditService
}

// NewAuditHandler creates a new audit handler
func NewAuditHandler(auditService *services.AuditService) *AuditHandler {
	return &AuditHandler{
		auditService: auditService,
	}
}

// GetAuditLogs handles GET /api/v1/audit/logs
func (h *AuditHandler) GetAuditLogs(c *gin.Context) {
	filter := &services.AuditLogFilter{}

	// Parse query parameters
	if userID := c.Query("user_id"); userID != "" {
		if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
			uid := uint(id)
			filter.UserID = &uid
		}
	}

	if collectorID := c.Query("collector_id"); collectorID != "" {
		if id, err := uuid.Parse(collectorID); err == nil {
			filter.CollectorID = &id
		}
	}

	filter.Action = c.Query("action")
	filter.Resource = c.Query("resource")
	filter.ResourceID = c.Query("resource_id")
	filter.IPAddress = c.Query("ip_address")
	filter.RiskLevel = c.Query("risk_level")

	if isSensitive := c.Query("is_sensitive"); isSensitive != "" {
		if sensitive, err := strconv.ParseBool(isSensitive); err == nil {
			filter.IsSensitive = &sensitive
		}
	}

	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			filter.StartTime = &t
		}
	}

	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			filter.EndTime = &t
		}
	}

	if page := c.Query("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}

	if pageSize := c.Query("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	filter.SortBy = c.Query("sort_by")
	filter.SortOrder = c.Query("sort_order")

	response, err := h.auditService.GetAuditLogs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve audit logs",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// ExportAuditLogs handles GET /api/v1/audit/logs/export
func (h *AuditHandler) ExportAuditLogs(c *gin.Context) {
	filter := &services.AuditLogFilter{}

	// Parse query parameters (same as GetAuditLogs)
	if userID := c.Query("user_id"); userID != "" {
		if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
			uid := uint(id)
			filter.UserID = &uid
		}
	}

	if collectorID := c.Query("collector_id"); collectorID != "" {
		if id, err := uuid.Parse(collectorID); err == nil {
			filter.CollectorID = &id
		}
	}

	filter.Action = c.Query("action")
	filter.Resource = c.Query("resource")
	filter.ResourceID = c.Query("resource_id")
	filter.IPAddress = c.Query("ip_address")
	filter.RiskLevel = c.Query("risk_level")

	if isSensitive := c.Query("is_sensitive"); isSensitive != "" {
		if sensitive, err := strconv.ParseBool(isSensitive); err == nil {
			filter.IsSensitive = &sensitive
		}
	}

	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			filter.StartTime = &t
		}
	}

	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			filter.EndTime = &t
		}
	}

	csvData, err := h.auditService.ExportAuditLogs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to export audit logs",
			"details": err.Error(),
		})
		return
	}

	// Set headers for CSV download
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=audit_logs_"+time.Now().Format("20060102_150405")+".csv")
	c.Data(http.StatusOK, "text/csv", csvData)
}

// GetAuditStatistics handles GET /api/v1/audit/statistics
func (h *AuditHandler) GetAuditStatistics(c *gin.Context) {
	var startTime, endTime *time.Time

	if start := c.Query("start_time"); start != "" {
		if t, err := time.Parse(time.RFC3339, start); err == nil {
			startTime = &t
		}
	}

	if end := c.Query("end_time"); end != "" {
		if t, err := time.Parse(time.RFC3339, end); err == nil {
			endTime = &t
		}
	}

	// Default to last 30 days if no time range specified
	if startTime == nil && endTime == nil {
		now := time.Now()
		thirtyDaysAgo := now.AddDate(0, 0, -30)
		startTime = &thirtyDaysAgo
		endTime = &now
	}

	stats, err := h.auditService.GetAuditStatistics(c.Request.Context(), startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve audit statistics",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"statistics": stats,
		"time_range": gin.H{
			"start_time": startTime,
			"end_time":   endTime,
		},
	})
}

// GetAuditLogDetails handles GET /api/v1/audit/logs/:id
func (h *AuditHandler) GetAuditLogDetails(c *gin.Context) {
	logID := c.Param("id")
	if logID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Log ID is required",
		})
		return
	}

	id, err := uuid.Parse(logID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid log ID format",
		})
		return
	}

	auditLog, err := h.auditService.GetAuditLogByID(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "audit log not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Audit log not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve audit log",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"log": auditLog,
	})
}

// GetLoginAttempts handles GET /api/v1/audit/login-attempts
func (h *AuditHandler) GetLoginAttempts(c *gin.Context) {
	filter := &services.LoginAttemptFilter{}

	filter.Username = c.Query("username")
	filter.IPAddress = c.Query("ip_address")

	if success := c.Query("success"); success != "" {
		if s, err := strconv.ParseBool(success); err == nil {
			filter.Success = &s
		}
	}

	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			filter.StartTime = &t
		}
	}

	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			filter.EndTime = &t
		}
	}

	if page := c.Query("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}

	if pageSize := c.Query("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	filter.SortBy = c.Query("sort_by")
	filter.SortOrder = c.Query("sort_order")

	response, err := h.auditService.GetLoginAttempts(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve login attempts",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetSecurityEvents handles GET /api/v1/audit/security-events
func (h *AuditHandler) GetSecurityEvents(c *gin.Context) {
	filter := &services.SecurityEventFilter{}

	if userID := c.Query("user_id"); userID != "" {
		if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
			uid := uint(id)
			filter.UserID = &uid
		}
	}

	if collectorID := c.Query("collector_id"); collectorID != "" {
		if id, err := uuid.Parse(collectorID); err == nil {
			filter.CollectorID = &id
		}
	}

	filter.EventType = c.Query("event_type")
	filter.Severity = c.Query("severity")
	filter.Status = c.Query("status")
	filter.IPAddress = c.Query("ip_address")
	filter.RuleID = c.Query("rule_id")

	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			filter.StartTime = &t
		}
	}

	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			filter.EndTime = &t
		}
	}

	if page := c.Query("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}

	if pageSize := c.Query("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	filter.SortBy = c.Query("sort_by")
	filter.SortOrder = c.Query("sort_order")

	response, err := h.auditService.GetSecurityEvents(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve security events",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// AnalyzeThreat handles POST /api/v1/security/analyze
func (h *AuditHandler) AnalyzeThreat(c *gin.Context) {
	var request struct {
		Type string                 `json:"type" binding:"required"` // "login_attempt" or "audit_log"
		Data map[string]interface{} `json:"data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// This would require integrating with the threat detection service
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"threat_detected": false,
		"analysis": "Threat analysis functionality available",
		"type": request.Type,
	})
}

// ResolveSecurityEvent handles PUT /api/v1/audit/security-events/:id/resolve
func (h *AuditHandler) ResolveSecurityEvent(c *gin.Context) {
	eventID := c.Param("id")
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Event ID is required",
		})
		return
	}

	id, err := uuid.Parse(eventID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid event ID format",
		})
		return
	}

	var request struct {
		Resolution string `json:"resolution" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Get resolver ID from context (would be set by auth middleware)
	var resolverID uint = 1 // Default for now, should come from authenticated user

	if user, exists := c.Get("user"); exists {
		if u, ok := user.(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				resolverID = uint(id)
			}
		}
	}

	err = h.auditService.ResolveSecurityEvent(c.Request.Context(), id, resolverID, request.Resolution)
	if err != nil {
		if err.Error() == "security event not found or already resolved" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Security event not found or already resolved",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to resolve security event",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Security event resolved successfully",
	})
}