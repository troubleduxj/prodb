package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"prodb/platform/backend/models"

	"github.com/google/uuid"
)

// EventType 事件类型
type EventType string

const (
	// Interface事件
	EventInterfaceCreated EventType = "interface.created"
	EventInterfaceUpdated EventType = "interface.updated"
	EventInterfaceDeleted EventType = "interface.deleted"
	EventInterfaceEnabled EventType = "interface.enabled"
	EventInterfaceDisabled EventType = "interface.disabled"

	// 配置事件
	EventConfigChanged    EventType = "config.changed"
	EventConfigDelivered  EventType = "config.delivered"
	EventConfigApplied    EventType = "config.applied"
	EventConfigFailed     EventType = "config.failed"
	EventConfigRollbacked EventType = "config.rollbacked"

	// Collector事件
	EventCollectorOnline  EventType = "collector.online"
	EventCollectorOffline EventType = "collector.offline"
	EventCollectorError   EventType = "collector.error"
)

// Event 事件结构
type Event struct {
	ID            string                 `json:"id"`
	Type          EventType              `json:"type"`
	Source        string                 `json:"source"`           // 事件来源
	Timestamp     time.Time              `json:"timestamp"`
	CollectorID   *uuid.UUID             `json:"collector_id,omitempty"`
	InterfaceID   *uuid.UUID             `json:"interface_id,omitempty"`
	Payload       map[string]interface{} `json:"payload"`          // 事件数据
	PreviousState map[string]interface{} `json:"previous_state,omitempty"` // 变更前状态
}

// EventHandler 事件处理器接口
type EventHandler interface {
	HandleEvent(ctx context.Context, event *Event) error
	SubscribedEvents() []EventType
}

// EventPublisher 事件发布器
type EventPublisher struct {
	handlers map[EventType][]EventHandler
	mu       sync.RWMutex
	
	// 事件历史（用于重放）
	history     []*Event
	historyMu   sync.RWMutex
	maxHistory  int
	
	// 事件通道（用于异步处理）
	eventChan chan *Event
	stopChan  chan struct{}
}

// NewEventPublisher 创建事件发布器
func NewEventPublisher() *EventPublisher {
	return &EventPublisher{
		handlers:   make(map[EventType][]EventHandler),
		history:    make([]*Event, 0, 1000),
		maxHistory: 1000,
		eventChan:  make(chan *Event, 100),
		stopChan:   make(chan struct{}),
	}
}

// Start 启动事件处理器
func (ep *EventPublisher) Start() {
	go ep.processEvents()
}

// Stop 停止事件处理器
func (ep *EventPublisher) Stop() {
	close(ep.stopChan)
}

// processEvents 异步处理事件
func (ep *EventPublisher) processEvents() {
	for {
		select {
		case event := <-ep.eventChan:
			ep.dispatchEvent(context.Background(), event)
		case <-ep.stopChan:
			return
		}
	}
}

// dispatchEvent 分发事件到处理器
func (ep *EventPublisher) dispatchEvent(ctx context.Context, event *Event) {
	ep.mu.RLock()
	handlers := ep.handlers[event.Type]
	ep.mu.RUnlock()

	for _, handler := range handlers {
		go func(h EventHandler) {
			if err := h.HandleEvent(ctx, event); err != nil {
				fmt.Printf("event handler error: %v\n", err)
			}
		}(handler)
	}
}

// Subscribe 订阅事件
func (ep *EventPublisher) Subscribe(handler EventHandler) {
	ep.mu.Lock()
	defer ep.mu.Unlock()

	for _, eventType := range handler.SubscribedEvents() {
		ep.handlers[eventType] = append(ep.handlers[eventType], handler)
	}
}

// Unsubscribe 取消订阅
func (ep *EventPublisher) Unsubscribe(handler EventHandler) {
	ep.mu.Lock()
	defer ep.mu.Unlock()

	for _, eventType := range handler.SubscribedEvents() {
		handlers := ep.handlers[eventType]
		for i, h := range handlers {
			if h == handler {
				ep.handlers[eventType] = append(handlers[:i], handlers[i+1:]...)
				break
			}
		}
	}
}

