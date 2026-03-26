/**
 * Network-Aware API Service
 * Optimizes API calls based on network conditions and provides offline support
 */
import OfflineManager from './offline-manager.js';

class NetworkAwareAPI {
    constructor(baseURL = '/api/v1') {
        this.baseURL = baseURL;
        this.offlineManager = new OfflineManager();
        this.requestQueue = new Map();
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.timeouts = {
            fast: 5000,
            slow: 15000,
            offline: 30000
        };
        
        this.init();
    }

    init() {
        // Listen for network changes
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Listen for network quality changes
        window.addEventListener('network-slow', this.handleSlowNetwork.bind(this));
        window.addEventListener('network-normal', this.handleNormalNetwork.bind(this));
    }

    handleOnline() {
        console.log('Network restored - processing queued requests');
        this.processQueuedRequests();
    }

    handleOffline() {
        console.log('Network lost - enabling offline mode');
        this.cancelPendingRequests();
    }

    handleSlowNetwork(event) {
        console.log('Slow network detected - adjusting timeouts');
        this.adjustForSlowNetwork();
    }

    handleNormalNetwork(event) {
        console.log('Normal network speed - restoring default timeouts');
        this.restoreNormalTimeouts();
    }

    getNetworkTimeout() {
        if (!navigator.onLine) return this.timeouts.offline;
        
        if ('connection' in navigator) {
            const connection = navigator.connection;
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                return this.timeouts.slow;
            }
        }
        
        return this.timeouts.fast;
    }

    async request(endpoint, options = {}) {
        const requestId = this.generateRequestId();
        const url = `${this.baseURL}${endpoint}`;
        
        // Check if we're offline
        if (!navigator.onLine) {
            return this.handleOfflineRequest(url, options, requestId);
        }

        // Configure request with network-aware settings
        const networkAwareOptions = this.configureNetworkOptions(options);
        
        try {
            const response = await this.executeRequest(url, networkAwareOptions, requestId);
            this.clearRetryCount(requestId);
            return await this.parseResponse(response);
        } catch (error) {
            return this.handleRequestError(error, url, options, requestId);
        }
    }

    configureNetworkOptions(options) {
        const timeout = this.getNetworkTimeout();
        
        return {
            ...options,
            signal: AbortSignal.timeout(timeout),
            headers: {
                'Cache-Control': this.getCacheControl(),
                'Accept-Encoding': 'gzip, deflate, br',
                ...options.headers
            }
        };
    }

    getCacheControl() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                return 'max-age=300'; // 5 minutes cache for slow connections
            }
        }
        return 'max-age=60'; // 1 minute cache for normal connections
    }

    async executeRequest(url, options, requestId) {
        // Store request for potential cancellation
        const controller = new AbortController();
        this.requestQueue.set(requestId, controller);
        
        const requestOptions = {
            ...options,
            signal: controller.signal
        };

        try {
            const response = await fetch(url, requestOptions);
            this.requestQueue.delete(requestId);
            return response;
        } catch (error) {
            this.requestQueue.delete(requestId);
            throw error;
        }
    }

    async handleRequestError(error, url, options, requestId) {
        // Check if it's a network error that we can retry
        if (this.isRetryableError(error)) {
            const retryCount = this.getRetryCount(requestId);
            
            if (retryCount < this.maxRetries) {
                console.log(`Retrying request ${requestId}, attempt ${retryCount + 1}`);
                this.incrementRetryCount(requestId);
                
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return this.request(url.replace(this.baseURL, ''), options);
            }
        }

        // If we can't retry, try offline handling
        if (this.shouldFallbackToOffline(error)) {
            return this.handleOfflineRequest(url, options, requestId);
        }

        throw error;
    }

    async handleOfflineRequest(url, options, requestId) {
        // Try to get cached response first
        const cachedResponse = await this.getCachedResponse(url, options);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Queue request for when online
        if (options.method !== 'GET') {
            this.offlineManager.queueOperation({
                type: 'api_call',
                url,
                options,
                requestId
            });
            
            return {
                success: false,
                offline: true,
                message: 'Request queued for when connection is restored'
            };
        }

        // For GET requests, return offline error
        throw new Error('No cached data available offline');
    }

    async getCachedResponse(url, options) {
        try {
            const cache = await caches.open('prodb-collector-v1');
            const cachedResponse = await cache.match(url);
            
            if (cachedResponse) {
                const data = await cachedResponse.json();
                return {
                    ...data,
                    _cached: true,
                    _cacheTime: cachedResponse.headers.get('date')
                };
            }
        } catch (error) {
            console.warn('Failed to get cached response:', error);
        }
        
        return null;
    }

    isRetryableError(error) {
        return error.name === 'TypeError' || // Network error
               error.name === 'AbortError' || // Timeout
               (error.status >= 500 && error.status < 600); // Server errors
    }

    shouldFallbackToOffline(error) {
        return error.name === 'TypeError' || // Network error
               error.name === 'AbortError'; // Timeout
    }

    getRetryCount(requestId) {
        return this.retryAttempts.get(requestId) || 0;
    }

    incrementRetryCount(requestId) {
        const current = this.getRetryCount(requestId);
        this.retryAttempts.set(requestId, current + 1);
    }

    clearRetryCount(requestId) {
        this.retryAttempts.delete(requestId);
    }

    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    cancelPendingRequests() {
        for (const [requestId, controller] of this.requestQueue) {
            controller.abort();
        }
        this.requestQueue.clear();
    }

    async processQueuedRequests() {
        // This would be handled by the OfflineManager
        // Just trigger the processing
        await this.offlineManager.processOfflineQueue();
    }

    adjustForSlowNetwork() {
        this.timeouts.fast = 10000;
        this.timeouts.slow = 20000;
    }

    restoreNormalTimeouts() {
        this.timeouts.fast = 5000;
        this.timeouts.slow = 15000;
    }

    async parseResponse(response) {
        if (!response.ok) {
            const errorData = await this.parseErrorResponse(response);
            throw new APIError(
                errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                errorData
            );
        }

        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    async parseErrorResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return { message: await response.text() };
        } catch {
            return { message: `HTTP ${response.status}: ${response.statusText}` };
        }
    }

    // Convenience methods
    async get(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseURL);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        return this.request(url.pathname + url.search);
    }

    async post(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : null,
        });
    }

    async put(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : null,
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }
}

class APIError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.response = response;
    }
}

export default NetworkAwareAPI;
export { APIError };