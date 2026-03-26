/**
 * Driver Version Manager Component for ProDB Collector
 * Handles driver version management, updates, and compatibility checking
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';
import StatusIndicator from './StatusIndicator.js';
import { driverService } from '../services/drivers.js';
import { formatTime, compareVersions } from '../utils/helpers.js';

const DriverVersionManager = ({ driver, onClose, onVersionChanged }) => {
    const [versions, setVersions] = useState([]);
    const [availableUpdates, setAvailableUpdates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [rollbackHistory, setRollbackHistory] = useState([]);
    const [compatibilityMatrix, setCompatibilityMatrix] = useState(null);

    useEffect(() => {
        loadVersionData();
    }, [driver.id]);

    /**
     * Load version-related data
     */
    const loadVersionData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [
                versionHistory,
                updates,
                rollbacks,
                compatibility
            ] = await Promise.all([
                driverService.getDriverVersionHistory(driver.id),
                driverService.checkDriverUpdates(driver.id),
                driverService.getRollbackHistory(driver.id),
                driverService.getCompatibilityMatrix(driver.id)
            ]);

            setVersions(versionHistory);
            setAvailableUpdates(updates);
            setRollbackHistory(rollbacks);
            setCompatibilityMatrix(compatibility);

        } catch (err) {
            console.error('Failed to load version data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Update driver to specific version
     */
    const updateToVersion = async (targetVersion) => {
        try {
            setUpdating(true);
            setError(null);

            const result = await driverService.updateDriverVersion(
                driver.id, 
                targetVersion,
                {
                    createBackup: true,
                    validateCompatibility: true,
                    checkDependencies: true
                }
            );

            if (result.success) {
                await loadVersionData();
                onVersionChanged && onVersionChanged(targetVersion);
            } else {
                setError(result.error || '更新失败');
            }

        } catch (err) {
            console.error('Failed to update driver:', err);
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    /**
     * Rollback to previous version
     */
    const rollbackToVersion = async (targetVersion) => {
        try {
            setUpdating(true);
            setError(null);

            const result = await driverService.rollbackDriverVersion(
                driver.id, 
                targetVersion
            );

            if (result.success) {
                await loadVersionData();
                onVersionChanged && onVersionChanged(targetVersion);
            } else {
                setError(result.error || '回滚失败');
            }

        } catch (err) {
            console.error('Failed to rollback driver:', err);
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    /**
     * Check compatibility for a specific version
     */
    const checkVersionCompatibility = async (version) => {
        try {
            const compatibility = await driverService.checkVersionCompatibility(
                driver.id, 
                version
            );
            return compatibility;
        } catch (error) {
            console.error('Failed to check compatibility:', error);
            return { compatible: false, issues: [error.message] };
        }
    };

    /**
     * Get version status
     */
    const getVersionStatus = (version) => {
        if (version.version === driver.version) {
            return 'current';
        }
        
        const comparison = compareVersions(version.version, driver.version);
        if (comparison > 0) {
            return 'newer';
        } else if (comparison < 0) {
            return 'older';
        }
        
        return 'unknown';
    };

    /**
     * Get compatibility status color
     */
    const getCompatibilityColor = (compatibility) => {
        if (!compatibility) return 'unknown';
        if (compatibility.compatible) return 'success';
        if (compatibility.warnings && compatibility.warnings.length > 0) return 'warning';
        return 'error';
    };

    if (loading) {
        return html`
            <${Modal} onClose=${onClose} title="版本管理" size="large">
                <div class="loading-container">
                    <div class="spinner"></div>
                    <p>加载版本信息...</p>
                </div>
            <//>
        `;
    }

    return html`
        <${Modal} onClose=${onClose} title="驱动版本管理 - ${driver.name}" size="large">
            <div class="version-manager">
                <!-- Current Version Info -->
                <div class="current-version-section">
                    <div class="section-header">
                        <h3>当前版本</h3>
                        <${StatusIndicator} 
                            value=${driver.status} 
                            type="status" 
                            size="small" 
                        />
                    </div>
                    
                    <div class="current-version-card">
                        <div class="version-info">
                            <div class="version-number">v${driver.version}</div>
                            <div class="version-meta">
                                <span class="install-date">
                                    安装时间: ${formatTime(driver.installedAt || driver.lastUpdated)}
                                </span>
                                <span class="protocol-info">
                                    协议: ${driver.protocol}
                                </span>
                            </div>
                        </div>
                        
                        ${compatibilityMatrix && html`
                            <div class="compatibility-info">
                                <div class="compatibility-item">
                                    <span class="compat-label">系统兼容性:</span>
                                    <span class="compat-status ${getCompatibilityColor(compatibilityMatrix.system)}">
                                        ${compatibilityMatrix.system?.compatible ? '✅ 兼容' : '❌ 不兼容'}
                                    </span>
                                </div>
                                <div class="compatibility-item">
                                    <span class="compat-label">依赖项状态:</span>
                                    <span class="compat-status ${getCompatibilityColor(compatibilityMatrix.dependencies)}">
                                        ${compatibilityMatrix.dependencies?.satisfied ? '✅ 满足' : '❌ 缺失'}
                                    </span>
                                </div>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Available Updates -->
                ${availableUpdates.length > 0 && html`
                    <div class="updates-section">
                        <div class="section-header">
                            <h3>可用更新 (${availableUpdates.length})</h3>
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${loadVersionData}
                                disabled=${loading}
                            >
                                🔄 检查更新
                            </button>
                        </div>
                        
                        <div class="updates-list">
                            ${availableUpdates.map(update => html`
                                <${UpdateCard}
                                    key=${update.version}
                                    update=${update}
                                    currentVersion=${driver.version}
                                    onUpdate=${() => updateToVersion(update.version)}
                                    updating=${updating}
                                />
                            `)}
                        </div>
                    </div>
                `}

                <!-- Version History -->
                <div class="history-section">
                    <div class="section-header">
                        <h3>版本历史</h3>
                        <div class="history-filters">
                            <select class="filter-select">
                                <option value="all">所有版本</option>
                                <option value="stable">稳定版本</option>
                                <option value="beta">测试版本</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="versions-timeline">
                        ${versions.map(version => html`
                            <${VersionCard}
                                key=${version.version}
                                version=${version}
                                status=${getVersionStatus(version)}
                                currentVersion=${driver.version}
                                onRollback=${() => rollbackToVersion(version.version)}
                                onUpdate=${() => updateToVersion(version.version)}
                                updating=${updating}
                            />
                        `)}
                    </div>
                </div>

                <!-- Rollback History -->
                ${rollbackHistory.length > 0 && html`
                    <div class="rollback-section">
                        <div class="section-header">
                            <h3>回滚历史</h3>
                        </div>
                        
                        <div class="rollback-list">
                            ${rollbackHistory.map(rollback => html`
                                <div key=${rollback.id} class="rollback-item">
                                    <div class="rollback-info">
                                        <span class="rollback-versions">
                                            v${rollback.fromVersion} → v${rollback.toVersion}
                                        </span>
                                        <span class="rollback-date">
                                            ${formatTime(rollback.timestamp)}
                                        </span>
                                    </div>
                                    <div class="rollback-reason">
                                        ${rollback.reason || '用户手动回滚'}
                                    </div>
                                </div>
                            `)}
                        </div>
                    </div>
                `}

                <!-- Error Display -->
                ${error && html`
                    <div class="alert alert-error">
                        <span class="alert-icon">⚠️</span>
                        <span class="alert-message">${error}</span>
                        <button 
                            class="alert-close" 
                            onClick=${() => setError(null)}
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
                        disabled=${updating}
                    >
                        关闭
                    </button>
                </div>
            </div>
        <//>
    `;
};

/**
 * Update Card Component
 */
const UpdateCard = ({ update, currentVersion, onUpdate, updating }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [compatibility, setCompatibility] = useState(null);
    const [checkingCompat, setCheckingCompat] = useState(false);

    const checkCompatibility = async () => {
        try {
            setCheckingCompat(true);
            const compat = await driverService.checkVersionCompatibility(
                update.driverId, 
                update.version
            );
            setCompatibility(compat);
        } catch (error) {
            console.error('Failed to check compatibility:', error);
        } finally {
            setCheckingCompat(false);
        }
    };

    useEffect(() => {
        if (showDetails && !compatibility) {
            checkCompatibility();
        }
    }, [showDetails]);

    const getUpdateType = () => {
        const comparison = compareVersions(update.version, currentVersion);
        const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
        const [updateMajor, updateMinor] = update.version.split('.').map(Number);

        if (updateMajor > currentMajor) return 'major';
        if (updateMinor > currentMinor) return 'minor';
        return 'patch';
    };

    const updateType = getUpdateType();
    const updateTypeLabels = {
        major: '主要更新',
        minor: '功能更新', 
        patch: '修复更新'
    };

    return html`
        <div class="update-card ${updateType}">
            <div class="update-header">
                <div class="update-info">
                    <div class="update-version">
                        v${update.version}
                        <span class="update-type-badge ${updateType}">
                            ${updateTypeLabels[updateType]}
                        </span>
                    </div>
                    <div class="update-meta">
                        <span class="release-date">
                            发布时间: ${formatTime(update.releaseDate)}
                        </span>
                        <span class="update-size">
                            大小: ${update.size || 'N/A'}
                        </span>
                    </div>
                </div>
                
                <div class="update-actions">
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${() => setShowDetails(!showDetails)}
                    >
                        ${showDetails ? '收起' : '详情'}
                    </button>
                    <button 
                        class="btn btn-sm btn-primary"
                        onClick=${onUpdate}
                        disabled=${updating}
                    >
                        ${updating ? '更新中...' : '更新'}
                    </button>
                </div>
            </div>

            <div class="update-summary">
                <p>${update.description || '版本更新'}</p>
            </div>

            ${showDetails && html`
                <div class="update-details">
                    <!-- Changelog -->
                    ${update.changelog && html`
                        <div class="detail-section">
                            <h5>更新内容</h5>
                            <div class="changelog">
                                ${update.changelog.map(change => html`
                                    <div key=${change} class="changelog-item">
                                        <span class="change-type">•</span>
                                        <span class="change-text">${change}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}

                    <!-- Breaking Changes -->
                    ${update.breakingChanges && update.breakingChanges.length > 0 && html`
                        <div class="detail-section">
                            <h5 class="warning-title">⚠️ 重要变更</h5>
                            <div class="breaking-changes">
                                ${update.breakingChanges.map(change => html`
                                    <div key=${change} class="breaking-change">
                                        <span class="change-icon">⚠️</span>
                                        <span class="change-text">${change}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}

                    <!-- Compatibility Check -->
                    <div class="detail-section">
                        <h5>兼容性检查</h5>
                        ${checkingCompat ? html`
                            <div class="checking-compatibility">
                                <div class="spinner-sm"></div>
                                <span>检查中...</span>
                            </div>
                        ` : compatibility ? html`
                            <div class="compatibility-result ${compatibility.compatible ? 'compatible' : 'incompatible'}">
                                <div class="compat-status">
                                    <span class="status-icon">
                                        ${compatibility.compatible ? '✅' : '❌'}
                                    </span>
                                    <span class="status-text">
                                        ${compatibility.compatible ? '兼容' : '不兼容'}
                                    </span>
                                </div>
                                
                                ${compatibility.issues && compatibility.issues.length > 0 && html`
                                    <div class="compat-issues">
                                        ${compatibility.issues.map(issue => html`
                                            <div key=${issue} class="compat-issue">
                                                ⚠️ ${issue}
                                            </div>
                                        `)}
                                    </div>
                                `}

                                ${compatibility.warnings && compatibility.warnings.length > 0 && html`
                                    <div class="compat-warnings">
                                        ${compatibility.warnings.map(warning => html`
                                            <div key=${warning} class="compat-warning">
                                                ⚠️ ${warning}
                                            </div>
                                        `)}
                                    </div>
                                `}
                            </div>
                        ` : html`
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${checkCompatibility}
                            >
                                检查兼容性
                            </button>
                        `}
                    </div>
                </div>
            `}
        </div>
    `;
};

/**
 * Version Card Component
 */
const VersionCard = ({ version, status, currentVersion, onRollback, onUpdate, updating }) => {
    const [showDetails, setShowDetails] = useState(false);

    const getStatusIcon = () => {
        switch (status) {
            case 'current': return '🟢';
            case 'newer': return '🔵';
            case 'older': return '⚪';
            default: return '⚫';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'current': return '当前版本';
            case 'newer': return '更新版本';
            case 'older': return '历史版本';
            default: return '未知';
        }
    };

    const canRollback = status === 'older' && version.version !== currentVersion;
    const canUpdate = status === 'newer';

    return html`
        <div class="version-card ${status}">
            <div class="version-header">
                <div class="version-info">
                    <div class="version-number">
                        <span class="status-icon">${getStatusIcon()}</span>
                        v${version.version}
                        <span class="status-text">${getStatusText()}</span>
                    </div>
                    <div class="version-meta">
                        <span class="release-date">
                            ${formatTime(version.releaseDate)}
                        </span>
                        ${version.stability && html`
                            <span class="stability-badge ${version.stability}">
                                ${version.stability}
                            </span>
                        `}
                    </div>
                </div>
                
                <div class="version-actions">
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${() => setShowDetails(!showDetails)}
                    >
                        ${showDetails ? '收起' : '详情'}
                    </button>
                    
                    ${canRollback && html`
                        <button 
                            class="btn btn-sm btn-warning"
                            onClick=${onRollback}
                            disabled=${updating}
                        >
                            回滚
                        </button>
                    `}
                    
                    ${canUpdate && html`
                        <button 
                            class="btn btn-sm btn-primary"
                            onClick=${onUpdate}
                            disabled=${updating}
                        >
                            更新
                        </button>
                    `}
                </div>
            </div>

            ${version.description && html`
                <div class="version-summary">
                    <p>${version.description}</p>
                </div>
            `}

            ${showDetails && html`
                <div class="version-details">
                    <!-- Features -->
                    ${version.features && version.features.length > 0 && html`
                        <div class="detail-section">
                            <h5>新增功能</h5>
                            <ul class="feature-list">
                                ${version.features.map(feature => html`
                                    <li key=${feature}>${feature}</li>
                                `)}
                            </ul>
                        </div>
                    `}

                    <!-- Bug Fixes -->
                    ${version.bugFixes && version.bugFixes.length > 0 && html`
                        <div class="detail-section">
                            <h5>问题修复</h5>
                            <ul class="bugfix-list">
                                ${version.bugFixes.map(fix => html`
                                    <li key=${fix}>${fix}</li>
                                `)}
                            </ul>
                        </div>
                    `}

                    <!-- Technical Details -->
                    <div class="detail-section">
                        <h5>技术信息</h5>
                        <div class="tech-details">
                            ${version.fileSize && html`
                                <div class="tech-item">
                                    <span class="tech-label">文件大小:</span>
                                    <span class="tech-value">${version.fileSize}</span>
                                </div>
                            `}
                            ${version.checksum && html`
                                <div class="tech-item">
                                    <span class="tech-label">校验和:</span>
                                    <span class="tech-value">${version.checksum.substring(0, 16)}...</span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};

export default DriverVersionManager;