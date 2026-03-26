/**
 * Enhanced Layout Component for ProDB Collector
 * Provides responsive navigation, theme switching, and enhanced UX features
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { globalEvents, formatTime, getStatusIcon } from '../utils/helpers.js';

const Layout = ({ children, currentPath, navigateTo }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('dark');
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [pageTitle, setPageTitle] = useState('Dashboard');
    const [quickAccessItems, setQuickAccessItems] = useState([]);
    const [systemStatus, setSystemStatus] = useState('connected');
    const [lastUpdate, setLastUpdate] = useState(new Date());
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
        const pathSegments = path.split('/').filter(Boolean);
        const pageInfo = getPageInfo(path);
        
        setPageTitle(pageInfo.title);
        
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
                    ` : ''}
                    ${isActive ? html`<span class="nav-indicator"></span>` : ''}
                </a>
            </li>
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
            <button 
                class="header-control theme-btn"
                onClick=${toggleTheme}
                title=${`Current theme: ${themeNames[currentTheme]} (Click to cycle)`}
            >
                <span>${themeIcons[currentTheme]}</span>
                <span>${themeNames[currentTheme]}</span>
            </button>
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

            <!-- Main content with REDESIGNED header -->
            <main class="main-content">
                ${!isMobile ? html`
                    <header class="app-header">
                        <div class="header-container">
                            <div class="header-left">
                                <h1 class="page-title">${pageTitle}</h1>
                            </div>
                            <div class="header-right">
                                <div class="refresh-group">
                                    <label class="refresh-label">自动刷新</label>
                                    <select 
                                        class="header-control refresh-select"
                                        onChange=${(e) => {
                                            const interval = parseInt(e.target.value);
                                            if (interval > 0) {
                                                setInterval(() => {
                                                    setLastUpdate(new Date());
                                                    globalEvents.emit('refreshRequested');
                                                }, interval);
                                            }
                                        }}
                                    >
                                        <option value="0">关闭</option>
                                        <option value="5000" selected>5秒</option>
                                        <option value="10000">10秒</option>
                                        <option value="30000">30秒</option>
                                    </select>
                                </div>
                                <button 
                                    class="header-control refresh-btn"
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
    `;
};

export default Layout;
