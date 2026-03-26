package tdengine

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// TDengineService provides high-level database operations
type TDengineService struct {
	manager           *TDengineManager
	highPerfWriter    *HighPerformanceWriter
	querySystem       *QuerySystem
	compressionEnabled bool
}

// NewTDengineService creates a new TDengine service
func NewTDengineService(manager *TDengineManager) *TDengineService {
	service := &TDengineService{
		manager:           manager,
		compressionEnabled: false,
	}
	
	// Initialize query system with default configuration
	service.querySystem = NewQuerySystem(service, nil)
	
	return service
}

// NewTDengineServiceWithHighPerformance creates a new TDengine service with high-performance writer
func NewTDengineServiceWithHighPerformance(manager *TDengineManager, config *HighPerformanceConfig) (*TDengineService, error) {
	service := &TDengineService{
		manager:           manager,
		compressionEnabled: config != nil && config.EnableCompression,
	}

	// Initialize query system with default configuration
	service.querySystem = NewQuerySystem(service, nil)

	// Create high-performance writer if config is provided
	if config != nil {
		hpWriter, err := NewHighPerformanceWriter(service, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create high-performance writer: %w", err)
		}
		service.highPerfWriter = hpWriter
	}

	return service, nil
}

// StartHighPerformanceWriter starts the high-performance writer
func (s *TDengineService) StartHighPerformanceWriter(ctx context.Context) error {
	if s.highPerfWriter == nil {
		return fmt.Errorf("high-performance writer not configured")
	}
	return s.highPerfWriter.Start(ctx)
}

// StopHighPerformanceWriter stops the high-performance writer
func (s *TDengineService) StopHighPerformanceWriter() error {
	if s.highPerfWriter == nil {
		return nil
	}
	return s.highPerfWriter.Stop()
}

// GetHighPerformanceWriter returns the high-performance writer instance
func (s *TDengineService) GetHighPerformanceWriter() *HighPerformanceWriter {
	return s.highPerfWriter
}

// GetManager returns the underlying TDengine manager
func (s *TDengineService) GetManager() *TDengineManager {
	return s.manager
}

// GetHealthStatus returns the current health status
func (s *TDengineService) GetHealthStatus() *HealthStatus {
	return s.manager.GetHealthStatus()
}

// GetMetrics returns database operation metrics
func (s *TDengineService) GetMetrics() *DBMetrics {
	return s.manager.GetMetrics()
}

// toInt converts various integer types to int
func toInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case int8:
		return int(val)
	case int16:
		return int(val)
	case int32:
		return int(val)
	case int64:
		return int(val)
	case uint:
		return int(val)
	case uint8:
		return int(val)
	case uint16:
		return int(val)
	case uint32:
		return int(val)
	case uint64:
		return int(val)
	case float32:
		return int(val)
	case float64:
		return int(val)
	default:
		return 0
	}
}

// toString converts various types to string
func toString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case []byte:
		return string(val)
	case int:
		return fmt.Sprintf("%d", val)
	case int8:
		return fmt.Sprintf("%d", val)
	case int16:
		return fmt.Sprintf("%d", val)
	case int32:
		return fmt.Sprintf("%d", val)
	case int64:
		return fmt.Sprintf("%d", val)
	case uint:
		return fmt.Sprintf("%d", val)
	case uint8:
		return fmt.Sprintf("%d", val)
	case uint16:
		return fmt.Sprintf("%d", val)
	case uint32:
		return fmt.Sprintf("%d", val)
	case uint64:
		return fmt.Sprintf("%d", val)
	case float32:
		return fmt.Sprintf("%g", val)
	case float64:
		return fmt.Sprintf("%g", val)
	case bool:
		return fmt.Sprintf("%t", val)
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", val)
	}
}

