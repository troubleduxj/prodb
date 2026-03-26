package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"prodb/platform/backend/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AlertRulesEngine manages and evaluates alert rules
type AlertRulesEngine struct {
	db           *gorm.DB
	alertService *AlertService
	
	// Rule management
	rules        map[uuid.UUID]*AlertRule
	rulesMutex   sync.RWMutex
	
	// Evaluation state
	evaluating   bool
	evalMutex    sync.RWMutex
	stopChan     chan struct{}
	wg           sync.WaitGroup
	
	// Configuration
	evaluationInterval time.Duration
	maxConcurrentEvals int
}

// AlertRule represents a compiled alert rule
type AlertRule struct {
	ID          uuid.UUID                `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Condition   string                   `json:"condition"`
	Severity    string                   `json:"severity"`
	Actions     []AlertAction            `json:"actions"`
	Enabled     bool                     `json:"enabled"`
	
	// Compiled condition
	compiledCondition *CompiledCondition `json:"-"`
	
	// Evaluation state
	LastEvaluation time.Time              `json:"last_evaluation"`
	LastResult     bool                   `json:"last_result"`
	EvaluationCount int64                 `json:"evaluation_count"`
	
	// Throttling
	ThrottleInterval time.Duration        `json:"throttle_interval"`
	LastTriggered    time.Time            `json:"last_triggered"`
	
	// Metadata
	Tags         map[string]string       `json:"tags"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// AlertAction represents an action to take when an alert is triggered
type AlertAction struct {
	Type       string                 `json:"type"`        // email, webhook, log, etc.
	Config     map[string]interface{} `json:"config"`      // Action-specific configuration
	Enabled    bool                   `json:"enabled"`
	Template   string                 `json:"template"`    // Message template
}

// CompiledCondition represents a compiled alert condition
type CompiledCondition struct {
	Expression string                 `json:"expression"`
	Variables  []string              `json:"variables"`
	Operators  []string              `json:"operators"`
	Evaluator  ConditionEvaluator    `json:"-"`
}

// ConditionEvaluator evaluates alert conditions
type ConditionEvaluator interface {
	Evaluate(data map[string]interface{}) (bool, error)
}

// SimpleConditionEvaluator implements basic condition evaluation
type SimpleConditionEvaluator struct {
	Expression string
}

// AlertRuleTemplate represents a template for creating alert rules
type AlertRuleTemplate struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Condition   string                 `json:"condition"`
	Severity    string                 `json:"severity"`
	Actions     []AlertAction          `json:"actions"`
	Variables   map[string]interface{} `json:"variables"`
	Tags        map[string]string      `json:"tags"`
}

// EvaluationContext provides context for rule evaluation
type EvaluationContext struct {
	CollectorID   uuid.UUID              `json:"collector_id"`
	Timestamp     time.Time              `json:"timestamp"`
	Metrics       map[string]interface{} `json:"metrics"`
	Status        string                 `json:"status"`
	HistoricalData map[string]interface{} `json:"historical_data"`
}

// NewAlertRulesEngine creates a new alert rules engine
func NewAlertRulesEngine(db *gorm.DB, alertService *AlertService) *AlertRulesEngine {
	return &AlertRulesEngine{
		db:                 db,
		alertService:       alertService,
		rules:              make(map[uuid.UUID]*AlertRule),
		evaluationInterval: 1 * time.Minute,
		maxConcurrentEvals: 10,
		stopChan:           make(chan struct{}),
	}
}

// Start starts the alert rules engine
func (are *AlertRulesEngine) Start() error {
	are.evalMutex.Lock()
	defer are.evalMutex.Unlock()
	
	if are.evaluating {
		return fmt.Errorf("alert rules engine is already running")
	}
	
	// Load rules from database
	if err := are.loadRules(); err != nil {
		return fmt.Errorf("failed to load rules: %w", err)
	}
	
	are.evaluating = true
	are.stopChan = make(chan struct{})
	
	// Start evaluation loop
	are.wg.Add(1)
	go are.evaluationLoop()
	
	log.Println("Alert rules engine started")
	return nil
}

// Stop stops the alert rules engine
func (are *AlertRulesEngine) Stop() {
	are.evalMutex.Lock()
	defer are.evalMutex.Unlock()
	
	if !are.evaluating {
		return
	}
	
	are.evaluating = false
	close(are.stopChan)
	are.wg.Wait()
	
	log.Println("Alert rules engine stopped")
}

