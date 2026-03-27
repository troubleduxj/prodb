package tdengine

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// SubTableInfo represents information about a sub-table
type SubTableInfo struct {
	Name         string                 `json:"name"`
	SuperTable   string                 `json:"supertable"`
	Database     string                 `json:"database"`
	CreatedTime  time.Time              `json:"created_time"`
	Tags         map[string]interface{} `json:"tags"`
	LastUpdate   time.Time              `json:"last_update"`
	RecordCount  int64                  `json:"record_count"`
}

// SubTableOptions represents options for creating a sub-table
type SubTableOptions struct {
	IfNotExists bool `json:"if_not_exists"`
}

// SubTableFilter represents filter criteria for querying sub-tables
type SubTableFilter struct {
	SuperTable string                 `json:"supertable,omitempty"`
	Tags       map[string]interface{} `json:"tags,omitempty"`
	CreatedAfter  *time.Time          `json:"created_after,omitempty"`
	CreatedBefore *time.Time          `json:"created_before,omitempty"`
	UpdatedAfter  *time.Time          `json:"updated_after,omitempty"`
	UpdatedBefore *time.Time          `json:"updated_before,omitempty"`
	MinRecords    *int64              `json:"min_records,omitempty"`
	MaxRecords    *int64              `json:"max_records,omitempty"`
}

// SubTableLifecyclePolicy represents lifecycle management policy for sub-tables
type SubTableLifecyclePolicy struct {
	MaxAge           *time.Duration `json:"max_age,omitempty"`           // Maximum age before deletion
	MaxIdleTime      *time.Duration `json:"max_idle_time,omitempty"`     // Maximum idle time before deletion
	MinRecords       *int64         `json:"min_records,omitempty"`       // Minimum records to keep table
	MaxRecords       *int64         `json:"max_records,omitempty"`       // Maximum records before archival
	AutoCleanup      bool           `json:"auto_cleanup"`                // Enable automatic cleanup
	ArchiveOldData   bool           `json:"archive_old_data"`            // Archive data before deletion
	NotifyBeforeDelete bool         `json:"notify_before_delete"`        // Send notification before deletion
}

// PaginatedSubTableResult represents paginated sub-table query results
type PaginatedSubTableResult struct {
	SubTables []SubTableInfo `json:"subtables"`
	Total     int64          `json:"total"`
	Page      int            `json:"page"`
	Size      int            `json:"size"`
	HasMore   bool           `json:"has_more"`
}

// CreateSubTable creates a new sub-table with the specified tags
func (s *TDengineService) CreateSubTable(ctx context.Context, database, superTable, subTableName string, tags map[string]interface{}, options *SubTableOptions) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if subTableName == "" {
		return fmt.Errorf("sub-table name cannot be empty")
	}
	
	// Validate sub-table name
	if err := s.validateSubTableName(subTableName); err != nil {
		return err
	}
	
	// Check if super table exists
	exists, err := s.SuperTableExists(ctx, database, superTable)
	if err != nil {
		return fmt.Errorf("failed to check super table existence: %w", err)
	}
	
	if !exists {
		return fmt.Errorf("super table '%s' does not exist in database '%s'", superTable, database)
	}
	
	// Get super table schema to validate tags
	schema, err := s.GetSuperTableSchema(ctx, database, superTable)
	if err != nil {
		return fmt.Errorf("failed to get super table schema: %w", err)
	}
	
	// Validate tags against schema
	if err := s.validateSubTableTags(tags, schema.Tags); err != nil {
		return fmt.Errorf("invalid tags: %w", err)
	}
	
	// Use the specified database
	_, err = s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Build CREATE TABLE query
	var queryBuilder strings.Builder
	queryBuilder.WriteString("CREATE TABLE ")
	
	if options != nil && options.IfNotExists {
		queryBuilder.WriteString("IF NOT EXISTS ")
	}
	
	queryBuilder.WriteString(subTableName)
	queryBuilder.WriteString(" USING ")
	queryBuilder.WriteString(superTable)
	
	// Add tags
	if len(tags) > 0 {
		queryBuilder.WriteString(" TAGS (")
		
		tagValues := make([]string, 0, len(schema.Tags))
		for _, tagDef := range schema.Tags {
			if value, exists := tags[tagDef.Name]; exists {
				tagValues = append(tagValues, s.formatTagValue(value, tagDef.Type))
			} else {
				// Use NULL for missing tags
				tagValues = append(tagValues, "NULL")
			}
		}
		
		queryBuilder.WriteString(strings.Join(tagValues, ", "))
		queryBuilder.WriteString(")")
	}
	
	query := queryBuilder.String()
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create sub-table %s: %w", subTableName, err)
	}
	
	return nil
}

