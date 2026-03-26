package tdengine

import (
	"fmt"
	"testing"
	"time"
)

func TestQueryCache_GetSet(t *testing.T) {
	cache := NewQueryCache(nil)

	query := "SELECT * FROM test_table"
	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows: []map[string]interface{}{
			{"ts": "2024-01-01 00:00:00", "value": 25.5},
		},
		Count: 1,
	}

	// Test cache miss
	cached := cache.Get(query)
	if cached != nil {
		t.Errorf("Get() expected nil for cache miss, got %v", cached)
	}

	// Test cache set and hit
	cache.Set(query, result)
	cached = cache.Get(query)
	if cached == nil {
		t.Errorf("Get() expected cached result, got nil")
	}

	if cached.Count != result.Count {
		t.Errorf("Get() count = %d, want %d", cached.Count, result.Count)
	}
}

func TestQueryCache_TTL(t *testing.T) {
	config := &QueryCacheConfig{
		MaxSize:         100,
		DefaultTTL:      100 * time.Millisecond,
		CleanupInterval: 50 * time.Millisecond,
		Enabled:         true,
	}
	cache := NewQueryCache(config)

	query := "SELECT * FROM test_table"
	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Set cache entry
	cache.Set(query, result)

	// Should be available immediately
	cached := cache.Get(query)
	if cached == nil {
		t.Errorf("Get() expected cached result immediately after set, got nil")
	}

	// Wait for TTL to expire
	time.Sleep(150 * time.Millisecond)

	// Should be expired now
	cached = cache.Get(query)
	if cached != nil {
		t.Errorf("Get() expected nil after TTL expiry, got %v", cached)
	}
}

func TestQueryCache_SetWithTTL(t *testing.T) {
	cache := NewQueryCache(nil)

	query := "SELECT * FROM test_table"
	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	customTTL := 200 * time.Millisecond
	cache.SetWithTTL(query, result, customTTL)

	// Should be available immediately
	cached := cache.Get(query)
	if cached == nil {
		t.Errorf("Get() expected cached result immediately after SetWithTTL, got nil")
	}

	// Wait for custom TTL to expire
	time.Sleep(250 * time.Millisecond)

	// Should be expired now
	cached = cache.Get(query)
	if cached != nil {
		t.Errorf("Get() expected nil after custom TTL expiry, got %v", cached)
	}
}

func TestQueryCache_MaxSize(t *testing.T) {
	config := &QueryCacheConfig{
		MaxSize:         2,
		DefaultTTL:      1 * time.Hour,
		CleanupInterval: 0, // Disable cleanup for this test
		Enabled:         true,
	}
	cache := NewQueryCache(config)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Fill cache to max size
	cache.Set("query1", result)
	cache.Set("query2", result)

	// Both should be cached
	if cache.Get("query1") == nil {
		t.Errorf("Get() expected query1 to be cached")
	}
	if cache.Get("query2") == nil {
		t.Errorf("Get() expected query2 to be cached")
	}

	// Add one more - should evict LRU
	cache.Set("query3", result)

	// query1 should be evicted (LRU), query2 and query3 should remain
	if cache.Get("query1") != nil {
		t.Errorf("Get() expected query1 to be evicted")
	}
	if cache.Get("query2") == nil {
		t.Errorf("Get() expected query2 to remain cached")
	}
	if cache.Get("query3") == nil {
		t.Errorf("Get() expected query3 to be cached")
	}
}

func TestQueryCache_Delete(t *testing.T) {
	cache := NewQueryCache(nil)

	query := "SELECT * FROM test_table"
	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Set and verify
	cache.Set(query, result)
	if cache.Get(query) == nil {
		t.Errorf("Get() expected cached result after set, got nil")
	}

	// Delete and verify
	cache.Delete(query)
	if cache.Get(query) != nil {
		t.Errorf("Get() expected nil after delete, got cached result")
	}
}

func TestQueryCache_Clear(t *testing.T) {
	cache := NewQueryCache(nil)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Set multiple entries
	cache.Set("query1", result)
	cache.Set("query2", result)
	cache.Set("query3", result)

	// Verify all are cached
	if cache.Get("query1") == nil || cache.Get("query2") == nil || cache.Get("query3") == nil {
		t.Errorf("Expected all queries to be cached before clear")
	}

	// Clear cache
	cache.Clear()

	// Verify all are gone
	if cache.Get("query1") != nil || cache.Get("query2") != nil || cache.Get("query3") != nil {
		t.Errorf("Expected all queries to be cleared after Clear()")
	}

	// Verify size is 0
	if cache.GetSize() != 0 {
		t.Errorf("GetSize() expected 0 after clear, got %d", cache.GetSize())
	}
}

