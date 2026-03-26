package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"prodb/platform/backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// WebSocketManager WebSocket连接管理器
type WebSocketManager struct {
	upgrader    websocket.Upgrader
	clients     map[string]*Client
	mu          sync.RWMutex
	eventPub    *services.EventPublisher
	wsHandler   *services.WebSocketHandler
}

// Client WebSocket客户端连接
type Client struct {
	ID         string
	Conn       *websocket.Conn
	Send       chan []byte
	Manager    *WebSocketManager
	
	// 订阅设置
	SubscribedEvents map[services.EventType]bool
	CollectorID      *uuid.UUID
	
	// 状态
	ConnectedAt time.Time
	LastPing    time.Time
}

// WebSocketMessage 消息结构
type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// SubscriptionRequest 订阅请求
type SubscriptionRequest struct {
	Events      []services.EventType `json:"events"`
	CollectorID *uuid.UUID           `json:"collector_id,omitempty"`
}

// NewWebSocketManager 创建WebSocket管理器
func NewWebSocketManager(eventPub *services.EventPublisher) *WebSocketManager {
	wsHandler := services.NewWebSocketHandler()
	
	manager := &WebSocketManager{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // 允许所有跨域请求，生产环境应限制
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		clients:   make(map[string]*Client),
		eventPub:  eventPub,
		wsHandler: wsHandler,
	}
	
	// 注册WebSocket处理器到事件发布器
	eventPub.Subscribe(wsHandler)
	
	// 启动WebSocket广播
	wsHandler.Start()
	
	// 启动清理任务
	go manager.cleanupLoop()
	
	return manager
}

// HandleWebSocket 处理WebSocket连接
func (wsm *WebSocketManager) HandleWebSocket(c *gin.Context) {
	// 获取可选的采集器ID过滤参数
	var collectorID *uuid.UUID
	if idStr := c.Query("collector_id"); idStr != "" {
		if id, err := uuid.Parse(idStr); err == nil {
			collectorID = &id
		}
	}
	
	// 升级HTTP连接为WebSocket
	conn, err := wsm.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "websocket upgrade failed"})
		return
	}
	
	// 创建客户端
	clientID := uuid.New().String()
	client := &Client{
		ID:               clientID,
		Conn:             conn,
		Send:             make(chan []byte, 256),
		Manager:          wsm,
		SubscribedEvents: make(map[services.EventType]bool),
		CollectorID:      collectorID,
		ConnectedAt:      time.Now(),
		LastPing:         time.Now(),
	}
	
	// 注册客户端
	wsm.registerClient(client)
	
	// 注册到WebSocket处理器
	wsClient := &services.WebSocketClient{
		ID:          clientID,
		Send:        client.Send,
		Subscribed:  client.SubscribedEvents,
		CollectorID: collectorID,
	}
	wsm.wsHandler.RegisterClient(wsClient)
	
	// 启动读写协程
	go client.writePump()
	go client.readPump()
	
	// 发送连接成功消息
	client.sendMessage(WebSocketMessage{
		Type: "connected",
		Payload: gin.H{
			"client_id":    clientID,
			"connected_at": client.ConnectedAt,
			"server_time":  time.Now().UTC(),
		},
	})
}

// registerClient 注册客户端
func (wsm *WebSocketManager) registerClient(client *Client) {
	wsm.mu.Lock()
	wsm.clients[client.ID] = client
	wsm.mu.Unlock()
}

// unregisterClient 注销客户端
func (wsm *WebSocketManager) unregisterClient(client *Client) {
	wsm.mu.Lock()
	if _, ok := wsm.clients[client.ID]; ok {
		delete(wsm.clients, client.ID)
		close(client.Send)
	}
	wsm.mu.Unlock()
	
	// 从WebSocket处理器注销
	wsm.wsHandler.UnregisterClient(client.ID)
	
	// 关闭连接
	client.Conn.Close()
}

// readPump 读取消息循环
func (c *Client) readPump() {
	defer func() {
		c.Manager.unregisterClient(c)
	}()
	
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.LastPing = time.Now()
		return nil
	})
	
	for {
		var msg WebSocketMessage
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// 记录意外关闭
			}
			break
		}
		
		// 处理消息
		c.handleMessage(msg)
	}
}

// writePump 写入消息循环
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second) // 心跳间隔
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			c.Conn.WriteMessage(websocket.TextMessage, message)
			
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理接收到的消息
func (c *Client) handleMessage(msg WebSocketMessage) {
	switch msg.Type {
	case "subscribe":
		c.handleSubscribe(msg.Payload)
	case "unsubscribe":
		c.handleUnsubscribe(msg.Payload)
	case "ping":
		c.sendMessage(WebSocketMessage{Type: "pong", Payload: gin.H{"time": time.Now().UTC()}})
	case "get_history":
		c.handleGetHistory(msg.Payload)
	}
}

