/**
 * Lazy Loading Utilities
 * Provides dynamic import functionality for components and pages
 */

import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { html } from 'https://esm.sh/htm/preact';
import { devLog } from './helpers.js';

// Cache for loaded modules to avoid re-importing
const moduleCache = new Map();

/**
 * Lazy load a component with loading state and error handling
 * @param {Function} importFn - Function that returns a dynamic import promise
 * @param {Object} options - Configuration options
 * @returns {Function} - Lazy component
 */
export const lazyLoad = (importFn, options = {}) => {
    const {
        fallback = null,
        errorFallback = null,
        retryCount = 3,
        retryDelay = 1000,
        cacheKey = null
    } = options;

    return (props) => {
        const [Component, setComponent] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [retries, setRetries] = useState(0);

        useEffect(() => {
            let mounted = true;

            const loadComponent = async () => {
                try {
                    setLoading(true);
                    setError(null);

                    // Check cache first
                    if (cacheKey && moduleCache.has(cacheKey)) {
                        const cachedComponent = moduleCache.get(cacheKey);
                        if (mounted) {
                            setComponent(() => cachedComponent);
                            setLoading(false);
                        }
                        return;
                    }

                    devLog(`Loading component: ${cacheKey || 'unnamed'}`);
                    const module = await importFn();
                    const ComponentToLoad = module.default || module;

                    // Cache the component
                    if (cacheKey) {
                        moduleCache.set(cacheKey, ComponentToLoad);
                    }

                    if (mounted) {
                        setComponent(() => ComponentToLoad);
                        setLoading(false);
                        devLog(`Component loaded successfully: ${cacheKey || 'unnamed'}`);
                    }
                } catch (err) {
                    console.error('Failed to load component:', err);
                    
                    if (mounted) {
                        if (retries < retryCount) {
                            devLog(`Retrying component load (${retries + 1}/${retryCount})`);
                            setTimeout(() => {
                                setRetries(prev => prev + 1);
                                loadComponent();
                            }, retryDelay * (retries + 1));
                        } else {
                            setError(err);
                            setLoading(false);
                        }
                    }
                }
            };

            loadComponent();

            return () => {
                mounted = false;
            };
        }, [retries]);

        if (loading) {
            return fallback || html`
                <div class="lazy-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading component...</p>
                </div>
            `;
        }

        if (error) {
            return errorFallback ? errorFallback(error) : html`
                <div class="lazy-error">
                    <h3>Failed to load component</h3>
                    <p>${error.message}</p>
                    <button 
                        class="btn btn-secondary" 
                        onClick=${() => {
                            setRetries(0);
                            setError(null);
                        }}
                    >
                        Retry
                    </button>
                </div>
            `;
        }

        if (!Component) {
            return null;
        }

        return html`<${Component} ...${props} />`;
    };
};

/**
 * Preload a component for better performance
 * @param {Function} importFn - Function that returns a dynamic import promise
 * @param {string} cacheKey - Cache key for the component
 */
export const preloadComponent = async (importFn, cacheKey) => {
    if (moduleCache.has(cacheKey)) {
        return moduleCache.get(cacheKey);
    }

    try {
        devLog(`Preloading component: ${cacheKey}`);
        const module = await importFn();
        const Component = module.default || module;
        moduleCache.set(cacheKey, Component);
        devLog(`Component preloaded: ${cacheKey}`);
        return Component;
    } catch (error) {
        console.error(`Failed to preload component ${cacheKey}:`, error);
        throw error;
    }
};

/**
 * Lazy load multiple components in parallel
 * @param {Array} components - Array of {importFn, cacheKey} objects
 * @returns {Promise} - Promise that resolves when all components are loaded
 */
export const preloadComponents = async (components) => {
    const promises = components.map(({ importFn, cacheKey }) => 
        preloadComponent(importFn, cacheKey).catch(error => {
            console.warn(`Failed to preload ${cacheKey}:`, error);
            return null;
        })
    );

    return Promise.all(promises);
};

/**
 * Clear component cache (useful for development or memory management)
 * @param {string} cacheKey - Specific key to clear, or null to clear all
 */
export const clearComponentCache = (cacheKey = null) => {
    if (cacheKey) {
        moduleCache.delete(cacheKey);
        devLog(`Cleared component cache: ${cacheKey}`);
    } else {
        moduleCache.clear();
        devLog('Cleared all component cache');
    }
};

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export const getCacheStats = () => {
    return {
        size: moduleCache.size,
        keys: Array.from(moduleCache.keys())
    };
};

/**
 * Intersection Observer based lazy loading for images and content
 */
export class LazyContentLoader {
    constructor(options = {}) {
        this.options = {
            rootMargin: '50px',
            threshold: 0.1,
            ...options
        };
        
        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            this.options
        );
        
        this.loadedElements = new Set();
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
                this.loadElement(entry.target);
                this.loadedElements.add(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    }

    loadElement(element) {
        if (element.dataset.src) {
            // Lazy load image
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
        }

        if (element.dataset.component) {
            // Lazy load component
            const componentName = element.dataset.component;
            this.loadComponent(componentName, element);
        }

        // Trigger custom load event
        element.dispatchEvent(new CustomEvent('lazy-loaded'));
    }

    async loadComponent(componentName, element) {
        try {
            const module = await import(`../components/${componentName}.js`);
            const Component = module.default;
            
            // Render component into element
            const { render } = await import('https://esm.sh/preact');
            render(html`<${Component} />`, element);
        } catch (error) {
            console.error(`Failed to lazy load component ${componentName}:`, error);
            element.innerHTML = `<div class="lazy-error">Failed to load ${componentName}</div>`;
        }
    }

    observe(element) {
        this.observer.observe(element);
    }

    unobserve(element) {
        this.observer.unobserve(element);
        this.loadedElements.delete(element);
    }

    disconnect() {
        this.observer.disconnect();
        this.loadedElements.clear();
    }
}

// Create global lazy content loader instance
export const globalLazyLoader = new LazyContentLoader();

// Auto-initialize lazy loading for elements with data-lazy attribute
document.addEventListener('DOMContentLoaded', () => {
    const lazyElements = document.querySelectorAll('[data-lazy]');
    lazyElements.forEach(element => {
        globalLazyLoader.observe(element);
    });
});