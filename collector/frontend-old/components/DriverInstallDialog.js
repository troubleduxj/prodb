/**
 * Enhanced Driver Installation Dialog for ProDB Collector
 * Supports file upload, online installation, version management, and compatibility validation
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';
import { driverService } from '../services/drivers.js';
import { formatFileSize, formatTime } from '../utils/helpers.js';

const DriverInstallDialog = ({ onClose, onInstallComplete }) => {
    const [activeTab, setActiveTab] = useState('file'); // 'file' | 'online' | 'repository'
    const [selectedFile, setSelectedFile] = useState(null);
    const [installUrl, setInstallUrl] = useState('');
    const [installing, setInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [compatibilityCheck, setCompatibilityCheck] = useState(null);
    const [onlineDrivers, setOnlineDrivers] = useState([]);
    const [loadingOnlineDrivers, setLoadingOnlineDrivers] = useState(false);
    const [selectedOnlineDriver, setSelectedOnlineDriver] = useState(null);
    const [installProgress, setInstallProgress] = useState(0);

    // Load online drivers when switching to online tab
    useEffect(() => {
        if (activeTab === 'online' || activeTab === 'repository') {
            loadOnlineDrivers();
        }
    }, [activeTab]);

    /**
     * Load available online drivers
     */
    const loadOnlineDrivers = async () => {
        try {
            setLoadingOnlineDrivers(true);
            const drivers = await driverService.getOnlineDrivers();
            setOnlineDrivers(drivers);
        } catch (error) {
            console.error('Failed to load online drivers:', error);
            setInstallError(`加载在线驱动失败: ${error.message}`);
        } finally {
            setLoadingOnlineDrivers(false);
        }
    };

    /**
     * Handle file selection and validation
     */
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setInstallError(null);
        setValidationResult(null);
        setCompatibilityCheck(null);
        
        try {
            // Validate file
            const validation = await driverService.validateDriverFile(file);
            setValidationResult(validation);

            // Check compatibility if validation passes
            if (validation.valid) {
                const compatibility = await driverService.checkDriverCompatibility(file);
                setCompatibilityCheck(compatibility);
            }
        } catch (error) {
            setInstallError(`文件验证失败: ${error.message}`);
        }
    };

    /**
     * Install driver from file
     */
    const installFromFile = async () => {
        if (!selectedFile || !validationResult?.valid) return;

        try {
            setInstalling(true);
            setInstallError(null);
            setInstallProgress(0);

            const result = await driverService.installDriverFromFile(
                selectedFile, 
                {
                    onProgress: (progress) => setInstallProgress(progress),
                    validateCompatibility: true,
                    checkDependencies: true
                }
            );
            
            if (result.success) {
                onInstallComplete();
                onClose();
            } else {
                setInstallError(result.error || '安装失败');
            }

        } catch (error) {
            setInstallError(`安装失败: ${error.message}`);
        } finally {
            setInstalling(false);
            setInstallProgress(0);
        }
    };

    /**
     * Install driver from URL
     */
    const installFromUrl = async () => {
        if (!installUrl.trim()) return;

        try {
            setInstalling(true);
            setInstallError(null);
            setInstallProgress(0);

            const fileName = installUrl.split('/').pop() || 'driver.js';
            const result = await driverService.installDriverFromUrl(
                installUrl, 
                fileName,
                {
                    onProgress: (progress) => setInstallProgress(progress),
                    validateCompatibility: true,
                    checkDependencies: true
                }
            );
            
            if (result.success) {
                onInstallComplete();
                onClose();
            } else {
                setInstallError(result.error || '安装失败');
            }

        } catch (error) {
            setInstallError(`安装失败: ${error.message}`);
        } finally {
            setInstalling(false);
            setInstallProgress(0);
        }
    };

    /**
     * Install online driver
     */
    const installOnlineDriver = async (driver) => {
        try {
            setInstalling(true);
            setInstallError(null);
            setInstallProgress(0);
            setSelectedOnlineDriver(driver);

            const result = await driverService.installOnlineDriver(
                driver.id,
                {
                    onProgress: (progress) => setInstallProgress(progress),
                    validateCompatibility: true,
                    checkDependencies: true
                }
            );
            
            if (result.success) {
                onInstallComplete();
                onClose();
            } else {
                setInstallError(result.error || '安装失败');
            }

        } catch (error) {
            setInstallError(`安装失败: ${error.message}`);
        } finally {
            setInstalling(false);
            setInstallProgress(0);
            setSelectedOnlineDriver(null);
        }
    };

    /**
     * Check for driver updates
     */
    const checkForUpdates = async (driverId) => {
        try {
            const updates = await driverService.checkDriverUpdates(driverId);
            return updates;
        } catch (error) {
            console.error('Failed to check updates:', error);
            return null;
        }
    };

    /**
     * Handle install action based on active tab
     */
    const handleInstall = () => {
        switch (activeTab) {
            case 'file':
                installFromFile();
                break;
            case 'online':
                installFromUrl();
                break;
            default:
                break;
        }
    };

    const canInstall = () => {
        switch (activeTab) {
            case 'file':
                return selectedFile && validationResult?.valid && compatibilityCheck?.compatible;
            case 'online':
                return installUrl.trim();
            default:
                return false;
        }
    };

    return html`
        <${Modal} onClose=${onClose} title="安装驱动" size="large">
            <div class="install-dialog">
                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    <button 
                        class="tab-button ${activeTab === 'file' ? 'active' : ''}"
                        onClick=${() => setActiveTab('file')}
                    >
                        📁 文件安装
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'online' ? 'active' : ''}"
                        onClick=${() => setActiveTab('online')}
                    >
                        🌐 在线安装
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'repository' ? 'active' : ''}"
                        onClick=${() => setActiveTab('repository')}
                    >
                        📦 驱动仓库
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                    <!-- File Installation Tab -->
                    ${activeTab === 'file' && html`
                        <div class="install-section">
                            <div class="section-header">
                                <h3>从文件安装驱动</h3>
                                <p>支持 .js, .dll, .so, .dylib 格式的驱动文件</p>
                            </div>

                            <!-- File Upload -->
                            <div class="file-upload-area">
                                <input
                                    type="file"
                                    id="driverFile"
                                    accept=".js,.dll,.so,.dylib"
                                    onChange=${handleFileSelect}
                                    class="file-input"
                                    style="display: none;"
                                />
                                <label for="driverFile" class="file-upload-label">
                                    <div class="upload-icon">📁</div>
                                    <div class="upload-text">
                                        <strong>点击选择驱动文件</strong>
                                        <p>或拖拽文件到此处</p>
                                    </div>
                                </label>
                            </div>
                            
                            <!-- Selected File Info -->
                            ${selectedFile && html`
                                <div class="file-info-card">
                                    <div class="file-header">
                                        <div class="file-icon">📄</div>
                                        <div class="file-details">
                                            <div class="file-name">${selectedFile.name}</div>
                                            <div class="file-meta">
                                                <span class="file-size">${formatFileSize(selectedFile.size)}</span>
                                                <span class="file-type">${selectedFile.type || '未知类型'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Validation Results -->
                                    ${validationResult && html`
                                        <div class="validation-section">
                                            <h4>文件验证</h4>
                                            <div class="validation-result ${validationResult.valid ? 'valid' : 'invalid'}">
                                                <div class="validation-status">
                                                    <span class="status-icon">
                                                        ${validationResult.valid ? '✅' : '❌'}
                                                    </span>
                                                    <span class="status-text">
                                                        ${validationResult.valid ? '验证通过' : '验证失败'}
                                                    </span>
                                                </div>
                                                
                                                ${!validationResult.valid && html`
                                                    <div class="validation-errors">
                                                        ${validationResult.errors.map(error => html`
                                                            <div key=${error} class="validation-error">
                                                                ⚠️ ${error}
                                                            </div>
                                                        `)}
                                                    </div>
                                                `}

                                                ${validationResult.warnings && validationResult.warnings.length > 0 && html`
                                                    <div class="validation-warnings">
                                                        ${validationResult.warnings.map(warning => html`
                                                            <div key=${warning} class="validation-warning">
                                                                ⚠️ ${warning}
                                                            </div>
                                                        `)}
                                                    </div>
                                                `}
                                            </div>
                                        </div>
                                    `}

                                    <!-- Compatibility Check -->
                                    ${compatibilityCheck && html`
                                        <div class="compatibility-section">
                                            <h4>兼容性检查</h4>
                                            <div class="compatibility-result ${compatibilityCheck.compatible ? 'compatible' : 'incompatible'}">
                                                <div class="compatibility-status">
                                                    <span class="status-icon">
                                                        ${compatibilityCheck.compatible ? '✅' : '❌'}
                                                    </span>
                                                    <span class="status-text">
                                                        ${compatibilityCheck.compatible ? '兼容' : '不兼容'}
                                                    </span>
                                                </div>

                                                <!-- System Requirements -->
                                                ${compatibilityCheck.requirements && html`
                                                    <div class="requirements-check">
                                                        <h5>系统要求</h5>
                                                        <div class="requirements-list">
                                                            ${Object.entries(compatibilityCheck.requirements).map(([req, status]) => html`
                                                                <div key=${req} class="requirement-item ${status ? 'met' : 'unmet'}">
                                                                    <span class="req-icon">${status ? '✅' : '❌'}</span>
                                                                    <span class="req-text">${req}</span>
                                                                </div>
                                                            `)}
                                                        </div>
                                                    </div>
                                                `}

                                                <!-- Dependencies -->
                                                ${compatibilityCheck.dependencies && html`
                                                    <div class="dependencies-check">
                                                        <h5>依赖项检查</h5>
                                                        <div class="dependencies-list">
                                                            ${compatibilityCheck.dependencies.map(dep => html`
                                                                <div key=${dep.name} class="dependency-item ${dep.available ? 'available' : 'missing'}">
                                                                    <span class="dep-icon">${dep.available ? '✅' : '❌'}</span>
                                                                    <span class="dep-name">${dep.name}</span>
                                                                    <span class="dep-version">${dep.version || '未知版本'}</span>
                                                                </div>
                                                            `)}
                                                        </div>
                                                    </div>
                                                `}

                                                ${!compatibilityCheck.compatible && html`
                                                    <div class="compatibility-issues">
                                                        ${compatibilityCheck.issues.map(issue => html`
                                                            <div key=${issue} class="compatibility-issue">
                                                                ⚠️ ${issue}
                                                            </div>
                                                        `)}
                                                    </div>
                                                `}
                                            </div>
                                        </div>
                                    `}
                                </div>
                            `}
                        </div>
                    `}

                    <!-- Online Installation Tab -->
                    ${activeTab === 'online' && html`
                        <div class="install-section">
                            <div class="section-header">
                                <h3>从URL安装驱动</h3>
                                <p>提供驱动文件的直接下载链接</p>
                            </div>

                            <div class="url-input-section">
                                <label class="form-label">驱动下载URL</label>
                                <input
                                    type="url"
                                    placeholder="https://example.com/driver.js"
                                    value=${installUrl}
                                    onInput=${(e) => setInstallUrl(e.target.value)}
                                    class="url-input"
                                />
                                <p class="form-help">
                                    支持HTTP/HTTPS直接下载链接，文件将自动验证兼容性
                                </p>
                            </div>

                            <!-- URL Validation -->
                            ${installUrl && html`
                                <div class="url-validation">
                                    <div class="validation-item">
                                        <span class="validation-icon">
                                            ${installUrl.startsWith('https://') ? '🔒' : '⚠️'}
                                        </span>
                                        <span class="validation-text">
                                            ${installUrl.startsWith('https://') ? '安全连接' : '建议使用HTTPS'}
                                        </span>
                                    </div>
                                </div>
                            `}
                        </div>
                    `}

                    <!-- Driver Repository Tab -->
                    ${activeTab === 'repository' && html`
                        <div class="install-section">
                            <div class="section-header">
                                <h3>驱动仓库</h3>
                                <p>从官方和社区仓库安装验证过的驱动</p>
                            </div>

                            ${loadingOnlineDrivers ? html`
                                <div class="loading-state">
                                    <div class="spinner"></div>
                                    <p>加载驱动仓库...</p>
                                </div>
                            ` : html`
                                <div class="online-drivers-list">
                                    ${onlineDrivers.length === 0 ? html`
                                        <div class="empty-state">
                                            <div class="empty-icon">📦</div>
                                            <h4>暂无可用驱动</h4>
                                            <p>驱动仓库暂时为空，请稍后再试</p>
                                            <button class="btn btn-secondary" onClick=${loadOnlineDrivers}>
                                                🔄 重新加载
                                            </button>
                                        </div>
                                    ` : html`
                                        ${onlineDrivers.map(driver => html`
                                            <${OnlineDriverCard}
                                                key=${driver.id}
                                                driver=${driver}
                                                onInstall=${() => installOnlineDriver(driver)}
                                                installing=${installing && selectedOnlineDriver?.id === driver.id}
                                            />
                                        `)}
                                    `}
                                </div>
                            `}
                        </div>
                    `}
                </div>

                <!-- Installation Progress -->
                ${installing && html`
                    <div class="install-progress">
                        <div class="progress-header">
                            <span class="progress-text">安装中...</span>
                            <span class="progress-percentage">${installProgress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div 
                                class="progress-fill" 
                                style="width: ${installProgress}%"
                            ></div>
                        </div>
                    </div>
                `}

                <!-- Error Display -->
                ${installError && html`
                    <div class="alert alert-error">
                        <span class="alert-icon">⚠️</span>
                        <span class="alert-message">${installError}</span>
                        <button 
                            class="alert-close" 
                            onClick=${() => setInstallError(null)}
                        >
                            ×
                        </button>
                    </div>
                `}

                <!-- Dialog Actions -->
                <div class="dialog-actions">
                    <button 
                        class="btn btn-secondary" 
                        onClick=${onClose}
                        disabled=${installing}
                    >
                        取消
                    </button>
                    
                    ${activeTab !== 'repository' && html`
                        <button 
                            class="btn btn-primary" 
                            onClick=${handleInstall}
                            disabled=${!canInstall() || installing}
                        >
                            ${installing ? '安装中...' : '安装'}
                        </button>
                    `}
                </div>
            </div>
        <//>
    `;
};

