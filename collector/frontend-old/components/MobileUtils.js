// Mobile Utility Components and Hooks
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';

// Hook for detecting mobile devices and screen size
export const useMobileDetection = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    useEffect(() => {
        const checkDevice = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            setScreenSize({ width, height });
            setIsMobile(width <= 768);
            setIsTablet(width > 768 && width <= 1024);
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);
        window.addEventListener('orientationchange', checkDevice);
        
        return () => {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('orientationchange', checkDevice);
        };
    }, []);

    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
        screenSize,
        isLandscape: screenSize.width > screenSize.height,
        isPortrait: screenSize.width <= screenSize.height
    };
};

// Hook for managing horizontal scroll indicators
export const useHorizontalScroll = () => {
    const scrollRef = useRef(null);
    const [scrollIndicators, setScrollIndicators] = useState({
        left: false,
        right: false
    });

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setScrollIndicators({
                left: scrollLeft > 5,
                right: scrollLeft < scrollWidth - clientWidth - 5
            });
        };

        const element = scrollRef.current;
        if (element) {
            handleScroll(); // Initial check
            element.addEventListener('scroll', handleScroll, { passive: true });
            
            // Check on resize
            const resizeObserver = new ResizeObserver(handleScroll);
            resizeObserver.observe(element);
            
            return () => {
                element.removeEventListener('scroll', handleScroll);
                resizeObserver.disconnect();
            };
        }
    }, []);

    return { scrollRef, scrollIndicators };
};

// Mobile-optimized responsive container
export const ResponsiveContainer = ({ 
    children, 
    className = '', 
    mobileLayout = 'stack',
    tabletLayout = 'grid',
    desktopLayout = 'grid'
}) => {
    const { isMobile, isTablet } = useMobileDetection();
    
    let layoutClass = '';
    if (isMobile) {
        layoutClass = `mobile-layout-${mobileLayout}`;
    } else if (isTablet) {
        layoutClass = `tablet-layout-${tabletLayout}`;
    } else {
        layoutClass = `desktop-layout-${desktopLayout}`;
    }
    
    return html`
        <div class="responsive-container ${layoutClass} ${className}">
            ${children}
        </div>
    `;
};

// Mobile-friendly horizontal scroll container
export const HorizontalScrollContainer = ({ 
    children, 
    className = '',
    showIndicators = true 
}) => {
    const { scrollRef, scrollIndicators } = useHorizontalScroll();
    
    return html`
        <div class="horizontal-scroll-wrapper ${className}">
            ${showIndicators && scrollIndicators.left && html`
                <div class="scroll-indicator left" aria-hidden="true">‹</div>
            `}
            ${showIndicators && scrollIndicators.right && html`
                <div class="scroll-indicator right" aria-hidden="true">›</div>
            `}
            <div 
                class="horizontal-scroll-container" 
                ref=${scrollRef}
                role="region"
                aria-label="Horizontally scrollable content"
            >
                ${children}
            </div>
        </div>
    `;
};

// Touch-optimized button component
export const TouchButton = ({ 
    children, 
    onClick, 
    variant = 'primary',
    size = 'medium',
    disabled = false,
    className = '',
    ...props 
}) => {
    const sizeClass = {
        small: 'touch-btn-sm',
        medium: 'touch-btn-md',
        large: 'touch-btn-lg'
    }[size];
    
    return html`
        <button 
            class="touch-button touch-btn-${variant} ${sizeClass} ${className}"
            onClick=${onClick}
            disabled=${disabled}
            ...${props}
        >
            ${children}
        </button>
    `;
};

// Mobile-optimized input component
export const TouchInput = ({ 
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    error = null,
    className = '',
    ...props 
}) => {
    return html`
        <div class="touch-input-wrapper">
            <input 
                type=${type}
                class="touch-input ${error ? 'error' : ''} ${className}"
                value=${value}
                onChange=${onChange}
                placeholder=${placeholder}
                disabled=${disabled}
                ...${props}
            />
            ${error && html`
                <div class="touch-input-error">${error}</div>
            `}
        </div>
    `;
};

