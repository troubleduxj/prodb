package tdengine

import (
	"context"
	"testing"
	"time"
)

func TestSuperTableManagement(t *testing.T) {
	// Skip if no TDengine connection available
	config := &TDengineConfig{
		Host:         "localhost",
		Port:         6030,
		Username:     "root",
		Password:     "taosdata",
		Database:     "test_db",
		MaxOpenConns: 5,
		MaxIdleConns: 2,
		ConnTimeout:  10 * time.Second,
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:         3,
		RetryInterval:      5 * time.Second,
		EnableAutoReconnect:  true,
		ReconnectInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test: TDengine not available: %v", err)
	}

	if err := manager.Start(); err != nil {
		t.Skipf("Skipping test: Failed to start TDengine manager: %v", err)
	}
	defer manager.Stop()

	service := NewTDengineService(manager)
	ctx := context.Background()

	// Create test database
	dbOptions := &DatabaseOptions{
		Days:      10,
		Keep:      "365",
		Cache:     16,
		Precision: "ms",
	}
	
	err = service.CreateDatabase(ctx, "test_supertable_db", dbOptions)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer service.DropDatabase(ctx, "test_supertable_db")

	t.Run("CreateSuperTable", func(t *testing.T) {
		schema := &SuperTableSchema{
			Name: "test_metrics",
			Columns: []SuperTableColumn{
				{Name: "ts", Type: "TIMESTAMP"},
				{Name: "value", Type: "DOUBLE"},
				{Name: "quality", Type: "INT"},
				{Name: "description", Type: "NCHAR", Length: 64},
			},
			Tags: []SuperTableTag{
				{Name: "device_id", Type: "NCHAR", Length: 64},
				{Name: "location", Type: "NCHAR", Length: 128},
				{Name: "device_type", Type: "INT"},
			},
		}

		options := &SuperTableOptions{
			IfNotExists: true,
		}

		err := service.CreateSuperTable(ctx, "test_supertable_db", schema, options)
		if err != nil {
			t.Fatalf("Failed to create super table: %v", err)
		}

		// Verify super table exists
		exists, err := service.SuperTableExists(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to check super table existence: %v", err)
		}
		if !exists {
			t.Error("Super table should exist after creation")
		}
	})

	t.Run("GetSuperTableInfo", func(t *testing.T) {
		info, err := service.GetSuperTableInfo(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to get super table info: %v", err)
		}

		if info.Name != "test_metrics" {
			t.Errorf("Expected name 'test_metrics', got '%s'", info.Name)
		}

		if len(info.Columns) != 4 {
			t.Errorf("Expected 4 columns, got %d", len(info.Columns))
		}

		if len(info.Tags) != 3 {
			t.Errorf("Expected 3 tags, got %d", len(info.Tags))
		}
	})

	t.Run("GetSuperTableSchema", func(t *testing.T) {
		schema, err := service.GetSuperTableSchema(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to get super table schema: %v", err)
		}

		if schema.Name != "test_metrics" {
			t.Errorf("Expected name 'test_metrics', got '%s'", schema.Name)
		}

		// Check for timestamp column
		hasTimestamp := false
		for _, col := range schema.Columns {
			if col.Name == "ts" && col.Type == "TIMESTAMP" {
				hasTimestamp = true
				break
			}
		}
		if !hasTimestamp {
			t.Error("Super table should have a TIMESTAMP column named 'ts'")
		}

		// Check for device_id tag
		hasDeviceTag := false
		for _, tag := range schema.Tags {
			if tag.Name == "device_id" && tag.Type == "NCHAR" {
				hasDeviceTag = true
				break
			}
		}
		if !hasDeviceTag {
			t.Error("Super table should have a NCHAR tag named 'device_id'")
		}
	})

	t.Run("ListSuperTables", func(t *testing.T) {
		tables, err := service.ListSuperTables(ctx, "test_supertable_db")
		if err != nil {
			t.Fatalf("Failed to list super tables: %v", err)
		}

		found := false
		for _, table := range tables {
			if table.Name == "test_metrics" {
				found = true
				break
			}
		}
		if !found {
			t.Error("test_metrics should be in the list of super tables")
		}
	})

	t.Run("AlterSuperTable", func(t *testing.T) {
		// Add a new column
		addColumnRequest := &AlterSuperTableRequest{
			Action: AlterActionAddColumn,
			Column: &SuperTableColumn{
				Name: "status",
				Type: "INT",
			},
		}

		err := service.AlterSuperTable(ctx, "test_supertable_db", "test_metrics", addColumnRequest)
		if err != nil {
			t.Fatalf("Failed to add column: %v", err)
		}

		// Verify column was added
		schema, err := service.GetSuperTableSchema(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to get schema after alteration: %v", err)
		}

		hasStatusColumn := false
		for _, col := range schema.Columns {
			if col.Name == "status" && col.Type == "INT" {
				hasStatusColumn = true
				break
			}
		}
		if !hasStatusColumn {
			t.Error("Status column should have been added")
		}

		// Add a new tag
		addTagRequest := &AlterSuperTableRequest{
			Action: AlterActionAddTag,
			Tag: &SuperTableTag{
				Name: "region",
				Type: "NCHAR",
				Length: 32,
			},
		}

		err = service.AlterSuperTable(ctx, "test_supertable_db", "test_metrics", addTagRequest)
		if err != nil {
			t.Fatalf("Failed to add tag: %v", err)
		}

		// Verify tag was added
		schema, err = service.GetSuperTableSchema(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to get schema after tag addition: %v", err)
		}

		hasRegionTag := false
		for _, tag := range schema.Tags {
			if tag.Name == "region" && tag.Type == "NCHAR" {
				hasRegionTag = true
				break
			}
		}
		if !hasRegionTag {
			t.Error("Region tag should have been added")
		}
	})

	t.Run("ValidateSuperTableCompatibility", func(t *testing.T) {
		// Get current schema
		currentSchema, err := service.GetSuperTableSchema(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to get current schema: %v", err)
		}

		// Test compatible change (adding a column)
		compatibleSchema := &SuperTableSchema{
			Name:    currentSchema.Name,
			Columns: append(currentSchema.Columns, SuperTableColumn{Name: "new_field", Type: "FLOAT"}),
			Tags:    currentSchema.Tags,
		}

		err = service.ValidateSuperTableCompatibility(ctx, "test_supertable_db", "test_metrics", compatibleSchema)
		if err != nil {
			t.Errorf("Compatible schema change should not produce error: %v", err)
		}

		// Test incompatible change (changing column type)
		incompatibleSchema := &SuperTableSchema{
			Name:    currentSchema.Name,
			Columns: currentSchema.Columns,
			Tags:    currentSchema.Tags,
		}
		// Change the type of the value column from DOUBLE to INT (incompatible)
		for i, col := range incompatibleSchema.Columns {
			if col.Name == "value" {
				incompatibleSchema.Columns[i].Type = "INT"
				break
			}
		}

		err = service.ValidateSuperTableCompatibility(ctx, "test_supertable_db", "test_metrics", incompatibleSchema)
		if err == nil {
			t.Error("Incompatible schema change should produce an error")
		}
	})

	t.Run("DropSuperTable", func(t *testing.T) {
		err := service.DropSuperTable(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to drop super table: %v", err)
		}

		// Verify super table no longer exists
		exists, err := service.SuperTableExists(ctx, "test_supertable_db", "test_metrics")
		if err != nil {
			t.Fatalf("Failed to check super table existence after drop: %v", err)
		}
		if exists {
			t.Error("Super table should not exist after being dropped")
		}
	})
}