func TestQueryCache_Statistics(t *testing.T) {
	cache := NewQueryCache(nil)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Initial statistics
	stats := cache.GetStatistics()
	if stats["hits"].(int64) != 0 {
		t.Errorf("Initial hits expected 0, got %d", stats["hits"])
	}
	if stats["misses"].(int64) != 0 {
		t.Errorf("Initial misses expected 0, got %d", stats["misses"])
	}

	// Test cache miss
	cache.Get("nonexistent")
	stats = cache.GetStatistics()
	if stats["misses"].(int64) != 1 {
		t.Errorf("Misses expected 1 after cache miss, got %d", stats["misses"])
	}

	// Test cache set and hit
	cache.Set("query1", result)
	cache.Get("query1")
	stats = cache.GetStatistics()
	if stats["hits"].(int64) != 1 {
		t.Errorf("Hits expected 1 after cache hit, got %d", stats["hits"])
	}

	// Test hit rate
	hitRate := cache.GetHitRate()
	expectedHitRate := 1.0 / 2.0 // 1 hit out of 2 total requests
	if hitRate != expectedHitRate {
		t.Errorf("Hit rate expected %f, got %f", expectedHitRate, hitRate)
	}
}

func TestQueryCache_Disabled(t *testing.T) {
	config := &QueryCacheConfig{
		Enabled: false,
	}
	cache := NewQueryCache(config)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Set should not cache when disabled
	cache.Set("query1", result)
	cached := cache.Get("query1")
	if cached != nil {
		t.Errorf("Get() expected nil when cache is disabled, got %v", cached)
	}

	// Verify cache is disabled
	if cache.IsEnabled() {
		t.Errorf("IsEnabled() expected false, got true")
	}
}

func TestQueryCache_EnableDisable(t *testing.T) {
	cache := NewQueryCache(nil)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Initially enabled
	if !cache.IsEnabled() {
		t.Errorf("IsEnabled() expected true initially, got false")
	}

	// Set cache entry
	cache.Set("query1", result)
	if cache.Get("query1") == nil {
		t.Errorf("Get() expected cached result when enabled, got nil")
	}

	// Disable cache
	cache.SetEnabled(false)
	if cache.IsEnabled() {
		t.Errorf("IsEnabled() expected false after SetEnabled(false), got true")
	}

	// Cache should be cleared when disabled
	if cache.GetSize() != 0 {
		t.Errorf("GetSize() expected 0 after disabling cache, got %d", cache.GetSize())
	}

	// Set should not work when disabled
	cache.Set("query2", result)
	if cache.Get("query2") != nil {
		t.Errorf("Get() expected nil when cache is disabled, got cached result")
	}

	// Re-enable cache
	cache.SetEnabled(true)
	if !cache.IsEnabled() {
		t.Errorf("IsEnabled() expected true after SetEnabled(true), got false")
	}

	// Should work again when enabled
	cache.Set("query3", result)
	if cache.Get("query3") == nil {
		t.Errorf("Get() expected cached result when re-enabled, got nil")
	}
}

func TestQueryCache_TTLConfiguration(t *testing.T) {
	cache := NewQueryCache(nil)

	// Test default TTL
	defaultTTL := cache.GetTTL()
	if defaultTTL != 5*time.Minute {
		t.Errorf("GetTTL() expected default 5m, got %v", defaultTTL)
	}

	// Test setting custom TTL
	customTTL := 10 * time.Minute
	cache.SetTTL(customTTL)
	if cache.GetTTL() != customTTL {
		t.Errorf("GetTTL() expected %v after SetTTL, got %v", customTTL, cache.GetTTL())
	}
}

func TestQueryCache_ConcurrentAccess(t *testing.T) {
	cache := NewQueryCache(nil)

	result := &QueryResult{
		Columns: []string{"ts", "value"},
		Rows:    []map[string]interface{}{},
		Count:   0,
	}

	// Test concurrent reads and writes
	done := make(chan bool, 10)

	// Start multiple goroutines for concurrent access
	for i := 0; i < 5; i++ {
		go func(id int) {
			query := fmt.Sprintf("query_%d", id)
			cache.Set(query, result)
			cached := cache.Get(query)
			if cached == nil {
				t.Errorf("Concurrent access: expected cached result for %s", query)
			}
			done <- true
		}(i)
	}

	// Start multiple goroutines for concurrent reads
	for i := 0; i < 5; i++ {
		go func(id int) {
			query := fmt.Sprintf("query_%d", id%3) // Some overlap with writes
			cache.Get(query)                       // May or may not find result
			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify cache is still functional
	cache.Set("final_test", result)
	if cache.Get("final_test") == nil {
		t.Errorf("Cache not functional after concurrent access")
	}
}