package services

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"
)

// CacheManager 缓存管理器
type CacheManager struct {
	config      *PerformanceConfig
	cache       map[string]*CacheEntry
	lru         *LRUList
	size        int64
	maxSize     int64
	hitCount    int64
	missCount   int64
	running     bool
	stopChan    chan struct{}
	mu          sync.RWMutex
}

// CacheEntry 缓存条目
type CacheEntry struct {
	Key        string      `json:"key"`
	Value      interface{} `json:"value"`
	Size       int64       `json:"size"`
	CreatedAt  time.Time   `json:"created_at"`
	AccessedAt time.Time   `json:"accessed_at"`
	TTL        time.Duration `json:"ttl"`
	AccessCount int64      `json:"access_count"`
	lruNode    *LRUNode
}

// LRUList LRU链表
type LRUList struct {
	head *LRUNode
	tail *LRUNode
	size int
}

// LRUNode LRU节点
type LRUNode struct {
	key   string
	entry *CacheEntry
	prev  *LRUNode
	next  *LRUNode
}

// CacheStats 缓存统计
type CacheStats struct {
	Size        int64   `json:"size"`
	MaxSize     int64   `json:"max_size"`
	EntryCount  int     `json:"entry_count"`
	HitCount    int64   `json:"hit_count"`
	MissCount   int64   `json:"miss_count"`
	HitRate     float64 `json:"hit_rate"`
	MemoryUsage int64   `json:"memory_usage"`
}

// NewCacheManager 创建缓存管理器
func NewCacheManager(config *PerformanceConfig) *CacheManager {
	return &CacheManager{
		config:   config,
		cache:    make(map[string]*CacheEntry),
		lru:      NewLRUList(),
		maxSize:  config.CacheSize,
		stopChan: make(chan struct{}),
	}
}

// NewLRUList 创建LRU链表
func NewLRUList() *LRUList {
	head := &LRUNode{}
	tail := &LRUNode{}
	head.next = tail
	tail.prev = head
	
	return &LRUList{
		head: head,
		tail: tail,
	}
}

// Start 启动缓存管理器
func (cm *CacheManager) Start(ctx context.Context) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	if cm.running {
		return fmt.Errorf("cache manager already running")
	}
	
	cm.running = true
	
	// 启动清理循环
	go cm.cleanupLoop(ctx)
	
	log.Println("Cache manager started")
	return nil
}

// Stop 停止缓存管理器
func (cm *CacheManager) Stop() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	if !cm.running {
		return
	}
	
	cm.running = false
	close(cm.stopChan)
	
	// 清空缓存
	cm.cache = make(map[string]*CacheEntry)
	cm.lru = NewLRUList()
	cm.size = 0
	
	log.Println("Cache manager stopped")
}

// Set 设置缓存
func (cm *CacheManager) Set(key string, value interface{}, ttl time.Duration) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 计算值的大小
	valueSize := cm.estimateSize(value)
	
	// 检查是否需要清理空间
	if cm.size+valueSize > cm.maxSize {
		cm.evictLRU(valueSize)
	}
	
	// 如果键已存在，更新
	if existing, exists := cm.cache[key]; exists {
		cm.size -= existing.Size
		cm.lru.Remove(existing.lruNode)
	}
	
	// 创建新条目
	entry := &CacheEntry{
		Key:        key,
		Value:      value,
		Size:       valueSize,
		CreatedAt:  time.Now(),
		AccessedAt: time.Now(),
		TTL:        ttl,
		AccessCount: 0,
	}
	
	// 添加到LRU链表头部
	node := cm.lru.AddToHead(key, entry)
	entry.lruNode = node
	
	// 添加到缓存
	cm.cache[key] = entry
	cm.size += valueSize
	
	return nil
}

// Get 获取缓存
func (cm *CacheManager) Get(key string) (interface{}, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	entry, exists := cm.cache[key]
	if !exists {
		cm.missCount++
		return nil, false
	}
	
	// 检查是否过期
	if entry.TTL > 0 && time.Since(entry.CreatedAt) > entry.TTL {
		cm.delete(key)
		cm.missCount++
		return nil, false
	}
	
	// 更新访问信息
	entry.AccessedAt = time.Now()
	entry.AccessCount++
	
	// 移动到LRU链表头部
	cm.lru.MoveToHead(entry.lruNode)
	
	cm.hitCount++
	return entry.Value, true
}

// Delete 删除缓存
func (cm *CacheManager) Delete(key string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	cm.delete(key)
}

