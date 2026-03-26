package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"prodb/platform/backend/models"
)

// SecurityIntegrationExample demonstrates how to integrate audit logging and threat detection
type SecurityIntegrationExample struct {
	db                     *gorm.DB
	auditService           *AuditService
	threatDetectionService *SecurityThreatDetectionService
	auditMiddleware        *AuditMiddleware
}

// NewSecurityIntegrationExample creates a new security integration example
func NewSecurityIntegrationExample(db *gorm.DB) *SecurityIntegrationExample {
	auditService := NewAuditService(db)
	threatDetectionService := NewSecurityThreatDetectionService(db, auditService)
	auditMiddleware := NewAuditMiddleware(auditService)

	return &SecurityIntegrationExample{
		db:                     db,
		auditService:           auditService,
		threatDetectionService: threatDetectionService,
		auditMiddleware:        auditMiddleware,
	}
}

// SetupSecurityMiddleware sets up the complete security middleware stack
func (s *SecurityIntegrationExample) SetupSecurityMiddleware(router *gin.Engine) {
	// Add audit logging middleware
	router.Use(s.auditMiddleware.AuditLogger())
	
	// Add enhanced login audit middleware with threat detection
	router.Use(s.enhancedLoginAuditMiddleware())
	
	// Add threat detection middleware for audit logs
	router.Use(s.threatDetectionMiddleware())
}

// enhancedLoginAuditMiddleware combines login auditing with threat detection
func (s *SecurityIntegrationExample) enhancedLoginAuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only process login endpoints
		if !isLoginEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		start := time.Now()

		// Capture request body
		requestBody := captureRequestBody(c)

		c.Next()

		// Create login attempt record
		loginAttempt := s.createLoginAttemptFromContext(c, requestBody, start)
		
		// Log login attempt
		if err := s.auditService.LogLoginAttempt(c.Request.Context(), loginAttempt); err != nil {
			log.Printf("Failed to log login attempt: %v", err)
		}

		// Perform threat analysis asynchronously
		go s.analyzeLoginThreat(c.Request.Context(), loginAttempt)
	}
}

// threatDetectionMiddleware analyzes audit logs for threats
func (s *SecurityIntegrationExample) threatDetectionMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Skip threat detection for non-sensitive operations
		if !isSensitiveOperation(c.Request.Method, c.Request.URL.Path) {
			return
		}

		// Create audit log entry
		auditLog := s.createAuditLogFromContext(c)
		
		// Perform threat analysis asynchronously
		go s.analyzeAuditThreat(c.Request.Context(), auditLog)
	}
}

// analyzeLoginThreat performs threat analysis on login attempts
func (s *SecurityIntegrationExample) analyzeLoginThreat(ctx context.Context, loginAttempt *LoginAttemptRequest) {
	// Convert to model
	attempt := &models.LoginAttempt{
		Username:    loginAttempt.Username,
		IPAddress:   loginAttempt.IPAddress,
		UserAgent:   loginAttempt.UserAgent,
		Success:     loginAttempt.Success,
		FailReason:  loginAttempt.FailReason,
		SessionID:   loginAttempt.SessionID,
		AttemptedAt: loginAttempt.AttemptedAt,
	}

	result, err := s.threatDetectionService.AnalyzeLoginAttempt(ctx, attempt)
	if err != nil {
		log.Printf("Login threat analysis failed: %v", err)
		return
	}

	if result.ThreatDetected {
		log.Printf("Login threat detected: %s (Confidence: %.2f, Severity: %s)", 
			result.ThreatType, result.Confidence, result.Severity)
		
		// Handle threat response
		s.handleThreatResponse(ctx, result, "login", loginAttempt.IPAddress, nil)
	}
}

// analyzeAuditThreat performs threat analysis on audit logs
func (s *SecurityIntegrationExample) analyzeAuditThreat(ctx context.Context, auditLog *models.AuditLog) {
	result, err := s.threatDetectionService.AnalyzeAuditLog(ctx, auditLog)
	if err != nil {
		log.Printf("Audit threat analysis failed: %v", err)
		return
	}

	if result.ThreatDetected {
		log.Printf("Audit threat detected: %s (Confidence: %.2f, Severity: %s)", 
			result.ThreatType, result.Confidence, result.Severity)
		
		// Handle threat response
		s.handleThreatResponse(ctx, result, "audit", auditLog.IPAddress, auditLog.UserID)
	}
}