// AutoCreateSubTable automatically creates a sub-table based on data point information
func (s *TDengineService) AutoCreateSubTable(ctx context.Context, database, superTable string, dataPoint DataPoint) (string, error) {
	if database == "" {
		return "", fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return "", fmt.Errorf("super table name cannot be empty")
	}
	
	// Generate sub-table name based on device ID and collector ID
	subTableName := s.generateSubTableName(dataPoint.DeviceID, dataPoint.Tags)
	
	// Check if sub-table already exists
	exists, err := s.SubTableExists(ctx, database, subTableName)
	if err != nil {
		return "", fmt.Errorf("failed to check sub-table existence: %w", err)
	}
	
	if exists {
		return subTableName, nil
	}
	
	// Create sub-table with auto-generated tags
	tags := s.extractTagsFromDataPoint(dataPoint)
	
	options := &SubTableOptions{IfNotExists: true}
	err = s.CreateSubTable(ctx, database, superTable, subTableName, tags, options)
	if err != nil {
		return "", fmt.Errorf("failed to auto-create sub-table: %w", err)
	}
	
	return subTableName, nil
}

// DropSubTable drops a sub-table
func (s *TDengineService) DropSubTable(ctx context.Context, database, subTableName string) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if subTableName == "" {
		return fmt.Errorf("sub-table name cannot be empty")
	}
	
	// Validate sub-table name
	if err := s.validateSubTableName(subTableName); err != nil {
		return err
	}
	
	// Use the specified database
	_, err := s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Check if sub-table exists
	exists, err := s.SubTableExists(ctx, database, subTableName)
	if err != nil {
		return fmt.Errorf("failed to check sub-table existence: %w", err)
	}
	
	if !exists {
		return fmt.Errorf("sub-table '%s' does not exist in database '%s'", subTableName, database)
	}
	
	query := fmt.Sprintf("DROP TABLE IF EXISTS %s", subTableName)
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop sub-table %s: %w", subTableName, err)
	}
	
	return nil
}

