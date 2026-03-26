package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"prodb/platform/backend/services"
)

// ScalabilityHandler 可扩展性处理器
type ScalabilityHandler struct {
	scalabilityManager *services.ScalabilityManager
}

// NewScalabilityHandler 创建可扩展性处理器
func NewScalabilityHandler(scalabilityManager *services.ScalabilityManager) *ScalabilityHandler {
	return &ScalabilityHandler{
		scalabilityManager: scalabilityManager,
	}
}

// GetMetrics 获取可扩展性指标
// @Summary 获取可扩展性指标
// @Description 获取系统可扩展性相关的指标信息
// @Tags Scalability
// @Accept json
// @Produce json
// @Success 200 {object} services.ScalabilityMetrics
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/metrics [get]
func (h *ScalabilityHandler) GetMetrics(c *gin.Context) {
	metrics := h.scalabilityManager.GetMetrics()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    metrics,
	})
}

// RegisterService 注册服务
// @Summary 注册服务到服务发现
// @Description 将服务实例注册到服务发现系统
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service body services.ServiceInfo true "服务信息"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/register [post]
func (h *ScalabilityHandler) RegisterService(c *gin.Context) {
	var service services.ServiceInfo
	if err := c.ShouldBindJSON(&service); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid service information: " + err.Error(),
		})
		return
	}

	if err := h.scalabilityManager.RegisterService(&service); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Service registered successfully",
		"service_id": service.ID,
	})
}

// DeregisterService 注销服务
// @Summary 注销服务
// @Description 从服务发现系统中注销服务实例
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_id path string true "服务ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_id} [delete]
func (h *ScalabilityHandler) DeregisterService(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service ID is required",
		})
		return
	}

	if err := h.scalabilityManager.DeregisterService(serviceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Service deregistered successfully",
	})
}

// DiscoverServices 发现服务
// @Summary 发现服务实例
// @Description 从服务发现系统中查找指定服务的所有实例
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_name path string true "服务名称"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_name}/discover [get]
func (h *ScalabilityHandler) DiscoverServices(c *gin.Context) {
	serviceName := c.Param("service_name")
	if serviceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service name is required",
		})
		return
	}

	services, err := h.scalabilityManager.DiscoverServices(serviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"service_name": serviceName,
			"instances":    services,
			"count":        len(services),
		},
	})
}

// GetServiceInstance 获取服务实例（负载均衡）
// @Summary 获取服务实例
// @Description 通过负载均衡算法获取服务实例
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_name path string true "服务名称"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_name}/instance [get]
func (h *ScalabilityHandler) GetServiceInstance(c *gin.Context) {
	serviceName := c.Param("service_name")
	if serviceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service name is required",
		})
		return
	}

	instance, err := h.scalabilityManager.GetServiceInstance(serviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    instance,
	})
}

// UpdateServiceHealth 更新服务健康状态
// @Summary 更新服务健康状态
// @Description 更新指定服务实例的健康状态
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_id path string true "服务ID"
// @Param health body map[string]bool true "健康状态"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_id}/health [put]
func (h *ScalabilityHandler) UpdateServiceHealth(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service ID is required",
		})
		return
	}

	var healthData struct {
		Healthy bool `json:"healthy"`
	}
	if err := c.ShouldBindJSON(&healthData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid health data: " + err.Error(),
		})
		return
	}

	if err := h.scalabilityManager.UpdateServiceHealth(serviceID, healthData.Healthy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Service health updated successfully",
	})
}

// GetConfig 获取配置
// @Summary 获取配置
// @Description 从配置中心获取指定键的配置值
// @Tags Scalability
// @Accept json
// @Produce json
// @Param key path string true "配置键"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/config/{key} [get]
func (h *ScalabilityHandler) GetConfig(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Config key is required",
		})
		return
	}

	value, err := h.scalabilityManager.GetConfig(key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"key":   key,
			"value": value,
		},
	})
}

// SetConfig 设置配置
// @Summary 设置配置
// @Description 在配置中心设置指定键的配置值
// @Tags Scalability
// @Accept json
// @Produce json
// @Param key path string true "配置键"
// @Param config body map[string]interface{} true "配置值"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/config/{key} [put]
func (h *ScalabilityHandler) SetConfig(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Config key is required",
		})
		return
	}

	var configData struct {
		Value interface{} `json:"value"`
	}
	if err := c.ShouldBindJSON(&configData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid config data: " + err.Error(),
		})
		return
	}

	if err := h.scalabilityManager.SetConfig(key, configData.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Config set successfully",
	})
}

