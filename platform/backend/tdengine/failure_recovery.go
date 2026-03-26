package tdengine

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// FailureRecovery handles write failure recovery and data persistence
type FailureRecovery struct {
	dataWriter     *DataWriter
	recoveryDir    string
	maxRetries     int
	retryInterval  time.Duration
	maxFileSize    int64
	mu             sync.RWMutex
	recoveryQueue  chan *FailedWrite
	isRunning      bool
	stopChan       chan struct{}
	wg             sync.WaitGroup
}

// FailedWrite represents a failed write operation that needs recovery
type FailedWrite struct {
	ID          string      `json:"id"`
	Database    string      `json:"database"`
	SuperTable  string      `json:"super_table"`
	DataPoints  []DataPoint `json:"data_points"`
	FailedAt    time.Time   `json:"failed_at"`
	RetryCount  int         `json:"retry_count"`
	LastError   string      `json:"last_error"`
	Priority    int         `json:"priority"` // Higher priority = retry first
}

// RecoveryConfig configures the failure recovery system
type RecoveryConfig struct {
	RecoveryDir     string        `json:"recovery_dir"`
	MaxRetries      int           `json:"max_retries"`
	RetryInterval   time.Duration `json:"retry_interval"`
	MaxFileSize     int64         `json:"max_file_size"`
	QueueSize       int           `json:"queue_size"`
	WorkerCount     int           `json:"worker_count"`
	CleanupInterval time.Duration `json:"cleanup_interval"`
}

// DefaultRecoveryConfig returns default recovery configuration
func DefaultRecoveryConfig() *RecoveryConfig {
	return &RecoveryConfig{
		RecoveryDir:     "./recovery",
		MaxRetries:      5,
		RetryInterval:   30 * time.Second,
		MaxFileSize:     100 * 1024 * 1024, // 100MB
		QueueSize:       1000,
		WorkerCount:     3,
		CleanupInterval: 1 * time.Hour,
	}
}

// NewFailureRecovery creates a new failure recovery system
func NewFailureRecovery(dataWriter *DataWriter, config *RecoveryConfig) (*FailureRecovery, error) {
	if config == nil {
		config = DefaultRecoveryConfig()
	}

	// Create recovery directory if it doesn't exist
	if err := os.MkdirAll(config.RecoveryDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create recovery directory: %w", err)
	}

	fr := &FailureRecovery{
		dataWriter:    dataWriter,
		recoveryDir:   config.RecoveryDir,
		maxRetries:    config.MaxRetries,
		retryInterval: config.RetryInterval,
		maxFileSize:   config.MaxFileSize,
		recoveryQueue: make(chan *FailedWrite, config.QueueSize),
		stopChan:      make(chan struct{}),
	}

	return fr, nil
}

// Start starts the failure recovery system
func (fr *FailureRecovery) Start(ctx context.Context) error {
	fr.mu.Lock()
	if fr.isRunning {
		fr.mu.Unlock()
		return fmt.Errorf("failure recovery is already running")
	}
	fr.isRunning = true
	fr.mu.Unlock()

	// Load existing failed writes from disk
	if err := fr.loadFailedWrites(); err != nil {
		return fmt.Errorf("failed to load existing failed writes: %w", err)
	}

	// Start recovery workers
	for i := 0; i < 3; i++ { // Default 3 workers
		fr.wg.Add(1)
		go fr.recoveryWorker(ctx)
	}

	// Start cleanup worker
	fr.wg.Add(1)
	go fr.cleanupWorker(ctx)

	return nil
}

// Stop stops the failure recovery system
func (fr *FailureRecovery) Stop() error {
	fr.mu.Lock()
	if !fr.isRunning {
		fr.mu.Unlock()
		return nil
	}
	fr.isRunning = false
	fr.mu.Unlock()

	close(fr.stopChan)
	fr.wg.Wait()
	close(fr.recoveryQueue)

	return nil
}

