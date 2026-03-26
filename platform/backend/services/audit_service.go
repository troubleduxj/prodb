package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"prodb/platform/backend/models"
)

// AuditService handles audit logging and security event tracking
type AuditService struct {
	db *gorm.DB
}

// NewAuditService creates a new audit service instance
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{
		db: db,
	}
}

// AuditLogRequest represents the data for creating an audit log entry
type AuditLogRequest struct {
	UserID       *uint                  `json:"user_id"`
	CollectorID  *uuid.UUID             `json:"collector_id"`
	Action       string                 `json:"action"`
	Resource     string                 `json:"resource"`
	ResourceID   string                 `json:"resource_id"`
	Method       string                 `json:"method"`
	Path         string                 `json:"path"`
	IPAddress    string                 `json:"ip_address"`
	UserAgent    string                 `json:"user_agent"`
	RequestData  map[string]interface{} `json:"request_data"`
	ResponseData map[string]interface{} `json:"response_data"`
	StatusCode   int                    `json:"status_code"`
	Duration     int64                  `json:"duration"`
	SessionID    string                 `json:"session_id"`
	ErrorMessage string                 `json:"error_message"`
}

// LogOperation records a user operation in the audit log
func (s *AuditService) LogOperation(ctx context.Context, req *AuditLogRequest) error {
	// Determine if this is a sensitive operation
	isSensitive := s.isSensitiveOperation(req.Action, req.Resource)
	riskLevel := s.calculateRiskLevel(req.Action, req.Resource, req.StatusCode)

	// Convert request and response data to JSON
	var requestJSON, responseJSON string
	if req.RequestData != nil {
		if data, err := json.Marshal(req.RequestData); err == nil {
			requestJSON = string(data)
		}
	}
	if req.ResponseData != nil {
		if data, err := json.Marshal(req.ResponseData); err == nil {
			responseJSON = string(data)
		}
	}

	auditLog := &models.AuditLog{
		UserID:       req.UserID,
		CollectorID:  req.CollectorID,
		Action:       req.Action,
		Resource:     req.Resource,
		ResourceID:   req.ResourceID,
		Method:       req.Method,
		Path:         req.Path,
		IPAddress:    req.IPAddress,
		UserAgent:    req.UserAgent,
		RequestData:  requestJSON,
		ResponseData: responseJSON,
		StatusCode:   req.StatusCode,
		Duration:     req.Duration,
		IsSensitive:  isSensitive,
		RiskLevel:    riskLevel,
		SessionID:    req.SessionID,
		ErrorMessage: req.ErrorMessage,
		CreatedAt:    time.Now(),
	}

	if err := s.db.Create(auditLog).Error; err != nil {
		log.Printf("Failed to create audit log: %v", err)
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	// If this is a high-risk operation, also create a security event
	if riskLevel == "high" || riskLevel == "critical" {
		s.createSecurityEventFromAudit(ctx, auditLog)
	}

	return nil
}

// AuditLogFilter represents filters for querying audit logs
type AuditLogFilter struct {
	UserID      *uint      `json:"user_id"`
	CollectorID *uuid.UUID `json:"collector_id"`
	Action      string     `json:"action"`
	Resource    string     `json:"resource"`
	ResourceID  string     `json:"resource_id"`
	IPAddress   string     `json:"ip_address"`
	IsSensitive *bool      `json:"is_sensitive"`
	RiskLevel   string     `json:"risk_level"`
	StartTime   *time.Time `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	Page        int        `json:"page"`
	PageSize    int        `json:"page_size"`
	SortBy      string     `json:"sort_by"`
	SortOrder   string     `json:"sort_order"`
}

// AuditLogResponse represents the response for audit log queries
type AuditLogResponse struct {
	Logs       []models.AuditLog `json:"logs"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}

// GetAuditLogs retrieves audit logs with filtering and pagination
func (s *AuditService) GetAuditLogs(ctx context.Context, filter *AuditLogFilter) (*AuditLogResponse, error) {
	query := s.db.Model(&models.AuditLog{}).Preload("User").Preload("Collector")

	// Apply filters
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}
	if filter.CollectorID != nil {
		query = query.Where("collector_id = ?", *filter.CollectorID)
	}
	if filter.Action != "" {
		query = query.Where("action ILIKE ?", "%"+filter.Action+"%")
	}
	if filter.Resource != "" {
		query = query.Where("resource ILIKE ?", "%"+filter.Resource+"%")
	}
	if filter.ResourceID != "" {
		query = query.Where("resource_id = ?", filter.ResourceID)
	}
	if filter.IPAddress != "" {
		query = query.Where("ip_address = ?", filter.IPAddress)
	}
	if filter.IsSensitive != nil {
		query = query.Where("is_sensitive = ?", *filter.IsSensitive)
	}
	if filter.RiskLevel != "" {
		query = query.Where("risk_level = ?", filter.RiskLevel)
	}
	if filter.StartTime != nil {
		query = query.Where("created_at >= ?", *filter.StartTime)
	}
	if filter.EndTime != nil {
		query = query.Where("created_at <= ?", *filter.EndTime)
	}

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count audit logs: %w", err)
	}

	// Apply pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	query = query.Offset(offset).Limit(pageSize)

	// Apply sorting
	sortBy := filter.SortBy
	if sortBy == "" {
		sortBy = "created_at"
	}
	sortOrder := filter.SortOrder
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	var logs []models.AuditLog
	if err := query.Find(&logs).Error; err != nil {
		return nil, fmt.Errorf("failed to retrieve audit logs: %w", err)
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &AuditLogResponse{
		Logs:       logs,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// ExportAuditLogs exports audit logs to CSV format
func (s *AuditService) ExportAuditLogs(ctx context.Context, filter *AuditLogFilter) ([]byte, error) {
	// Remove pagination for export
	filter.Page = 1
	filter.PageSize = 10000 // Limit export to 10k records for performance

	response, err := s.GetAuditLogs(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs for export: %w", err)
	}

	// Create CSV content
	var csvContent strings.Builder
	csvContent.WriteString("ID,User,Collector,Action,Resource,Resource ID,Method,Path,IP Address,Status Code,Duration,Risk Level,Is Sensitive,Created At\n")

	for _, log := range response.Logs {
		username := ""
		if log.User != nil {
			username = log.User.Username
		}
		collectorName := ""
		if log.Collector != nil {
			collectorName = log.Collector.Name
		}

		csvContent.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%t,%s\n",
			log.ID.String(),
			username,
			collectorName,
			log.Action,
			log.Resource,
			log.ResourceID,
			log.Method,
			log.Path,
			log.IPAddress,
			log.StatusCode,
			log.Duration,
			log.RiskLevel,
			log.IsSensitive,
			log.CreatedAt.Format("2006-01-02 15:04:05"),
		))
	}

	return []byte(csvContent.String()), nil
}

