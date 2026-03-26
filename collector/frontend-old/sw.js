/**
 * Enhanced Service Worker for ProDB Collector
 * Provides advanced offline functionality, caching, and performance optimizations
 */

const VERSION = '1.0.0';
const CACHE_NAME = `prodb-collector-v${VERSION}`;
const STATIC_CACHE_NAME = `prodb-collector-static-v${VERSION}`;
const DYNAMIC_CACHE_NAME = `prodb-collector-dynamic-v${VERSION}`;
const API_CACHE_NAME = `prodb-collector-api-v${VERSION}`;
const IMAGE_CACHE_NAME = `prodb-collector-images-v${VERSION}`;

// Enhanced caching configuration
const CACHE_CONFIG = {
    // Static files to cache immediately
    staticFiles: [
        '/',
        '/index.html',
        '/app.js',
        '/styles/main.css',
        '/styles/components.css',
        '/styles/themes.css',
        '/styles/mobile-optimization.css',
        '/styles/ux-enhancements.css',
        '/styles/performance.css',
        '/manifest.json'
    ],
    
    // Critical components to cache
    criticalComponents: [
        '/components/Layout.js',
        '/components/StatusIndicator.js',
        '/components/QuickActions.js',
        '/pages/DashboardPage.js',
        '/services/api.js',
        '/services/offline-manager.js',
        '/utils/helpers.js'
    ],
    
    // Cache expiration times (in seconds)
    expiration: {
        static: 30 * 24 * 60 * 60,    // 30 days
        dynamic: 7 * 24 * 60 * 60,    // 7 days
        api: 5 * 60,                  // 5 minutes
        images: 30 * 24 * 60 * 60     // 30 days
    },
    
    // Maximum cache entries
    maxEntries: {
        static: 100,
        dynamic: 50,
        api: 100,
        images: 30
    }
};

// All files to cache initially
const STATIC_FILES = [...CACHE_CONFIG.staticFiles, ...CACHE_CONFIG.criticalComponents];

// API endpoints to cache
const API_CACHE_PATTERNS = [
    /^\/api\/v1\/status$/,
    /^\/api\/v1\/interfaces$/,
    /^\/api\/v1\/protocols\/supported$/
];

// Performance monitoring
const performanceMonitor = {
    startTime: Date.now(),
    metrics: {
        cacheHits: 0,
        cacheMisses: 0,
        networkRequests: 0,
        errors: 0,
        offlineRequests: 0
    },
    
    recordCacheHit() { this.metrics.cacheHits++; },
    recordCacheMiss() { this.metrics.cacheMisses++; },
    recordNetworkRequest() { this.metrics.networkRequests++; },
    recordError() { this.metrics.errors++; },
    recordOfflineRequest() { this.metrics.offlineRequests++; },
    
    getStats() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.startTime,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
        };
    }
};

// Install event - enhanced caching with performance monitoring
self.addEventListener('install', (event) => {
    console.log(`Service Worker v${VERSION} installing...`);
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            }),
            
            // Initialize other caches
            caches.open(DYNAMIC_CACHE_NAME),
            caches.open(API_CACHE_NAME),
            caches.open(IMAGE_CACHE_NAME)
        ])
        .then(() => {
            console.log('All caches initialized successfully');
            return self.skipWaiting();
        })
        .catch((error) => {
            console.error('Failed to initialize caches:', error);
            performanceMonitor.recordError();
        })
    );
});

// Activate event - enhanced cache cleanup and optimization
self.addEventListener('activate', (event) => {
    console.log(`Service Worker v${VERSION} activating...`);
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Keep current version caches
                        const currentCaches = [
                            CACHE_NAME, STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME, 
                            API_CACHE_NAME, IMAGE_CACHE_NAME
                        ];
                        
                        if (!currentCaches.includes(cacheName)) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Clean up expired cache entries
            cleanupExpiredCaches(),
            
            // Initialize performance monitoring
            initializePerformanceMonitoring()
        ])
        .then(() => {
            console.log('Service Worker activated and optimized');
            return self.clients.claim();
        })
        .catch((error) => {
            console.error('Activation failed:', error);
            performanceMonitor.recordError();
        })
    );
});

