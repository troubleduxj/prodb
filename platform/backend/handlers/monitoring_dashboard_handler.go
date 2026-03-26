package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MonitoringDashboardHandler 监控仪表板处理器
type MonitoringDashboardHandler struct {
	// 这里可以添加依赖的服务
}

// NewMonitoringDashboardHandler 创建监控仪表板处理器
func NewMonitoringDashboardHandler() *MonitoringDashboardHandler {
	return &MonitoringDashboardHandler{}
}

// Dashboard 仪表板结构
type Dashboard struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Layout      []DashboardWidget      `json:"layout"`
	Settings    map[string]interface{} `json:"settings"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	CreatedBy   string                 `json:"created_by"`
}

// DashboardWidget 仪表板组件
type DashboardWidget struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Title    string                 `json:"title"`
	Position WidgetPosition         `json:"position"`
	Config   map[string]interface{} `json:"config"`
}

// WidgetPosition 组件位置
type WidgetPosition struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// DashboardTemplate 仪表板模板
type DashboardTemplate struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	Widgets     []DashboardWidget `json:"widgets"`
	Preview     string            `json:"preview,omitempty"`
}

// SystemMetrics 系统指标
type SystemMetrics struct {
	CPU    CPUMetrics    `json:"cpu"`
	Memory MemoryMetrics `json:"memory"`
	Disk   DiskMetrics   `json:"disk"`
	Network NetworkMetrics `json:"network"`
	Timestamp time.Time   `json:"timestamp"`
}

type CPUMetrics struct {
	Usage     float64 `json:"usage"`
	Cores     int     `json:"cores"`
	LoadAvg   []float64 `json:"load_avg"`
}

type MemoryMetrics struct {
	Total     uint64  `json:"total"`
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	Usage     float64 `json:"usage"`
}

type DiskMetrics struct {
	Total     uint64  `json:"total"`
	Used      uint64  `json:"used"`
	Available uint64  `json:"available"`
	Usage     float64 `json:"usage"`
}

type NetworkMetrics struct {
	BytesIn  uint64 `json:"bytes_in"`
	BytesOut uint64 `json:"bytes_out"`
	PacketsIn uint64 `json:"packets_in"`
	PacketsOut uint64 `json:"packets_out"`
}

// GetDashboards 获取仪表板列表
// @Summary 获取仪表板列表
// @Description 获取用户的仪表板列表
// @Tags Monitoring
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards [get]
func (h *MonitoringDashboardHandler) GetDashboards(c *gin.Context) {
	// 模拟数据
	dashboards := []Dashboard{
		{
			ID:          uuid.New().String(),
			Name:        "系统概览",
			Description: "系统整体运行状态监控",
			Layout:      []DashboardWidget{},
			Settings:    map[string]interface{}{},
			CreatedAt:   time.Now().Add(-24 * time.Hour),
			UpdatedAt:   time.Now(),
			CreatedBy:   "admin",
		},
		{
			ID:          uuid.New().String(),
			Name:        "采集器监控",
			Description: "数据采集器状态和性能监控",
			Layout:      []DashboardWidget{},
			Settings:    map[string]interface{}{},
			CreatedAt:   time.Now().Add(-12 * time.Hour),
			UpdatedAt:   time.Now(),
			CreatedBy:   "admin",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    dashboards,
		"total":   len(dashboards),
	})
}

// CreateDashboard 创建仪表板
// @Summary 创建新仪表板
// @Description 创建一个新的监控仪表板
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param dashboard body Dashboard true "仪表板信息"
// @Success 201 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards [post]
func (h *MonitoringDashboardHandler) CreateDashboard(c *gin.Context) {
	var dashboard Dashboard
	if err := c.ShouldBindJSON(&dashboard); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid dashboard data: " + err.Error(),
		})
		return
	}

	// 设置默认值
	dashboard.ID = uuid.New().String()
	dashboard.CreatedAt = time.Now()
	dashboard.UpdatedAt = time.Now()
	dashboard.CreatedBy = "admin" // 这里应该从认证信息获取

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    dashboard,
	})
}

// GetDashboard 获取单个仪表板
// @Summary 获取仪表板详情
// @Description 根据ID获取仪表板详细信息
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param id path string true "仪表板ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards/{id} [get]
func (h *MonitoringDashboardHandler) GetDashboard(c *gin.Context) {
	id := c.Param("id")
	
	// 模拟数据，匹配前端期望的格式
	dashboard := map[string]interface{}{
		"id":          id,
		"name":        "系统概览",
		"description": "系统整体运行状态监控",
		"layout": map[string]interface{}{
			"cols":             12,
			"rows":             20,
			"margin":           []int{10, 10},
			"containerPadding": []int{10, 10},
			"rowHeight":        60,
		},
		"widgets": []map[string]interface{}{
			{
				"id":    "widget-1",
				"type":  "metric",
				"title": "CPU使用率",
				"position": map[string]interface{}{
					"x": 0,
					"y": 0,
					"w": 3,
					"h": 3,
				},
				"config": map[string]interface{}{
					"metric": map[string]interface{}{
						"value":      "cpu_usage",
						"unit":       "%",
						"format":     "percentage",
						"showTrend":  true,
						"trendPeriod": 5,
					},
				},
				"dataSource": map[string]interface{}{
					"type": "api",
					"config": map[string]interface{}{
						"url": "/api/v1/monitoring/widgets/widget-1/data",
					},
				},
			},
			{
				"id":    "widget-2",
				"type":  "chart",
				"title": "内存使用趋势",
				"position": map[string]interface{}{
					"x": 3,
					"y": 0,
					"w": 6,
					"h": 4,
				},
				"config": map[string]interface{}{
					"chart": map[string]interface{}{
						"type":      "line",
						"xAxis":     "timestamp",
						"yAxis":     []string{"value"},
						"timeRange": 60,
					},
				},
				"dataSource": map[string]interface{}{
					"type": "api",
					"config": map[string]interface{}{
						"url": "/api/v1/monitoring/widgets/widget-2/data",
					},
				},
			},
			{
				"id":    "widget-3",
				"type":  "gauge",
				"title": "磁盘使用率",
				"position": map[string]interface{}{
					"x": 9,
					"y": 0,
					"w": 3,
					"h": 3,
				},
				"config": map[string]interface{}{
					"gauge": map[string]interface{}{
						"min":  0,
						"max":  100,
						"unit": "%",
						"thresholds": []map[string]interface{}{
							{"min": 0, "max": 60, "color": "#22c55e", "label": "正常"},
							{"min": 60, "max": 80, "color": "#f59e0b", "label": "警告"},
							{"min": 80, "max": 100, "color": "#ef4444", "label": "危险"},
						},
					},
				},
				"dataSource": map[string]interface{}{
					"type": "api",
					"config": map[string]interface{}{
						"url": "/api/v1/monitoring/widgets/widget-3/data",
					},
				},
			},
			{
				"id":    "widget-4",
				"type":  "status",
				"title": "系统状态",
				"position": map[string]interface{}{
					"x": 0,
					"y": 3,
					"w": 6,
					"h": 3,
				},
				"config": map[string]interface{}{
					"status": map[string]interface{}{
						"layout": "grid",
						"items": []map[string]interface{}{
							{
								"id":          "status-1",
								"label":       "采集器状态",
								"value":       "20/25",
								"status":      "warning",
								"description": "20个在线，5个离线",
							},
							{
								"id":          "status-2",
								"label":       "数据库连接",
								"value":       "正常",
								"status":      "online",
								"description": "TDengine 连接正常",
							},
						},
					},
				},
				"dataSource": map[string]interface{}{
					"type": "api",
					"config": map[string]interface{}{
						"url": "/api/v1/monitoring/widgets/widget-4/data",
					},
				},
			},
		},
		"refreshInterval": 30,
		"isPublic":        false,
		"createdAt":       time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
		"updatedAt":       time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, dashboard)
}

// UpdateDashboard 更新仪表板
// @Summary 更新仪表板
// @Description 更新仪表板信息
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param id path string true "仪表板ID"
// @Param dashboard body Dashboard true "仪表板信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards/{id} [put]
func (h *MonitoringDashboardHandler) UpdateDashboard(c *gin.Context) {
	id := c.Param("id")
	
	var dashboard Dashboard
	if err := c.ShouldBindJSON(&dashboard); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid dashboard data: " + err.Error(),
		})
		return
	}

	dashboard.ID = id
	dashboard.UpdatedAt = time.Now()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    dashboard,
	})
}

// DeleteDashboard 删除仪表板
// @Summary 删除仪表板
// @Description 删除指定的仪表板
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param id path string true "仪表板ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards/{id} [delete]
func (h *MonitoringDashboardHandler) DeleteDashboard(c *gin.Context) {
	id := c.Param("id")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Dashboard deleted successfully",
		"id":      id,
	})
}

// GetDashboardTemplates 获取仪表板模板
// @Summary 获取仪表板模板列表
// @Description 获取可用的仪表板模板
// @Tags Monitoring
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/templates [get]
func (h *MonitoringDashboardHandler) GetDashboardTemplates(c *gin.Context) {
	templates := []DashboardTemplate{
		{
			ID:          "template-1",
			Name:        "系统监控模板",
			Description: "包含CPU、内存、磁盘、网络监控的基础模板",
			Category:    "system",
			Widgets: []DashboardWidget{
				{
					ID:    "widget-cpu",
					Type:  "gauge",
					Title: "CPU使用率",
					Position: WidgetPosition{X: 0, Y: 0, Width: 3, Height: 3},
					Config: map[string]interface{}{"metric": "cpu_usage", "unit": "%"},
				},
				{
					ID:    "widget-memory",
					Type:  "gauge",
					Title: "内存使用率",
					Position: WidgetPosition{X: 3, Y: 0, Width: 3, Height: 3},
					Config: map[string]interface{}{"metric": "memory_usage", "unit": "%"},
				},
			},
		},
		{
			ID:          "template-2",
			Name:        "采集器监控模板",
			Description: "专门用于监控数据采集器状态和性能的模板",
			Category:    "collector",
			Widgets: []DashboardWidget{
				{
					ID:    "widget-collector-status",
					Type:  "status",
					Title: "采集器状态",
					Position: WidgetPosition{X: 0, Y: 0, Width: 6, Height: 2},
					Config: map[string]interface{}{"source": "collectors"},
				},
				{
					ID:    "widget-data-rate",
					Type:  "chart",
					Title: "数据采集速率",
					Position: WidgetPosition{X: 0, Y: 2, Width: 12, Height: 4},
					Config: map[string]interface{}{"chartType": "line", "metric": "data_rate"},
				},
			},
		},
		{
			ID:          "template-3",
			Name:        "网络监控模板",
			Description: "网络流量和连接状态监控模板",
			Category:    "network",
			Widgets: []DashboardWidget{
				{
					ID:    "widget-network-traffic",
					Type:  "chart",
					Title: "网络流量",
					Position: WidgetPosition{X: 0, Y: 0, Width: 8, Height: 4},
					Config: map[string]interface{}{"chartType": "area", "metric": "network_traffic"},
				},
			},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    templates,
		"total":   len(templates),
	})
}

// CreateDashboardFromTemplate 从模板创建仪表板
// @Summary 从模板创建仪表板
// @Description 基于模板创建新的仪表板
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "创建请求"
// @Success 201 {object} map[string]interface{}
// @Router /api/v1/monitoring/dashboards/from-template [post]
func (h *MonitoringDashboardHandler) CreateDashboardFromTemplate(c *gin.Context) {
	var request struct {
		TemplateID string `json:"template_id"`
		Name       string `json:"name"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// 模拟从模板创建仪表板
	dashboard := Dashboard{
		ID:          uuid.New().String(),
		Name:        request.Name,
		Description: "从模板创建的仪表板",
		Layout:      []DashboardWidget{}, // 这里应该从模板复制组件
		Settings:    map[string]interface{}{"refreshInterval": 30},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CreatedBy:   "admin",
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    dashboard,
	})
}