// delete 内部删除方法（不加锁）
func (cm *CacheManager) delete(key string) {
	if entry, exists := cm.cache[key]; exists {
		cm.size -= entry.Size
		cm.lru.Remove(entry.lruNode)
		delete(cm.cache, key)
	}
}

// Clear 清空缓存
func (cm *CacheManager) Clear() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	cm.cache = make(map[string]*CacheEntry)
	cm.lru = NewLRUList()
	cm.size = 0
}

// GetSize 获取缓存大小
func (cm *CacheManager) GetSize() int64 {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	return cm.size
}

// GetHitRate 获取命中率
func (cm *CacheManager) GetHitRate() float64 {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	total := cm.hitCount + cm.missCount
	if total == 0 {
		return 0
	}
	
	return float64(cm.hitCount) / float64(total)
}

// GetStats 获取缓存统计
func (cm *CacheManager) GetStats() *CacheStats {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	return &CacheStats{
		Size:        cm.size,
		MaxSize:     cm.maxSize,
		EntryCount:  len(cm.cache),
		HitCount:    cm.hitCount,
		MissCount:   cm.missCount,
		HitRate:     cm.GetHitRate(),
		MemoryUsage: cm.size,
	}
}

// Optimize 优化缓存
func (cm *CacheManager) Optimize() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 清理过期条目
	expired := cm.cleanExpired()
	
	// 如果缓存使用率过高，清理LRU条目
	if float64(cm.size)/float64(cm.maxSize) > 0.8 {
		evicted := cm.evictLRU(cm.maxSize / 10) // 清理10%的空间
		log.Printf("Cache optimization: expired=%d, evicted=%d", expired, evicted)
	}
	
	return nil
}

// cleanExpired 清理过期条目
func (cm *CacheManager) cleanExpired() int {
	expired := 0
	now := time.Now()
	
	for key, entry := range cm.cache {
		if entry.TTL > 0 && now.Sub(entry.CreatedAt) > entry.TTL {
			cm.delete(key)
			expired++
		}
	}
	
	return expired
}

// evictLRU 清理LRU条目
func (cm *CacheManager) evictLRU(targetSize int64) int {
	evicted := 0
	freedSize := int64(0)
	
	for freedSize < targetSize && cm.lru.size > 0 {
		// 从尾部删除最少使用的条目
		tail := cm.lru.tail.prev
		if tail == cm.lru.head {
			break
		}
		
		entry := tail.entry
		freedSize += entry.Size
		cm.delete(tail.key)
		evicted++
	}
	
	return evicted
}

// estimateSize 估算值的大小
func (cm *CacheManager) estimateSize(value interface{}) int64 {
	switch v := value.(type) {
	case string:
		return int64(len(v))
	case []byte:
		return int64(len(v))
	case int, int32, int64, float32, float64:
		return 8
	case bool:
		return 1
	default:
		// 对于复杂类型，使用固定估算值
		return 64
	}
}

// cleanupLoop 清理循环
func (cm *CacheManager) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(cm.config.CacheCleanInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-cm.stopChan:
			return
		case <-ticker.C:
			cm.Optimize()
		}
	}
}

// GenerateKey 生成缓存键
func (cm *CacheManager) GenerateKey(prefix string, params ...interface{}) string {
	hash := md5.New()
	hash.Write([]byte(prefix))
	
	for _, param := range params {
		hash.Write([]byte(fmt.Sprintf("%v", param)))
	}
	
	return hex.EncodeToString(hash.Sum(nil))
}

// LRU链表操作方法

// AddToHead 添加到头部
func (lru *LRUList) AddToHead(key string, entry *CacheEntry) *LRUNode {
	node := &LRUNode{
		key:   key,
		entry: entry,
	}
	
	node.next = lru.head.next
	node.prev = lru.head
	lru.head.next.prev = node
	lru.head.next = node
	
	lru.size++
	return node
}

// Remove 移除节点
func (lru *LRUList) Remove(node *LRUNode) {
	if node == nil {
		return
	}
	
	node.prev.next = node.next
	node.next.prev = node.prev
	lru.size--
}

// MoveToHead 移动到头部
func (lru *LRUList) MoveToHead(node *LRUNode) {
	if node == nil {
		return
	}
	
	lru.Remove(node)
	
	node.next = lru.head.next
	node.prev = lru.head
	lru.head.next.prev = node
	lru.head.next = node
	
	lru.size++
}