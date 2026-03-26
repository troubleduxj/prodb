/**
 * Enhanced API Service with Performance Optimizations
 * Extends the base API service with caching, debouncing, and intelligent request management
 */

import { smartCache, invalidateCache } from './state-cache.js';
import { debounce, throttle, performanceMonitor } from '../utils/performance.js';
import { devLog } from '../utils/helpers.js';

/**
 * Enhanced API Service with caching and performance optimizations
 */
export class EnhancedAPIService {
    constructor(baseService) {
        this.baseService = baseService;
        this.requestQueue = new Map();
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2
        };
        
        // Debounced methods for frequent operations
        this.debouncedSearch = debounce(this.search.bind(this), 300);
        this.throttledRefresh = throttle(this.refresh.bind(this), 1000);
    }

    /**
     * Get data with intelligent caching
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise} - Cached or fresh data
     */
    async getCached(endpoint, options = {}) {
        const {
            cacheType = 'interfaces',
            cacheKey = endpoint,
            ttl = null,
            forceRefresh = false,
            retries = 0
        } = options;

        const requestFn = async () => {
            const timer = performanceMonitor.start(`api-${endpoint}`);
            try {
                const result = await this.baseService.get(endpoint, options.params);
                timer.end();
                return result;
            } catch (error) {
                timer.end();
                if (retries < this.retryConfig.maxRetries) {
                    devLog(`Retrying request ${endpoint} (${retries + 1}/${this.retryConfig.maxRetries})`);
                    await this.delay(this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retries));
                    return this.getCached(endpoint, { ...options, retries: retries + 1 });
                }
                throw error;
            }
        };

        return smartCache.get(cacheType, cacheKey, requestFn, {
            ttl,
            forceRefresh,
            dependencies: options.dependencies || [],
            invalidateOn: options.invalidateOn || []
        });
    }

    /**
     * Post data with cache invalidation
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise} - Response data
     */
    async postWithInvalidation(endpoint, data, options = {}) {
        const timer = performanceMonitor.start(`api-post-${endpoint}`);
        
        try {
            const result = await this.baseService.post(endpoint, data);
            
            // Invalidate related caches
            if (options.invalidatePatterns) {
                options.invalidatePatterns.forEach(pattern => {
                    const [cacheType, patternKey] = pattern.split(':');
                    smartCache.invalidate(cacheType, patternKey);
                });
            }
            
            if (options.invalidateDependencies) {
                options.invalidateDependencies.forEach(dep => {
                    smartCache.invalidateByDependency(dep);
                });
            }
            
            timer.end();
            return result;
        } catch (error) {
            timer.end();
            throw error;
        }
    }

    /**
     * Batch multiple requests efficiently
     * @param {Array} requests - Array of request configurations
     * @returns {Promise<Array>} - Array of results
     */
    async batchRequests(requests) {
        const timer = performanceMonitor.start('api-batch-requests');
        
        try {
            const promises = requests.map(async (request, index) => {
                const { method = 'GET', endpoint, data, options = {} } = request;
                
                try {
                    switch (method.toLowerCase()) {
                        case 'get':
                            return await this.getCached(endpoint, options);
                        case 'post':
                            return await this.postWithInvalidation(endpoint, data, options);
                        case 'put':
                            return await this.baseService.put(endpoint, data);
                        case 'delete':
                            return await this.baseService.delete(endpoint);
                        default:
                            throw new Error(`Unsupported method: ${method}`);
                    }
                } catch (error) {
                    devLog(`Batch request ${index} failed:`, error);
                    return { error: error.message, index };
                }
            });

            const results = await Promise.all(promises);
            timer.end();
            return results;
        } catch (error) {
            timer.end();
            throw error;
        }
    }

    /**
     * Search with debouncing
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise} - Search results
     */
    async search(query, options = {}) {
        const { endpoint = '/search', cacheType = 'config' } = options;
        const cacheKey = `search-${query}`;
        
        return this.getCached(endpoint, {
            ...options,
            cacheType,
            cacheKey,
            params: { q: query, ...options.params },
            ttl: 2 * 60 * 1000 // 2 minutes for search results
        });
    }

    /**
     * Refresh data with throttling
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Refresh options
     * @returns {Promise} - Fresh data
     */
    async refresh(endpoint, options = {}) {
        return this.getCached(endpoint, {
            ...options,
            forceRefresh: true
        });
    }

    /**
     * Preload critical data
     * @param {Array} endpoints - Array of endpoints to preload
     * @returns {Promise} - Preload results
     */
    async preloadCriticalData(endpoints) {
        const timer = performanceMonitor.start('api-preload');
        
        const preloadPromises = endpoints.map(({ endpoint, cacheType, options = {} }) => {
            return this.getCached(endpoint, {
                cacheType: cacheType || 'static',
                ttl: 10 * 60 * 1000, // 10 minutes for preloaded data
                ...options
            }).catch(error => {
                devLog(`Failed to preload ${endpoint}:`, error);
                return null;
            });
        });

        const results = await Promise.all(preloadPromises);
        timer.end();
        devLog(`Preloaded ${endpoints.length} endpoints`);
        return results;
    }

    /**
     * Utility method for delays
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return smartCache.getStats();
    }

    /**
     * Clear all caches
     */
    clearCache() {
        smartCache.clearAll();
    }
}