// RecordFailure records a failed write operation for later recovery
func (fr *FailureRecovery) RecordFailure(database, superTable string, dataPoints []DataPoint, err error) error {
	failedWrite := &FailedWrite{
		ID:         fr.generateID(),
		Database:   database,
		SuperTable: superTable,
		DataPoints: dataPoints,
		FailedAt:   time.Now(),
		RetryCount: 0,
		LastError:  err.Error(),
		Priority:   fr.calculatePriority(dataPoints),
	}

	// Try to add to queue first
	select {
	case fr.recoveryQueue <- failedWrite:
		return nil
	default:
		// Queue is full, persist to disk
		return fr.persistFailedWrite(failedWrite)
	}
}

// RetryFailedWrite attempts to retry a specific failed write
func (fr *FailureRecovery) RetryFailedWrite(ctx context.Context, failedWrite *FailedWrite) error {
	if failedWrite.RetryCount >= fr.maxRetries {
		return fmt.Errorf("maximum retry count exceeded for write %s", failedWrite.ID)
	}

	// Increment retry count
	failedWrite.RetryCount++

	// Attempt the write
	result, err := fr.dataWriter.OptimizedBatchInsert(ctx, failedWrite.Database, failedWrite.SuperTable, failedWrite.DataPoints)
	if err != nil {
		failedWrite.LastError = err.Error()
		
		// If still failing and under retry limit, schedule for later retry
		if failedWrite.RetryCount < fr.maxRetries {
			go func() {
				time.Sleep(fr.retryInterval)
				select {
				case fr.recoveryQueue <- failedWrite:
				case <-fr.stopChan:
				}
			}()
		} else {
			// Max retries exceeded, persist to disk for manual intervention
			fr.persistFailedWrite(failedWrite)
		}
		
		return fmt.Errorf("retry failed for write %s (attempt %d/%d): %w", 
			failedWrite.ID, failedWrite.RetryCount, fr.maxRetries, err)
	}

	// Success - remove from recovery if it was persisted
	fr.removePersistedWrite(failedWrite.ID)
	
	fmt.Printf("Successfully recovered failed write %s after %d retries, wrote %d records\n", 
		failedWrite.ID, failedWrite.RetryCount, result.RecordsWritten)
	
	return nil
}

// GetFailureStats returns statistics about failed writes and recovery
func (fr *FailureRecovery) GetFailureStats() map[string]interface{} {
	fr.mu.RLock()
	defer fr.mu.RUnlock()

	queueLength := len(fr.recoveryQueue)
	persistedCount := fr.countPersistedWrites()

	return map[string]interface{}{
		"queue_length":     queueLength,
		"persisted_count":  persistedCount,
		"is_running":       fr.isRunning,
		"max_retries":      fr.maxRetries,
		"retry_interval":   fr.retryInterval.String(),
	}
}

// ListFailedWrites returns a list of all failed writes (both queued and persisted)
func (fr *FailureRecovery) ListFailedWrites() ([]*FailedWrite, error) {
	var allFailed []*FailedWrite

	// Get queued writes
	fr.mu.RLock()
	queuedWrites := make([]*FailedWrite, 0, len(fr.recoveryQueue))
	for {
		select {
		case fw := <-fr.recoveryQueue:
			queuedWrites = append(queuedWrites, fw)
		default:
			goto done
		}
	}
done:
	// Put them back in the queue
	for _, fw := range queuedWrites {
		fr.recoveryQueue <- fw
	}
	fr.mu.RUnlock()

	allFailed = append(allFailed, queuedWrites...)

	// Get persisted writes
	persistedWrites, err := fr.loadPersistedWrites()
	if err != nil {
		return allFailed, fmt.Errorf("failed to load persisted writes: %w", err)
	}

	allFailed = append(allFailed, persistedWrites...)
	return allFailed, nil
}

// Private methods

func (fr *FailureRecovery) recoveryWorker(ctx context.Context) {
	defer fr.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case <-fr.stopChan:
			return
		case failedWrite := <-fr.recoveryQueue:
			if failedWrite == nil {
				continue
			}

			err := fr.RetryFailedWrite(ctx, failedWrite)
			if err != nil {
				fmt.Printf("Recovery worker failed to retry write %s: %v\n", failedWrite.ID, err)
			}
		}
	}
}

