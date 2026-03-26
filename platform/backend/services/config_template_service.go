package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigTemplateService handles configuration template operations
type ConfigTemplateService struct {
	db *gorm.DB
}

// NewConfigTemplateService creates a new configuration template service
func NewConfigTemplateService() *ConfigTemplateService {
	return &ConfigTemplateService{
		db: database.DB,
	}
}

// TemplateCreateRequest represents the request to create a template
type TemplateCreateRequest struct {
	Name           string                 `json:"name" binding:"required"`
	Description    string                 `json:"description"`
	Protocol       string                 `json:"protocol" binding:"required"`
	TemplateConfig map[string]interface{} `json:"template_config" binding:"required"`
	Version        string                 `json:"version"`
	Tags           []string               `json:"tags"`
	CreatedBy      uint                   `json:"created_by" binding:"required"`
}

// TemplateUpdateRequest represents the request to update a template
type TemplateUpdateRequest struct {
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	Protocol       string                 `json:"protocol"`
	TemplateConfig map[string]interface{} `json:"template_config"`
	Tags           []string               `json:"tags"`
	ChangeLog      string                 `json:"change_log"`
}

// TemplateApplyRequest represents the request to apply a template to collectors
type TemplateApplyRequest struct {
	TemplateID    uuid.UUID              `json:"template_id" binding:"required"`
	CollectorIDs  []uuid.UUID            `json:"collector_ids" binding:"required"`
	Parameters    map[string]interface{} `json:"parameters"`
	TaskName      string                 `json:"task_name" binding:"required"`
}

// TemplateListResponse represents the response for template listing
type TemplateListResponse struct {
	Templates []models.ConfigTemplate `json:"templates"`
	Total     int64                   `json:"total"`
	Page      int                     `json:"page"`
	Size      int                     `json:"size"`
}

// CreateTemplate creates a new configuration template
func (s *ConfigTemplateService) CreateTemplate(req *TemplateCreateRequest) (*models.ConfigTemplate, error) {
	// Validate template configuration
	if err := s.validateTemplateConfig(req.Protocol, req.TemplateConfig); err != nil {
		return nil, fmt.Errorf("invalid template configuration: %w", err)
	}

	// Set default version if not provided
	if req.Version == "" {
		req.Version = "1.0.0"
	}

	// Validate version format
	if !s.isValidVersion(req.Version) {
		return nil, errors.New("invalid version format, expected semantic version (e.g., 1.0.0)")
	}

	// Convert template config to JSON
	configJSON, err := json.Marshal(req.TemplateConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal template config: %w", err)
	}

	// Convert tags to JSON
	tagsJSON, err := json.Marshal(req.Tags)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tags: %w", err)
	}

	template := &models.ConfigTemplate{
		Name:           req.Name,
		Description:    req.Description,
		Protocol:       req.Protocol,
		TemplateConfig: string(configJSON),
		Version:        req.Version,
		CreatedBy:      req.CreatedBy,
		Status:         "active",
		Tags:           string(tagsJSON),
	}

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create template
	if err := tx.Create(template).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create template: %w", err)
	}

	// Create initial version record
	version := &models.ConfigTemplateVersion{
		TemplateID: template.ID,
		Version:    req.Version,
		Config:     string(configJSON),
		ChangeLog:  "Initial version",
		CreatedBy:  req.CreatedBy,
	}

	if err := tx.Create(version).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create template version: %w", err)
	}

	tx.Commit()

	// Load creator information
	s.db.Preload("Creator").First(template, template.ID)

	return template, nil
}

// GetTemplate retrieves a template by ID
func (s *ConfigTemplateService) GetTemplate(id uuid.UUID) (*models.ConfigTemplate, error) {
	var template models.ConfigTemplate
	if err := s.db.Preload("Creator").First(&template, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("template not found")
		}
		return nil, fmt.Errorf("failed to get template: %w", err)
	}
	return &template, nil
}

