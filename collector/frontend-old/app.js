/**
 * ProDB Collector Frontend Application
 * Main application entry point with optimized loading and error handling
 */

import { render, h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import components and pages
import Layout from './components/Layout.js';
import DashboardPage from './pages/DashboardPage.js';
import NodesPage from './pages/NodesPage.js';
import ConfigPage from './pages/ConfigPage.js';

// Import performance utilities
import { lazyLoad, preloadComponents } from './utils/lazy-loader.js';
import { enhancedSystemStatusAPI } from './services/enhanced-api.js';

// Import services for initialization
import { systemStatusAPI } from './services/api.js';
import { protocolService } from './services/protocols.js';
import { driverService } from './services/drivers.js';
import { globalEvents, devLog } from './utils/helpers.js';
import OfflineManager from './services/offline-manager.js';
import NetworkAwareAPI from './services/network-aware-api.js';

// Import UX enhancements
import { UXProvider, tourManager, smartNotifications } from './components/UXIntegration.js';
import { feedbackManager } from './components/FeedbackSystem.js';

const html = htm.bind(h);

// Mobile optimization initialization
const initializeMobileOptimizations = () => {
    // Add slow connection class for CSS optimizations
    if ('connection' in navigator) {
        const updateConnectionClass = () => {
            const connection = navigator.connection;
            const isSlowConnection = connection.effectiveType === 'slow-2g' || 
                                   connection.effectiveType === '2g' ||
                                   connection.downlink < 1.5;
            
            document.body.classList.toggle('slow-connection', isSlowConnection);
        };
        
        updateConnectionClass();
        navigator.connection.addEventListener('change', updateConnectionClass);
    }
    
    // Add mobile class for CSS optimizations
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile-device', isMobile);
    
    // Listen for resize to update mobile class
    window.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile-device', isMobile);
    });
    
    // Add touch device detection
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    document.body.classList.toggle('touch-device', isTouchDevice);
    
    // Initialize notification system for offline events
    window.addEventListener('offline-manager-offline', () => {
        showNotification('You are now offline. Some features may be limited.', 'warning');
    });
    
    window.addEventListener('offline-manager-online', () => {
        showNotification('Connection restored. Syncing offline changes...', 'success');
    });
    
    window.addEventListener('show-notification', (event) => {
        const { type, message, duration } = event.detail;
        showNotification(message, type, duration);
    });
    
    devLog('Mobile optimizations initialized');
};

// Simple notification system
const showNotification = (message, type = 'info', duration = 5000) => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        info: '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
};

// Error Boundary Component
const ErrorBoundary = ({ children, fallback }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleError = (event) => {
            setHasError(true);
            setError(event.error);
            devLog('Error caught by boundary:', event.error);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleError);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleError);
        };
    }, []);

    if (hasError) {
        return fallback ? fallback(error) : html`
            <div class="error-boundary">
                <div class="error-content">
                    <h2>Something went wrong</h2>
                    <p>The application encountered an unexpected error.</p>
                    <details>
                        <summary>Error details</summary>
                        <pre>${error?.message || 'Unknown error'}</pre>
                    </details>
                    <button 
                        class="btn btn-primary" 
                        onClick=${() => window.location.reload()}
                    >
                        Reload Application
                    </button>
                </div>
            </div>
        `;
    }

    return children;
};

// Loading Component
const LoadingSpinner = ({ message = 'Loading...' }) => html`
    <div class="loading-container">
        <div class="loading-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    </div>
`;

