package handlers

import (
	"fmt"
	"net/http"
	"prodb/platform/backend/services"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ConfigTemplateHandler handles configuration template API requests
type ConfigTemplateHandler struct {
	service *services.ConfigTemplateService
}

// NewConfigTemplateHandler creates a new configuration template handler
func NewConfigTemplateHandler() *ConfigTemplateHandler {
	return &ConfigTemplateHandler{
		service: services.NewConfigTemplateService(),
	}
}

// CreateTemplate creates a new configuration template
// @Summary Create configuration template
// @Description Create a new configuration template
// @Tags templates
// @Accept json
// @Produce json
// @Param template body services.TemplateCreateRequest true "Template data"
// @Success 201 {object} models.ConfigTemplate
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates [post]
func (h *ConfigTemplateHandler) CreateTemplate(c *gin.Context) {
	var req services.TemplateCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user ID from JWT token
	// For now, using a default user ID
	req.CreatedBy = 1

	template, err := h.service.CreateTemplate(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// GetTemplate retrieves a configuration template by ID
// @Summary Get configuration template
// @Description Get a configuration template by ID
// @Tags templates
// @Produce json
// @Param id path string true "Template ID"
// @Success 200 {object} models.ConfigTemplate
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/{id} [get]
func (h *ConfigTemplateHandler) GetTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	template, err := h.service.GetTemplate(id)
	if err != nil {
		if err.Error() == "template not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, template)
}

// ListTemplates retrieves configuration templates with pagination and filtering
// @Summary List configuration templates
// @Description List configuration templates with pagination and filtering
// @Tags templates
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param size query int false "Page size" default(20)
// @Param protocol query string false "Filter by protocol"
// @Param status query string false "Filter by status"
// @Success 200 {object} services.TemplateListResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates [get]
func (h *ConfigTemplateHandler) ListTemplates(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	protocol := c.Query("protocol")
	status := c.Query("status")

	response, err := h.service.ListTemplates(page, size, protocol, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// UpdateTemplate updates an existing configuration template
// @Summary Update configuration template
// @Description Update an existing configuration template
// @Tags templates
// @Accept json
// @Produce json
// @Param id path string true "Template ID"
// @Param template body services.TemplateUpdateRequest true "Template update data"
// @Success 200 {object} models.ConfigTemplate
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/{id} [put]
func (h *ConfigTemplateHandler) UpdateTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	var req services.TemplateUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user ID from JWT token
	userID := uint(1)

	template, err := h.service.UpdateTemplate(id, &req, userID)
	if err != nil {
		if err.Error() == "template not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, template)
}

// DeleteTemplate deletes a configuration template
// @Summary Delete configuration template
// @Description Delete a configuration template (soft delete)
// @Tags templates
// @Param id path string true "Template ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/{id} [delete]
func (h *ConfigTemplateHandler) DeleteTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	err = h.service.DeleteTemplate(id)
	if err != nil {
		if err.Error() == "template not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetTemplateVersions retrieves version history for a template
// @Summary Get template versions
// @Description Get version history for a configuration template
// @Tags templates
// @Produce json
// @Param id path string true "Template ID"
// @Success 200 {array} models.ConfigTemplateVersion
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/{id}/versions [get]
func (h *ConfigTemplateHandler) GetTemplateVersions(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	versions, err := h.service.GetTemplateVersions(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, versions)
}

// ApplyTemplate applies a template to multiple collectors
// @Summary Apply template to collectors
// @Description Apply a configuration template to multiple collectors
// @Tags templates
// @Accept json
// @Produce json
// @Param application body services.TemplateApplyRequest true "Template application data"
// @Success 200 {array} models.CollectionTask
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/apply [post]
func (h *ConfigTemplateHandler) ApplyTemplate(c *gin.Context) {
	var req services.TemplateApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user ID from JWT token
	userID := uint(1)

	tasks, err := h.service.ApplyTemplate(&req, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Template applied successfully",
		"tasks":   tasks,
	})
}

// ExportTemplate exports a template to JSON format
// @Summary Export template
// @Description Export a configuration template to JSON format
// @Tags templates
// @Produce json
// @Param id path string true "Template ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/{id}/export [get]
func (h *ConfigTemplateHandler) ExportTemplate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	export, err := h.service.ExportTemplate(id)
	if err != nil {
		if err.Error() == "template not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, export)
}

// ImportTemplate imports a template from JSON format
// @Summary Import template
// @Description Import a configuration template from JSON format
// @Tags templates
// @Accept json
// @Produce json
// @Param template body map[string]interface{} true "Template data"
// @Success 201 {object} models.ConfigTemplate
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/import [post]
func (h *ConfigTemplateHandler) ImportTemplate(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user ID from JWT token
	userID := uint(1)

	template, err := h.service.ImportTemplate(data, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// ValidateTemplate validates a template configuration
// @Summary Validate template
// @Description Validate a configuration template
// @Tags templates
// @Accept json
// @Produce json
// @Param validation body map[string]interface{} true "Template validation data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/templates/validate [post]
func (h *ConfigTemplateHandler) ValidateTemplate(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	protocol, ok := data["protocol"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "protocol is required"})
		return
	}

	templateConfig, ok := data["template_config"].(map[string]interface{})
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "template_config is required"})
		return
	}

	// Create a temporary service instance to use validation method
	service := services.NewConfigTemplateService()
	
	// Use reflection to access the private method (for validation purposes)
	// In a real implementation, you might want to make this method public
	// or create a separate validation service
	err := service.ValidateTemplateConfig(protocol, templateConfig)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"message": "Template configuration is valid",
	})
}