// ListTemplates retrieves templates with pagination and filtering
func (s *ConfigTemplateService) ListTemplates(page, size int, protocol, status string) (*TemplateListResponse, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	query := s.db.Model(&models.ConfigTemplate{}).Preload("Creator")

	// Apply filters
	if protocol != "" {
		query = query.Where("protocol = ?", protocol)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count templates: %w", err)
	}

	// Get templates with pagination
	var templates []models.ConfigTemplate
	offset := (page - 1) * size
	if err := query.Offset(offset).Limit(size).Order("created_at DESC").Find(&templates).Error; err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}

	return &TemplateListResponse{
		Templates: templates,
		Total:     total,
		Page:      page,
		Size:      size,
	}, nil
}

// UpdateTemplate updates an existing template
func (s *ConfigTemplateService) UpdateTemplate(id uuid.UUID, req *TemplateUpdateRequest, userID uint) (*models.ConfigTemplate, error) {
	// Get existing template
	template, err := s.GetTemplate(id)
	if err != nil {
		return nil, err
	}

	// Validate template configuration if provided
	if req.TemplateConfig != nil {
		protocol := req.Protocol
		if protocol == "" {
			protocol = template.Protocol
		}
		if err := s.validateTemplateConfig(protocol, req.TemplateConfig); err != nil {
			return nil, fmt.Errorf("invalid template configuration: %w", err)
		}
	}

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Prepare update data
	updates := make(map[string]interface{})
	var newVersion string

	if req.Name != "" && req.Name != template.Name {
		updates["name"] = req.Name
	}
	if req.Description != template.Description {
		updates["description"] = req.Description
	}
	if req.Protocol != "" && req.Protocol != template.Protocol {
		updates["protocol"] = req.Protocol
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		updates["tags"] = string(tagsJSON)
	}

	if req.TemplateConfig != nil {
		configJSON, err := json.Marshal(req.TemplateConfig)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to marshal template config: %w", err)
		}
		if string(configJSON) != template.TemplateConfig {
			updates["template_config"] = string(configJSON)
			
			// Increment version
			newVersion = s.incrementVersion(template.Version)
			updates["version"] = newVersion

			// Create version record
			version := &models.ConfigTemplateVersion{
				TemplateID: template.ID,
				Version:    newVersion,
				Config:     string(configJSON),
				ChangeLog:  req.ChangeLog,
				CreatedBy:  userID,
			}

			if err := tx.Create(version).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("failed to create template version: %w", err)
			}
		}
	}

	// Update template if there are changes
	if len(updates) > 0 {
		if err := tx.Model(template).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update template: %w", err)
		}
	}

	tx.Commit()

	// Reload template with updated data
	return s.GetTemplate(id)
}

// DeleteTemplate deletes a template (soft delete by setting status to inactive)
func (s *ConfigTemplateService) DeleteTemplate(id uuid.UUID) error {
	// Check if template is being used by any collection tasks
	var taskCount int64
	if err := s.db.Model(&models.CollectionTask{}).Where("template_id = ?", id).Count(&taskCount).Error; err != nil {
		return fmt.Errorf("failed to check template usage: %w", err)
	}

	if taskCount > 0 {
		return fmt.Errorf("cannot delete template: it is being used by %d collection task(s)", taskCount)
	}

	// Soft delete by setting status to inactive
	if err := s.db.Model(&models.ConfigTemplate{}).Where("id = ?", id).Update("status", "inactive").Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("template not found")
		}
		return fmt.Errorf("failed to delete template: %w", err)
	}

	return nil
}

// GetTemplateVersions retrieves version history for a template
func (s *ConfigTemplateService) GetTemplateVersions(templateID uuid.UUID) ([]models.ConfigTemplateVersion, error) {
	var versions []models.ConfigTemplateVersion
	if err := s.db.Preload("Creator").Where("template_id = ?", templateID).Order("created_at DESC").Find(&versions).Error; err != nil {
		return nil, fmt.Errorf("failed to get template versions: %w", err)
	}
	return versions, nil
}