// DatabaseInfo represents database information
type DatabaseInfo struct {
	Name               string    `json:"name"`
	CreatedTime        time.Time `json:"created_time"`
	NTables            int       `json:"ntables"`
	VGroups            int       `json:"vgroups"`
	Replica            int       `json:"replica"`
	Quorum             int       `json:"quorum"`
	Days               int       `json:"days"`
	Keep               string    `json:"keep"`
	Cache              int       `json:"cache"`
	Blocks             int       `json:"blocks"`
	MinRows            int       `json:"minrows"`
	MaxRows            int       `json:"maxrows"`
	WalLevel           int       `json:"wallevel"`
	Fsync              int       `json:"fsync"`
	Comp               int       `json:"comp"`
	Precision          string    `json:"precision"`
	Status             string    `json:"status"`
	// TDengine 3.x 新增字段
	Duration           string    `json:"duration"`
	Buffer             int       `json:"buffer"`
	Pages              int       `json:"pages"`
	PageSize           int       `json:"pagesize"`
	Strict             string    `json:"strict"`
	Retentions         string    `json:"retentions"`
	SingleStable       string    `json:"single_stable"`
	CacheModel         string    `json:"cachemodel"`
	CacheSize          int       `json:"cachesize"`
	WalRetentionPeriod int       `json:"wal_retention_period"`
	WalRetentionSize   int       `json:"wal_retention_size"`
	SttTrigger         int       `json:"stt_trigger"`
	TablePrefix        string    `json:"table_prefix"`
	TableSuffix        string    `json:"table_suffix"`
	TsdbPageSize       int       `json:"tsdb_pagesize"`
	KeepTimeOffset     string    `json:"keep_time_offset"`
	S3ChunkPages       int       `json:"s3_chunkpages"`
	S3KeepLocal        string    `json:"s3_keeplocal"`
	S3Compact          int       `json:"s3_compact"`
	WithArbitrator     string    `json:"with_arbitrator"`
	EncryptAlgorithm   string    `json:"encrypt_algorithm"`
}

// DatabaseOptions represents options for creating a database
type DatabaseOptions struct {
	Days      int    `json:"days,omitempty"`
	Keep      string `json:"keep,omitempty"`
	Cache     int    `json:"cache,omitempty"`
	Blocks    int    `json:"blocks,omitempty"`
	MinRows   int    `json:"minrows,omitempty"`
	MaxRows   int    `json:"maxrows,omitempty"`
	WalLevel  int    `json:"wallevel,omitempty"`
	Fsync     int    `json:"fsync,omitempty"`
	Comp      int    `json:"comp,omitempty"`
	Precision string `json:"precision,omitempty"`
	Replica   int    `json:"replica,omitempty"`
	Quorum    int    `json:"quorum,omitempty"`
}

// Validate validates database options
func (opts *DatabaseOptions) Validate() error {
	if opts.Days < 0 {
		return fmt.Errorf("days must be non-negative")
	}
	if opts.Cache < 0 {
		return fmt.Errorf("cache must be non-negative")
	}
	if opts.Blocks < 0 {
		return fmt.Errorf("blocks must be non-negative")
	}
	if opts.MinRows < 0 {
		return fmt.Errorf("minrows must be non-negative")
	}
	if opts.MaxRows < 0 {
		return fmt.Errorf("maxrows must be non-negative")
	}
	if opts.WalLevel < 0 || opts.WalLevel > 2 {
		return fmt.Errorf("wallevel must be 0, 1, or 2")
	}
	if opts.Fsync < 0 {
		return fmt.Errorf("fsync must be non-negative")
	}
	if opts.Comp < 0 || opts.Comp > 2 {
		return fmt.Errorf("comp must be 0, 1, or 2")
	}
	if opts.Precision != "" && opts.Precision != "ms" && opts.Precision != "us" && opts.Precision != "ns" {
		return fmt.Errorf("precision must be 'ms', 'us', or 'ns'")
	}
	if opts.Replica < 0 {
		return fmt.Errorf("replica must be non-negative")
	}
	if opts.Quorum < 0 {
		return fmt.Errorf("quorum must be non-negative")
	}
	return nil
}