// Mobile-friendly select component
export const TouchSelect = ({ 
    value,
    onChange,
    options = [],
    placeholder,
    disabled = false,
    error = null,
    className = '',
    ...props 
}) => {
    return html`
        <div class="touch-select-wrapper">
            <select 
                class="touch-select ${error ? 'error' : ''} ${className}"
                value=${value}
                onChange=${onChange}
                disabled=${disabled}
                ...${props}
            >
                ${placeholder && html`<option value="">${placeholder}</option>`}
                ${options.map(option => html`
                    <option key=${option.value} value=${option.value}>
                        ${option.label}
                    </option>
                `)}
            </select>
            ${error && html`
                <div class="touch-select-error">${error}</div>
            `}
        </div>
    `;
};

// Responsive grid component
export const ResponsiveGrid = ({ 
    children, 
    columns = { mobile: 1, tablet: 2, desktop: 3 },
    gap = 'medium',
    className = '' 
}) => {
    const { isMobile, isTablet } = useMobileDetection();
    
    let columnCount = columns.desktop;
    if (isMobile) {
        columnCount = columns.mobile;
    } else if (isTablet) {
        columnCount = columns.tablet;
    }
    
    const gapClass = {
        small: 'gap-sm',
        medium: 'gap-md',
        large: 'gap-lg'
    }[gap];
    
    return html`
        <div 
            class="responsive-grid ${gapClass} ${className}"
            style="grid-template-columns: repeat(${columnCount}, 1fr);"
        >
            ${children}
        </div>
    `;
};

// Mobile-optimized modal component
export const MobileModal = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    size = 'medium',
    className = '' 
}) => {
    const { isMobile } = useMobileDetection();
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);
    
    if (!isOpen) return null;
    
    const sizeClass = isMobile ? 'mobile-modal-fullscreen' : `mobile-modal-${size}`;
    
    return html`
        <div class="mobile-modal-overlay" onClick=${onClose}>
            <div 
                class="mobile-modal-content ${sizeClass} ${className}"
                onClick=${(e) => e.stopPropagation()}
            >
                <div class="mobile-modal-header">
                    <h2 class="mobile-modal-title">${title}</h2>
                    <button 
                        class="mobile-modal-close"
                        onClick=${onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>
                <div class="mobile-modal-body">
                    ${children}
                </div>
            </div>
        </div>
    `;
};

// Touch-friendly tabs component
export const TouchTabs = ({ 
    tabs = [], 
    activeTab, 
    onTabChange, 
    className = '' 
}) => {
    const tabsRef = useRef(null);
    
    useEffect(() => {
        // Scroll active tab into view
        if (tabsRef.current) {
            const activeElement = tabsRef.current.querySelector('.touch-tab.active');
            if (activeElement) {
                activeElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeTab]);
    
    return html`
        <div class="touch-tabs-container ${className}">
            <div class="touch-tabs-wrapper" ref=${tabsRef}>
                ${tabs.map(tab => html`
                    <button
                        key=${tab.id}
                        class="touch-tab ${activeTab === tab.id ? 'active' : ''}"
                        onClick=${() => onTabChange(tab.id)}
                        disabled=${tab.disabled}
                    >
                        ${tab.icon && html`<span class="touch-tab-icon">${tab.icon}</span>`}
                        <span class="touch-tab-label">${tab.label}</span>
                        ${tab.badge && html`<span class="touch-tab-badge">${tab.badge}</span>`}
                    </button>
                `)}
            </div>
        </div>
    `;
};

// Swipe gesture handler hook
export const useSwipeGesture = (onSwipeLeft, onSwipeRight, threshold = 50) => {
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > threshold;
        const isRightSwipe = distance < -threshold;

        if (isLeftSwipe && onSwipeLeft) {
            onSwipeLeft();
        }
        if (isRightSwipe && onSwipeRight) {
            onSwipeRight();
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
};

// Mobile-optimized loading component
export const MobileLoader = ({ 
    size = 'medium', 
    message = 'Loading...', 
    className = '' 
}) => {
    const sizeClass = {
        small: 'mobile-loader-sm',
        medium: 'mobile-loader-md',
        large: 'mobile-loader-lg'
    }[size];
    
    return html`
        <div class="mobile-loader ${sizeClass} ${className}">
            <div class="mobile-loader-spinner"></div>
            <div class="mobile-loader-message">${message}</div>
        </div>
    `;
};

// Export all utilities
export default {
    useMobileDetection,
    useHorizontalScroll,
    useSwipeGesture,
    ResponsiveContainer,
    HorizontalScrollContainer,
    TouchButton,
    TouchInput,
    TouchSelect,
    ResponsiveGrid,
    MobileModal,
    TouchTabs,
    MobileLoader
};