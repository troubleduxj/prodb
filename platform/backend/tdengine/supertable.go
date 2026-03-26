package tdengine

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
)

// SuperTableColumn represents a column in a super table
type SuperTableColumn struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Length int    `json:"length,omitempty"`
}

// SuperTableTag represents a tag in a super table
type SuperTableTag struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Length int    `json:"length,omitempty"`
}

// SuperTableSchema represents the schema of a super table
type SuperTableSchema struct {
	Name    string             `json:"name"`
	Columns []SuperTableColumn `json:"columns"`
	Tags    []SuperTableTag    `json:"tags"`
}

// SuperTableInfo represents information about a super table
type SuperTableInfo struct {
	Name         string             `json:"name"`
	CreatedTime  time.Time          `json:"created_time"`
	Columns      []SuperTableColumn `json:"columns"`
	Tags         []SuperTableTag    `json:"tags"`
	SubTableCount int               `json:"subtable_count"`
}

// SuperTableOptions represents options for creating a super table
type SuperTableOptions struct {
	IfNotExists bool `json:"if_not_exists"`
}

// AlterSuperTableAction represents the type of alteration to perform
type AlterSuperTableAction string

const (
	AlterActionAddColumn    AlterSuperTableAction = "ADD_COLUMN"
	AlterActionDropColumn   AlterSuperTableAction = "DROP_COLUMN"
	AlterActionModifyColumn AlterSuperTableAction = "MODIFY_COLUMN"
	AlterActionAddTag       AlterSuperTableAction = "ADD_TAG"
	AlterActionDropTag      AlterSuperTableAction = "DROP_TAG"
	AlterActionModifyTag    AlterSuperTableAction = "MODIFY_TAG"
)

// AlterSuperTableRequest represents a request to alter a super table
type AlterSuperTableRequest struct {
	Action AlterSuperTableAction `json:"action"`
	Column *SuperTableColumn     `json:"column,omitempty"`
	Tag    *SuperTableTag        `json:"tag,omitempty"`
	OldName string               `json:"old_name,omitempty"` // For rename operations
}

// Validate validates super table schema
func (schema *SuperTableSchema) Validate() error {
	if schema.Name == "" {
		return fmt.Errorf("super table name cannot be empty")
	}

	if len(schema.Columns) == 0 {
		return fmt.Errorf("super table must have at least one column")
	}

	// Validate columns
	columnNames := make(map[string]bool)
	hasTimestamp := false
	
	for _, col := range schema.Columns {
		if col.Name == "" {
			return fmt.Errorf("column name cannot be empty")
		}
		
		if columnNames[col.Name] {
			return fmt.Errorf("duplicate column name: %s", col.Name)
		}
		columnNames[col.Name] = true
		
		if err := validateColumnType(col.Type); err != nil {
			return fmt.Errorf("invalid column type for %s: %w", col.Name, err)
		}
		
		if strings.ToUpper(col.Type) == "TIMESTAMP" {
			hasTimestamp = true
		}
	}
	
	if !hasTimestamp {
		return fmt.Errorf("super table must have a TIMESTAMP column")
	}

	// Validate tags
	tagNames := make(map[string]bool)
	for _, tag := range schema.Tags {
		if tag.Name == "" {
			return fmt.Errorf("tag name cannot be empty")
		}
		
		if tagNames[tag.Name] {
			return fmt.Errorf("duplicate tag name: %s", tag.Name)
		}
		tagNames[tag.Name] = true
		
		if columnNames[tag.Name] {
			return fmt.Errorf("tag name conflicts with column name: %s", tag.Name)
		}
		
		if err := validateTagType(tag.Type); err != nil {
			return fmt.Errorf("invalid tag type for %s: %w", tag.Name, err)
		}
	}

	return nil
}

// validateColumnType validates if a column type is supported
func validateColumnType(colType string) error {
	validTypes := []string{
		"TIMESTAMP", "INT", "BIGINT", "FLOAT", "DOUBLE", "BINARY", "SMALLINT",
		"TINYINT", "BOOL", "NCHAR", "JSON", "VARCHAR", "GEOMETRY",
	}
	
	upperType := strings.ToUpper(colType)
	for _, validType := range validTypes {
		if upperType == validType {
			return nil
		}
	}
	
	return fmt.Errorf("unsupported column type: %s", colType)
}