// GetSystemMetrics 获取系统指标
// @Summary 获取系统性能指标
// @Description 获取当前系统的CPU、内存、磁盘、网络等指标
// @Tags Monitoring
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/system/metrics [get]
func (h *MonitoringDashboardHandler) GetSystemMetrics(c *gin.Context) {
	// 模拟系统指标数据，匹配前端期望的格式
	metrics := map[string]interface{}{
		"totalCollectors":     25,
		"onlineCollectors":    20,
		"offlineCollectors":   3,
		"errorCollectors":     2,
		"totalDataPoints":     1500000,
		"dataPointsPerSecond": 1250,
		"alertCount":          8,
		"criticalAlertCount":  2,
		"systemHealth": map[string]interface{}{
			"cpu": map[string]interface{}{
				"usage":   65.5,
				"cores":   8,
				"loadAvg": []float64{1.2, 1.5, 1.8},
			},
			"memory": map[string]interface{}{
				"total":     16 * 1024 * 1024 * 1024, // 16GB
				"used":      8 * 1024 * 1024 * 1024,  // 8GB
				"available": 8 * 1024 * 1024 * 1024,  // 8GB
				"usage":     50.0,
			},
			"disk": map[string]interface{}{
				"total":     500 * 1024 * 1024 * 1024, // 500GB
				"used":      200 * 1024 * 1024 * 1024, // 200GB
				"available": 300 * 1024 * 1024 * 1024, // 300GB
				"usage":     40.0,
			},
			"network": map[string]interface{}{
				"bytesIn":    1024 * 1024 * 100, // 100MB
				"bytesOut":   1024 * 1024 * 50,  // 50MB
				"packetsIn":  10000,
				"packetsOut": 8000,
			},
		},
		"timestamp": time.Now(),
	}

	c.JSON(http.StatusOK, metrics)
}

