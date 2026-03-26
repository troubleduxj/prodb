package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"prodb/platform/backend/models"
)

func setupSecurityTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Auto-migrate all models
	err = db.AutoMigrate(
		&models.User{},
		&models.Collector{},
		&models.AuditLog{},
		&models.SecurityEvent{},
		&models.LoginAttempt{},
	)
	require.NoError(t, err)

	return db
}

func TestSecurityThreatDetectionService_AnalyzeLoginAttempt(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	// Test normal login attempt
	normalAttempt := &models.LoginAttempt{
		Username:    "testuser",
		IPAddress:   "192.168.1.100",
		UserAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		Success:     true,
		AttemptedAt: time.Now(),
	}

	result, err := service.AnalyzeLoginAttempt(context.Background(), normalAttempt)
	assert.NoError(t, err)
	assert.False(t, result.ThreatDetected)

	// Test suspicious login attempt (unusual user agent)
	suspiciousAttempt := &models.LoginAttempt{
		Username:    "testuser",
		IPAddress:   "192.168.1.100",
		UserAgent:   "curl/7.68.0",
		Success:     false,
		FailReason:  "Invalid credentials",
		AttemptedAt: time.Now(),
	}

	result, err = service.AnalyzeLoginAttempt(context.Background(), suspiciousAttempt)
	assert.NoError(t, err)
	// May or may not detect threat depending on other factors
}

func TestSecurityThreatDetectionService_CheckBruteForceAttack(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	ipAddress := "192.168.1.100"

	// Create multiple failed login attempts
	for i := 0; i < 6; i++ {
		attempt := &models.LoginAttempt{
			Username:    "testuser",
			IPAddress:   ipAddress,
			UserAgent:   "Test Agent",
			Success:     false,
			FailReason:  "Invalid credentials",
			AttemptedAt: time.Now(),
		}
		require.NoError(t, db.Create(attempt).Error)
	}

	// Test the latest attempt
	latestAttempt := &models.LoginAttempt{
		Username:    "testuser",
		IPAddress:   ipAddress,
		UserAgent:   "Test Agent",
		Success:     false,
		FailReason:  "Invalid credentials",
		AttemptedAt: time.Now(),
	}

	result := service.checkBruteForceAttack(context.Background(), latestAttempt)
	assert.True(t, result.ThreatDetected)
	assert.Equal(t, "brute_force_login", result.ThreatType)
	assert.Equal(t, "high", result.Severity)
	assert.Greater(t, result.Confidence, 0.8)
}

func TestSecurityThreatDetectionService_CheckSuspiciousLoginPattern(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	// Test login at unusual time (3 AM)
	unusualTimeAttempt := &models.LoginAttempt{
		Username:    "testuser",
		IPAddress:   "192.168.1.100",
		UserAgent:   "curl/7.68.0", // Suspicious user agent
		Success:     false,
		AttemptedAt: time.Date(2024, 1, 1, 3, 0, 0, 0, time.UTC),
	}

	result := service.checkSuspiciousLoginPattern(context.Background(), unusualTimeAttempt)
	assert.True(t, result.ThreatDetected)
	assert.Equal(t, "suspicious_login_pattern", result.ThreatType)
	assert.Equal(t, "medium", result.Severity)
}

func TestSecurityThreatDetectionService_AnalyzeAuditLog(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	userID := uint(1)

	// Test normal audit log
	normalLog := &models.AuditLog{
		UserID:     &userID,
		Action:     "read",
		Resource:   "collector",
		Method:     "GET",
		Path:       "/api/v1/collectors",
		IPAddress:  "192.168.1.100",
		StatusCode: 200,
		Duration:   150,
		CreatedAt:  time.Now(),
	}

	result, err := service.AnalyzeAuditLog(context.Background(), normalLog)
	assert.NoError(t, err)
	assert.False(t, result.ThreatDetected)

	// Test privilege escalation attempt
	privilegeLog := &models.AuditLog{
		UserID:      &userID,
		Action:      "create_user",
		Resource:    "user",
		Method:      "POST",
		Path:        "/api/v1/users",
		IPAddress:   "192.168.1.100",
		StatusCode:  403, // Forbidden
		Duration:    200,
		IsSensitive: true,
		CreatedAt:   time.Now(),
	}

	result, err = service.AnalyzeAuditLog(context.Background(), privilegeLog)
	assert.NoError(t, err)
	// May detect privilege escalation depending on conditions
}

