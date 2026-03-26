/**
 * State Cache Service
 * Intelligent caching system for API responses and application state
 */

import { StateCache, globalStateCache, performanceMonitor } from '../utils/performance.js';
import { devLog } from '../utils/helpers.js';

/**
 * API Response Cache Manager
 */
export class APICache {
    constructor(options = {}) {
        this.cache = new StateCache({
            maxSize: options.maxSize || 100,
            ttl: options.ttl || 5 * 60 * 1000 // 5 minutes
        });
        
        this.pendingRequests = new Map();
        this.invalidationPatterns = new Map();
        this.dependencies = new Map();
        
        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0,
            requests: 0
        };
    }

    /**
     * Get cached response or execute request
     * @param {string} key - Cache key
     * @param {Function} requestFn - Function that returns a promise
     * @param {Object} options - Cache options
     * @returns {Promise} - Cached or fresh data
     */
    async get(key, requestFn, options = {}) {
        const {
            ttl = null,
            forceRefresh = false,
            dependencies = [],
            invalidateOn = []
        } = options;

        this.stats.requests++;

        // Check for force refresh
        if (forceRefresh) {
            this.delete(key);
        }

        // Check cache first
        if (this.cache.has(key)) {
            this.stats.hits++;
            devLog(`Cache hit: ${key}`);
            return this.cache.get(key);
        }

        // Check for pending request to avoid duplicate calls
        if (this.pendingRequests.has(key)) {
            devLog(`Waiting for pending request: ${key}`);
            return this.pendingRequests.get(key);
        }

        // Execute request
        this.stats.misses++;
        devLog(`Cache miss: ${key}`);

        const requestPromise = this.executeRequest(key, requestFn, {
            ttl,
            dependencies,
            invalidateOn
        });

        this.pendingRequests.set(key, requestPromise);

        try {
            const result = await requestPromise;
            this.pendingRequests.delete(key);
            return result;
        } catch (error) {
            this.pendingRequests.delete(key);
            throw error;
        }
    }

    async executeRequest(key, requestFn, options) {
        const timer = performanceMonitor.start(`api-request-${key}`);
        
        try {
            const result = await requestFn();
            
            // Cache the result
            this.cache.set(key, result, options.ttl);
            
            // Set up dependencies
            if (options.dependencies.length > 0) {
                this.dependencies.set(key, options.dependencies);
            }
            
            // Set up invalidation patterns
            if (options.invalidateOn.length > 0) {
                options.invalidateOn.forEach(pattern => {
                    if (!this.invalidationPatterns.has(pattern)) {
                        this.invalidationPatterns.set(pattern, new Set());
                    }
                    this.invalidationPatterns.get(pattern).add(key);
                });
            }
            
            timer.end();
            devLog(`Request completed and cached: ${key}`);
            return result;
            
        } catch (error) {
            timer.end();
            console.error(`Request failed for ${key}:`, error);
            throw error;
        }
    }

    /**
     * Set cache value directly
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, value, ttl = null) {
        this.cache.set(key, value, ttl);
        devLog(`Cache set directly: ${key}`);
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} - True if key exists and not expired
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Delete cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.dependencies.delete(key);
        
        // Remove from invalidation patterns
        for (const [pattern, keys] of this.invalidationPatterns.entries()) {
            keys.delete(key);
            if (keys.size === 0) {
                this.invalidationPatterns.delete(pattern);
            }
        }
        
        devLog(`Cache deleted: ${key}`);
    }

    /**
     * Invalidate cache entries by pattern
     * @param {string} pattern - Invalidation pattern
     */
    invalidate(pattern) {
        const keysToInvalidate = this.invalidationPatterns.get(pattern);
        if (keysToInvalidate) {
            keysToInvalidate.forEach(key => {
                this.delete(key);
                this.stats.invalidations++;
            });
            devLog(`Cache invalidated by pattern: ${pattern} (${keysToInvalidate.size} keys)`);
        }
    }

    /**
     * Invalidate cache entries by dependency
     * @param {string} dependency - Dependency name
     */
    invalidateByDependency(dependency) {
        const keysToInvalidate = [];
        
        for (const [key, deps] of this.dependencies.entries()) {
            if (deps.includes(dependency)) {
                keysToInvalidate.push(key);
            }
        }
        
        keysToInvalidate.forEach(key => {
            this.delete(key);
            this.stats.invalidations++;
        });
        
        if (keysToInvalidate.length > 0) {
            devLog(`Cache invalidated by dependency: ${dependency} (${keysToInvalidate.length} keys)`);
        }
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.dependencies.clear();
        this.invalidationPatterns.clear();
        this.pendingRequests.clear();
        devLog('Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            hitRate: this.stats.requests > 0 ? (this.stats.hits / this.stats.requests * 100).toFixed(2) + '%' : '0%',
            pendingRequests: this.pendingRequests.size,
            dependencies: this.dependencies.size,
            invalidationPatterns: this.invalidationPatterns.size
        };
    }

    /**
     * Preload cache entries
     * @param {Array} entries - Array of {key, requestFn, options} objects
     * @returns {Promise} - Promise that resolves when all entries are loaded
     */
    async preload(entries) {
        const promises = entries.map(({ key, requestFn, options = {} }) => {
            if (!this.has(key)) {
                return this.get(key, requestFn, options).catch(error => {
                    console.warn(`Failed to preload ${key}:`, error);
                    return null;
                });
            }
            return Promise.resolve(this.cache.get(key));
        });

        const results = await Promise.all(promises);
        devLog(`Preloaded ${entries.length} cache entries`);
        return results;
    }
}