// GetAlerts 获取告警列表
// @Summary 获取告警列表
// @Description 获取系统告警信息
// @Tags Monitoring
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/alerts [get]
func (h *MonitoringDashboardHandler) GetAlerts(c *gin.Context) {
	// 模拟告警数据
	alerts := []map[string]interface{}{
		{
			"id":           "alert-1",
			"title":        "采集器连接异常",
			"message":      "采集器 collector-001 连接中断超过5分钟",
			"severity":     "error",
			"source":       "collector-001",
			"timestamp":    time.Now().Add(-10 * time.Minute).Format(time.RFC3339),
			"acknowledged": false,
			"collectorId":  "collector-001",
		},
		{
			"id":           "alert-2",
			"title":        "内存使用率过高",
			"message":      "系统内存使用率达到85%，建议检查内存泄漏",
			"severity":     "warning",
			"source":       "system",
			"timestamp":    time.Now().Add(-5 * time.Minute).Format(time.RFC3339),
			"acknowledged": false,
		},
		{
			"id":           "alert-3",
			"title":        "数据采集速率下降",
			"message":      "数据采集速率从1500/s下降到800/s",
			"severity":     "warning",
			"source":       "data-collector",
			"timestamp":    time.Now().Add(-2 * time.Minute).Format(time.RFC3339),
			"acknowledged": true,
		},
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"alerts": alerts,
		"total":  len(alerts),
	})
}