func (fr *FailureRecovery) cleanupWorker(ctx context.Context) {
	defer fr.wg.Done()

	ticker := time.NewTicker(1 * time.Hour) // Cleanup every hour
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-fr.stopChan:
			return
		case <-ticker.C:
			fr.cleanupOldFiles()
		}
	}
}

func (fr *FailureRecovery) generateID() string {
	return fmt.Sprintf("fw_%d_%d", time.Now().UnixNano(), time.Now().Nanosecond())
}

func (fr *FailureRecovery) calculatePriority(dataPoints []DataPoint) int {
	// Higher priority for more recent data and critical devices
	priority := 1
	
	if len(dataPoints) > 0 {
		// More recent data gets higher priority
		age := time.Since(dataPoints[0].Timestamp)
		if age < 1*time.Hour {
			priority += 3
		} else if age < 24*time.Hour {
			priority += 2
		} else {
			priority += 1
		}
		
		// More data points get higher priority
		if len(dataPoints) > 100 {
			priority += 2
		} else if len(dataPoints) > 10 {
			priority += 1
		}
	}
	
	return priority
}

func (fr *FailureRecovery) persistFailedWrite(failedWrite *FailedWrite) error {
	filename := filepath.Join(fr.recoveryDir, fmt.Sprintf("%s.json", failedWrite.ID))
	
	data, err := json.MarshalIndent(failedWrite, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal failed write: %w", err)
	}
	
	err = os.WriteFile(filename, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write recovery file: %w", err)
	}
	
	return nil
}

func (fr *FailureRecovery) removePersistedWrite(id string) error {
	filename := filepath.Join(fr.recoveryDir, fmt.Sprintf("%s.json", id))
	err := os.Remove(filename)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove recovery file: %w", err)
	}
	return nil
}

func (fr *FailureRecovery) loadFailedWrites() error {
	files, err := filepath.Glob(filepath.Join(fr.recoveryDir, "*.json"))
	if err != nil {
		return fmt.Errorf("failed to list recovery files: %w", err)
	}

	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			fmt.Printf("Failed to read recovery file %s: %v\n", file, err)
			continue
		}

		var failedWrite FailedWrite
		err = json.Unmarshal(data, &failedWrite)
		if err != nil {
			fmt.Printf("Failed to unmarshal recovery file %s: %v\n", file, err)
			continue
		}

		// Add to recovery queue if not at max retries
		if failedWrite.RetryCount < fr.maxRetries {
			select {
			case fr.recoveryQueue <- &failedWrite:
			default:
				// Queue is full, leave on disk
				fmt.Printf("Recovery queue full, leaving %s on disk\n", failedWrite.ID)
			}
		}
	}

	return nil
}

func (fr *FailureRecovery) loadPersistedWrites() ([]*FailedWrite, error) {
	files, err := filepath.Glob(filepath.Join(fr.recoveryDir, "*.json"))
	if err != nil {
		return nil, fmt.Errorf("failed to list recovery files: %w", err)
	}

	var writes []*FailedWrite
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			continue
		}

		var failedWrite FailedWrite
		err = json.Unmarshal(data, &failedWrite)
		if err != nil {
			continue
		}

		writes = append(writes, &failedWrite)
	}

	return writes, nil
}

func (fr *FailureRecovery) countPersistedWrites() int {
	files, err := filepath.Glob(filepath.Join(fr.recoveryDir, "*.json"))
	if err != nil {
		return 0
	}
	return len(files)
}

func (fr *FailureRecovery) cleanupOldFiles() {
	files, err := filepath.Glob(filepath.Join(fr.recoveryDir, "*.json"))
	if err != nil {
		return
	}

	cutoff := time.Now().Add(-7 * 24 * time.Hour) // 7 days old

	for _, file := range files {
		info, err := os.Stat(file)
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			os.Remove(file)
			fmt.Printf("Cleaned up old recovery file: %s\n", file)
		}
	}
}