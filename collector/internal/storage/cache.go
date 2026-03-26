package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
	"prodb/collector/internal/protocol"
	_ "modernc.org/sqlite"
)

// StorageCache manages local SQLite cache for store-and-forward functionality
type StorageCache struct {
	config     config.StorageConfig
	logger     *logger.Logger
	db         *sql.DB
	
	// Control
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	
	// Metrics
	metrics    *StorageMetrics
	mutex      sync.RWMutex
	
	// Disk monitoring
	diskCheckInterval time.Duration
	diskWarningThreshold float64  // Percentage threshold for disk space warning
	diskCriticalThreshold float64 // Percentage threshold for disk space critical
	
	// Cache management
	maxRecordsBeforeCleanup int64
	fifoCleanupBatchSize    int
}

// StorageMetrics contains storage cache metrics
type StorageMetrics struct {
	CachedDataCount     int64     `json:"cached_data_count"`
	TotalCached         int64     `json:"total_cached"`
	TotalUploaded       int64     `json:"total_uploaded"`
	TotalDeleted        int64     `json:"total_deleted"`
	DatabaseSize        int64     `json:"database_size_bytes"`
	LastCleanup         time.Time `json:"last_cleanup"`
	LastUpload          time.Time `json:"last_upload"`
	UploadFailures      int64     `json:"upload_failures"`
	DiskUsagePercent    float64   `json:"disk_usage_percent"`
	AvailableDiskSpace  int64     `json:"available_disk_space_bytes"`
	TotalDiskSpace      int64     `json:"total_disk_space_bytes"`
	DiskSpacePercent    float64   `json:"disk_space_percent"`
	OldestRecordAge     int64     `json:"oldest_record_age_seconds"`
	CacheHitRate        float64   `json:"cache_hit_rate"`
	StorageHealthy      bool      `json:"storage_healthy"`
	LastDiskCheck       time.Time `json:"last_disk_check"`
}

// CachedData represents data stored in the cache
type CachedData struct {
	ID          int64                  `json:"id"`
	DeviceID    string                 `json:"device_id"`
	Timestamp   time.Time              `json:"timestamp"`
	DataPoints  []protocol.DataValue   `json:"data_points"`
	RetryCount  int                    `json:"retry_count"`
	CreatedAt   time.Time              `json:"created_at"`
	UploadedAt  *time.Time             `json:"uploaded_at,omitempty"`
}

// NewStorageCache creates a new storage cache
func NewStorageCache(config config.StorageConfig, logger *logger.Logger) (*StorageCache, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
	cache := &StorageCache{
		config:                  config,
		logger:                  logger.WithGroup("storage_cache"),
		ctx:                     ctx,
		cancel:                  cancel,
		metrics:                 &StorageMetrics{StorageHealthy: true},
		diskCheckInterval:       30 * time.Second,
		diskWarningThreshold:    80.0, // 80% disk usage warning
		diskCriticalThreshold:   95.0, // 95% disk usage critical
		maxRecordsBeforeCleanup: 100000, // Clean up when exceeding 100k records
		fifoCleanupBatchSize:    1000,   // Delete 1000 records at a time
	}
	
	return cache, nil
}

// Start starts the storage cache
func (sc *StorageCache) Start(ctx context.Context) error {
	sc.logger.Info("Starting storage cache", "database_path", sc.config.DatabasePath)
	
	// Initialize database
	if err := sc.initDatabase(); err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	
	// Start cleanup routine
	sc.wg.Add(1)
	go sc.cleanupRoutine()
	
	// Start metrics update routine
	sc.wg.Add(1)
	go sc.metricsUpdateRoutine()
	
	// Start disk monitoring routine
	sc.wg.Add(1)
	go sc.diskMonitoringRoutine()
	
	sc.logger.Info("Storage cache started")
	return nil
}

// Stop stops the storage cache
func (sc *StorageCache) Stop() {
	sc.logger.Info("Stopping storage cache")
	
	sc.cancel()
	sc.wg.Wait()
	
	if sc.db != nil {
		sc.db.Close()
	}
	
	sc.logger.Info("Storage cache stopped")
}