// Router Component
const Router = () => {
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    const [isLoading, setIsLoading] = useState(true);
    const [initError, setInitError] = useState(null);

    // Handle navigation
    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Initialize services
    useEffect(() => {
        const initializeApp = async () => {
            try {
                devLog('Initializing application services...');
                
                // Initialize mobile optimization services
                const offlineManager = new OfflineManager();
                const networkAwareAPI = new NetworkAwareAPI();
                
                // Make services globally available
                window.offlineManager = offlineManager;
                window.networkAwareAPI = networkAwareAPI;
                
                // Initialize services in parallel
                await Promise.all([
                    protocolService.initialize?.() || Promise.resolve(),
                    driverService.initialize?.() || Promise.resolve()
                ]);

                // Test API connectivity
                try {
                    await systemStatusAPI.getStatus();
                    devLog('API connectivity confirmed');
                } catch (apiError) {
                    console.warn('API not available, running in offline mode:', apiError.message);
                }

                // Initialize mobile-specific features
                initializeMobileOptimizations();

                // Preload critical components
                preloadComponents([
                    { importFn: () => import('./pages/TestingPage.js'), cacheKey: 'testing-page' },
                    { importFn: () => import('./pages/DriversPage.js'), cacheKey: 'drivers-page' }
                ]).catch(error => {
                    console.warn('Failed to preload some components:', error);
                });

                // Preload critical data
                enhancedSystemStatusAPI.preloadCriticalData([
                    { endpoint: '/status', cacheType: 'realtime' },
                    { endpoint: '/interfaces', cacheType: 'interfaces' }
                ]).catch(error => {
                    console.warn('Failed to preload critical data:', error);
                });

                devLog('Application initialized successfully');
                setIsLoading(false);

            } catch (error) {
                console.error('Failed to initialize application:', error);
                setInitError(error);
                setIsLoading(false);
            }
        };

        // Add a small delay to show loading screen
        setTimeout(initializeApp, 500);
    }, []);

    // Navigation helper
    const navigateTo = (path) => {
        if (path !== currentPath) {
            window.history.pushState({}, '', path);
            setCurrentPath(path);
            
            // Emit navigation event
            globalEvents.emit('navigation', { from: currentPath, to: path });
        }
    };

    // Make navigation available globally
    useEffect(() => {
        window.navigateTo = navigateTo;
    }, []);

    // Route matching
    const getPageComponent = (path) => {
        // Lazy load pages based on route
        if (path === '/' || path === '/dashboard') {
            return DashboardPage;
        } else if (path.startsWith('/nodes')) {
            return NodesPage;
        } else if (path === '/config' || path.startsWith('/config/')) {
            return ConfigPage;
        } else if (path === '/testing' || path.startsWith('/testing/')) {
            // Use lazy loading utility
            return lazyLoad(
                () => import('./pages/TestingPage.js'),
                {
                    cacheKey: 'testing-page',
                    fallback: html`<${LoadingSpinner} message="Loading Protocol Testing..." />`,
                    errorFallback: (error) => html`
                        <div class="page-container">
                            <h1>Loading Error</h1>
                            <p>Failed to load protocol testing page: ${error.message}</p>
                            <button class="btn btn-primary" onClick=${() => navigateTo('/')}>
                                Back to Dashboard
                            </button>
                        </div>
                    `
                }
            );
        } else if (path === '/drivers' || path.startsWith('/drivers/')) {
            // Use lazy loading utility
            return lazyLoad(
                () => import('./pages/DriversPage.js'),
                {
                    cacheKey: 'drivers-page',
                    fallback: html`<${LoadingSpinner} message="Loading Driver Management..." />`,
                    errorFallback: (error) => html`
                        <div class="page-container">
                            <h1>Loading Error</h1>
                            <p>Failed to load driver management page: ${error.message}</p>
                            <button class="btn btn-primary" onClick=${() => navigateTo('/')}>
                                Back to Dashboard
                            </button>
                        </div>
                    `
                }
            );
        } else if (path === '/performance' || path.startsWith('/performance/')) {
            // Performance demo page
            return lazyLoad(
                () => import('./components/PerformanceDemo.js'),
                {
                    cacheKey: 'performance-demo',
                    fallback: html`<${LoadingSpinner} message="Loading Performance Demo..." />`,
                    errorFallback: (error) => html`
                        <div class="page-container">
                            <h1>Loading Error</h1>
                            <p>Failed to load performance demo: ${error.message}</p>
                            <button class="btn btn-primary" onClick=${() => navigateTo('/')}>
                                Back to Dashboard
                            </button>
                        </div>
                    `
                }
            );
        } else {
            // 404 page
            return () => html`
                <div class="page-container">
                    <h1>Page Not Found</h1>
                    <p>The page you're looking for doesn't exist.</p>
                    <button class="btn btn-primary" onClick=${() => navigateTo('/')}>
                        Go to Dashboard
                    </button>
                </div>
            `;
        }
    };

    // Show loading screen during initialization
    if (isLoading) {
        return html`<${LoadingSpinner} message="Initializing ProDB Collector..." />`;
    }

    // Show initialization error
    if (initError) {
        return html`
            <div class="error-container">
                <div class="error-content">
                    <h2>Initialization Failed</h2>
                    <p>Failed to initialize the application. Please check your connection and try again.</p>
                    <details>
                        <summary>Error details</summary>
                        <pre>${initError.message}</pre>
                    </details>
                    <button 
                        class="btn btn-primary" 
                        onClick=${() => window.location.reload()}
                    >
                        Retry
                    </button>
                </div>
            </div>
        `;
    }

    const PageComponent = getPageComponent(currentPath);

    return html`
        <${Layout} currentPath=${currentPath} navigateTo=${navigateTo}>
            <${PageComponent} navigateTo=${navigateTo} />
        <//>
    `;
};