// Enhanced fetch event handler with intelligent routing
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests for caching
    if (request.method !== 'GET') {
        // Handle POST/PUT/DELETE with background sync
        if (request.method === 'POST' && isAPIRequest(url.pathname)) {
            event.respondWith(handleMutationRequest(request));
        }
        return;
    }
    
    // Route requests to appropriate caching strategies
    if (isStaticFile(url.pathname)) {
        event.respondWith(enhancedCacheFirst(request, STATIC_CACHE_NAME));
    } else if (isImageRequest(url.pathname)) {
        event.respondWith(enhancedCacheFirst(request, IMAGE_CACHE_NAME));
    } else if (isAPIRequest(url.pathname)) {
        event.respondWith(enhancedNetworkFirst(request, API_CACHE_NAME));
    } else if (isNavigationRequest(request)) {
        event.respondWith(enhancedNavigationHandler(request));
    } else if (isExternalResource(url)) {
        event.respondWith(enhancedStaleWhileRevalidate(request, DYNAMIC_CACHE_NAME));
    } else {
        // Default: try network with cache fallback
        event.respondWith(enhancedNetworkFirst(request, DYNAMIC_CACHE_NAME));
    }
});

/**
 * Enhanced Cache First strategy with performance monitoring
 */
async function enhancedCacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            performanceMonitor.recordCacheHit();
            
            // Update cache in background if resource is stale
            if (isResourceStale(cachedResponse)) {
                updateCacheInBackground(request, cache);
            }
            
            return cachedResponse;
        }
        
        performanceMonitor.recordCacheMiss();
        performanceMonitor.recordNetworkRequest();
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Clone and cache the response
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
            
            // Manage cache size
            await manageCacheSize(cache, cacheName);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Enhanced cache first failed:', error);
        performanceMonitor.recordError();
        
        // Try to serve stale content if available
        const staleResponse = await caches.match(request);
        if (staleResponse) {
            return addStaleHeaders(staleResponse);
        }
        
        return createOfflineResponse(request);
    }
}

/**
 * Enhanced Network First strategy with intelligent fallback
 */
async function enhancedNetworkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        performanceMonitor.recordNetworkRequest();
        
        // Add timeout to network request
        const networkResponse = await fetchWithTimeout(request, 5000);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
            
            // Manage cache size
            await manageCacheSize(cache, cacheName);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', error);
        performanceMonitor.recordError();
        
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            performanceMonitor.recordCacheHit();
            return addStaleHeaders(cachedResponse);
        }
        
        performanceMonitor.recordOfflineRequest();
        
        // Return intelligent offline response based on request type
        if (isAPIRequest(new URL(request.url).pathname)) {
            return createOfflineAPIResponse(request);
        }
        
        return createOfflineResponse(request);
    }
}

/**
 * Enhanced Stale While Revalidate strategy
 */
async function enhancedStaleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Always try to update cache in background
    const networkUpdate = fetch(request)
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => {}); // Ignore network errors
    
    if (cachedResponse) {
        performanceMonitor.recordCacheHit();
        // Serve from cache immediately, update in background
        return cachedResponse;
    }
    
    // No cache, wait for network
    try {
        performanceMonitor.recordCacheMiss();
        performanceMonitor.recordNetworkRequest();
        return await networkUpdate;
    } catch (error) {
        performanceMonitor.recordError();
        return createOfflineResponse(request);
    }
}

/**
 * Enhanced navigation handler with app shell architecture
 */
async function enhancedNavigationHandler(request) {
    try {
        performanceMonitor.recordNetworkRequest();
        const networkResponse = await fetchWithTimeout(request, 3000);
        return networkResponse;
    } catch (error) {
        console.log('Navigation offline, serving app shell');
        performanceMonitor.recordOfflineRequest();
        
        // Serve cached index.html for SPA navigation
        const cachedResponse = await caches.match('/index.html');
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Enhanced offline page with better UX
        return createEnhancedOfflinePage();
    }
}

/**
 * Handle mutation requests (POST/PUT/DELETE) with background sync
 */
