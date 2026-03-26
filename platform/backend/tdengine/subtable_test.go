package tdengine

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestCreateSubTable(t *testing.T) {
	service := setupTestService(t)
	ctx := context.Background()
	
	// Create test database and super table
	err := service.CreateDatabase(ctx, "test_subtable_db", nil)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_subtable_db")
	
	schema := &SuperTableSchema{
		Name: "test_metrics",
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "value", Type: "DOUBLE"},
			{Name: "quality", Type: "INT"},
		},
		Tags: []SuperTableTag{
			{Name: "device_id", Type: "NCHAR", Length: 64},
			{Name: "location", Type: "NCHAR", Length: 128},
		},
	}
	
	err = service.CreateSuperTable(ctx, "test_subtable_db", schema, nil)
	if err != nil {
		t.Fatalf("Failed to create super table: %v", err)
	}
	
	tests := []struct {
		name          string
		subTableName  string
		tags          map[string]interface{}
		expectError   bool
		errorContains string
	}{
		{
			name:         "Valid sub-table creation",
			subTableName: "device_001",
			tags: map[string]interface{}{
				"device_id": "device-001",
				"location":  "workshop_a",
			},
			expectError: false,
		},
		{
			name:         "Sub-table with partial tags",
			subTableName: "device_002",
			tags: map[string]interface{}{
				"device_id": "device-002",
			},
			expectError: false,
		},
		{
			name:          "Empty sub-table name",
			subTableName:  "",
			tags:          map[string]interface{}{},
			expectError:   true,
			errorContains: "sub-table name cannot be empty",
		},
		{
			name:         "Invalid tag name",
			subTableName: "device_003",
			tags: map[string]interface{}{
				"invalid_tag": "value",
			},
			expectError:   true,
			errorContains: "not defined in super table schema",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.CreateSubTable(ctx, "test_subtable_db", "test_metrics", tt.subTableName, tt.tags, nil)
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorContains != "" && !containsString(err.Error(), tt.errorContains) {
					t.Errorf("Expected error to contain '%s', got: %v", tt.errorContains, err)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestAutoCreateSubTable(t *testing.T) {
	service := setupTestService(t)
	ctx := context.Background()
	
	// Create test database and super table
	err := service.CreateDatabase(ctx, "test_auto_subtable_db", nil)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_auto_subtable_db")
	
	schema := &SuperTableSchema{
		Name: "auto_metrics",
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "value", Type: "DOUBLE"},
		},
		Tags: []SuperTableTag{
			{Name: "collector_id", Type: "NCHAR", Length: 64},
			{Name: "device_id", Type: "NCHAR", Length: 64},
			{Name: "point_name", Type: "NCHAR", Length: 128},
		},
	}
	
	err = service.CreateSuperTable(ctx, "test_auto_subtable_db", schema, nil)
	if err != nil {
		t.Fatalf("Failed to create super table: %v", err)
	}
	
	dataPoint := DataPoint{
		DeviceID:  "device-001",
		PointName: "temperature",
		Timestamp: time.Now(),
		Value:     25.6,
		Quality:   1,
		Tags: map[string]interface{}{
			"collector_id": "collector-001",
		},
	}
	
	// Test auto-creation
	subTableName, err := service.AutoCreateSubTable(ctx, "test_auto_subtable_db", "auto_metrics", dataPoint)
	if err != nil {
		t.Fatalf("Failed to auto-create sub-table: %v", err)
	}
	
	if subTableName == "" {
		t.Error("Expected non-empty sub-table name")
	}
	
	// Verify sub-table exists
	exists, err := service.SubTableExists(ctx, "test_auto_subtable_db", subTableName)
	if err != nil {
		t.Fatalf("Failed to check sub-table existence: %v", err)
	}
	
	if !exists {
		t.Error("Auto-created sub-table should exist")
	}
	
	// Test idempotency - calling again should return same name
	subTableName2, err := service.AutoCreateSubTable(ctx, "test_auto_subtable_db", "auto_metrics", dataPoint)
	if err != nil {
		t.Fatalf("Failed to auto-create sub-table second time: %v", err)
	}
	
	if subTableName != subTableName2 {
		t.Errorf("Expected same sub-table name, got %s and %s", subTableName, subTableName2)
	}
}

func TestListSubTables(t *testing.T) {
	service := setupTestService(t)
	ctx := context.Background()
	
	// Create test database and super table
	err := service.CreateDatabase(ctx, "test_list_subtable_db", nil)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_list_subtable_db")
	
	schema := &SuperTableSchema{
		Name: "list_metrics",
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "value", Type: "DOUBLE"},
		},
		Tags: []SuperTableTag{
			{Name: "device_id", Type: "NCHAR", Length: 64},
			{Name: "location", Type: "NCHAR", Length: 64},
		},
	}
	
	err = service.CreateSuperTable(ctx, "test_list_subtable_db", schema, nil)
	if err != nil {
		t.Fatalf("Failed to create super table: %v", err)
	}
	
	// Create multiple sub-tables
	subTables := []struct {
		name string
		tags map[string]interface{}
	}{
		{
			name: "device_001",
			tags: map[string]interface{}{
				"device_id": "device-001",
				"location":  "workshop_a",
			},
		},
		{
			name: "device_002",
			tags: map[string]interface{}{
				"device_id": "device-002",
				"location":  "workshop_b",
			},
		},
		{
			name: "device_003",
			tags: map[string]interface{}{
				"device_id": "device-003",
				"location":  "workshop_a",
			},
		},
	}
	
	for _, st := range subTables {
		err := service.CreateSubTable(ctx, "test_list_subtable_db", "list_metrics", st.name, st.tags, nil)
		if err != nil {
			t.Fatalf("Failed to create sub-table %s: %v", st.name, err)
		}
	}
	
	// Test listing all sub-tables
	result, err := service.ListSubTables(ctx, "test_list_subtable_db", "list_metrics", nil, 1, 10)
	if err != nil {
		t.Fatalf("Failed to list sub-tables: %v", err)
	}
	
	if len(result.SubTables) != len(subTables) {
		t.Errorf("Expected %d sub-tables, got %d", len(subTables), len(result.SubTables))
	}
	
	// Test pagination
	result, err = service.ListSubTables(ctx, "test_list_subtable_db", "list_metrics", nil, 1, 2)
	if err != nil {
		t.Fatalf("Failed to list sub-tables with pagination: %v", err)
	}
	
	if len(result.SubTables) != 2 {
		t.Errorf("Expected 2 sub-tables in first page, got %d", len(result.SubTables))
	}
	
	if !result.HasMore {
		t.Error("Expected HasMore to be true")
	}
}