// Main App Component
const App = () => {
    const [themeMode, setThemeMode] = useState(
        localStorage.getItem('theme') || 'dark'
    );

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    // Theme toggle function
    const toggleTheme = () => {
        const newTheme = themeMode === 'dark' ? 'light' : 'dark';
        setThemeMode(newTheme);
        globalEvents.emit('themeChanged', newTheme);
    };

    // Make theme functions available globally
    useEffect(() => {
        window.toggleTheme = toggleTheme;
        window.getCurrentTheme = () => themeMode;
    }, [themeMode]);

    return html`
        <${UXProvider}>
            <${Router} />
        <//>
    `;
};

// Initialize UX enhancements
const initializeUXEnhancements = () => {
    try {
        // Initialize feedback system
        feedbackManager.init();
        
        // Set up global error handling for UX feedback
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            smartNotifications.error('An unexpected error occurred. Please try again.');
        });
        
        // Set up performance monitoring for UX feedback
        if ('performance' in window && 'navigation' in performance) {
            const navigationTiming = performance.getEntriesByType('navigation')[0];
            if (navigationTiming && navigationTiming.loadEventEnd > 5000) {
                smartNotifications.warning('Application loaded slowly. Consider checking your network connection.');
            }
        }
        
        // Initialize contextual help based on URL
        const initializeContextualHelp = () => {
            const hash = window.location.hash;
            let context = 'general';
            
            if (hash.includes('dashboard')) context = 'dashboard';
            else if (hash.includes('interfaces') || hash.includes('config')) context = 'interfaces';
            else if (hash.includes('testing')) context = 'testing';
            else if (hash.includes('drivers')) context = 'drivers';
            
            // Store current context for help system
            window.currentHelpContext = context;
        };
        
        initializeContextualHelp();
        window.addEventListener('hashchange', initializeContextualHelp);
        
        // Set up keyboard shortcuts info
        setTimeout(() => {
            const hasSeenShortcuts = localStorage.getItem('has-seen-shortcuts');
            if (!hasSeenShortcuts) {
                smartNotifications.info('Tip: Press F1 for help or Ctrl+/ for keyboard shortcuts', {
                    duration: 8000,
                    actions: [{
                        label: 'Got it',
                        onClick: () => {
                            localStorage.setItem('has-seen-shortcuts', 'true');
                        }
                    }]
                });
            }
        }, 3000);
        
        devLog('UX enhancements initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize UX enhancements:', error);
    }
};

// Application startup
const startApp = () => {
    try {
        devLog('Starting ProDB Collector application...');
        
        const appContainer = document.getElementById('app');
        if (!appContainer) {
            throw new Error('App container not found');
        }

        render(html`<${App} />`, appContainer);
        
        // Initialize UX enhancements
        initializeUXEnhancements();
        
        devLog('Application started successfully');

        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 300);
            }, 100);
        }

    } catch (error) {
        console.error('Failed to start application:', error);
        
        // Show error fallback
        const errorFallback = document.getElementById('error-fallback');
        if (errorFallback) {
            errorFallback.style.display = 'flex';
        }
    }
};

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Export for debugging
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.app = {
        systemStatusAPI,
        protocolService,
        driverService,
        globalEvents
    };
}
