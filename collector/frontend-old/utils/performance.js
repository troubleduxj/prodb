/**
 * Performance Optimization Utilities
 * Provides debounce, throttle, caching, and other performance utilities
 */

import { devLog } from './helpers.js';

/**
 * Debounce function - delays execution until after wait time has elapsed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait, immediate = false) => {
    let timeout;
    let result;

    const debounced = function(...args) {
        const context = this;
        
        const later = () => {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };

        const callNow = immediate && !timeout;
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) {
            result = func.apply(context, args);
        }

        return result;
    };

    debounced.cancel = () => {
        clearTimeout(timeout);
        timeout = null;
    };

    debounced.flush = function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
            return func.apply(this, arguments);
        }
    };

    return debounced;
};

/**
 * Throttle function - limits execution to once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Options object
 * @returns {Function} - Throttled function
 */
export const throttle = (func, wait, options = {}) => {
    let timeout;
    let previous = 0;
    let result;

    const { leading = true, trailing = true } = options;

    const throttled = function(...args) {
        const context = this;
        const now = Date.now();

        if (!previous && !leading) {
            previous = now;
        }

        const remaining = wait - (now - previous);

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
        } else if (!timeout && trailing) {
            timeout = setTimeout(() => {
                previous = !leading ? 0 : Date.now();
                timeout = null;
                result = func.apply(context, args);
            }, remaining);
        }

        return result;
    };

    throttled.cancel = () => {
        clearTimeout(timeout);
        timeout = null;
        previous = 0;
    };

    return throttled;
};

/**
 * Request Animation Frame based throttle for smooth animations
 * @param {Function} func - Function to throttle
 * @returns {Function} - RAF throttled function
 */
export const rafThrottle = (func) => {
    let rafId = null;
    let lastArgs = null;

    const throttled = function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
            });
        }
    };

    throttled.cancel = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    return throttled;
};

/**
 * Memory-efficient cache with LRU eviction
 */
export class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return undefined;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            // Update existing
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }

    keys() {
        return Array.from(this.cache.keys());
    }

    values() {
        return Array.from(this.cache.values());
    }
}

/**
 * State cache manager for API responses and computed values
 */
export class StateCache {
    constructor(options = {}) {
        this.cache = new LRUCache(options.maxSize || 50);
        this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
        this.timestamps = new Map();
        this.cleanupInterval = null;

        // Start cleanup interval
        this.startCleanup();
    }

    set(key, value, customTTL = null) {
        const ttl = customTTL || this.ttl;
        const expiresAt = Date.now() + ttl;
        
        this.cache.set(key, value);
        this.timestamps.set(key, expiresAt);
        
        devLog(`Cache set: ${key} (expires in ${ttl}ms)`);
    }

    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }

        const expiresAt = this.timestamps.get(key);
        if (expiresAt && Date.now() > expiresAt) {
            // Expired
            this.delete(key);
            return undefined;
        }

        return this.cache.get(key);
    }

    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }

        const expiresAt = this.timestamps.get(key);
        if (expiresAt && Date.now() > expiresAt) {
            this.delete(key);
            return false;
        }

        return true;
    }

    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
    }

    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Cleanup every minute
    }

    cleanup() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, expiresAt] of this.timestamps.entries()) {
            if (now > expiresAt) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.delete(key));
        
        if (expiredKeys.length > 0) {
            devLog(`Cache cleanup: removed ${expiredKeys.length} expired items`);
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.cache.maxSize,
            keys: this.cache.keys(),
            timestamps: Array.from(this.timestamps.entries())
        };
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }
}

/**
 * Memoization decorator with cache
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Memoization options
 * @returns {Function} - Memoized function
 */
export const memoize = (fn, options = {}) => {
    const {
        maxSize = 100,
        ttl = null,
        keyGenerator = (...args) => JSON.stringify(args),
        onCacheHit = null,
        onCacheMiss = null
    } = options;

    const cache = ttl ? new StateCache({ maxSize, ttl }) : new LRUCache(maxSize);

    const memoized = function(...args) {
        const key = keyGenerator(...args);
        
        if (cache.has && cache.has(key)) {
            const result = cache.get(key);
            if (onCacheHit) onCacheHit(key, result);
            return result;
        } else if (!cache.has && cache.cache && cache.cache.has(key)) {
            const result = cache.get(key);
            if (onCacheHit) onCacheHit(key, result);
            return result;
        }

        const result = fn.apply(this, args);
        cache.set(key, result);
        
        if (onCacheMiss) onCacheMiss(key, result);
        
        return result;
    };

    memoized.cache = cache;
    memoized.clear = () => cache.clear();
    memoized.delete = (key) => cache.delete(key);
    memoized.has = (key) => cache.has ? cache.has(key) : cache.cache.has(key);

    return memoized;
};