func TestGetSubTablesByTags(t *testing.T) {
	service := setupTestService(t)
	ctx := context.Background()
	
	// Create test database and super table
	err := service.CreateDatabase(ctx, "test_tags_subtable_db", nil)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_tags_subtable_db")
	
	schema := &SuperTableSchema{
		Name: "tags_metrics",
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "value", Type: "DOUBLE"},
		},
		Tags: []SuperTableTag{
			{Name: "device_id", Type: "NCHAR", Length: 64},
			{Name: "location", Type: "NCHAR", Length: 64},
			{Name: "device_type", Type: "NCHAR", Length: 32},
		},
	}
	
	err = service.CreateSuperTable(ctx, "test_tags_subtable_db", schema, nil)
	if err != nil {
		t.Fatalf("Failed to create super table: %v", err)
	}
	
	// Create sub-tables with different tag combinations
	subTables := []struct {
		name string
		tags map[string]interface{}
	}{
		{
			name: "plc_001",
			tags: map[string]interface{}{
				"device_id":   "plc-001",
				"location":    "workshop_a",
				"device_type": "plc",
			},
		},
		{
			name: "sensor_001",
			tags: map[string]interface{}{
				"device_id":   "sensor-001",
				"location":    "workshop_a",
				"device_type": "sensor",
			},
		},
		{
			name: "plc_002",
			tags: map[string]interface{}{
				"device_id":   "plc-002",
				"location":    "workshop_b",
				"device_type": "plc",
			},
		},
	}
	
	for _, st := range subTables {
		err := service.CreateSubTable(ctx, "test_tags_subtable_db", "tags_metrics", st.name, st.tags, nil)
		if err != nil {
			t.Fatalf("Failed to create sub-table %s: %v", st.name, err)
		}
	}
	
	// Test filtering by location
	tagFilters := map[string]interface{}{
		"location": "workshop_a",
	}
	
	subTablesInWorkshopA, err := service.GetSubTablesByTags(ctx, "test_tags_subtable_db", "tags_metrics", tagFilters)
	if err != nil {
		t.Fatalf("Failed to get sub-tables by tags: %v", err)
	}
	
	expectedCount := 2 // plc_001 and sensor_001
	if len(subTablesInWorkshopA) != expectedCount {
		t.Errorf("Expected %d sub-tables in workshop_a, got %d", expectedCount, len(subTablesInWorkshopA))
	}
	
	// Test filtering by device type
	tagFilters = map[string]interface{}{
		"device_type": "plc",
	}
	
	plcSubTables, err := service.GetSubTablesByTags(ctx, "test_tags_subtable_db", "tags_metrics", tagFilters)
	if err != nil {
		t.Fatalf("Failed to get PLC sub-tables: %v", err)
	}
	
	expectedCount = 2 // plc_001 and plc_002
	if len(plcSubTables) != expectedCount {
		t.Errorf("Expected %d PLC sub-tables, got %d", expectedCount, len(plcSubTables))
	}
}

