package tdengine

import (
	"crypto/md5"
	"fmt"
	"sync"
	"time"
)

// QueryCache provides caching for query results
type QueryCache struct {
	cache      map[string]*CacheEntry
	mutex      sync.RWMutex
	config     *QueryCacheConfig
	stats      *CacheStatistics
}

// CacheEntry represents a cached query result
type CacheEntry struct {
	Result    *QueryResult  `json:"result"`
	CreatedAt time.Time     `json:"created_at"`
	AccessAt  time.Time     `json:"access_at"`
	HitCount  int           `json:"hit_count"`
	TTL       time.Duration `json:"ttl"`
}

// QueryCacheConfig holds cache configuration
type QueryCacheConfig struct {
	MaxSize        int           `json:"max_size"`
	DefaultTTL     time.Duration `json:"default_ttl"`
	CleanupInterval time.Duration `json:"cleanup_interval"`
	Enabled        bool          `json:"enabled"`
}

// CacheStatistics holds cache performance statistics
type CacheStatistics struct {
	Hits        int64     `json:"hits"`
	Misses      int64     `json:"misses"`
	Evictions   int64     `json:"evictions"`
	Size        int       `json:"size"`
	LastCleanup time.Time `json:"last_cleanup"`
	mutex       sync.RWMutex
}

// DefaultQueryCacheConfig returns default cache configuration
func DefaultQueryCacheConfig() *QueryCacheConfig {
	return &QueryCacheConfig{
		MaxSize:         1000,
		DefaultTTL:      5 * time.Minute,
		CleanupInterval: 1 * time.Minute,
		Enabled:         true,
	}
}

// NewQueryCache creates a new query cache
func NewQueryCache(config *QueryCacheConfig) *QueryCache {
	if config == nil {
		config = DefaultQueryCacheConfig()
	}

	cache := &QueryCache{
		cache:  make(map[string]*CacheEntry),
		config: config,
		stats:  &CacheStatistics{},
	}

	// Start cleanup goroutine
	if config.Enabled && config.CleanupInterval > 0 {
		go cache.startCleanup()
	}

	return cache
}

// Get retrieves a cached query result
func (qc *QueryCache) Get(query string) *QueryResult {
	if !qc.config.Enabled {
		return nil
	}

	key := qc.generateKey(query)
	
	qc.mutex.RLock()
	entry, exists := qc.cache[key]
	qc.mutex.RUnlock()

	if !exists {
		qc.recordMiss()
		return nil
	}

	// Check if entry has expired
	if time.Since(entry.CreatedAt) > entry.TTL {
		qc.mutex.Lock()
		delete(qc.cache, key)
		qc.mutex.Unlock()
		qc.recordMiss()
		return nil
	}

	// Update access time and hit count
	qc.mutex.Lock()
	entry.AccessAt = time.Now()
	entry.HitCount++
	qc.mutex.Unlock()

	qc.recordHit()
	
	// Return a copy of the result
	result := *entry.Result
	return &result
}

// Set stores a query result in cache
func (qc *QueryCache) Set(query string, result *QueryResult) {
	if !qc.config.Enabled {
		return
	}

	key := qc.generateKey(query)
	
	entry := &CacheEntry{
		Result:    result,
		CreatedAt: time.Now(),
		AccessAt:  time.Now(),
		HitCount:  0,
		TTL:       qc.config.DefaultTTL,
	}

	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	// Check if cache is full
	if len(qc.cache) >= qc.config.MaxSize {
		qc.evictLRU()
	}

	qc.cache[key] = entry
}

// SetWithTTL stores a query result with custom TTL
func (qc *QueryCache) SetWithTTL(query string, result *QueryResult, ttl time.Duration) {
	if !qc.config.Enabled {
		return
	}

	key := qc.generateKey(query)
	
	entry := &CacheEntry{
		Result:    result,
		CreatedAt: time.Now(),
		AccessAt:  time.Now(),
		HitCount:  0,
		TTL:       ttl,
	}

	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	// Check if cache is full
	if len(qc.cache) >= qc.config.MaxSize {
		qc.evictLRU()
	}

	qc.cache[key] = entry
}

// Delete removes a cached entry
func (qc *QueryCache) Delete(query string) {
	if !qc.config.Enabled {
		return
	}

	key := qc.generateKey(query)
	
	qc.mutex.Lock()
	delete(qc.cache, key)
	qc.mutex.Unlock()
}