// ListDatabases returns a list of all databases
func (s *TDengineService) ListDatabases(ctx context.Context) ([]DatabaseInfo, error) {
	rows, err := s.manager.ExecuteQuery(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, fmt.Errorf("failed to query databases: %w", err)
	}
	defer rows.Close()

	var databases []DatabaseInfo
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}
	
	// 调试：打印列名
	fmt.Printf("[DEBUG] SHOW DATABASES columns: %v\n", columns)

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		db := DatabaseInfo{}
		for i, col := range columns {
			colLower := strings.ToLower(col)
			switch colLower {
			case "name":
				if v, ok := values[i].(string); ok {
					db.Name = v
				}
			case "create_time":
				if v, ok := values[i].(time.Time); ok {
					db.CreatedTime = v
				}
			case "ntables":
				if v, ok := values[i].(int64); ok {
					db.NTables = int(v)
				}
			case "vgroups":
				if v, ok := values[i].(int64); ok {
					db.VGroups = int(v)
				}
			case "replica":
				if v, ok := values[i].(int64); ok {
					db.Replica = int(v)
				}
			case "quorum":
				if v, ok := values[i].(int64); ok {
					db.Quorum = int(v)
				}
			case "days":
				if v, ok := values[i].(int64); ok {
					db.Days = int(v)
				}
			case "duration":
				// TDengine 3.x 使用 duration 替代 days
				if v, ok := values[i].(string); ok {
					db.Keep = v
				}
			case "keep":
				if v, ok := values[i].(string); ok {
					db.Keep = v
				}
			case "cache(mb)", "cache":
				if v, ok := values[i].(int64); ok {
					db.Cache = int(v)
				}
			case "buffer":
				// TDengine 3.x 使用 buffer
				if v, ok := values[i].(int64); ok {
					db.Cache = int(v)
				}
			case "blocks", "pages":
				if v, ok := values[i].(int64); ok {
					db.Blocks = int(v)
				}
			case "minrows":
				if v, ok := values[i].(int64); ok {
					db.MinRows = int(v)
				}
			case "maxrows":
				if v, ok := values[i].(int64); ok {
					db.MaxRows = int(v)
				}
			case "wallevel", "wal_level":
				if v, ok := values[i].(int64); ok {
					db.WalLevel = int(v)
				}
			case "fsync", "wal_fsync_period":
				if v, ok := values[i].(int64); ok {
					db.Fsync = int(v)
				}
			case "comp":
				if v, ok := values[i].(int64); ok {
					db.Comp = int(v)
				}
			case "precision":
				if v, ok := values[i].(string); ok {
					db.Precision = v
				}
			case "status":
				if v, ok := values[i].(string); ok {
					db.Status = v
				}
			case "pagesize":
				// pagesize 映射到 blocks
				if v, ok := values[i].(int64); ok {
					db.Blocks = int(v)
				}
			case "strict":
				if v, ok := values[i].(string); ok {
					// strict 可以作为状态的一部分
					if db.Status != "" {
						db.Status += ", strict:" + v
					} else {
						db.Status = "strict:" + v
					}
				}
			}
		}
		databases = append(databases, db)
	}

	return databases, nil
}