// loadRules loads alert rules from the database
func (are *AlertRulesEngine) loadRules() error {
	// For now, create some default rules
	// In a real implementation, this would load from the database
	
	defaultRules := []*AlertRule{
		{
			ID:          uuid.New(),
			Name:        "Collector Offline",
			Description: "Triggers when a collector goes offline",
			Condition:   "status == 'offline'",
			Severity:    "critical",
			Enabled:     true,
			Actions: []AlertAction{
				{
					Type:    "log",
					Enabled: true,
					Template: "Collector {{collector_name}} is offline",
				},
			},
			ThrottleInterval: 5 * time.Minute,
			Tags: map[string]string{
				"category": "availability",
				"type":     "system",
			},
		},
		{
			ID:          uuid.New(),
			Name:        "High CPU Usage",
			Description: "Triggers when CPU usage exceeds 80%",
			Condition:   "cpu_usage > 80",
			Severity:    "warning",
			Enabled:     true,
			Actions: []AlertAction{
				{
					Type:    "log",
					Enabled: true,
					Template: "High CPU usage detected: {{cpu_usage}}%",
				},
			},
			ThrottleInterval: 10 * time.Minute,
			Tags: map[string]string{
				"category": "performance",
				"type":     "resource",
			},
		},
		{
			ID:          uuid.New(),
			Name:        "High Memory Usage",
			Description: "Triggers when memory usage exceeds 90%",
			Condition:   "memory_usage_percent > 90",
			Severity:    "warning",
			Enabled:     true,
			Actions: []AlertAction{
				{
					Type:    "log",
					Enabled: true,
					Template: "High memory usage detected: {{memory_usage_percent}}%",
				},
			},
			ThrottleInterval: 10 * time.Minute,
			Tags: map[string]string{
				"category": "performance",
				"type":     "resource",
			},
		},
		{
			ID:          uuid.New(),
			Name:        "High Error Rate",
			Description: "Triggers when error rate exceeds 10%",
			Condition:   "error_rate > 0.1",
			Severity:    "warning",
			Enabled:     true,
			Actions: []AlertAction{
				{
					Type:    "log",
					Enabled: true,
					Template: "High error rate detected: {{error_rate_percent}}%",
				},
			},
			ThrottleInterval: 15 * time.Minute,
			Tags: map[string]string{
				"category": "reliability",
				"type":     "quality",
			},
		},
		{
			ID:          uuid.New(),
			Name:        "Consecutive Heartbeat Failures",
			Description: "Triggers when consecutive heartbeat failures exceed 3",
			Condition:   "consecutive_failures > 3",
			Severity:    "critical",
			Enabled:     true,
			Actions: []AlertAction{
				{
					Type:    "log",
					Enabled: true,
					Template: "Multiple heartbeat failures detected: {{consecutive_failures}}",
				},
			},
			ThrottleInterval: 5 * time.Minute,
			Tags: map[string]string{
				"category": "availability",
				"type":     "heartbeat",
			},
		},
	}
	
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	for _, rule := range defaultRules {
		// Compile the condition
		compiledCondition, err := are.compileCondition(rule.Condition)
		if err != nil {
			log.Printf("Failed to compile condition for rule %s: %v", rule.Name, err)
			continue
		}
		
		rule.compiledCondition = compiledCondition
		rule.CreatedAt = time.Now()
		rule.UpdatedAt = time.Now()
		
		are.rules[rule.ID] = rule
	}
	
	log.Printf("Loaded %d alert rules", len(are.rules))
	return nil
}

// compileCondition compiles an alert condition string into an evaluator
func (are *AlertRulesEngine) compileCondition(condition string) (*CompiledCondition, error) {
	// Simple condition compiler - in a real implementation, this would be more sophisticated
	evaluator := &SimpleConditionEvaluator{Expression: condition}
	
	// Extract variables and operators
	variables := are.extractVariables(condition)
	operators := are.extractOperators(condition)
	
	return &CompiledCondition{
		Expression: condition,
		Variables:  variables,
		Operators:  operators,
		Evaluator:  evaluator,
	}, nil
}

// extractVariables extracts variable names from a condition
func (are *AlertRulesEngine) extractVariables(condition string) []string {
	var variables []string
	
	// Simple regex-like extraction (in real implementation, use proper parsing)
	words := strings.Fields(condition)
	for _, word := range words {
		if !are.isOperator(word) && !are.isLiteral(word) {
			variables = append(variables, word)
		}
	}
	
	return variables
}

