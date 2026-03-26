package handlers

import (
	"net/http"
	"strconv"

	"prodb/platform/backend/models"
	"prodb/platform/backend/repository"
	"prodb/platform/backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CollectorInterfaceHandler 采集器接口配置Handler
type CollectorInterfaceHandler struct {
	interfaceRepo   *repository.CollectorInterfaceRepository
	deliveryService *services.ConfigDeliveryService
	configAssembler *services.ConfigAssembler
}

// NewCollectorInterfaceHandler 创建Handler
func NewCollectorInterfaceHandler(
	interfaceRepo *repository.CollectorInterfaceRepository,
	deliveryService *services.ConfigDeliveryService,
	configAssembler *services.ConfigAssembler,
) *CollectorInterfaceHandler {
	return &CollectorInterfaceHandler{
		interfaceRepo:   interfaceRepo,
		deliveryService: deliveryService,
		configAssembler: configAssembler,
	}
}

// ==================== CRUD接口 ====================

// CreateInterface godoc
// @Summary 创建采集器接口配置
// @Description 为指定采集器创建一个新的数据采集接口
// @Tags 采集器接口
// @Accept json
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param request body CreateInterfaceRequest true "接口配置"
// @Success 201 {object} models.CollectorInterface
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/collectors/{collector_id}/interfaces [post]
func (h *CollectorInterfaceHandler) CreateInterface(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("collector_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid collector_id"})
		return
	}

	var req CreateInterfaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	// 构建创建请求
	createReq := &services.CreateInterfaceRequest{
		CollectorID:      collectorID,
		Name:             req.Name,
		Protocol:         models.ProtocolType(req.Protocol),
		Enabled:          req.Enabled,
		ConnectionConfig: req.ConnectionConfig,
		DataPoints:       req.DataPoints,
		EdgeProcessing:   req.EdgeProcessing,
		ScheduleConfig:   req.ScheduleConfig,
		TargetConfig:     req.TargetConfig,
	}

	// TODO: 从上下文获取当前用户ID
	// createReq.CreatedBy = getCurrentUserID(c)

	iface, err := h.deliveryService.CreateInterface(c.Request.Context(), createReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, iface)
}

// GetInterfaces godoc
// @Summary 获取采集器接口列表
// @Description 获取指定采集器的所有接口配置列表
// @Tags 采集器接口
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param protocol query string false "协议类型过滤"
// @Param enabled query bool false "启用状态过滤"
// @Param keyword query string false "关键词搜索"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} ListInterfacesResponse
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/collectors/{collector_id}/interfaces [get]
func (h *CollectorInterfaceHandler) GetInterfaces(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("collector_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid collector_id"})
		return
	}

	// 构建过滤条件
	filter := repository.InterfaceFilter{
		CollectorID: &collectorID,
	}

	// 解析可选参数
	if protocol := c.Query("protocol"); protocol != "" {
		filter.Protocol = &protocol
	}
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		enabled := enabledStr == "true"
		filter.Enabled = &enabled
	}
	if keyword := c.Query("keyword"); keyword != "" {
		filter.Keyword = &keyword
	}

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize
	filter.SetDefaults()

	interfaces, total, err := h.interfaceRepo.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, ListInterfacesResponse{
		Items:      interfaces,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
	})
}

// GetInterface godoc
// @Summary 获取接口配置详情
// @Description 获取指定接口配置的详细信息
// @Tags 采集器接口
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param interface_id path string true "接口ID"
// @Success 200 {object} models.CollectorInterface
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/collectors/{collector_id}/interfaces/{interface_id} [get]
func (h *CollectorInterfaceHandler) GetInterface(c *gin.Context) {
	interfaceID, err := uuid.Parse(c.Param("interface_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid interface_id"})
		return
	}

	iface, err := h.interfaceRepo.GetByID(c.Request.Context(), interfaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}
	if iface == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "interface not found"})
		return
	}

	c.JSON(http.StatusOK, iface)
}