// GetDatabaseInfo returns detailed information about a specific database
func (s *TDengineService) GetDatabaseInfo(ctx context.Context, name string) (*DatabaseInfo, error) {
	if name == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}

	// 尝试从 information_schema.ins_databases 获取详细信息 (TDengine 3.x)
	query := fmt.Sprintf("SELECT * FROM information_schema.ins_databases WHERE name = '%s'", name)
	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		// 如果失败，回退到原来的方法
		fmt.Printf("[DEBUG] information_schema query failed: %v, falling back to SHOW DATABASES\n", err)
		databases, err := s.ListDatabases(ctx)
		if err != nil {
			return nil, err
		}
		for _, db := range databases {
			if db.Name == name {
				return &db, nil
			}
		}
		return nil, fmt.Errorf("database '%s' not found", name)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}
	fmt.Printf("[DEBUG] information_schema.ins_databases columns: %v\n", columns)

	if rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		db := DatabaseInfo{Name: name}
		for i, col := range columns {
			// 调试：打印每个字段的值和类型
			fmt.Printf("[DEBUG] Column %s: value=%v, type=%T\n", col, values[i], values[i])
			colLower := strings.ToLower(col)
			switch colLower {
			case "create_time":
				if v, ok := values[i].(time.Time); ok {
					db.CreatedTime = v
				}
			case "ntables":
					db.NTables = toInt(values[i])
				case "vgroups":
					db.VGroups = toInt(values[i])
				case "replica":
					db.Replica = toInt(values[i])
				case "quorum":
					db.Quorum = toInt(values[i])
				case "days":
					db.Days = toInt(values[i])
			case "keep":
				if v, ok := values[i].(string); ok {
					db.Keep = v
				}
			case "cache":
					db.Cache = toInt(values[i])
				case "buffer":
					db.Buffer = toInt(values[i])
				case "blocks":
					db.Blocks = toInt(values[i])
				case "pages":
					db.Pages = toInt(values[i])
				case "pagesize":
					db.PageSize = toInt(values[i])
				case "minrows":
					db.MinRows = toInt(values[i])
				case "maxrows":
					db.MaxRows = toInt(values[i])
				case "wallevel", "wal_level":
					db.WalLevel = toInt(values[i])
				case "fsync", "wal_fsync_period":
					db.Fsync = toInt(values[i])
				case "comp":
					db.Comp = toInt(values[i])
			case "precision":
				if v, ok := values[i].(string); ok {
					db.Precision = v
				}
			case "status":
				if v, ok := values[i].(string); ok {
					db.Status = v
				}
			case "strict":
				if v, ok := values[i].(string); ok {
					db.Strict = v
				}
			case "duration":
				if v, ok := values[i].(string); ok {
					db.Duration = v
				}
			case "retentions":
				if v, ok := values[i].(string); ok {
					db.Retentions = v
				}
			case "single_stable":
				if v, ok := values[i].(string); ok {
					db.SingleStable = v
				}
			case "cachemodel":
				if v, ok := values[i].(string); ok {
					db.CacheModel = v
				}
			case "cachesize":
				if v, ok := values[i].(int64); ok {
					db.CacheSize = int(v)
				}
			case "wal_retention_period":
					db.WalRetentionPeriod = toInt(values[i])
				case "wal_retention_size":
					db.WalRetentionSize = toInt(values[i])
				case "stt_trigger":
					db.SttTrigger = toInt(values[i])
				case "table_prefix":
					db.TablePrefix = toString(values[i])
				case "table_suffix":
					db.TableSuffix = toString(values[i])
				case "tsdb_pagesize":
					db.TsdbPageSize = toInt(values[i])
				case "keep_time_offset":
					db.KeepTimeOffset = toString(values[i])
				case "s3_chunkpages":
					db.S3ChunkPages = toInt(values[i])
				case "s3_keeplocal":
					db.S3KeepLocal = toString(values[i])
				case "s3_compact":
					db.S3Compact = toInt(values[i])
				case "with_arbitrator":
					db.WithArbitrator = toString(values[i])
			case "encrypt_algorithm":
				if v, ok := values[i].(string); ok {
					db.EncryptAlgorithm = v
				}
			}
		}
		return &db, nil
	}

	return nil, fmt.Errorf("database '%s' not found", name)
}

// CreateDatabase creates a new database with the specified options
func (s *TDengineService) CreateDatabase(ctx context.Context, name string, options *DatabaseOptions) error {
	if name == "" {
		return fmt.Errorf("database name cannot be empty")
	}

	// Validate database name
	if err := s.validateDatabaseName(name); err != nil {
		return err
	}

	// Validate options if provided
	if options != nil {
		if err := options.Validate(); err != nil {
			return fmt.Errorf("invalid database options: %w", err)
		}
	}

	// Build CREATE DATABASE query
	query := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s", name)
	
	if options != nil {
		var opts []string
		
		if options.Days > 0 {
			opts = append(opts, fmt.Sprintf("DAYS %d", options.Days))
		}
		if options.Keep != "" {
			opts = append(opts, fmt.Sprintf("KEEP %s", options.Keep))
		}
		if options.Cache > 0 {
			opts = append(opts, fmt.Sprintf("CACHE %d", options.Cache))
		}
		if options.Blocks > 0 {
			opts = append(opts, fmt.Sprintf("BLOCKS %d", options.Blocks))
		}
		if options.MinRows > 0 {
			opts = append(opts, fmt.Sprintf("MINROWS %d", options.MinRows))
		}
		if options.MaxRows > 0 {
			opts = append(opts, fmt.Sprintf("MAXROWS %d", options.MaxRows))
		}
		if options.WalLevel >= 0 {
			opts = append(opts, fmt.Sprintf("WAL %d", options.WalLevel))
		}
		if options.Fsync > 0 {
			opts = append(opts, fmt.Sprintf("FSYNC %d", options.Fsync))
		}
		if options.Comp >= 0 {
			opts = append(opts, fmt.Sprintf("COMP %d", options.Comp))
		}
		if options.Precision != "" {
			opts = append(opts, fmt.Sprintf("PRECISION '%s'", options.Precision))
		}
		if options.Replica > 0 {
			opts = append(opts, fmt.Sprintf("REPLICA %d", options.Replica))
		}
		if options.Quorum > 0 {
			opts = append(opts, fmt.Sprintf("QUORUM %d", options.Quorum))
		}
		
		if len(opts) > 0 {
			query += " " + strings.Join(opts, " ")
		}
	}

	_, err := s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create database '%s': %w", name, err)
	}

	return nil
}