// extractOperators extracts operators from a condition
func (are *AlertRulesEngine) extractOperators(condition string) []string {
	var operators []string
	
	words := strings.Fields(condition)
	for _, word := range words {
		if are.isOperator(word) {
			operators = append(operators, word)
		}
	}
	
	return operators
}

// isOperator checks if a word is an operator
func (are *AlertRulesEngine) isOperator(word string) bool {
	operators := []string{"==", "!=", ">", "<", ">=", "<=", "&&", "||", "!", "and", "or", "not"}
	for _, op := range operators {
		if word == op {
			return true
		}
	}
	return false
}

// isLiteral checks if a word is a literal value
func (are *AlertRulesEngine) isLiteral(word string) bool {
	// Check if it's a number
	if _, err := strconv.ParseFloat(word, 64); err == nil {
		return true
	}
	
	// Check if it's a quoted string
	if (strings.HasPrefix(word, "'") && strings.HasSuffix(word, "'")) ||
		(strings.HasPrefix(word, "\"") && strings.HasSuffix(word, "\"")) {
		return true
	}
	
	// Check if it's a boolean
	if word == "true" || word == "false" {
		return true
	}
	
	return false
}

// evaluationLoop runs the main evaluation loop
func (are *AlertRulesEngine) evaluationLoop() {
	defer are.wg.Done()
	
	ticker := time.NewTicker(are.evaluationInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-are.stopChan:
			return
		case <-ticker.C:
			are.evaluateAllRules()
		}
	}
}

// evaluateAllRules evaluates all enabled rules
func (are *AlertRulesEngine) evaluateAllRules() {
	are.rulesMutex.RLock()
	rules := make([]*AlertRule, 0, len(are.rules))
	for _, rule := range are.rules {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	are.rulesMutex.RUnlock()
	
	// Get all collectors for evaluation
	var collectors []models.Collector
	if err := are.db.Find(&collectors).Error; err != nil {
		log.Printf("Failed to get collectors for rule evaluation: %v", err)
		return
	}
	
	// Evaluate rules for each collector
	for _, collector := range collectors {
		context, err := are.buildEvaluationContext(collector.ID)
		if err != nil {
			log.Printf("Failed to build evaluation context for collector %s: %v", collector.ID, err)
			continue
		}
		
		for _, rule := range rules {
			are.evaluateRule(rule, context)
		}
	}
}

// buildEvaluationContext builds evaluation context for a collector
func (are *AlertRulesEngine) buildEvaluationContext(collectorID uuid.UUID) (*EvaluationContext, error) {
	// Get collector status
	var status models.CollectorStatus
	err := are.db.Where("collector_id = ?", collectorID).First(&status).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create default context for collectors without status
			return &EvaluationContext{
				CollectorID: collectorID,
				Timestamp:   time.Now(),
				Status:      "unknown",
				Metrics:     make(map[string]interface{}),
			}, nil
		}
		return nil, err
	}
	
	// Parse metrics from last heartbeat
	metrics := make(map[string]interface{})
	if status.LastMetrics != "" {
		if err := json.Unmarshal([]byte(status.LastMetrics), &metrics); err != nil {
			log.Printf("Failed to parse metrics for collector %s: %v", collectorID, err)
		}
	}
	
	// Add status-related metrics
	metrics["status"] = status.Status
	metrics["consecutive_failures"] = status.ConsecutiveFailures
	metrics["last_heartbeat"] = status.LastHeartbeat
	
	// Calculate derived metrics
	if status.LastHeartbeat.Before(time.Now().Add(-5 * time.Minute)) {
		metrics["status"] = "offline"
	}
	
	// Calculate error rate if we have the data
	if totalOps, ok := metrics["total_operations"].(float64); ok {
		if failedOps, ok := metrics["failed_operations"].(float64); ok && totalOps > 0 {
			metrics["error_rate"] = failedOps / totalOps
			metrics["error_rate_percent"] = (failedOps / totalOps) * 100
		}
	}
	
	// Calculate memory usage percentage
	if memUsed, ok := metrics["memory_usage"].(float64); ok {
		if memTotal, ok := metrics["memory_total"].(float64); ok && memTotal > 0 {
			metrics["memory_usage_percent"] = (memUsed / memTotal) * 100
		}
	}
	
	return &EvaluationContext{
		CollectorID: collectorID,
		Timestamp:   time.Now(),
		Metrics:     metrics,
		Status:      status.Status,
	}, nil
}

