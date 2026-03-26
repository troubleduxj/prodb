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

func setupTestDB(t *testing.T) *gorm.DB {
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

func TestAuditService_LogOperation(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Create test user and collector
	user := &models.User{
		Username: "testuser",
		FullName: "Test User",
	}
	require.NoError(t, db.Create(user).Error)

	collector := &models.Collector{
		Name:      "Test Collector",
		SecretKey: "test-secret",
		Status:    "online",
	}
	require.NoError(t, db.Create(collector).Error)

	// Test logging a normal operation
	req := &AuditLogRequest{
		UserID:      &user.ID,
		CollectorID: &collector.ID,
		Action:      "read",
		Resource:    "collector",
		ResourceID:  collector.ID.String(),
		Method:      "GET",
		Path:        "/api/v1/collectors",
		IPAddress:   "192.168.1.100",
		UserAgent:   "Test Agent",
		RequestData: map[string]interface{}{
			"test": "data",
		},
		StatusCode: 200,
		Duration:   150,
		SessionID:  "test-session",
	}

	err := service.LogOperation(context.Background(), req)
	assert.NoError(t, err)

	// Verify the audit log was created
	var auditLog models.AuditLog
	err = db.First(&auditLog, "action = ?", "read").Error
	assert.NoError(t, err)
	assert.Equal(t, "read", auditLog.Action)
	assert.Equal(t, "collector", auditLog.Resource)
	assert.Equal(t, 200, auditLog.StatusCode)
	assert.Equal(t, "low", auditLog.RiskLevel)
	assert.False(t, auditLog.IsSensitive)
}

func TestAuditService_LogSensitiveOperation(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Test logging a sensitive operation
	req := &AuditLogRequest{
		Action:     "delete_user",
		Resource:   "user",
		ResourceID: "123",
		Method:     "DELETE",
		Path:       "/api/v1/users/123",
		IPAddress:  "192.168.1.100",
		StatusCode: 200,
		Duration:   250,
	}

	err := service.LogOperation(context.Background(), req)
	assert.NoError(t, err)

	// Verify the audit log was created with correct sensitivity
	var auditLog models.AuditLog
	err = db.First(&auditLog, "action = ?", "delete_user").Error
	assert.NoError(t, err)
	assert.True(t, auditLog.IsSensitive)
	assert.Equal(t, "critical", auditLog.RiskLevel)

	// Verify a security event was created for high-risk operation
	var securityEvent models.SecurityEvent
	err = db.First(&securityEvent, "event_type = ?", "high_risk_operation").Error
	assert.NoError(t, err)
	assert.Equal(t, "critical", securityEvent.Severity)
}

func TestAuditService_GetAuditLogs(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Create test audit logs
	for i := 0; i < 5; i++ {
		auditLog := &models.AuditLog{
			Action:     "test_action",
			Resource:   "test_resource",
			Method:     "GET",
			Path:       "/test",
			IPAddress:  "192.168.1.100",
			StatusCode: 200,
			Duration:   100,
			RiskLevel:  "low",
			CreatedAt:  time.Now().Add(-time.Duration(i) * time.Hour),
		}
		require.NoError(t, db.Create(auditLog).Error)
	}

	// Test getting audit logs with pagination
	filter := &AuditLogFilter{
		Page:     1,
		PageSize: 3,
		SortBy:   "created_at",
		SortOrder: "desc",
	}

	response, err := service.GetAuditLogs(context.Background(), filter)
	assert.NoError(t, err)
	assert.Equal(t, int64(5), response.Total)
	assert.Equal(t, 3, len(response.Logs))
	assert.Equal(t, 1, response.Page)
	assert.Equal(t, 3, response.PageSize)
	assert.Equal(t, 2, response.TotalPages)
}

func TestAuditService_LogLoginAttempt(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Test successful login
	req := &LoginAttemptRequest{
		Username:    "testuser",
		IPAddress:   "192.168.1.100",
		UserAgent:   "Test Agent",
		Success:     true,
		SessionID:   "test-session",
		AttemptedAt: time.Now(),
	}

	err := service.LogLoginAttempt(context.Background(), req)
	assert.NoError(t, err)

	// Verify login attempt was recorded
	var loginAttempt models.LoginAttempt
	err = db.First(&loginAttempt, "username = ?", "testuser").Error
	assert.NoError(t, err)
	assert.True(t, loginAttempt.Success)
	assert.Equal(t, "testuser", loginAttempt.Username)
}

func TestAuditService_BruteForceDetection(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Create multiple failed login attempts
	for i := 0; i < 6; i++ {
		req := &LoginAttemptRequest{
			Username:    "testuser",
			IPAddress:   "192.168.1.100",
			UserAgent:   "Test Agent",
			Success:     false,
			FailReason:  "Invalid credentials",
			AttemptedAt: time.Now(),
		}

		err := service.LogLoginAttempt(context.Background(), req)
		assert.NoError(t, err)
	}

	// Verify security event was created for brute force
	var securityEvent models.SecurityEvent
	err := db.First(&securityEvent, "event_type = ?", "brute_force_login").Error
	assert.NoError(t, err)
	assert.Equal(t, "high", securityEvent.Severity)
	assert.Equal(t, "192.168.1.100", securityEvent.IPAddress)
}

func TestAuditService_GetAuditStatistics(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Create test audit logs with different risk levels
	riskLevels := []string{"low", "medium", "high", "critical"}
	for _, risk := range riskLevels {
		for i := 0; i < 2; i++ {
			auditLog := &models.AuditLog{
				Action:      "test_action",
				Resource:    "test_resource",
				Method:      "GET",
				Path:        "/test",
				IPAddress:   "192.168.1.100",
				StatusCode:  200,
				Duration:    100,
				RiskLevel:   risk,
				IsSensitive: risk == "high" || risk == "critical",
				CreatedAt:   time.Now(),
			}
			require.NoError(t, db.Create(auditLog).Error)
		}
	}

	// Get statistics
	stats, err := service.GetAuditStatistics(context.Background(), nil, nil)
	assert.NoError(t, err)

	assert.Equal(t, int64(8), stats["total_logs"])
	assert.Equal(t, int64(4), stats["sensitive_logs"])

	// Check risk stats
	riskStats, ok := stats["risk_stats"].([]struct {
		RiskLevel string `json:"risk_level"`
		Count     int64  `json:"count"`
	})
	assert.True(t, ok)
	assert.Equal(t, 4, len(riskStats))
}

func TestAuditService_ExportAuditLogs(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuditService(db)

	// Create test audit log
	auditLog := &models.AuditLog{
		Action:     "test_action",
		Resource:   "test_resource",
		Method:     "GET",
		Path:       "/test",
		IPAddress:  "192.168.1.100",
		StatusCode: 200,
		Duration:   100,
		RiskLevel:  "low",
		CreatedAt:  time.Now(),
	}
	require.NoError(t, db.Create(auditLog).Error)

	// Export audit logs
	filter := &AuditLogFilter{}
	csvData, err := service.ExportAuditLogs(context.Background(), filter)
	assert.NoError(t, err)
	assert.Contains(t, string(csvData), "ID,User,Collector,Action,Resource")
	assert.Contains(t, string(csvData), "test_action")
}

func TestAuditService_IsSensitiveOperation(t *testing.T) {
	service := &AuditService{}

	testCases := []struct {
		action    string
		resource  string
		expected  bool
	}{
		{"delete", "user", true},
		{"create_user", "user", true},
		{"read", "collector", false},
		{"update_config", "config", true},
		{"reset_password", "user", true},
		{"get", "data", false},
	}

	for _, tc := range testCases {
		result := service.isSensitiveOperation(tc.action, tc.resource)
		assert.Equal(t, tc.expected, result, "Action: %s, Resource: %s", tc.action, tc.resource)
	}
}

func TestAuditService_CalculateRiskLevel(t *testing.T) {
	service := &AuditService{}

	testCases := []struct {
		action     string
		resource   string
		statusCode int
		expected   string
	}{
		{"delete", "user", 200, "critical"},
		{"delete", "collector", 200, "critical"},
		{"create", "user", 200, "high"},
		{"reset", "key", 200, "high"},
		{"update", "config", 200, "medium"},
		{"read", "data", 401, "medium"},
		{"read", "data", 200, "low"},
	}

	for _, tc := range testCases {
		result := service.calculateRiskLevel(tc.action, tc.resource, tc.statusCode)
		assert.Equal(t, tc.expected, result, "Action: %s, Resource: %s, Status: %d", tc.action, tc.resource, tc.statusCode)
	}
}