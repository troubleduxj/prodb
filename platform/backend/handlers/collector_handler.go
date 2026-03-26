package handlers

import (
	"net/http"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// validateAgentID 验证 Agent ID 格式：小写字母、数字、连字符
func validateAgentID(agentID string) bool {
	if agentID == "" {
		return false
	}
	// 只允许小写字母、数字和连字符
	matched, _ := regexp.MatchString("^[a-z0-9-]+$", agentID)
	return matched
}

// GetCollectors handles GET requests to /collectors
func GetCollectors(c *gin.Context) {
	var collectors []models.Collector
	database.DB.Find(&collectors)
	c.JSON(http.StatusOK, collectors)
}

// CreateCollector handles POST requests to /collectors
func CreateCollector(c *gin.Context) {
	var collector models.Collector
	if err := c.ShouldBindJSON(&collector); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 验证 Agent ID
	if !validateAgentID(collector.AgentID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent ID is required and must contain only lowercase letters, numbers, and hyphens"})
		return
	}

	// 检查 Agent ID 是否已存在
	var existingCollector models.Collector
	if err := database.DB.Where("agent_id = ?", collector.AgentID).First(&existingCollector).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Agent ID already exists"})
		return
	}

	database.DB.Create(&collector)
	c.JSON(http.StatusCreated, collector)
}

// GetCollector handles GET requests to /collectors/{id}
func GetCollector(c *gin.Context) {
	id := c.Param("id")
	var collector models.Collector
	if err := database.DB.First(&collector, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Collector not found"})
		return
	}
	c.JSON(http.StatusOK, collector)
}

// UpdateCollector handles PUT requests to /collectors/{id}
func UpdateCollector(c *gin.Context) {
	id := c.Param("id")
	var collector models.Collector
	if err := database.DB.First(&collector, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Collector not found"})
		return
	}

	// 保存当前的 Agent ID（不允许修改）
	currentAgentID := collector.AgentID

	if err := c.ShouldBindJSON(&collector); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 恢复 Agent ID，确保不被修改
	collector.AgentID = currentAgentID

	database.DB.Save(&collector)
	c.JSON(http.StatusOK, collector)
}

// DeleteCollector handles DELETE requests to /collectors/{id}
func DeleteCollector(c *gin.Context) {
	id := c.Param("id")
	var collector models.Collector
	if err := database.DB.First(&collector, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Collector not found"})
		return
	}
	database.DB.Delete(&collector)
	c.JSON(http.StatusOK, gin.H{"message": "The collector has been deleted successfully!"})
}

// GetInterfaces handles GET requests to /collectors/{id}/interfaces
func GetInterfaces(c *gin.Context) {
	id := c.Param("id")
	var interfaces []models.Interface
	database.DB.Where("collector_id = ?", id).Find(&interfaces)
	c.JSON(http.StatusOK, interfaces)
}

// CreateInterface handles POST requests to /collectors/{id}/interfaces
func CreateInterface(c *gin.Context) {
	collectorID := c.Param("id")
	var iface models.Interface
	if err := c.ShouldBindJSON(&iface); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedUUID, err := uuid.Parse(collectorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collector ID"})
		return
	}
	iface.CollectorID = parsedUUID
	database.DB.Create(&iface)
	c.JSON(http.StatusCreated, iface)
}

// UpdateInterface handles PUT requests to /collectors/{id}/interfaces/{ifaceId}
func UpdateInterface(c *gin.Context) {
	id := c.Param("ifaceId")
	var iface models.Interface
	if err := database.DB.First(&iface, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interface not found"})
		return
	}
	if err := c.ShouldBindJSON(&iface); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&iface)
	c.JSON(http.StatusOK, iface)
}

// DeleteInterface handles DELETE requests to /collectors/{id}/interfaces/{ifaceId}
func DeleteInterface(c *gin.Context) {
	id := c.Param("ifaceId")
	var iface models.Interface
	if err := database.DB.First(&iface, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interface not found"})
		return
	}
	database.DB.Delete(&iface)
	c.JSON(http.StatusOK, gin.H{"message": "The interface has been deleted successfully!"})
}