// evaluateRule evaluates a single rule against the context
func (are *AlertRulesEngine) evaluateRule(rule *AlertRule, context *EvaluationContext) {
	// Check throttling
	if time.Since(rule.LastTriggered) < rule.ThrottleInterval {
		return
	}
	
	// Evaluate the condition
	result, err := rule.compiledCondition.Evaluator.Evaluate(context.Metrics)
	if err != nil {
		log.Printf("Failed to evaluate rule %s: %v", rule.Name, err)
		return
	}
	
	// Update rule state
	rule.LastEvaluation = time.Now()
	rule.EvaluationCount++
	
	// If condition is true and wasn't true before, trigger alert
	if result && !rule.LastResult {
		are.triggerAlert(rule, context)
		rule.LastTriggered = time.Now()
	}
	
	rule.LastResult = result
}

// triggerAlert triggers an alert for a rule
func (are *AlertRulesEngine) triggerAlert(rule *AlertRule, context *EvaluationContext) {
	// Create alert record
	alert := models.CollectorAlert{
		CollectorID: context.CollectorID,
		AlertType:   strings.ToLower(strings.ReplaceAll(rule.Name, " ", "_")),
		Severity:    rule.Severity,
		Title:       rule.Name,
		Message:     are.renderTemplate(rule, context),
		FiredAt:     time.Now(),
		Status:      "active",
		Metadata:    are.createAlertMetadata(rule, context),
	}
	
	// Trigger alert through alert service
	if err := are.alertService.TriggerAlert(alert); err != nil {
		log.Printf("Failed to trigger alert for rule %s: %v", rule.Name, err)
		return
	}
	
	// Execute rule actions
	for _, action := range rule.Actions {
		if action.Enabled {
			are.executeAction(action, rule, context)
		}
	}
	
	log.Printf("Alert triggered: %s for collector %s", rule.Name, context.CollectorID)
}

// renderTemplate renders an alert message template
func (are *AlertRulesEngine) renderTemplate(rule *AlertRule, context *EvaluationContext) string {
	template := rule.Description
	if len(rule.Actions) > 0 && rule.Actions[0].Template != "" {
		template = rule.Actions[0].Template
	}
	
	// Simple template rendering (replace {{variable}} with values)
	message := template
	for key, value := range context.Metrics {
		placeholder := fmt.Sprintf("{{%s}}", key)
		message = strings.ReplaceAll(message, placeholder, fmt.Sprintf("%v", value))
	}
	
	// Add collector name if available
	var collector models.Collector
	if err := are.db.First(&collector, context.CollectorID).Error; err == nil {
		message = strings.ReplaceAll(message, "{{collector_name}}", collector.Name)
	}
	
	return message
}

// createAlertMetadata creates metadata for an alert
func (are *AlertRulesEngine) createAlertMetadata(rule *AlertRule, context *EvaluationContext) string {
	metadata := map[string]interface{}{
		"rule_id":      rule.ID,
		"rule_name":    rule.Name,
		"condition":    rule.Condition,
		"metrics":      context.Metrics,
		"tags":         rule.Tags,
		"evaluation_count": rule.EvaluationCount,
	}
	
	metadataJSON, _ := json.Marshal(metadata)
	return string(metadataJSON)
}

// executeAction executes a rule action
func (are *AlertRulesEngine) executeAction(action AlertAction, rule *AlertRule, context *EvaluationContext) {
	switch action.Type {
	case "log":
		message := are.renderTemplate(rule, context)
		log.Printf("ALERT ACTION [%s]: %s", rule.Severity, message)
		
	case "email":
		// TODO: Implement email action
		log.Printf("EMAIL ACTION: Would send email for rule %s", rule.Name)
		
	case "webhook":
		// TODO: Implement webhook action
		log.Printf("WEBHOOK ACTION: Would send webhook for rule %s", rule.Name)
		
	default:
		log.Printf("Unknown action type: %s", action.Type)
	}
}

