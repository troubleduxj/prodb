/**
 * Enhanced Batch Operations Component for ProDB Collector
 * Provides comprehensive batch selection, operations, and quick configuration features
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

const BatchOperations = ({ 
    interfaces, 
    selectedIds, 
    onSelectionChange, 
    onBatchOperation,
    onQuickCreate,
    onConfigCopy,
    onConfigPaste,
    onQuickCreateFromExisting,
    clipboardConfig = null
}) => {
    const [showBatchActions, setShowBatchActions] = useState(false);
    const [operationInProgress, setOperationInProgress] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProtocol, setFilterProtocol] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterEnabled, setFilterEnabled] = useState('');
    const [groupBy, setGroupBy] = useState('none');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    useEffect(() => {
        setShowBatchActions(selectedIds.length > 0);
    }, [selectedIds]);

    const handleSelectAll = () => {
        const filteredInterfaces = getFilteredAndSortedInterfaces();
        const allIds = filteredInterfaces.map(iface => iface.id);
        const isAllSelected = allIds.every(id => selectedIds.includes(id));
        
        if (isAllSelected) {
            onSelectionChange([]);
        } else {
            onSelectionChange([...new Set([...selectedIds, ...allIds])]);
        }
    };

    const handleSelectByFilter = (filterType) => {
        const filteredInterfaces = getFilteredAndSortedInterfaces();
        let targetIds = [];
        
        switch (filterType) {
            case 'connected':
                targetIds = filteredInterfaces.filter(iface => iface.status === 'connected').map(iface => iface.id);
                break;
            case 'disconnected':
                targetIds = filteredInterfaces.filter(iface => iface.status === 'disconnected').map(iface => iface.id);
                break;
            case 'enabled':
                targetIds = filteredInterfaces.filter(iface => iface.enabled).map(iface => iface.id);
                break;
            case 'disabled':
                targetIds = filteredInterfaces.filter(iface => !iface.enabled).map(iface => iface.id);
                break;
            case 'protocol':
                if (filterProtocol) {
                    targetIds = filteredInterfaces.filter(iface => iface.protocol === filterProtocol).map(iface => iface.id);
                }
                break;
        }
        
        onSelectionChange([...new Set([...selectedIds, ...targetIds])]);
    };

    const handleBatchAction = async (action) => {
        if (selectedIds.length === 0) return;

        const confirmMessages = {
            start: `确定要启动 ${selectedIds.length} 个接口吗？`,
            stop: `确定要停止 ${selectedIds.length} 个接口吗？`,
            enable: `确定要启用 ${selectedIds.length} 个接口吗？`,
            disable: `确定要禁用 ${selectedIds.length} 个接口吗？`,
            delete: `确定要删除 ${selectedIds.length} 个接口吗？此操作不可撤销！`,
            export: `确定要导出 ${selectedIds.length} 个接口配置吗？`,
            duplicate: `确定要复制 ${selectedIds.length} 个接口配置吗？`,
            copy: `已复制 ${selectedIds.length} 个接口配置到剪贴板`,
            test: `确定要测试 ${selectedIds.length} 个接口连接吗？`
        };

        if (['delete'].includes(action) && !confirm(confirmMessages[action])) {
            return;
        }

        setOperationInProgress(true);
        try {
            await onBatchOperation(action, selectedIds);
            if (['delete', 'copy'].includes(action)) {
                if (action === 'copy') {
                    alert(confirmMessages[action]);
                }
                if (action === 'delete') {
                    onSelectionChange([]);
                }
            }
        } catch (error) {
            console.error(`Batch ${action} failed:`, error);
            alert(`批量${action}操作失败: ${error.message}`);
        } finally {
            setOperationInProgress(false);
        }
    };

    const handleQuickCreateFromSelected = () => {
        if (selectedIds.length !== 1) {
            alert('请选择一个接口作为模板');
            return;
        }
        
        const templateInterface = interfaces.find(iface => iface.id === selectedIds[0]);
        if (templateInterface && onQuickCreateFromExisting) {
            onQuickCreateFromExisting(templateInterface);
        }
    };

    const getFilteredAndSortedInterfaces = () => {
        let filtered = interfaces.filter(iface => {
            const matchesSearch = !searchTerm || 
                iface.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                iface.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (iface.config && JSON.stringify(iface.config).toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesProtocol = !filterProtocol || iface.protocol === filterProtocol;
            const matchesStatus = !filterStatus || iface.status === filterStatus;
            const matchesEnabled = !filterEnabled || 
                (filterEnabled === 'enabled' ? iface.enabled : !iface.enabled);
            
            return matchesSearch && matchesProtocol && matchesStatus && matchesEnabled;
        });

        // Sort interfaces
        filtered.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'protocol':
                    aValue = a.protocol;
                    bValue = b.protocol;
                    break;
                case 'status':
                    aValue = a.status;
                    bValue = b.status;
                    break;
                case 'created':
                    aValue = new Date(a.createdAt || 0);
                    bValue = new Date(b.createdAt || 0);
                    break;
                case 'updated':
                    aValue = new Date(a.updatedAt || 0);
                    bValue = new Date(b.updatedAt || 0);
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }
            
            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    };

    const getGroupedInterfaces = () => {
        const filtered = getFilteredAndSortedInterfaces();
        
        if (groupBy === 'none') {
            return { 'All Interfaces': filtered };
        }
        
        return filtered.reduce((groups, iface) => {
            let key;
            switch (groupBy) {
                case 'protocol':
                    key = iface.protocol;
                    break;
                case 'status':
                    key = iface.status === 'connected' ? '已连接' : 
                          iface.status === 'disconnected' ? '未连接' : '错误';
                    break;
                case 'enabled':
                    key = iface.enabled ? '已启用' : '已禁用';
                    break;
                case 'date':
                    const date = new Date(iface.createdAt || Date.now());
                    key = date.toLocaleDateString('zh-CN');
                    break;
                default:
                    key = 'Other';
            }
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(iface);
            return groups;
        }, {});
    };

    const getUniqueProtocols = () => {
        return [...new Set(interfaces.map(iface => iface.protocol))].sort();
    };

    const getUniqueStatuses = () => {
        return [...new Set(interfaces.map(iface => iface.status))].sort();
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterProtocol('');
        setFilterStatus('');
        setFilterEnabled('');
        setGroupBy('none');
        setSortBy('name');
        setSortOrder('asc');
    };

    const hasActiveFilters = () => {
        return searchTerm || filterProtocol || filterStatus || filterEnabled || groupBy !== 'none';
    };

    const selectedCount = selectedIds.length;
    const totalCount = interfaces.length;
    const filteredCount = getFilteredAndSortedInterfaces().length;

    return html`
        <div class="batch-operations">
            <!-- Enhanced Batch Selection Toolbar -->
            <div class="batch-toolbar">
                <div class="selection-controls">
                    <label class="batch-checkbox">
                        <input
                            type="checkbox"
                            checked=${selectedCount > 0}
                            indeterminate=${selectedCount > 0 && selectedCount < filteredCount}
                            onChange=${handleSelectAll}
                        />
                        <span class="selection-text">
                            ${selectedCount > 0 
                                ? `已选择 ${selectedCount} / ${filteredCount} 项` 
                                : '全选'
                            }
                        </span>
                    </label>
                    
                    <!-- Smart Selection Options -->
                    <div class="smart-selection">
                        <button 
                            class="btn btn-outline btn-xs"
                            onClick=${() => handleSelectByFilter('connected')}
                            title="选择所有已连接的接口"
                        >
                            选择已连接
                        </button>
                        <button 
                            class="btn btn-outline btn-xs"
                            onClick=${() => handleSelectByFilter('enabled')}
                            title="选择所有已启用的接口"
                        >
                            选择已启用
                        </button>
                        ${filterProtocol && html`
                            <button 
                                class="btn btn-outline btn-xs"
                                onClick=${() => handleSelectByFilter('protocol')}
                                title="选择当前协议的所有接口"
                            >
                                选择${filterProtocol}
                            </button>
                        `}
                    </div>
                    
                    ${selectedCount > 0 && html`
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => onSelectionChange([])}
                        >
                            清除选择
                        </button>
                    `}
                </div>

                <div class="filter-controls">
                    <!-- Enhanced Search -->
                    <div class="search-box">
                        <input
                            type="text"
                            class="search-input"
                            placeholder="搜索接口名称、协议或配置..."
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="search-icon">🔍</span>
                        ${searchTerm && html`
                            <button 
                                class="search-clear"
                                onClick=${() => setSearchTerm('')}
                                title="清除搜索"
                            >
                                ✕
                            </button>
                        `}
                    </div>

                    <!-- Basic Filters -->
                    <select
                        class="filter-select"
                        value=${filterProtocol}
                        onChange=${(e) => setFilterProtocol(e.target.value)}
                        title="按协议筛选"
                    >
                        <option value="">所有协议</option>
                        ${getUniqueProtocols().map(protocol => html`
                            <option value=${protocol} key=${protocol}>${protocol}</option>
                        `)}
                    </select>

                    <select
                        class="filter-select"
                        value=${filterStatus}
                        onChange=${(e) => setFilterStatus(e.target.value)}
                        title="按状态筛选"
                    >
                        <option value="">所有状态</option>
                        ${getUniqueStatuses().map(status => html`
                            <option value=${status} key=${status}>
                                ${status === 'connected' ? '已连接' : 
                                  status === 'disconnected' ? '未连接' : '错误'}
                            </option>
                        `)}
                    </select>

                    <!-- Advanced Filters Toggle -->
                    <button 
                        class="btn btn-outline btn-sm"
                        onClick=${() => setShowAdvancedFilters(!showAdvancedFilters)}
                        title="高级筛选选项"
                    >
                        <span class="btn-icon">${showAdvancedFilters ? '🔼' : '🔽'}</span>
                        高级筛选
                    </button>
                </div>

                <div class="quick-actions">
                    <button 
                        class="btn btn-primary btn-sm"
                        onClick=${() => onQuickCreate()}
                        title="创建新接口"
                    >
                        <span class="btn-icon">➕</span>
                        快速添加
                    </button>
                    
                    ${clipboardConfig && html`
                        <button 
                            class="btn btn-secondary btn-sm"
                            onClick=${() => onConfigPaste && onConfigPaste()}
                            title="粘贴配置"
                        >
                            <span class="btn-icon">📋</span>
                            粘贴配置
                        </button>
                    `}
                </div>
            </div>

            <!-- Advanced Filters Panel -->
            ${showAdvancedFilters && html`
                <div class="advanced-filters">
                    <div class="filter-row">
                        <label class="filter-label">启用状态:</label>
                        <select
                            class="filter-select"
                            value=${filterEnabled}
                            onChange=${(e) => setFilterEnabled(e.target.value)}
                        >
                            <option value="">全部</option>
                            <option value="enabled">已启用</option>
                            <option value="disabled">已禁用</option>
                        </select>

                        <label class="filter-label">排序方式:</label>
                        <select
                            class="filter-select"
                            value=${sortBy}
                            onChange=${(e) => setSortBy(e.target.value)}
                        >
                            <option value="name">按名称</option>
                            <option value="protocol">按协议</option>
                            <option value="status">按状态</option>
                            <option value="created">按创建时间</option>
                            <option value="updated">按更新时间</option>
                        </select>

                        <select
                            class="filter-select"
                            value=${sortOrder}
                            onChange=${(e) => setSortOrder(e.target.value)}
                        >
                            <option value="asc">升序</option>
                            <option value="desc">降序</option>
                        </select>

                        <label class="filter-label">分组方式:</label>
                        <select
                            class="filter-select"
                            value=${groupBy}
                            onChange=${(e) => setGroupBy(e.target.value)}
                        >
                            <option value="none">不分组</option>
                            <option value="protocol">按协议分组</option>
                            <option value="status">按状态分组</option>
                            <option value="enabled">按启用状态分组</option>
                            <option value="date">按创建日期分组</option>
                        </select>
                    </div>

                    <div class="filter-actions">
                        ${hasActiveFilters() && html`
                            <button 
                                class="btn btn-outline btn-sm"
                                onClick=${clearAllFilters}
                            >
                                清除所有筛选
                            </button>
                        `}
                    </div>
                </div>
            `}

            <!-- Enhanced Batch Actions Bar -->
            ${showBatchActions && html`
                <div class="batch-actions-bar">
                    <div class="actions-info">
                        <span class="selected-count">${selectedCount} 个接口已选择</span>
                        <div class="selection-summary">
                            ${selectedIds.length === 1 && html`
                                <span class="single-selection-hint">
                                    💡 选择单个接口可以复制配置或基于它创建新接口
                                </span>
                            `}
                        </div>
                    </div>
                    
                    <div class="batch-actions">
                        <!-- Connection Actions -->
                        <div class="action-group">
                            <button 
                                class="btn btn-success btn-sm"
                                onClick=${() => handleBatchAction('start')}
                                disabled=${operationInProgress}
                                title="启动选中的接口"
                            >
                                <span class="btn-icon">▶️</span>
                                启动
                            </button>
                            
                            <button 
                                class="btn btn-warning btn-sm"
                                onClick=${() => handleBatchAction('stop')}
                                disabled=${operationInProgress}
                                title="停止选中的接口"
                            >
                                <span class="btn-icon">⏹️</span>
                                停止
                            </button>
                            
                            <button 
                                class="btn btn-info btn-sm"
                                onClick=${() => handleBatchAction('test')}
                                disabled=${operationInProgress}
                                title="测试选中接口的连接"
                            >
                                <span class="btn-icon">🧪</span>
                                测试
                            </button>
                        </div>

                        <!-- Configuration Actions -->
                        <div class="action-group">
                            <button 
                                class="btn btn-secondary btn-sm"
                                onClick=${() => handleBatchAction('enable')}
                                disabled=${operationInProgress}
                                title="启用选中的接口"
                            >
                                <span class="btn-icon">✅</span>
                                启用
                            </button>
                            
                            <button 
                                class="btn btn-secondary btn-sm"
                                onClick=${() => handleBatchAction('disable')}
                                disabled=${operationInProgress}
                                title="禁用选中的接口"
                            >
                                <span class="btn-icon">❌</span>
                                禁用
                            </button>
                        </div>

                        <!-- Copy/Paste Actions -->
                        <div class="action-group">
                            <button 
                                class="btn btn-outline btn-sm"
                                onClick=${() => handleBatchAction('copy')}
                                disabled=${operationInProgress}
                                title="复制选中接口的配置到剪贴板"
                            >
                                <span class="btn-icon">📋</span>
                                复制配置
                            </button>
                            
                            ${selectedIds.length === 1 && html`
                                <button 
                                    class="btn btn-primary btn-sm"
                                    onClick=${handleQuickCreateFromSelected}
                                    disabled=${operationInProgress}
                                    title="基于选中接口创建新接口"
                                >
                                    <span class="btn-icon">🔄</span>
                                    基于此创建
                                </button>
                            `}
                            
                            <button 
                                class="btn btn-secondary btn-sm"
                                onClick=${() => handleBatchAction('duplicate')}
                                disabled=${operationInProgress}
                                title="复制选中的接口"
                            >
                                <span class="btn-icon">📄</span>
                                复制接口
                            </button>
                        </div>

                        <!-- Export/Import Actions -->
                        <div class="action-group">
                            <button 
                                class="btn btn-info btn-sm"
                                onClick=${() => handleBatchAction('export')}
                                disabled=${operationInProgress}
                                title="导出选中接口的配置"
                            >
                                <span class="btn-icon">📤</span>
                                导出
                            </button>
                        </div>

                        <!-- Destructive Actions -->
                        <div class="action-group destructive">
                            <button 
                                class="btn btn-error btn-sm"
                                onClick=${() => handleBatchAction('delete')}
                                disabled=${operationInProgress}
                                title="删除选中的接口"
                            >
                                <span class="btn-icon">🗑️</span>
                                删除
                            </button>
                        </div>
                    </div>

                    ${operationInProgress && html`
                        <div class="operation-progress">
                            <span class="spinner small"></span>
                            <span class="progress-text">操作进行中...</span>
                        </div>
                    `}
                </div>
            `}

            <!-- Enhanced Results Summary -->
            <div class="results-summary">
                <div class="summary-info">
                    <span class="results-text">
                        显示 ${filteredCount} / ${totalCount} 个接口
                        ${searchTerm && html`<span class="search-highlight">（搜索: "${searchTerm}"）</span>`}
                    </span>
                    
                    ${groupBy !== 'none' && html`
                        <span class="group-info">
                            按${groupBy === 'protocol' ? '协议' : 
                                groupBy === 'status' ? '状态' : 
                                groupBy === 'enabled' ? '启用状态' : 
                                groupBy === 'date' ? '日期' : '其他'}分组
                        </span>
                    `}
                </div>
                
                <div class="summary-actions">
                    ${hasActiveFilters() && html`
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${clearAllFilters}
                            title="清除所有筛选和排序条件"
                        >
                            <span class="btn-icon">🔄</span>
                            重置视图
                        </button>
                    `}
                    
                    <div class="view-stats">
                        ${selectedCount > 0 && html`
                            <span class="selection-stats">
                                已选择: ${selectedCount}
                            </span>
                        `}
                        
                        <span class="filter-stats">
                            ${filteredCount !== totalCount ? `筛选后: ${filteredCount}` : `总计: ${totalCount}`}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Quick Actions Hints -->
            ${selectedCount === 0 && !hasActiveFilters() && html`
                <div class="quick-hints">
                    <div class="hint-item">
                        <span class="hint-icon">💡</span>
                        <span class="hint-text">使用搜索和筛选快速找到需要的接口</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-icon">📋</span>
                        <span class="hint-text">选择接口后可进行批量操作</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-icon">🔄</span>
                        <span class="hint-text">选择单个接口可基于它快速创建新接口</span>
                    </div>
                </div>
            `}
        </div>
    `;
};

export default BatchOperations;