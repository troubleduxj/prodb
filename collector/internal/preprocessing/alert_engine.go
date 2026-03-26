// Package preprocessing 边缘数据预处理功能
package preprocessing

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

// AlertCondition 告警条件类型
type AlertCondition string

const (
	ConditionGT  AlertCondition = ">"
	ConditionLT  AlertCondition = "<"
	ConditionEQ  AlertCondition = "="
	ConditionNE  AlertCondition = "!="
	ConditionGTE AlertCondition = ">="
	ConditionLTE AlertCondition = "<="
)

// AlertSeverity 告警级别
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"
)

// AlertState 告警状态
type AlertState string

const (
	AlertStateNormal    AlertState = "normal"
	AlertStatePending   AlertState = "pending"
	AlertStateTriggered AlertState = "triggered"
	AlertStateRecovered AlertState = "recovered"
)

// EdgeAlertRule 边缘告警规则
type EdgeAlertRule struct {
	ID        string
	PointID   string
	Name      string
	Condition AlertCondition
	Threshold float64
	Duration  time.Duration // 持续时间阈值
	Severity  AlertSeverity
	Enabled   bool
}

// AlertEvent 告警事件
type AlertEvent struct {
	ID            string          `json:"id"`
	RuleID        string          `json:"rule_id"`
	RuleName      string          `json:"rule_name"`
	PointID       string          `json:"point_id"`
	EventType     string          `json:"event_type"` // trigger, recovery
	Severity      AlertSeverity   `json:"severity"`
	Value         float64         `json:"value"`
	Threshold     float64         `json:"threshold"`
	Condition     AlertCondition  `json:"condition"`
	Timestamp     time.Time       `json:"timestamp"`
	Duration      time.Duration   `json:"duration,omitempty"`
	Message       string          `json:"message"`
}

