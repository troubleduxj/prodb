/**
 * Driver Card Component for ProDB Collector
 * Displays driver information, status, and actions
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import StatusIndicator from './StatusIndicator.js';
import { driverService } from '../services/drivers.js';
import { formatTime, formatFileSize } from '../utils/helpers.js';

const DriverCard = ({ 
    driver, 
    isLoaded = false, 
    isOperating = false, 
    onToggle, 
    onConfigure, 
    onViewDetails,
    showExtendedInfo = false 
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const [healthStatus, setHealthStatus] = useState(null);
    const [loadingHealth, setLoadingHealth] = useState(false);

    const status = driverService.getDriverStatus(driver.id);

    /**
     * Check driver health
     */
    const checkDriverHealth = async () => {
        if (!isLoaded) return;

        try {
            setLoadingHealth(true);
            const health = await driverService.getDriverHealth(driver.id);
            setHealthStatus(health);
        } catch (error) {
            console.error('Failed to check driver health:', error);
            setHealthStatus({ healthy: false, error: error.message });
        } finally {
            setLoadingHealth(false);
        }
    };

    /**
     * Export driver configuration
     */
    const exportConfig = () => {
        try {
            const config = driverService.exportDriverConfig(driver.id);
            const blob = new Blob([JSON.stringify(config, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${driver.name}-config.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export driver config:', error);
            alert(`导出配置失败: ${error.message}`);
        }
    };

    /**
     * Get status color class
     */
    const getStatusClass = () => {
        switch (status) {
            case 'loaded': return 'status-success';
            case 'loading': 
            case 'unloading': return 'status-warning';
            case 'error': return 'status-error';
            case 'unloaded': return 'status-secondary';
            default: return 'status-unknown';
        }
    };

    /**
     * Get protocol icon
     */
    const getProtocolIcon = (protocol) => {
        const icons = {
            'OPC_UA': '🏭',
            'OPC_DA': '🏭',
            'MODBUS_TCP': '🔌',
            'MODBUS_RTU': '🔌',
            'MQTT': '📡',
            'ETHERNET_IP': '🌐',
            'PROFINET': '🔗',
            'S7': '🏭'
        };
        return icons[protocol] || '📦';
    };

    return html`
        <div class="driver-card ${getStatusClass()} ${isLoaded ? 'loaded' : 'available'}">
            <!-- Card Header -->
            <div class="card-header">
                <div class="driver-info">
                    <div class="driver-title">
                        <span class="protocol-icon">${getProtocolIcon(driver.protocol)}</span>
                        <h3 class="driver-name">${driver.name}</h3>
                    </div>
                    <div class="driver-meta-header">
                        <span class="driver-version">v${driver.version}</span>
                        <${StatusIndicator} 
                            value=${status} 
                            type="status" 
                            size="small" 
                        />
                    </div>
                </div>
            </div>

            <!-- Card Body -->
            <div class="card-body">
                <div class="driver-details">
                    <!-- Protocol Badge -->
                    <div class="protocol-info">
                        <span class="protocol-badge">${driver.protocol}</span>
                        ${driver.supportedFeatures && driver.supportedFeatures.length > 0 && html`
                            <span class="features-count">
                                ${driver.supportedFeatures.length} 功能
                            </span>
                        `}
                    </div>

                    <!-- Description -->
                    <p class="driver-description">${driver.description}</p>
                    
                    <!-- Basic Metadata -->
                    <div class="driver-metadata">
                        ${driver.author && html`
                            <div class="meta-item">
                                <span class="meta-label">👤 作者:</span>
                                <span class="meta-value">${driver.author}</span>
                            </div>
                        `}
                        
                        ${driver.lastUpdated && html`
                            <div class="meta-item">
                                <span class="meta-label">🕒 更新:</span>
                                <span class="meta-value">${formatTime(driver.lastUpdated)}</span>
                            </div>
                        `}

                        ${isLoaded && driver.uptime && html`
                            <div class="meta-item">
                                <span class="meta-label">⏱️ 运行时间:</span>
                                <span class="meta-value">${Math.floor(driver.uptime / 3600)}h</span>
                            </div>
                        `}
                    </div>

                    <!-- Health Status for Loaded Drivers -->
                    ${isLoaded && healthStatus && html`
                        <div class="health-status ${healthStatus.healthy ? 'healthy' : 'unhealthy'}">
                            <div class="health-indicator">
                                <span class="health-icon">
                                    ${healthStatus.healthy ? '💚' : '❤️'}
                                </span>
                                <span class="health-text">
                                    ${healthStatus.healthy ? '运行正常' : '运行异常'}
                                </span>
                            </div>
                            ${healthStatus.memoryUsage && html`
                                <div class="health-metrics">
                                    <span class="metric">内存: ${healthStatus.memoryUsage.toFixed(1)}MB</span>
                                    ${healthStatus.errorCount > 0 && html`
                                        <span class="metric error">错误: ${healthStatus.errorCount}</span>
                                    `}
                                </div>
                            `}
                        </div>
                    `}

                    <!-- Extended Details -->
                    ${showDetails && html`
                        <div class="driver-extended-details">
                            <!-- Supported Features -->
                            ${driver.supportedFeatures && driver.supportedFeatures.length > 0 && html`
                                <div class="detail-section">
                                    <h4 class="detail-title">支持功能</h4>
                                    <div class="feature-tags">
                                        ${driver.supportedFeatures.map(feature => html`
                                            <span key=${feature} class="feature-tag">${feature}</span>
                                        `)}
                                    </div>
                                </div>
                            `}

                            <!-- Configuration Schema -->
                            ${driver.configSchema && driver.configSchema.properties && html`
                                <div class="detail-section">
                                    <h4 class="detail-title">配置参数</h4>
                                    <div class="config-params">
                                        ${Object.entries(driver.configSchema.properties).map(([key, schema]) => html`
                                            <div key=${key} class="config-param">
                                                <span class="param-name">${key}</span>
                                                <span class="param-type">${schema.type}</span>
                                                ${schema.description && html`
                                                    <span class="param-desc">${schema.description}</span>
                                                `}
                                            </div>
                                        `)}
                                    </div>
                                </div>
                            `}

                            <!-- File Information -->
                            ${driver.filePath && html`
                                <div class="detail-section">
                                    <h4 class="detail-title">文件信息</h4>
                                    <div class="file-info">
                                        <div class="file-path">${driver.filePath}</div>
                                        ${driver.fileSize && html`
                                            <div class="file-size">${formatFileSize(driver.fileSize)}</div>
                                        `}
                                    </div>
                                </div>
                            `}

                            <!-- Dependencies -->
                            ${driver.dependencies && driver.dependencies.length > 0 && html`
                                <div class="detail-section">
                                    <h4 class="detail-title">依赖项</h4>
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
            </div>

            <!-- Card Actions -->
            <div class="card-actions">
                <!-- Primary Action -->
                <button 
                    class="btn btn-sm ${isLoaded ? 'btn-warning' : 'btn-success'}"
                    onClick=${onToggle}
                    disabled=${isOperating}
                    title=${isLoaded ? '卸载驱动' : '加载驱动'}
                >
                    ${isOperating ? '处理中...' : (isLoaded ? '卸载' : '加载')}
                </button>
                
                <!-- Configure Button (only for loaded drivers) -->
                ${isLoaded && html`
                    <button 
                        class="btn btn-sm btn-secondary"
                        onClick=${onConfigure}
                        title="配置驱动"
                    >
                        ⚙️ 配置
                    </button>
                `}

                <!-- Health Check Button (only for loaded drivers) -->
                ${isLoaded && html`
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${checkDriverHealth}
                        disabled=${loadingHealth}
                        title="检查驱动健康状态"
                    >
                        ${loadingHealth ? '检查中...' : '🏥 健康'}
                    </button>
                `}

                <!-- Export Config Button (only for loaded drivers) -->
                ${isLoaded && html`
                    <button 
                        class="btn btn-sm btn-ghost"
                        onClick=${exportConfig}
                        title="导出驱动配置"
                    >
                        📤 导出
                    </button>
                `}
                
                <!-- Details Toggle -->
                <button 
                    class="btn btn-sm btn-ghost"
                    onClick=${() => setShowDetails(!showDetails)}
                    title=${showDetails ? '收起详情' : '查看详情'}
                >
                    ${showDetails ? '🔼 收起' : '🔽 详情'}
                </button>

                <!-- More Actions Menu -->
                ${showExtendedInfo && html`
                    <div class="dropdown">
                        <button class="btn btn-sm btn-ghost dropdown-toggle">
                            ⋯
                        </button>
                        <div class="dropdown-menu">
                            ${onViewDetails && html`
                                <button class="dropdown-item" onClick=${onViewDetails}>
                                    📋 查看详细信息
                                </button>
                            `}
                            <button class="dropdown-item" onClick=${() => navigator.clipboard.writeText(driver.id)}>
                                📋 复制驱动ID
                            </button>
                            ${driver.filePath && html`
                                <button class="dropdown-item" onClick=${() => navigator.clipboard.writeText(driver.filePath)}>
                                    📁 复制文件路径
                                </button>
                            `}
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
};

export default DriverCard;