// BatchApplyTemplate applies a template to multiple collectors in batch
// @Summary Batch apply template
// @Description Apply a configuration template to multiple collectors in batch with different parameters
// @Tags templates
// @Accept json
// @Produce json
// @Param batch body map[string]interface{} true "Batch application data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/templates/batch-apply [post]
func (h *ConfigTemplateHandler) BatchApplyTemplate(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	templateIDStr, ok := data["template_id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "template_id is required"})
		return
	}

	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	applications, ok := data["applications"].([]interface{})
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "applications array is required"})
		return
	}

	// TODO: Get user ID from JWT token
	userID := uint(1)

	var results []map[string]interface{}
	var errors []string

	for i, app := range applications {
		appMap, ok := app.(map[string]interface{})
		if !ok {
			errors = append(errors, fmt.Sprintf("Application %d: invalid format", i))
			continue
		}

		collectorIDStr, ok := appMap["collector_id"].(string)
		if !ok {
			errors = append(errors, fmt.Sprintf("Application %d: collector_id is required", i))
			continue
		}

		collectorID, err := uuid.Parse(collectorIDStr)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Application %d: invalid collector ID", i))
			continue
		}

		taskName, ok := appMap["task_name"].(string)
		if !ok {
			errors = append(errors, fmt.Sprintf("Application %d: task_name is required", i))
			continue
		}

		parameters, _ := appMap["parameters"].(map[string]interface{})
		if parameters == nil {
			parameters = make(map[string]interface{})
		}

		req := &services.TemplateApplyRequest{
			TemplateID:   templateID,
			CollectorIDs: []uuid.UUID{collectorID},
			Parameters:   parameters,
			TaskName:     taskName,
		}

		tasks, err := h.service.ApplyTemplate(req, userID)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Application %d: %s", i, err.Error()))
			continue
		}

		results = append(results, map[string]interface{}{
			"collector_id": collectorID,
			"task_name":    taskName,
			"task_id":      tasks[0].ID,
			"status":       "success",
		})
	}

	response := map[string]interface{}{
		"successful_applications": len(results),
		"failed_applications":     len(errors),
		"results":                results,
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	c.JSON(http.StatusOK, response)
}