// UpdateInterface godoc
// @Summary 更新接口配置
// @Description 更新指定接口的配置信息
// @Tags 采集器接口
// @Accept json
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param interface_id path string true "接口ID"
// @Param request body UpdateInterfaceRequest true "更新的配置"
// @Success 200 {object} models.CollectorInterface
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/collectors/{collector_id}/interfaces/{interface_id} [put]
func (h *CollectorInterfaceHandler) UpdateInterface(c *gin.Context) {
	interfaceID, err := uuid.Parse(c.Param("interface_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid interface_id"})
		return
	}

	var req UpdateInterfaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	// 构建更新请求
	updateReq := &services.UpdateInterfaceRequest{
		Name:             req.Name,
		Protocol:         models.ProtocolType(req.Protocol),
		ConnectionConfig: req.ConnectionConfig,
		DataPoints:       req.DataPoints,
		EdgeProcessing:   req.EdgeProcessing,
		ScheduleConfig:   req.ScheduleConfig,
		TargetConfig:     req.TargetConfig,
	}

	if req.Enabled != nil {
		updateReq.Enabled = req.Enabled
	}

	// TODO: 从上下文获取当前用户ID
	// updateReq.UpdatedBy = getCurrentUserID(c)

	iface, err := h.deliveryService.UpdateInterface(c.Request.Context(), interfaceID, updateReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, iface)
}

// DeleteInterface godoc
// @Summary 删除接口配置
// @Description 删除指定的接口配置
// @Tags 采集器接口
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param interface_id path string true "接口ID"
// @Success 200 {object} SuccessResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/collectors/{collector_id}/interfaces/{interface_id} [delete]
func (h *CollectorInterfaceHandler) DeleteInterface(c *gin.Context) {
	interfaceID, err := uuid.Parse(c.Param("interface_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid interface_id"})
		return
	}

	if err := h.deliveryService.DeleteInterface(c.Request.Context(), interfaceID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "interface deleted successfully"})
}

// ==================== 配置管理接口 ====================

// GetCollectorConfig godoc
// @Summary 获取采集器完整配置
// @Description 获取采集器的完整配置（供Collector拉取）
// @Tags 配置下发
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param version query int false "版本号（用于增量同步）"
// @Success 200 {object} services.CollectorConfig
// @Router /api/v1/collectors/{collector_id}/config [get]
func (h *CollectorInterfaceHandler) GetCollectorConfig(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("collector_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid collector_id"})
		return
	}

	// 检查是否需要增量同步
	versionStr := c.Query("version")
	if versionStr != "" {
		sinceVersion, err := strconv.Atoi(versionStr)
		if err == nil && sinceVersion > 0 {
			// 返回增量配置
			delta, err := h.configAssembler.CalculateDelta(c.Request.Context(), collectorID, sinceVersion)
			if err != nil {
				c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
				return
			}
			c.JSON(http.StatusOK, delta)
			return
		}
	}

	// 返回完整配置
	config, err := h.configAssembler.AssembleCollectorConfig(c.Request.Context(), collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// GetConfigStatus godoc
// @Summary 获取采集器配置状态
// @Description 获取采集器的配置下发状态
// @Tags 配置下发
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Success 200 {object} services.DeliveryStatusResponse
// @Router /api/v1/collectors/{collector_id}/config/status [get]
func (h *CollectorInterfaceHandler) GetConfigStatus(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("collector_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid collector_id"})
		return
	}

	status, err := h.deliveryService.GetCollectorConfigStatus(c.Request.Context(), collectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	// 获取最近的下发记录
	recentDeliveries, _ := h.deliveryService.GetPendingDeliveries(c.Request.Context(), collectorID)

	c.JSON(http.StatusOK, services.DeliveryStatusResponse{
		CollectorID:      collectorID,
		LatestVersion:    status.LatestVersion,
		AppliedVersion:   status.AppliedVersion,
		IsSynced:         status.IsSynced(),
		PendingCount:     status.PendingCount,
		FailedCount:      status.FailedCount,
		RecentDeliveries: recentDeliveries,
	})
}

// ConfirmConfigApplied godoc
// @Summary 确认配置已应用
// @Description Collector调用此接口确认配置已成功应用
// @Tags 配置下发
// @Accept json
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param request body ConfirmAppliedRequest true "确认信息"
// @Success 200 {object} SuccessResponse
// @Router /api/v1/collectors/{collector_id}/config/confirm [post]
func (h *CollectorInterfaceHandler) ConfirmConfigApplied(c *gin.Context) {
	collectorID, err := uuid.Parse(c.Param("collector_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid collector_id"})
		return
	}

	var req ConfirmAppliedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	// TODO: 验证Collector身份，可使用 collectorID 进行身份验证
	_ = collectorID // 临时使用，避免编译错误

	// 确认配置已应用
	if req.DeliveryID != nil {
		deliveryID, err := uuid.Parse(*req.DeliveryID)
		if err == nil {
			if err := h.deliveryService.ConfirmApplied(c.Request.Context(), deliveryID, req.Version); err != nil {
				c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
				return
			}
		}
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "config applied confirmed"})
}