// handleSubscribe 处理订阅请求
func (c *Client) handleSubscribe(payload interface{}) {
	data, _ := json.Marshal(payload)
	var req SubscriptionRequest
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendError("invalid subscription request")
		return
	}
	
	// 更新订阅
	for _, eventType := range req.Events {
		c.SubscribedEvents[eventType] = true
	}
	
	// 更新采集器过滤
	if req.CollectorID != nil {
		c.CollectorID = req.CollectorID
	}
	
	// 更新WebSocket处理器中的客户端配置
	wsClient := &services.WebSocketClient{
		ID:          c.ID,
		Send:        c.Send,
		Subscribed:  c.SubscribedEvents,
		CollectorID: c.CollectorID,
	}
	c.Manager.wsHandler.RegisterClient(wsClient)
	
	c.sendMessage(WebSocketMessage{
		Type: "subscribed",
		Payload: gin.H{
			"events":       req.Events,
			"collector_id": c.CollectorID,
		},
	})
}

// handleUnsubscribe 处理取消订阅请求
func (c *Client) handleUnsubscribe(payload interface{}) {
	data, _ := json.Marshal(payload)
	var req SubscriptionRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	
	for _, eventType := range req.Events {
		delete(c.SubscribedEvents, eventType)
	}
	
	c.sendMessage(WebSocketMessage{
		Type: "unsubscribed",
		Payload: gin.H{"events": req.Events},
	})
}

// handleGetHistory 获取历史事件
func (c *Client) handleGetHistory(payload interface{}) {
	// 解析请求参数
	data, _ := json.Marshal(payload)
	var req struct {
		EventType *services.EventType `json:"event_type,omitempty"`
		Limit     int                 `json:"limit,omitempty"`
	}
	json.Unmarshal(data, &req)
	
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 50
	}
	
	// 获取历史
	history := c.Manager.eventPub.GetHistory(req.EventType, req.Limit)
	
	c.sendMessage(WebSocketMessage{
		Type:    "history",
		Payload: history,
	})
}

// sendMessage 发送消息
func (c *Client) sendMessage(msg WebSocketMessage) {
	data, _ := json.Marshal(msg)
	select {
	case c.Send <- data:
	default:
		// 发送队列满，关闭连接
		c.Manager.unregisterClient(c)
	}
}

// sendError 发送错误消息
func (c *Client) sendError(errMsg string) {
	c.sendMessage(WebSocketMessage{
		Type:    "error",
		Payload: gin.H{"error": errMsg},
	})
}

// cleanupLoop 清理断开连接的客户端
func (wsm *WebSocketManager) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		wsm.mu.Lock()
		now := time.Now()
		for id, client := range wsm.clients {
			// 检查是否超过10分钟没有ping
			if now.Sub(client.LastPing) > 10*time.Minute {
				delete(wsm.clients, id)
				client.Conn.Close()
				close(client.Send)
			}
		}
		wsm.mu.Unlock()
	}
}

// GetStats 获取WebSocket统计信息
func (wsm *WebSocketManager) GetStats() gin.H {
	wsm.mu.RLock()
	defer wsm.mu.RUnlock()
	
	return gin.H{
		"connected_clients": len(wsm.clients),
		"clients": func() []gin.H {
			result := make([]gin.H, 0, len(wsm.clients))
			for _, c := range wsm.clients {
				result = append(result, gin.H{
					"id":           c.ID,
					"connected_at": c.ConnectedAt,
					"last_ping":    c.LastPing,
					"collector_id": c.CollectorID,
				})
			}
			return result
		}(),
	}
}

// GetWebSocketStats godoc
// @Summary 获取WebSocket连接统计
// @Description 获取当前WebSocket连接状态和统计信息
// @Tags 系统
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/websocket/stats [get]
func (wsm *WebSocketManager) GetWebSocketStats(c *gin.Context) {
	c.JSON(http.StatusOK, wsm.GetStats())
}

// BroadcastMessage 广播消息给所有客户端
func (wsm *WebSocketManager) BroadcastMessage(msgType string, payload interface{}) {
	msg := WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, _ := json.Marshal(msg)
	
	wsm.mu.RLock()
	clients := make([]*Client, 0, len(wsm.clients))
	for _, c := range wsm.clients {
		clients = append(clients, c)
	}
	wsm.mu.RUnlock()
	
	for _, client := range clients {
		select {
		case client.Send <- data:
		default:
			// 跳过发送队列满的客户端
		}
	}
}