// GetAuditStatistics returns statistics about audit logs
func (s *AuditService) GetAuditStatistics(ctx context.Context, startTime, endTime *time.Time) (map[string]interface{}, error) {
	query := s.db.Model(&models.AuditLog{})

	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	var totalLogs int64
	if err := query.Count(&totalLogs).Error; err != nil {
		return nil, fmt.Errorf("failed to count total logs: %w", err)
	}

	var sensitiveLogs int64
	if err := query.Where("is_sensitive = ?", true).Count(&sensitiveLogs).Error; err != nil {
		return nil, fmt.Errorf("failed to count sensitive logs: %w", err)
	}

	// Get risk level distribution
	var riskStats []struct {
		RiskLevel string `json:"risk_level"`
		Count     int64  `json:"count"`
	}
	if err := query.Select("risk_level, COUNT(*) as count").Group("risk_level").Scan(&riskStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get risk statistics: %w", err)
	}

	// Get top actions
	var actionStats []struct {
		Action string `json:"action"`
		Count  int64  `json:"count"`
	}
	if err := query.Select("action, COUNT(*) as count").Group("action").Order("count DESC").Limit(10).Scan(&actionStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get action statistics: %w", err)
	}

	// Get top IP addresses
	var ipStats []struct {
		IPAddress string `json:"ip_address"`
		Count     int64  `json:"count"`
	}
	if err := query.Select("ip_address, COUNT(*) as count").Group("ip_address").Order("count DESC").Limit(10).Scan(&ipStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get IP statistics: %w", err)
	}

	return map[string]interface{}{
		"total_logs":      totalLogs,
		"sensitive_logs":  sensitiveLogs,
		"risk_stats":      riskStats,
		"top_actions":     actionStats,
		"top_ip_addresses": ipStats,
	}, nil
}

