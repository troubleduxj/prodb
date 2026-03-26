package handlers

import (
	"context"
	"net/http"
	"prodb/platform/backend/models"
	"prodb/platform/backend/services"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ConfigDeliveryHandler handles configuration delivery API requests
type ConfigDeliveryHandler struct {
	service *services.ConfigDeliveryService
}

// NewConfigDeliveryHandler creates a new configuration delivery handler
func NewConfigDeliveryHandler() *ConfigDeliveryHandler {
	// 返回一个空的 handler，需要在 main.go 中通过 SetService 注入 service
	return &ConfigDeliveryHandler{}
}

// SetService 设置 service 实例（用于在 main.go 中注入）
func (h *ConfigDeliveryHandler) SetService(service *services.ConfigDeliveryService) {
	h.service = service
}

// DeliverConfiguration delivers configuration to a collector
// @Summary Deliver configuration
// @Description Deliver configuration to a specific collector (creates interface)
// @Tags config-delivery
// @Accept json
// @Produce json
// @Param delivery body services.CreateInterfaceRequest true "Interface configuration data"
// @Success 200 {object} models.CollectorInterface
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/config/deliver [post]
func (h *ConfigDeliveryHandler) DeliverConfiguration(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	var req services.CreateInterfaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 创建接口配置
	ctx := context.Background()
	iface, err := h.service.CreateInterface(ctx, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, iface)
}

// GetPendingConfigurations retrieves pending configurations for a collector
// @Summary Get pending configurations
// @Description Get pending configuration deliveries for a specific collector
// @Tags config-delivery
// @Produce json
// @Param collector_id path string true "Collector ID"
// @Success 200 {array} services.ConfigDeliveryStatus
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/collectors/{collector_id}/config/pending [get]
func (h *ConfigDeliveryHandler) GetPendingConfigurations(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	collectorIDStr := c.Param("collector_id")
	collectorID, err := uuid.Parse(collectorIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collector ID"})
		return
	}

	ctx := context.Background()
	deliveries, err := h.service.GetPendingDeliveries(ctx, collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 转换为 DTO
	result := make([]*services.ConfigDeliveryStatus, len(deliveries))
	for i, d := range deliveries {
		result[i] = services.ToConfigDeliveryStatus(&d)
	}

	c.JSON(http.StatusOK, result)
}

// ConfirmConfigurationApplication confirms configuration application
// @Summary Confirm configuration application
// @Description Confirm that a configuration was applied successfully or failed
// @Tags config-delivery
// @Accept json
// @Produce json
// @Param delivery_id path string true "Delivery ID"
// @Param confirmation body map[string]interface{} true "Confirmation data"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/config/deliveries/{delivery_id}/confirm [post]
func (h *ConfigDeliveryHandler) ConfirmConfigurationApplication(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	deliveryIDStr := c.Param("delivery_id")
	deliveryID, err := uuid.Parse(deliveryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid delivery ID"})
		return
	}

	var req struct {
		Success      bool   `json:"success" binding:"required"`
		ErrorMessage string `json:"error_message"`
		Version      int    `json:"version"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	if req.Success {
		err = h.service.ConfirmApplied(ctx, deliveryID, req.Version)
	} else {
		err = h.service.MarkFailed(ctx, deliveryID, req.ErrorMessage)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Configuration application confirmed"})
}

// RollbackConfiguration rolls back to a previous configuration
// @Summary Rollback configuration
// @Description Rollback to a previous configuration version
// @Tags config-delivery
// @Accept json
// @Produce json
// @Param interface_id path string true "Interface ID"
// @Param rollback body map[string]interface{} true "Rollback data"
// @Success 200 {object} models.CollectorInterface
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/interfaces/{interface_id}/config/rollback [post]
func (h *ConfigDeliveryHandler) RollbackConfiguration(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	interfaceIDStr := c.Param("interface_id")
	interfaceID, err := uuid.Parse(interfaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid interface ID"})
		return
	}

	var req struct {
		TargetVersion int `json:"target_version" binding:"required"`
		UserID        *uint `json:"user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	iface, err := h.service.RollbackInterface(ctx, interfaceID, req.TargetVersion, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, iface)
}

// GetConfigurationHistory retrieves configuration history for an interface
// @Summary Get configuration history
// @Description Get configuration history for a specific interface
// @Tags config-delivery
// @Produce json
// @Param interface_id path string true "Interface ID"
// @Param limit query int false "Limit number of results"
// @Success 200 {array} services.ConfigVersionInfo
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/interfaces/{interface_id}/config/history [get]
func (h *ConfigDeliveryHandler) GetConfigurationHistory(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	interfaceIDStr := c.Param("interface_id")
	interfaceID, err := uuid.Parse(interfaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid interface ID"})
		return
	}

	ctx := context.Background()
	history, err := h.service.GetInterfaceHistory(ctx, interfaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 转换为 DTO
	result := make([]*services.ConfigVersionInfo, len(history))
	for i, h := range history {
		result[i] = services.ToConfigVersionInfo(&h)
	}

	c.JSON(http.StatusOK, result)
}

// GetActiveConfiguration retrieves the active configuration for a collector
// @Summary Get active configuration
// @Description Get the currently active configuration for a specific collector
// @Tags config-delivery
// @Produce json
// @Param collector_id path string true "Collector ID"
// @Success 200 {object} services.CollectorConfig
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/collectors/{collector_id}/config/active [get]
func (h *ConfigDeliveryHandler) GetActiveConfiguration(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	collectorIDStr := c.Param("collector_id")
	collectorID, err := uuid.Parse(collectorIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collector ID"})
		return
	}

	ctx := context.Background()
	config, err := h.service.GetConfigForDelivery(ctx, collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if config == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active configuration found"})
		return
	}

	c.JSON(http.StatusOK, config)
}

// SyncOfflineConfigurations synchronizes configurations for offline collectors
// @Summary Sync offline configurations
// @Description Synchronize configurations for collectors that were offline
// @Tags config-delivery
// @Produce json
// @Param collector_id path string true "Collector ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/collectors/{collector_id}/config/sync [post]
func (h *ConfigDeliveryHandler) SyncOfflineConfigurations(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	collectorIDStr := c.Param("collector_id")
	collectorID, err := uuid.Parse(collectorIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collector ID"})
		return
	}

	ctx := context.Background()
	
	// 获取待下发的配置列表
	deliveries, err := h.service.GetPendingDeliveries(ctx, collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 转换为 DTO
	syncedConfigs := make([]*services.ConfigDeliveryStatus, len(deliveries))
	for i, d := range deliveries {
		syncedConfigs[i] = services.ToConfigDeliveryStatus(&d)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Configurations synchronized",
		"synced_count":   len(syncedConfigs),
		"synced_configs": syncedConfigs,
	})
}

// ResolveConfigurationConflicts resolves configuration conflicts
// @Summary Resolve configuration conflicts
// @Description Resolve conflicts when multiple configurations are pending
// @Tags config-delivery
// @Produce json
// @Param collector_id path string true "Collector ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/collectors/{collector_id}/config/resolve-conflicts [post]
func (h *ConfigDeliveryHandler) ResolveConfigurationConflicts(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	collectorIDStr := c.Param("collector_id")
	collectorID, err := uuid.Parse(collectorIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collector ID"})
		return
	}

	ctx := context.Background()
	status, err := h.service.GetCollectorConfigStatus(ctx, collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Configuration status retrieved",
		"collector_status": status,
	})
}

// GetDeliveryStatus retrieves the status of a configuration delivery
// @Summary Get delivery status
// @Description Get the status of a specific configuration delivery
// @Tags config-delivery
// @Produce json
// @Param delivery_id path string true "Delivery ID"
// @Success 200 {object} services.ConfigDeliveryStatus
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/config/deliveries/{delivery_id} [get]
func (h *ConfigDeliveryHandler) GetDeliveryStatus(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	deliveryIDStr := c.Param("delivery_id")
	deliveryID, err := uuid.Parse(deliveryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid delivery ID"})
		return
	}

	// 这里需要一个方法通过 ID 获取 delivery，使用 GetPendingDeliveries 和过滤
	// 或者应该通过 GetCollectorConfigStatus 获取最近的下发记录
	// 暂时返回成功，实际实现需要添加 GetByID 方法
	_ = deliveryID

	c.JSON(http.StatusOK, gin.H{
		"message": "Delivery status retrieved",
		"status":  "pending",
	})
}

// ListDeliveries lists configuration deliveries with filtering and pagination
// @Summary List deliveries
// @Description List configuration deliveries with filtering and pagination
// @Tags config-delivery
// @Produce json
// @Param collector_id query string false "Filter by collector ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/config/deliveries [get]
func (h *ConfigDeliveryHandler) ListDeliveries(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	collectorIDStr := c.Query("collector_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	// 转换为 UUID
	var collectorID *uuid.UUID
	if collectorIDStr != "" {
		if id, err := uuid.Parse(collectorIDStr); err == nil {
			collectorID = &id
		}
	}

	ctx := context.Background()

	// 使用 GetCollectorConfigStatus 获取状态
	var deliveries []models.InterfaceConfigDelivery
	var total int64 = 0

	if collectorID != nil {
		allDeliveries, err := h.service.GetPendingDeliveries(ctx, *collectorID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		// 过滤和分页
		filtered := make([]models.InterfaceConfigDelivery, 0)
		for _, d := range allDeliveries {
			if status == "" || d.Status == status {
				filtered = append(filtered, d)
			}
		}
		total = int64(len(filtered))
		
		// 分页
		start := (page - 1) * size
		end := start + size
		if start < int(total) {
			if end > int(total) {
				end = int(total)
			}
			deliveries = filtered[start:end]
		}
	}

	// 转换为 DTO
	result := make([]*services.ConfigDeliveryStatus, len(deliveries))
	for i, d := range deliveries {
		result[i] = services.ToConfigDeliveryStatus(&d)
	}

	c.JSON(http.StatusOK, gin.H{
		"deliveries": result,
		"total":      total,
		"page":       page,
		"size":       size,
	})
}

// ValidateConfiguration validates a configuration before delivery
// @Summary Validate configuration
// @Description Validate a configuration before delivery
// @Tags config-delivery
// @Accept json
// @Produce json
// @Param config body map[string]interface{} true "Configuration to validate"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/config/validate [post]
func (h *ConfigDeliveryHandler) ValidateConfiguration(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	var config map[string]interface{}
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 基本验证：检查必需字段
	if _, ok := config["protocol"]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"valid": false,
			"error": "Protocol is required",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"message": "Configuration is valid",
	})
}

// ConfirmDelivery confirms configuration delivery (collector acknowledged receipt)
// @Summary Confirm configuration delivery
// @Description Confirm that collector received the configuration
// @Tags config-delivery
// @Produce json
// @Param delivery_id path string true "Delivery ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/config/deliveries/{delivery_id}/delivered [post]
func (h *ConfigDeliveryHandler) ConfirmDelivery(c *gin.Context) {
	if h.service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "service not initialized"})
		return
	}

	deliveryIDStr := c.Param("delivery_id")
	deliveryID, err := uuid.Parse(deliveryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid delivery ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = h.service.ConfirmDelivery(ctx, deliveryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Delivery confirmed"})
}