// ListSubTables returns a list of sub-tables for a super table with optional filtering and pagination
func (s *TDengineService) ListSubTables(ctx context.Context, database, superTable string, filter *SubTableFilter, page, size int) (*PaginatedSubTableResult, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return nil, fmt.Errorf("super table name cannot be empty")
	}
	
	if page < 1 {
		page = 1
	}
	
	if size < 1 {
		size = 20
	}
	
	// Build query with filters (no need to USE database, we specify db_name in WHERE clause)
	whereClause := s.buildSubTableFilterClause(database, superTable, filter)
	
	// Count total records
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM information_schema.ins_tables 
		WHERE db_name = '%s' AND stable_name = '%s'%s`,
		database, superTable, whereClause)
	
	fmt.Printf("Count query: %s\n", countQuery)
	
	var total int64
	rows, err := s.manager.ExecuteQuery(ctx, countQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to count sub-tables: %w", err)
	}
	
	if rows.Next() {
		rows.Scan(&total)
	}
	rows.Close()
	
	fmt.Printf("Total sub-tables found: %d for %s.%s\n", total, database, superTable)
	
	// Get paginated results
	offset := (page - 1) * size
	// TDengine 3.x supports standard SQL LIMIT/OFFSET syntax
	dataQuery := fmt.Sprintf(`
		SELECT table_name, stable_name, create_time 
		FROM information_schema.ins_tables 
		WHERE db_name = '%s' AND stable_name = '%s'%s
		ORDER BY create_time DESC 
		LIMIT %d OFFSET %d`,
		database, superTable, whereClause, size, offset)
	
	fmt.Printf("DEBUG - Data query: %s\n", dataQuery)
	fmt.Printf("DEBUG - Pagination: page=%d, size=%d, offset=%d\n", page, size, offset)
	
	rows, err = s.manager.ExecuteQuery(ctx, dataQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query sub-tables: %w", err)
	}
	defer rows.Close()
	
	var subTables []SubTableInfo
	rowCount := 0
	for rows.Next() {
		rowCount++
		var info SubTableInfo
		var tableName, stableName string
		var createTime time.Time
		
		err := rows.Scan(&tableName, &stableName, &createTime)
		if err != nil {
			fmt.Printf("DEBUG - Error scanning row %d: %v\n", rowCount, err)
			continue
		}
		
		info.Name = tableName
		info.SuperTable = stableName
		info.Database = database
		info.CreatedTime = createTime
		
		// Get additional information for each sub-table
		// Note: Skip enrichSubTableInfo here for performance when listing many sub-tables
		// Tag values will be fetched when selecting individual sub-table via GetSubTableInfo
		
		subTables = append(subTables, info)
	}
	
	fmt.Printf("DEBUG - Scanned %d rows, created %d SubTableInfo objects\n", rowCount, len(subTables))
	
	result := &PaginatedSubTableResult{
		SubTables: subTables,
		Total:     total,
		Page:      page,
		Size:      size,
		HasMore:   int64(page*size) < total,
	}
	
	fmt.Printf("DEBUG - Returning result with %d subtables\n", len(result.SubTables))
	
	return result, nil
}

// GetSubTableInfo returns detailed information about a specific sub-table
func (s *TDengineService) GetSubTableInfo(ctx context.Context, database, subTableName string) (*SubTableInfo, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	if subTableName == "" {
		return nil, fmt.Errorf("sub-table name cannot be empty")
	}
	
	// Use the specified database
	_, err := s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return nil, fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Query sub-table information
	query := fmt.Sprintf(`
		SELECT table_name, stable_name, create_time 
		FROM information_schema.ins_tables 
		WHERE db_name = '%s' AND table_name = '%s'`,
		database, subTableName)
	
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query sub-table info: %w", err)
	}
	defer rows.Close()
	
	if !rows.Next() {
		return nil, fmt.Errorf("sub-table '%s' not found in database '%s'", subTableName, database)
	}
	
	var info SubTableInfo
	var tableName, stableName string
	var createTime time.Time
	
	err = rows.Scan(&tableName, &stableName, &createTime)
	if err != nil {
		return nil, fmt.Errorf("failed to scan sub-table info: %w", err)
	}
	
	info.Name = tableName
	info.SuperTable = stableName
	info.Database = database
	info.CreatedTime = createTime
	
	// Get additional information
	s.enrichSubTableInfo(ctx, database, &info)
	
	return &info, nil
}

// SubTableExists checks if a sub-table exists in a database
func (s *TDengineService) SubTableExists(ctx context.Context, database, subTableName string) (bool, error) {
	if database == "" {
		return false, fmt.Errorf("database name cannot be empty")
	}
	
	if subTableName == "" {
		return false, fmt.Errorf("sub-table name cannot be empty")
	}
	
	_, err := s.GetSubTableInfo(ctx, database, subTableName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, err
	}
	
	return true, nil
}

// GetSubTablesByTags returns sub-tables that match the specified tag criteria
func (s *TDengineService) GetSubTablesByTags(ctx context.Context, database, superTable string, tagFilters map[string]interface{}) ([]SubTableInfo, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return nil, fmt.Errorf("super table name cannot be empty")
	}
	
	// Use the specified database
	_, err := s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return nil, fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Build tag filter query
	var whereConditions []string
	for tagName, tagValue := range tagFilters {
		condition := fmt.Sprintf("%s = %s", tagName, s.formatTagValue(tagValue, ""))
		whereConditions = append(whereConditions, condition)
	}
	
	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = " WHERE " + strings.Join(whereConditions, " AND ")
	}
	
	query := fmt.Sprintf("SHOW TABLES FROM %s LIKE '%s'%s", database, superTable, whereClause)
	
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query sub-tables by tags: %w", err)
	}
	defer rows.Close()
	
	var subTables []SubTableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}
		
		// Get detailed information for each sub-table
		info, err := s.GetSubTableInfo(ctx, database, tableName)
		if err != nil {
			continue
		}
		
		subTables = append(subTables, *info)
	}
	
	return subTables, nil
}

// ApplyLifecyclePolicy applies lifecycle management policies to sub-tables
func (s *TDengineService) ApplyLifecyclePolicy(ctx context.Context, database, superTable string, policy *SubTableLifecyclePolicy) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if policy == nil {
		return fmt.Errorf("lifecycle policy cannot be nil")
	}
	
	if !policy.AutoCleanup {
		return nil // Policy is disabled
	}
	
	// Get all sub-tables for the super table
	result, err := s.ListSubTables(ctx, database, superTable, nil, 1, 1000)
	if err != nil {
		return fmt.Errorf("failed to list sub-tables: %w", err)
	}
	
	now := time.Now()
	var tablesToDelete []string
	
	for _, subTable := range result.SubTables {
		shouldDelete := false
		reason := ""
		
		// Check age-based deletion
		if policy.MaxAge != nil {
			age := now.Sub(subTable.CreatedTime)
			if age > *policy.MaxAge {
				shouldDelete = true
				reason = fmt.Sprintf("exceeded max age (%v)", *policy.MaxAge)
			}
		}
		
		// Check idle time-based deletion
		if policy.MaxIdleTime != nil && !shouldDelete {
			idleTime := now.Sub(subTable.LastUpdate)
			if idleTime > *policy.MaxIdleTime {
				shouldDelete = true
				reason = fmt.Sprintf("exceeded max idle time (%v)", *policy.MaxIdleTime)
			}
		}
		
		// Check record count-based deletion
		if policy.MinRecords != nil && !shouldDelete {
			if subTable.RecordCount < *policy.MinRecords {
				shouldDelete = true
				reason = fmt.Sprintf("below minimum records (%d)", *policy.MinRecords)
			}
		}
		
		if shouldDelete {
			if policy.NotifyBeforeDelete {
				// Log notification (in a real implementation, you might send actual notifications)
				fmt.Printf("Scheduling sub-table '%s' for deletion: %s\n", subTable.Name, reason)
			}
			
			if policy.ArchiveOldData {
				// Archive data before deletion (implementation depends on requirements)
				err := s.archiveSubTableData(ctx, database, subTable.Name)
				if err != nil {
					fmt.Printf("Failed to archive sub-table '%s': %v\n", subTable.Name, err)
					continue
				}
			}
			
			tablesToDelete = append(tablesToDelete, subTable.Name)
		}
	}
	
	// Delete tables that meet the criteria
	for _, tableName := range tablesToDelete {
		err := s.DropSubTable(ctx, database, tableName)
		if err != nil {
			fmt.Printf("Failed to delete sub-table '%s': %v\n", tableName, err)
		}
	}
	
	return nil
}

// Helper functions

// validateSubTableName validates sub-table name according to TDengine rules
func (s *TDengineService) validateSubTableName(name string) error {
	if len(name) == 0 {
		return fmt.Errorf("sub-table name cannot be empty")
	}
	
	if len(name) > 192 {
		return fmt.Errorf("sub-table name cannot exceed 192 characters")
	}
	
	// Check for valid characters (alphanumeric and underscore)
	for i, r := range name {
		if i == 0 {
			// First character must be letter or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_') {
				return fmt.Errorf("sub-table name must start with a letter or underscore")
			}
		} else {
			// Subsequent characters can be letters, digits, or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
				return fmt.Errorf("sub-table name can only contain letters, digits, and underscores")
			}
		}
	}
	
	return nil
}

// validateSubTableTags validates tags against super table schema
func (s *TDengineService) validateSubTableTags(tags map[string]interface{}, tagSchema []SuperTableTag) error {
	schemaMap := make(map[string]SuperTableTag)
	for _, tag := range tagSchema {
		schemaMap[tag.Name] = tag
	}
	
	for tagName, tagValue := range tags {
		tagDef, exists := schemaMap[tagName]
		if !exists {
			return fmt.Errorf("tag '%s' is not defined in super table schema", tagName)
		}
		
		// Validate tag value type
		if err := s.validateTagValue(tagValue, tagDef.Type); err != nil {
			return fmt.Errorf("invalid value for tag '%s': %w", tagName, err)
		}
	}
	
	return nil
}

// validateTagValue validates a tag value against its expected type
func (s *TDengineService) validateTagValue(value interface{}, tagType string) error {
	if value == nil {
		return nil // NULL values are allowed
	}
	
	upperType := strings.ToUpper(tagType)
	
	switch upperType {
	case "INT", "SMALLINT", "TINYINT":
		switch value.(type) {
		case int, int8, int16, int32, int64:
			return nil
		default:
			return fmt.Errorf("expected integer type for %s", tagType)
		}
	case "BIGINT":
		switch value.(type) {
		case int64:
			return nil
		default:
			return fmt.Errorf("expected int64 for BIGINT")
		}
	case "FLOAT", "DOUBLE":
		switch value.(type) {
		case float32, float64:
			return nil
		default:
			return fmt.Errorf("expected float type for %s", tagType)
		}
	case "BOOL":
		switch value.(type) {
		case bool:
			return nil
		default:
			return fmt.Errorf("expected bool for BOOL")
		}
	case "BINARY", "NCHAR", "VARCHAR":
		switch value.(type) {
		case string:
			return nil
		default:
			return fmt.Errorf("expected string for %s", tagType)
		}
	}
	
	return nil
}

// formatTagValue formats a tag value for SQL insertion
func (s *TDengineService) formatTagValue(value interface{}, tagType string) string {
	if value == nil {
		return "NULL"
	}
	
	switch v := value.(type) {
	case string:
		return fmt.Sprintf("'%s'", strings.ReplaceAll(v, "'", "''"))
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// generateSubTableName generates a sub-table name based on device ID and tags
func (s *TDengineService) generateSubTableName(deviceID string, tags map[string]interface{}) string {
	// Clean device ID for use in table name
	cleanDeviceID := strings.ReplaceAll(deviceID, "-", "_")
	cleanDeviceID = strings.ReplaceAll(cleanDeviceID, ".", "_")
	
	// Add collector ID if available in tags
	if collectorID, exists := tags["collector_id"]; exists {
		if collectorStr, ok := collectorID.(string); ok {
			cleanCollectorID := strings.ReplaceAll(collectorStr, "-", "_")
			cleanCollectorID = strings.ReplaceAll(cleanCollectorID, ".", "_")
			return fmt.Sprintf("d_%s_%s", cleanCollectorID, cleanDeviceID)
		}
	}
	
	return fmt.Sprintf("d_%s", cleanDeviceID)
}

// extractTagsFromDataPoint extracts tags from a data point for sub-table creation
func (s *TDengineService) extractTagsFromDataPoint(dataPoint DataPoint) map[string]interface{} {
	tags := make(map[string]interface{})
	
	// Copy all tags from data point
	for key, value := range dataPoint.Tags {
		tags[key] = value
	}
	
	// Add device ID as a tag if not already present
	if _, exists := tags["device_id"]; !exists {
		tags["device_id"] = dataPoint.DeviceID
	}
	
	// Add point name as a tag if not already present
	if _, exists := tags["point_name"]; !exists {
		tags["point_name"] = dataPoint.PointName
	}
	
	return tags
}

// buildSubTableFilterClause builds WHERE clause for sub-table filtering
func (s *TDengineService) buildSubTableFilterClause(database, superTable string, filter *SubTableFilter) string {
	if filter == nil {
		return ""
	}
	
	var conditions []string
	
	if filter.CreatedAfter != nil {
		conditions = append(conditions, fmt.Sprintf("create_time >= '%s'", filter.CreatedAfter.Format("2006-01-02 15:04:05")))
	}
	
	if filter.CreatedBefore != nil {
		conditions = append(conditions, fmt.Sprintf("create_time <= '%s'", filter.CreatedBefore.Format("2006-01-02 15:04:05")))
	}
	
	if len(conditions) == 0 {
		return ""
	}
	
	return " AND " + strings.Join(conditions, " AND ")
}

// enrichSubTableInfo adds additional information to sub-table info
func (s *TDengineService) enrichSubTableInfo(ctx context.Context, database string, info *SubTableInfo) {
	// Get tag information
	tags, err := s.getSubTableTags(ctx, database, info.Name)
	if err == nil {
		info.Tags = tags
	}
	
	// Get record count and last update time
	recordCount, lastUpdate, err := s.getSubTableStats(ctx, database, info.Name)
	if err == nil {
		info.RecordCount = recordCount
		info.LastUpdate = lastUpdate
	}
}

// getSubTableTags retrieves tags for a sub-table using SHOW CREATE TABLE
func (s *TDengineService) getSubTableTags(ctx context.Context, database, subTableName string) (map[string]interface{}, error) {
	// Query tag values using DESCRIBE to get tag names and types
	// Then query actual tag values from the table
	query := fmt.Sprintf("DESCRIBE `%s`.`%s`", database, subTableName)
	
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to describe sub-table: %w", err)
	}
	defer rows.Close()
	
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	
	// Find tag columns
	tagNames := []string{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		
		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}
		
		var fieldName, note string
		for i, col := range columns {
			switch strings.ToLower(col) {
			case "field":
				if v, ok := values[i].(string); ok {
					fieldName = v
				}
			case "note":
				if v, ok := values[i].(string); ok {
					note = v
				}
			}
		}
		
		// If this is a tag column, add to list
		if strings.ToLower(note) == "tag" && fieldName != "" {
			tagNames = append(tagNames, fieldName)
		}
	}
	
	if len(tagNames) == 0 {
		return make(map[string]interface{}), nil
	}
	
	// Query actual tag values - use SELECT TAGS FROM for TDengine 3.x
	tagsQuery := fmt.Sprintf("SELECT %s FROM `%s`.`%s` LIMIT 1",
		strings.Join(tagNames, ", "), database, subTableName)
	
	tagRows, err := s.manager.ExecuteQuery(ctx, tagsQuery)
	if err != nil {
		// Fallback: return tag names with empty values
		tags := make(map[string]interface{})
		for _, name := range tagNames {
			tags[name] = ""
		}
		return tags, nil
	}
	defer tagRows.Close()
	
	tagColumns, err := tagRows.Columns()
	if err != nil {
		return nil, err
	}
	
	tags := make(map[string]interface{})
	if tagRows.Next() {
		values := make([]interface{}, len(tagColumns))
		valuePtrs := make([]interface{}, len(tagColumns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		
		if err := tagRows.Scan(valuePtrs...); err != nil {
			return nil, err
		}
		
		for i, col := range tagColumns {
			tags[col] = values[i]
		}
	} else {
		// No data yet, return tag names with empty values
		for _, name := range tagNames {
			tags[name] = ""
		}
	}
	
	return tags, nil
}

// getSubTableStats retrieves statistics for a sub-table
func (s *TDengineService) getSubTableStats(ctx context.Context, database, subTableName string) (int64, time.Time, error) {
	query := fmt.Sprintf("SELECT COUNT(*), MAX(ts) FROM %s.%s", database, subTableName)
	
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return 0, time.Time{}, err
	}
	defer rows.Close()
	
	var count int64
	var lastUpdate time.Time
	
	if rows.Next() {
		err := rows.Scan(&count, &lastUpdate)
		if err != nil {
			return 0, time.Time{}, err
		}
	}
	
	return count, lastUpdate, nil
}

// UpdateSubTableTag updates a single tag value for a sub-table
// Uses TDengine syntax: ALTER TABLE db.table SET TAG tagName = value
func (s *TDengineService) UpdateSubTableTag(ctx context.Context, database, subTableName, tagName string, value interface{}) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	if subTableName == "" {
		return fmt.Errorf("sub-table name cannot be empty")
	}
	if tagName == "" {
		return fmt.Errorf("tag name cannot be empty")
	}

	// Format the value according to its type
	var formattedValue string
	switch v := value.(type) {
	case string:
		// Escape single quotes in string values
		escaped := strings.ReplaceAll(v, "'", "''")
		formattedValue = fmt.Sprintf("'%s'", escaped)
	case bool:
		if v {
			formattedValue = "true"
		} else {
			formattedValue = "false"
		}
	case nil:
		formattedValue = "NULL"
	default:
		// For numeric types
		formattedValue = fmt.Sprintf("%v", v)
	}

	// Build the ALTER TABLE statement
	// Use backticks to properly quote identifiers
	query := fmt.Sprintf("ALTER TABLE `%s`.`%s` SET TAG `%s` = %s",
		database, subTableName, tagName, formattedValue)

	// Execute the query
	_, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to update tag value: %w", err)
	}

	return nil
}

// archiveSubTableData archives sub-table data before deletion
func (s *TDengineService) archiveSubTableData(ctx context.Context, database, subTableName string) error {
	// This is a placeholder implementation
	// In a real system, you would implement data archival logic
	// such as exporting to files, moving to archive database, etc.
	
	fmt.Printf("Archiving data for sub-table %s.%s\n", database, subTableName)
	return nil
}