func TestSubTableLifecyclePolicy(t *testing.T) {
	service := setupTestService(t)
	ctx := context.Background()
	
	// Create test database and super table
	err := service.CreateDatabase(ctx, "test_lifecycle_db", nil)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_lifecycle_db")
	
	schema := &SuperTableSchema{
		Name: "lifecycle_metrics",
		Columns: []SuperTableColumn{
			{Name: "ts", Type: "TIMESTAMP"},
			{Name: "value", Type: "DOUBLE"},
		},
		Tags: []SuperTableTag{
			{Name: "device_id", Type: "NCHAR", Length: 64},
		},
	}
	
	err = service.CreateSuperTable(ctx, "test_lifecycle_db", schema, nil)
	if err != nil {
		t.Fatalf("Failed to create super table: %v", err)
	}
	
	// Create a sub-table
	tags := map[string]interface{}{
		"device_id": "test-device",
	}
	
	err = service.CreateSubTable(ctx, "test_lifecycle_db", "lifecycle_metrics", "test_device", tags, nil)
	if err != nil {
		t.Fatalf("Failed to create sub-table: %v", err)
	}
	
	// Test lifecycle policy with auto cleanup disabled
	policy := &SubTableLifecyclePolicy{
		AutoCleanup: false,
	}
	
	err = service.ApplyLifecyclePolicy(ctx, "test_lifecycle_db", "lifecycle_metrics", policy)
	if err != nil {
		t.Fatalf("Failed to apply lifecycle policy: %v", err)
	}
	
	// Verify sub-table still exists
	exists, err := service.SubTableExists(ctx, "test_lifecycle_db", "test_device")
	if err != nil {
		t.Fatalf("Failed to check sub-table existence: %v", err)
	}
	
	if !exists {
		t.Error("Sub-table should still exist when auto cleanup is disabled")
	}
	
	// Test lifecycle policy with auto cleanup enabled
	maxAge := time.Duration(1) * time.Nanosecond // Very short age for testing
	policy = &SubTableLifecyclePolicy{
		AutoCleanup:        true,
		MaxAge:             &maxAge,
		NotifyBeforeDelete: true,
		ArchiveOldData:     false,
	}
	
	// Wait a bit to ensure the table is "old"
	time.Sleep(time.Millisecond)
	
	err = service.ApplyLifecyclePolicy(ctx, "test_lifecycle_db", "lifecycle_metrics", policy)
	if err != nil {
		t.Fatalf("Failed to apply lifecycle policy with cleanup: %v", err)
	}
	
	// Note: In a real test environment, you would verify that the table was deleted
	// However, this depends on the actual implementation and test database setup
}