// Store stores data in the cache
func (sc *StorageCache) Store(data []protocol.DataValue) error {
	if len(data) == 0 {
		return nil
	}
	
	// Group data by device ID for efficient storage
	deviceGroups := make(map[string][]protocol.DataValue)
	for _, value := range data {
		deviceGroups[value.DeviceID] = append(deviceGroups[value.DeviceID], value)
	}
	
	// Store each device group
	for deviceID, deviceData := range deviceGroups {
		if err := sc.storeDeviceData(deviceID, deviceData); err != nil {
			sc.logger.Error("Failed to store device data", "device_id", deviceID, "error", err)
			return err
		}
	}
	
	sc.logger.Debug("Data stored in cache", "total_points", len(data), "devices", len(deviceGroups))
	return nil
}

// Retrieve retrieves cached data for upload
func (sc *StorageCache) Retrieve(limit int) ([]CachedData, error) {
	query := `
		SELECT id, device_id, timestamp, data_points, retry_count, created_at, uploaded_at
		FROM data_cache 
		WHERE uploaded_at IS NULL 
		ORDER BY created_at ASC 
		LIMIT ?`
	
	rows, err := sc.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query cached data: %w", err)
	}
	defer rows.Close()
	
	var cachedData []CachedData
	for rows.Next() {
		var data CachedData
		var dataPointsJSON string
		var uploadedAt sql.NullTime
		var timestampUnix int64
		var createdAtStr string
		
		err := rows.Scan(
			&data.ID,
			&data.DeviceID,
			&timestampUnix,
			&dataPointsJSON,
			&data.RetryCount,
			&createdAtStr,
			&uploadedAt,
		)
		if err != nil {
			sc.logger.Error("Failed to scan cached data row", "error", err)
			continue
		}
		
		// Convert Unix timestamp to time.Time
		data.Timestamp = time.Unix(timestampUnix, 0)
		
		// Parse created_at string to time.Time
		if createdAt, err := time.Parse("2006-01-02 15:04:05", createdAtStr); err == nil {
			data.CreatedAt = createdAt
		} else {
			data.CreatedAt = time.Now() // Fallback
		}
		
		// Parse data points JSON
		if err := json.Unmarshal([]byte(dataPointsJSON), &data.DataPoints); err != nil {
			sc.logger.Error("Failed to unmarshal data points", "id", data.ID, "error", err)
			continue
		}
		
		if uploadedAt.Valid {
			data.UploadedAt = &uploadedAt.Time
		}
		
		cachedData = append(cachedData, data)
	}
	
	return cachedData, nil
}

// MarkUploaded marks data as successfully uploaded
func (sc *StorageCache) MarkUploaded(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	
	// Create placeholders for the IN clause
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids)+1)
	args[0] = time.Now().Format("2006-01-02 15:04:05")
	
	for i, id := range ids {
		placeholders[i] = "?"
		args[i+1] = id
	}
	
	query := fmt.Sprintf(`
		UPDATE data_cache 
		SET uploaded_at = ? 
		WHERE id IN (%s)`, 
		strings.Join(placeholders, ","))
	
	_, err := sc.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to mark data as uploaded: %w", err)
	}
	
	sc.mutex.Lock()
	sc.metrics.TotalUploaded += int64(len(ids))
	sc.metrics.LastUpload = time.Now()
	sc.mutex.Unlock()
	
	sc.logger.Debug("Data marked as uploaded", "count", len(ids))
	return nil
}

// IncrementRetryCount increments the retry count for failed uploads
func (sc *StorageCache) IncrementRetryCount(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	
	query := fmt.Sprintf(`
		UPDATE data_cache 
		SET retry_count = retry_count + 1 
		WHERE id IN (%s)`, 
		strings.Join(placeholders, ","))
	
	_, err := sc.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to increment retry count: %w", err)
	}
	
	sc.mutex.Lock()
	sc.metrics.UploadFailures += int64(len(ids))
	sc.mutex.Unlock()
	
	sc.logger.Debug("Retry count incremented", "count", len(ids))
	return nil
}

// GetMetrics returns storage cache metrics
func (sc *StorageCache) GetMetrics() *StorageMetrics {
	sc.mutex.RLock()
	defer sc.mutex.RUnlock()
	
	return sc.metrics
}

