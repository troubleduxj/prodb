package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"prodb/platform/backend/services"
)

// SecurityHandler handles security-related HTTP requests
type SecurityHandler struct {
	threatDetectionService *services.SecurityThreatDetectionService
	auditService           *services.AuditService
}

// NewSecurityHandler creates a new security handler
func NewSecurityHandler(threatDetectionService *services.SecurityThreatDetectionService, auditService *services.AuditService) *SecurityHandler {
	return &SecurityHandler{
		threatDetectionService: threatDetectionService,
		auditService:           auditService,
	}
}

// AnalyzeThreat handles POST /api/v1/security/analyze
func (h *SecurityHandler) AnalyzeThreat(c *gin.Context) {
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

	// Analyze based on type
	switch request.Type {
	case "login_attempt":
		result := h.analyzeLoginAttemptThreat(c, request.Data)
		c.JSON(http.StatusOK, result)
	case "audit_log":
		result := h.analyzeAuditLogThreat(c, request.Data)
		c.JSON(http.StatusOK, result)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid analysis type",
			"supported_types": []string{"login_attempt", "audit_log"},
		})
	}
}

// GetThreatRules handles GET /api/v1/security/rules
func (h *SecurityHandler) GetThreatRules(c *gin.Context) {
	// Return default threat detection rules
	rules := []map[string]interface{}{
		{
			"id":          "brute_force_login",
			"name":        "Brute Force Login Detection",
			"description": "Detects multiple failed login attempts from the same IP",
			"rule_type":   "brute_force",
			"enabled":     true,
			"severity":    "high",
			"threshold":   5,
			"time_window": "15m",
		},
		{
			"id":          "suspicious_login_pattern",
			"name":        "Suspicious Login Pattern",
			"description": "Detects login attempts from unusual locations or times",
			"rule_type":   "anomaly",
			"enabled":     true,
			"severity":    "medium",
			"threshold":   3,
			"time_window": "1h",
		},
		{
			"id":          "rapid_api_calls",
			"name":        "Rapid API Calls",
			"description": "Detects unusually high API call frequency",
			"rule_type":   "anomaly",
			"enabled":     true,
			"severity":    "medium",
			"threshold":   100,
			"time_window": "1m",
		},
		{
			"id":          "privilege_escalation",
			"name":        "Privilege Escalation Attempt",
			"description": "Detects attempts to access unauthorized resources",
			"rule_type":   "suspicious_activity",
			"enabled":     true,
			"severity":    "critical",
			"threshold":   1,
			"time_window": "5m",
		},
		{
			"id":          "data_exfiltration",
			"name":        "Data Exfiltration Detection",
			"description": "Detects unusual data access patterns",
			"rule_type":   "anomaly",
			"enabled":     true,
			"severity":    "critical",
			"threshold":   10,
			"time_window": "10m",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"rules": rules,
		"total": len(rules),
	})
}

// GetSecurityDashboard handles GET /api/v1/security/dashboard
func (h *SecurityHandler) GetSecurityDashboard(c *gin.Context) {
	// Get time range from query parameters
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

	// Default to last 24 hours if no time range specified
	if startTime == nil && endTime == nil {
		now := time.Now()
		yesterday := now.Add(-24 * time.Hour)
		startTime = &yesterday
		endTime = &now
	}

	// Get security events statistics
	eventFilter := &services.SecurityEventFilter{
		StartTime: startTime,
		EndTime:   endTime,
		Page:      1,
		PageSize:  1000, // Get all events for statistics
	}

	events, err := h.auditService.GetSecurityEvents(c.Request.Context(), eventFilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve security events",
			"details": err.Error(),
		})
		return
	}

	// Calculate statistics
	stats := h.calculateSecurityStatistics(events)

	c.JSON(http.StatusOK, gin.H{
		"time_range": gin.H{
			"start_time": startTime,
			"end_time":   endTime,
		},
		"statistics": stats,
	})
}