// Evaluate implements the ConditionEvaluator interface for SimpleConditionEvaluator
func (sce *SimpleConditionEvaluator) Evaluate(data map[string]interface{}) (bool, error) {
	// Simple condition evaluation
	// This is a basic implementation - a real system would use a proper expression parser
	
	condition := sce.Expression
	
	// Replace variables with values
	for key, value := range data {
		placeholder := key
		var replacement string
		
		switch v := value.(type) {
		case string:
			replacement = fmt.Sprintf("'%s'", v)
		case bool:
			replacement = fmt.Sprintf("%t", v)
		case int, int32, int64:
			replacement = fmt.Sprintf("%d", v)
		case float32, float64:
			replacement = fmt.Sprintf("%f", v)
		default:
			replacement = fmt.Sprintf("'%v'", v)
		}
		
		condition = strings.ReplaceAll(condition, placeholder, replacement)
	}
	
	// Evaluate simple conditions
	return sce.evaluateSimpleCondition(condition)
}

// evaluateSimpleCondition evaluates simple conditions
func (sce *SimpleConditionEvaluator) evaluateSimpleCondition(condition string) (bool, error) {
	// Handle simple comparison operators
	if strings.Contains(condition, "==") {
		parts := strings.Split(condition, "==")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			return sce.compareValues(left, right, "==")
		}
	}
	
	if strings.Contains(condition, "!=") {
		parts := strings.Split(condition, "!=")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			result, err := sce.compareValues(left, right, "==")
			return !result, err
		}
	}
	
	if strings.Contains(condition, ">=") {
		parts := strings.Split(condition, ">=")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			return sce.compareValues(left, right, ">=")
		}
	}
	
	if strings.Contains(condition, "<=") {
		parts := strings.Split(condition, "<=")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			return sce.compareValues(left, right, "<=")
		}
	}
	
	if strings.Contains(condition, ">") {
		parts := strings.Split(condition, ">")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			return sce.compareValues(left, right, ">")
		}
	}
	
	if strings.Contains(condition, "<") {
		parts := strings.Split(condition, "<")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			return sce.compareValues(left, right, "<")
		}
	}
	
	return false, fmt.Errorf("unsupported condition: %s", condition)
}

// compareValues compares two values based on the operator
func (sce *SimpleConditionEvaluator) compareValues(left, right, operator string) (bool, error) {
	// Try to parse as numbers first
	leftNum, leftErr := strconv.ParseFloat(left, 64)
	rightNum, rightErr := strconv.ParseFloat(right, 64)
	
	if leftErr == nil && rightErr == nil {
		// Numeric comparison
		switch operator {
		case "==":
			return leftNum == rightNum, nil
		case ">":
			return leftNum > rightNum, nil
		case "<":
			return leftNum < rightNum, nil
		case ">=":
			return leftNum >= rightNum, nil
		case "<=":
			return leftNum <= rightNum, nil
		}
	}
	
	// String comparison
	leftStr := strings.Trim(left, "'\"")
	rightStr := strings.Trim(right, "'\"")
	
	switch operator {
	case "==":
		return leftStr == rightStr, nil
	case ">":
		return leftStr > rightStr, nil
	case "<":
		return leftStr < rightStr, nil
	case ">=":
		return leftStr >= rightStr, nil
	case "<=":
		return leftStr <= rightStr, nil
	}
	
	return false, fmt.Errorf("unsupported operator: %s", operator)
}

// GetRules returns all loaded rules
func (are *AlertRulesEngine) GetRules() []*AlertRule {
	are.rulesMutex.RLock()
	defer are.rulesMutex.RUnlock()
	
	rules := make([]*AlertRule, 0, len(are.rules))
	for _, rule := range are.rules {
		rules = append(rules, rule)
	}
	
	return rules
}

// GetRule returns a specific rule by ID
func (are *AlertRulesEngine) GetRule(id uuid.UUID) (*AlertRule, error) {
	are.rulesMutex.RLock()
	defer are.rulesMutex.RUnlock()
	
	rule, exists := are.rules[id]
	if !exists {
		return nil, fmt.Errorf("rule not found: %s", id)
	}
	
	return rule, nil
}

// AddRule adds a new alert rule
func (are *AlertRulesEngine) AddRule(rule *AlertRule) error {
	// Compile the condition
	compiledCondition, err := are.compileCondition(rule.Condition)
	if err != nil {
		return fmt.Errorf("failed to compile condition: %w", err)
	}
	
	rule.compiledCondition = compiledCondition
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	are.rules[rule.ID] = rule
	
	log.Printf("Added alert rule: %s", rule.Name)
	return nil
}