// DropDatabase drops a database
func (s *TDengineService) DropDatabase(ctx context.Context, name string) error {
	if name == "" {
		return fmt.Errorf("database name cannot be empty")
	}

	// Validate database name
	if err := s.validateDatabaseName(name); err != nil {
		return err
	}

	// Check if database exists
	_, err := s.GetDatabaseInfo(ctx, name)
	if err != nil {
		return fmt.Errorf("database '%s' does not exist", name)
	}

	query := fmt.Sprintf("DROP DATABASE IF EXISTS %s", name)
	_, err = s.manager.ExecuteNonQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop database '%s': %w", name, err)
	}

	return nil
}

// DatabaseExists checks if a database exists
func (s *TDengineService) DatabaseExists(ctx context.Context, name string) (bool, error) {
	if name == "" {
		return false, fmt.Errorf("database name cannot be empty")
	}

	_, err := s.GetDatabaseInfo(ctx, name)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// validateDatabaseName validates database name according to TDengine rules
func (s *TDengineService) validateDatabaseName(name string) error {
	if len(name) == 0 {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if len(name) > 64 {
		return fmt.Errorf("database name cannot exceed 64 characters")
	}
	
	// Check for valid characters (alphanumeric and underscore)
	for i, r := range name {
		if i == 0 {
			// First character must be letter or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_') {
				return fmt.Errorf("database name must start with a letter or underscore")
			}
		} else {
			// Subsequent characters can be letters, digits, or underscore
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_') {
				return fmt.Errorf("database name can only contain letters, digits, and underscores")
			}
		}
	}
	
	// Check for reserved keywords
	reservedKeywords := []string{
		"select", "insert", "update", "delete", "create", "drop", "alter", "show",
		"use", "database", "table", "index", "view", "trigger", "procedure",
		"function", "user", "role", "grant", "revoke", "commit", "rollback",
	}
	
	lowerName := strings.ToLower(name)
	for _, keyword := range reservedKeywords {
		if lowerName == keyword {
			return fmt.Errorf("database name cannot be a reserved keyword: %s", keyword)
		}
	}
	
	return nil
}

// DataPoint represents a single data point for insertion
type DataPoint struct {
	DeviceID    string                 `json:"device_id"`
	PointName   string                 `json:"point_name"`
	Timestamp   time.Time              `json:"timestamp"`
	Value       interface{}            `json:"value"`
	Quality     int                    `json:"quality"`
	Tags        map[string]interface{} `json:"tags"`
}

// TableInfo represents table information
type TableInfo struct {
	Name        string    `json:"name"`
	Type        string    `json:"type"`         // "NORMAL_TABLE", "CHILD_TABLE", "SUPER_TABLE"
	CreatedTime time.Time `json:"created_time"`
	Columns     int       `json:"columns"`
	Rows        int64     `json:"rows"`
	Size        string    `json:"size"`
	SuperTable  string    `json:"super_table,omitempty"` // For child tables
	Database    string    `json:"database"`
}

// ListTables returns a list of all tables in a database
func (s *TDengineService) ListTables(ctx context.Context, database string) ([]TableInfo, error) {
	if database == "" {
		return nil, fmt.Errorf("database name cannot be empty")
	}

	// Skip system databases that don't support SHOW TABLES
	systemDatabases := []string{"information_schema", "performance_schema", "log"}
	for _, sysDb := range systemDatabases {
		if database == sysDb {
			return []TableInfo{}, nil // Return empty list for system databases
		}
	}

	// For now, return mock data to test the integration
	// TODO: Implement actual TDengine table querying when TDengine is properly configured
	mockTables := []TableInfo{
		{
			Name:        "sensors_data",
			Type:        "SUPER_TABLE",
			CreatedTime: time.Now().Add(-24 * time.Hour),
			Columns:     8,
			Rows:        0,
			Size:        "0 B",
			SuperTable:  "",
			Database:    database,
		},
		{
			Name:        "device_001_sensors",
			Type:        "CHILD_TABLE",
			CreatedTime: time.Now().Add(-12 * time.Hour),
			Columns:     8,
			Rows:        15420,
			Size:        "2.3 MB",
			SuperTable:  "sensors_data",
			Database:    database,
		},
		{
			Name:        "system_logs",
			Type:        "NORMAL_TABLE",
			CreatedTime: time.Now().Add(-48 * time.Hour),
			Columns:     5,
			Rows:        8934,
			Size:        "1.2 MB",
			SuperTable:  "",
			Database:    database,
		},
	}

	return mockTables, nil
}

