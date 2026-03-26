/**
 * Progressive Loader Component
 * Implements progressive loading and resource optimization
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';

const ProgressiveLoader = ({ 
    children,
    loadingComponent = null,
    errorComponent = null,
    threshold = 100,
    rootMargin = '50px',
    className = ''
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    
    const containerRef = useRef(null);
    const observerRef = useRef(null);

    useEffect(() => {
        // Set up intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && !isLoaded && !isLoading) {
                            setIsVisible(true);
                            loadContent();
                        }
                    });
                },
                {
                    threshold: threshold / 100,
                    rootMargin
                }
            );

            if (containerRef.current) {
                observerRef.current.observe(containerRef.current);
            }
        } else {
            // Fallback for browsers without IntersectionObserver
            setIsVisible(true);
            loadContent();
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    const loadContent = async () => {
        if (isLoading || isLoaded) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // Simulate progressive loading delay based on network conditions
            const delay = getOptimalDelay();
            await new Promise(resolve => setTimeout(resolve, delay));
            
            setIsLoaded(true);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const getOptimalDelay = () => {
        // Adjust delay based on connection speed
        if ('connection' in navigator) {
            const connection = navigator.connection;
            switch (connection.effectiveType) {
                case 'slow-2g': return 1000;
                case '2g': return 500;
                case '3g': return 200;
                case '4g': return 100;
                default: return 50;
            }
        }
        return 100;
    };

    const DefaultLoadingComponent = () => html`
        <div class="progressive-loader-loading">
            <div class="loading-skeleton">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
            </div>
        </div>
    `;

    const DefaultErrorComponent = ({ error, retry }) => html`
        <div class="progressive-loader-error">
            <p>Failed to load content</p>
            <button onClick=${retry} class="btn btn-secondary btn-sm">
                Try Again
            </button>
        </div>
    `;    const
 retry = () => {
        setError(null);
        setIsLoaded(false);
        setIsLoading(false);
        loadContent();
    };

    return html`
        <div 
            class="progressive-loader ${className}" 
            ref=${containerRef}
            data-loaded=${isLoaded}
            data-loading=${isLoading}
            data-visible=${isVisible}
        >
            ${!isVisible && html`
                <div class="progressive-loader-placeholder">
                    <!-- Placeholder for non-visible content -->
                </div>
            `}
            
            ${isVisible && !isLoaded && !error && (
                loadingComponent || html`<${DefaultLoadingComponent} />`
            )}
            
            ${error && (
                errorComponent 
                    ? errorComponent({ error, retry })
                    : html`<${DefaultErrorComponent} error=${error} retry=${retry} />`
            )}
            
            ${isLoaded && children}
        </div>
    `;
};

// Resource optimizer for images and assets
export const OptimizedImage = ({ 
    src, 
    alt, 
    className = '',
    placeholder = null,
    lazy = true,
    ...props 
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(placeholder);
    
    const imgRef = useRef(null);

    useEffect(() => {
        if (!lazy) {
            loadImage();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadImage();
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1 }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [src, lazy]);

    const loadImage = () => {
        const img = new Image();
        img.onload = () => {
            setCurrentSrc(src);
            setIsLoaded(true);
            setError(false);
        };
        img.onerror = () => {
            setError(true);
            setIsLoaded(false);
        };
        img.src = src;
    };

    return html`
        <div class="optimized-image-container ${className}">
            <img
                ref=${imgRef}
                src=${currentSrc || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23f0f0f0"/></svg>'}
                alt=${alt}
                class="optimized-image ${isLoaded ? 'loaded' : ''} ${error ? 'error' : ''}"
                loading=${lazy ? 'lazy' : 'eager'}
                ...${props}
            />
            ${!isLoaded && !error && html`
                <div class="image-loading-overlay">
                    <div class="loading-spinner small"></div>
                </div>
            `}
            ${error && html`
                <div class="image-error-overlay">
                    <span>⚠️</span>
                </div>
            `}
        </div>
    `;
};

export default ProgressiveLoader;