func TestSuperTableSchemaValidation(t *testing.T) {
	tests := []struct {
		name        string
		schema      *SuperTableSchema
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid schema",
			schema: &SuperTableSchema{
				Name: "valid_table",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
					{Name: "value", Type: "DOUBLE"},
				},
				Tags: []SuperTableTag{
					{Name: "device_id", Type: "NCHAR", Length: 64},
				},
			},
			expectError: false,
		},
		{
			name: "Empty name",
			schema: &SuperTableSchema{
				Name: "",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
				},
			},
			expectError: true,
			errorMsg:    "super table name cannot be empty",
		},
		{
			name: "No columns",
			schema: &SuperTableSchema{
				Name:    "no_columns",
				Columns: []SuperTableColumn{},
			},
			expectError: true,
			errorMsg:    "super table must have at least one column",
		},
		{
			name: "No timestamp column",
			schema: &SuperTableSchema{
				Name: "no_timestamp",
				Columns: []SuperTableColumn{
					{Name: "value", Type: "DOUBLE"},
				},
			},
			expectError: true,
			errorMsg:    "super table must have a TIMESTAMP column",
		},
		{
			name: "Duplicate column names",
			schema: &SuperTableSchema{
				Name: "duplicate_columns",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
					{Name: "value", Type: "DOUBLE"},
					{Name: "value", Type: "INT"},
				},
			},
			expectError: true,
			errorMsg:    "duplicate column name: value",
		},
		{
			name: "Duplicate tag names",
			schema: &SuperTableSchema{
				Name: "duplicate_tags",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
				},
				Tags: []SuperTableTag{
					{Name: "device_id", Type: "NCHAR", Length: 64},
					{Name: "device_id", Type: "INT"},
				},
			},
			expectError: true,
			errorMsg:    "duplicate tag name: device_id",
		},
		{
			name: "Tag name conflicts with column name",
			schema: &SuperTableSchema{
				Name: "name_conflict",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
					{Name: "device_id", Type: "DOUBLE"},
				},
				Tags: []SuperTableTag{
					{Name: "device_id", Type: "NCHAR", Length: 64},
				},
			},
			expectError: true,
			errorMsg:    "tag name conflicts with column name: device_id",
		},
		{
			name: "Invalid column type",
			schema: &SuperTableSchema{
				Name: "invalid_column_type",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
					{Name: "value", Type: "INVALID_TYPE"},
				},
			},
			expectError: true,
			errorMsg:    "invalid column type for value: unsupported column type: INVALID_TYPE",
		},
		{
			name: "Invalid tag type",
			schema: &SuperTableSchema{
				Name: "invalid_tag_type",
				Columns: []SuperTableColumn{
					{Name: "ts", Type: "TIMESTAMP"},
				},
				Tags: []SuperTableTag{
					{Name: "device_id", Type: "INVALID_TYPE"},
				},
			},
			expectError: true,
			errorMsg:    "invalid tag type for device_id: unsupported tag type: INVALID_TYPE",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate()
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if err.Error() != tt.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestSuperTableNameValidation(t *testing.T) {
	config := &TDengineConfig{
		Host:     "localhost",
		Port:     6030,
		Username: "root",
		Password: "taosdata",
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test: TDengine not available: %v", err)
	}

	service := NewTDengineService(manager)

	tests := []struct {
		name        string
		tableName   string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid name",
			tableName:   "valid_table_name",
			expectError: false,
		},
		{
			name:        "Valid name with numbers",
			tableName:   "table_123",
			expectError: false,
		},
		{
			name:        "Valid name starting with underscore",
			tableName:   "_private_table",
			expectError: false,
		},
		{
			name:        "Empty name",
			tableName:   "",
			expectError: true,
			errorMsg:    "super table name cannot be empty",
		},
		{
			name:        "Name starting with number",
			tableName:   "123_table",
			expectError: true,
			errorMsg:    "super table name must start with a letter or underscore",
		},
		{
			name:        "Name with special characters",
			tableName:   "table-name",
			expectError: true,
			errorMsg:    "super table name can only contain letters, digits, and underscores",
		},
		{
			name:        "Reserved keyword",
			tableName:   "select",
			expectError: true,
			errorMsg:    "super table name cannot be a reserved keyword: select",
		},
		{
			name:        "Too long name",
			tableName:   "this_is_a_very_long_super_table_name_that_exceeds_the_maximum_allowed_length_for_table_names_in_tdengine_database_system_and_should_be_rejected_by_the_validation_function_because_it_is_way_too_long",
			expectError: true,
			errorMsg:    "super table name cannot exceed 192 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateSuperTableName(tt.tableName)
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if err.Error() != tt.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestColumnAndTagTypeValidation(t *testing.T) {
	tests := []struct {
		name        string
		dataType    string
		isColumn    bool
		expectError bool
	}{
		// Valid column types
		{"TIMESTAMP column", "TIMESTAMP", true, false},
		{"INT column", "INT", true, false},
		{"BIGINT column", "BIGINT", true, false},
		{"FLOAT column", "FLOAT", true, false},
		{"DOUBLE column", "DOUBLE", true, false},
		{"BINARY column", "BINARY", true, false},
		{"NCHAR column", "NCHAR", true, false},
		{"VARCHAR column", "VARCHAR", true, false},
		{"JSON column", "JSON", true, false},
		{"BOOL column", "BOOL", true, false},
		
		// Valid tag types
		{"INT tag", "INT", false, false},
		{"BIGINT tag", "BIGINT", false, false},
		{"FLOAT tag", "FLOAT", false, false},
		{"DOUBLE tag", "DOUBLE", false, false},
		{"BINARY tag", "BINARY", false, false},
		{"NCHAR tag", "NCHAR", false, false},
		{"VARCHAR tag", "VARCHAR", false, false},
		{"BOOL tag", "BOOL", false, false},
		
		// Invalid column types
		{"Invalid column type", "INVALID", true, true},
		
		// Invalid tag types
		{"TIMESTAMP tag (invalid)", "TIMESTAMP", false, true},
		{"JSON tag (invalid)", "JSON", false, true},
		{"Invalid tag type", "INVALID", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var err error
			if tt.isColumn {
				err = validateColumnType(tt.dataType)
			} else {
				err = validateTagType(tt.dataType)
			}
			
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for type %s but got none", tt.dataType)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for type %s but got: %v", tt.dataType, err)
				}
			}
		})
	}
}