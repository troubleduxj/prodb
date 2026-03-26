/**
 * Driver Compatibility Validator Component for ProDB Collector
 * Validates driver compatibility and dependencies
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';
import { driverService } from '../services/drivers.js';
import { formatTime } from '../utils/helpers.js';

const DriverCompatibilityValidator = ({ driver, onClose, onValidationComplete }) => {
    const [validationResults, setValidationResults] = useState(null);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState(null);
    const [validationHistory, setValidationHistory] = useState([]);
    const [systemInfo, setSystemInfo] = useState(null);
    const [dependencyGraph, setDependencyGraph] = useState(null);

    useEffect(() => {
        loadInitialData();
    }, [driver.id]);

    /**
     * Load initial validation data
     */
    const loadInitialData = async () => {
        try {
            const [history, sysInfo] = await Promise.all([
                driverService.getValidationHistory(driver.id),
                driverService.getSystemInfo()
            ]);

            setValidationHistory(history);
            setSystemInfo(sysInfo);

            // Auto-run validation if no recent results
            const recentValidation = history.find(v => 
                Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000
            );

            if (!recentValidation) {
                runCompatibilityValidation();
            } else {
                setValidationResults(recentValidation.results);
            }

        } catch (err) {
            console.error('Failed to load validation data:', err);
            setError(err.message);
        }
    };

    /**
     * Run comprehensive compatibility validation
     */
    const runCompatibilityValidation = async () => {
        try {
            setValidating(true);
            setError(null);

            const results = await driverService.validateDriverCompatibility(driver.id, {
                checkSystemRequirements: true,
                checkDependencies: true,
                checkConflicts: true,
                checkPerformance: true,
                generateReport: true
            });

            setValidationResults(results);
            
            // Load dependency graph if validation passed
            if (results.overall.compatible) {
                const depGraph = await driverService.getDependencyGraph(driver.id);
                setDependencyGraph(depGraph);
            }

            onValidationComplete && onValidationComplete(results);

        } catch (err) {
            console.error('Validation failed:', err);
            setError(err.message);
        } finally {
            setValidating(false);
        }
    };

    /**
     * Fix compatibility issues automatically
     */
    const fixCompatibilityIssues = async (issues) => {
        try {
            setValidating(true);
            
            const fixResults = await driverService.fixCompatibilityIssues(
                driver.id, 
                issues
            );

            if (fixResults.success) {
                // Re-run validation after fixes
                await runCompatibilityValidation();
            } else {
                setError(fixResults.error || '修复失败');
            }

        } catch (err) {
            console.error('Failed to fix issues:', err);
            setError(err.message);
        } finally {
            setValidating(false);
        }
    };

    /**
     * Get validation status color
     */
    const getValidationStatusColor = (status) => {
        switch (status) {
            case 'compatible': return 'success';
            case 'warning': return 'warning';
            case 'incompatible': return 'error';
            default: return 'secondary';
        }
    };

    /**
     * Get validation status icon
     */
    const getValidationStatusIcon = (status) => {
        switch (status) {
            case 'compatible': return '✅';
            case 'warning': return '⚠️';
            case 'incompatible': return '❌';
            default: return '❓';
        }
    };

    return html`
        <${Modal} onClose=${onClose} title="兼容性验证 - ${driver.name}" size="large">
            <div class="compatibility-validator">
                <!-- Validation Header -->
                <div class="validation-header">
                    <div class="driver-info">
                        <h3>${driver.name} v${driver.version}</h3>
                        <p class="protocol-info">协议: ${driver.protocol}</p>
                    </div>
                    
                    <div class="validation-actions">
                        <button 
                            class="btn btn-primary"
                            onClick=${runCompatibilityValidation}
                            disabled=${validating}
                        >
                            ${validating ? '验证中...' : '🔍 重新验证'}
                        </button>
                    </div>
                </div>

                <!-- System Information -->
                ${systemInfo && html`
                    <div class="system-info-section">
                        <h4>系统环境</h4>
                        <div class="system-info-grid">
                            <div class="info-item">
                                <span class="info-label">操作系统:</span>
                                <span class="info-value">${systemInfo.os} ${systemInfo.version}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">架构:</span>
                                <span class="info-value">${systemInfo.arch}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">运行时:</span>
                                <span class="info-value">${systemInfo.runtime} ${systemInfo.runtimeVersion}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">内存:</span>
                                <span class="info-value">${systemInfo.totalMemory}GB</span>
                            </div>
                        </div>
                    </div>
                `}

                <!-- Validation Results -->
                ${validationResults && html`
                    <div class="validation-results">
                        <!-- Overall Status -->
                        <div class="overall-status">
                            <div class="status-header">
                                <span class="status-icon">
                                    ${getValidationStatusIcon(validationResults.overall.status)}
                                </span>
                                <h4 class="status-title">
                                    整体兼容性: ${validationResults.overall.status === 'compatible' ? '兼容' : 
                                                validationResults.overall.status === 'warning' ? '警告' : '不兼容'}
                                </h4>
                                <span class="validation-score">
                                    评分: ${validationResults.overall.score}/100
                                </span>
                            </div>
                            
                            ${validationResults.overall.summary && html`
                                <p class="status-summary">${validationResults.overall.summary}</p>
                            `}
                        </div>

                        <!-- Detailed Results -->
                        <div class="validation-categories">
                            <!-- System Requirements -->
                            <${ValidationCategory}
                                title="系统要求"
                                icon="🖥️"
                                results=${validationResults.systemRequirements}
                                onFix=${fixCompatibilityIssues}
                                validating=${validating}
                            />

                            <!-- Dependencies -->
                            <${ValidationCategory}
                                title="依赖项检查"
                                icon="📦"
                                results=${validationResults.dependencies}
                                onFix=${fixCompatibilityIssues}
                                validating=${validating}
                            />

                            <!-- Conflicts -->
                            <${ValidationCategory}
                                title="冲突检测"
                                icon="⚡"
                                results=${validationResults.conflicts}
                                onFix=${fixCompatibilityIssues}
                                validating=${validating}
                            />

                            <!-- Performance -->
                            <${ValidationCategory}
                                title="性能评估"
                                icon="📊"
                                results=${validationResults.performance}
                                onFix=${fixCompatibilityIssues}
                                validating=${validating}
                            />

                            <!-- Security -->
                            ${validationResults.security && html`
                                <${ValidationCategory}
                                    title="安全检查"
                                    icon="🔒"
                                    results=${validationResults.security}
                                    onFix=${fixCompatibilityIssues}
                                    validating=${validating}
                                />
                            `}
                        </div>

                        <!-- Dependency Graph -->
                        ${dependencyGraph && html`
                            <div class="dependency-graph-section">
                                <h4>依赖关系图</h4>
                                <${DependencyGraph} graph=${dependencyGraph} />
                            </div>
                        `}

                        <!-- Recommendations -->
                        ${validationResults.recommendations && validationResults.recommendations.length > 0 && html`
                            <div class="recommendations-section">
                                <h4>建议</h4>
                                <div class="recommendations-list">
                                    ${validationResults.recommendations.map(rec => html`
                                        <div key=${rec.id} class="recommendation-item ${rec.priority}">
                                            <div class="rec-header">
                                                <span class="rec-icon">
                                                    ${rec.priority === 'high' ? '🔴' : 
                                                      rec.priority === 'medium' ? '🟡' : '🟢'}
                                                </span>
                                                <span class="rec-title">${rec.title}</span>
                                                <span class="rec-priority">${rec.priority}</span>
                                            </div>
                                            <p class="rec-description">${rec.description}</p>
                                            
                                            ${rec.action && html`
                                                <button 
                                                    class="btn btn-sm btn-secondary"
                                                    onClick=${() => rec.action()}
                                                >
                                                    ${rec.actionLabel || '执行'}
                                                </button>
                                            `}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                    </div>
                `}

                <!-- Validation History -->
                ${validationHistory.length > 0 && html`
                    <div class="validation-history-section">
                        <h4>验证历史</h4>
                        <div class="history-list">
                            ${validationHistory.slice(0, 5).map(validation => html`
                                <div key=${validation.id} class="history-item">
                                    <div class="history-header">
                                        <span class="history-status ${getValidationStatusColor(validation.status)}">
                                            ${getValidationStatusIcon(validation.status)}
                                        </span>
                                        <span class="history-date">
                                            ${formatTime(validation.timestamp)}
                                        </span>
                                        <span class="history-score">
                                            ${validation.score}/100
                                        </span>
                                    </div>
                                    <p class="history-summary">${validation.summary}</p>
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

                <!-- Loading State -->
                ${validating && html`
                    <div class="validation-progress">
                        <div class="progress-header">
                            <span class="progress-text">正在验证兼容性...</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill indeterminate"></div>
                        </div>
                    </div>
                `}

                <!-- Dialog Actions -->
                <div class="dialog-actions">
                    <button 
                        class="btn btn-secondary" 
                        onClick=${onClose}
                        disabled=${validating}
                    >
                        关闭
                    </button>
                    
                    ${validationResults && html`
                        <button 
                            class="btn btn-primary"
                            onClick=${() => {
                                const report = driverService.generateCompatibilityReport(validationResults);
                                const blob = new Blob([report], { type: 'text/html' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${driver.name}-compatibility-report.html`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            📄 导出报告
                        </button>
                    `}
                </div>
            </div>
        <//>
    `;
};

/**
 * Validation Category Component
 */
const ValidationCategory = ({ title, icon, results, onFix, validating }) => {
    const [expanded, setExpanded] = useState(false);

    if (!results) return null;

    const getStatusColor = () => {
        if (results.issues && results.issues.length > 0) return 'error';
        if (results.warnings && results.warnings.length > 0) return 'warning';
        return 'success';
    };

    const getStatusText = () => {
        if (results.issues && results.issues.length > 0) return '不通过';
        if (results.warnings && results.warnings.length > 0) return '警告';
        return '通过';
    };

    const fixableIssues = results.issues?.filter(issue => issue.fixable) || [];

    return html`
        <div class="validation-category">
            <div class="category-header" onClick=${() => setExpanded(!expanded)}>
                <div class="category-info">
                    <span class="category-icon">${icon}</span>
                    <span class="category-title">${title}</span>
                    <span class="category-status ${getStatusColor()}">
                        ${getStatusText()}
                    </span>
                </div>
                
                <div class="category-actions">
                    ${fixableIssues.length > 0 && html`
                        <button 
                            class="btn btn-sm btn-warning"
                            onClick=${(e) => {
                                e.stopPropagation();
                                onFix(fixableIssues);
                            }}
                            disabled=${validating}
                        >
                            🔧 修复
                        </button>
                    `}
                    
                    <span class="expand-icon ${expanded ? 'expanded' : ''}">
                        ▼
                    </span>
                </div>
            </div>

            ${expanded && html`
                <div class="category-content">
                    <!-- Passed Checks -->
                    ${results.passed && results.passed.length > 0 && html`
                        <div class="checks-section">
                            <h5 class="checks-title success">✅ 通过的检查 (${results.passed.length})</h5>
                            <div class="checks-list">
                                ${results.passed.map(check => html`
                                    <div key=${check.id} class="check-item success">
                                        <span class="check-icon">✅</span>
                                        <span class="check-text">${check.description}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}

                    <!-- Warnings -->
                    ${results.warnings && results.warnings.length > 0 && html`
                        <div class="checks-section">
                            <h5 class="checks-title warning">⚠️ 警告 (${results.warnings.length})</h5>
                            <div class="checks-list">
                                ${results.warnings.map(warning => html`
                                    <div key=${warning.id} class="check-item warning">
                                        <span class="check-icon">⚠️</span>
                                        <div class="check-content">
                                            <span class="check-text">${warning.description}</span>
                                            ${warning.suggestion && html`
                                                <p class="check-suggestion">${warning.suggestion}</p>
                                            `}
                                        </div>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}

                    <!-- Issues -->
                    ${results.issues && results.issues.length > 0 && html`
                        <div class="checks-section">
                            <h5 class="checks-title error">❌ 问题 (${results.issues.length})</h5>
                            <div class="checks-list">
                                ${results.issues.map(issue => html`
                                    <div key=${issue.id} class="check-item error">
                                        <span class="check-icon">❌</span>
                                        <div class="check-content">
                                            <span class="check-text">${issue.description}</span>
                                            ${issue.solution && html`
                                                <p class="check-solution">解决方案: ${issue.solution}</p>
                                            `}
                                            ${issue.fixable && html`
                                                <button 
                                                    class="btn btn-xs btn-warning"
                                                    onClick=${() => onFix([issue])}
                                                    disabled=${validating}
                                                >
                                                    自动修复
                                                </button>
                                            `}
                                        </div>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}

                    <!-- Metrics -->
                    ${results.metrics && html`
                        <div class="metrics-section">
                            <h5>性能指标</h5>
                            <div class="metrics-grid">
                                ${Object.entries(results.metrics).map(([key, value]) => html`
                                    <div key=${key} class="metric-item">
                                        <span class="metric-label">${key}:</span>
                                        <span class="metric-value">${value}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
};

/**
 * Dependency Graph Component
 */
const DependencyGraph = ({ graph }) => {
    const [selectedNode, setSelectedNode] = useState(null);

    return html`
        <div class="dependency-graph">
            <div class="graph-container">
                <svg class="graph-svg" viewBox="0 0 800 600">
                    <!-- Render nodes and edges -->
                    ${graph.edges.map(edge => html`
                        <line
                            key="${edge.from}-${edge.to}"
                            x1=${graph.nodes.find(n => n.id === edge.from)?.x || 0}
                            y1=${graph.nodes.find(n => n.id === edge.from)?.y || 0}
                            x2=${graph.nodes.find(n => n.id === edge.to)?.x || 0}
                            y2=${graph.nodes.find(n => n.id === edge.to)?.y || 0}
                            stroke="#666"
                            stroke-width="2"
                            marker-end="url(#arrowhead)"
                        />
                    `)}
                    
                    ${graph.nodes.map(node => html`
                        <g key=${node.id}>
                            <circle
                                cx=${node.x}
                                cy=${node.y}
                                r="30"
                                fill=${node.status === 'satisfied' ? '#10b981' : 
                                      node.status === 'missing' ? '#ef4444' : '#f59e0b'}
                                stroke="#333"
                                stroke-width="2"
                                class="graph-node"
                                onClick=${() => setSelectedNode(node)}
                            />
                            <text
                                x=${node.x}
                                y=${node.y + 5}
                                text-anchor="middle"
                                fill="white"
                                font-size="12"
                                font-weight="bold"
                            >
                                ${node.name.substring(0, 8)}
                            </text>
                        </g>
                    `)}
                    
                    <!-- Arrow marker definition -->
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon
                                points="0 0, 10 3.5, 0 7"
                                fill="#666"
                            />
                        </marker>
                    </defs>
                </svg>
            </div>

            <!-- Node Details -->
            ${selectedNode && html`
                <div class="node-details">
                    <h5>${selectedNode.name}</h5>
                    <p class="node-version">版本: ${selectedNode.version}</p>
                    <p class="node-status">状态: ${selectedNode.status}</p>
                    ${selectedNode.description && html`
                        <p class="node-description">${selectedNode.description}</p>
                    `}
                </div>
            `}

            <!-- Legend -->
            <div class="graph-legend">
                <div class="legend-item">
                    <div class="legend-color satisfied"></div>
                    <span>已满足</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color missing"></div>
                    <span>缺失</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color optional"></div>
                    <span>可选</span>
                </div>
            </div>
        </div>
    `;
};

export default DriverCompatibilityValidator;