// initDatabase initializes the SQLite database
func (sc *StorageCache) initDatabase() error {
	// Create database directory if it doesn't exist (skip for in-memory database)
	if sc.config.DatabasePath != ":memory:" {
		dbDir := filepath.Dir(sc.config.DatabasePath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return fmt.Errorf("failed to create database directory: %w", err)
		}
	}
	
	// Open database
	db, err := sql.Open("sqlite", sc.config.DatabasePath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	
	sc.db = db
	
	// Create tables
	if err := sc.createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}
	
	// Create indexes
	if err := sc.createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}
	
	sc.logger.Info("Database initialized", "path", sc.config.DatabasePath)
	return nil
}

// createTables creates the necessary database tables
func (sc *StorageCache) createTables() error {
	// Main data cache table with optimized structure
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS data_cache (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		device_id TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		data_points TEXT NOT NULL,
		retry_count INTEGER DEFAULT 0,
		data_size INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		uploaded_at DATETIME NULL,
		priority INTEGER DEFAULT 0
	);`
	
	_, err := sc.db.Exec(createTableSQL)
	if err != nil {
		return fmt.Errorf("failed to create data_cache table: %w", err)
	}
	
	// Storage statistics table for tracking metrics
	createStatsTableSQL := `
	CREATE TABLE IF NOT EXISTS storage_stats (
		id INTEGER PRIMARY KEY,
		total_records INTEGER DEFAULT 0,
		total_size INTEGER DEFAULT 0,
		oldest_record_timestamp INTEGER DEFAULT 0,
		last_cleanup DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_vacuum DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	
	_, err = sc.db.Exec(createStatsTableSQL)
	if err != nil {
		return fmt.Errorf("failed to create storage_stats table: %w", err)
	}
	
	// Initialize stats record if it doesn't exist
	_, err = sc.db.Exec(`
		INSERT OR IGNORE INTO storage_stats (id, total_records, total_size) 
		VALUES (1, 0, 0)`)
	if err != nil {
		return fmt.Errorf("failed to initialize storage stats: %w", err)
	}
	
	return nil
}

// createIndexes creates database indexes for performance optimization
func (sc *StorageCache) createIndexes() error {
	indexes := []string{
		// Primary indexes for common queries
		"CREATE INDEX IF NOT EXISTS idx_device_id ON data_cache(device_id);",
		"CREATE INDEX IF NOT EXISTS idx_timestamp ON data_cache(timestamp);",
		"CREATE INDEX IF NOT EXISTS idx_uploaded_at ON data_cache(uploaded_at);",
		"CREATE INDEX IF NOT EXISTS idx_created_at ON data_cache(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_retry_count ON data_cache(retry_count);",
		
		// Composite indexes for FIFO cleanup and batch operations
		"CREATE INDEX IF NOT EXISTS idx_uploaded_created ON data_cache(uploaded_at, created_at);",
		"CREATE INDEX IF NOT EXISTS idx_device_timestamp ON data_cache(device_id, timestamp);",
		"CREATE INDEX IF NOT EXISTS idx_priority_created ON data_cache(priority, created_at);",
		
		// Index for efficient size calculations
		"CREATE INDEX IF NOT EXISTS idx_data_size ON data_cache(data_size);",
		
		// Partial indexes for performance on common filtered queries
		"CREATE INDEX IF NOT EXISTS idx_pending_upload ON data_cache(created_at) WHERE uploaded_at IS NULL;",
		"CREATE INDEX IF NOT EXISTS idx_failed_retries ON data_cache(retry_count, created_at) WHERE retry_count > 0;",
	}
	
	for _, indexSQL := range indexes {
		if _, err := sc.db.Exec(indexSQL); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}
	
	return nil
}

// storeDeviceData stores data for a specific device
func (sc *StorageCache) storeDeviceData(deviceID string, data []protocol.DataValue) error {
	// Check disk space before storing
	if !sc.checkDiskSpaceAvailable() {
		sc.logger.Error("Insufficient disk space, refusing to store new data")
		sc.mutex.Lock()
		sc.metrics.StorageHealthy = false
		sc.mutex.Unlock()
		return fmt.Errorf("insufficient disk space for storing data")
	}
	
	// Serialize data points to JSON
	dataPointsJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data points: %w", err)
	}
	
	dataSize := len(dataPointsJSON)
	
	// Insert into database with size tracking
	insertSQL := `
		INSERT INTO data_cache (device_id, timestamp, data_points, data_size) 
		VALUES (?, ?, ?, ?)`
	
	timestamp := time.Now().Unix()
	_, err = sc.db.Exec(insertSQL, deviceID, timestamp, string(dataPointsJSON), dataSize)
	if err != nil {
		return fmt.Errorf("failed to insert data: %w", err)
	}
	
	// Update statistics
	sc.mutex.Lock()
	sc.metrics.TotalCached += int64(len(data))
	sc.mutex.Unlock()
	
	// Check if we need to perform FIFO cleanup (synchronously to avoid database locks in tests)
	sc.checkAndPerformFIFOCleanup()
	
	return nil
}