// Publish 发布事件（异步）
func (ep *EventPublisher) Publish(eventType EventType, source string, collectorID *uuid.UUID, interfaceID *uuid.UUID, payload map[string]interface{}) {
	event := &Event{
		ID:          uuid.New().String(),
		Type:        eventType,
		Source:      source,
		Timestamp:   time.Now().UTC(),
		CollectorID: collectorID,
		InterfaceID: interfaceID,
		Payload:     payload,
	}

	// 保存到历史
	ep.saveToHistory(event)

	// 发送到处理队列
	select {
	case ep.eventChan <- event:
	default:
		// 队列满时直接分发
		go ep.dispatchEvent(context.Background(), event)
	}
}

// PublishSync 同步发布事件
func (ep *EventPublisher) PublishSync(ctx context.Context, eventType EventType, source string, collectorID *uuid.UUID, interfaceID *uuid.UUID, payload, previousState map[string]interface{}) error {
	event := &Event{
		ID:            uuid.New().String(),
		Type:          eventType,
		Source:        source,
		Timestamp:     time.Now().UTC(),
		CollectorID:   collectorID,
		InterfaceID:   interfaceID,
		Payload:       payload,
		PreviousState: previousState,
	}

	ep.saveToHistory(event)
	ep.dispatchEvent(ctx, event)
	return nil
}

// saveToHistory 保存事件到历史记录
func (ep *EventPublisher) saveToHistory(event *Event) {
	ep.historyMu.Lock()
	defer ep.historyMu.Unlock()

	ep.history = append(ep.history, event)

	// 限制历史记录大小
	if len(ep.history) > ep.maxHistory {
		ep.history = ep.history[len(ep.history)-ep.maxHistory:]
	}
}

// GetHistory 获取事件历史
func (ep *EventPublisher) GetHistory(eventType *EventType, limit int) []*Event {
	ep.historyMu.RLock()
	defer ep.historyMu.RUnlock()

	if limit <= 0 || limit > len(ep.history) {
		limit = len(ep.history)
	}

	result := make([]*Event, 0, limit)
	for i := len(ep.history) - 1; i >= 0 && len(result) < limit; i-- {
		if eventType == nil || ep.history[i].Type == *eventType {
			result = append(result, ep.history[i])
		}
	}

	return result
}

// ==================== 便捷方法 ====================

// PublishInterfaceCreated 发布接口创建事件
func (ep *EventPublisher) PublishInterfaceCreated(iface *models.CollectorInterface) {
	payload := map[string]interface{}{
		"interface_id":   iface.ID.String(),
		"interface_name": iface.Name,
		"protocol":       iface.Protocol,
		"collector_id":   iface.CollectorID.String(),
	}
	ep.Publish(EventInterfaceCreated, "config_service", &iface.CollectorID, &iface.ID, payload)
}

// PublishInterfaceUpdated 发布接口更新事件
func (ep *EventPublisher) PublishInterfaceUpdated(iface *models.CollectorInterface, oldState map[string]interface{}) {
	payload := map[string]interface{}{
		"interface_id":   iface.ID.String(),
		"interface_name": iface.Name,
		"protocol":       iface.Protocol,
		"enabled":        iface.Enabled,
	}
	ep.PublishSync(context.Background(), EventInterfaceUpdated, "config_service", &iface.CollectorID, &iface.ID, payload, oldState)
}

// PublishInterfaceDeleted 发布接口删除事件
func (ep *EventPublisher) PublishInterfaceDeleted(collectorID uuid.UUID, interfaceID uuid.UUID, interfaceName string) {
	payload := map[string]interface{}{
		"interface_id":   interfaceID.String(),
		"interface_name": interfaceName,
		"collector_id":   collectorID.String(),
	}
	ep.Publish(EventInterfaceDeleted, "config_service", &collectorID, &interfaceID, payload)
}

// PublishConfigChanged 发布配置变更事件
func (ep *EventPublisher) PublishConfigChanged(collectorID uuid.UUID, version int, changeType string) {
	payload := map[string]interface{}{
		"collector_id": collectorID.String(),
		"version":      version,
		"change_type":  changeType,
		"timestamp":    time.Now().UTC(),
	}
	ep.Publish(EventConfigChanged, "config_service", &collectorID, nil, payload)
}

// PublishConfigApplied 发布配置应用事件
func (ep *EventPublisher) PublishConfigApplied(collectorID uuid.UUID, version int) {
	payload := map[string]interface{}{
		"collector_id": collectorID.String(),
		"version":      version,
		"applied_at":   time.Now().UTC(),
	}
	ep.Publish(EventConfigApplied, "collector", &collectorID, nil, payload)
}