// ScaleUp 扩容服务
// @Summary 扩容服务
// @Description 增加指定服务的实例数量
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_name path string true "服务名称"
// @Param scale body map[string]int true "扩容数量"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_name}/scale-up [post]
func (h *ScalabilityHandler) ScaleUp(c *gin.Context) {
	serviceName := c.Param("service_name")
	if serviceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service name is required",
		})
		return
	}

	var scaleData struct {
		Count int `json:"count"`
	}
	if err := c.ShouldBindJSON(&scaleData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid scale data: " + err.Error(),
		})
		return
	}

	if scaleData.Count <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Scale count must be positive",
		})
		return
	}

	if err := h.scalabilityManager.ScaleUp(serviceName, scaleData.Count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Service scaled up successfully",
	})
}

// ScaleDown 缩容服务
// @Summary 缩容服务
// @Description 减少指定服务的实例数量
// @Tags Scalability
// @Accept json
// @Produce json
// @Param service_name path string true "服务名称"
// @Param scale body map[string]int true "缩容数量"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/services/{service_name}/scale-down [post]
func (h *ScalabilityHandler) ScaleDown(c *gin.Context) {
	serviceName := c.Param("service_name")
	if serviceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service name is required",
		})
		return
	}

	var scaleData struct {
		Count int `json:"count"`
	}
	if err := c.ShouldBindJSON(&scaleData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid scale data: " + err.Error(),
		})
		return
	}

	if scaleData.Count <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Scale count must be positive",
		})
		return
	}

	if err := h.scalabilityManager.ScaleDown(serviceName, scaleData.Count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Service scaled down successfully",
	})
}

// UpdateScalabilityConfig 更新可扩展性配置
// @Summary 更新可扩展性配置
// @Description 动态更新可扩展性管理器的配置参数
// @Tags Scalability
// @Accept json
// @Produce json
// @Param config body services.ScalabilityConfig true "可扩展性配置"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/config [put]
func (h *ScalabilityHandler) UpdateScalabilityConfig(c *gin.Context) {
	var config services.ScalabilityConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid configuration format: " + err.Error(),
		})
		return
	}

	if err := h.scalabilityManager.UpdateConfig(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Scalability configuration updated successfully",
	})
}

// GetLoadBalancerStats 获取负载均衡统计
// @Summary 获取负载均衡统计
// @Description 获取负载均衡器的详细统计信息
// @Tags Scalability
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/load-balancer/stats [get]
func (h *ScalabilityHandler) GetLoadBalancerStats(c *gin.Context) {
	metrics := h.scalabilityManager.GetMetrics()
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    metrics.LoadBalancerStats,
	})
}

// GetServiceDiscoveryStats 获取服务发现统计
// @Summary 获取服务发现统计
// @Description 获取服务发现的详细统计信息
// @Tags Scalability
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/scalability/service-discovery/stats [get]
func (h *ScalabilityHandler) GetServiceDiscoveryStats(c *gin.Context) {
	metrics := h.scalabilityManager.GetMetrics()
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    metrics.ServiceDiscoveryStats,
	})
}

// RegisterRoutes 注册路由
func (h *ScalabilityHandler) RegisterRoutes(r *gin.RouterGroup) {
	scalability := r.Group("/scalability")
	{
		// 指标和统计
		scalability.GET("/metrics", h.GetMetrics)
		scalability.GET("/load-balancer/stats", h.GetLoadBalancerStats)
		scalability.GET("/service-discovery/stats", h.GetServiceDiscoveryStats)
		
		// 服务管理
		services := scalability.Group("/services")
		{
			services.POST("/register", h.RegisterService)
			services.DELETE("/:service_id", h.DeregisterService)
			services.GET("/:service_name/discover", h.DiscoverServices)
			services.GET("/:service_name/instance", h.GetServiceInstance)
			services.PUT("/:service_id/health", h.UpdateServiceHealth)
			services.POST("/:service_name/scale-up", h.ScaleUp)
			services.POST("/:service_name/scale-down", h.ScaleDown)
		}
		
		// 配置管理
		config := scalability.Group("/config")
		{
			config.GET("/:key", h.GetConfig)
			config.PUT("/:key", h.SetConfig)
			config.PUT("", h.UpdateScalabilityConfig)
		}
	}
}