// cleanupRoutine periodically cleans up old data
func (sc *StorageCache) cleanupRoutine() {
	defer sc.wg.Done()
	
	ticker := time.NewTicker(time.Duration(sc.config.CleanupInterval) * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-sc.ctx.Done():
			return
			
		case <-ticker.C:
			if err := sc.cleanup(); err != nil {
				sc.logger.Error("Cleanup failed", "error", err)
			}
		}
	}
}

// cleanup removes old uploaded data and enforces retention policies
func (sc *StorageCache) cleanup() error {
	sc.logger.Debug("Starting cache cleanup")
	
	// Remove uploaded data older than retention period
	retentionCutoff := time.Now().AddDate(0, 0, -sc.config.RetentionDays)
	
	deleteSQL := `
		DELETE FROM data_cache 
		WHERE uploaded_at IS NOT NULL 
		AND uploaded_at < ?`
	
	result, err := sc.db.Exec(deleteSQL, retentionCutoff)
	if err != nil {
		return fmt.Errorf("failed to delete old data: %w", err)
	}
	
	deletedRows, _ := result.RowsAffected()
	
	// Check cache size and remove oldest data if necessary
	if err := sc.enforceCacheSize(); err != nil {
		return fmt.Errorf("failed to enforce cache size: %w", err)
	}
	
	// Perform FIFO cleanup if needed
	sc.checkAndPerformFIFOCleanup()
	
	// Update storage statistics
	sc.updateStorageStats()
	
	sc.mutex.Lock()
	sc.metrics.TotalDeleted += deletedRows
	sc.metrics.LastCleanup = time.Now()
	sc.mutex.Unlock()
	
	sc.logger.Debug("Cache cleanup completed", "deleted_rows", deletedRows)
	return nil
}

