package services

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditMiddleware provides middleware for automatic audit logging
type AuditMiddleware struct {
	auditService *AuditService
}

// NewAuditMiddleware creates a new audit middleware instance
func NewAuditMiddleware(auditService *AuditService) *AuditMiddleware {
	return &AuditMiddleware{
		auditService: auditService,
	}
}

// responseWriter wraps gin.ResponseWriter to capture response data
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// AuditLogger returns a gin middleware that logs all requests to the audit system
func (m *AuditMiddleware) AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip audit logging for health checks and static assets
		if m.shouldSkipAudit(c.Request.URL.Path) {
			c.Next()
			return
		}

		start := time.Now()

		// Capture request body
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// Wrap response writer to capture response
		responseBody := &bytes.Buffer{}
		writer := &responseWriter{
			ResponseWriter: c.Writer,
			body:          responseBody,
		}
		c.Writer = writer

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Milliseconds()

		// Extract user information from context
		var userID *uint
		if user, exists := c.Get("user"); exists {
			if u, ok := user.(map[string]interface{}); ok {
				if id, ok := u["id"].(float64); ok {
					uid := uint(id)
					userID = &uid
				}
			}
		}

		// Extract collector ID from path or request
		var collectorID *uuid.UUID
		if id := c.Param("collector_id"); id != "" {
			if parsed, err := uuid.Parse(id); err == nil {
				collectorID = &parsed
			}
		}

		// Extract session ID
		sessionID := m.extractSessionID(c)

		// Parse request data
		var requestData map[string]interface{}
		if len(requestBody) > 0 && m.isJSONContent(c.GetHeader("Content-Type")) {
			json.Unmarshal(requestBody, &requestData)
		}

		// Parse response data (limit size for performance)
		var responseData map[string]interface{}
		if responseBody.Len() > 0 && responseBody.Len() < 10240 { // Limit to 10KB
			if m.isJSONContent(c.GetHeader("Content-Type")) {
				json.Unmarshal(responseBody.Bytes(), &responseData)
			}
		}

		// Determine action and resource from path and method
		action, resource, resourceID := m.extractActionResource(c.Request.Method, c.Request.URL.Path)

		// Create audit log entry
		auditReq := &AuditLogRequest{
			UserID:       userID,
			CollectorID:  collectorID,
			Action:       action,
			Resource:     resource,
			ResourceID:   resourceID,
			Method:       c.Request.Method,
			Path:         c.Request.URL.Path,
			IPAddress:    m.getClientIP(c),
			UserAgent:    c.GetHeader("User-Agent"),
			RequestData:  requestData,
			ResponseData: responseData,
			StatusCode:   c.Writer.Status(),
			Duration:     duration,
			SessionID:    sessionID,
		}

		// Add error message if request failed
		if c.Writer.Status() >= 400 {
			if len(c.Errors) > 0 {
				auditReq.ErrorMessage = c.Errors.String()
			}
		}

		// Log the operation asynchronously to avoid blocking the request
		go func() {
			if err := m.auditService.LogOperation(c.Request.Context(), auditReq); err != nil {
				// Log error but don't fail the request
				// In production, you might want to use a proper logger here
			}
		}()
	}
}

// shouldSkipAudit determines if a request should be skipped from audit logging
func (m *AuditMiddleware) shouldSkipAudit(path string) bool {
	skipPaths := []string{
		"/health",
		"/metrics",
		"/favicon.ico",
		"/static/",
		"/assets/",
		"/ping",
	}

	for _, skipPath := range skipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}

	return false
}

// extractSessionID extracts session ID from request
func (m *AuditMiddleware) extractSessionID(c *gin.Context) string {
	// Try to get session ID from header
	if sessionID := c.GetHeader("X-Session-ID"); sessionID != "" {
		return sessionID
	}

	// Try to get from cookie
	if cookie, err := c.Cookie("session_id"); err == nil {
		return cookie
	}

	// Try to get from JWT token claims
	if token := c.GetHeader("Authorization"); token != "" {
		// This would require JWT parsing - simplified for now
		return strings.Replace(token, "Bearer ", "", 1)[:32] // Use first 32 chars as session ID
	}

	return ""
}

// isJSONContent checks if content type is JSON
func (m *AuditMiddleware) isJSONContent(contentType string) bool {
	return strings.Contains(strings.ToLower(contentType), "application/json")
}

// getClientIP extracts the real client IP address
func (m *AuditMiddleware) getClientIP(c *gin.Context) string {
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

// extractActionResource extracts action and resource information from HTTP method and path
func (m *AuditMiddleware) extractActionResource(method, path string) (action, resource, resourceID string) {
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	
	// Default action based on HTTP method
	switch method {
	case "GET":
		action = "read"
	case "POST":
		action = "create"
	case "PUT", "PATCH":
		action = "update"
	case "DELETE":
		action = "delete"
	default:
		action = strings.ToLower(method)
	}

	// Extract resource from path
	if len(pathParts) >= 3 && pathParts[0] == "api" {
		// API paths like /api/v1/collectors
		if len(pathParts) >= 3 {
			resource = pathParts[2]
		}
		if len(pathParts) >= 4 {
			resourceID = pathParts[3]
		}
	} else if len(pathParts) >= 1 {
		// Direct paths like /collectors
		resource = pathParts[0]
		if len(pathParts) >= 2 {
			resourceID = pathParts[1]
		}
	}

	// Refine action based on path patterns
	if strings.Contains(path, "/login") {
		action = "login"
		resource = "auth"
	} else if strings.Contains(path, "/logout") {
		action = "logout"
		resource = "auth"
	} else if strings.Contains(path, "/register") {
		action = "register"
		resource = "auth"
	} else if strings.Contains(path, "/reset") {
		action = "reset"
	} else if strings.Contains(path, "/config") {
		if method == "POST" {
			action = "update_config"
		}
		resource = "config"
	} else if strings.Contains(path, "/heartbeat") {
		action = "heartbeat"
		resource = "collector"
	}

	return action, resource, resourceID
}

// LoginAuditLogger specifically logs login attempts
func (m *AuditMiddleware) LoginAuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Capture request body for login attempts
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		c.Next()

		// Only log if this is a login attempt
		if !strings.Contains(c.Request.URL.Path, "login") {
			return
		}

		// Parse login request
		var loginData map[string]interface{}
		if len(requestBody) > 0 {
			json.Unmarshal(requestBody, &loginData)
		}

		username := ""
		if loginData != nil {
			if u, ok := loginData["username"].(string); ok {
				username = u
			}
		}

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

		sessionID := m.extractSessionID(c)

		// Create login attempt record
		loginAttempt := &LoginAttemptRequest{
			Username:    username,
			IPAddress:   m.getClientIP(c),
			UserAgent:   c.GetHeader("User-Agent"),
			Success:     success,
			FailReason:  failReason,
			SessionID:   sessionID,
			AttemptedAt: time.Now(),
		}

		// Log asynchronously
		go func() {
			if err := m.auditService.LogLoginAttempt(c.Request.Context(), loginAttempt); err != nil {
				// Log error but don't fail the request
			}
		}()
	}
}

// LoginAttemptRequest represents a login attempt for audit logging
type LoginAttemptRequest struct {
	Username    string    `json:"username"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	Success     bool      `json:"success"`
	FailReason  string    `json:"fail_reason"`
	SessionID   string    `json:"session_id"`
	AttemptedAt time.Time `json:"attempted_at"`
}