// ApplyTemplate applies a template to multiple collectors
func (s *ConfigTemplateService) ApplyTemplate(req *TemplateApplyRequest, userID uint) ([]models.CollectionTask, error) {
	// Get template
	template, err := s.GetTemplate(req.TemplateID)
	if err != nil {
		return nil, err
	}

	// Parse template config
	var templateConfig map[string]interface{}
	if err := json.Unmarshal([]byte(template.TemplateConfig), &templateConfig); err != nil {
		return nil, fmt.Errorf("failed to parse template config: %w", err)
	}

	// Apply parameters to template config
	finalConfig := s.applyParameters(templateConfig, req.Parameters)

	// Validate final configuration
	if err := s.validateTemplateConfig(template.Protocol, finalConfig); err != nil {
		return nil, fmt.Errorf("invalid final configuration: %w", err)
	}

	// Convert final config to JSON
	configJSON, err := json.Marshal(finalConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal final config: %w", err)
	}

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var tasks []models.CollectionTask

	// Create collection tasks for each collector
	for _, collectorID := range req.CollectorIDs {
		// Check if collector exists
		var collector models.Collector
		if err := tx.First(&collector, "id = ?", collectorID).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("collector %s not found", collectorID)
			}
			return nil, fmt.Errorf("failed to check collector: %w", err)
		}

		task := models.CollectionTask{
			CollectorID: collectorID,
			Name:        req.TaskName,
			Protocol:    template.Protocol,
			Config:      string(configJSON),
			Enabled:     true,
			TemplateID:  &req.TemplateID,
		}

		if err := tx.Create(&task).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to create collection task for collector %s: %w", collectorID, err)
		}

		tasks = append(tasks, task)
	}

	tx.Commit()

	return tasks, nil
}

// ExportTemplate exports a template to JSON format
func (s *ConfigTemplateService) ExportTemplate(id uuid.UUID) (map[string]interface{}, error) {
	template, err := s.GetTemplate(id)
	if err != nil {
		return nil, err
	}

	// Parse template config
	var templateConfig map[string]interface{}
	if err := json.Unmarshal([]byte(template.TemplateConfig), &templateConfig); err != nil {
		return nil, fmt.Errorf("failed to parse template config: %w", err)
	}

	// Parse tags
	var tags []string
	if template.Tags != "" {
		json.Unmarshal([]byte(template.Tags), &tags)
	}

	export := map[string]interface{}{
		"name":            template.Name,
		"description":     template.Description,
		"protocol":        template.Protocol,
		"template_config": templateConfig,
		"version":         template.Version,
		"tags":            tags,
		"exported_at":     time.Now(),
	}

	return export, nil
}

// ImportTemplate imports a template from JSON format
func (s *ConfigTemplateService) ImportTemplate(data map[string]interface{}, userID uint) (*models.ConfigTemplate, error) {
	// Validate required fields
	name, ok := data["name"].(string)
	if !ok || name == "" {
		return nil, errors.New("name is required")
	}

	protocol, ok := data["protocol"].(string)
	if !ok || protocol == "" {
		return nil, errors.New("protocol is required")
	}

	templateConfig, ok := data["template_config"].(map[string]interface{})
	if !ok {
		return nil, errors.New("template_config is required")
	}

	// Extract optional fields
	description, _ := data["description"].(string)
	version, _ := data["version"].(string)
	if version == "" {
		version = "1.0.0"
	}

	tags := []string{}
	if tagsData, ok := data["tags"].([]interface{}); ok {
		for _, tag := range tagsData {
			if tagStr, ok := tag.(string); ok {
				tags = append(tags, tagStr)
			}
		}
	}

	// Create template
	req := &TemplateCreateRequest{
		Name:           name,
		Description:    description,
		Protocol:       protocol,
		TemplateConfig: templateConfig,
		Version:        version,
		Tags:           tags,
		CreatedBy:      userID,
	}

	return s.CreateTemplate(req)
}

// ValidateTemplateConfig validates the template configuration based on protocol (public method)
func (s *ConfigTemplateService) ValidateTemplateConfig(protocol string, config map[string]interface{}) error {
	return s.validateTemplateConfig(protocol, config)
}

// validateTemplateConfig validates the template configuration based on protocol
func (s *ConfigTemplateService) validateTemplateConfig(protocol string, config map[string]interface{}) error {
	switch protocol {
	case "modbus_tcp", "modbus_rtu":
		return s.validateModbusConfig(config)
	case "opcua":
		return s.validateOPCUAConfig(config)
	case "mqtt":
		return s.validateMQTTConfig(config)
	default:
		return fmt.Errorf("unsupported protocol: %s", protocol)
	}
}