// PublishConfigFailed 发布配置失败事件
func (ep *EventPublisher) PublishConfigFailed(collectorID uuid.UUID, version int, errMsg string) {
	payload := map[string]interface{}{
		"collector_id": collectorID.String(),
		"version":      version,
		"error":        errMsg,
		"failed_at":    time.Now().UTC(),
	}
	ep.Publish(EventConfigFailed, "collector", &collectorID, nil, payload)
}

// ==================== WebSocket Handler ====================

// WebSocketHandler WebSocket事件处理器
type WebSocketHandler struct {
	clients    map[string]*WebSocketClient
	mu         sync.RWMutex
	broadcast  chan *Event
}

// WebSocketClient WebSocket客户端
type WebSocketClient struct {
	ID          string
	Send        chan []byte
	Subscribed  map[EventType]bool
	CollectorID *uuid.UUID // 如果设置，只接收该采集器的事件
}

// NewWebSocketHandler 创建WebSocket处理器
func NewWebSocketHandler() *WebSocketHandler {
	return &WebSocketHandler{
		clients:   make(map[string]*WebSocketClient),
		broadcast: make(chan *Event, 100),
	}
}

// Start 启动广播处理
func (wsh *WebSocketHandler) Start() {
	go wsh.broadcastLoop()
}

// broadcastLoop 广播事件到所有客户端
func (wsh *WebSocketHandler) broadcastLoop() {
	for event := range wsh.broadcast {
		data, err := json.Marshal(event)
		if err != nil {
			continue
		}

		wsh.mu.RLock()
		clients := make([]*WebSocketClient, 0, len(wsh.clients))
		for _, client := range wsh.clients {
			// 检查订阅
			if !client.Subscribed[event.Type] {
				continue
			}
			// 检查采集器过滤
			if client.CollectorID != nil && event.CollectorID != nil {
				if *client.CollectorID != *event.CollectorID {
					continue
				}
			}
			clients = append(clients, client)
		}
		wsh.mu.RUnlock()

		// 发送给所有匹配的客户端
		for _, client := range clients {
			select {
			case client.Send <- data:
			default:
				// 客户端发送队列满，跳过
			}
		}
	}
}

// RegisterClient 注册客户端
func (wsh *WebSocketHandler) RegisterClient(client *WebSocketClient) {
	wsh.mu.Lock()
	wsh.clients[client.ID] = client
	wsh.mu.Unlock()
}

// UnregisterClient 注销客户端
func (wsh *WebSocketHandler) UnregisterClient(clientID string) {
	wsh.mu.Lock()
	if client, ok := wsh.clients[clientID]; ok {
		close(client.Send)
		delete(wsh.clients, clientID)
	}
	wsh.mu.Unlock()
}

// HandleEvent 处理事件
func (wsh *WebSocketHandler) HandleEvent(ctx context.Context, event *Event) error {
	select {
	case wsh.broadcast <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// SubscribedEvents 订阅的事件类型
func (wsh *WebSocketHandler) SubscribedEvents() []EventType {
	return []EventType{
		EventInterfaceCreated,
		EventInterfaceUpdated,
		EventInterfaceDeleted,
		EventConfigChanged,
		EventConfigApplied,
		EventConfigFailed,
		EventConfigRollbacked,
		EventCollectorOnline,
		EventCollectorOffline,
		EventCollectorError,
	}
}

// ==================== 日志处理器 ====================

// LogHandler 日志事件处理器
type LogHandler struct{}

// NewLogHandler 创建日志处理器
func NewLogHandler() *LogHandler {
	return &LogHandler{}
}

// HandleEvent 处理事件
func (lh *LogHandler) HandleEvent(ctx context.Context, event *Event) error {
	data, _ := json.Marshal(event.Payload)
	fmt.Printf("[EVENT] %s | %s | %s | %s\n",
		event.Timestamp.Format(time.RFC3339),
		event.Type,
		event.Source,
		string(data),
	)
	return nil
}

// SubscribedEvents 订阅所有事件
func (lh *LogHandler) SubscribedEvents() []EventType {
	return []EventType{
		EventInterfaceCreated,
		EventInterfaceUpdated,
		EventInterfaceDeleted,
		EventConfigChanged,
		EventConfigDelivered,
		EventConfigApplied,
		EventConfigFailed,
		EventConfigRollbacked,
	}
}
