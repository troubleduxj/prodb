package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ProtocolCapability 协议能力
type ProtocolCapability struct {
	Protocol    string            `json:"protocol"`    // opcua, mqtt, modbus_tcp, modbus_rtu, http, etc.
	Version     string            `json:"version"`     // 协议版本
	Enabled     bool              `json:"enabled"`     // 是否启用
	MaxNodes    int               `json:"max_nodes"`   // 最大节点数
	Features    []string          `json:"features"`    // 支持的特性
	Config      map[string]string `json:"config"`      // 协议特定配置
}

// CollectorRegistrationRequest 采集器注册请求
type CollectorRegistrationRequest struct {
	CollectorID   string                `json:"collector_id" binding:"required"`
	SecretKey     string                `json:"secret_key" binding:"required"`
	Name          string                `json:"name"`
	Description   string                `json:"description"`
	Version       string                `json:"version"`
	Location      string                `json:"location"`      // 部署位置
	Environment   string                `json:"environment"`   // 环境：production, staging, development
	Protocols     []ProtocolCapability  `json:"protocols"`     // 支持的协议
	Tags          map[string]string     `json:"tags"`          // 标签
	Capabilities  map[string]interface{} `json:"capabilities"` // 其他能力
}

// CollectorInfo 采集器信息
type CollectorInfo struct {
	CollectorID   string                `json:"collector_id"`
	Name          string                `json:"name"`
	Description   string                `json:"description"`
	Version       string                `json:"version"`
	Location      string                `json:"location"`
	Environment   string                `json:"environment"`
	Protocols     []ProtocolCapability  `json:"protocols"`
	Tags          map[string]string     `json:"tags"`
	Capabilities  map[string]interface{} `json:"capabilities"`
	SecretKey     string                `json:"-"` // 不在JSON中暴露
	RegisteredAt  time.Time             `json:"registered_at"`
	LastHeartbeat time.Time             `json:"last_heartbeat"`
	Status        string                `json:"status"` // online, offline, error
}

// CollectorRegistrationResponse 采集器注册响应
type CollectorRegistrationResponse struct {
	Success      bool      `json:"success"`
	Message      string    `json:"message"`
	CollectorID  string    `json:"collector_id"`
	RegisteredAt time.Time `json:"registered_at"`
	Protocols    []string  `json:"protocols"` // 注册的协议列表
}

// CollectorRegistrationHandler 采集器注册处理器
type CollectorRegistrationHandler struct {
	registeredCollectors map[string]*CollectorInfo // collectorID -> CollectorInfo
}

// NewCollectorRegistrationHandler 创建采集器注册处理器
func NewCollectorRegistrationHandler() *CollectorRegistrationHandler {
	return &CollectorRegistrationHandler{
		registeredCollectors: make(map[string]*CollectorInfo),
	}
}

// RegisterCollector 注册采集器
func (h *CollectorRegistrationHandler) RegisterCollector(c *gin.Context) {
	var req CollectorRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	// 验证协议配置
	if len(req.Protocols) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "At least one protocol must be specified",
		})
		return
	}

	// 验证协议类型
	validProtocols := map[string]bool{
		"opcua":      true,
		"mqtt":       true,
		"modbus_tcp": true,
		"modbus_rtu": true,
		"http":       true,
		"https":      true,
		"tcp":        true,
		"udp":        true,
	}

	var enabledProtocols []string
	for _, protocol := range req.Protocols {
		if !validProtocols[protocol.Protocol] {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Unsupported protocol: " + protocol.Protocol,
			})
			return
		}
		if protocol.Enabled {
			enabledProtocols = append(enabledProtocols, protocol.Protocol)
		}
	}

	// 创建采集器信息
	collectorInfo := &CollectorInfo{
		CollectorID:   req.CollectorID,
		Name:          req.Name,
		Description:   req.Description,
		Version:       req.Version,
		Location:      req.Location,
		Environment:   req.Environment,
		Protocols:     req.Protocols,
		Tags:          req.Tags,
		Capabilities:  req.Capabilities,
		SecretKey:     req.SecretKey,
		RegisteredAt:  time.Now(),
		LastHeartbeat: time.Now(),
		Status:        "offline", // 初始状态为离线
	}

	// 存储采集器信息
	h.registeredCollectors[req.CollectorID] = collectorInfo

	// 模拟存储到密钥管理系统
	// keyID := "collector_" + req.CollectorID + "_secret"
	
	// 这里应该调用实际的密钥管理服务
	// 为了演示，我们直接返回成功
	
	response := CollectorRegistrationResponse{
		Success:      true,
		Message:      "Collector registered successfully with " + fmt.Sprintf("%d", len(enabledProtocols)) + " protocols",
		CollectorID:  req.CollectorID,
		RegisteredAt: collectorInfo.RegisteredAt,
		Protocols:    enabledProtocols,
	}

	c.JSON(http.StatusOK, response)
}

// GetCollectorSecret 获取采集器密钥（用于认证）
func (h *CollectorRegistrationHandler) GetCollectorSecret(c *gin.Context) {
	collectorID := c.Param("id")
	
	collectorInfo, exists := h.registeredCollectors[collectorID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Collector not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"secret_key": collectorInfo.SecretKey,
	})
}

// ListCollectors 列出所有注册的采集器
func (h *CollectorRegistrationHandler) ListCollectors(c *gin.Context) {
	collectors := make([]*CollectorInfo, 0)
	
	for _, collectorInfo := range h.registeredCollectors {
		collectors = append(collectors, collectorInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"collectors": collectors,
		"count":      len(collectors),
	})
}

// GetCollectorInfo 获取采集器详细信息
func (h *CollectorRegistrationHandler) GetCollectorInfo(c *gin.Context) {
	collectorID := c.Param("id")
	
	collectorInfo, exists := h.registeredCollectors[collectorID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Collector not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"collector": collectorInfo,
	})
}

// UpdateCollectorStatus 更新采集器状态（心跳）
func (h *CollectorRegistrationHandler) UpdateCollectorStatus(c *gin.Context) {
	collectorID := c.Param("id")
	
	var statusReq struct {
		Status string `json:"status"`
	}
	
	if err := c.ShouldBindJSON(&statusReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}
	
	collectorInfo, exists := h.registeredCollectors[collectorID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Collector not found",
		})
		return
	}

	// 更新状态和心跳时间
	collectorInfo.Status = statusReq.Status
	collectorInfo.LastHeartbeat = time.Now()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Collector status updated",
	})
}

// GetCollectorsByProtocol 根据协议类型获取采集器
func (h *CollectorRegistrationHandler) GetCollectorsByProtocol(c *gin.Context) {
	protocol := c.Query("protocol")
	if protocol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Protocol parameter is required",
		})
		return
	}

	var matchingCollectors []*CollectorInfo
	
	for _, collectorInfo := range h.registeredCollectors {
		for _, p := range collectorInfo.Protocols {
			if p.Protocol == protocol && p.Enabled {
				matchingCollectors = append(matchingCollectors, collectorInfo)
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"protocol":   protocol,
		"collectors": matchingCollectors,
		"count":      len(matchingCollectors),
	})
}

// AuthenticateCollector 验证采集器认证
func (h *CollectorRegistrationHandler) AuthenticateCollector(collectorID, providedSecret string) bool {
	collectorInfo, exists := h.registeredCollectors[collectorID]
	if !exists {
		return false
	}
	return collectorInfo.SecretKey == providedSecret
}