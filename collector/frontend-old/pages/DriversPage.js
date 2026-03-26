/**
 * Driver Management Page for ProDB Collector
 * Implements driver listing, status management, and basic operations
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { driverService } from '../services/drivers.js';
import StatusIndicator from '../components/StatusIndicator.js';
import Modal from '../components/Modal.js';
import DriverInstallDialog from '../components/DriverInstallDialog.js';
import DriverVersionManager from '../components/DriverVersionManager.js';
import DriverCompatibilityValidator from '../components/DriverCompatibilityValidator.js';
import DriverDevelopmentTools from '../components/DriverDevelopmentTools.js';
import { devLog, formatTime, formatFileSize } from '../utils/helpers.js';

const DriversPage = ({ navigateTo }) => {
    const [drivers, setDrivers] = useState([]);
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterProtocol, setFilterProtocol] = useState('all');
    const [showInstallDialog, setShowInstallDialog] = useState(false);
    const [showVersionManager, setShowVersionManager] = useState(false);
    const [showCompatibilityValidator, setShowCompatibilityValidator] = useState(false);
    const [showDevelopmentTools, setShowDevelopmentTools] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [operationInProgress, setOperationInProgress] = useState(new Set());

    // Load drivers on component mount
    useEffect(() => {
        loadDrivers();
    }, []);

    // Auto-refresh drivers every 30 seconds
    useEffect(() => {
        const interval = setInterval(loadDrivers, 30000);
        return () => clearInterval(interval);
    }, []);

    /**
     * Load drivers from service
     */
    const loadDrivers = async () => {
        try {
            setLoading(true);
            setError(null);
            
            await driverService.refreshDrivers();
            
            const loadedDrivers = driverService.getLoadedDrivers();
            const availableDrivers = driverService.getAvailableDrivers();
            
            setDrivers(loadedDrivers);
            setAvailableDrivers(availableDrivers);
            
            devLog('Drivers loaded:', { loaded: loadedDrivers.length, available: availableDrivers.length });
            
        } catch (err) {
            console.error('Failed to load drivers:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Toggle driver status (load/unload)
     */
    const toggleDriver = async (driverId) => {
        if (operationInProgress.has(driverId)) return;

        try {
            setOperationInProgress(prev => new Set(prev).add(driverId));
            
            const result = await driverService.toggleDriver(driverId);
            
            if (result.success) {
                await loadDrivers(); // Refresh driver list
            } else {
                setError(result.error || 'Failed to toggle driver');
            }
            
        } catch (err) {
            console.error('Failed to toggle driver:', err);
            setError(err.message);
        } finally {
            setOperationInProgress(prev => {
                const newSet = new Set(prev);
                newSet.delete(driverId);
                return newSet;
            });
        }
    };

    /**
     * Configure driver
     */
    const configureDriver = (driverId) => {
        const driver = drivers.find(d => d.id === driverId);
        if (driver) {
            setSelectedDriver(driver);
            // In a full implementation, this would open a configuration dialog
            alert(`Configuration for ${driver.name} will be available in the next version.`);
        }
    };

    /**
     * Scan for available drivers
     */
    const scanForDrivers = async () => {
        try {
            setLoading(true);
            await driverService.refreshDrivers();
            
            const available = driverService.getAvailableDrivers();
            setAvailableDrivers(available);
            
            devLog('Driver scan completed:', available.length);
            
        } catch (err) {
            console.error('Failed to scan drivers:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Get filtered drivers
     */
    const getFilteredDrivers = (driverList) => {
        return driverList.filter(driver => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = 
                    driver.name.toLowerCase().includes(query) ||
                    driver.description.toLowerCase().includes(query) ||
                    driver.protocol.toLowerCase().includes(query) ||
                    (driver.author && driver.author.toLowerCase().includes(query));
                
                if (!matchesSearch) return false;
            }

            // Status filter
            if (filterStatus !== 'all') {
                const driverStatus = driverService.getDriverStatus(driver.id);
                if (driverStatus !== filterStatus) return false;
            }

            // Protocol filter
            if (filterProtocol !== 'all') {
                if (driver.protocol !== filterProtocol) return false;
            }

            return true;
        });
    };

    /**
     * Get unique protocols from all drivers
     */
    const getAvailableProtocols = () => {
        const allDrivers = [...drivers, ...availableDrivers];
        const protocols = new Set(allDrivers.map(driver => driver.protocol));
        return Array.from(protocols).sort();
    };

    /**
     * Get driver statistics
     */
    const getDriverStats = () => {
        const stats = driverService.getDriverStats();
        return {
            ...stats,
            protocols: getAvailableProtocols().length
        };
    };

    const filteredLoadedDrivers = getFilteredDrivers(drivers);
    const filteredAvailableDrivers = getFilteredDrivers(availableDrivers);
    const stats = getDriverStats();
    const protocols = getAvailableProtocols();

    if (loading && drivers.length === 0) {
        return html`
            <div class="p-6 max-w-screen-xl mx-auto">
                <div class="flex flex-col items-center justify-center h-full">
                    <div class="spinner"></div>
                    <p>Loading drivers...</p>
                </div>
            </div>
        `;
    }

    return html`
        <div class="p-6 max-w-screen-xl mx-auto flex flex-col gap-8">
            <!-- Page Header -->
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-2">
                    <h1>驱动管理</h1>
                    <p>管理协议驱动的加载、配置和状态监控</p>
                </div>
                <div class="flex gap-2">
                    <button 
                        class="btn btn-secondary" 
                        onClick=${scanForDrivers}
                        disabled=${loading}
                    >
                        🔍 扫描驱动
                    </button>
                    <button 
                        class="btn btn-secondary" 
                        onClick=${() => setShowDevelopmentTools(true)}
                    >
                        🛠️ 开发工具
                    </button>
                    <button 
                        class="btn btn-primary" 
                        onClick=${() => setShowInstallDialog(true)}
                    >
                        📦 安装驱动
                    </button>
                </div>
            </div>

            <!-- Error Display -->
            ${error && html`
                <div class="p-4 rounded-md bg-red-100 border border-red-400 text-red-700">
                    <span class="mr-2">⚠️</span>
                    <span class="flex-grow">${error}</span>
                    <button 
                        class="ml-4 font-bold" 
                        onClick=${() => setError(null)}
                    >
                        ×
                    </button>
                </div>
            `}

            <!-- Statistics Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 flex flex-col items-center justify-center">
                    <div class="text-3xl font-bold">${stats.loaded}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">已加载驱动</div>
                </div>
                <div class="stat-card stat-primary">
                    <div class="stat-value">${stats.available}</div>
                    <div class="stat-label">可用驱动</div>
                </div>
                <div class="stat-card stat-primary">
                    <div class="stat-value">${stats.protocols}</div>
                    <div class="stat-label">支持协议</div>
                </div>
                <div class="stat-card stat-primary">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">总计驱动</div>
                </div>
            </div>

            <!-- Filters and Search -->
            <div class="flex justify-between items-center gap-4">
                <div class="flex-grow">
                    <input
                        type="text"
                        placeholder="搜索驱动名称、协议或作者..."
                        value=${searchQuery}
                        onInput=${(e) => setSearchQuery(e.target.value)}
                        class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
                <div class="flex gap-2">
                    <select 
                        value=${filterStatus} 
                        onChange=${(e) => setFilterStatus(e.target.value)}
                        class="px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="all">所有状态</option>
                        <option value="loaded">已加载</option>
                        <option value="unloaded">未加载</option>
                        <option value="error">错误</option>
                    </select>
                    <select 
                        value=${filterProtocol} 
                        onChange=${(e) => setFilterProtocol(e.target.value)}
                        class="filter-select"
                    >
                        <option value="all">所有协议</option>
                        ${protocols.map(protocol => html`
                            <option key=${protocol} value=${protocol}>${protocol}</option>
                        `)}
                    </select>
                </div>
            </div>

            <!-- Loaded Drivers Section -->
            <div class="flex flex-col gap-4">
                <div class="flex justify-between items-center">
                    <h2>已加载驱动 (${filteredLoadedDrivers.length})</h2>
                    <button 
                        class="btn btn-secondary btn-sm" 
                        onClick=${loadDrivers}
                        disabled=${loading}
                    >
                        🔄 刷新
                    </button>
                </div>
                
                ${filteredLoadedDrivers.length === 0 ? html`
                    <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg text-center p-12">
                        <div class="text-4xl mb-4">📦</div>
                        <h3>没有已加载的驱动</h3>
                        <p>当前没有加载任何协议驱动</p>
                    </div>
                ` : html`
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${filteredLoadedDrivers.map(driver => html`
                            <${DriverCard}
                                key=${driver.id}
                                driver=${driver}
                                isLoaded=${true}
                                isOperating=${operationInProgress.has(driver.id)}
                                onToggle=${() => toggleDriver(driver.id)}
                                onConfigure=${() => configureDriver(driver.id)}
                                onVersionManager=${() => {
                                    setSelectedDriver(driver);
                                    setShowVersionManager(true);
                                }}
                                onCompatibilityValidator=${() => {
                                    setSelectedDriver(driver);
                                    setShowCompatibilityValidator(true);
                                }}
                            />
                        `)}
                    </div>
                `}
            </div>

            <!-- Available Drivers Section -->
            <div class="drivers-section">
                <div class="section-header">
                    <h2>可用驱动 (${filteredAvailableDrivers.length})</h2>
                </div>
                
                ${filteredAvailableDrivers.length === 0 ? html`
                    <div class="modern-card" style="text-align: center; padding: 3rem;">
                        <div class="empty-icon">🔍</div>
                        <h3>没有找到可用驱动</h3>
                        <p>请扫描驱动或安装新的驱动程序</p>
                        <button class="btn btn-primary" onClick=${scanForDrivers}>
                            扫描驱动
                        </button>
                    </div>
                ` : html`
                    <div class="drivers-grid">
                        ${filteredAvailableDrivers.map(driver => html`
                            <${DriverCard}
                                key=${driver.id}
                                driver=${driver}
                                isLoaded=${false}
                                isOperating=${operationInProgress.has(driver.id)}
                                onToggle=${() => toggleDriver(driver.id)}
                                onConfigure=${() => configureDriver(driver.id)}
                                onVersionManager=${() => {
                                    setSelectedDriver(driver);
                                    setShowVersionManager(true);
                                }}
                                onCompatibilityValidator=${() => {
                                    setSelectedDriver(driver);
                                    setShowCompatibilityValidator(true);
                                }}
                            />
                        `)}
                    </div>
                `}
            </div>

            <!-- Install Driver Dialog -->
            ${showInstallDialog && html`
                <${DriverInstallDialog}
                    onClose=${() => setShowInstallDialog(false)}
                    onInstallComplete=${loadDrivers}
                />
            `}

            <!-- Version Manager Dialog -->
            ${showVersionManager && html`
                <${DriverVersionManager}
                    driver=${selectedDriver}
                    onClose=${() => setShowVersionManager(false)}
                    onVersionChanged=${loadDrivers}
                />
            `}

            <!-- Compatibility Validator Dialog -->
            ${showCompatibilityValidator && html`
                <${DriverCompatibilityValidator}
                    driver=${selectedDriver}
                    onClose=${() => setShowCompatibilityValidator(false)}
                    onValidationComplete=${(results) => console.log('Validation results:', results)}
                />
            `}

            <!-- Development Tools Dialog -->
            ${showDevelopmentTools && html`
                <${DriverDevelopmentTools}
                    onClose=${() => setShowDevelopmentTools(false)}
                />
            `}
        </div>
    `;
};

/**
 * Driver Card Component
 */
const DriverCard = ({ 
    driver, 
    isLoaded, 
    isOperating, 
    onToggle, 
    onConfigure, 
    onVersionManager, 
    onCompatibilityValidator 
}) => {
    const status = driverService.getDriverStatus(driver.id);
    const [showDetails, setShowDetails] = useState(false);

    return html`
        <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg card-hover ${status} ${isLoaded ? 'loaded' : 'available'}">
            <div class="flex justify-between items-start p-4">
                <div class="flex flex-col">
                    <h3 class="font-bold">${driver.name}</h3>
                    <span class="text-sm text-gray-500">v${driver.version}</span>
                </div>
                <${StatusIndicator} 
                    value=${status} 
                    type="status" 
                    size="small" 
                />
            </div>

            <div class="p-4">
                <div class="flex flex-col gap-2">
                    <div class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">${driver.protocol}</div>
                    <p class="text-sm">${driver.description}</p>
                    
                    ${driver.author && html`
                        <div class="flex gap-2 text-sm">
                            <span class="font-semibold">作者:</span>
                            <span class="text-gray-600 dark:text-gray-300">${driver.author}</span>
                        </div>
                    `}
                    
                    ${driver.lastUpdated && html`
                        <div class="driver-meta">
                            <span class="meta-label">更新时间:</span>
                            <span class="meta-value">${formatTime(driver.lastUpdated)}</span>
                        </div>
                    `}

                    ${driver.supportedFeatures && driver.supportedFeatures.length > 0 && html`
                        <div class="flex flex-col gap-1">
                            <span class="meta-label">支持功能:</span>
                            <div class="flex flex-wrap gap-1">
                                ${driver.supportedFeatures.map(feature => html`
                                    <span key=${feature} class="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs rounded-full">${feature}</span>
                                `)}
                            </div>
                        </div>
                    `}
                </div>

                ${showDetails && html`
                    <div class="mt-4 pt-4 border-t dark:border-gray-700 flex flex-col gap-2">
                        ${driver.filePath && html`
                            <div class="driver-meta">
                                <span class="meta-label">文件路径:</span>
                                <span class="meta-value">${driver.filePath}</span>
                            </div>
                        `}
                        
                        ${driver.configSchema && html`
                            <div class="driver-meta">
                                <span class="meta-label">配置参数:</span>
                                <div class="flex flex-wrap gap-1">
                                    ${Object.keys(driver.configSchema.properties || {}).map(key => html`
                                        <span key=${key} class="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs rounded-full">${key}</span>
                                    `)}
                                </div>
                            </div>
                        `}
                    </div>
                `}
            </div>

            <div class="p-4 flex gap-2">
                <button 
                    class="btn btn-sm ${isLoaded ? 'btn-warning' : 'btn-success'}"
                    onClick=${onToggle}
                    disabled=${isOperating}
                >
                    ${isOperating ? '处理中...' : (isLoaded ? '卸载' : '加载')}
                </button>
                
                ${isLoaded && html`
                    <button 
                        class="btn btn-sm btn-secondary"
                        onClick=${onConfigure}
                    >
                        配置
                    </button>
                `}
                
                <button 
                    class="btn btn-sm btn-ghost"
                    onClick=${() => setShowDetails(!showDetails)}
                >
                    ${showDetails ? '收起' : '详情'}
                </button>

                ${isLoaded && onVersionManager && html`
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${onVersionManager}
                        title="版本管理"
                    >
                        📋 版本
                    </button>
                `}

                ${onCompatibilityValidator && html`
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${onCompatibilityValidator}
                        title="兼容性验证"
                    >
                        ✅ 验证
                    </button>
                `}
            </div>
        </div>
    `;
};



export default DriversPage;