// isSensitiveOperation determines if an operation is sensitive
func (s *AuditService) isSensitiveOperation(action, resource string) bool {
	sensitiveActions := []string{
		"delete", "create_user", "update_user", "delete_user",
		"create_role", "update_role", "delete_role",
		"grant_permission", "revoke_permission",
		"reset_password", "change_password",
		"create_collector", "delete_collector", "reset_collector_key",
		"update_config", "delete_config",
		"create_template", "delete_template",
	}

	sensitiveResources := []string{
		"user", "role", "permission", "collector", "config", "template",
	}

	actionLower := strings.ToLower(action)
	resourceLower := strings.ToLower(resource)

	for _, sa := range sensitiveActions {
		if strings.Contains(actionLower, sa) {
			return true
		}
	}

	for _, sr := range sensitiveResources {
		if strings.Contains(resourceLower, sr) && (strings.Contains(actionLower, "create") || 
			strings.Contains(actionLower, "update") || strings.Contains(actionLower, "delete")) {
			return true
		}
	}

	return false
}

// calculateRiskLevel determines the risk level of an operation
func (s *AuditService) calculateRiskLevel(action, resource string, statusCode int) string {
	actionLower := strings.ToLower(action)
	resourceLower := strings.ToLower(resource)

	// Critical risk operations
	if strings.Contains(actionLower, "delete") && (strings.Contains(resourceLower, "user") || 
		strings.Contains(resourceLower, "collector") || strings.Contains(resourceLower, "database")) {
		return "critical"
	}

	// High risk operations
	if strings.Contains(actionLower, "create") && strings.Contains(resourceLower, "user") {
		return "high"
	}
	if strings.Contains(actionLower, "reset") && strings.Contains(resourceLower, "key") {
		return "high"
	}
	if strings.Contains(actionLower, "grant") || strings.Contains(actionLower, "revoke") {
		return "high"
	}

	// Medium risk operations
	if strings.Contains(actionLower, "update") && (strings.Contains(resourceLower, "config") || 
		strings.Contains(resourceLower, "template")) {
		return "medium"
	}
	if statusCode >= 400 && statusCode < 500 {
		return "medium"
	}

	// Low risk for everything else
	return "low"
}