/**
 * Batch function calls to reduce overhead
 * @param {Function} fn - Function to batch
 * @param {number} delay - Batch delay in milliseconds
 * @param {number} maxBatchSize - Maximum batch size
 * @returns {Function} - Batched function
 */
export const batchCalls = (fn, delay = 100, maxBatchSize = 10) => {
    let batch = [];
    let timeout = null;

    const processBatch = () => {
        if (batch.length === 0) return;

        const currentBatch = batch.splice(0, maxBatchSize);
        const args = currentBatch.map(item => item.args);
        const callbacks = currentBatch.map(item => item.callback);

        try {
            const result = fn(args);
            
            if (Array.isArray(result)) {
                result.forEach((res, index) => {
                    if (callbacks[index]) callbacks[index](null, res);
                });
            } else {
                callbacks.forEach(callback => {
                    if (callback) callback(null, result);
                });
            }
        } catch (error) {
            callbacks.forEach(callback => {
                if (callback) callback(error);
            });
        }

        // Process remaining items if any
        if (batch.length > 0) {
            timeout = setTimeout(processBatch, 0);
        }
    };

    return function(...args) {
        return new Promise((resolve, reject) => {
            batch.push({
                args,
                callback: (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            });

            if (batch.length >= maxBatchSize) {
                // Process immediately if batch is full
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                processBatch();
            } else if (!timeout) {
                // Schedule batch processing
                timeout = setTimeout(processBatch, delay);
            }
        });
    };
};

/**
 * Performance monitor for tracking function execution times
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.enabled = true;
    }

    start(label) {
        if (!this.enabled) return;
        
        if (!this.metrics.has(label)) {
            this.metrics.set(label, {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastTime: 0
            });
        }

        return {
            label,
            startTime: performance.now(),
            end: () => this.end(label, performance.now())
        };
    }

    end(label, startTime) {
        if (!this.enabled) return;

        const endTime = performance.now();
        const duration = endTime - startTime;
        const metric = this.metrics.get(label);

        if (metric) {
            metric.count++;
            metric.totalTime += duration;
            metric.minTime = Math.min(metric.minTime, duration);
            metric.maxTime = Math.max(metric.maxTime, duration);
            metric.lastTime = duration;
        }

        devLog(`Performance: ${label} took ${duration.toFixed(2)}ms`);
        return duration;
    }

    measure(label, fn) {
        const timer = this.start(label);
        try {
            const result = fn();
            if (result && typeof result.then === 'function') {
                // Handle promises
                return result.finally(() => timer.end());
            }
            timer.end();
            return result;
        } catch (error) {
            timer.end();
            throw error;
        }
    }

    getMetrics(label = null) {
        if (label) {
            const metric = this.metrics.get(label);
            if (metric) {
                return {
                    ...metric,
                    avgTime: metric.totalTime / metric.count
                };
            }
            return null;
        }

        const result = {};
        for (const [key, metric] of this.metrics.entries()) {
            result[key] = {
                ...metric,
                avgTime: metric.totalTime / metric.count
            };
        }
        return result;
    }

    reset(label = null) {
        if (label) {
            this.metrics.delete(label);
        } else {
            this.metrics.clear();
        }
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Global state cache instance
export const globalStateCache = new StateCache({
    maxSize: 100,
    ttl: 5 * 60 * 1000 // 5 minutes
});

/**
 * Optimize function for better performance
 * @param {Function} fn - Function to optimize
 * @param {Object} options - Optimization options
 * @returns {Function} - Optimized function
 */
export const optimize = (fn, options = {}) => {
    const {
        memoize: shouldMemoize = false,
        debounce: debounceMs = null,
        throttle: throttleMs = null,
        batch = null,
        monitor = false,
        ...memoizeOptions
    } = options;

    let optimizedFn = fn;

    // Apply memoization
    if (shouldMemoize) {
        optimizedFn = memoize(optimizedFn, memoizeOptions);
    }

    // Apply debouncing
    if (debounceMs) {
        optimizedFn = debounce(optimizedFn, debounceMs);
    }

    // Apply throttling
    if (throttleMs) {
        optimizedFn = throttle(optimizedFn, throttleMs);
    }

    // Apply batching
    if (batch) {
        optimizedFn = batchCalls(optimizedFn, batch.delay, batch.maxSize);
    }

    // Apply performance monitoring
    if (monitor) {
        const label = fn.name || 'anonymous';
        const originalFn = optimizedFn;
        optimizedFn = function(...args) {
            return performanceMonitor.measure(label, () => originalFn.apply(this, args));
        };
    }

    return optimizedFn;
};

// Export utilities for global use
if (typeof window !== 'undefined') {
    window.performanceUtils = {
        debounce,
        throttle,
        rafThrottle,
        LRUCache,
        StateCache,
        memoize,
        batchCalls,
        PerformanceMonitor,
        performanceMonitor,
        globalStateCache,
        optimize
    };
}