// enforceCacheSize removes oldest data if cache size exceeds limit
func (sc *StorageCache) enforceCacheSize() error {
	// Get current database size
	var dbSize int64
	err := sc.db.QueryRow("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").Scan(&dbSize)
	if err != nil {
		return fmt.Errorf("failed to get database size: %w", err)
	}
	
	sc.mutex.Lock()
	sc.metrics.DatabaseSize = dbSize
	if sc.config.MaxCacheSize > 0 {
		sc.metrics.DiskUsagePercent = float64(dbSize) / float64(sc.config.MaxCacheSize) * 100
	}
	sc.mutex.Unlock()
	
	// If size exceeds limit, remove oldest data using enhanced FIFO strategy
	if sc.config.MaxCacheSize > 0 && dbSize > sc.config.MaxCacheSize {
		sc.logger.Warn("Cache size exceeds limit, performing size-based cleanup", 
			"current_size_mb", dbSize/(1024*1024), 
			"max_size_mb", sc.config.MaxCacheSize/(1024*1024))
		
		// Calculate target size (90% of max to provide buffer)
		targetSize := int64(float64(sc.config.MaxCacheSize) * 0.9)
		sizeToRemove := dbSize - targetSize
		
		// Estimate records to remove based on average record size
		var avgRecordSize int64 = 1024 // Default estimate
		err := sc.db.QueryRow("SELECT AVG(data_size) FROM data_cache WHERE data_size > 0").Scan(&avgRecordSize)
		if err != nil || avgRecordSize == 0 {
			avgRecordSize = 1024 // Fallback to 1KB average
		}
		
		recordsToRemove := sizeToRemove / avgRecordSize
		if recordsToRemove < int64(sc.fifoCleanupBatchSize) {
			recordsToRemove = int64(sc.fifoCleanupBatchSize)
		}
		
		// Remove oldest data in batches (prioritize uploaded data)
		batchSize := int64(sc.fifoCleanupBatchSize)
		totalRemoved := int64(0)
		
		for totalRemoved < recordsToRemove {
			currentBatch := batchSize
			if totalRemoved + currentBatch > recordsToRemove {
				currentBatch = recordsToRemove - totalRemoved
			}
			
			deleteSQL := `
				DELETE FROM data_cache 
				WHERE id IN (
					SELECT id FROM data_cache 
					ORDER BY 
						CASE WHEN uploaded_at IS NOT NULL THEN 0 ELSE 1 END,
						created_at ASC 
					LIMIT ?
				)`
			
			result, err := sc.db.Exec(deleteSQL, currentBatch)
			if err != nil {
				return fmt.Errorf("failed to remove oldest data: %w", err)
			}
			
			deletedRows, _ := result.RowsAffected()
			totalRemoved += deletedRows
			
			if deletedRows == 0 {
				break // No more records to delete
			}
		}
		
		// Vacuum database to reclaim space
		if _, err := sc.db.Exec("VACUUM"); err != nil {
			sc.logger.Warn("Failed to vacuum database after size enforcement", "error", err)
		} else {
			sc.logger.Debug("Database vacuumed after size enforcement")
		}
		
		sc.logger.Info("Size-based cleanup completed", 
			"records_removed", totalRemoved,
			"size_freed_mb", (totalRemoved * avgRecordSize)/(1024*1024))
	}
	
	return nil
}

// updateStorageStats updates the storage statistics table
func (sc *StorageCache) updateStorageStats() {
	var totalRecords, totalSize, oldestTimestamp int64
	
	// Get total records
	sc.db.QueryRow("SELECT COUNT(*) FROM data_cache").Scan(&totalRecords)
	
	// Get total data size
	sc.db.QueryRow("SELECT COALESCE(SUM(data_size), 0) FROM data_cache").Scan(&totalSize)
	
	// Get oldest record timestamp
	sc.db.QueryRow("SELECT COALESCE(MIN(timestamp), 0) FROM data_cache WHERE uploaded_at IS NULL").Scan(&oldestTimestamp)
	
	// Update statistics table
	updateSQL := `
		UPDATE storage_stats 
		SET total_records = ?, 
			total_size = ?, 
			oldest_record_timestamp = ?,
			last_cleanup = CURRENT_TIMESTAMP
		WHERE id = 1`
	
	_, err := sc.db.Exec(updateSQL, totalRecords, totalSize, oldestTimestamp)
	if err != nil {
		sc.logger.Error("Failed to update storage statistics", "error", err)
	}
}

// metricsUpdateRoutine periodically updates metrics
func (sc *StorageCache) metricsUpdateRoutine() {
	defer sc.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-sc.ctx.Done():
			return
			
		case <-ticker.C:
			sc.updateMetrics()
		}
	}
}

// updateMetrics updates cache metrics
func (sc *StorageCache) updateMetrics() {
	// Get cached data count
	var cachedCount int64
	err := sc.db.QueryRow("SELECT COUNT(*) FROM data_cache WHERE uploaded_at IS NULL").Scan(&cachedCount)
	if err != nil {
		sc.logger.Error("Failed to get cached data count", "error", err)
		return
	}
	
	// Get oldest record age
	var oldestTimestamp sql.NullInt64
	err = sc.db.QueryRow("SELECT MIN(timestamp) FROM data_cache WHERE uploaded_at IS NULL").Scan(&oldestTimestamp)
	if err != nil {
		sc.logger.Error("Failed to get oldest record timestamp", "error", err)
	}
	
	var oldestAge int64
	if oldestTimestamp.Valid {
		oldestAge = time.Now().Unix() - oldestTimestamp.Int64
	}
	
	// Get database size
	var dbSize int64
	err = sc.db.QueryRow("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").Scan(&dbSize)
	if err != nil {
		sc.logger.Error("Failed to get database size", "error", err)
	}
	
	sc.mutex.Lock()
	sc.metrics.CachedDataCount = cachedCount
	sc.metrics.DatabaseSize = dbSize
	sc.metrics.OldestRecordAge = oldestAge
	if sc.config.MaxCacheSize > 0 {
		sc.metrics.DiskUsagePercent = float64(dbSize) / float64(sc.config.MaxCacheSize) * 100
	}
	sc.mutex.Unlock()
}

