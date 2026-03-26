package handlers

import (
	"net/http"
	"strconv"
	"time"

	"prodb/platform/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// HeartbeatHandler handles heartbeat-related HTTP requests
type HeartbeatHandler struct {
	heartbeatService *services.HeartbeatService
	alertService     *services.AlertService
}

// NewHeartbeatHandler creates a new heartbeat handler
func NewHeartbeatHandler(heartbeatService *services.HeartbeatService, alertService *services.AlertService) *HeartbeatHandler {
	return &HeartbeatHandler{
		heartbeatService: heartbeatService,
		alertService:     alertService,
	}
}

// ProcessHeartbeat handles incoming heartbeat from collectors
// POST /api/v1/collectors/:id/heartbeat
func (hh *HeartbeatHandler) ProcessHeartbeat(c *gin.Context) {
	collectorID := c.Param("id")
	
	// Parse request body
	var heartbeat services.HeartbeatData
	if err := c.ShouldBindJSON(&heartbeat); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Validate collector ID
	if heartbeat.CollectorID == "" {
		heartbeat.CollectorID = collectorID
	}
	
	if heartbeat.CollectorID != collectorID {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Collector ID mismatch",
		})
		return
	}
	
	// Set timestamp if not provided
	if heartbeat.Timestamp.IsZero() {
		heartbeat.Timestamp = time.Now()
	}
	
	// Process heartbeat
	if err := hh.heartbeatService.ProcessHeartbeat(heartbeat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to process heartbeat",
			"details": err.Error(),
		})
		return
	}
	
	// Auto-resolve alerts if collector is back online
	if heartbeat.Status == "running" || heartbeat.Status == "online" {
		collectorUUID, err := uuid.Parse(collectorID)
		if err == nil {
			hh.alertService.AutoResolveCollectorAlerts(collectorUUID)
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":   "Heartbeat processed successfully",
		"timestamp": time.Now(),
	})
}

// GetCollectorStatus returns the current status of a collector
// GET /api/v1/collectors/:id/status
func (hh *HeartbeatHandler) GetCollectorStatus(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	status, err := hh.heartbeatService.GetCollectorStatus(collectorID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Collector status not found",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, status)
}

// GetHeartbeatStatistics returns heartbeat statistics for a collector
// GET /api/v1/collectors/:id/heartbeat/statistics
func (hh *HeartbeatHandler) GetHeartbeatStatistics(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	// Parse period parameter (default: 24 hours)
	periodStr := c.DefaultQuery("period", "24h")
	period, err := time.ParseDuration(periodStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid period format. Use format like '24h', '7d', '30m'",
		})
		return
	}
	
	stats, err := hh.heartbeatService.GetHeartbeatStatistics(collectorID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get heartbeat statistics",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, stats)
}

// GetCollectorHealthSummary returns overall collector health summary
// GET /api/v1/collectors/health/summary
func (hh *HeartbeatHandler) GetCollectorHealthSummary(c *gin.Context) {
	summary, err := hh.heartbeatService.GetCollectorHealthSummary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get health summary",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, summary)
}

// GetMetricsHistory returns metrics history for a collector
// GET /api/v1/collectors/:id/metrics/history
func (hh *HeartbeatHandler) GetMetricsHistory(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	// Parse since parameter (default: 24 hours ago)
	sinceStr := c.DefaultQuery("since", "24h")
	sinceDuration, err := time.ParseDuration(sinceStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid since format. Use format like '24h', '7d', '30m'",
		})
		return
	}
	since := time.Now().Add(-sinceDuration)
	
	// Parse limit parameter (default: 1000)
	limitStr := c.DefaultQuery("limit", "1000")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid limit parameter",
		})
		return
	}
	
	history, err := hh.heartbeatService.GetMetricsHistory(collectorID, since, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get metrics history",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"collector_id": collectorID,
		"since":        since,
		"limit":        limit,
		"count":        len(history),
		"metrics":      history,
	})
}

// GetRecentHeartbeats returns recent heartbeats for a collector
// GET /api/v1/collectors/:id/heartbeat/recent
func (hh *HeartbeatHandler) GetRecentHeartbeats(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	// Parse limit parameter (default: 50)
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid limit parameter",
		})
		return
	}
	
	heartbeats, err := hh.heartbeatService.GetRecentHeartbeats(collectorID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get recent heartbeats",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"collector_id": collectorID,
		"limit":        limit,
		"count":        len(heartbeats),
		"heartbeats":   heartbeats,
	})
}

// GetActiveAlerts returns all active alerts
// GET /api/v1/alerts/active
func (hh *HeartbeatHandler) GetActiveAlerts(c *gin.Context) {
	alerts, err := hh.alertService.GetActiveAlerts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get active alerts",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"count":  len(alerts),
		"alerts": alerts,
	})
}

// GetCollectorAlerts returns alerts for a specific collector
// GET /api/v1/collectors/:id/alerts
func (hh *HeartbeatHandler) GetCollectorAlerts(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	// Parse limit parameter (default: 100)
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid limit parameter",
		})
		return
	}
	
	alerts, err := hh.alertService.GetCollectorAlerts(collectorID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get collector alerts",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"collector_id": collectorID,
		"limit":        limit,
		"count":        len(alerts),
		"alerts":       alerts,
	})
}

// AcknowledgeAlert acknowledges an alert
// POST /api/v1/alerts/:id/acknowledge
func (hh *HeartbeatHandler) AcknowledgeAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid alert ID",
		})
		return
	}
	
	// TODO: Get user ID from authentication context
	userID := uint(1) // Placeholder
	
	if err := hh.alertService.AcknowledgeAlert(alertID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to acknowledge alert",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":        "Alert acknowledged successfully",
		"alert_id":       alertID,
		"acknowledged_by": userID,
		"acknowledged_at": time.Now(),
	})
}

// ResolveAlert resolves an alert
// POST /api/v1/alerts/:id/resolve
func (hh *HeartbeatHandler) ResolveAlert(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid alert ID",
		})
		return
	}
	
	// TODO: Get user ID from authentication context
	userID := uint(1) // Placeholder
	
	if err := hh.alertService.ResolveAlert(alertID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to resolve alert",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":     "Alert resolved successfully",
		"alert_id":    alertID,
		"resolved_by": userID,
		"resolved_at": time.Now(),
	})
}

// GetAlertStatistics returns alert statistics
// GET /api/v1/alerts/statistics
func (hh *HeartbeatHandler) GetAlertStatistics(c *gin.Context) {
	// Parse period parameter (default: 24 hours)
	periodStr := c.DefaultQuery("period", "24h")
	period, err := time.ParseDuration(periodStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid period format. Use format like '24h', '7d', '30m'",
		})
		return
	}
	
	stats, err := hh.alertService.GetAlertStatistics(period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get alert statistics",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"period":     periodStr,
		"statistics": stats,
	})
}