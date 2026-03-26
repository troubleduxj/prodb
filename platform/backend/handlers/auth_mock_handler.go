package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MockAuthHandler 模拟认证处理器，用于演示环境
type MockAuthHandler struct {
	registeredCollectors map[string]string
	collectorRegHandler  *CollectorRegistrationHandler
}

// NewMockAuthHandler 创建模拟认证处理器
func NewMockAuthHandler(collectorRegHandler *CollectorRegistrationHandler) *MockAuthHandler {
	return &MockAuthHandler{
		registeredCollectors: map[string]string{
			"opcua-simulator-collector": "opcua-collector-secret-key-2024",
		},
		collectorRegHandler: collectorRegHandler,
	}
}

// GetSecretKey 获取采集器密钥（模拟密钥管理服务）
func (h *MockAuthHandler) GetSecretKey(c *gin.Context) {
	keyID := c.Param("key_id")
	
	// 解析采集器ID
	var collectorID string
	if keyID == "collector_opcua-simulator-collector_secret" {
		collectorID = "opcua-simulator-collector"
	}
	
	secretKey, exists := h.registeredCollectors[collectorID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "key not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"key_id":     keyID,
		"secret_key": secretKey,
	})
}

// AuthenticateCollector 验证采集器
func (h *MockAuthHandler) AuthenticateCollector(c *gin.Context) {
	var req struct {
		CollectorID string `json:"collector_id"`
		SecretKey   string `json:"secret_key"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request",
		})
		return
	}

	// 首先检查注册处理器中的采集器
	if h.collectorRegHandler != nil {
		fmt.Printf("DEBUG: 尝试认证采集器 %s\n", req.CollectorID)
		if h.collectorRegHandler.AuthenticateCollector(req.CollectorID, req.SecretKey) {
			fmt.Printf("DEBUG: 认证成功\n")
			c.JSON(http.StatusOK, gin.H{
				"authenticated": true,
				"collector_id":  req.CollectorID,
			})
			return
		}
		fmt.Printf("DEBUG: 注册处理器认证失败\n")
	} else {
		fmt.Printf("DEBUG: 注册处理器为空\n")
	}

	// 然后检查硬编码的采集器（向后兼容）
	storedSecret, exists := h.registeredCollectors[req.CollectorID]
	if !exists || storedSecret != req.SecretKey {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "authentication failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"collector_id":  req.CollectorID,
	})
}