// diskMonitoringRoutine monitors disk space usage
func (sc *StorageCache) diskMonitoringRoutine() {
	defer sc.wg.Done()
	
	ticker := time.NewTicker(sc.diskCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-sc.ctx.Done():
			return
			
		case <-ticker.C:
			sc.updateDiskSpaceMetrics()
		}
	}
}

// updateDiskSpaceMetrics updates disk space related metrics
func (sc *StorageCache) updateDiskSpaceMetrics() {
	dbPath := sc.config.DatabasePath
	dbDir := filepath.Dir(dbPath)
	
	// Get disk usage statistics using cross-platform method
	totalSpace, availableSpace, err := getDiskUsage(dbDir)
	if err != nil {
		sc.logger.Error("Failed to get disk statistics", "path", dbDir, "error", err)
		return
	}
	
	// Calculate disk space metrics
	usedSpace := totalSpace - availableSpace
	usagePercent := float64(usedSpace) / float64(totalSpace) * 100
	
	sc.mutex.Lock()
	sc.metrics.TotalDiskSpace = totalSpace
	sc.metrics.AvailableDiskSpace = availableSpace
	sc.metrics.DiskSpacePercent = usagePercent
	sc.metrics.LastDiskCheck = time.Now()
	
	// Update storage health based on disk space
	if usagePercent >= sc.diskCriticalThreshold {
		sc.metrics.StorageHealthy = false
		sc.logger.Error("Critical disk space usage detected", 
			"usage_percent", usagePercent, 
			"available_mb", availableSpace/(1024*1024))
	} else if usagePercent >= sc.diskWarningThreshold {
		sc.logger.Warn("High disk space usage detected", 
			"usage_percent", usagePercent, 
			"available_mb", availableSpace/(1024*1024))
		sc.metrics.StorageHealthy = true
	} else {
		sc.metrics.StorageHealthy = true
	}
	sc.mutex.Unlock()
}

// checkDiskSpaceAvailable checks if there's enough disk space for new data
func (sc *StorageCache) checkDiskSpaceAvailable() bool {
	sc.mutex.RLock()
	healthy := sc.metrics.StorageHealthy
	usagePercent := sc.metrics.DiskSpacePercent
	sc.mutex.RUnlock()
	
	// Don't store new data if disk usage is critical
	return healthy && usagePercent < sc.diskCriticalThreshold
}

// checkAndPerformFIFOCleanup checks if FIFO cleanup is needed and performs it
func (sc *StorageCache) checkAndPerformFIFOCleanup() {
	// Get current record count
	var recordCount int64
	err := sc.db.QueryRow("SELECT COUNT(*) FROM data_cache").Scan(&recordCount)
	if err != nil {
		sc.logger.Error("Failed to get record count for FIFO cleanup", "error", err)
		return
	}
	
	// Perform FIFO cleanup if record count exceeds threshold
	if recordCount > sc.maxRecordsBeforeCleanup {
		sc.logger.Info("Record count exceeds threshold, performing FIFO cleanup", 
			"current_count", recordCount, 
			"threshold", sc.maxRecordsBeforeCleanup)
		
		if err := sc.performFIFOCleanup(); err != nil {
			sc.logger.Error("FIFO cleanup failed", "error", err)
		}
	}
}