// AlertEngine 边缘告警引擎
type AlertEngine struct {
	rules       map[string]*EdgeAlertRule
	states      map[string]*AlertRuleState // key: rule_id
	mu          sync.RWMutex
	
	logger      interface {
		Debug(msg string, keysAndValues ...interface{})
		Info(msg string, keysAndValues ...interface{})
		Warn(msg string, keysAndValues ...interface{})
	}
	
	// 事件处理回调
	eventHandlers []AlertEventHandler
	
	// 控制
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// AlertRuleState 告警规则状态
type AlertRuleState struct {
	RuleID        string
	CurrentState  AlertState
	LastValue     float64
	LastCheckTime time.Time
	PendingSince  *time.Time // 开始挂起时间
	TriggerCount  int        // 触发计数
}

// AlertEventHandler 告警事件处理函数
type AlertEventHandler func(event *AlertEvent)

// NewAlertEngine 创建告警引擎
func NewAlertEngine(logger interface {
	Debug(msg string, keysAndValues ...interface{})
	Info(msg string, keysAndValues ...interface{})
	Warn(msg string, keysAndValues ...interface{})
}) *AlertEngine {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &AlertEngine{
		rules:         make(map[string]*EdgeAlertRule),
		states:        make(map[string]*AlertRuleState),
		logger:        logger,
		eventHandlers: make([]AlertEventHandler, 0),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Start 启动告警引擎
func (ae *AlertEngine) Start() {
	ae.logger.Info("Alert engine started")
}

// Stop 停止告警引擎
func (ae *AlertEngine) Stop() {
	ae.cancel()
	ae.wg.Wait()
	ae.logger.Info("Alert engine stopped")
}

// AddRule 添加告警规则
func (ae *AlertEngine) AddRule(rule *EdgeAlertRule) error {
	if rule.ID == "" {
		return fmt.Errorf("rule id is required")
	}
	if rule.PointID == "" {
		return fmt.Errorf("point id is required")
	}
	
	ae.mu.Lock()
	defer ae.mu.Unlock()
	
	ae.rules[rule.ID] = rule
	
	// 初始化规则状态
	if _, exists := ae.states[rule.ID]; !exists {
		ae.states[rule.ID] = &AlertRuleState{
			RuleID:        rule.ID,
			CurrentState:  AlertStateNormal,
			LastCheckTime: time.Now(),
		}
	}
	
	ae.logger.Info("Alert rule added", "rule_id", rule.ID, "name", rule.Name)
	return nil
}

// RemoveRule 移除告警规则
func (ae *AlertEngine) RemoveRule(ruleID string) {
	ae.mu.Lock()
	defer ae.mu.Unlock()
	
	delete(ae.rules, ruleID)
	delete(ae.states, ruleID)
	
	ae.logger.Info("Alert rule removed", "rule_id", ruleID)
}

// UpdateRule 更新告警规则
func (ae *AlertEngine) UpdateRule(rule *EdgeAlertRule) error {
	ae.RemoveRule(rule.ID)
	return ae.AddRule(rule)
}

// Evaluate 评估数据点
func (ae *AlertEngine) Evaluate(pointID string, point DataPoint) ([]*AlertEvent, error) {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	
	var events []*AlertEvent
	
	// 查找关联的规则
	for _, rule := range ae.rules {
		if rule.PointID != pointID || !rule.Enabled {
			continue
		}
		
		state := ae.states[rule.ID]
		if state == nil {
			continue
		}
		
		// 评估条件
		conditionMet := ae.evaluateCondition(point.Value, rule.Threshold, rule.Condition)
		
		// 更新状态
		state.LastValue = point.Value
		state.LastCheckTime = time.Now()
		
		// 状态机转换
		event := ae.transitionState(rule, state, conditionMet, point)
		if event != nil {
			events = append(events, event)
		}
	}
	
	return events, nil
}

// evaluateCondition 评估条件
func (ae *AlertEngine) evaluateCondition(value, threshold float64, condition AlertCondition) bool {
	switch condition {
	case ConditionGT:
		return value > threshold
	case ConditionLT:
		return value < threshold
	case ConditionEQ:
		return math.Abs(value-threshold) < 0.0001
	case ConditionNE:
		return math.Abs(value-threshold) >= 0.0001
	case ConditionGTE:
		return value >= threshold
	case ConditionLTE:
		return value <= threshold
	default:
		return false
	}
}

// transitionState 状态机转换
func (ae *AlertEngine) transitionState(rule *EdgeAlertRule, state *AlertRuleState, conditionMet bool, point DataPoint) *AlertEvent {
	now := time.Now()
	
	switch state.CurrentState {
	case AlertStateNormal, AlertStateRecovered:
		if conditionMet {
			// 进入挂起状态
			state.CurrentState = AlertStatePending
			state.PendingSince = &now
			state.TriggerCount = 1
			
			ae.logger.Debug("Alert pending", "rule_id", rule.ID, "value", point.Value)
		}
		
	case AlertStatePending:
		if conditionMet {
			state.TriggerCount++
			
			// 检查是否满足持续时间
			if state.PendingSince != nil && now.Sub(*state.PendingSince) >= rule.Duration {
				// 触发告警
				state.CurrentState = AlertStateTriggered
				duration := now.Sub(*state.PendingSince)
				
				event := &AlertEvent{
					ID:        generateAlertID(),
					RuleID:    rule.ID,
					RuleName:  rule.Name,
					PointID:   rule.PointID,
					EventType: "trigger",
					Severity:  rule.Severity,
					Value:     point.Value,
					Threshold: rule.Threshold,
					Condition: rule.Condition,
					Timestamp: now,
					Duration:  duration,
					Message:   fmt.Sprintf("%s triggered: value %.2f %s %.2f", rule.Name, point.Value, rule.Condition, rule.Threshold),
				}
				
				ae.logger.Info("Alert triggered", "rule_id", rule.ID, "value", point.Value)
				ae.handleEvent(event)
				return event
			}
		} else {
			// 条件不满足，恢复正常
			state.CurrentState = AlertStateNormal
			state.PendingSince = nil
			state.TriggerCount = 0
		}
		
	case AlertStateTriggered:
		if !conditionMet {
			// 恢复告警
			state.CurrentState = AlertStateRecovered
			state.PendingSince = nil
			state.TriggerCount = 0
			
			event := &AlertEvent{
				ID:        generateAlertID(),
				RuleID:    rule.ID,
				RuleName:  rule.Name,
				PointID:   rule.PointID,
				EventType: "recovery",
				Severity:  rule.Severity,
				Value:     point.Value,
				Threshold: rule.Threshold,
				Condition: rule.Condition,
				Timestamp: now,
				Message:   fmt.Sprintf("%s recovered: value %.2f", rule.Name, point.Value),
			}
			
			ae.logger.Info("Alert recovered", "rule_id", rule.ID, "value", point.Value)
			ae.handleEvent(event)
			return event
		}
	}
	
	return nil
}

// handleEvent 处理告警事件
func (ae *AlertEngine) handleEvent(event *AlertEvent) {
	for _, handler := range ae.eventHandlers {
		go handler(event)
	}
}

// RegisterEventHandler 注册事件处理器
func (ae *AlertEngine) RegisterEventHandler(handler AlertEventHandler) {
	ae.eventHandlers = append(ae.eventHandlers, handler)
}

// GetRule 获取告警规则
func (ae *AlertEngine) GetRule(ruleID string) (*EdgeAlertRule, error) {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	
	rule, exists := ae.rules[ruleID]
	if !exists {
		return nil, fmt.Errorf("rule not found: %s", ruleID)
	}
	
	return rule, nil
}

// GetAllRules 获取所有告警规则
func (ae *AlertEngine) GetAllRules() []*EdgeAlertRule {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	
	rules := make([]*EdgeAlertRule, 0, len(ae.rules))
	for _, rule := range ae.rules {
		rules = append(rules, rule)
	}
	
	return rules
}

// GetRuleState 获取规则状态
func (ae *AlertEngine) GetRuleState(ruleID string) (*AlertRuleState, error) {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	
	state, exists := ae.states[ruleID]
	if !exists {
		return nil, fmt.Errorf("rule state not found: %s", ruleID)
	}
	
	return state, nil
}

// GetAllStates 获取所有规则状态
func (ae *AlertEngine) GetAllStates() map[string]*AlertRuleState {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	
	states := make(map[string]*AlertRuleState)
	for k, v := range ae.states {
		states[k] = v
	}
	
	return states
}

// Reset 重置告警引擎
func (ae *AlertEngine) Reset() {
	ae.mu.Lock()
	defer ae.mu.Unlock()
	
	ae.rules = make(map[string]*EdgeAlertRule)
	ae.states = make(map[string]*AlertRuleState)
	ae.logger.Info("Alert engine reset")
}

// generateAlertID 生成告警ID
func generateAlertID() string {
	return fmt.Sprintf("alert_%d", time.Now().UnixNano())
}