// QueryLatestData queries the latest data for specified collectors
func (s *TDengineService) QueryLatestData(ctx context.Context, collectorIDs []string, limit int) ([]DataPoint, error) {
	if len(collectorIDs) == 0 {
		return nil, fmt.Errorf("at least one collector ID is required")
	}

	if limit <= 0 {
		limit = 100
	}

	// Build query with collector ID filter
	collectorFilter := make([]string, len(collectorIDs))
	for i, id := range collectorIDs {
		collectorFilter[i] = fmt.Sprintf("'%s'", id)
	}

	query := fmt.Sprintf(`
		SELECT collector_id, device_id, point_name, ts, value, quality 
		FROM modbus_metrics 
		WHERE collector_id IN (%s) 
		ORDER BY ts DESC 
		LIMIT %d`,
		strings.Join(collectorFilter, ","),
		limit,
	)

	rows, err := s.manager.ExecuteQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query latest data: %w", err)
	}
	defer rows.Close()

	var dataPoints []DataPoint
	for rows.Next() {
		var dp DataPoint
		var collectorID string
		
		err := rows.Scan(
			&collectorID,
			&dp.DeviceID,
			&dp.PointName,
			&dp.Timestamp,
			&dp.Value,
			&dp.Quality,
		)
		if err != nil {
			continue
		}

		dp.Tags = map[string]interface{}{
			"collector_id": collectorID,
		}
		
		dataPoints = append(dataPoints, dp)
	}

	return dataPoints, nil
}

// InsertCollectorData inserts data from a collector with automatic sub-table creation
func (s *TDengineService) InsertCollectorData(ctx context.Context, collectorID string, dataPoints []DataPoint) error {
	if collectorID == "" {
		return fmt.Errorf("collector ID cannot be empty")
	}

	if len(dataPoints) == 0 {
		return fmt.Errorf("no data points to insert")
	}

	// Use a default database for collector data
	database := "industrial_data"
	superTable := "modbus_metrics"
	
	// Ensure database exists
	exists, err := s.DatabaseExists(ctx, database)
	if err != nil {
		return fmt.Errorf("failed to check database existence: %w", err)
	}
	
	if !exists {
		// Create database with default options
		err = s.CreateDatabase(ctx, database, &DatabaseOptions{
			Days:      10,
			Keep:      "365",
			Cache:     16,
			Precision: "ms",
		})
		if err != nil {
			return fmt.Errorf("failed to create database: %w", err)
		}
	}
	
	// Ensure super table exists
	stExists, err := s.SuperTableExists(ctx, database, superTable)
	if err != nil {
		return fmt.Errorf("failed to check super table existence: %w", err)
	}
	
	if !stExists {
		// Create default super table for modbus metrics
		schema := &SuperTableSchema{
			Name: superTable,
			Columns: []SuperTableColumn{
				{Name: "ts", Type: "TIMESTAMP"},
				{Name: "value", Type: "DOUBLE"},
				{Name: "quality", Type: "INT"},
				{Name: "data_type", Type: "TINYINT"},
				{Name: "raw_value", Type: "NCHAR", Length: 64},
			},
			Tags: []SuperTableTag{
				{Name: "collector_id", Type: "NCHAR", Length: 64},
				{Name: "device_id", Type: "NCHAR", Length: 64},
				{Name: "point_name", Type: "NCHAR", Length: 128},
				{Name: "location", Type: "NCHAR", Length: 64},
				{Name: "device_type", Type: "NCHAR", Length: 32},
				{Name: "unit", Type: "NCHAR", Length: 16},
			},
		}
		
		err = s.CreateSuperTable(ctx, database, schema, &SuperTableOptions{IfNotExists: true})
		if err != nil {
			return fmt.Errorf("failed to create super table: %w", err)
		}
	}
	
	for _, dp := range dataPoints {
		// Add collector ID to data point tags
		if dp.Tags == nil {
			dp.Tags = make(map[string]interface{})
		}
		dp.Tags["collector_id"] = collectorID
		
		// Auto-create sub-table if it doesn't exist
		subTableName, err := s.AutoCreateSubTable(ctx, database, superTable, dp)
		if err != nil {
			return fmt.Errorf("failed to auto-create sub-table for device %s: %w", dp.DeviceID, err)
		}

		// Insert data into the sub-table
		query := fmt.Sprintf(`
			INSERT INTO %s VALUES ('%s', %v, %d, 1, '%v')`,
			subTableName,
			dp.Timestamp.Format("2006-01-02 15:04:05.000"),
			dp.Value,
			dp.Quality,
			dp.Value,
		)

		_, err = s.manager.ExecuteNonQuery(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to insert data point for device %s: %w", dp.DeviceID, err)
		}
	}

	return nil
}