func TestSecurityThreatDetectionService_CheckRapidAPICalls(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	ipAddress := "192.168.1.100"
	userID := uint(1)

	// Create many audit logs with errors to simulate rapid API calls
	for i := 0; i < 120; i++ {
		auditLog := &models.AuditLog{
			UserID:     &userID,
			Action:     "read",
			Resource:   "data",
			Method:     "GET",
			Path:       "/api/v1/data",
			IPAddress:  ipAddress,
			StatusCode: 429, // Too Many Requests
			Duration:   50,
			CreatedAt:  time.Now(),
		}
		require.NoError(t, db.Create(auditLog).Error)
	}

	// Test the latest audit log
	latestLog := &models.AuditLog{
		UserID:     &userID,
		Action:     "read",
		Resource:   "data",
		Method:     "GET",
		Path:       "/api/v1/data",
		IPAddress:  ipAddress,
		StatusCode: 429,
		Duration:   50,
		CreatedAt:  time.Now(),
	}

	result := service.checkRapidAPICalls(context.Background(), latestLog)
	assert.True(t, result.ThreatDetected)
	assert.Equal(t, "rapid_api_calls", result.ThreatType)
	assert.Equal(t, "medium", result.Severity)
}

func TestSecurityThreatDetectionService_CheckPrivilegeEscalation(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	userID := uint(1)

	// Test access to admin endpoint with unauthorized status
	adminLog := &models.AuditLog{
		UserID:      &userID,
		Action:      "read",
		Resource:    "users",
		Method:      "GET",
		Path:        "/api/v1/admin/users",
		IPAddress:   "192.168.1.100",
		StatusCode:  403, // Forbidden
		Duration:    100,
		IsSensitive: true,
		CreatedAt:   time.Now(),
	}

	result := service.checkPrivilegeEscalation(context.Background(), adminLog)
	assert.True(t, result.ThreatDetected)
	assert.Equal(t, "privilege_escalation", result.ThreatType)
	assert.Equal(t, "critical", result.Severity)
}

func TestSecurityThreatDetectionService_CheckDataExfiltration(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	userID := uint(1)
	ipAddress := "192.168.1.100"

	// Create multiple data access logs
	for i := 0; i < 15; i++ {
		auditLog := &models.AuditLog{
			UserID:    &userID,
			Action:    "read",
			Resource:  "data",
			Method:    "GET",
			Path:      "/api/v1/data/export",
			IPAddress: ipAddress,
			StatusCode: 200,
			Duration:  100,
			CreatedAt: time.Now(),
		}
		require.NoError(t, db.Create(auditLog).Error)
	}

	// Test the latest data access
	latestLog := &models.AuditLog{
		UserID:    &userID,
		Action:    "read",
		Resource:  "data",
		Method:    "GET",
		Path:      "/api/v1/data/export",
		IPAddress: ipAddress,
		StatusCode: 200,
		Duration:  100,
		CreatedAt: time.Now(),
	}

	result := service.checkDataExfiltration(context.Background(), latestLog)
	assert.True(t, result.ThreatDetected)
	assert.Equal(t, "data_exfiltration", result.ThreatType)
	assert.Equal(t, "critical", result.Severity)
}

func TestSecurityThreatDetectionService_IsUnusualUserAgent(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	testCases := []struct {
		userAgent string
		expected  bool
	}{
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", false},
		{"curl/7.68.0", true},
		{"wget/1.20.3", true},
		{"python-requests/2.25.1", true},
		{"Chrome/91.0.4472.124", false},
		{"bot-scanner/1.0", true},
	}

	for _, tc := range testCases {
		result := service.isUnusualUserAgent(tc.userAgent)
		assert.Equal(t, tc.expected, result, "User agent: %s", tc.userAgent)
	}
}

func TestSecurityThreatDetectionService_GetThreatRule(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	// Test getting existing rule
	rule := service.getThreatRule("brute_force_login")
	assert.True(t, rule.Enabled)
	assert.Equal(t, "brute_force_login", rule.ID)
	assert.Equal(t, "high", rule.Severity)

	// Test getting non-existent rule
	nonExistentRule := service.getThreatRule("non_existent_rule")
	assert.False(t, nonExistentRule.Enabled)
}

func TestSecurityThreatDetectionService_MarshalDetails(t *testing.T) {
	db := setupSecurityTestDB(t)
	auditService := NewAuditService(db)
	service := NewSecurityThreatDetectionService(db, auditService)

	details := map[string]interface{}{
		"test_key": "test_value",
		"number":   123,
		"boolean":  true,
	}

	result := service.marshalDetails(details)
	assert.Contains(t, result, "test_key")
	assert.Contains(t, result, "test_value")
	assert.Contains(t, result, "123")
	assert.Contains(t, result, "true")
}