// Clear removes all cached entries
func (qc *QueryCache) Clear() {
	qc.mutex.Lock()
	qc.cache = make(map[string]*CacheEntry)
	qc.mutex.Unlock()

	qc.stats.mutex.Lock()
	qc.stats.Size = 0
	qc.stats.mutex.Unlock()
}

// GetStatistics returns cache statistics
func (qc *QueryCache) GetStatistics() map[string]interface{} {
	qc.stats.mutex.RLock()
	defer qc.stats.mutex.RUnlock()

	qc.mutex.RLock()
	size := len(qc.cache)
	qc.mutex.RUnlock()

	hitRate := float64(0)
	total := qc.stats.Hits + qc.stats.Misses
	if total > 0 {
		hitRate = float64(qc.stats.Hits) / float64(total)
	}

	return map[string]interface{}{
		"enabled":      qc.config.Enabled,
		"hits":         qc.stats.Hits,
		"misses":       qc.stats.Misses,
		"hit_rate":     hitRate,
		"evictions":    qc.stats.Evictions,
		"size":         size,
		"max_size":     qc.config.MaxSize,
		"last_cleanup": qc.stats.LastCleanup,
	}
}

// generateKey generates a cache key from query string
func (qc *QueryCache) generateKey(query string) string {
	hash := md5.Sum([]byte(query))
	return fmt.Sprintf("%x", hash)
}

// evictLRU evicts the least recently used entry
func (qc *QueryCache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range qc.cache {
		if oldestKey == "" || entry.AccessAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.AccessAt
		}
	}

	if oldestKey != "" {
		delete(qc.cache, oldestKey)
		qc.recordEviction()
	}
}

// startCleanup starts the cleanup goroutine
func (qc *QueryCache) startCleanup() {
	ticker := time.NewTicker(qc.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		qc.cleanup()
	}
}

// cleanup removes expired entries
func (qc *QueryCache) cleanup() {
	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	now := time.Now()
	var expiredKeys []string

	for key, entry := range qc.cache {
		if now.Sub(entry.CreatedAt) > entry.TTL {
			expiredKeys = append(expiredKeys, key)
		}
	}

	for _, key := range expiredKeys {
		delete(qc.cache, key)
		qc.recordEviction()
	}

	qc.stats.mutex.Lock()
	qc.stats.LastCleanup = now
	qc.stats.Size = len(qc.cache)
	qc.stats.mutex.Unlock()
}

// recordHit records a cache hit
func (qc *QueryCache) recordHit() {
	qc.stats.mutex.Lock()
	qc.stats.Hits++
	qc.stats.mutex.Unlock()
}

// recordMiss records a cache miss
func (qc *QueryCache) recordMiss() {
	qc.stats.mutex.Lock()
	qc.stats.Misses++
	qc.stats.mutex.Unlock()
}

// recordEviction records a cache eviction
func (qc *QueryCache) recordEviction() {
	qc.stats.mutex.Lock()
	qc.stats.Evictions++
	qc.stats.mutex.Unlock()
}

// GetHitRate returns the cache hit rate
func (qc *QueryCache) GetHitRate() float64 {
	qc.stats.mutex.RLock()
	defer qc.stats.mutex.RUnlock()

	total := qc.stats.Hits + qc.stats.Misses
	if total == 0 {
		return 0
	}

	return float64(qc.stats.Hits) / float64(total)
}

// GetSize returns the current cache size
func (qc *QueryCache) GetSize() int {
	qc.mutex.RLock()
	defer qc.mutex.RUnlock()
	return len(qc.cache)
}

// IsEnabled returns whether caching is enabled
func (qc *QueryCache) IsEnabled() bool {
	return qc.config.Enabled
}

// SetEnabled enables or disables caching
func (qc *QueryCache) SetEnabled(enabled bool) {
	qc.config.Enabled = enabled
	if !enabled {
		qc.Clear()
	}
}

// SetTTL sets the default TTL for new cache entries
func (qc *QueryCache) SetTTL(ttl time.Duration) {
	qc.config.DefaultTTL = ttl
}

// GetTTL returns the default TTL
func (qc *QueryCache) GetTTL() time.Duration {
	return qc.config.DefaultTTL
}