// handleThreatResponse handles the response to detected threats
func (s *SecurityIntegrationExample) handleThreatResponse(ctx context.Context, result *ThreatAnalysisResult, source, ipAddress string, userID *uint) {
	// Create security event
	event := &models.SecurityEvent{
		UserID:      userID,
		EventType:   result.ThreatType,
		Severity:    result.Severity,
		Status:      "active",
		IPAddress:   ipAddress,
		Description: s.generateThreatDescription(result, source),
		Details:     s.marshalThreatDetails(result),
		RuleID:      result.RuleID,
		FirstSeen:   time.Now(),
		LastSeen:    time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.db.Create(event).Error; err != nil {
		log.Printf("Failed to create security event: %v", err)
		return
	}

	// Execute automated responses based on severity
	s.executeAutomatedResponse(ctx, result, ipAddress, userID)

	// Send notifications
	s.sendThreatNotification(ctx, result, event)
}

// executeAutomatedResponse executes automated security responses
func (s *SecurityIntegrationExample) executeAutomatedResponse(ctx context.Context, result *ThreatAnalysisResult, ipAddress string, userID *uint) {
	switch result.Severity {
	case "critical":
		// Immediate blocking for critical threats
		if userID != nil {
			s.lockUserAccount(ctx, *userID, result.ThreatType)
		}
		s.blockIPAddress(ctx, ipAddress, result.ThreatType)
		s.sendImmediateAlert(ctx, result)
		
	case "high":
		// Block IP and send alert for high severity threats
		s.blockIPAddress(ctx, ipAddress, result.ThreatType)
		s.sendHighPriorityAlert(ctx, result)
		
	case "medium":
		// Rate limiting and monitoring for medium severity threats
		s.applyRateLimit(ctx, ipAddress, result.ThreatType)
		s.sendMediumPriorityAlert(ctx, result)
		
	case "low":
		// Just log and monitor for low severity threats
		s.logThreatForMonitoring(ctx, result)
	}
}

// Security response methods
func (s *SecurityIntegrationExample) lockUserAccount(ctx context.Context, userID uint, reason string) {
	err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("status", 0).Error
	if err != nil {
		log.Printf("Failed to lock user account %d: %v", userID, err)
		return
	}
	log.Printf("User account %d locked due to %s", userID, reason)
}

func (s *SecurityIntegrationExample) blockIPAddress(ctx context.Context, ipAddress, reason string) {
	// In a real implementation, this would integrate with firewall/proxy
	log.Printf("IP address %s blocked due to %s", ipAddress, reason)
	
	// Store blocked IP in database for reference
	blockedIP := map[string]interface{}{
		"ip_address": ipAddress,
		"reason":     reason,
		"blocked_at": time.Now(),
		"expires_at": time.Now().Add(1 * time.Hour), // Block for 1 hour
	}
	
	// This would be stored in a blocked_ips table in a real implementation
	log.Printf("Blocked IP record: %+v", blockedIP)
}

func (s *SecurityIntegrationExample) applyRateLimit(ctx context.Context, ipAddress, reason string) {
	// In a real implementation, this would integrate with rate limiting middleware
	log.Printf("Rate limit applied to IP %s due to %s", ipAddress, reason)
}

// Notification methods
func (s *SecurityIntegrationExample) sendImmediateAlert(ctx context.Context, result *ThreatAnalysisResult) {
	log.Printf("IMMEDIATE ALERT: Critical threat detected - %s (Confidence: %.2f)", 
		result.ThreatType, result.Confidence)
	// In a real implementation, this would send SMS, email, or push notifications
}

func (s *SecurityIntegrationExample) sendHighPriorityAlert(ctx context.Context, result *ThreatAnalysisResult) {
	log.Printf("HIGH PRIORITY ALERT: High severity threat detected - %s (Confidence: %.2f)", 
		result.ThreatType, result.Confidence)
	// In a real implementation, this would send email notifications
}

func (s *SecurityIntegrationExample) sendMediumPriorityAlert(ctx context.Context, result *ThreatAnalysisResult) {
	log.Printf("MEDIUM PRIORITY ALERT: Medium severity threat detected - %s (Confidence: %.2f)", 
		result.ThreatType, result.Confidence)
	// In a real implementation, this would send dashboard notifications
}

func (s *SecurityIntegrationExample) sendThreatNotification(ctx context.Context, result *ThreatAnalysisResult, event *models.SecurityEvent) {
	// Send notification based on severity
	switch result.Severity {
	case "critical":
		s.sendImmediateAlert(ctx, result)
	case "high":
		s.sendHighPriorityAlert(ctx, result)
	case "medium":
		s.sendMediumPriorityAlert(ctx, result)
	}
}

func (s *SecurityIntegrationExample) logThreatForMonitoring(ctx context.Context, result *ThreatAnalysisResult) {
	log.Printf("Low severity threat logged for monitoring: %s (Confidence: %.2f)", 
		result.ThreatType, result.Confidence)
}

// Helper methods
func (s *SecurityIntegrationExample) createLoginAttemptFromContext(c *gin.Context, requestBody []byte, start time.Time) *LoginAttemptRequest {
	// Parse login data from request body
	username := extractUsernameFromRequest(requestBody)
	success := c.Writer.Status() == 200
	failReason := ""
	
	if !success {
		failReason = "Invalid credentials"
		if c.Writer.Status() == 429 {
			failReason = "Rate limited"
		} else if c.Writer.Status() == 423 {
			failReason = "Account locked"
		}
	}

	return &LoginAttemptRequest{
		Username:    username,
		IPAddress:   getClientIP(c),
		UserAgent:   c.GetHeader("User-Agent"),
		Success:     success,
		FailReason:  failReason,
		SessionID:   extractSessionID(c),
		AttemptedAt: time.Now(),
	}
}

func (s *SecurityIntegrationExample) createAuditLogFromContext(c *gin.Context) *models.AuditLog {
	// Get user ID from context
	var userID *uint
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				uid := uint(id)
				userID = &uid
			}
		}
	}

	return &models.AuditLog{
		UserID:     userID,
		Action:     extractAction(c.Request.Method, c.Request.URL.Path),
		Resource:   extractResource(c.Request.URL.Path),
		Method:     c.Request.Method,
		Path:       c.Request.URL.Path,
		IPAddress:  getClientIP(c),
		UserAgent:  c.GetHeader("User-Agent"),
		StatusCode: c.Writer.Status(),
		CreatedAt:  time.Now(),
	}
}

