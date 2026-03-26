import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const ConfigHistoryManager = ({ onClose, interfaces = [] }) => {
    const [history, setHistory] = useState([]);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [filterType, setFilterType] = useState('all'); // 'all', 'create', 'update', 'delete'
    const [filterInterface, setFilterInterface] = useState('all');

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = () => {
        const savedHistory = JSON.parse(localStorage.getItem('config-history') || '[]');
        // 按时间倒序排列
        savedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setHistory(savedHistory);
    };

    const getFilteredHistory = () => {
        let filtered = history;

        if (filterType !== 'all') {
            filtered = filtered.filter(entry => entry.action === filterType);
        }

        if (filterInterface !== 'all') {
            filtered = filtered.filter(entry => 
                entry.interfaceId === filterInterface || 
                entry.interfaceName?.includes(filterInterface)
            );
        }

        return filtered;
    };

    const clearHistory = () => {
        if (!confirm('确定要清除所有历史记录吗？此操作不可恢复。')) return;
        
        localStorage.removeItem('config-history');
        setHistory([]);
        setSelectedEntry(null);
    };

    const exportHistory = () => {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'ProDB Collector History',
            history: history
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `config-history-${new Date().toISOString().split('T')[0]}.json`;
        
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'create': return '➕';
            case 'update': return '✏️';
            case 'delete': return '🗑️';
            case 'start': return '▶️';
            case 'stop': return '⏹️';
            case 'enable': return '✅';
            case 'disable': return '❌';
            case 'test': return '🧪';
            case 'backup': return '💾';
            case 'restore': return '🔄';
            default: return '📝';
        }
    };

    const getActionText = (action) => {
        const actionMap = {
            'create': '创建',
            'update': '更新',
            'delete': '删除',
            'start': '启动',
            'stop': '停止',
            'enable': '启用',
            'disable': '禁用',
            'test': '测试',
            'backup': '备份',
            'restore': '恢复'
        };
        return actionMap[action] || action;
    };

    const getTimeDifference = (timestamp) => {
        const now = new Date();
        const actionTime = new Date(timestamp);
        const diffMs = now - actionTime;
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) return '刚刚';
        if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        return `${diffDays} 天前`;
    };

    const renderChangeDetails = (entry) => {
        if (!entry.changes) return null;

        return html`
            <div class="change-details">
                <h4>变更详情</h4>
                ${entry.changes.map((change, index) => html`
                    <div class="change-item" key=${index}>
                        <div class="change-field">
                            <strong>${change.field}:</strong>
                        </div>
                        <div class="change-values">
                            ${change.oldValue !== undefined && html`
                                <div class="old-value">
                                    <span class="value-label">原值:</span>
                                    <code>${JSON.stringify(change.oldValue)}</code>
                                </div>
                            `}
                            ${change.newValue !== undefined && html`
                                <div class="new-value">
                                    <span class="value-label">新值:</span>
                                    <code>${JSON.stringify(change.newValue)}</code>
                                </div>
                            `}
                        </div>
                    </div>
                `)}
            </div>
        `;
    };

    const renderImpactAnalysis = (entry) => {
        if (!entry.impact) return null;

        return html`
            <div class="impact-analysis">
                <h4>影响范围</h4>
                <div class="impact-items">
                    ${entry.impact.affectedInterfaces && html`
                        <div class="impact-item">
                            <span class="impact-label">受影响接口:</span>
                            <span class="impact-value">${entry.impact.affectedInterfaces.length} 个</span>
                        </div>
                    `}
                    ${entry.impact.dataFlowInterruption && html`
                        <div class="impact-item warning">
                            <span class="impact-label">数据流中断:</span>
                            <span class="impact-value">是</span>
                        </div>
                    `}
                    ${entry.impact.requiresRestart && html`
                        <div class="impact-item warning">
                            <span class="impact-label">需要重启:</span>
                            <span class="impact-value">是</span>
                        </div>
                    `}
                    ${entry.impact.configValidation && html`
                        <div class="impact-item">
                            <span class="impact-label">配置验证:</span>
                            <span class="impact-value ${entry.impact.configValidation.valid ? 'success' : 'error'}">
                                ${entry.impact.configValidation.valid ? '通过' : '失败'}
                            </span>
                        </div>
                    `}
                </div>
            </div>
        `;
    };

    const filteredHistory = getFilteredHistory();
    const uniqueInterfaces = [...new Set(history.map(entry => entry.interfaceName).filter(Boolean))];

    return html`
        <${Modal} onClose=${onClose} title="配置变更历史" size="large">
            <div class="history-manager">
                <!-- 操作工具栏 -->
                <div class="history-toolbar">
                    <div class="toolbar-left">
                        <div class="filter-group">
                            <label>操作类型:</label>
                            <select
                                value=${filterType}
                                onChange=${(e) => setFilterType(e.target.value)}
                                class="form-select"
                            >
                                <option value="all">全部</option>
                                <option value="create">创建</option>
                                <option value="update">更新</option>
                                <option value="delete">删除</option>
                                <option value="start">启动</option>
                                <option value="stop">停止</option>
                                <option value="test">测试</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>接口:</label>
                            <select
                                value=${filterInterface}
                                onChange=${(e) => setFilterInterface(e.target.value)}
                                class="form-select"
                            >
                                <option value="all">全部接口</option>
                                ${uniqueInterfaces.map(name => html`
                                    <option value=${name} key=${name}>${name}</option>
                                `)}
                            </select>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button 
                            class="btn btn-secondary btn-sm"
                            onClick=${exportHistory}
                            disabled=${history.length === 0}
                        >
                            <span class="btn-icon">📤</span>
                            导出历史
                        </button>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${clearHistory}
                            disabled=${history.length === 0}
                        >
                            <span class="btn-icon">🗑️</span>
                            清除历史
                        </button>
                        <span class="history-count">共 ${filteredHistory.length} 条记录</span>
                    </div>
                </div>

                <!-- 历史记录列表 -->
                <div class="history-content">
                    ${filteredHistory.length === 0 ? html`
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <h3>暂无历史记录</h3>
                            <p>配置变更历史将在这里显示</p>
                        </div>
                    ` : html`
                        <div class="history-list">
                            ${filteredHistory.map(entry => html`
                                <div 
                                    class="history-entry ${selectedEntry?.id === entry.id ? 'selected' : ''}"
                                    key=${entry.id}
                                    onClick=${() => setSelectedEntry(entry)}
                                >
                                    <div class="entry-header">
                                        <div class="entry-info">
                                            <div class="entry-action">
                                                <span class="action-icon">${getActionIcon(entry.action)}</span>
                                                <span class="action-text">${getActionText(entry.action)}</span>
                                            </div>
                                            <div class="entry-target">
                                                ${entry.interfaceName && html`
                                                    <span class="interface-name">${entry.interfaceName}</span>
                                                `}
                                                ${entry.protocol && html`
                                                    <span class="protocol-badge">${entry.protocol}</span>
                                                `}
                                            </div>
                                        </div>
                                        <div class="entry-meta">
                                            <div class="entry-time">
                                                ${new Date(entry.timestamp).toLocaleString('zh-CN')}
                                            </div>
                                            <div class="entry-age">
                                                ${getTimeDifference(entry.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    ${entry.description && html`
                                        <div class="entry-description">
                                            ${entry.description}
                                        </div>
                                    `}

                                    <div class="entry-summary">
                                        ${entry.user && html`
                                            <span class="entry-user">操作者: ${entry.user}</span>
                                        `}
                                        ${entry.changes && html`
                                            <span class="entry-changes">变更: ${entry.changes.length} 项</span>
                                        `}
                                        ${entry.success !== undefined && html`
                                            <span class="entry-status ${entry.success ? 'success' : 'error'}">
                                                ${entry.success ? '成功' : '失败'}
                                            </span>
                                        `}
                                    </div>
                                </div>
                            `)}
                        </div>
                    `}
                </div>

                <!-- 详情面板 -->
                ${selectedEntry && html`
                    <div class="history-details">
                        <div class="details-header">
                            <h3>变更详情</h3>
                            <button 
                                class="close-details-btn"
                                onClick=${() => setSelectedEntry(null)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div class="details-content">
                            <div class="details-basic">
                                <div class="detail-item">
                                    <span class="detail-label">操作:</span>
                                    <span class="detail-value">
                                        ${getActionIcon(selectedEntry.action)} ${getActionText(selectedEntry.action)}
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">时间:</span>
                                    <span class="detail-value">
                                        ${new Date(selectedEntry.timestamp).toLocaleString('zh-CN')}
                                    </span>
                                </div>
                                ${selectedEntry.interfaceName && html`
                                    <div class="detail-item">
                                        <span class="detail-label">接口:</span>
                                        <span class="detail-value">${selectedEntry.interfaceName}</span>
                                    </div>
                                `}
                                ${selectedEntry.user && html`
                                    <div class="detail-item">
                                        <span class="detail-label">操作者:</span>
                                        <span class="detail-value">${selectedEntry.user}</span>
                                    </div>
                                `}
                            </div>

                            ${selectedEntry.description && html`
                                <div class="details-description">
                                    <h4>描述</h4>
                                    <p>${selectedEntry.description}</p>
                                </div>
                            `}

                            ${renderChangeDetails(selectedEntry)}
                            ${renderImpactAnalysis(selectedEntry)}

                            ${selectedEntry.error && html`
                                <div class="error-details">
                                    <h4>错误信息</h4>
                                    <div class="error-message">
                                        ${selectedEntry.error}
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                `}
            </div>
        <//>
    `;
};

// 导出历史记录功能
export const addConfigHistory = (action, interfaceData, changes = null, impact = null) => {
    const historyEntry = {
        id: `history-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        action,
        interfaceId: interfaceData?.id,
        interfaceName: interfaceData?.name,
        protocol: interfaceData?.protocol,
        description: generateActionDescription(action, interfaceData),
        changes,
        impact,
        user: 'System', // 可以从认证系统获取
        success: true
    };

    const savedHistory = JSON.parse(localStorage.getItem('config-history') || '[]');
    savedHistory.unshift(historyEntry);

    // 限制历史记录数量（保留最近1000条）
    if (savedHistory.length > 1000) {
        savedHistory.splice(1000);
    }

    localStorage.setItem('config-history', JSON.stringify(savedHistory));
    return historyEntry;
};

const generateActionDescription = (action, interfaceData) => {
    const actionMap = {
        'create': `创建了接口 "${interfaceData?.name}"`,
        'update': `更新了接口 "${interfaceData?.name}" 的配置`,
        'delete': `删除了接口 "${interfaceData?.name}"`,
        'start': `启动了接口 "${interfaceData?.name}"`,
        'stop': `停止了接口 "${interfaceData?.name}"`,
        'enable': `启用了接口 "${interfaceData?.name}"`,
        'disable': `禁用了接口 "${interfaceData?.name}"`,
        'test': `测试了接口 "${interfaceData?.name}" 的连接`
    };
    return actionMap[action] || `对接口 "${interfaceData?.name}" 执行了 ${action} 操作`;
};

export default ConfigHistoryManager;