// createSecurityEventFromAudit creates a security event from a high-risk audit log
func (s *AuditService) createSecurityEventFromAudit(ctx context.Context, auditLog *models.AuditLog) {
	eventType := "high_risk_operation"
	if auditLog.StatusCode >= 400 {
		eventType = "failed_operation"
	}

	details := map[string]interface{}{
		"audit_log_id": auditLog.ID,
		"action":       auditLog.Action,
		"resource":     auditLog.Resource,
		"status_code":  auditLog.StatusCode,
	}

	detailsJSON, _ := json.Marshal(details)

	securityEvent := &models.SecurityEvent{
		UserID:      auditLog.UserID,
		CollectorID: auditLog.CollectorID,
		EventType:   eventType,
		Severity:    auditLog.RiskLevel,
		Status:      "active",
		IPAddress:   auditLog.IPAddress,
		UserAgent:   auditLog.UserAgent,
		Description: fmt.Sprintf("High-risk operation detected: %s on %s", auditLog.Action, auditLog.Resource),
		Details:     string(detailsJSON),
		RuleID:      "audit_high_risk",
		FirstSeen:   auditLog.CreatedAt,
		LastSeen:    auditLog.CreatedAt,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.db.Create(securityEvent).Error; err != nil {
		log.Printf("Failed to create security event from audit log: %v", err)
	}
}



// LogLoginAttempt records a login attempt
func (s *AuditService) LogLoginAttempt(ctx context.Context, req *LoginAttemptRequest) error {
	loginAttempt := &models.LoginAttempt{
		Username:    req.Username,
		IPAddress:   req.IPAddress,
		UserAgent:   req.UserAgent,
		Success:     req.Success,
		FailReason:  req.FailReason,
		SessionID:   req.SessionID,
		AttemptedAt: req.AttemptedAt,
	}

	if err := s.db.Create(loginAttempt).Error; err != nil {
		log.Printf("Failed to create login attempt log: %v", err)
		return fmt.Errorf("failed to create login attempt log: %w", err)
	}

	// Check for suspicious login patterns
	if !req.Success {
		s.checkForBruteForceAttack(ctx, req.Username, req.IPAddress)
	}

	return nil
}

// checkForBruteForceAttack checks for brute force login attempts
func (s *AuditService) checkForBruteForceAttack(ctx context.Context, username, ipAddress string) {
	// Check failed attempts in the last 15 minutes
	since := time.Now().Add(-15 * time.Minute)
	
	var failedAttempts int64
	s.db.Model(&models.LoginAttempt{}).
		Where("username = ? AND ip_address = ? AND success = false AND attempted_at > ?", 
			username, ipAddress, since).
		Count(&failedAttempts)

	// If more than 5 failed attempts, create security event
	if failedAttempts >= 5 {
		details := map[string]interface{}{
			"username":        username,
			"ip_address":      ipAddress,
			"failed_attempts": failedAttempts,
			"time_window":     "15 minutes",
		}

		detailsJSON, _ := json.Marshal(details)

		securityEvent := &models.SecurityEvent{
			EventType:   "brute_force_login",
			Severity:    "high",
			Status:      "active",
			IPAddress:   ipAddress,
			Description: fmt.Sprintf("Brute force login attempt detected for user %s from IP %s", username, ipAddress),
			Details:     string(detailsJSON),
			RuleID:      "brute_force_detection",
			Count:       int(failedAttempts),
			FirstSeen:   since,
			LastSeen:    time.Now(),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		if err := s.db.Create(securityEvent).Error; err != nil {
			log.Printf("Failed to create brute force security event: %v", err)
		}
	}
}

// LoginAttemptFilter represents filters for querying login attempts
type LoginAttemptFilter struct {
	Username  string     `json:"username"`
	IPAddress string     `json:"ip_address"`
	Success   *bool      `json:"success"`
	StartTime *time.Time `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
	Page      int        `json:"page"`
	PageSize  int        `json:"page_size"`
	SortBy    string     `json:"sort_by"`
	SortOrder string     `json:"sort_order"`
}

// LoginAttemptResponse represents the response for login attempt queries
type LoginAttemptResponse struct {
	Attempts   []models.LoginAttempt `json:"attempts"`
	Total      int64                 `json:"total"`
	Page       int                   `json:"page"`
	PageSize   int                   `json:"page_size"`
	TotalPages int                   `json:"total_pages"`
}

// GetLoginAttempts retrieves login attempts with filtering and pagination
func (s *AuditService) GetLoginAttempts(ctx context.Context, filter *LoginAttemptFilter) (*LoginAttemptResponse, error) {
	query := s.db.Model(&models.LoginAttempt{})

	// Apply filters
	if filter.Username != "" {
		query = query.Where("username ILIKE ?", "%"+filter.Username+"%")
	}
	if filter.IPAddress != "" {
		query = query.Where("ip_address = ?", filter.IPAddress)
	}
	if filter.Success != nil {
		query = query.Where("success = ?", *filter.Success)
	}
	if filter.StartTime != nil {
		query = query.Where("attempted_at >= ?", *filter.StartTime)
	}
	if filter.EndTime != nil {
		query = query.Where("attempted_at <= ?", *filter.EndTime)
	}

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count login attempts: %w", err)
	}

	// Apply pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	query = query.Offset(offset).Limit(pageSize)

	// Apply sorting
	sortBy := filter.SortBy
	if sortBy == "" {
		sortBy = "attempted_at"
	}
	sortOrder := filter.SortOrder
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	var attempts []models.LoginAttempt
	if err := query.Find(&attempts).Error; err != nil {
		return nil, fmt.Errorf("failed to retrieve login attempts: %w", err)
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &LoginAttemptResponse{
		Attempts:   attempts,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// SecurityEventFilter represents filters for querying security events
type SecurityEventFilter struct {
	UserID      *uint      `json:"user_id"`
	CollectorID *uuid.UUID `json:"collector_id"`
	EventType   string     `json:"event_type"`
	Severity    string     `json:"severity"`
	Status      string     `json:"status"`
	IPAddress   string     `json:"ip_address"`
	RuleID      string     `json:"rule_id"`
	StartTime   *time.Time `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	Page        int        `json:"page"`
	PageSize    int        `json:"page_size"`
	SortBy      string     `json:"sort_by"`
	SortOrder   string     `json:"sort_order"`
}

// SecurityEventResponse represents the response for security event queries
type SecurityEventResponse struct {
	Events     []models.SecurityEvent `json:"events"`
	Total      int64                  `json:"total"`
	Page       int                    `json:"page"`
	PageSize   int                    `json:"page_size"`
	TotalPages int                    `json:"total_pages"`
}

// GetSecurityEvents retrieves security events with filtering and pagination
func (s *AuditService) GetSecurityEvents(ctx context.Context, filter *SecurityEventFilter) (*SecurityEventResponse, error) {
	query := s.db.Model(&models.SecurityEvent{}).Preload("User").Preload("Collector").Preload("Resolver")

	// Apply filters
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}
	if filter.CollectorID != nil {
		query = query.Where("collector_id = ?", *filter.CollectorID)
	}
	if filter.EventType != "" {
		query = query.Where("event_type = ?", filter.EventType)
	}
	if filter.Severity != "" {
		query = query.Where("severity = ?", filter.Severity)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.IPAddress != "" {
		query = query.Where("ip_address = ?", filter.IPAddress)
	}
	if filter.RuleID != "" {
		query = query.Where("rule_id = ?", filter.RuleID)
	}
	if filter.StartTime != nil {
		query = query.Where("first_seen >= ?", *filter.StartTime)
	}
	if filter.EndTime != nil {
		query = query.Where("last_seen <= ?", *filter.EndTime)
	}

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count security events: %w", err)
	}

	// Apply pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	query = query.Offset(offset).Limit(pageSize)

	// Apply sorting
	sortBy := filter.SortBy
	if sortBy == "" {
		sortBy = "last_seen"
	}
	sortOrder := filter.SortOrder
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	var events []models.SecurityEvent
	if err := query.Find(&events).Error; err != nil {
		return nil, fmt.Errorf("failed to retrieve security events: %w", err)
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &SecurityEventResponse{
		Events:     events,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// ResolveSecurityEvent marks a security event as resolved
func (s *AuditService) ResolveSecurityEvent(ctx context.Context, eventID uuid.UUID, resolverID uint, resolution string) error {
	now := time.Now()
	
	result := s.db.Model(&models.SecurityEvent{}).
		Where("id = ? AND status = ?", eventID, "active").
		Updates(map[string]interface{}{
			"status":      "resolved",
			"resolved_at": &now,
			"resolved_by": resolverID,
			"resolution":  resolution,
			"updated_at":  now,
		})

	if result.Error != nil {
		return fmt.Errorf("failed to resolve security event: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("security event not found or already resolved")
	}

	return nil
}

// GetAuditLogByID retrieves a single audit log by ID
func (s *AuditService) GetAuditLogByID(ctx context.Context, logID uuid.UUID) (*models.AuditLog, error) {
	var auditLog models.AuditLog
	
	if err := s.db.Preload("User").Preload("Collector").First(&auditLog, "id = ?", logID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("audit log not found")
		}
		return nil, fmt.Errorf("failed to retrieve audit log: %w", err)
	}

	return &auditLog, nil
}