/**
 * Smart cache for different data types
 */
export class SmartCache {
    constructor() {
        this.caches = {
            // Short-lived cache for real-time data
            realtime: new APICache({ 
                maxSize: 50, 
                ttl: 30 * 1000 // 30 seconds
            }),
            
            // Medium-lived cache for interface data
            interfaces: new APICache({ 
                maxSize: 100, 
                ttl: 2 * 60 * 1000 // 2 minutes
            }),
            
            // Long-lived cache for configuration data
            config: new APICache({ 
                maxSize: 200, 
                ttl: 10 * 60 * 1000 // 10 minutes
            }),
            
            // Very long-lived cache for static data
            static: new APICache({ 
                maxSize: 50, 
                ttl: 60 * 60 * 1000 // 1 hour
            })
        };
    }

    /**
     * Get data with automatic cache selection
     * @param {string} type - Cache type (realtime, interfaces, config, static)
     * @param {string} key - Cache key
     * @param {Function} requestFn - Request function
     * @param {Object} options - Cache options
     * @returns {Promise} - Cached or fresh data
     */
    async get(type, key, requestFn, options = {}) {
        const cache = this.caches[type];
        if (!cache) {
            throw new Error(`Unknown cache type: ${type}`);
        }

        return cache.get(key, requestFn, options);
    }

    /**
     * Invalidate cache by type and pattern
     * @param {string} type - Cache type
     * @param {string} pattern - Invalidation pattern
     */
    invalidate(type, pattern) {
        const cache = this.caches[type];
        if (cache) {
            cache.invalidate(pattern);
        }
    }

    /**
     * Invalidate all caches by dependency
     * @param {string} dependency - Dependency name
     */
    invalidateByDependency(dependency) {
        Object.values(this.caches).forEach(cache => {
            cache.invalidateByDependency(dependency);
        });
    }

    /**
     * Clear all caches
     */
    clearAll() {
        Object.values(this.caches).forEach(cache => {
            cache.clear();
        });
    }

    /**
     * Get statistics for all caches
     * @returns {Object} - Statistics for each cache type
     */
    getStats() {
        const stats = {};
        for (const [type, cache] of Object.entries(this.caches)) {
            stats[type] = cache.getStats();
        }
        return stats;
    }
}

// Global smart cache instance
export const smartCache = new SmartCache();

/**
 * Cache decorators for API functions
 */
export const withCache = (type, keyGenerator, options = {}) => {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const key = typeof keyGenerator === 'function' 
                ? keyGenerator(...args) 
                : keyGenerator;
            
            return smartCache.get(type, key, () => originalMethod.apply(this, args), options);
        };
        
        return descriptor;
    };
};

/**
 * Cache invalidation helper
 */
export const invalidateCache = {
    /**
     * Invalidate interface-related caches
     * @param {string} interfaceId - Interface ID (optional)
     */
    interfaces(interfaceId = null) {
        if (interfaceId) {
            smartCache.invalidate('interfaces', `interface-${interfaceId}`);
            smartCache.invalidate('realtime', `interface-${interfaceId}`);
        } else {
            smartCache.invalidate('interfaces', 'interface');
            smartCache.invalidate('realtime', 'interface');
        }
    },

    /**
     * Invalidate configuration caches
     */
    config() {
        smartCache.invalidate('config', 'config');
        smartCache.invalidateByDependency('config');
    },

    /**
     * Invalidate driver-related caches
     */
    drivers() {
        smartCache.invalidate('config', 'driver');
        smartCache.invalidate('static', 'driver');
    },

    /**
     * Invalidate all caches
     */
    all() {
        smartCache.clearAll();
    }
};

// Auto-invalidation based on events
if (typeof window !== 'undefined') {
    // Listen for interface changes
    window.addEventListener('interface-updated', (event) => {
        const { interfaceId } = event.detail || {};
        invalidateCache.interfaces(interfaceId);
    });

    // Listen for configuration changes
    window.addEventListener('config-updated', () => {
        invalidateCache.config();
    });

    // Listen for driver changes
    window.addEventListener('driver-updated', () => {
        invalidateCache.drivers();
    });

    // Expose cache utilities globally for debugging
    window.cacheUtils = {
        smartCache,
        invalidateCache,
        APICache,
        SmartCache
    };
}

export default smartCache;