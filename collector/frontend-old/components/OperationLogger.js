/**
 * 操作日志组件 - 显示和管理操作日志
 * 增强版本包含安全审计、异常检测和风险评估功能
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import securityService from '../services/security.js';

const OperationLogger = ({ 
    showFilters = true, 
    maxEntries = 100,
    autoRefresh = true,
    refreshInterval = 30000,
    enableSecurityAnalysis = true,
    showRiskScores = true,
    enableAnomalyDetection = true
}) => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [filters, setFilters] = useState({
        operation: '',
        user: '',
        success: '',
        startTime: '',
        endTime: '',
        riskLevel: '',
        anomaly: false
    });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [securityStats, setSecurityStats] = useState(null);
    const [anomalies, setAnomalies] = useState([]);
    const [alertThreshold, setAlertThreshold] = useState(5);

    useEffect(() => {
        loadLogs();
        
        if (autoRefresh) {
            const interval = setInterval(() => {
                loadLogs();
                if (enableAnomalyDetection) {
                    checkForAnomalies();
                }
            }, refreshInterval);
            return () => clearInterval(interval);
        }
    }, []);

    useEffect(() => {
        applyFilters();
        if (enableSecurityAnalysis) {
            calculateSecurityStats();
        }
    }, [logs, filters]);

    useEffect(() => {
        if (enableAnomalyDetection) {
            checkForAnomalies();
        }
    }, [logs]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const allLogs = securityService.getOperationLogs();
            
            // 增强日志数据，添加风险评估
            const enhancedLogs = allLogs.map(log => ({
                ...log,
                riskScore: log.riskScore || securityService.calculateRiskScore(
                    log.operation, 
                    log.resource, 
                    log.details || {}
                ),
                isAnomalous: false // 将在异常检测中设置
            }));
            
            setLogs(enhancedLogs.slice(0, maxEntries));
        } catch (error) {
            console.error('Failed to load logs:', error);
            securityService.logFailedOperation('load_audit_logs', 'system', error);
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...logs];

        if (filters.operation) {
            filtered = filtered.filter(log => 
                log.operation.toLowerCase().includes(filters.operation.toLowerCase())
            );
        }

        if (filters.user) {
            filtered = filtered.filter(log => 
                log.user && log.user.name.toLowerCase().includes(filters.user.toLowerCase())
            );
        }

        if (filters.success !== '') {
            const successFilter = filters.success === 'true';
            filtered = filtered.filter(log => log.success === successFilter);
        }

        if (filters.startTime) {
            const startTime = new Date(filters.startTime);
            filtered = filtered.filter(log => new Date(log.timestamp) >= startTime);
        }

        if (filters.endTime) {
            const endTime = new Date(filters.endTime);
            filtered = filtered.filter(log => new Date(log.timestamp) <= endTime);
        }

        if (filters.riskLevel) {
            filtered = filtered.filter(log => {
                const risk = log.riskScore || 0;
                switch (filters.riskLevel) {
                    case 'low': return risk <= 3;
                    case 'medium': return risk > 3 && risk <= 7;
                    case 'high': return risk > 7;
                    default: return true;
                }
            });
        }

        if (filters.anomaly) {
            filtered = filtered.filter(log => log.isAnomalous);
        }

        setFilteredLogs(filtered);
    };

    const calculateSecurityStats = () => {
        const stats = {
            totalLogs: filteredLogs.length,
            successfulOps: filteredLogs.filter(log => log.success).length,
            failedOps: filteredLogs.filter(log => !log.success).length,
            highRiskOps: filteredLogs.filter(log => (log.riskScore || 0) > 7).length,
            anomalousOps: filteredLogs.filter(log => log.isAnomalous).length,
            uniqueUsers: new Set(filteredLogs.map(log => log.user?.id).filter(Boolean)).size,
            operationTypes: {}
        };

        // 统计操作类型
        filteredLogs.forEach(log => {
            stats.operationTypes[log.operation] = (stats.operationTypes[log.operation] || 0) + 1;
        });

        // 计算成功率
        stats.successRate = stats.totalLogs > 0 
            ? ((stats.successfulOps / stats.totalLogs) * 100).toFixed(1)
            : 0;

        setSecurityStats(stats);
    };

    const checkForAnomalies = () => {
        const detectedAnomalies = securityService.detectAnomalousAccess();
        
        // 标记异常日志
        const updatedLogs = logs.map(log => {
            const isAnomalous = detectedAnomalies.some(anomaly => {
                // 检查日志是否与检测到的异常相关
                const logTime = new Date(log.timestamp);
                const recentTime = Date.now() - 60 * 60 * 1000; // 1小时内
                
                return logTime.getTime() > recentTime && (
                    (anomaly.type === 'frequent_failures' && !log.success) ||
                    (anomaly.type === 'excessive_deletions' && log.operation === 'delete') ||
                    (anomaly.type === 'unusual_time_access' && (logTime.getHours() < 6 || logTime.getHours() > 22))
                );
            });
            
            return { ...log, isAnomalous };
        });

        setLogs(updatedLogs);
        setAnomalies(detectedAnomalies);

        // 如果检测到高风险异常，显示警告
        const highRiskAnomalies = detectedAnomalies.filter(a => a.severity === 'high');
        if (highRiskAnomalies.length > 0) {
            showSecurityAlert(
                `检测到 ${highRiskAnomalies.length} 个高风险安全异常`,
                'error'
            );
        }
    };

    const showSecurityAlert = (message, type = 'warning') => {
        // 创建临时警告通知
        const alert = document.createElement('div');
        alert.className = `security-alert ${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${type === 'error' ? '🚨' : '⚠️'}</span>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            operation: '',
            user: '',
            success: '',
            startTime: '',
            endTime: ''
        });
    };

    const exportLogs = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            exportedBy: securityService.currentUser?.name,
            totalEntries: filteredLogs.length,
            logs: filteredLogs
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 记录导出操作
        securityService.logOperation('export_logs', 'audit_logs', {
            entriesExported: filteredLogs.length
        });
    };

    const getOperationIcon = (operation) => {
        const icons = {
            'create': '➕',
            'update': '✏️',
            'delete': '🗑️',
            'read': '👁️',
            'config_validation': '✅',
            'security_confirmation': '🔒',
            'session_expired': '⏰',
            'export_logs': '📤',
            'import_config': '📥',
            'permission_check': '🔐',
            'security_violation': '🚨',
            'anomaly_detected': '⚠️',
            'ip_blocked': '🚫',
            'session_extended': '🔄'
        };
        return icons[operation] || '📋';
    };

    const getRiskBadge = (riskScore) => {
        if (!showRiskScores || !riskScore) return null;
        
        let level, className;
        if (riskScore <= 3) {
            level = '低';
            className = 'low';
        } else if (riskScore <= 7) {
            level = '中';
            className = 'medium';
        } else {
            level = '高';
            className = 'high';
        }
        
        return html`
            <span class="risk-badge ${className}" title="风险分数: ${riskScore}/10">
                ${level}
            </span>
        `;
    };

    const getAnomalyIndicator = (isAnomalous) => {
        if (!enableAnomalyDetection || !isAnomalous) return null;
        
        return html`
            <span class="anomaly-indicator" title="检测到异常行为">
                🚨
            </span>
        `;
    };

    const getStatusBadge = (success) => {
        return success 
            ? html`<span class="status-badge success">成功</span>`
            : html`<span class="status-badge error">失败</span>`;
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString('zh-CN');
    };

    const showLogDetails = (log) => {
        setSelectedLog(log);
    };

    return html`
        <div class="operation-logger">
            <div class="logger-header">
                <h3>操作日志</h3>
                <div class="header-actions">
                    <button class="btn-secondary" onClick=${loadLogs} disabled=${isLoading}>
                        ${isLoading ? '刷新中...' : '刷新'}
                    </button>
                    <button class="btn-secondary" onClick=${exportLogs}>
                        导出日志
                    </button>
                </div>
            </div>

            ${showFilters && html`
                <div class="log-filters">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>操作类型:</label>
                            <input 
                                type="text" 
                                value=${filters.operation}
                                placeholder="搜索操作..."
                                onInput=${(e) => handleFilterChange('operation', e.target.value)}
                            />
                        </div>
                        
                        <div class="filter-group">
                            <label>用户:</label>
                            <input 
                                type="text" 
                                value=${filters.user}
                                placeholder="搜索用户..."
                                onInput=${(e) => handleFilterChange('user', e.target.value)}
                            />
                        </div>
                        
                        <div class="filter-group">
                            <label>状态:</label>
                            <select 
                                value=${filters.success}
                                onChange=${(e) => handleFilterChange('success', e.target.value)}
                            >
                                <option value="">全部</option>
                                <option value="true">成功</option>
                                <option value="false">失败</option>
                            </select>
                        </div>

                        ${showRiskScores && html`
                            <div class="filter-group">
                                <label>风险级别:</label>
                                <select 
                                    value=${filters.riskLevel}
                                    onChange=${(e) => handleFilterChange('riskLevel', e.target.value)}
                                >
                                    <option value="">全部</option>
                                    <option value="low">低风险</option>
                                    <option value="medium">中风险</option>
                                    <option value="high">高风险</option>
                                </select>
                            </div>
                        `}
                    </div>
                    
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>开始时间:</label>
                            <input 
                                type="datetime-local" 
                                value=${filters.startTime}
                                onChange=${(e) => handleFilterChange('startTime', e.target.value)}
                            />
                        </div>
                        
                        <div class="filter-group">
                            <label>结束时间:</label>
                            <input 
                                type="datetime-local" 
                                value=${filters.endTime}
                                onChange=${(e) => handleFilterChange('endTime', e.target.value)}
                            />
                        </div>

                        ${enableAnomalyDetection && html`
                            <div class="filter-group">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked=${filters.anomaly}
                                        onChange=${(e) => handleFilterChange('anomaly', e.target.checked)}
                                    />
                                    仅显示异常
                                </label>
                            </div>
                        `}
                        
                        <div class="filter-group">
                            <button class="btn-secondary" onClick=${clearFilters}>
                                清除筛选
                            </button>
                        </div>
                    </div>
                </div>
            `}

            <!-- 安全统计面板 -->
            ${enableSecurityAnalysis && securityStats && html`
                <div class="security-stats-panel">
                    <h4>安全统计</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">总操作数</span>
                            <span class="stat-value">${securityStats.totalLogs}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">成功率</span>
                            <span class="stat-value">${securityStats.successRate}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">失败操作</span>
                            <span class="stat-value error">${securityStats.failedOps}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">高风险操作</span>
                            <span class="stat-value warning">${securityStats.highRiskOps}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">异常操作</span>
                            <span class="stat-value error">${securityStats.anomalousOps}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">活跃用户</span>
                            <span class="stat-value">${securityStats.uniqueUsers}</span>
                        </div>
                    </div>
                </div>
            `}

            <!-- 异常检测面板 -->
            ${enableAnomalyDetection && anomalies.length > 0 && html`
                <div class="anomalies-panel">
                    <h4>检测到的异常 (${anomalies.length})</h4>
                    <div class="anomalies-list">
                        ${anomalies.map((anomaly, index) => html`
                            <div key=${index} class="anomaly-item ${anomaly.severity}">
                                <div class="anomaly-icon">
                                    ${anomaly.severity === 'high' ? '🚨' : '⚠️'}
                                </div>
                                <div class="anomaly-content">
                                    <div class="anomaly-message">${anomaly.message}</div>
                                    <div class="anomaly-details">
                                        类型: ${anomaly.type} | 次数: ${anomaly.count} | 严重程度: ${anomaly.severity}
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <div class="log-summary">
                <span>显示 ${filteredLogs.length} / ${logs.length} 条记录</span>
                ${autoRefresh && html`
                    <span class="auto-refresh-indicator">
                        🔄 自动刷新 (${refreshInterval / 1000}s)
                    </span>
                `}
            </div>

            <div class="log-table-container">
                <table class="log-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>操作</th>
                            <th>资源</th>
                            <th>用户</th>
                            <th>状态</th>
                            ${showRiskScores && html`<th>风险</th>`}
                            ${enableAnomalyDetection && html`<th>异常</th>`}
                            <th>详情</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredLogs.map(log => html`
                            <tr key=${log.id} class="log-row ${log.success ? 'success' : 'error'} ${log.isAnomalous ? 'anomalous' : ''}">
                                <td class="timestamp">
                                    ${formatTimestamp(log.timestamp)}
                                </td>
                                <td class="operation">
                                    <span class="operation-icon">${getOperationIcon(log.operation)}</span>
                                    ${log.operation}
                                </td>
                                <td class="resource">
                                    ${log.resource}
                                </td>
                                <td class="user">
                                    ${log.user ? log.user.name : 'System'}
                                </td>
                                <td class="status">
                                    ${getStatusBadge(log.success)}
                                </td>
                                ${showRiskScores && html`
                                    <td class="risk">
                                        ${getRiskBadge(log.riskScore)}
                                    </td>
                                `}
                                ${enableAnomalyDetection && html`
                                    <td class="anomaly">
                                        ${getAnomalyIndicator(log.isAnomalous)}
                                    </td>
                                `}
                                <td class="actions">
                                    <button 
                                        class="btn-link" 
                                        onClick=${() => showLogDetails(log)}
                                    >
                                        查看详情
                                    </button>
                                </td>
                            </tr>
                        `)}
                        
                        ${filteredLogs.length === 0 && html`
                            <tr>
                                <td colspan="6" class="no-data">
                                    ${isLoading ? '加载中...' : '暂无日志记录'}
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- 日志详情对话框 -->
            ${selectedLog && html`
                <${LogDetailsDialog} 
                    log=${selectedLog} 
                    onClose=${() => setSelectedLog(null)}
                />
            `}
        </div>
    `;
};

/**
 * 日志详情对话框
 */