/**
 * Online Driver Card Component
 */
const OnlineDriverCard = ({ driver, onInstall, installing }) => {
    const [showDetails, setShowDetails] = useState(false);

    return html`
        <div class="online-driver-card">
            <div class="driver-header">
                <div class="driver-info">
                    <h4 class="driver-name">${driver.name}</h4>
                    <span class="driver-version">v${driver.version}</span>
                </div>
                <div class="driver-badges">
                    <span class="protocol-badge">${driver.protocol}</span>
                    ${driver.verified && html`
                        <span class="verified-badge">✅ 已验证</span>
                    `}
                </div>
            </div>

            <div class="driver-body">
                <p class="driver-description">${driver.description}</p>
                
                <div class="driver-meta">
                    <div class="meta-item">
                        <span class="meta-label">作者:</span>
                        <span class="meta-value">${driver.author}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">下载量:</span>
                        <span class="meta-value">${driver.downloads || 0}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">评分:</span>
                        <span class="meta-value">
                            ${'⭐'.repeat(Math.floor(driver.rating || 0))} 
                            ${driver.rating ? driver.rating.toFixed(1) : 'N/A'}
                        </span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">更新时间:</span>
                        <span class="meta-value">${formatTime(driver.lastUpdated)}</span>
                    </div>
                </div>

                ${showDetails && html`
                    <div class="driver-details">
                        <!-- Changelog -->
                        ${driver.changelog && html`
                            <div class="detail-section">
                                <h5>更新日志</h5>
                                <div class="changelog">
                                    ${driver.changelog.slice(0, 3).map(change => html`
                                        <div key=${change.version} class="changelog-item">
                                            <span class="change-version">v${change.version}</span>
                                            <span class="change-date">${formatTime(change.date)}</span>
                                            <p class="change-description">${change.description}</p>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}

                        <!-- System Requirements -->
                        ${driver.requirements && html`
                            <div class="detail-section">
                                <h5>系统要求</h5>
                                <div class="requirements">
                                    ${Object.entries(driver.requirements).map(([req, value]) => html`
                                        <div key=${req} class="requirement">
                                            <span class="req-name">${req}:</span>
                                            <span class="req-value">${value}</span>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}

                        <!-- Dependencies -->
                        ${driver.dependencies && driver.dependencies.length > 0 && html`
                            <div class="detail-section">
                                <h5>依赖项</h5>
                                <div class="dependencies">
                                    ${driver.dependencies.map(dep => html`
                                        <span key=${dep} class="dependency-tag">${dep}</span>
                                    `)}
                                </div>
                            </div>
                        `}
                    </div>
                `}
            </div>

            <div class="driver-actions">
                <button 
                    class="btn btn-sm btn-ghost"
                    onClick=${() => setShowDetails(!showDetails)}
                >
                    ${showDetails ? '收起' : '详情'}
                </button>
                
                <button 
                    class="btn btn-sm btn-primary"
                    onClick=${onInstall}
                    disabled=${installing}
                >
                    ${installing ? '安装中...' : '安装'}
                </button>
            </div>
        </div>
    `;
};

export default DriverInstallDialog;