async function handleMutationRequest(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (error) {
        // Queue for background sync
        await queueForBackgroundSync(request);
        
        return new Response(
            JSON.stringify({
                queued: true,
                message: 'Request queued for when connection is restored'
            }),
            {
                status: 202,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Utility Functions
 */

// Fetch with timeout
async function fetchWithTimeout(request, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Check if resource is stale
function isResourceStale(response) {
    const cacheDate = new Date(response.headers.get('date') || 0);
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return (now - cacheDate) > maxAge;
}

// Update cache in background
async function updateCacheInBackground(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response);
        }
    } catch (error) {
        // Ignore background update errors
    }
}

// Add stale headers to response
function addStaleHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set('X-Served-From-Cache', 'true');
    headers.set('X-Cache-Date', response.headers.get('date') || 'unknown');
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

// Manage cache size to prevent unlimited growth
async function manageCacheSize(cache, cacheName) {
    const maxEntries = CACHE_CONFIG.maxEntries[getCacheType(cacheName)] || 50;
    
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        // Remove oldest entries (simple FIFO)
        const entriesToDelete = keys.slice(0, keys.length - maxEntries);
        await Promise.all(entriesToDelete.map(key => cache.delete(key)));
    }
}

// Get cache type from cache name
function getCacheType(cacheName) {
    if (cacheName.includes('static')) return 'static';
    if (cacheName.includes('api')) return 'api';
    if (cacheName.includes('images')) return 'images';
    return 'dynamic';
}

// Create offline API response
function createOfflineAPIResponse(request) {
    const url = new URL(request.url);
    
    return new Response(
        JSON.stringify({
            error: 'Network unavailable',
            message: 'This API endpoint is not available offline',
            endpoint: url.pathname,
            timestamp: Date.now(),
            cached: false
        }),
        {
            status: 503,
            headers: { 
                'Content-Type': 'application/json',
                'X-Offline-Response': 'true'
            }
        }
    );
}

// Create generic offline response
function createOfflineResponse(request) {
    return new Response('Service unavailable - offline', {
        status: 503,
        headers: { 'X-Offline-Response': 'true' }
    });
}

// Create enhanced offline page
function createEnhancedOfflinePage() {
    return new Response(`
        <!DOCTYPE html>
        <html lang="en" data-theme="dark">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ProDB Collector - Offline</title>
            <style>
                :root {
                    --bg-primary: #0f172a;
                    --bg-secondary: #1e293b;
                    --text-primary: #f8fafc;
                    --text-secondary: #cbd5e1;
                    --color-warning: #f59e0b;
                    --color-primary: #2563eb;
                    --border-radius: 8px;
                }
                
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 2rem;
                }
                
                .offline-container {
                    text-align: center;
                    max-width: 500px;
                    background: var(--bg-secondary);
                    padding: 3rem 2rem;
                    border-radius: var(--border-radius);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                }
                
                .offline-icon {
                    font-size: 4rem;
                    margin-bottom: 1.5rem;
                    color: var(--color-warning);
                }
                
                h1 {
                    color: var(--color-warning);
                    margin-bottom: 1rem;
                    font-size: 1.5rem;
                }
                
                p {
                    color: var(--text-secondary);
                    margin-bottom: 2rem;
                    line-height: 1.6;
                }
                
                .actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                button {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                
                button:hover {
                    background: #1d4ed8;
                    transform: translateY(-1px);
                }
                
                .secondary-btn {
                    background: transparent;
                    border: 1px solid var(--text-secondary);
                    color: var(--text-secondary);
                }
                
                .secondary-btn:hover {
                    background: var(--text-secondary);
                    color: var(--bg-primary);
                }
                
                .status-info {
                    margin-top: 2rem;
                    padding: 1rem;
                    background: rgba(245, 158, 11, 0.1);
                    border-radius: var(--border-radius);
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                
                @media (max-width: 480px) {
                    .offline-container { padding: 2rem 1rem; }
                    .actions { flex-direction: column; }
                    button { width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">🔌</div>
                <h1>You're Currently Offline</h1>
                <p>ProDB Collector requires an internet connection to function properly. Some cached data may still be available.</p>
                
                <div class="actions">
                    <button onclick="window.location.reload()">Try Again</button>
                    <button class="secondary-btn" onclick="showCachedData()">View Cached Data</button>
                </div>
                
                <div class="status-info">
                    <strong>Offline Mode:</strong> Limited functionality available.<br>
                    Connection will be restored automatically when available.
                </div>
            </div>
            
            <script>
                function showCachedData() {
                    // Try to navigate to cached dashboard
                    window.location.href = '/';
                }
                
                // Auto-retry connection
                let retryCount = 0;
                const maxRetries = 5;
                
                function checkConnection() {
                    if (navigator.onLine && retryCount < maxRetries) {
                        retryCount++;
                        fetch('/', { method: 'HEAD', cache: 'no-cache' })
                            .then(() => {
                                window.location.reload();
                            })
                            .catch(() => {
                                setTimeout(checkConnection, 5000 * retryCount);
                            });
                    }
                }
                
                // Start checking connection
                setTimeout(checkConnection, 2000);
                
                // Listen for online event
                window.addEventListener('online', () => {
                    setTimeout(() => window.location.reload(), 1000);
                });
            </script>
        </body>
        </html>
    `, {
        headers: { 
            'Content-Type': 'text/html',
            'X-Offline-Page': 'true'
        }
    });
}

/**
 * Enhanced request type detection
 */
function isStaticFile(pathname) {
    const staticExtensions = ['.css', '.js', '.json', '.html', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname === '/';
}

function isImageRequest(pathname) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'];
    return imageExtensions.some(ext => pathname.endsWith(ext));
}

function isAPIRequest(pathname) {
    return pathname.startsWith('/api/') ||
           API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
           (request.method === 'GET' && 
            request.headers.get('accept') && 
            request.headers.get('accept').includes('text/html'));
}

function isExternalResource(url) {
    return url.origin !== self.location.origin;
}

/**
 * Cache management and cleanup functions
 */
async function cleanupExpiredCaches() {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response && isResponseExpired(response, cacheName)) {
                await cache.delete(request);
            }
        }
    }
}

