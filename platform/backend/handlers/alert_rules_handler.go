package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"prodb/platform/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AlertRulesHandler handles alert rules management HTTP requests
type AlertRulesHandler struct {
	rulesEngine *services.AlertRulesEngine
}

// NewAlertRulesHandler creates a new alert rules handler
func NewAlertRulesHandler(rulesEngine *services.AlertRulesEngine) *AlertRulesHandler {
	return &AlertRulesHandler{
		rulesEngine: rulesEngine,
	}
}

// GetRules returns all alert rules
// GET /api/v1/alert-rules
func (arh *AlertRulesHandler) GetRules(c *gin.Context) {
	rules := arh.rulesEngine.GetRules()
	
	c.JSON(http.StatusOK, gin.H{
		"count": len(rules),
		"rules": rules,
	})
}

// GetRule returns a specific alert rule
// GET /api/v1/alert-rules/:id
func (arh *AlertRulesHandler) GetRule(c *gin.Context) {
	ruleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid rule ID",
		})
		return
	}
	
	rule, err := arh.rulesEngine.GetRule(ruleID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Rule not found",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, rule)
}

// CreateRule creates a new alert rule
// POST /api/v1/alert-rules
func (arh *AlertRulesHandler) CreateRule(c *gin.Context) {
	var rule services.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Generate ID if not provided
	if rule.ID == uuid.Nil {
		rule.ID = uuid.New()
	}
	
	// Validate required fields
	if rule.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Rule name is required",
		})
		return
	}
	
	if rule.Condition == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Rule condition is required",
		})
		return
	}
	
	if rule.Severity == "" {
		rule.Severity = "warning"
	}
	
	// Add the rule
	if err := arh.rulesEngine.AddRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"message": "Rule created successfully",
		"rule":    rule,
	})
}

// UpdateRule updates an existing alert rule
// PUT /api/v1/alert-rules/:id
func (arh *AlertRulesHandler) UpdateRule(c *gin.Context) {
	ruleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid rule ID",
		})
		return
	}
	
	var rule services.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Set the ID from URL
	rule.ID = ruleID
	
	// Update the rule
	if err := arh.rulesEngine.UpdateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Rule updated successfully",
		"rule":    rule,
	})
}

// DeleteRule deletes an alert rule
// DELETE /api/v1/alert-rules/:id
func (arh *AlertRulesHandler) DeleteRule(c *gin.Context) {
	ruleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid rule ID",
		})
		return
	}
	
	if err := arh.rulesEngine.DeleteRule(ruleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Rule deleted successfully",
	})
}

// EnableRule enables an alert rule
// POST /api/v1/alert-rules/:id/enable
func (arh *AlertRulesHandler) EnableRule(c *gin.Context) {
	ruleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid rule ID",
		})
		return
	}
	
	if err := arh.rulesEngine.EnableRule(ruleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to enable rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Rule enabled successfully",
	})
}

// DisableRule disables an alert rule
// POST /api/v1/alert-rules/:id/disable
func (arh *AlertRulesHandler) DisableRule(c *gin.Context) {
	ruleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid rule ID",
		})
		return
	}
	
	if err := arh.rulesEngine.DisableRule(ruleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to disable rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Rule disabled successfully",
	})
}

// GetRuleTemplates returns predefined rule templates
// GET /api/v1/alert-rules/templates
func (arh *AlertRulesHandler) GetRuleTemplates(c *gin.Context) {
	templates := arh.rulesEngine.GetRuleTemplates()
	
	c.JSON(http.StatusOK, gin.H{
		"count":     len(templates),
		"templates": templates,
	})
}