// validateTagType validates if a tag type is supported
func validateTagType(tagType string) error {
	validTypes := []string{
		"INT", "BIGINT", "FLOAT", "DOUBLE", "BINARY", "SMALLINT",
		"TINYINT", "BOOL", "NCHAR", "VARCHAR",
	}
	
	upperType := strings.ToUpper(tagType)
	for _, validType := range validTypes {
		if upperType == validType {
			return nil
		}
	}
	
	return fmt.Errorf("unsupported tag type: %s", tagType)
}

// validateSuperTableName validates super table name according to TDengine rules
func (s *TDengineService) validateSuperTableName(name string) error {
	if len(name) == 0 {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if len(name) > 192 {
		return fmt.Errorf("super table name cannot exceed 192 characters")
	}
	
	// Check for valid characters (alphanumeric and underscore)
	for i, r := range name {
		if i == 0 {
			// First character must be letter or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_') {
				return fmt.Errorf("super table name must start with a letter or underscore")
			}
		} else {
			// Subsequent characters can be letters, digits, or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
				return fmt.Errorf("super table name can only contain letters, digits, and underscores")
			}
		}
	}
	
	// Check for reserved keywords
	reservedKeywords := []string{
		"select", "insert", "update", "delete", "create", "drop", "alter", "show",
		"use", "database", "table", "index", "view", "trigger", "procedure",
		"function", "user", "role", "grant", "revoke", "commit", "rollback",
		"stable", "stables", "tags", "tag",
	}
	
	lowerName := strings.ToLower(name)
	for _, keyword := range reservedKeywords {
		if lowerName == keyword {
			return fmt.Errorf("super table name cannot be a reserved keyword: %s", keyword)
		}
	}
	
	return nil
}

// CreateSuperTable creates a new super table
func (s *TDengineService) CreateSuperTable(ctx context.Context, database string, schema *SuperTableSchema, options *SuperTableOptions) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if schema == nil {
		return fmt.Errorf("super table schema cannot be nil")
	}
	
	// Validate schema
	if err := schema.Validate(); err != nil {
		return fmt.Errorf("invalid super table schema: %w", err)
	}
	
	// Validate super table name
	if err := s.validateSuperTableName(schema.Name); err != nil {
		return err
	}
	
	// Use the specified database
	_, err := s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Build CREATE STABLE query
	var queryBuilder strings.Builder
	queryBuilder.WriteString("CREATE STABLE ")
	
	if options != nil && options.IfNotExists {
		queryBuilder.WriteString("IF NOT EXISTS ")
	}
	
	queryBuilder.WriteString(schema.Name)
	queryBuilder.WriteString(" (")
	
	// Add columns
	for i, col := range schema.Columns {
		if i > 0 {
			queryBuilder.WriteString(", ")
		}
		queryBuilder.WriteString(col.Name)
		queryBuilder.WriteString(" ")
		queryBuilder.WriteString(strings.ToUpper(col.Type))
		
		// Add length for types that support it
		if col.Length > 0 && (strings.ToUpper(col.Type) == "BINARY" || strings.ToUpper(col.Type) == "NCHAR" || strings.ToUpper(col.Type) == "VARCHAR") {
			queryBuilder.WriteString(fmt.Sprintf("(%d)", col.Length))
		}
	}
	
	queryBuilder.WriteString(")")
	
	// Add tags if any
	if len(schema.Tags) > 0 {
		queryBuilder.WriteString(" TAGS (")
		for i, tag := range schema.Tags {
			if i > 0 {
				queryBuilder.WriteString(", ")
			}
			queryBuilder.WriteString(tag.Name)
			queryBuilder.WriteString(" ")
			queryBuilder.WriteString(strings.ToUpper(tag.Type))
			
			// Add length for types that support it
			if tag.Length > 0 && (strings.ToUpper(tag.Type) == "BINARY" || strings.ToUpper(tag.Type) == "NCHAR" || strings.ToUpper(tag.Type) == "VARCHAR") {
				queryBuilder.WriteString(fmt.Sprintf("(%d)", tag.Length))
			}
		}
		queryBuilder.WriteString(")")
	}
	
	query := queryBuilder.String()
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create super table %s: %w", schema.Name, err)
	}
	
	return nil
}