// AcknowledgeAlert 确认告警
// @Summary 确认单个告警
// @Description 确认指定的告警
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param id path string true "告警ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/alerts/{id}/acknowledge [post]
func (h *MonitoringDashboardHandler) AcknowledgeAlert(c *gin.Context) {
	alertId := c.Param("id")

	c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Alert acknowledged successfully",
		"alertId": alertId,
	})
}

// AcknowledgeAlerts 批量确认告警
// @Summary 批量确认告警
// @Description 批量确认多个告警
// @Tags Monitoring
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/alerts/acknowledge-batch [post]
func (h *MonitoringDashboardHandler) AcknowledgeAlerts(c *gin.Context) {
	var request struct {
		AlertIds []string `json:"alertIds"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Alerts acknowledged successfully",
		"count":   len(request.AlertIds),
	})
}

// GetWidgetData 获取组件数据
// @Summary 获取组件数据
// @Description 获取指定组件的数据
// @Tags Monitoring
// @Accept json
// @Produce json
// @Param id path string true "组件ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/monitoring/widgets/{id}/data [get]
func (h *MonitoringDashboardHandler) GetWidgetData(c *gin.Context) {
	_ = c.Param("id") // widgetId not used in mock implementation

	// 模拟组件数据
	now := time.Now()
	data := make([]map[string]interface{}, 20)
	
	for i := 0; i < 20; i++ {
		timestamp := now.Add(time.Duration(-i) * time.Minute)
		value := 50 + float64(i%10)*5 + float64(i%3)*2
		
		data[19-i] = map[string]interface{}{
			"timestamp": timestamp.Format(time.RFC3339),
			"value":     value,
			"tags": map[string]string{
				"source": "system",
				"type":   "metric",
			},
		}
	}

	c.JSON(http.StatusOK, data)
}

// RegisterRoutes 注册路由
func (h *MonitoringDashboardHandler) RegisterRoutes(r *gin.RouterGroup) {
	monitoring := r.Group("/monitoring")
	{
		// 仪表板管理
		monitoring.GET("/dashboards", h.GetDashboards)
		monitoring.POST("/dashboards", h.CreateDashboard)
		monitoring.GET("/dashboards/:id", h.GetDashboard)
		monitoring.PUT("/dashboards/:id", h.UpdateDashboard)
		monitoring.DELETE("/dashboards/:id", h.DeleteDashboard)
		monitoring.POST("/dashboards/from-template", h.CreateDashboardFromTemplate)
		
		// 组件数据
		monitoring.GET("/widgets/:id/data", h.GetWidgetData)
		
		// 告警管理
		monitoring.GET("/alerts", h.GetAlerts)
		monitoring.POST("/alerts/:id/acknowledge", h.AcknowledgeAlert)
		monitoring.POST("/alerts/acknowledge-batch", h.AcknowledgeAlerts)
		
		// 模板管理
		monitoring.GET("/templates", h.GetDashboardTemplates)
		
		// 系统指标
		monitoring.GET("/system/metrics", h.GetSystemMetrics)
	}
}