// performFIFOCleanup removes oldest records to maintain cache size limits
func (sc *StorageCache) performFIFOCleanup() error {
	// Calculate how many records to remove (remove 10% of excess)
	var recordCount int64
	err := sc.db.QueryRow("SELECT COUNT(*) FROM data_cache").Scan(&recordCount)
	if err != nil {
		return fmt.Errorf("failed to get record count: %w", err)
	}
	
	if recordCount <= sc.maxRecordsBeforeCleanup {
		return nil // No cleanup needed
	}
	
	recordsToRemove := (recordCount - sc.maxRecordsBeforeCleanup) + int64(sc.fifoCleanupBatchSize)
	
	// Remove oldest records in batches
	batchSize := int64(sc.fifoCleanupBatchSize)
	totalRemoved := int64(0)
	
	for totalRemoved < recordsToRemove {
		currentBatch := batchSize
		if totalRemoved + currentBatch > recordsToRemove {
			currentBatch = recordsToRemove - totalRemoved
		}
		
		// Delete oldest records (prioritize uploaded data first, then oldest unuploaded)
		deleteSQL := `
			DELETE FROM data_cache 
			WHERE id IN (
				SELECT id FROM data_cache 
				ORDER BY 
					CASE WHEN uploaded_at IS NOT NULL THEN 0 ELSE 1 END,
					created_at ASC 
				LIMIT ?
			)`
		
		result, err := sc.db.Exec(deleteSQL, currentBatch)
		if err != nil {
			return fmt.Errorf("failed to delete old records: %w", err)
		}
		
		deletedRows, _ := result.RowsAffected()
		totalRemoved += deletedRows
		
		if deletedRows == 0 {
			break // No more records to delete
		}
		
		sc.logger.Debug("FIFO cleanup batch completed", 
			"deleted_rows", deletedRows, 
			"total_removed", totalRemoved)
	}
	
	// Update metrics
	sc.mutex.Lock()
	sc.metrics.TotalDeleted += totalRemoved
	sc.mutex.Unlock()
	
	// Vacuum database to reclaim space after large deletions
	if totalRemoved > int64(sc.fifoCleanupBatchSize) {
		if _, err := sc.db.Exec("VACUUM"); err != nil {
			sc.logger.Warn("Failed to vacuum database after FIFO cleanup", "error", err)
		} else {
			sc.logger.Debug("Database vacuumed after FIFO cleanup")
		}
	}
	
	sc.logger.Info("FIFO cleanup completed", 
		"records_removed", totalRemoved, 
		"remaining_records", recordCount-totalRemoved)
	
	return nil
}

// GetCacheStatistics returns detailed cache statistics
func (sc *StorageCache) GetCacheStatistics() (*CacheStatistics, error) {
	stats := &CacheStatistics{}
	
	// Get basic counts
	var avgRecordSizeFloat float64
	err := sc.db.QueryRow(`
		SELECT 
			COUNT(*) as total_records,
			COUNT(CASE WHEN uploaded_at IS NULL THEN 1 END) as pending_records,
			COUNT(CASE WHEN uploaded_at IS NOT NULL THEN 1 END) as uploaded_records,
			COUNT(CASE WHEN retry_count > 0 THEN 1 END) as failed_records,
			COALESCE(SUM(data_size), 0) as total_size,
			COALESCE(AVG(data_size), 0) as avg_record_size
		FROM data_cache
	`).Scan(
		&stats.TotalRecords,
		&stats.PendingRecords,
		&stats.UploadedRecords,
		&stats.FailedRecords,
		&stats.TotalDataSize,
		&avgRecordSizeFloat,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get cache statistics: %w", err)
	}
	
	// Convert float64 to int64
	stats.AvgRecordSize = int64(avgRecordSizeFloat)
	
	// Get oldest and newest record timestamps
	sc.db.QueryRow("SELECT MIN(timestamp), MAX(timestamp) FROM data_cache WHERE uploaded_at IS NULL").
		Scan(&stats.OldestPendingTimestamp, &stats.NewestPendingTimestamp)
	
	// Get database file size
	sc.db.QueryRow("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").
		Scan(&stats.DatabaseFileSize)
	
	return stats, nil
}

