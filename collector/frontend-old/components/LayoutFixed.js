/**
 * Fixed Layout Component for ProDB Collector
 * Provides responsive navigation, theme switching, and enhanced UX features
 * Fixed header layout issues and improved mobile responsiveness
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { globalEvents, formatTime, getStatusIcon } from '../utils/helpers.js';

const LayoutFixed = ({ children, currentPath, navigateTo }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('dark');
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [pageTitle, setPageTitle] = useState('Dashboard');
    const [quickAccessItems, setQuickAccessItems] = useState([]);
    const [systemStatus, setSystemStatus] = useState('connected');
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);
    const sidebarRef = useRef(null);

    // Check for mobile viewport and handle responsive behavior
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            
            // Auto-collapse sidebar on tablet sizes
            if (window.innerWidth < 1024 && window.innerWidth >= 768) {
                setSidebarCollapsed(true);
            } else if (window.innerWidth >= 1024) {
                setSidebarCollapsed(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close sidebar on navigation (mobile) and update page info
    useEffect(() => {
        if (isMobile) {
            setSidebarOpen(false);
        }
        updatePageInfo(currentPath);
    }, [currentPath, isMobile]);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('collector-theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme || systemTheme;
        
        setCurrentTheme(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e) => {
            if (!localStorage.getItem('collector-theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                setCurrentTheme(newTheme);
                document.documentElement.setAttribute('data-theme', newTheme);
            }
        };
        
        mediaQuery.addEventListener('change', handleThemeChange);
        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, []);

    // Load user preferences
    useEffect(() => {
        const savedCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        const savedQuickAccess = JSON.parse(localStorage.getItem('quick-access-items') || '[]');
        
        setSidebarCollapsed(savedCollapsed);
        setQuickAccessItems(savedQuickAccess);
    }, []);

    // Update page information based on current path
    const updatePageInfo = (path) => {
        const pageInfo = getPageInfo(path);
        
        setPageTitle(pageInfo.title);
        setBreadcrumbs(pageInfo.breadcrumbs);
        
        // Update document title
        document.title = `${pageInfo.title} - ProDB Collector`;
    };

    // Get page information for breadcrumbs and title
    const getPageInfo = (path) => {
        const routes = {
            '/': { title: '仪表盘', breadcrumbs: [{ label: '仪表盘', path: '/' }] },
            '/nodes': { title: '接口管理', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '接口管理', path: '/nodes' }] },
            '/nodes/new': { title: '新建接口', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '接口管理', path: '/nodes' }, { label: '新建接口', path: '/nodes/new' }] },
            '/testing': { title: '协议测试', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '协议测试', path: '/testing' }] },
            '/drivers': { title: '驱动管理', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '驱动管理', path: '/drivers' }] },
            '/performance': { title: '性能演示', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '性能演示', path: '/performance' }] },
            '/config': { title: '系统配置', breadcrumbs: [{ label: '仪表盘', path: '/' }, { label: '系统配置', path: '/config' }] }
        };
        
        return routes[path] || { title: 'ProDB 数据采集器', breadcrumbs: [{ label: '仪表盘', path: '/' }] };
    };

    // Navigation items with enhanced metadata
    const navigationItems = [
        {
            path: '/',
            label: '仪表盘',
            icon: '📊',
            description: '系统概览和状态',
            category: 'main',
            shortcut: 'D'
        },
        {
            path: '/nodes',
            label: '接口管理',
            icon: '🔗',
            description: '管理数据采集接口',
            category: 'main',
            shortcut: 'I'
        },
        {
            path: '/testing',
            label: '协议测试',
            icon: '🧪',
            description: '测试协议连接',
            category: 'tools',
            shortcut: 'T'
        },
        {
            path: '/drivers',
            label: '驱动管理',
            icon: '📦',
            description: '管理协议驱动',
            category: 'tools',
            shortcut: 'R'
        },
        {
            path: '/config',
            label: '系统配置',
            icon: '⚙️',
            description: '系统配置管理',
            category: 'settings',
            shortcut: 'C'
        },
        {
            path: '/performance',
            label: '性能演示',
            icon: '⚡',
            description: '性能优化展示',
            category: 'tools',
            shortcut: 'P'
        }
    ];

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey) {
                const item = navigationItems.find(item => item.shortcut.toLowerCase() === e.key.toLowerCase());
                if (item) {
                    e.preventDefault();
                    navigateTo(item.path);
                }
            }
            
            // Toggle sidebar with Ctrl/Cmd + B
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                toggleSidebarCollapse();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigateTo]);

    // Toggle sidebar collapse
    const toggleSidebarCollapse = () => {
        const newCollapsed = !sidebarCollapsed;
        setSidebarCollapsed(newCollapsed);
        localStorage.setItem('sidebar-collapsed', newCollapsed.toString());
        globalEvents.emit('sidebarToggled', newCollapsed);
    };

    // Toggle theme
    const toggleTheme = () => {
        const themes = ['dark', 'light', 'high-contrast'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        
        setCurrentTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('collector-theme', nextTheme);
        globalEvents.emit('themeChanged', nextTheme);
    };

    // Add/remove quick access item
    const toggleQuickAccess = (item) => {
        const exists = quickAccessItems.find(qa => qa.path === item.path);
        let newItems;
        
        if (exists) {
            newItems = quickAccessItems.filter(qa => qa.path !== item.path);
        } else {
            newItems = [...quickAccessItems, { ...item, addedAt: Date.now() }].slice(0, 5); // Max 5 items
        }
        
        setQuickAccessItems(newItems);
        localStorage.setItem('quick-access-items', JSON.stringify(newItems));
    };

    // Handle auto refresh
    const handleAutoRefresh = (interval) => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            setAutoRefreshInterval(null);
        }
        
        if (interval > 0) {
            const newInterval = setInterval(() => {
                setLastUpdate(new Date());
                globalEvents.emit('refreshRequested');
            }, interval);
            setAutoRefreshInterval(newInterval);
        }
    };

    // Enhanced navigation link component
    const NavLink = ({ item, isQuickAccess = false }) => {
        const isActive = currentPath === item.path || 
                        (item.path !== '/' && currentPath.startsWith(item.path));
        const isInQuickAccess = quickAccessItems.some(qa => qa.path === item.path);
        
        return html`
            <li class="nav-item ${isQuickAccess ? 'quick-access-item' : ''}">
                <a 
                    href=${item.path}
                    class="nav-link ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}"
                    onClick=${(e) => {
                        e.preventDefault();
                        navigateTo(item.path);
                    }}
                    title=${sidebarCollapsed ? `${item.label} (Alt+${item.shortcut})` : item.description}
                >
                    <span class="nav-icon">${item.icon}</span>
                    ${!sidebarCollapsed ? html`
                        <span class="nav-label">${item.label}</span>
                        <div class="nav-actions">
                            ${!isQuickAccess ? html`
                                <button 
                                    class="quick-access-toggle ${isInQuickAccess ? 'active' : ''}"
                                    onClick=${(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleQuickAccess(item);
                                    }}
                                    title=${isInQuickAccess ? 'Remove from quick access' : 'Add to quick access'}
                                >
                                    ${isInQuickAccess ? '⭐' : '☆'}
                                </button>
                            ` : ''}
                            ${item.shortcut ? html`
                                <span class="nav-shortcut">Alt+${item.shortcut}</span>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${isActive ? html`<span class="nav-indicator"></span>` : ''}
                </a>
            </li>
        `;
    };

    // Breadcrumb component
    const Breadcrumbs = () => {
        if (breadcrumbs.length <= 1) return null;
        
        return html`
            <nav class="breadcrumbs" aria-label="Breadcrumb">
                <ol class="breadcrumb-list">
                    ${breadcrumbs.map((crumb, index) => html`
                        <li class="breadcrumb-item" key=${crumb.path}>
                            ${index < breadcrumbs.length - 1 ? html`
                                <a 
                                    href=${crumb.path}
                                    class="breadcrumb-link"
                                    onClick=${(e) => {
                                        e.preventDefault();
                                        navigateTo(crumb.path);
                                    }}
                                >
                                    ${crumb.label}
                                </a>
                                <span class="breadcrumb-separator">›</span>
                            ` : html`
                                <span class="breadcrumb-current">${crumb.label}</span>
                            `}
                        </li>
                    `)}
                </ol>
            </nav>
        `;
    };

    // Enhanced theme toggle component
    const ThemeToggle = () => {
        const themeIcons = {
            'dark': '🌙',
            'light': '☀️',
            'high-contrast': '🔆'
        };
        
        const themeNames = {
            'dark': 'Dark',
            'light': 'Light',
            'high-contrast': 'High Contrast'
        };

        return html`
            <div class="theme-controls">
                <button 
                    class="theme-toggle"
                    onClick=${toggleTheme}
                    title=${`Current theme: ${themeNames[currentTheme]} (Click to cycle)`}
                >
                    <span class="theme-toggle-icon">
                        ${themeIcons[currentTheme]}
                    </span>
                    ${!sidebarCollapsed ? html`
                        <span class="theme-toggle-text">
                            ${themeNames[currentTheme]}
                        </span>
                    ` : ''}
                </button>
            </div>
        `;
    };

    // Mobile menu toggle
    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // System status component
    const SystemStatus = () => {
        return html`
            <div class="system-status">
                <div class="status-indicator ${systemStatus}">
                    <span class="status-icon">${getStatusIcon(systemStatus)}</span>
                    ${!sidebarCollapsed ? html`
                        <div class="status-info">
                            <span class="status-text">${systemStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                            <span class="status-time">${formatTime(lastUpdate, { includeDate: false, includeSeconds: true })}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    };

    // Quick access section
    const QuickAccessSection = () => {
        if (quickAccessItems.length === 0) return null;
        
        return html`
            <div class="quick-access-section">
                ${!sidebarCollapsed ? html`
                    <div class="section-header">
                        <h3 class="section-title">Quick Access</h3>
                        <button 
                            class="clear-quick-access"
                            onClick=${() => {
                                setQuickAccessItems([]);
                                localStorage.removeItem('quick-access-items');
                            }}
                            title="Clear quick access"
                        >
                            ✕
                        </button>
                    </div>
                ` : ''}
                <ul class="quick-access-list">
                    ${quickAccessItems.map(item => html`
                        <${NavLink} item=${item} isQuickAccess=${true} key=${item.path} />
                    `)}
                </ul>
            </div>
        `;
    };

    return html`
        <div class="layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}">
            <!-- Mobile header -->
            ${isMobile ? html`
                <header class="mobile-header">
                    <button 
                        class="mobile-menu-toggle"
                        onClick=${toggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <span class="hamburger-icon ${sidebarOpen ? 'open' : ''}">
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                    <div class="mobile-title-section">
                        <h1 class="mobile-title">${pageTitle}</h1>
                        <${Breadcrumbs} />
                    </div>
                    <${ThemeToggle} />
                </header>
            ` : ''}

            <!-- Enhanced Sidebar -->
            <nav class="sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}" ref=${sidebarRef}>
                <div class="sidebar-header">
                    <div class="logo">
                        <span class="logo-icon">🔧</span>
                        ${!sidebarCollapsed ? html`
                            <h2 class="logo-text">ProDB Collector</h2>
                        ` : ''}
                    </div>
                    
                    ${!isMobile ? html`
                        <div class="sidebar-controls">
                            <button 
                                class="sidebar-collapse-toggle"
                                onClick=${toggleSidebarCollapse}
                                title=${sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                            >
                                ${sidebarCollapsed ? '»' : '«'}
                            </button>
                        </div>
                    ` : ''}
                </div>

                <!-- Quick Access Section -->
                <${QuickAccessSection} />

                <!-- Main Navigation -->
                <div class="nav-section">
                    ${!sidebarCollapsed && quickAccessItems.length > 0 ? html`
                        <div class="section-header">
                            <h3 class="section-title">Navigation</h3>
                        </div>
                    ` : ''}
                    <ul class="nav-menu">
                        ${navigationItems.map(item => html`<${NavLink} item=${item} key=${item.path} />`)}
                    </ul>
                </div>

                <!-- Sidebar Footer -->
                <div class="sidebar-footer">
                    ${!sidebarCollapsed ? html`
                        <div class="footer-content">
                            <${ThemeToggle} />
                            <div class="version-info">
                                <small>Version 1.0.0</small>
                            </div>
                        </div>
                    ` : ''}
                    <${SystemStatus} />
                </div>
            </nav>

            <!-- Mobile overlay -->
            ${isMobile && sidebarOpen ? html`
                <div 
                    class="mobile-overlay"
                    onClick=${() => setSidebarOpen(false)}
                ></div>
            ` : ''}

            <!-- Main content with FIXED header -->
            <main class="main-content">
                ${!isMobile ? html`
                    <header class="content-header">
                        <div class="page-header">
                            <div class="page-title-section">
                                <h1 class="page-title">${pageTitle}</h1>
                                <${Breadcrumbs} />
                            </div>
                            <div class="header-actions">
                                <div class="auto-refresh-control">
                                    <label class="refresh-label">自动刷新</label>
                                    <select 
                                        class="refresh-interval"
                                        onChange=${(e) => handleAutoRefresh(parseInt(e.target.value))}
                                    >
                                        <option value="0">关闭</option>
                                        <option value="5000" selected>5秒</option>
                                        <option value="10000">10秒</option>
                                        <option value="30000">30秒</option>
                                    </select>
                                </div>
                                <button 
                                    class="refresh-button"
                                    onClick=${() => {
                                        setLastUpdate(new Date());
                                        globalEvents.emit('refreshRequested');
                                    }}
                                    title="手动刷新数据"
                                >
                                    🔄
                                </button>
                                <${ThemeToggle} />
                            </div>
                        </div>
                    </header>
                ` : ''}
                
                <div class="content-wrapper">
                    ${children}
                </div>
            </main>
        </div>

        <style>
            /* FIXED Layout Styles */
            .layout {
                display: flex;
                min-height: 100vh;
                background-color: var(--bg-primary);
                transition: all var(--transition-normal);
            }

            .layout.sidebar-collapsed .main-content {
                margin-left: 60px;
            }

            .main-content {
                flex: 1;
                margin-left: 320px;
                min-height: 100vh;
                background-color: var(--bg-primary);
                transition: margin-left var(--transition-normal);
                display: flex;
                flex-direction: column;
            }

            /* FIXED Content Header - Sticky positioning */
            .content-header {
                background-color: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                padding: var(--space-4) var(--space-6);
                position: sticky;
                top: 0;
                z-index: var(--z-sticky);
                box-shadow: var(--shadow-sm);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }

            /* FIXED Page Header Layout */
            .page-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: var(--space-4);
                min-height: 60px;
            }

            .page-title-section {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .page-title {
                font-size: var(--font-size-2xl);
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0 0 var(--space-1) 0;
                line-height: 1.2;
            }

            /* FIXED Header Actions Layout */
            .header-actions {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                flex-shrink: 0;
                height: 60px;
            }

            .auto-refresh-control {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                white-space: nowrap;
            }

            .refresh-label {
                font-size: var(--font-size-sm);
                color: var(--text-secondary);
                font-weight: var(--font-weight-medium);
            }

            .refresh-interval {
                background-color: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                padding: var(--space-2) var(--space-3);
                min-width: 80px;
                cursor: pointer;
                transition: all var(--transition-normal);
            }

            .refresh-interval:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
            }

            .refresh-button {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--space-2);
                font-size: var(--font-size-base);
                transition: all var(--transition-normal);
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .refresh-button:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
                transform: rotate(90deg);
            }

            /* FIXED Breadcrumbs */
            .breadcrumbs {
                margin: 0;
            }

            .breadcrumb-list {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                list-style: none;
                margin: 0;
                padding: 0;
                flex-wrap: wrap;
            }

            .breadcrumb-item {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .breadcrumb-link {
                color: var(--text-secondary);
                text-decoration: none;
                font-size: var(--font-size-sm);
                transition: color var(--transition-normal);
            }

            .breadcrumb-link:hover {
                color: var(--color-primary);
            }

            .breadcrumb-current {
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-medium);
            }

            .breadcrumb-separator {
                color: var(--text-muted);
                font-size: var(--font-size-sm);
            }

            /* FIXED Content Wrapper */
            .content-wrapper {
                flex: 1;
                padding: var(--space-6);
                overflow-y: auto;
                min-height: 0;
            }

            /* Enhanced Mobile Header */
            .mobile-header {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background-color: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                padding: 0 var(--space-4);
                align-items: center;
                justify-content: space-between;
                z-index: var(--z-fixed);
                box-shadow: var(--shadow-sm);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }

            .mobile-menu-toggle {
                background: none;
                border: none;
                cursor: pointer;
                padding: var(--space-2);
                border-radius: var(--border-radius);
                transition: background-color var(--transition-normal);
            }

            .mobile-menu-toggle:hover {
                background-color: var(--bg-hover);
            }

            .hamburger-icon {
                display: flex;
                flex-direction: column;
                width: 20px;
                height: 16px;
                justify-content: space-between;
                transition: all var(--transition-normal);
            }

            .hamburger-icon span {
                display: block;
                height: 2px;
                background-color: var(--text-primary);
                border-radius: 1px;
                transition: all var(--transition-normal);
                transform-origin: center;
            }

            .hamburger-icon.open span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }

            .hamburger-icon.open span:nth-child(2) {
                opacity: 0;
            }

            .hamburger-icon.open span:nth-child(3) {
                transform: rotate(-45deg) translate(7px, -6px);
            }

            .mobile-title-section {
                flex: 1;
                margin: 0 var(--space-4);
                min-width: 0;
            }

            .mobile-title {
                font-size: var(--font-size-lg);
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
                margin: 0 0 var(--space-1) 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Enhanced Sidebar */
            .sidebar {
                width: 320px;
                min-width: 320px;
                background-color: var(--bg-secondary);
                border-right: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                position: fixed;
                height: 100vh;
                overflow-y: auto;
                overflow-x: hidden;
                z-index: var(--z-sticky);
                transition: all var(--transition-normal);
                box-shadow: var(--shadow-sm);
            }

            .sidebar.collapsed {
                width: 60px;
                min-width: 60px;
            }

            .sidebar-header {
                padding: var(--space-4);
                border-bottom: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-height: 60px;
                background-color: var(--bg-secondary);
                position: sticky;
                top: 0;
                z-index: 2;
            }

            .logo {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                min-width: 0;
            }

            .logo-icon {
                font-size: var(--font-size-2xl);
                flex-shrink: 0;
            }

            .logo-text {
                font-size: var(--font-size-lg);
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: opacity var(--transition-normal);
            }

            .sidebar.collapsed .logo-text {
                opacity: 0;
                width: 0;
            }

            .sidebar-controls {
                display: flex;
                gap: var(--space-2);
            }

            .sidebar-collapse-toggle {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--space-1) var(--space-2);
                font-size: var(--font-size-sm);
                transition: all var(--transition-normal);
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .sidebar-collapse-toggle:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
            }

            /* Enhanced Navigation */
            .nav-section {
                flex: 1;
                padding: var(--space-2) 0;
            }

            .section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-2) var(--space-4);
                margin-bottom: var(--space-2);
            }

            .section-title {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-semibold);
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 0;
            }

            .nav-menu {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .nav-item {
                margin-bottom: var(--space-1);
            }

            .nav-link {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
                color: var(--text-secondary);
                text-decoration: none;
                border-radius: var(--border-radius);
                margin: 0 var(--space-2);
                transition: all var(--transition-normal);
                position: relative;
                min-height: 44px;
                width: calc(100% - var(--space-4));
                overflow: hidden;
            }

            .nav-link.collapsed {
                justify-content: center;
                padding: var(--space-3);
            }

            .nav-link:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
            }

            .nav-link.active {
                background-color: var(--color-primary);
                color: white;
            }

            .nav-icon {
                font-size: var(--font-size-lg);
                flex-shrink: 0;
            }

            .nav-label {
                flex: 1;
                font-weight: var(--font-weight-medium);
                transition: opacity var(--transition-normal);
            }

            .sidebar.collapsed .nav-label {
                opacity: 0;
                width: 0;
            }

            .nav-actions {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                opacity: 0;
                transition: opacity var(--transition-normal);
            }

            .nav-link:hover .nav-actions {
                opacity: 1;
            }

            .quick-access-toggle {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: var(--space-1);
                border-radius: var(--border-radius-sm);
                transition: all var(--transition-normal);
            }

            .quick-access-toggle:hover,
            .quick-access-toggle.active {
                color: var(--color-warning);
            }

            .nav-shortcut {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
                background-color: rgba(255, 255, 255, 0.1);
                padding: 2px 4px;
                border-radius: 2px;
            }

            .nav-indicator {
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 20px;
                background-color: white;
                border-radius: 2px 0 0 2px;
            }

            /* Quick Access Section */
            .quick-access-section {
                border-bottom: 1px solid var(--border-color);
                padding-bottom: var(--space-2);
                margin-bottom: var(--space-2);
            }

            .quick-access-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .clear-quick-access {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: var(--space-1);
                border-radius: var(--border-radius-sm);
                transition: all var(--transition-normal);
            }

            .clear-quick-access:hover {
                color: var(--color-error);
                background-color: rgba(239, 68, 68, 0.1);
            }

            /* Theme Toggle */
            .theme-controls {
                display: flex;
                align-items: center;
            }

            .theme-toggle {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--space-2);
                font-size: var(--font-size-sm);
                transition: all var(--transition-normal);
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .theme-toggle:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
            }

            .theme-toggle-icon {
                font-size: var(--font-size-base);
            }

            .theme-toggle-text {
                font-weight: var(--font-weight-medium);
            }

            /* Sidebar Footer */
            .sidebar-footer {
                padding: var(--space-4);
                border-top: 1px solid var(--border-color);
                background-color: var(--bg-secondary);
            }

            .footer-content {
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                margin-bottom: var(--space-3);
            }

            .version-info {
                text-align: center;
                color: var(--text-muted);
            }

            /* System Status */
            .system-status {
                display: flex;
                justify-content: center;
            }

            .status-indicator {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2);
                border-radius: var(--border-radius);
                background-color: var(--bg-tertiary);
            }

            .status-indicator.connected {
                background-color: rgba(16, 185, 129, 0.1);
                color: var(--color-success);
            }

            .status-indicator.disconnected {
                background-color: rgba(245, 158, 11, 0.1);
                color: var(--color-warning);
            }

            .status-icon {
                font-size: var(--font-size-sm);
            }

            .status-info {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .status-text {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-medium);
            }

            .status-time {
                font-size: var(--font-size-xs);
                opacity: 0.8;
            }

            /* Mobile-specific responsive styles */
            @media (max-width: 768px) {
                .mobile-header {
                    display: flex;
                }

                .main-content {
                    margin-left: 0;
                    padding-top: 60px;
                }

                .sidebar {
                    transform: translateX(-100%);
                    transition: transform var(--transition-normal);
                }

                .sidebar.open {
                    transform: translateX(0);
                }

                .mobile-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: var(--bg-overlay);
                    z-index: calc(var(--z-sticky) - 1);
                }

                /* Hide desktop header on mobile */
                .content-header {
                    display: none;
                }

                /* Touch-optimized navigation */
                .nav-link {
                    min-height: 48px;
                    padding: var(--space-4);
                    font-size: var(--font-size-base);
                }

                .nav-icon {
                    font-size: var(--font-size-xl);
                }

                /* Larger touch targets */
                .mobile-menu-toggle,
                .theme-toggle,
                .sidebar-collapse-toggle {
                    min-height: 44px;
                    min-width: 44px;
                }

                /* Mobile breadcrumbs */
                .mobile-header .breadcrumb-list {
                    font-size: var(--font-size-xs);
                }
            }

            @media (max-width: 480px) {
                .mobile-header {
                    padding: 0 var(--space-3);
                }

                .mobile-title {
                    font-size: var(--font-size-base);
                }

                .sidebar {
                    width: 280px;
                }

                .nav-link {
                    padding: var(--space-3);
                }

                /* Hide auto refresh on very small screens */
                .auto-refresh-control {
                    display: none;
                }
            }
        </style>
    `;
};

export default LayoutFixed;