/**
 * Enhanced System Status API with caching
 */
export class EnhancedSystemStatusAPI extends EnhancedAPIService {
    constructor(baseService) {
        super(baseService);
    }

    /**
     * Get system status with caching
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Object>} System status
     */
    async getStatus(forceRefresh = false) {
        return this.getCached('/status', {
            cacheType: 'realtime',
            cacheKey: 'system-status',
            forceRefresh,
            ttl: 30 * 1000, // 30 seconds
            invalidateOn: ['system-update']
        });
    }

    /**
     * Get interfaces with caching
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Array>} Interfaces list
     */
    async getInterfaces(forceRefresh = false) {
        return this.getCached('/interfaces', {
            cacheType: 'interfaces',
            cacheKey: 'interfaces-list',
            forceRefresh,
            ttl: 2 * 60 * 1000, // 2 minutes
            invalidateOn: ['interface-update'],
            dependencies: ['interfaces']
        });
    }

    /**
     * Get interface details with caching
     * @param {string} interfaceId - Interface ID
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Object>} Interface details
     */
    async getInterface(interfaceId, forceRefresh = false) {
        return this.getCached(`/interfaces/${interfaceId}`, {
            cacheType: 'interfaces',
            cacheKey: `interface-${interfaceId}`,
            forceRefresh,
            ttl: 2 * 60 * 1000,
            invalidateOn: [`interface-${interfaceId}-update`],
            dependencies: ['interfaces', interfaceId]
        });
    }

    /**
     * Get data flow metrics with caching
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Object>} Data flow metrics
     */
    async getDataFlowMetrics(forceRefresh = false) {
        return this.getCached('/metrics/dataflow', {
            cacheType: 'realtime',
            cacheKey: 'dataflow-metrics',
            forceRefresh,
            ttl: 15 * 1000, // 15 seconds
            invalidateOn: ['metrics-update']
        });
    }

    /**
     * Update interface status with cache invalidation
     * @param {string} interfaceId - Interface ID
     * @param {string} action - Action to perform
     * @returns {Promise<Object>} Operation result
     */
    async updateInterfaceStatus(interfaceId, action) {
        return this.postWithInvalidation(`/interfaces/${interfaceId}/${action}`, null, {
            invalidatePatterns: [
                `interfaces:interface-${interfaceId}`,
                'interfaces:interfaces-list',
                'realtime:system-status'
            ],
            invalidateDependencies: ['interfaces', interfaceId]
        });
    }
}

/**
 * Enhanced Protocol Test API with caching
 */
export class EnhancedProtocolTestAPI extends EnhancedAPIService {
    constructor(baseService) {
        super(baseService);
    }