// TestRule tests a rule condition against sample data
// POST /api/v1/alert-rules/test
func (arh *AlertRulesHandler) TestRule(c *gin.Context) {
	var request struct {
		Condition string                 `json:"condition" binding:"required"`
		TestData  map[string]interface{} `json:"test_data" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	result, err := arh.rulesEngine.TestRule(request.Condition, request.TestData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Failed to test rule",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"condition": request.Condition,
		"test_data": request.TestData,
		"result":    result,
	})
}

// CreateRuleFromTemplate creates a rule from a template
// POST /api/v1/alert-rules/from-template
func (arh *AlertRulesHandler) CreateRuleFromTemplate(c *gin.Context) {
	var request struct {
		TemplateName string                 `json:"template_name" binding:"required"`
		Name         string                 `json:"name" binding:"required"`
		Description  string                 `json:"description"`
		Variables    map[string]interface{} `json:"variables"`
		Enabled      bool                   `json:"enabled"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Find the template
	templates := arh.rulesEngine.GetRuleTemplates()
	var selectedTemplate *services.AlertRuleTemplate
	for _, template := range templates {
		if template.Name == request.TemplateName {
			selectedTemplate = &template
			break
		}
	}
	
	if selectedTemplate == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Template not found",
		})
		return
	}
	
	// Create rule from template
	rule := &services.AlertRule{
		ID:          uuid.New(),
		Name:        request.Name,
		Description: request.Description,
		Condition:   selectedTemplate.Condition,
		Severity:    selectedTemplate.Severity,
		Actions:     selectedTemplate.Actions,
		Enabled:     request.Enabled,
	}
	
	if rule.Description == "" {
		rule.Description = selectedTemplate.Description
	}
	
	// Replace variables in condition
	condition := selectedTemplate.Condition
	for key, value := range request.Variables {
		placeholder := "{{" + key + "}}"
		replacement := fmt.Sprintf("%v", value)
		condition = strings.ReplaceAll(condition, placeholder, replacement)
	}
	rule.Condition = condition
	
	// Add the rule
	if err := arh.rulesEngine.AddRule(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create rule from template",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"message":  "Rule created from template successfully",
		"rule":     rule,
		"template": selectedTemplate.Name,
	})
}

// GetRuleStatistics returns statistics about rule evaluations
// GET /api/v1/alert-rules/statistics
func (arh *AlertRulesHandler) GetRuleStatistics(c *gin.Context) {
	rules := arh.rulesEngine.GetRules()
	
	stats := map[string]interface{}{
		"total_rules":    len(rules),
		"enabled_rules":  0,
		"disabled_rules": 0,
		"by_severity":    make(map[string]int),
		"by_category":    make(map[string]int),
		"total_evaluations": int64(0),
	}
	
	severityCount := make(map[string]int)
	categoryCount := make(map[string]int)
	
	for _, rule := range rules {
		if rule.Enabled {
			stats["enabled_rules"] = stats["enabled_rules"].(int) + 1
		} else {
			stats["disabled_rules"] = stats["disabled_rules"].(int) + 1
		}
		
		severityCount[rule.Severity]++
		stats["total_evaluations"] = stats["total_evaluations"].(int64) + rule.EvaluationCount
		
		// Extract category from tags
		if rule.Tags != nil {
			if category, ok := rule.Tags["category"]; ok {
				categoryCount[category]++
			}
		}
	}
	
	stats["by_severity"] = severityCount
	stats["by_category"] = categoryCount
	
	c.JSON(http.StatusOK, stats)
}

// GetRuleEvaluationHistory returns evaluation history for rules
// GET /api/v1/alert-rules/evaluation-history
func (arh *AlertRulesHandler) GetRuleEvaluationHistory(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid limit parameter",
		})
		return
	}
	
	rules := arh.rulesEngine.GetRules()
	
	// Build evaluation history
	history := make([]map[string]interface{}, 0)
	for _, rule := range rules {
		if rule.EvaluationCount > 0 {
			history = append(history, map[string]interface{}{
				"rule_id":          rule.ID,
				"rule_name":        rule.Name,
				"last_evaluation":  rule.LastEvaluation,
				"last_result":      rule.LastResult,
				"evaluation_count": rule.EvaluationCount,
				"last_triggered":   rule.LastTriggered,
			})
		}
	}
	
	// Apply limit
	if limit > 0 && len(history) > limit {
		history = history[:limit]
	}
	
	c.JSON(http.StatusOK, gin.H{
		"count":   len(history),
		"limit":   limit,
		"history": history,
	})
}