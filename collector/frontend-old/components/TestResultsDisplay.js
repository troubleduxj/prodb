/**
 * Test Results Display Component
 * Displays protocol test results with filtering and detailed views
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import services
import { SUPPORTED_PROTOCOLS } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

const html = htm.bind(h);

const TestResultsDisplay = ({ results, isLoading }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'success', 'error'
    const [protocolFilter, setProtocolFilter] = useState('all');
    const [sortBy, setSortBy] = useState('timestamp'); // 'timestamp', 'duration', 'protocol'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
    const [expandedResults, setExpandedResults] = useState(new Set());

    // Filter and sort results
    const filteredResults = results
        .filter(result => {
            if (filter === 'success' && !result.success) return false;
            if (filter === 'error' && result.success) return false;
            if (protocolFilter !== 'all' && result.protocol !== protocolFilter) return false;
            return true;
        })
        .sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'duration':
                    aValue = a.duration || 0;
                    bValue = b.duration || 0;
                    break;
                case 'protocol':
                    aValue = a.protocol;
                    bValue = b.protocol;
                    break;
                case 'timestamp':
                default:
                    aValue = new Date(a.timestamp);
                    bValue = new Date(b.timestamp);
                    break;
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

    // Toggle result expansion
    const toggleExpanded = (resultId) => {
        setExpandedResults(prev => {
            const newSet = new Set(prev);
            if (newSet.has(resultId)) {
                newSet.delete(resultId);
            } else {
                newSet.add(resultId);
            }
            return newSet;
        });
    };

    // Get unique protocols from results
    const availableProtocols = [...new Set(results.map(r => r.protocol))];

    // Get statistics
    const stats = {
        total: results.length,
        success: results.filter(r => r.success).length,
        error: results.filter(r => !r.success).length,
        avgDuration: results.length > 0 
            ? Math.round(results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length)
            : 0
    };

    return html`
        <div class="test-results-display">
            ${results.length === 0 && !isLoading ? html`
                <!-- Empty State -->
                <div class="empty-results">
                    <div class="empty-icon">📊</div>
                    <h3>暂无测试结果</h3>
                    <p>执行协议测试后，结果将在这里显示</p>
                </div>
            ` : html`
                <!-- Results Header with Filters -->
                <div class="results-header">
                    <div class="results-stats">
                        <div class="stat-item">
                            <span class="stat-label">总计</span>
                            <span class="stat-value">${stats.total}</span>
                        </div>
                        <div class="stat-item success">
                            <span class="stat-label">成功</span>
                            <span class="stat-value">${stats.success}</span>
                        </div>
                        <div class="stat-item error">
                            <span class="stat-label">失败</span>
                            <span class="stat-value">${stats.error}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">平均耗时</span>
                            <span class="stat-value">${stats.avgDuration}ms</span>
                        </div>
                    </div>

                    <div class="results-filters">
                        <!-- Status Filter -->
                        <select
                            class="filter-select"
                            value=${filter}
                            onChange=${(e) => setFilter(e.target.value)}
                        >
                            <option value="all">全部状态</option>
                            <option value="success">仅成功</option>
                            <option value="error">仅失败</option>
                        </select>

                        <!-- Protocol Filter -->
                        <select
                            class="filter-select"
                            value=${protocolFilter}
                            onChange=${(e) => setProtocolFilter(e.target.value)}
                        >
                            <option value="all">全部协议</option>
                            ${availableProtocols.map(protocol => {
                                const protocolInfo = SUPPORTED_PROTOCOLS[protocol];
                                return html`
                                    <option key=${protocol} value=${protocol}>
                                        ${protocolInfo?.name || protocol}
                                    </option>
                                `;
                            })}
                        </select>

                        <!-- Sort Options -->
                        <select
                            class="filter-select"
                            value=${`${sortBy}-${sortOrder}`}
                            onChange=${(e) => {
                                const [newSortBy, newSortOrder] = e.target.value.split('-');
                                setSortBy(newSortBy);
                                setSortOrder(newSortOrder);
                            }}
                        >
                            <option value="timestamp-desc">最新优先</option>
                            <option value="timestamp-asc">最旧优先</option>
                            <option value="duration-desc">耗时最长</option>
                            <option value="duration-asc">耗时最短</option>
                            <option value="protocol-asc">协议A-Z</option>
                            <option value="protocol-desc">协议Z-A</option>
                        </select>
                    </div>
                </div>

                <!-- Results List -->
                <div class="results-list">
                    ${filteredResults.length === 0 ? html`
                        <div class="no-filtered-results">
                            <p>没有符合筛选条件的结果</p>
                        </div>
                    ` : filteredResults.map(result => html`
                        <${TestResultItem}
                            key=${result.id}
                            result=${result}
                            isExpanded=${expandedResults.has(result.id)}
                            onToggleExpanded=${() => toggleExpanded(result.id)}
                        />
                    `)}
                </div>
            `}

            <!-- Loading State -->
            ${isLoading && html`
                <div class="results-loading">
                    <div class="spinner"></div>
                    <p>正在执行测试...</p>
                </div>
            `}
        </div>
    `;
};

// Individual Test Result Item Component
const TestResultItem = ({ result, isExpanded, onToggleExpanded }) => {
    const protocolInfo = SUPPORTED_PROTOCOLS[result.protocol];
    const timestamp = new Date(result.timestamp);

    // Format test type for display
    const formatTestType = (testType) => {
        const typeLabels = {
            connect: '连接测试',
            browse: '浏览节点',
            read: '读取数据',
            subscribe: '订阅数据',
            device_scan: '设备扫描',
            readCoils: '读取线圈',
            readHoldingRegisters: '读取保持寄存器',
            publish: '发布消息'
        };
        return typeLabels[testType] || testType;
    };

    // Format duration
    const formatDuration = (duration) => {
        if (duration < 1000) {
            return `${duration}ms`;
        } else {
            return `${(duration / 1000).toFixed(2)}s`;
        }
    };

    // Get status icon and color
    const getStatusDisplay = (success) => {
        return success 
            ? { icon: '✅', class: 'success', text: '成功' }
            : { icon: '❌', class: 'error', text: '失败' };
    };

    const statusDisplay = getStatusDisplay(result.success);

    return html`
        <div class="result-item ${statusDisplay.class}">
            <div class="result-header" onClick=${onToggleExpanded}>
                <div class="result-main-info">
                    <div class="result-status">
                        <span class="status-icon">${statusDisplay.icon}</span>
                        <span class="status-text">${statusDisplay.text}</span>
                    </div>
                    
                    <div class="result-protocol">
                        <span class="protocol-icon">${protocolInfo?.icon || '🔗'}</span>
                        <span class="protocol-name">${protocolInfo?.name || result.protocol}</span>
                    </div>
                    
                    <div class="result-test-type">
                        ${formatTestType(result.testType)}
                    </div>
                    
                    ${result.configName && html`
                        <div class="result-config-name">
                            ${result.configName}
                        </div>
                    `}
                </div>

                <div class="result-meta-info">
                    <div class="result-duration">
                        ${formatDuration(result.duration)}
                    </div>
                    
                    <div class="result-timestamp">
                        ${timestamp.toLocaleString()}
                    </div>
                    
                    <div class="expand-indicator">
                        <span class="expand-icon ${isExpanded ? 'expanded' : ''}">▼</span>
                    </div>
                </div>
            </div>

            ${isExpanded && html`
                <div class="result-details">
                    <!-- Error Details -->
                    ${!result.success && result.error && html`
                        <div class="error-details">
                            <h4>错误信息</h4>
                            <div class="error-message">${result.error}</div>
                        </div>
                    `}

                    <!-- Success Data -->
                    ${result.success && result.data && html`
                        <div class="success-details">
                            <h4>测试数据</h4>
                            ${result.protocol === 'SCAN' ? html`
                                <${DeviceScanResults} data=${result.data} />
                            ` : html`
                                <div class="data-display">
                                    <pre>${JSON.stringify(result.data, null, 2)}</pre>
                                </div>
                            `}
                        </div>
                    `}

                    <!-- Test Configuration -->
                    <div class="config-details">
                        <h4>测试配置</h4>
                        <div class="config-info">
                            <div class="config-item">
                                <span class="config-key">协议:</span>
                                <span class="config-value">${result.protocol}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-key">测试类型:</span>
                                <span class="config-value">${result.testType}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-key">执行时间:</span>
                                <span class="config-value">${timestamp.toISOString()}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-key">测试ID:</span>
                                <span class="config-value">${result.id}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="result-actions">
                        <button 
                            class="btn btn-sm btn-secondary"
                            onClick=${(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(JSON.stringify(result, null, 2));
                            }}
                        >
                            📋 复制结果
                        </button>
                        
                        ${result.success && html`
                            <button 
                                class="btn btn-sm btn-primary"
                                onClick=${(e) => {
                                    e.stopPropagation();
                                    devLog('Retry test with same config:', result);
                                    // TODO: Implement retry functionality
                                }}
                            >
                                🔄 重新测试
                            </button>
                        `}
                    </div>
                </div>
            `}
        </div>
    `;
};

// Device Scan Results Component
const DeviceScanResults = ({ data }) => {
    const { devices, count } = data;

    return html`
        <div class="scan-results-display">
            <div class="scan-summary">
                <p>发现 ${count} 个设备</p>
            </div>
            
            ${devices && devices.length > 0 && html`
                <div class="scanned-devices">
                    ${devices.map((device, index) => html`
                        <div key=${index} class="scanned-device">
                            <div class="device-ip">${device.ip}</div>
                            ${device.hostname && html`
                                <div class="device-hostname">${device.hostname}</div>
                            `}
                            <div class="device-protocols">
                                ${device.protocols.map(protocol => {
                                    const protocolInfo = SUPPORTED_PROTOCOLS[protocol];
                                    return html`
                                        <span key=${protocol} class="protocol-tag">
                                            ${protocolInfo?.icon} ${protocolInfo?.name || protocol}
                                        </span>
                                    `;
                                })}
                            </div>
                            <div class="device-response-time">${device.responseTime}ms</div>
                        </div>
                    `)}
                </div>
            `}
        </div>
    `;
};

export default TestResultsDisplay;