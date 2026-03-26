package handlers

import (
	"net/http"
	"strconv"
	"time"

	"prodb/platform/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PerformanceHandler handles performance monitoring HTTP requests
type PerformanceHandler struct {
	performanceMonitor *services.PerformanceMonitor
}

// NewPerformanceHandler creates a new performance handler
func NewPerformanceHandler(performanceMonitor *services.PerformanceMonitor) *PerformanceHandler {
	return &PerformanceHandler{
		performanceMonitor: performanceMonitor,
	}
}

// GetPerformanceMetrics returns performance metrics for a collector
// GET /api/v1/collectors/:id/performance/metrics
func (ph *PerformanceHandler) GetPerformanceMetrics(c *gin.Context) {
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
	
	metrics, err := ph.performanceMonitor.GetPerformanceMetrics(collectorID, since, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get performance metrics",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"collector_id": collectorID,
		"since":        since,
		"limit":        limit,
		"count":        len(metrics),
		"metrics":      metrics,
	})
}

// GetPerformanceTrend returns performance trend analysis
// GET /api/v1/collectors/:id/performance/trend
func (ph *PerformanceHandler) GetPerformanceTrend(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	// Parse metric parameter
	metricName := c.DefaultQuery("metric", "cpu_usage")
	
	// Parse period parameter (default: 7 days)
	periodStr := c.DefaultQuery("period", "168h") // 7 days
	period, err := time.ParseDuration(periodStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid period format. Use format like '24h', '7d', '168h'",
		})
		return
	}
	
	trend, err := ph.performanceMonitor.GetPerformanceTrend(collectorID, metricName, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get performance trend",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, trend)
}

// GetCapacityPlan returns capacity planning analysis
// GET /api/v1/collectors/:id/performance/capacity-plan
func (ph *PerformanceHandler) GetCapacityPlan(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid collector ID",
		})
		return
	}
	
	plan, err := ph.performanceMonitor.GenerateCapacityPlan(collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to generate capacity plan",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, plan)
}

// GetMonitoringStats returns performance monitoring statistics
// GET /api/v1/performance/monitoring/stats
func (ph *PerformanceHandler) GetMonitoringStats(c *gin.Context) {
	stats := ph.performanceMonitor.GetMonitoringStats()
	
	c.JSON(http.StatusOK, stats)
}

// GetThresholds returns current performance thresholds
// GET /api/v1/performance/thresholds
func (ph *PerformanceHandler) GetThresholds(c *gin.Context) {
	thresholds := ph.performanceMonitor.GetThresholds()
	
	c.JSON(http.StatusOK, thresholds)
}

// UpdateThresholds updates performance thresholds
// PUT /api/v1/performance/thresholds
func (ph *PerformanceHandler) UpdateThresholds(c *gin.Context) {
	var thresholds services.PerformanceThresholds
	if err := c.ShouldBindJSON(&thresholds); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Validate thresholds
	if thresholds.CPUUsageWarning <= 0 || thresholds.CPUUsageWarning > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CPU usage warning threshold must be between 0 and 100",
		})
		return
	}
	
	if thresholds.CPUUsageCritical <= thresholds.CPUUsageWarning || thresholds.CPUUsageCritical > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CPU usage critical threshold must be greater than warning threshold and <= 100",
		})
		return
	}
	
	if thresholds.MemoryUsageWarning <= 0 || thresholds.MemoryUsageWarning > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Memory usage warning threshold must be between 0 and 100",
		})
		return
	}
	
	if thresholds.MemoryUsageCritical <= thresholds.MemoryUsageWarning || thresholds.MemoryUsageCritical > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Memory usage critical threshold must be greater than warning threshold and <= 100",
		})
		return
	}
	
	ph.performanceMonitor.SetThresholds(&thresholds)
	
	c.JSON(http.StatusOK, gin.H{
		"message":    "Thresholds updated successfully",
		"thresholds": thresholds,
	})
}

// GetPerformanceSummary returns a performance summary for all collectors
// GET /api/v1/performance/summary
func (ph *PerformanceHandler) GetPerformanceSummary(c *gin.Context) {
	// This would typically aggregate performance data across all collectors
	// For now, return monitoring stats
	stats := ph.performanceMonitor.GetMonitoringStats()
	thresholds := ph.performanceMonitor.GetThresholds()
	
	summary := gin.H{
		"monitoring_stats": stats,
		"thresholds":       thresholds,
		"status":           "active",
	}
	
	c.JSON(http.StatusOK, summary)
}

// GetPerformanceAlerts returns performance-related alerts
// GET /api/v1/performance/alerts
func (ph *PerformanceHandler) GetPerformanceAlerts(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid limit parameter",
		})
		return
	}
	
	// This would typically query performance-related alerts from the database
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"message": "Performance alerts endpoint - implementation depends on alert service integration",
		"limit":   limit,
		"alerts":  []interface{}{}, // Placeholder
	})
}

// GetResourceUtilization returns current resource utilization across collectors
// GET /api/v1/performance/resource-utilization
func (ph *PerformanceHandler) GetResourceUtilization(c *gin.Context) {
	// This would typically aggregate current resource utilization
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"message": "Resource utilization endpoint - requires collector aggregation",
		"timestamp": time.Now(),
		"utilization": gin.H{
			"cpu":    gin.H{"average": 0, "peak": 0, "collectors": 0},
			"memory": gin.H{"average": 0, "peak": 0, "collectors": 0},
			"disk":   gin.H{"average": 0, "peak": 0, "collectors": 0},
		},
	})
}

// GetPerformanceRecommendations returns performance optimization recommendations
// GET /api/v1/performance/recommendations
func (ph *PerformanceHandler) GetPerformanceRecommendations(c *gin.Context) {
	// This would analyze performance data and provide recommendations
	recommendations := []string{
		"Monitor CPU usage trends for capacity planning",
		"Set up alerts for memory usage above 85%",
		"Review disk usage patterns for optimization opportunities",
		"Consider load balancing for high-traffic collectors",
		"Implement data retention policies to manage storage growth",
	}
	
	c.JSON(http.StatusOK, gin.H{
		"recommendations": recommendations,
		"generated_at":    time.Now(),
		"category":        "general",
	})
}