// DropSuperTable drops a super table
func (s *TDengineService) DropSuperTable(ctx context.Context, database, name string) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	// Validate super table name
	if err := s.validateSuperTableName(name); err != nil {
		return err
	}
	
	// Use the specified database
	_, err := s.manager.ExecuteNonQuery(ctx, fmt.Sprintf("USE %s", database))
	if err != nil {
		return fmt.Errorf("failed to use database %s: %w", database, err)
	}
	
	// Check if super table exists
	exists, err := s.SuperTableExists(ctx, database, name)
	if err != nil {
		return fmt.Errorf("failed to check super table existence: %w", err)
	}
	
	if !exists {
		return fmt.Errorf("super table '%s' does not exist in database '%s'", name, database)
	}
	
	query := fmt.Sprintf("DROP STABLE IF EXISTS %s", name)
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop super table %s: %w", name, err)
	}
	
	return nil
}

// ListSuperTables returns a list of all super tables in a database
// This is a simplified version that only gets basic info for performance
func (s *TDengineService) ListSuperTables(ctx context.Context, database string) ([]SuperTableInfo, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	// Use SHOW db_name.STABLES which is the correct TDengine 3.x syntax
	query := fmt.Sprintf("SHOW %s.STABLES", database)
	log.Printf("[ListSuperTables] Executing query: %s", query)
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		log.Printf("[ListSuperTables] Query failed: %v", err)
		return nil, fmt.Errorf("failed to query super tables: %w", err)
	}
	defer rows.Close()

	var superTables []SuperTableInfo

	for rows.Next() {
		var st SuperTableInfo

		if err := rows.Scan(&st.Name); err != nil {
			log.Printf("[ListSuperTables] Scan failed: %v", err)
			continue
		}
		
		log.Printf("[ListSuperTables] Found super table: %s", st.Name)
		superTables = append(superTables, st)
	}

	log.Printf("[ListSuperTables] Total super tables found: %d", len(superTables))
	return superTables, nil
}

// GetSuperTableInfo returns detailed information about a specific super table
func (s *TDengineService) GetSuperTableInfo(ctx context.Context, database, name string) (*SuperTableInfo, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return nil, fmt.Errorf("super table name cannot be empty")
	}
	
	superTables, err := s.ListSuperTables(ctx, database)
	if err != nil {
		return nil, err
	}

	for _, st := range superTables {
		if st.Name == name {
			return &st, nil
		}
	}

	return nil, fmt.Errorf("super table '%s' not found in database '%s'", name, database)
}

// GetSuperTableSchema returns the schema of a super table
func (s *TDengineService) GetSuperTableSchema(ctx context.Context, database, name string) (*SuperTableSchema, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return nil, fmt.Errorf("super table name cannot be empty")
	}
	
	// Get column information using fully qualified table name
	// Use backticks to preserve case sensitivity for table names
	query := fmt.Sprintf("DESCRIBE `%s`.`%s`", database, name)
	log.Printf("[GetSuperTableSchema] Executing query: %s", query)
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		log.Printf("[GetSuperTableSchema] Query failed: %v", err)
		return nil, fmt.Errorf("failed to describe super table %s: %w", name, err)
	}
	defer rows.Close()

	schema := &SuperTableSchema{
		Name:    name,
		Columns: []SuperTableColumn{},
		Tags:    []SuperTableTag{},
	}

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		var fieldName, fieldType, note string
		var length int
		
		for i, col := range columns {
			switch strings.ToLower(col) {
			case "field":
				if v, ok := values[i].(string); ok {
					fieldName = v
				}
			case "type":
				if v, ok := values[i].(string); ok {
					fieldType = v
				}
			case "length":
				if v, ok := values[i].(int64); ok {
					length = int(v)
				}
			case "note":
				if v, ok := values[i].(string); ok {
					note = v
				}
			}
		}
		
		// Parse type and length from type string if needed
		if strings.Contains(fieldType, "(") {
			parts := strings.Split(fieldType, "(")
			if len(parts) == 2 {
				fieldType = parts[0]
				lengthStr := strings.TrimSuffix(parts[1], ")")
				if parsedLength, err := strconv.Atoi(lengthStr); err == nil {
					length = parsedLength
				}
			}
		}
		
		if strings.ToLower(note) == "tag" {
			// This is a tag
			schema.Tags = append(schema.Tags, SuperTableTag{
				Name:   fieldName,
				Type:   strings.ToUpper(fieldType),
				Length: length,
			})
		} else {
			// This is a column
			schema.Columns = append(schema.Columns, SuperTableColumn{
				Name:   fieldName,
				Type:   strings.ToUpper(fieldType),
				Length: length,
			})
		}
	}

	return schema, nil
}

