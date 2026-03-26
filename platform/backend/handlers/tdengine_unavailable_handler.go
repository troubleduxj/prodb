package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// TDengineUnavailableHandler handles requests when TDengine service is unavailable
func TDengineUnavailableHandler(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"status":  "error",
		"message": "TDengine service is currently unavailable",
		"error":   "TDengine connection not established",
		"code":    "TDENGINE_UNAVAILABLE",
		"suggestions": []string{
			"Check if TDengine server is running",
			"Verify TDengine connection configuration",
			"Check network connectivity to TDengine server",
			"Review TDengine server logs for errors",
		},
	})
}

// TDengineConnectionRequiredHandler handles requests that require TDengine connection
func TDengineConnectionRequiredHandler(c *gin.Context) {
	c.JSON(http.StatusPreconditionFailed, gin.H{
		"status":  "error",
		"message": "TDengine connection is required for this operation",
		"error":   "No TDengine connection configured",
		"code":    "TDENGINE_CONNECTION_REQUIRED",
		"suggestions": []string{
			"Configure at least one TDengine connection",
			"Set a default TDengine connection",
			"Test your TDengine connection configuration",
		},
	})
}