// validateModbusConfig validates Modbus configuration
func (s *ConfigTemplateService) validateModbusConfig(config map[string]interface{}) error {
	// Check required fields
	if _, ok := config["connection"]; !ok {
		return errors.New("connection configuration is required for Modbus")
	}

	connection, ok := config["connection"].(map[string]interface{})
	if !ok {
		return errors.New("connection must be an object")
	}

	// Validate connection fields
	if _, ok := connection["host"]; !ok {
		return errors.New("host is required in connection")
	}
	if _, ok := connection["port"]; !ok {
		return errors.New("port is required in connection")
	}

	// Check data points
	if dataPoints, ok := config["data_points"]; ok {
		if points, ok := dataPoints.([]interface{}); ok {
			for i, point := range points {
				if pointMap, ok := point.(map[string]interface{}); ok {
					if _, ok := pointMap["address"]; !ok {
						return fmt.Errorf("address is required for data point %d", i)
					}
					if _, ok := pointMap["data_type"]; !ok {
						return fmt.Errorf("data_type is required for data point %d", i)
					}
				}
			}
		}
	}

	return nil
}

// validateOPCUAConfig validates OPC-UA configuration
func (s *ConfigTemplateService) validateOPCUAConfig(config map[string]interface{}) error {
	// Check required fields
	if _, ok := config["server_url"]; !ok {
		return errors.New("server_url is required for OPC-UA")
	}

	// Check data points
	if dataPoints, ok := config["data_points"]; ok {
		if points, ok := dataPoints.([]interface{}); ok {
			for i, point := range points {
				if pointMap, ok := point.(map[string]interface{}); ok {
					if _, ok := pointMap["node_id"]; !ok {
						return fmt.Errorf("node_id is required for data point %d", i)
					}
				}
			}
		}
	}

	return nil
}

// validateMQTTConfig validates MQTT configuration
func (s *ConfigTemplateService) validateMQTTConfig(config map[string]interface{}) error {
	// Check required fields
	if _, ok := config["broker_url"]; !ok {
		return errors.New("broker_url is required for MQTT")
	}

	// Check topics
	if topics, ok := config["topics"]; ok {
		if topicList, ok := topics.([]interface{}); ok {
			for i, topic := range topicList {
				if topicMap, ok := topic.(map[string]interface{}); ok {
					if _, ok := topicMap["topic"]; !ok {
						return fmt.Errorf("topic is required for topic %d", i)
					}
				}
			}
		}
	}

	return nil
}

// isValidVersion checks if version follows semantic versioning
func (s *ConfigTemplateService) isValidVersion(version string) bool {
	// Simple semantic version validation (major.minor.patch)
	pattern := `^(\d+)\.(\d+)\.(\d+)$`
	matched, _ := regexp.MatchString(pattern, version)
	return matched
}

// incrementVersion increments the patch version
func (s *ConfigTemplateService) incrementVersion(currentVersion string) string {
	parts := strings.Split(currentVersion, ".")
	if len(parts) != 3 {
		return "1.0.1"
	}

	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return "1.0.1"
	}

	return fmt.Sprintf("%s.%s.%d", parts[0], parts[1], patch+1)
}

// applyParameters applies parameters to template configuration
func (s *ConfigTemplateService) applyParameters(templateConfig, parameters map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	
	// Deep copy template config and apply parameters
	for key, value := range templateConfig {
		result[key] = s.applyParametersRecursive(value, parameters)
	}
	
	return result
}

// applyParametersRecursive recursively applies parameters to nested structures
func (s *ConfigTemplateService) applyParametersRecursive(value interface{}, parameters map[string]interface{}) interface{} {
	switch v := value.(type) {
	case string:
		// Replace parameter placeholders like {{param_name}}
		for paramKey, paramValue := range parameters {
			placeholder := fmt.Sprintf("{{%s}}", paramKey)
			if strings.Contains(v, placeholder) {
				if paramStr, ok := paramValue.(string); ok {
					v = strings.ReplaceAll(v, placeholder, paramStr)
				}
			}
		}
		return v
	case map[string]interface{}:
		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = s.applyParametersRecursive(val, parameters)
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, val := range v {
			result[i] = s.applyParametersRecursive(val, parameters)
		}
		return result
	default:
		return v
	}
}