// ==================== 历史记录接口 ====================

// GetInterfaceHistory godoc
// @Summary 获取接口配置历史
// @Description 获取指定接口的配置变更历史
// @Tags 配置历史
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param interface_id path string true "接口ID"
// @Success 200 {array} models.InterfaceConfigHistory
// @Router /api/v1/collectors/{collector_id}/interfaces/{interface_id}/history [get]
func (h *CollectorInterfaceHandler) GetInterfaceHistory(c *gin.Context) {
	interfaceID, err := uuid.Parse(c.Param("interface_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid interface_id"})
		return
	}

	history, err := h.deliveryService.GetInterfaceHistory(c.Request.Context(), interfaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

// RollbackInterface godoc
// @Summary 回滚接口配置
// @Description 将接口配置回滚到指定版本
// @Tags 配置历史
// @Accept json
// @Produce json
// @Param collector_id path string true "采集器ID"
// @Param interface_id path string true "接口ID"
// @Param request body RollbackRequest true "回滚请求"
// @Success 200 {object} models.CollectorInterface
// @Router /api/v1/collectors/{collector_id}/interfaces/{interface_id}/rollback [post]
func (h *CollectorInterfaceHandler) RollbackInterface(c *gin.Context) {
	interfaceID, err := uuid.Parse(c.Param("interface_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid interface_id"})
		return
	}

	var req RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	// TODO: 从上下文获取当前用户ID
	// userID := getCurrentUserID(c)
	var userID *uint

	iface, err := h.deliveryService.RollbackInterface(c.Request.Context(), interfaceID, req.TargetVersion, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, iface)
}

// ==================== DTO定义 ====================

// CreateInterfaceRequest 创建接口请求
type CreateInterfaceRequest struct {
	Name             string                           `json:"name" binding:"required"`
	Protocol         string                           `json:"protocol" binding:"required,oneof=modbus_tcp modbus_rtu opcua mqtt"`
	Enabled          bool                             `json:"enabled"`
	ConnectionConfig models.ConnectionConfig          `json:"connection_config"`
	DataPoints       models.DataPoints                `json:"data_points" binding:"required,min=1"`
	EdgeProcessing   models.EdgeProcessingConfig      `json:"edge_processing"`
	ScheduleConfig   models.ScheduleConfig            `json:"schedule_config"`
	TargetConfig     models.TargetConfig              `json:"target_config"`
}

// UpdateInterfaceRequest 更新接口请求
type UpdateInterfaceRequest struct {
	Name             string                           `json:"name"`
	Protocol         string                           `json:"protocol" binding:"omitempty,oneof=modbus_tcp modbus_rtu opcua mqtt"`
	Enabled          *bool                            `json:"enabled"`
	ConnectionConfig *models.ConnectionConfig         `json:"connection_config"`
	DataPoints       *models.DataPoints               `json:"data_points"`
	EdgeProcessing   *models.EdgeProcessingConfig     `json:"edge_processing"`
	ScheduleConfig   *models.ScheduleConfig           `json:"schedule_config"`
	TargetConfig     *models.TargetConfig             `json:"target_config"`
}

// ListInterfacesResponse 接口列表响应
type ListInterfacesResponse struct {
	Items      []models.CollectorInterface `json:"items"`
	Total      int64                       `json:"total"`
	Page       int                         `json:"page"`
	PageSize   int                         `json:"page_size"`
	TotalPages int                         `json:"total_pages"`
}

// ConfirmAppliedRequest 确认配置应用请求
type ConfirmAppliedRequest struct {
	DeliveryID *string `json:"delivery_id"`
	Version    int     `json:"version" binding:"required"`
}

// RollbackRequest 回滚请求
type RollbackRequest struct {
	TargetVersion int `json:"target_version" binding:"required,min=1"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse 成功响应
type SuccessResponse struct {
	Message string `json:"message"`
}
