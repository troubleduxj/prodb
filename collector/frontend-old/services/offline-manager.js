/**
 * Offline Manager Service
 * Handles offline functionality, caching, and network optimization
 */

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.cacheManager = new CacheManager();
        this.networkOptimizer = new NetworkOptimizer();
        this.init();
    }

    init() {
        // Listen for online/offline events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Initialize service worker
        this.registerServiceWorker();
        
        // Start periodic sync
        this.startPeriodicSync();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    handleOnline() {
        this.isOnline = true;
        console.log('Connection restored');
        this.processOfflineQueue();
        this.syncCachedData();
        this.dispatchEvent('online');
    }

    handleOffline() {
        this.isOnline = false;
        console.log('Connection lost');
        this.dispatchEvent('offline');
    }

    // Queue operations for offline processing
    queueOperation(operation) {
        this.offlineQueue.push({
            ...operation,
            timestamp: Date.now(),
            id: this.generateId()
        });
        this.saveOfflineQueue();
    }

    // Process queued operations when online
    async processOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;

        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        for (const operation of queue) {
            try {
                await this.executeOperation(operation);
            } catch (error) {
                console.error('Failed to process offline operation:', error);
                // Re-queue failed operations
                this.offlineQueue.push(operation);
            }
        }
        
        this.saveOfflineQueue();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    async executeOperation(operation) {
        // Execute the queued operation
        switch (operation.type) {
            case 'api_call':
                return fetch(operation.url, operation.options);
            case 'config_save':
                return this.saveConfig(operation.data);
            case 'test_result':
                return this.saveTestResult(operation.data);
            default:
                console.warn('Unknown operation type:', operation.type);
        }
    }

    saveOfflineQueue() {
        try {
            localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    loadOfflineQueue() {
        try {
            const queue = localStorage.getItem('offline_queue');
            return queue ? JSON.parse(queue) : [];
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            return [];
        }
    }

    async syncCachedData() {
        // Sync any cached data that needs to be uploaded
        const cachedData = await this.cacheManager.getPendingSync();
        
        for (const data of cachedData) {
            try {
                await this.uploadCachedData(data);
                await this.cacheManager.markSynced(data.id);
            } catch (error) {
                console.error('Failed to sync cached data:', error);
            }
        }
    }

    startPeriodicSync() {
        setInterval(() => {
            if (this.isOnline) {
                this.processOfflineQueue();
                this.syncCachedData();
            }
        }, 30000); // Sync every 30 seconds
    }

    dispatchEvent(type, data = {}) {
        window.dispatchEvent(new CustomEvent(`offline-manager-${type}`, { detail: data }));
    }

    showUpdateNotification() {
        // Show notification about available update
        this.dispatchEvent('update-available');
    }

    async uploadCachedData(data) {
        // Upload cached data to server
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        return response.json();
    }

    async saveConfig(data) {
        return this.cacheManager.store('configs', data);
    }

    async saveTestResult(data) {
        return this.cacheManager.store('test_results', data);
    }
}

// Cache Manager for offline data storage
class CacheManager {
    constructor() {
        this.dbName = 'ProDBCollectorCache';
        this.version = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('configs')) {
                    const configStore = db.createObjectStore('configs', { keyPath: 'id' });
                    configStore.createIndex('timestamp', 'timestamp');
                }
                
                if (!db.objectStoreNames.contains('test_results')) {
                    const testStore = db.createObjectStore('test_results', { keyPath: 'id' });
                    testStore.createIndex('timestamp', 'timestamp');
                }
                
                if (!db.objectStoreNames.contains('system_status')) {
                    const statusStore = db.createObjectStore('system_status', { keyPath: 'id' });
                    statusStore.createIndex('timestamp', 'timestamp');
                }
            };
        });
    }

    async store(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.put({
                ...data,
                id: data.id || this.generateId(),
                timestamp: Date.now(),
                synced: false
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, limit = 100) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const results = request.result.slice(0, limit);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingSync() {
        const stores = ['configs', 'test_results', 'system_status'];
        const pendingData = [];
        
        for (const storeName of stores) {
            const data = await this.getAll(storeName);
            const pending = data.filter(item => !item.synced);
            pendingData.push(...pending);
        }
        
        return pendingData;
    }

    async markSynced(id) {
        // Mark item as synced across all stores
        const stores = ['configs', 'test_results', 'system_status'];
        
        for (const storeName of stores) {
            try {
                const item = await this.get(storeName, id);
                if (item) {
                    item.synced = true;
                    await this.store(storeName, item);
                }
            } catch (error) {
                // Item not found in this store, continue
            }
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

// Network Optimizer for poor network conditions
class NetworkOptimizer {
    constructor() {
        this.connectionType = this.getConnectionType();
        this.isSlowConnection = this.checkSlowConnection();
        this.requestQueue = [];
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        // Monitor connection changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this.connectionType = this.getConnectionType();
                this.isSlowConnection = this.checkSlowConnection();
                this.adjustOptimizations();
            });
        }
    }

    getConnectionType() {
        if ('connection' in navigator) {
            return navigator.connection.effectiveType || 'unknown';
        }
        return 'unknown';
    }

    checkSlowConnection() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            return connection.effectiveType === 'slow-2g' || 
                   connection.effectiveType === '2g' ||
                   connection.downlink < 1.5;
        }
        return false;
    }

    adjustOptimizations() {
        if (this.isSlowConnection) {
            // Enable aggressive optimizations for slow connections
            this.enableDataCompression();
            this.reducePollingFrequency();
            this.prioritizeRequests();
        } else {
            // Normal optimizations
            this.restoreNormalBehavior();
        }
    }

    enableDataCompression() {
        // Request compressed responses
        this.defaultHeaders = {
            'Accept-Encoding': 'gzip, deflate, br'
        };
    }

    reducePollingFrequency() {
        // Reduce real-time update frequency
        window.dispatchEvent(new CustomEvent('network-slow', {
            detail: { pollingInterval: 10000 } // 10 seconds instead of 5
        }));
    }

    prioritizeRequests() {
        // Implement request prioritization
        this.requestQueue.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
        });
    }

    restoreNormalBehavior() {
        window.dispatchEvent(new CustomEvent('network-normal', {
            detail: { pollingInterval: 5000 }
        }));
    }

    async optimizedFetch(url, options = {}) {
        const priority = options.priority || 'medium';
        
        if (this.isSlowConnection) {
            // Queue non-critical requests
            if (priority === 'low') {
                return this.queueRequest(url, options);
            }
        }
        
        // Add optimization headers
        const optimizedOptions = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            }
        };
        
        return fetch(url, optimizedOptions);
    }

    queueRequest(url, options) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                url,
                options,
                resolve,
                reject,
                priority: options.priority || 'medium',
                timestamp: Date.now()
            });
            
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                const response = await fetch(request.url, request.options);
                request.resolve(response);
            } catch (error) {
                request.reject(error);
            }
            
            // Add delay between requests on slow connections
            if (this.isSlowConnection) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        this.isProcessing = false;
    }
}

// Export the offline manager
export default OfflineManager;
export { CacheManager, NetworkOptimizer };