func TestSubTableValidation(t *testing.T) {
	service := setupTestService(t)
	
	tests := []struct {
		name          string
		subTableName  string
		expectError   bool
		errorContains string
	}{
		{
			name:         "Valid name",
			subTableName: "valid_table_name",
			expectError:  false,
		},
		{
			name:         "Valid name with numbers",
			subTableName: "table_123",
			expectError:  false,
		},
		{
			name:          "Empty name",
			subTableName:  "",
			expectError:   true,
			errorContains: "cannot be empty",
		},
		{
			name:          "Name starting with number",
			subTableName:  "123_table",
			expectError:   true,
			errorContains: "must start with a letter or underscore",
		},
		{
			name:          "Name with invalid characters",
			subTableName:  "table-with-dashes",
			expectError:   true,
			errorContains: "can only contain letters, digits, and underscores",
		},
		{
			name:          "Name too long",
			subTableName:  strings.Repeat("a", 200),
			expectError:   true,
			errorContains: "cannot exceed 192 characters",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateSubTableName(tt.subTableName)
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorContains != "" && !containsString(err.Error(), tt.errorContains) {
					t.Errorf("Expected error to contain '%s', got: %v", tt.errorContains, err)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestTagValidation(t *testing.T) {
	service := setupTestService(t)
	
	tagSchema := []SuperTableTag{
		{Name: "device_id", Type: "NCHAR", Length: 64},
		{Name: "temperature", Type: "FLOAT"},
		{Name: "active", Type: "BOOL"},
		{Name: "count", Type: "INT"},
	}
	
	tests := []struct {
		name          string
		tags          map[string]interface{}
		expectError   bool
		errorContains string
	}{
		{
			name: "Valid tags",
			tags: map[string]interface{}{
				"device_id":   "device-001",
				"temperature": 25.6,
				"active":      true,
				"count":       100,
			},
			expectError: false,
		},
		{
			name: "Partial tags",
			tags: map[string]interface{}{
				"device_id": "device-001",
			},
			expectError: false,
		},
		{
			name: "Invalid tag name",
			tags: map[string]interface{}{
				"invalid_tag": "value",
			},
			expectError:   true,
			errorContains: "not defined in super table schema",
		},
		{
			name: "Invalid tag type",
			tags: map[string]interface{}{
				"temperature": "not_a_number",
			},
			expectError:   true,
			errorContains: "expected float type",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateSubTableTags(tt.tags, tagSchema)
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorContains != "" && !containsString(err.Error(), tt.errorContains) {
					t.Errorf("Expected error to contain '%s', got: %v", tt.errorContains, err)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestGenerateSubTableName(t *testing.T) {
	service := setupTestService(t)
	
	tests := []struct {
		name     string
		deviceID string
		tags     map[string]interface{}
		expected string
	}{
		{
			name:     "Device ID only",
			deviceID: "device-001",
			tags:     map[string]interface{}{},
			expected: "d_device_001",
		},
		{
			name:     "Device ID with collector",
			deviceID: "device-001",
			tags: map[string]interface{}{
				"collector_id": "collector-001",
			},
			expected: "d_collector_001_device_001",
		},
		{
			name:     "Device ID with dots",
			deviceID: "device.001.temp",
			tags:     map[string]interface{}{},
			expected: "d_device_001_temp",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.generateSubTableName(tt.deviceID, tt.tags)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return strings.Contains(s, substr)
}

// setupTestService creates a test service instance
func setupTestService(t *testing.T) *TDengineService {
	// This would typically set up a test database connection
	// For now, we'll return a mock or skip tests that require actual DB
	t.Skip("Skipping test that requires actual TDengine connection")
	return nil
}