// SuperTableExists checks if a super table exists in a database
func (s *TDengineService) SuperTableExists(ctx context.Context, database, name string) (bool, error) {
	if database == "" {
		return false, fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return false, fmt.Errorf("super table name cannot be empty")
	}

	_, err := s.GetSuperTableInfo(ctx, database, name)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// AlterSuperTable modifies a super table structure
func (s *TDengineService) AlterSuperTable(ctx context.Context, database, name string, request *AlterSuperTableRequest) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if request == nil {
		return fmt.Errorf("alter request cannot be nil")
	}
	
	// Validate super table name
	if err := s.validateSuperTableName(name); err != nil {
		return err
	}
	
	// Check if super table exists
	exists, err := s.SuperTableExists(ctx, database, name)
	if err != nil {
		return fmt.Errorf("failed to check super table existence: %w", err)
	}
	
	if !exists {
		return fmt.Errorf("super table '%s' does not exist in database '%s'", name, database)
	}
	
	var query string
	
	switch request.Action {
	case AlterActionAddColumn:
		if request.Column == nil {
			return fmt.Errorf("column information is required for ADD_COLUMN action")
		}
		
		if err := validateColumnType(request.Column.Type); err != nil {
			return fmt.Errorf("invalid column type: %w", err)
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` ADD COLUMN `%s` %s",
			database, name, request.Column.Name, strings.ToUpper(request.Column.Type))
		
		if request.Column.Length > 0 && (strings.ToUpper(request.Column.Type) == "BINARY" ||
			strings.ToUpper(request.Column.Type) == "NCHAR" || strings.ToUpper(request.Column.Type) == "VARCHAR") {
			query += fmt.Sprintf("(%d)", request.Column.Length)
		}
		
	case AlterActionDropColumn:
		if request.Column == nil || request.Column.Name == "" {
			return fmt.Errorf("column name is required for DROP_COLUMN action")
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` DROP COLUMN `%s`", database, name, request.Column.Name)
		
	case AlterActionModifyColumn:
		if request.Column == nil {
			return fmt.Errorf("column information is required for MODIFY_COLUMN action")
		}
		
		if err := validateColumnType(request.Column.Type); err != nil {
			return fmt.Errorf("invalid column type: %w", err)
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` MODIFY COLUMN `%s` %s",
			database, name, request.Column.Name, strings.ToUpper(request.Column.Type))
		
		if request.Column.Length > 0 && (strings.ToUpper(request.Column.Type) == "BINARY" ||
			strings.ToUpper(request.Column.Type) == "NCHAR" || strings.ToUpper(request.Column.Type) == "VARCHAR") {
			query += fmt.Sprintf("(%d)", request.Column.Length)
		}
		
	case AlterActionAddTag:
		if request.Tag == nil {
			return fmt.Errorf("tag information is required for ADD_TAG action")
		}
		
		if err := validateTagType(request.Tag.Type); err != nil {
			return fmt.Errorf("invalid tag type: %w", err)
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` ADD TAG `%s` %s",
			database, name, request.Tag.Name, strings.ToUpper(request.Tag.Type))
		
		if request.Tag.Length > 0 && (strings.ToUpper(request.Tag.Type) == "BINARY" ||
			strings.ToUpper(request.Tag.Type) == "NCHAR" || strings.ToUpper(request.Tag.Type) == "VARCHAR") {
			query += fmt.Sprintf("(%d)", request.Tag.Length)
		}
		
	case AlterActionDropTag:
		if request.Tag == nil || request.Tag.Name == "" {
			return fmt.Errorf("tag name is required for DROP_TAG action")
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` DROP TAG `%s`", database, name, request.Tag.Name)
		
	case AlterActionModifyTag:
		if request.Tag == nil {
			return fmt.Errorf("tag information is required for MODIFY_TAG action")
		}
		
		if err := validateTagType(request.Tag.Type); err != nil {
			return fmt.Errorf("invalid tag type: %w", err)
		}
		
		query = fmt.Sprintf("ALTER STABLE `%s`.`%s` MODIFY TAG `%s` %s",
			database, name, request.Tag.Name, strings.ToUpper(request.Tag.Type))
		
		if request.Tag.Length > 0 && (strings.ToUpper(request.Tag.Type) == "BINARY" ||
			strings.ToUpper(request.Tag.Type) == "NCHAR" || strings.ToUpper(request.Tag.Type) == "VARCHAR") {
			query += fmt.Sprintf("(%d)", request.Tag.Length)
		}
		
	default:
		return fmt.Errorf("unsupported alter action: %s", request.Action)
	}
	
	// Log the query for debugging
	log.Printf("[AlterSuperTable] Executing query: %s", query)
	
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		log.Printf("[AlterSuperTable] Query failed: %v", err)
		return fmt.Errorf("failed to alter super table %s: %w", name, err)
	}
	
	log.Printf("[AlterSuperTable] Query succeeded")
	return nil
}

// GetSubTableCount returns the number of sub-tables for a super table
func (s *TDengineService) GetSubTableCount(ctx context.Context, database, superTableName string) (int, error) {
	if database == "" {
		return 0, fmt.Errorf("database name cannot be empty")
	}
	
	if superTableName == "" {
		return 0, fmt.Errorf("super table name cannot be empty")
	}
	
	// Query sub-table count from information_schema (no need to USE database)
	query := fmt.Sprintf("SELECT COUNT(*) FROM information_schema.ins_tables WHERE stable_name = '%s' AND db_name = '%s'", 
		superTableName, database)
	
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		// Fallback method if information_schema is not available
		query = fmt.Sprintf("SHOW TABLES LIKE '%s'", superTableName)
		rows, err = s.manager.ExecuteQuery(ctx, query)
		if err != nil {
			return 0, fmt.Errorf("failed to count sub-tables: %w", err)
		}
		
		count := 0
		for rows.Next() {
			count++
		}
		rows.Close()
		return count, nil
	}
	defer rows.Close()

	var count int
	if rows.Next() {
		err := rows.Scan(&count)
		if err != nil {
			return 0, fmt.Errorf("failed to scan count: %w", err)
		}
	}

	return count, nil
}

// ValidateSuperTableCompatibility checks if a schema change is compatible with existing data
func (s *TDengineService) ValidateSuperTableCompatibility(ctx context.Context, database, name string, newSchema *SuperTableSchema) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if name == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if newSchema == nil {
		return fmt.Errorf("new schema cannot be nil")
	}
	
	// Get current schema
	currentSchema, err := s.GetSuperTableSchema(ctx, database, name)
	if err != nil {
		return fmt.Errorf("failed to get current schema: %w", err)
	}
	
	// Check if new schema is valid
	if err := newSchema.Validate(); err != nil {
		return fmt.Errorf("new schema is invalid: %w", err)
	}
	
	// Create maps for easier comparison
	currentColumns := make(map[string]SuperTableColumn)
	for _, col := range currentSchema.Columns {
		currentColumns[col.Name] = col
	}
	
	currentTags := make(map[string]SuperTableTag)
	for _, tag := range currentSchema.Tags {
		currentTags[tag.Name] = tag
	}
	
	// Check column compatibility
	for _, newCol := range newSchema.Columns {
		if currentCol, exists := currentColumns[newCol.Name]; exists {
			// Column exists, check if type change is compatible
			if !s.isColumnTypeCompatible(currentCol.Type, newCol.Type) {
				return fmt.Errorf("incompatible column type change for '%s': %s -> %s", 
					newCol.Name, currentCol.Type, newCol.Type)
			}
			
			// Check length compatibility for string types
			if s.isStringType(newCol.Type) && newCol.Length < currentCol.Length {
				return fmt.Errorf("cannot reduce column length for '%s': %d -> %d", 
					newCol.Name, currentCol.Length, newCol.Length)
			}
		}
	}
	
	// Check tag compatibility
	for _, newTag := range newSchema.Tags {
		if currentTag, exists := currentTags[newTag.Name]; exists {
			// Tag exists, check if type change is compatible
			if !s.isTagTypeCompatible(currentTag.Type, newTag.Type) {
				return fmt.Errorf("incompatible tag type change for '%s': %s -> %s", 
					newTag.Name, currentTag.Type, newTag.Type)
			}
			
			// Check length compatibility for string types
			if s.isStringType(newTag.Type) && newTag.Length < currentTag.Length {
				return fmt.Errorf("cannot reduce tag length for '%s': %d -> %d", 
					newTag.Name, currentTag.Length, newTag.Length)
			}
		}
	}
	
	// Check for removed columns (not allowed if there's data)
	subTableCount, err := s.GetSubTableCount(ctx, database, name)
	if err == nil && subTableCount > 0 {
		newColumnMap := make(map[string]bool)
		for _, col := range newSchema.Columns {
			newColumnMap[col.Name] = true
		}
		
		for _, currentCol := range currentSchema.Columns {
			if !newColumnMap[currentCol.Name] && currentCol.Name != "ts" {
				return fmt.Errorf("cannot remove column '%s' when sub-tables exist", currentCol.Name)
			}
		}
		
		newTagMap := make(map[string]bool)
		for _, tag := range newSchema.Tags {
			newTagMap[tag.Name] = true
		}
		
		for _, currentTag := range currentSchema.Tags {
			if !newTagMap[currentTag.Name] {
				return fmt.Errorf("cannot remove tag '%s' when sub-tables exist", currentTag.Name)
			}
		}
	}
	
	return nil
}

// isColumnTypeCompatible checks if a column type change is compatible
func (s *TDengineService) isColumnTypeCompatible(oldType, newType string) bool {
	oldType = strings.ToUpper(oldType)
	newType = strings.ToUpper(newType)
	
	if oldType == newType {
		return true
	}
	
	// Define compatible type conversions
	compatibleConversions := map[string][]string{
		"TINYINT":  {"SMALLINT", "INT", "BIGINT", "FLOAT", "DOUBLE"},
		"SMALLINT": {"INT", "BIGINT", "FLOAT", "DOUBLE"},
		"INT":      {"BIGINT", "FLOAT", "DOUBLE"},
		"BIGINT":   {"FLOAT", "DOUBLE"},
		"FLOAT":    {"DOUBLE"},
		"BINARY":   {"NCHAR", "VARCHAR"},
		"NCHAR":    {"VARCHAR"},
	}
	
	if allowedTypes, exists := compatibleConversions[oldType]; exists {
		for _, allowedType := range allowedTypes {
			if newType == allowedType {
				return true
			}
		}
	}
	
	return false
}

// isTagTypeCompatible checks if a tag type change is compatible
func (s *TDengineService) isTagTypeCompatible(oldType, newType string) bool {
	// For tags, we're more restrictive - only allow same type or compatible string types
	oldType = strings.ToUpper(oldType)
	newType = strings.ToUpper(newType)
	
	if oldType == newType {
		return true
	}
	
	// Allow string type conversions
	stringTypes := []string{"BINARY", "NCHAR", "VARCHAR"}
	oldIsString := s.contains(stringTypes, oldType)
	newIsString := s.contains(stringTypes, newType)
	
	return oldIsString && newIsString
}

// isStringType checks if a type is a string type
func (s *TDengineService) isStringType(dataType string) bool {
	stringTypes := []string{"BINARY", "NCHAR", "VARCHAR"}
	return s.contains(stringTypes, strings.ToUpper(dataType))
}

// contains checks if a slice contains a string
func (s *TDengineService) contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}