const LogDetailsDialog = ({ log, onClose }) => {
    return html`
        <div class="log-details-overlay">
            <div class="log-details-dialog">
                <div class="dialog-header">
                    <h3>操作日志详情</h3>
                    <button class="close-btn" onClick=${onClose}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="log-basic-info">
                        <div class="info-row">
                            <span class="label">日志ID:</span>
                            <span class="value">${log.id}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">时间:</span>
                            <span class="value">${new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">操作:</span>
                            <span class="value">${log.operation}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">资源:</span>
                            <span class="value">${log.resource}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">状态:</span>
                            <span class="value ${log.success ? 'success' : 'error'}">
                                ${log.success ? '成功' : '失败'}
                            </span>
                        </div>
                    </div>

                    ${log.user && html`
                        <div class="log-user-info">
                            <h4>用户信息</h4>
                            <div class="info-row">
                                <span class="label">用户ID:</span>
                                <span class="value">${log.user.id}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">用户名:</span>
                                <span class="value">${log.user.name}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">会话ID:</span>
                                <span class="value">${log.user.sessionId}</span>
                            </div>
                        </div>
                    `}

                    ${log.details && Object.keys(log.details).length > 0 && html`
                        <div class="log-details-info">
                            <h4>详细信息</h4>
                            <pre class="details-json">${JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                    `}

                    ${log.error && html`
                        <div class="log-error-info">
                            <h4>错误信息</h4>
                            <div class="error-message">${log.error}</div>
                        </div>
                    `}

                    <!-- 安全信息 -->
                    ${log.riskScore && html`
                        <div class="log-security-info">
                            <h4>安全评估</h4>
                            <div class="info-row">
                                <span class="label">风险分数:</span>
                                <span class="value risk-score">${log.riskScore}/10</span>
                            </div>
                            <div class="info-row">
                                <span class="label">风险级别:</span>
                                <span class="value ${log.riskScore > 7 ? 'high' : log.riskScore > 3 ? 'medium' : 'low'}">
                                    ${log.riskScore > 7 ? '高风险' : log.riskScore > 3 ? '中风险' : '低风险'}
                                </span>
                            </div>
                            ${log.isAnomalous && html`
                                <div class="info-row">
                                    <span class="label">异常标记:</span>
                                    <span class="value anomalous">检测到异常行为</span>
                                </div>
                            `}
                        </div>
                    `}

                    <div class="log-technical-info">
                        <h4>技术信息</h4>
                        <div class="info-row">
                            <span class="label">IP地址:</span>
                            <span class="value">${log.ipAddress}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">用户代理:</span>
                            <span class="value">${log.userAgent}</span>
                        </div>
                        ${log.referrer && html`
                            <div class="info-row">
                                <span class="label">来源页面:</span>
                                <span class="value">${log.referrer}</span>
                            </div>
                        `}
                        ${log.csrfToken && html`
                            <div class="info-row">
                                <span class="label">CSRF令牌:</span>
                                <span class="value">${log.csrfToken.substring(0, 8)}...</span>
                            </div>
                        `}
                        ${log.browserFingerprint && html`
                            <div class="info-row">
                                <span class="label">浏览器指纹:</span>
                                <span class="value">${log.browserFingerprint}</span>
                            </div>
                        `}
                    </div>

                    <!-- 上下文信息 -->
                    ${log.context && html`
                        <div class="log-context-info">
                            <h4>上下文信息</h4>
                            <pre class="context-json">${JSON.stringify(log.context, null, 2)}</pre>
                        </div>
                    `}
                </div>
                
                <div class="dialog-actions">
                    <button class="btn-primary" onClick=${onClose}>
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
};

/**
 * 简化的日志查看器组件
 */
const SimpleLogViewer = ({ operations = [], maxEntries = 10 }) => {
    const [recentLogs, setRecentLogs] = useState([]);

    useEffect(() => {
        const logs = securityService.getOperationLogs({});
        let filtered = logs;
        
        if (operations.length > 0) {
            filtered = logs.filter(log => operations.includes(log.operation));
        }
        
        setRecentLogs(filtered.slice(0, maxEntries));
    }, [operations, maxEntries]);

    return html`
        <div class="simple-log-viewer">
            <h4>最近操作</h4>
            <div class="recent-logs">
                ${recentLogs.map(log => html`
                    <div key=${log.id} class="log-item ${log.success ? 'success' : 'error'}">
                        <div class="log-time">
                            ${new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div class="log-content">
                            <span class="log-operation">${log.operation}</span>
                            <span class="log-resource">${log.resource}</span>
                        </div>
                        <div class="log-status">
                            ${log.success ? '✓' : '✗'}
                        </div>
                    </div>
                `)}
                
                ${recentLogs.length === 0 && html`
                    <div class="no-logs">暂无操作记录</div>
                `}
            </div>
        </div>
    `;
};

export default OperationLogger;
export { LogDetailsDialog, SimpleLogViewer };