// InsertDataWithAutoSubTable inserts data with automatic sub-table management
func (s *TDengineService) InsertDataWithAutoSubTable(ctx context.Context, database, superTable string, dataPoints []DataPoint) error {
	if database == "" {
		return fmt.Errorf("database name cannot be empty")
	}
	
	if superTable == "" {
		return fmt.Errorf("super table name cannot be empty")
	}
	
	if len(dataPoints) == 0 {
		return fmt.Errorf("no data points to insert")
	}
	
	// Group data points by device to optimize sub-table creation
	deviceGroups := make(map[string][]DataPoint)
	for _, dp := range dataPoints {
		key := dp.DeviceID
		if collectorID, exists := dp.Tags["collector_id"]; exists {
			key = fmt.Sprintf("%v_%s", collectorID, dp.DeviceID)
		}
		deviceGroups[key] = append(deviceGroups[key], dp)
	}
	
	// Process each device group
	for _, devicePoints := range deviceGroups {
		if len(devicePoints) == 0 {
			continue
		}
		
		// Use the first data point to create/get sub-table
		firstPoint := devicePoints[0]
		subTableName, err := s.AutoCreateSubTable(ctx, database, superTable, firstPoint)
		if err != nil {
			return fmt.Errorf("failed to auto-create sub-table for device %s: %w", firstPoint.DeviceID, err)
		}
		
		// Insert all data points for this device
		for _, dp := range devicePoints {
			query := fmt.Sprintf(`
				INSERT INTO %s VALUES ('%s', %v, %d, 1, '%v')`,
				subTableName,
				dp.Timestamp.Format("2006-01-02 15:04:05.000"),
				dp.Value,
				dp.Quality,
				dp.Value,
			)
			
			_, err = s.manager.ExecuteNonQuery(ctx, query)
			if err != nil {
				return fmt.Errorf("failed to insert data point for device %s: %w", dp.DeviceID, err)
			}
		}
	}
	
	return nil
}

// HighPerformanceBatchInsert performs high-performance batch insertion
func (s *TDengineService) HighPerformanceBatchInsert(ctx context.Context, database, superTable string, dataPoints []DataPoint) (*WriteResult, error) {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.WriteData(ctx, database, superTable, dataPoints)
	}
	
	// Fallback to regular data writer
	dataWriter := NewDataWriter(s, DefaultWriterConfig())
	return dataWriter.OptimizedBatchInsert(ctx, database, superTable, dataPoints)
}

// HighPerformanceBatchWrite performs high-performance batch writing
func (s *TDengineService) HighPerformanceBatchWrite(ctx context.Context, batches []BatchData) (*WriteResult, error) {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.WriteBatch(ctx, batches)
	}
	
	// Fallback to regular data writer
	dataWriter := NewDataWriter(s, DefaultWriterConfig())
	return dataWriter.BatchWrite(ctx, batches)
}

// HighPerformanceStreamWrite performs high-performance streaming writes
func (s *TDengineService) HighPerformanceStreamWrite(ctx context.Context, database, superTable string, dataPoints <-chan DataPoint) error {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.WriteStream(ctx, database, superTable, dataPoints)
	}
	
	// Fallback to regular data writer
	dataWriter := NewDataWriter(s, DefaultWriterConfig())
	return dataWriter.StreamWrite(ctx, database, superTable, dataPoints)
}