// UpdateRule updates an existing alert rule
func (are *AlertRulesEngine) UpdateRule(rule *AlertRule) error {
	// Compile the condition
	compiledCondition, err := are.compileCondition(rule.Condition)
	if err != nil {
		return fmt.Errorf("failed to compile condition: %w", err)
	}
	
	rule.compiledCondition = compiledCondition
	rule.UpdatedAt = time.Now()
	
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	if _, exists := are.rules[rule.ID]; !exists {
		return fmt.Errorf("rule not found: %s", rule.ID)
	}
	
	are.rules[rule.ID] = rule
	
	log.Printf("Updated alert rule: %s", rule.Name)
	return nil
}

// DeleteRule deletes an alert rule
func (are *AlertRulesEngine) DeleteRule(id uuid.UUID) error {
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	if _, exists := are.rules[id]; !exists {
		return fmt.Errorf("rule not found: %s", id)
	}
	
	delete(are.rules, id)
	
	log.Printf("Deleted alert rule: %s", id)
	return nil
}

// EnableRule enables an alert rule
func (are *AlertRulesEngine) EnableRule(id uuid.UUID) error {
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	rule, exists := are.rules[id]
	if !exists {
		return fmt.Errorf("rule not found: %s", id)
	}
	
	rule.Enabled = true
	rule.UpdatedAt = time.Now()
	
	log.Printf("Enabled alert rule: %s", rule.Name)
	return nil
}

// DisableRule disables an alert rule
func (are *AlertRulesEngine) DisableRule(id uuid.UUID) error {
	are.rulesMutex.Lock()
	defer are.rulesMutex.Unlock()
	
	rule, exists := are.rules[id]
	if !exists {
		return fmt.Errorf("rule not found: %s", id)
	}
	
	rule.Enabled = false
	rule.UpdatedAt = time.Now()
	
	log.Printf("Disabled alert rule: %s", rule.Name)
	return nil
}

// GetRuleTemplates returns predefined rule templates
func (are *AlertRulesEngine) GetRuleTemplates() []AlertRuleTemplate {
	return []AlertRuleTemplate{
		{
			Name:        "Collector Offline Alert",
			Description: "Alert when collector goes offline",
			Category:    "availability",
			Condition:   "status == 'offline'",
			Severity:    "critical",
			Actions: []AlertAction{
				{Type: "log", Enabled: true, Template: "Collector {{collector_name}} is offline"},
				{Type: "email", Enabled: false, Template: "CRITICAL: Collector {{collector_name}} is offline"},
			},
			Variables: map[string]interface{}{
				"threshold_minutes": 5,
			},
			Tags: map[string]string{
				"category": "availability",
				"type":     "system",
			},
		},
		{
			Name:        "High Resource Usage Alert",
			Description: "Alert when resource usage is high",
			Category:    "performance",
			Condition:   "cpu_usage > {{cpu_threshold}} || memory_usage_percent > {{memory_threshold}}",
			Severity:    "warning",
			Actions: []AlertAction{
				{Type: "log", Enabled: true, Template: "High resource usage: CPU {{cpu_usage}}%, Memory {{memory_usage_percent}}%"},
			},
			Variables: map[string]interface{}{
				"cpu_threshold":    80,
				"memory_threshold": 90,
			},
			Tags: map[string]string{
				"category": "performance",
				"type":     "resource",
			},
		},
		{
			Name:        "Data Quality Alert",
			Description: "Alert when data quality issues are detected",
			Category:    "quality",
			Condition:   "error_rate > {{error_threshold}}",
			Severity:    "warning",
			Actions: []AlertAction{
				{Type: "log", Enabled: true, Template: "High error rate detected: {{error_rate_percent}}%"},
			},
			Variables: map[string]interface{}{
				"error_threshold": 0.1,
			},
			Tags: map[string]string{
				"category": "quality",
				"type":     "data",
			},
		},
	}
}

// TestRule tests a rule condition against sample data
func (are *AlertRulesEngine) TestRule(condition string, testData map[string]interface{}) (bool, error) {
	compiledCondition, err := are.compileCondition(condition)
	if err != nil {
		return false, fmt.Errorf("failed to compile condition: %w", err)
	}
	
	return compiledCondition.Evaluator.Evaluate(testData)
}