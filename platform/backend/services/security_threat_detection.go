package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"prodb/platform/backend/models"
)

// SecurityThreatDetectionService handles security threat detection and response
type SecurityThreatDetectionService struct {
	db           *gorm.DB
	auditService *AuditService
}

// NewSecurityThreatDetectionService creates a new security threat detection service
func NewSecurityThreatDetectionService(db *gorm.DB, auditService *AuditService) *SecurityThreatDetectionService {
	return &SecurityThreatDetectionService{
		db:           db,
		auditService: auditService,
	}
}

// ThreatDetectionRule represents a security threat detection rule
type ThreatDetectionRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	RuleType    string                 `json:"rule_type"` // brute_force, anomaly, suspicious_activity, etc.
	Enabled     bool                   `json:"enabled"`
	Severity    string                 `json:"severity"` // low, medium, high, critical
	Conditions  map[string]interface{} `json:"conditions"`
	Actions     []string               `json:"actions"` // block_ip, lock_account, send_alert, etc.
	Threshold   int                    `json:"threshold"`
	TimeWindow  time.Duration          `json:"time_window"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// ThreatAnalysisResult represents the result of threat analysis
type ThreatAnalysisResult struct {
	ThreatDetected bool                   `json:"threat_detected"`
	ThreatType     string                 `json:"threat_type"`
	Severity       string                 `json:"severity"`
	Confidence     float64                `json:"confidence"`
	Details        map[string]interface{} `json:"details"`
	Actions        []string               `json:"actions"`
	RuleID         string                 `json:"rule_id"`
}

// SecurityResponse represents an automated security response
type SecurityResponse struct {
	ID          uuid.UUID              `json:"id"`
	EventID     uuid.UUID              `json:"event_id"`
	ActionType  string                 `json:"action_type"`
	Target      string                 `json:"target"` // IP address, user ID, etc.
	Status      string                 `json:"status"` // pending, executed, failed
	Details     map[string]interface{} `json:"details"`
	ExecutedAt  *time.Time             `json:"executed_at"`
	ExpiresAt   *time.Time             `json:"expires_at"`
	CreatedAt   time.Time              `json:"created_at"`
}

// Default threat detection rules
var defaultThreatRules = []ThreatDetectionRule{
	{
		ID:          "brute_force_login",
		Name:        "Brute Force Login Detection",
		Description: "Detects multiple failed login attempts from the same IP",
		RuleType:    "brute_force",
		Enabled:     true,
		Severity:    "high",
		Conditions: map[string]interface{}{
			"failed_attempts": 5,
			"success_rate":    0.2, // Less than 20% success rate
		},
		Actions:    []string{"block_ip", "send_alert"},
		Threshold:  5,
		TimeWindow: 15 * time.Minute,
	},
	{
		ID:          "suspicious_login_pattern",
		Name:        "Suspicious Login Pattern",
		Description: "Detects login attempts from unusual locations or times",
		RuleType:    "anomaly",
		Enabled:     true,
		Severity:    "medium",
		Conditions: map[string]interface{}{
			"unusual_location": true,
			"unusual_time":     true,
		},
		Actions:    []string{"send_alert", "require_mfa"},
		Threshold:  3,
		TimeWindow: 1 * time.Hour,
	},
	{
		ID:          "rapid_api_calls",
		Name:        "Rapid API Calls",
		Description: "Detects unusually high API call frequency",
		RuleType:    "anomaly",
		Enabled:     true,
		Severity:    "medium",
		Conditions: map[string]interface{}{
			"requests_per_minute": 100,
			"error_rate":          0.5, // More than 50% error rate
		},
		Actions:    []string{"rate_limit", "send_alert"},
		Threshold:  100,
		TimeWindow: 1 * time.Minute,
	},
	{
		ID:          "privilege_escalation",
		Name:        "Privilege Escalation Attempt",
		Description: "Detects attempts to access unauthorized resources",
		RuleType:    "suspicious_activity",
		Enabled:     true,
		Severity:    "critical",
		Conditions: map[string]interface{}{
			"unauthorized_access": true,
			"admin_endpoints":     true,
		},
		Actions:    []string{"lock_account", "send_alert", "log_incident"},
		Threshold:  1,
		TimeWindow: 5 * time.Minute,
	},
	{
		ID:          "data_exfiltration",
		Name:        "Data Exfiltration Detection",
		Description: "Detects unusual data access patterns",
		RuleType:    "anomaly",
		Enabled:     true,
		Severity:    "critical",
		Conditions: map[string]interface{}{
			"large_data_access": true,
			"unusual_queries":   true,
		},
		Actions:    []string{"block_user", "send_alert", "log_incident"},
		Threshold:  10,
		TimeWindow: 10 * time.Minute,
	},
}

// AnalyzeLoginAttempt analyzes a login attempt for security threats
func (s *SecurityThreatDetectionService) AnalyzeLoginAttempt(ctx context.Context, attempt *models.LoginAttempt) (*ThreatAnalysisResult, error) {
	result := &ThreatAnalysisResult{
		ThreatDetected: false,
		Confidence:     0.0,
		Details:        make(map[string]interface{}),
	}

	// Check for brute force attacks
	if brute := s.checkBruteForceAttack(ctx, attempt); brute.ThreatDetected {
		result = brute
	}

	// Check for suspicious login patterns
	if suspicious := s.checkSuspiciousLoginPattern(ctx, attempt); suspicious.ThreatDetected && suspicious.Confidence > result.Confidence {
		result = suspicious
	}

	// Check for geolocation anomalies
	if geo := s.checkGeolocationAnomaly(ctx, attempt); geo.ThreatDetected && geo.Confidence > result.Confidence {
		result = geo
	}

	// If threat detected, execute automated responses
	if result.ThreatDetected {
		go s.executeSecurityResponse(ctx, result, attempt)
	}

	return result, nil
}

// AnalyzeAuditLog analyzes an audit log entry for security threats
func (s *SecurityThreatDetectionService) AnalyzeAuditLog(ctx context.Context, auditLog *models.AuditLog) (*ThreatAnalysisResult, error) {
	result := &ThreatAnalysisResult{
		ThreatDetected: false,
		Confidence:     0.0,
		Details:        make(map[string]interface{}),
	}

	// Check for rapid API calls
	if rapid := s.checkRapidAPICalls(ctx, auditLog); rapid.ThreatDetected {
		result = rapid
	}

	// Check for privilege escalation attempts
	if priv := s.checkPrivilegeEscalation(ctx, auditLog); priv.ThreatDetected && priv.Confidence > result.Confidence {
		result = priv
	}

	// Check for data exfiltration patterns
	if data := s.checkDataExfiltration(ctx, auditLog); data.ThreatDetected && data.Confidence > result.Confidence {
		result = data
	}

	// Check for suspicious user behavior
	if behavior := s.checkSuspiciousUserBehavior(ctx, auditLog); behavior.ThreatDetected && behavior.Confidence > result.Confidence {
		result = behavior
	}

	// If threat detected, execute automated responses
	if result.ThreatDetected {
		go s.executeSecurityResponse(ctx, result, auditLog)
	}

	return result, nil
}

// checkBruteForceAttack checks for brute force login attempts
func (s *SecurityThreatDetectionService) checkBruteForceAttack(ctx context.Context, attempt *models.LoginAttempt) *ThreatAnalysisResult {
	rule := s.getThreatRule("brute_force_login")
	if !rule.Enabled {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	// Count failed attempts in the time window
	since := time.Now().Add(-rule.TimeWindow)
	var failedCount int64
	s.db.Model(&models.LoginAttempt{}).
		Where("ip_address = ? AND success = false AND attempted_at > ?", attempt.IPAddress, since).
		Count(&failedCount)

	// Count total attempts for success rate calculation
	var totalCount int64
	s.db.Model(&models.LoginAttempt{}).
		Where("ip_address = ? AND attempted_at > ?", attempt.IPAddress, since).
		Count(&totalCount)

	successRate := 1.0
	if totalCount > 0 {
		successRate = float64(totalCount-failedCount) / float64(totalCount)
	}

	threshold := int64(rule.Threshold)
	minSuccessRate := rule.Conditions["success_rate"].(float64)

	if failedCount >= threshold && successRate < minSuccessRate {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "brute_force_login",
			Severity:       rule.Severity,
			Confidence:     0.9,
			Details: map[string]interface{}{
				"failed_attempts": failedCount,
				"success_rate":    successRate,
				"ip_address":      attempt.IPAddress,
				"time_window":     rule.TimeWindow.String(),
			},
			Actions: rule.Actions,
			RuleID:  rule.ID,
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkSuspiciousLoginPattern checks for suspicious login patterns
func (s *SecurityThreatDetectionService) checkSuspiciousLoginPattern(ctx context.Context, attempt *models.LoginAttempt) *ThreatAnalysisResult {
	rule := s.getThreatRule("suspicious_login_pattern")
	if !rule.Enabled {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	confidence := 0.0
	details := make(map[string]interface{})

	// Check for unusual time (outside business hours)
	hour := attempt.AttemptedAt.Hour()
	if hour < 6 || hour > 22 { // Outside 6 AM - 10 PM
		confidence += 0.3
		details["unusual_time"] = true
		details["login_hour"] = hour
	}

	// Check for unusual user agent patterns
	if s.isUnusualUserAgent(attempt.UserAgent) {
		confidence += 0.4
		details["unusual_user_agent"] = true
	}

	// Check for geolocation anomalies (simplified)
	if s.isUnusualLocation(attempt.IPAddress, attempt.Username) {
		confidence += 0.5
		details["unusual_location"] = true
	}

	if confidence >= 0.6 {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "suspicious_login_pattern",
			Severity:       rule.Severity,
			Confidence:     confidence,
			Details:        details,
			Actions:        rule.Actions,
			RuleID:         rule.ID,
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkGeolocationAnomaly checks for geolocation-based anomalies
func (s *SecurityThreatDetectionService) checkGeolocationAnomaly(ctx context.Context, attempt *models.LoginAttempt) *ThreatAnalysisResult {
	// Get user's recent login locations
	var recentAttempts []models.LoginAttempt
	since := time.Now().AddDate(0, 0, -30) // Last 30 days
	
	s.db.Where("username = ? AND success = true AND attempted_at > ?", attempt.Username, since).
		Order("attempted_at DESC").
		Limit(10).
		Find(&recentAttempts)

	if len(recentAttempts) == 0 {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	// Check if current IP is significantly different from recent IPs
	currentCountry := s.getCountryFromIP(attempt.IPAddress)
	recentCountries := make(map[string]int)
	
	for _, recent := range recentAttempts {
		country := s.getCountryFromIP(recent.IPAddress)
		recentCountries[country]++
	}

	// If current country is not in recent countries, it's suspicious
	if _, exists := recentCountries[currentCountry]; !exists && len(recentCountries) > 0 {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "geolocation_anomaly",
			Severity:       "medium",
			Confidence:     0.7,
			Details: map[string]interface{}{
				"current_country":  currentCountry,
				"recent_countries": recentCountries,
				"ip_address":       attempt.IPAddress,
			},
			Actions: []string{"send_alert", "require_mfa"},
			RuleID:  "geolocation_anomaly",
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkRapidAPICalls checks for rapid API call patterns
func (s *SecurityThreatDetectionService) checkRapidAPICalls(ctx context.Context, auditLog *models.AuditLog) *ThreatAnalysisResult {
	rule := s.getThreatRule("rapid_api_calls")
	if !rule.Enabled {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	// Count requests from the same IP in the time window
	since := time.Now().Add(-rule.TimeWindow)
	var requestCount int64
	var errorCount int64

	s.db.Model(&models.AuditLog{}).
		Where("ip_address = ? AND created_at > ?", auditLog.IPAddress, since).
		Count(&requestCount)

	s.db.Model(&models.AuditLog{}).
		Where("ip_address = ? AND created_at > ? AND status_code >= 400", auditLog.IPAddress, since).
		Count(&errorCount)

	errorRate := 0.0
	if requestCount > 0 {
		errorRate = float64(errorCount) / float64(requestCount)
	}

	threshold := int64(rule.Threshold)
	maxErrorRate := rule.Conditions["error_rate"].(float64)

	if requestCount >= threshold && errorRate > maxErrorRate {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "rapid_api_calls",
			Severity:       rule.Severity,
			Confidence:     0.8,
			Details: map[string]interface{}{
				"request_count": requestCount,
				"error_rate":    errorRate,
				"ip_address":    auditLog.IPAddress,
				"time_window":   rule.TimeWindow.String(),
			},
			Actions: rule.Actions,
			RuleID:  rule.ID,
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkPrivilegeEscalation checks for privilege escalation attempts
func (s *SecurityThreatDetectionService) checkPrivilegeEscalation(ctx context.Context, auditLog *models.AuditLog) *ThreatAnalysisResult {
	rule := s.getThreatRule("privilege_escalation")
	if !rule.Enabled {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	confidence := 0.0
	details := make(map[string]interface{})

	// Check for access to admin endpoints
	adminPaths := []string{"/admin", "/api/v1/users", "/api/v1/roles", "/api/v1/permissions"}
	for _, path := range adminPaths {
		if strings.Contains(auditLog.Path, path) {
			confidence += 0.4
			details["admin_endpoint_access"] = true
			break
		}
	}

	// Check for unauthorized access (4xx errors on sensitive resources)
	if auditLog.StatusCode >= 400 && auditLog.StatusCode < 500 && auditLog.IsSensitive {
		confidence += 0.5
		details["unauthorized_access"] = true
	}

	// Check for privilege-related actions
	privilegeActions := []string{"create_user", "delete_user", "grant_permission", "revoke_permission"}
	for _, action := range privilegeActions {
		if strings.Contains(strings.ToLower(auditLog.Action), action) {
			confidence += 0.6
			details["privilege_action"] = true
			break
		}
	}

	if confidence >= 0.7 {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "privilege_escalation",
			Severity:       rule.Severity,
			Confidence:     confidence,
			Details:        details,
			Actions:        rule.Actions,
			RuleID:         rule.ID,
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkDataExfiltration checks for data exfiltration patterns
func (s *SecurityThreatDetectionService) checkDataExfiltration(ctx context.Context, auditLog *models.AuditLog) *ThreatAnalysisResult {
	rule := s.getThreatRule("data_exfiltration")
	if !rule.Enabled {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	confidence := 0.0
	details := make(map[string]interface{})

	// Check for large data access patterns
	if auditLog.Method == "GET" && strings.Contains(auditLog.Path, "export") {
		confidence += 0.4
		details["export_operation"] = true
	}

	// Check for unusual query patterns
	if strings.Contains(auditLog.Path, "query") && auditLog.Duration > 5000 { // More than 5 seconds
		confidence += 0.3
		details["long_running_query"] = true
	}

	// Count recent data access operations from the same user/IP
	since := time.Now().Add(-rule.TimeWindow)
	var dataAccessCount int64
	
	s.db.Model(&models.AuditLog{}).
		Where("(user_id = ? OR ip_address = ?) AND method = 'GET' AND created_at > ?", 
			auditLog.UserID, auditLog.IPAddress, since).
		Count(&dataAccessCount)

	if dataAccessCount >= int64(rule.Threshold) {
		confidence += 0.5
		details["excessive_data_access"] = true
		details["access_count"] = dataAccessCount
	}

	if confidence >= 0.6 {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "data_exfiltration",
			Severity:       rule.Severity,
			Confidence:     confidence,
			Details:        details,
			Actions:        rule.Actions,
			RuleID:         rule.ID,
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// checkSuspiciousUserBehavior checks for suspicious user behavior patterns
func (s *SecurityThreatDetectionService) checkSuspiciousUserBehavior(ctx context.Context, auditLog *models.AuditLog) *ThreatAnalysisResult {
	if auditLog.UserID == nil {
		return &ThreatAnalysisResult{ThreatDetected: false}
	}

	confidence := 0.0
	details := make(map[string]interface{})

	// Check for unusual activity times
	hour := auditLog.CreatedAt.Hour()
	if hour < 6 || hour > 22 {
		confidence += 0.2
		details["unusual_time"] = true
	}

	// Check for multiple IP addresses for the same user
	since := time.Now().Add(-1 * time.Hour)
	var distinctIPs []string
	
	s.db.Model(&models.AuditLog{}).
		Where("user_id = ? AND created_at > ?", auditLog.UserID, since).
		Distinct("ip_address").
		Pluck("ip_address", &distinctIPs)

	if len(distinctIPs) > 3 {
		confidence += 0.4
		details["multiple_ips"] = true
		details["ip_count"] = len(distinctIPs)
	}

	// Check for rapid successive operations
	var recentCount int64
	s.db.Model(&models.AuditLog{}).
		Where("user_id = ? AND created_at > ?", auditLog.UserID, time.Now().Add(-5*time.Minute)).
		Count(&recentCount)

	if recentCount > 50 {
		confidence += 0.3
		details["rapid_operations"] = true
		details["operation_count"] = recentCount
	}

	if confidence >= 0.5 {
		return &ThreatAnalysisResult{
			ThreatDetected: true,
			ThreatType:     "suspicious_user_behavior",
			Severity:       "medium",
			Confidence:     confidence,
			Details:        details,
			Actions:        []string{"send_alert", "monitor_user"},
			RuleID:         "suspicious_user_behavior",
		}
	}

	return &ThreatAnalysisResult{ThreatDetected: false}
}

// executeSecurityResponse executes automated security responses
func (s *SecurityThreatDetectionService) executeSecurityResponse(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	for _, action := range result.Actions {
		switch action {
		case "block_ip":
			s.blockIPAddress(ctx, result, source)
		case "lock_account":
			s.lockUserAccount(ctx, result, source)
		case "send_alert":
			s.sendSecurityAlert(ctx, result, source)
		case "rate_limit":
			s.applyRateLimit(ctx, result, source)
		case "require_mfa":
			s.requireMFA(ctx, result, source)
		case "log_incident":
			s.logSecurityIncident(ctx, result, source)
		case "monitor_user":
			s.monitorUser(ctx, result, source)
		}
	}
}

// Helper methods for security responses
func (s *SecurityThreatDetectionService) blockIPAddress(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	var ipAddress string
	
	switch src := source.(type) {
	case *models.LoginAttempt:
		ipAddress = src.IPAddress
	case *models.AuditLog:
		ipAddress = src.IPAddress
	}

	if ipAddress == "" {
		return
	}

	// Create security event
	event := &models.SecurityEvent{
		EventType:   "ip_blocked",
		Severity:    result.Severity,
		Status:      "active",
		IPAddress:   ipAddress,
		Description: fmt.Sprintf("IP address %s blocked due to %s", ipAddress, result.ThreatType),
		Details:     s.marshalDetails(result.Details),
		RuleID:      result.RuleID,
		FirstSeen:   time.Now(),
		LastSeen:    time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	s.db.Create(event)
	log.Printf("Blocked IP address: %s due to %s", ipAddress, result.ThreatType)
}

func (s *SecurityThreatDetectionService) lockUserAccount(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	var userID *uint
	
	switch src := source.(type) {
	case *models.AuditLog:
		userID = src.UserID
	}

	if userID == nil {
		return
	}

	// Update user status to locked
	s.db.Model(&models.User{}).Where("id = ?", *userID).Update("status", 0)

	// Create security event
	event := &models.SecurityEvent{
		UserID:      userID,
		EventType:   "account_locked",
		Severity:    result.Severity,
		Status:      "active",
		Description: fmt.Sprintf("User account locked due to %s", result.ThreatType),
		Details:     s.marshalDetails(result.Details),
		RuleID:      result.RuleID,
		FirstSeen:   time.Now(),
		LastSeen:    time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	s.db.Create(event)
	log.Printf("Locked user account: %d due to %s", *userID, result.ThreatType)
}

func (s *SecurityThreatDetectionService) sendSecurityAlert(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	// Create security event for alert
	event := &models.SecurityEvent{
		EventType:   "security_alert",
		Severity:    result.Severity,
		Status:      "active",
		Description: fmt.Sprintf("Security alert: %s detected", result.ThreatType),
		Details:     s.marshalDetails(result.Details),
		RuleID:      result.RuleID,
		FirstSeen:   time.Now(),
		LastSeen:    time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	switch src := source.(type) {
	case *models.LoginAttempt:
		event.IPAddress = src.IPAddress
	case *models.AuditLog:
		event.UserID = src.UserID
		event.IPAddress = src.IPAddress
	}

	s.db.Create(event)
	log.Printf("Security alert sent: %s (Severity: %s)", result.ThreatType, result.Severity)
}

func (s *SecurityThreatDetectionService) applyRateLimit(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	// Implementation would integrate with rate limiting middleware
	log.Printf("Rate limit applied due to %s", result.ThreatType)
}

func (s *SecurityThreatDetectionService) requireMFA(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	// Implementation would require MFA for the user
	log.Printf("MFA required due to %s", result.ThreatType)
}

func (s *SecurityThreatDetectionService) logSecurityIncident(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	// Create high-priority security event
	event := &models.SecurityEvent{
		EventType:   "security_incident",
		Severity:    "critical",
		Status:      "active",
		Description: fmt.Sprintf("Security incident: %s", result.ThreatType),
		Details:     s.marshalDetails(result.Details),
		RuleID:      result.RuleID,
		FirstSeen:   time.Now(),
		LastSeen:    time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	switch src := source.(type) {
	case *models.LoginAttempt:
		event.IPAddress = src.IPAddress
	case *models.AuditLog:
		event.UserID = src.UserID
		event.IPAddress = src.IPAddress
	}

	s.db.Create(event)
	log.Printf("Security incident logged: %s", result.ThreatType)
}

func (s *SecurityThreatDetectionService) monitorUser(ctx context.Context, result *ThreatAnalysisResult, source interface{}) {
	// Implementation would add user to monitoring list
	log.Printf("User monitoring enabled due to %s", result.ThreatType)
}

// Helper methods
func (s *SecurityThreatDetectionService) getThreatRule(ruleID string) ThreatDetectionRule {
	for _, rule := range defaultThreatRules {
		if rule.ID == ruleID {
			return rule
		}
	}
	return ThreatDetectionRule{Enabled: false}
}

func (s *SecurityThreatDetectionService) isUnusualUserAgent(userAgent string) bool {
	// Simple heuristics for unusual user agents
	suspicious := []string{"curl", "wget", "python", "bot", "crawler", "scanner"}
	userAgentLower := strings.ToLower(userAgent)
	
	for _, pattern := range suspicious {
		if strings.Contains(userAgentLower, pattern) {
			return true
		}
	}
	return false
}

func (s *SecurityThreatDetectionService) isUnusualLocation(ipAddress, username string) bool {
	// Simplified geolocation check
	// In a real implementation, this would use a geolocation service
	
	// Check if IP is from a different country than usual
	currentCountry := s.getCountryFromIP(ipAddress)
	
	// Get user's typical countries from recent successful logins
	var recentAttempts []models.LoginAttempt
	since := time.Now().AddDate(0, 0, -7) // Last 7 days
	
	s.db.Where("username = ? AND success = true AND attempted_at > ?", username, since).
		Limit(10).
		Find(&recentAttempts)

	if len(recentAttempts) == 0 {
		return false // No history to compare
	}

	// Check if current country is in recent countries
	for _, attempt := range recentAttempts {
		if s.getCountryFromIP(attempt.IPAddress) == currentCountry {
			return false // Not unusual
		}
	}

	return true // Unusual location
}

func (s *SecurityThreatDetectionService) getCountryFromIP(ipAddress string) string {
	// Simplified country detection based on IP ranges
	// In a real implementation, this would use a proper GeoIP database
	
	ip := net.ParseIP(ipAddress)
	if ip == nil {
		return "unknown"
	}

	// Simple heuristics for demo purposes
	if ip.IsPrivate() || ip.IsLoopback() {
		return "local"
	}

	// This is a very simplified example
	// Real implementation would use MaxMind GeoIP or similar
	return "unknown"
}

func (s *SecurityThreatDetectionService) marshalDetails(details map[string]interface{}) string {
	if data, err := json.Marshal(details); err == nil {
		return string(data)
	}
	return "{}"
}