function isResponseExpired(response, cacheName) {
    const cacheDate = new Date(response.headers.get('date') || 0);
    const now = new Date();
    const cacheType = getCacheType(cacheName);
    const maxAge = CACHE_CONFIG.expiration[cacheType] * 1000;
    
    return (now - cacheDate) > maxAge;
}

async function initializePerformanceMonitoring() {
    // Send performance stats to main thread periodically
    setInterval(() => {
        const stats = performanceMonitor.getStats();
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_PERFORMANCE_STATS',
                    data: stats
                });
            });
        });
    }, 60000); // Every minute
}

/**
 * Background sync functionality
 */
const backgroundSyncQueue = [];

async function queueForBackgroundSync(request) {
    const requestData = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.text(),
        timestamp: Date.now()
    };
    
    backgroundSyncQueue.push(requestData);
    
    // Try to register background sync
    if ('serviceWorker' in self && 'sync' in self.registration) {
        try {
            await self.registration.sync.register('background-sync');
        } catch (error) {
            console.log('Background sync registration failed:', error);
        }
    }
}

// Enhanced message handling from main thread
self.addEventListener('message', (event) => {
    const { data } = event;
    
    if (!data || !data.type) return;
    
    switch (data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_URLS':
            handleCacheUrls(data.urls, event.ports[0]);
            break;
            
        case 'GET_CACHE_STATUS':
            handleGetCacheStatus(event.ports[0]);
            break;
            
        case 'CLEAR_CACHE':
            handleClearCache(data.cacheType, event.ports[0]);
            break;
            
        case 'GET_PERFORMANCE_STATS':
            event.ports[0].postMessage({
                success: true,
                data: performanceMonitor.getStats()
            });
            break;
            
        case 'PREFETCH_RESOURCES':
            handlePrefetchResources(data.resources);
            break;
            
        default:
            console.log('Unknown message type:', data.type);
    }
});

/**
 * Enhanced message handlers
 */
async function handleCacheUrls(urls, port) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.addAll(urls);
        
        port.postMessage({ 
            success: true, 
            cached: urls.length 
        });
    } catch (error) {
        port.postMessage({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handleGetCacheStatus(port) {
    try {
        const cacheNames = await caches.keys();
        const status = {};
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            status[cacheName] = {
                entries: keys.length,
                type: getCacheType(cacheName)
            };
        }
        
        port.postMessage({ 
            success: true, 
            data: status 
        });
    } catch (error) {
        port.postMessage({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handleClearCache(cacheType, port) {
    try {
        const cacheNames = await caches.keys();
        let cleared = 0;
        
        for (const cacheName of cacheNames) {
            if (!cacheType || getCacheType(cacheName) === cacheType) {
                await caches.delete(cacheName);
                cleared++;
            }
        }
        
        port.postMessage({ 
            success: true, 
            cleared 
        });
    } catch (error) {
        port.postMessage({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handlePrefetchResources(resources) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        
        for (const resource of resources) {
            try {
                const response = await fetch(resource);
                if (response.ok) {
                    await cache.put(resource, response);
                }
            } catch (error) {
                console.log('Failed to prefetch:', resource);
            }
        }
    } catch (error) {
        console.error('Prefetch failed:', error);
    }
}

// Enhanced background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doEnhancedBackgroundSync());
    }
});

/**
 * Enhanced background sync with retry logic
 */
async function doEnhancedBackgroundSync() {
    console.log('Background sync triggered, processing queue...');
    
    const itemsToProcess = [...backgroundSyncQueue];
    backgroundSyncQueue.length = 0; // Clear the queue
    
    for (const item of itemsToProcess) {
        try {
            const response = await fetch(item.url, {
                method: item.method,
                headers: item.headers,
                body: item.body
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            console.log('Successfully synced:', item.url);
            
            // Notify clients of successful sync
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_SUCCESS',
                        data: { url: item.url, timestamp: item.timestamp }
                    });
                });
            });
            
        } catch (error) {
            console.error('Sync failed for:', item.url, error);
            
            // Re-queue if not too old (max 24 hours)
            const maxAge = 24 * 60 * 60 * 1000;
            if (Date.now() - item.timestamp < maxAge) {
                backgroundSyncQueue.push(item);
            }
            
            // Notify clients of sync failure
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_FAILED',
                        data: { url: item.url, error: error.message }
                    });
                });
            });
        }
    }
}

// Push notification handler (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: data.tag || 'default',
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || []
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action) {
        // Handle action button clicks
        console.log('Notification action clicked:', event.action);
    } else {
        // Handle notification click
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});