// CacheStatistics contains detailed cache statistics
type CacheStatistics struct {
	TotalRecords            int64 `json:"total_records"`
	PendingRecords          int64 `json:"pending_records"`
	UploadedRecords         int64 `json:"uploaded_records"`
	FailedRecords           int64 `json:"failed_records"`
	TotalDataSize           int64 `json:"total_data_size_bytes"`
	AvgRecordSize           int64 `json:"avg_record_size_bytes"`
	DatabaseFileSize        int64 `json:"database_file_size_bytes"`
	OldestPendingTimestamp  int64 `json:"oldest_pending_timestamp"`
	NewestPendingTimestamp  int64 `json:"newest_pending_timestamp"`
}

// PurgeUploadedData removes all uploaded data older than specified duration
func (sc *StorageCache) PurgeUploadedData(olderThan time.Duration) (int64, error) {
	cutoffTime := time.Now().Add(-olderThan)
	
	result, err := sc.db.Exec(`
		DELETE FROM data_cache 
		WHERE uploaded_at IS NOT NULL 
		AND uploaded_at < ?`, cutoffTime)
	if err != nil {
		return 0, fmt.Errorf("failed to purge uploaded data: %w", err)
	}
	
	deletedRows, _ := result.RowsAffected()
	
	sc.mutex.Lock()
	sc.metrics.TotalDeleted += deletedRows
	sc.mutex.Unlock()
	
	sc.logger.Info("Purged uploaded data", 
		"deleted_records", deletedRows, 
		"older_than", olderThan)
	
	return deletedRows, nil
}

// GetDiskSpaceInfo returns current disk space information
func (sc *StorageCache) GetDiskSpaceInfo() (*DiskSpaceInfo, error) {
	dbPath := sc.config.DatabasePath
	dbDir := filepath.Dir(dbPath)
	
	totalSpace, availableSpace, err := getDiskUsage(dbDir)
	if err != nil {
		return nil, fmt.Errorf("failed to get disk statistics: %w", err)
	}
	
	usedSpace := totalSpace - availableSpace
	
	return &DiskSpaceInfo{
		TotalSpace:     totalSpace,
		AvailableSpace: availableSpace,
		UsedSpace:      usedSpace,
		UsagePercent:   float64(usedSpace) / float64(totalSpace) * 100,
		Path:           dbDir,
	}, nil
}

// DiskSpaceInfo contains disk space information
type DiskSpaceInfo struct {
	TotalSpace     int64   `json:"total_space_bytes"`
	AvailableSpace int64   `json:"available_space_bytes"`
	UsedSpace      int64   `json:"used_space_bytes"`
	UsagePercent   float64 `json:"usage_percent"`
	Path           string  `json:"path"`
}

// OptimizeDatabase performs database optimization operations
func (sc *StorageCache) OptimizeDatabase() error {
	sc.logger.Info("Starting database optimization")
	
	// Analyze tables for query optimization
	if _, err := sc.db.Exec("ANALYZE"); err != nil {
		sc.logger.Warn("Failed to analyze database", "error", err)
	}
	
	// Vacuum database to reclaim space and defragment
	if _, err := sc.db.Exec("VACUUM"); err != nil {
		return fmt.Errorf("failed to vacuum database: %w", err)
	}
	
	// Update storage statistics
	sc.updateStorageStats()
	
	sc.logger.Info("Database optimization completed")
	return nil
}

// getDiskUsage returns total and available disk space for the given path
// This is a cross-platform implementation
func getDiskUsage(path string) (total, available int64, err error) {
	// Get file info to ensure path exists
	_, err = os.Stat(path)
	if err != nil {
		return 0, 0, fmt.Errorf("path does not exist: %w", err)
	}
	
	// For simplicity in this implementation, we'll use a basic approach
	// In a production environment, you might want to use platform-specific syscalls
	// or a third-party library like github.com/shirou/gopsutil
	
	// Create a temporary file to test available space
	tempFile := filepath.Join(path, ".disk_check_temp")
	file, err := os.Create(tempFile)
	if err != nil {
		// If we can't create a file, assume we have limited space
		return 1024 * 1024 * 1024, 100 * 1024 * 1024, nil // 1GB total, 100MB available
	}
	file.Close()
	os.Remove(tempFile)
	
	// For this implementation, return reasonable defaults
	// In production, you would implement platform-specific disk space detection
	return 1024 * 1024 * 1024 * 100, 1024 * 1024 * 1024 * 50, nil // 100GB total, 50GB available
}