    /**
     * Test protocol connection with caching for repeated tests
     * @param {Object} testConfig - Test configuration
     * @param {boolean} useCache - Whether to use cache for identical tests
     * @returns {Promise<Object>} Test result
     */
    async testConnection(testConfig, useCache = false) {
        if (!useCache) {
            // Don't cache test results by default
            return this.baseService.testConnection(testConfig);
        }

        const cacheKey = `test-${JSON.stringify(testConfig)}`;
        return this.getCached('/test/protocol', {
            cacheType: 'config',
            cacheKey,
            ttl: 5 * 60 * 1000, // 5 minutes for test results
            params: testConfig
        });
    }

    /**
     * Get supported protocols with caching
     * @returns {Promise<Array>} Supported protocols
     */
    async getSupportedProtocols() {
        return this.getCached('/protocols/supported', {
            cacheType: 'static',
            cacheKey: 'supported-protocols',
            ttl: 60 * 60 * 1000 // 1 hour
        });
    }

    /**
     * Batch test with progress tracking
     * @param {Array} testConfigs - Array of test configurations
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Test results
     */
    async batchTestWithProgress(testConfigs, onProgress = null) {
        const results = [];
        const total = testConfigs.length;

        for (let i = 0; i < testConfigs.length; i++) {
            try {
                const result = await this.testConnection(testConfigs[i]);
                results.push(result);
                
                if (onProgress) {
                    onProgress({
                        completed: i + 1,
                        total,
                        progress: ((i + 1) / total) * 100,
                        currentTest: testConfigs[i],
                        result
                    });
                }
            } catch (error) {
                results.push({ error: error.message, config: testConfigs[i] });
                
                if (onProgress) {
                    onProgress({
                        completed: i + 1,
                        total,
                        progress: ((i + 1) / total) * 100,
                        currentTest: testConfigs[i],
                        error: error.message
                    });
                }
            }
        }

        return results;
    }
}

/**
 * Enhanced Driver API with caching
 */
export class EnhancedDriverAPI extends EnhancedAPIService {
    constructor(baseService) {
        super(baseService);
    }

    /**
     * Get drivers with caching
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Array>} Drivers list
     */
    async getDrivers(forceRefresh = false) {
        return this.getCached('/drivers', {
            cacheType: 'config',
            cacheKey: 'drivers-list',
            forceRefresh,
            ttl: 5 * 60 * 1000, // 5 minutes
            invalidateOn: ['driver-update'],
            dependencies: ['drivers']
        });
    }

    /**
     * Get available drivers with caching
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<Array>} Available drivers
     */
    async getAvailableDrivers(forceRefresh = false) {
        return this.getCached('/drivers/available', {
            cacheType: 'static',
            cacheKey: 'available-drivers',
            forceRefresh,
            ttl: 10 * 60 * 1000 // 10 minutes
        });
    }

    /**
     * Load driver with cache invalidation
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Load result
     */
    async loadDriver(driverId) {
        return this.postWithInvalidation('/drivers/load', { driverId }, {
            invalidatePatterns: [
                'config:drivers-list',
                `config:driver-${driverId}`
            ],
            invalidateDependencies: ['drivers', driverId]
        });
    }

    /**
     * Install driver with cache invalidation
     * @param {File|string} driverFile - Driver file
     * @param {string} fileName - File name
     * @returns {Promise<Object>} Install result
     */
    async installDriver(driverFile, fileName) {
        const result = await this.baseService.installDriver(driverFile, fileName);
        
        // Invalidate driver caches
        invalidateCache.drivers();
        
        return result;
    }
}

// Create enhanced API instances
import { systemStatusAPI, protocolTestAPI, driverAPI } from './api.js';

export const enhancedSystemStatusAPI = new EnhancedSystemStatusAPI(systemStatusAPI);
export const enhancedProtocolTestAPI = new EnhancedProtocolTestAPI(protocolTestAPI);
export const enhancedDriverAPI = new EnhancedDriverAPI(driverAPI);

// Export for global use
if (typeof window !== 'undefined') {
    window.enhancedAPI = {
        systemStatus: enhancedSystemStatusAPI,
        protocolTest: enhancedProtocolTestAPI,
        driver: enhancedDriverAPI
    };
}