func (s *SecurityIntegrationExample) generateThreatDescription(result *ThreatAnalysisResult, source string) string {
	return fmt.Sprintf("Security threat detected from %s: %s (Confidence: %.2f)", 
		source, result.ThreatType, result.Confidence)
}

func (s *SecurityIntegrationExample) marshalThreatDetails(result *ThreatAnalysisResult) string {
	details := map[string]interface{}{
		"threat_type": result.ThreatType,
		"confidence":  result.Confidence,
		"severity":    result.Severity,
		"details":     result.Details,
		"actions":     result.Actions,
		"rule_id":     result.RuleID,
	}
	
	if data, err := json.Marshal(details); err == nil {
		return string(data)
	}
	return "{}"
}

// Utility functions
func isLoginEndpoint(path string) bool {
	return strings.Contains(path, "login") || strings.Contains(path, "auth")
}

func isSensitiveOperation(method, path string) bool {
	// Check for sensitive paths
	sensitivePaths := []string{
		"/admin", "/users", "/roles", "/permissions", 
		"/config", "/collectors", "/templates",
	}
	
	for _, sensitivePath := range sensitivePaths {
		if strings.Contains(path, sensitivePath) {
			return true
		}
	}
	
	// Check for sensitive methods on any path
	return method == "DELETE" || method == "POST" || method == "PUT"
}

func captureRequestBody(c *gin.Context) []byte {
	// This would capture and restore the request body
	// Simplified for example
	return []byte{}
}

func extractUsernameFromRequest(requestBody []byte) string {
	// This would parse the JSON request body to extract username
	// Simplified for example
	return "unknown"
}

func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}
	
	// Check X-Real-IP header
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	return c.ClientIP()
}

func extractSessionID(c *gin.Context) string {
	// Try to get session ID from header
	if sessionID := c.GetHeader("X-Session-ID"); sessionID != "" {
		return sessionID
	}
	
	// Try to get from cookie
	if cookie, err := c.Cookie("session_id"); err == nil {
		return cookie
	}
	
	return ""
}

func extractAction(method, path string) string {
	switch method {
	case "GET":
		return "read"
	case "POST":
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return strings.ToLower(method)
	}
}

func extractResource(path string) string {
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	if len(pathParts) >= 3 && pathParts[0] == "api" {
		return pathParts[2]
	} else if len(pathParts) >= 1 {
		return pathParts[0]
	}
	return "unknown"
}

// DemoSecurityIntegration demonstrates the complete security integration
func DemoSecurityIntegration(db *gorm.DB) {
	integration := NewSecurityIntegrationExample(db)
	
	// Create Gin router
	router := gin.Default()
	
	// Setup security middleware
	integration.SetupSecurityMiddleware(router)
	
	// Add sample routes
	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		// Simulate login logic
		c.JSON(200, gin.H{"message": "Login successful"})
	})
	
	router.GET("/api/v1/users", func(c *gin.Context) {
		// Simulate user listing
		c.JSON(200, gin.H{"users": []string{"user1", "user2"}})
	})
	
	router.DELETE("/api/v1/users/:id", func(c *gin.Context) {
		// Simulate user deletion
		c.JSON(200, gin.H{"message": "User deleted"})
	})
	
	log.Println("Security integration demo setup complete")
	log.Println("The system now includes:")
	log.Println("- Comprehensive audit logging")
	log.Println("- Real-time threat detection")
	log.Println("- Automated security responses")
	log.Println("- Security event tracking")
}