// GetActiveThreats handles GET /api/v1/security/threats/active
func (h *SecurityHandler) GetActiveThreats(c *gin.Context) {
	filter := &services.SecurityEventFilter{
		Status:   "active",
		Page:     1,
		PageSize: 50,
		SortBy:   "last_seen",
		SortOrder: "desc",
	}

	// Parse query parameters
	if severity := c.Query("severity"); severity != "" {
		filter.Severity = severity
	}

	if eventType := c.Query("event_type"); eventType != "" {
		filter.EventType = eventType
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

	response, err := h.auditService.GetSecurityEvents(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve active threats",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// ResolveThreat handles PUT /api/v1/security/threats/:id/resolve
func (h *SecurityHandler) ResolveThreat(c *gin.Context) {
	threatID := c.Param("id")
	if threatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Threat ID is required",
		})
		return
	}

	id, err := uuid.Parse(threatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid threat ID format",
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
			if uid, ok := u["id"].(float64); ok {
				resolverID = uint(uid)
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

// GetThreatAnalysis handles GET /api/v1/security/analysis/:id
func (h *SecurityHandler) GetThreatAnalysis(c *gin.Context) {
	analysisID := c.Param("id")
	if analysisID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Analysis ID is required",
		})
		return
	}

	// This would retrieve detailed threat analysis results
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"analysis_id": analysisID,
		"status": "completed",
		"results": gin.H{
			"threat_detected": false,
			"confidence": 0.0,
			"details": gin.H{},
		},
	})
}

// Helper methods

func (h *SecurityHandler) analyzeLoginAttemptThreat(c *gin.Context, data map[string]interface{}) gin.H {
	// This would convert the data to a LoginAttempt model and analyze it
	// For now, return a simplified analysis
	return gin.H{
		"threat_detected": false,
		"threat_type": "",
		"severity": "low",
		"confidence": 0.0,
		"details": gin.H{
			"analysis_type": "login_attempt",
			"timestamp": time.Now(),
		},
		"actions": []string{},
	}
}

func (h *SecurityHandler) analyzeAuditLogThreat(c *gin.Context, data map[string]interface{}) gin.H {
	// This would convert the data to an AuditLog model and analyze it
	// For now, return a simplified analysis
	return gin.H{
		"threat_detected": false,
		"threat_type": "",
		"severity": "low",
		"confidence": 0.0,
		"details": gin.H{
			"analysis_type": "audit_log",
			"timestamp": time.Now(),
		},
		"actions": []string{},
	}
}

func (h *SecurityHandler) calculateSecurityStatistics(events *services.SecurityEventResponse) map[string]interface{} {
	stats := map[string]interface{}{
		"total_events": events.Total,
		"active_events": 0,
		"resolved_events": 0,
		"severity_distribution": map[string]int{
			"low": 0,
			"medium": 0,
			"high": 0,
			"critical": 0,
		},
		"event_type_distribution": map[string]int{},
		"top_threat_sources": []map[string]interface{}{},
	}

	severityDist := stats["severity_distribution"].(map[string]int)
	eventTypeDist := stats["event_type_distribution"].(map[string]int)
	ipCounts := make(map[string]int)

	for _, event := range events.Events {
		// Count by status
		if event.Status == "active" {
			stats["active_events"] = stats["active_events"].(int) + 1
		} else if event.Status == "resolved" {
			stats["resolved_events"] = stats["resolved_events"].(int) + 1
		}

		// Count by severity
		if count, exists := severityDist[event.Severity]; exists {
			severityDist[event.Severity] = count + 1
		}

		// Count by event type
		eventTypeDist[event.EventType]++

		// Count by IP address
		if event.IPAddress != "" {
			ipCounts[event.IPAddress]++
		}
	}

	// Get top threat sources (IPs)
	topSources := []map[string]interface{}{}
	for ip, count := range ipCounts {
		if len(topSources) < 10 { // Top 10
			topSources = append(topSources, map[string]interface{}{
				"ip_address": ip,
				"event_count": count,
			})
		}
	}
	stats["top_threat_sources"] = topSources

	return stats
}