// CompressDataPoints compresses data points for efficient transmission
func (s *TDengineService) CompressDataPoints(dataPoints []DataPoint) (*CompressedData, error) {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.CompressData(dataPoints)
	}
	
	// Create compressor if not available
	compressor := NewDataCompressor(DefaultCompressionConfig())
	return compressor.CompressDataPoints(dataPoints)
}

// DecompressDataPoints decompresses data points
func (s *TDengineService) DecompressDataPoints(compressed *CompressedData) ([]DataPoint, error) {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.DecompressData(compressed)
	}
	
	// Create compressor if not available
	compressor := NewDataCompressor(DefaultCompressionConfig())
	return compressor.DecompressDataPoints(compressed)
}

// GetWriteMetrics returns comprehensive write performance metrics
func (s *TDengineService) GetWriteMetrics() map[string]interface{} {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.GetDetailedStats()
	}
	
	return map[string]interface{}{
		"high_performance_enabled": false,
		"message": "High-performance writer not configured",
	}
}

// GetWriteHealthStatus returns write system health status
func (s *TDengineService) GetWriteHealthStatus(ctx context.Context) map[string]interface{} {
	if s.highPerfWriter != nil {
		return s.highPerfWriter.HealthCheck(ctx)
	}
	
	return map[string]interface{}{
		"status": "basic",
		"high_performance_enabled": false,
		"timestamp": time.Now(),
	}
}

// GetQuerySystem returns the query system instance
func (s *TDengineService) GetQuerySystem() *QuerySystem {
	return s.querySystem
}

// ExecuteSQL executes a raw SQL query using the query system
func (s *TDengineService) ExecuteSQL(ctx context.Context, req *SQLQueryRequest) (*QueryResult, error) {
	return s.querySystem.ExecuteSQL(ctx, req)
}

// ExecuteStructuredQuery executes a structured query using the query system
func (s *TDengineService) ExecuteStructuredQuery(ctx context.Context, req *StructuredQueryRequest) (*QueryResult, error) {
	return s.querySystem.ExecuteStructuredQuery(ctx, req)
}

// ExecuteAggregationQuery executes an aggregation query using the query system
func (s *TDengineService) ExecuteAggregationQuery(ctx context.Context, req *AggregationQueryRequest) (*QueryResult, error) {
	return s.querySystem.ExecuteAggregationQuery(ctx, req)
}

// ExecuteWithPagination executes a query with pagination using the query system
func (s *TDengineService) ExecuteWithPagination(ctx context.Context, req *StructuredQueryRequest, pagination *PaginationRequest) (*PaginatedResult, error) {
	return s.querySystem.ExecuteWithPagination(ctx, req, pagination)
}

// QueryLatestByTags queries latest data by tag filters using the query system
func (s *TDengineService) QueryLatestByTags(ctx context.Context, database, table string, tags map[string]string, limit int) (*QueryResult, error) {
	return s.querySystem.QueryLatestByTags(ctx, database, table, tags, limit)
}

// QueryTimeRange queries data within a time range using the query system
func (s *TDengineService) QueryTimeRange(ctx context.Context, database, table string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error) {
	return s.querySystem.QueryTimeRange(ctx, database, table, start, end, conditions)
}

// QueryAggregationWithTimeWindow queries aggregated data with time windows using the query system
func (s *TDengineService) QueryAggregationWithTimeWindow(ctx context.Context, database, table, aggFunc, column, interval string, start, end time.Time, conditions map[string]interface{}) (*QueryResult, error) {
	return s.querySystem.QueryAggregationWithTimeWindow(ctx, database, table, aggFunc, column, interval, start, end, conditions)
}

// GetQueryStatistics returns query performance statistics
func (s *TDengineService) GetQueryStatistics() map[string]interface{} {
	return s.querySystem.GetQueryStatistics()
}

// GetQueryCacheStatistics returns query cache statistics
func (s *TDengineService) GetQueryCacheStatistics() map[string]interface{} {
	return s.querySystem.GetCacheStatistics()
}

// ClearQueryCache clears the query cache
func (s *TDengineService) ClearQueryCache() {
	s.querySystem.ClearCache()
}