import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const ConfigBackupManager = ({ onClose, onRestoreBackup, currentInterfaces = [] }) => {
    const [backups, setBackups] = useState([]);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
    const [maxBackups, setMaxBackups] = useState(10);

    useEffect(() => {
        loadBackups();
        loadSettings();
    }, []);

    const loadBackups = () => {
        const savedBackups = JSON.parse(localStorage.getItem('config-backups') || '[]');
        // 按时间倒序排列
        savedBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setBackups(savedBackups);
    };

    const loadSettings = () => {
        const settings = JSON.parse(localStorage.getItem('backup-settings') || '{}');
        setAutoBackupEnabled(settings.autoBackupEnabled !== false);
        setMaxBackups(settings.maxBackups || 10);
    };

    const saveSettings = () => {
        const settings = {
            autoBackupEnabled,
            maxBackups
        };
        localStorage.setItem('backup-settings', JSON.stringify(settings));
    };

    const createBackup = (interfaces = currentInterfaces, description = '') => {
        const backup = {
            id: `backup-${Date.now()}`,
            timestamp: new Date().toISOString(),
            description: description || `自动备份 - ${new Date().toLocaleString('zh-CN')}`,
            interfaceCount: interfaces.length,
            interfaces: interfaces.map(iface => {
                // 创建接口的完整副本
                return {
                    ...iface,
                    backupId: backup.id
                };
            }),
            version: '1.0',
            source: 'ProDB Collector'
        };

        const savedBackups = JSON.parse(localStorage.getItem('config-backups') || '[]');
        savedBackups.unshift(backup); // 添加到开头

        // 限制备份数量
        if (savedBackups.length > maxBackups) {
            savedBackups.splice(maxBackups);
        }

        localStorage.setItem('config-backups', JSON.stringify(savedBackups));
        setBackups(savedBackups);
        
        return backup;
    };

    const createManualBackup = () => {
        const description = prompt('请输入备份描述（可选）：');
        if (description === null) return; // 用户取消

        const backup = createBackup(currentInterfaces, description || `手动备份 - ${new Date().toLocaleString('zh-CN')}`);
        alert(`备份创建成功！备份ID: ${backup.id}`);
    };

    const deleteBackup = (backupId) => {
        if (!confirm('确定要删除此备份吗？此操作不可恢复。')) return;

        const savedBackups = JSON.parse(localStorage.getItem('config-backups') || '[]');
        const updatedBackups = savedBackups.filter(backup => backup.id !== backupId);
        localStorage.setItem('config-backups', JSON.stringify(updatedBackups));
        
        setBackups(updatedBackups);
        if (selectedBackup?.id === backupId) {
            setSelectedBackup(null);
        }
    };

    const restoreBackup = (backup) => {
        if (!confirm(`确定要恢复到备份 "${backup.description}" 吗？当前配置将被替换。`)) return;

        // 在恢复前创建当前状态的备份
        createBackup(currentInterfaces, `恢复前自动备份 - ${new Date().toLocaleString('zh-CN')}`);

        // 恢复备份
        onRestoreBackup(backup.interfaces);
        onClose();
    };

    const exportBackup = (backup) => {
        const exportData = {
            ...backup,
            exportedAt: new Date().toISOString()
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `config-backup-${backup.timestamp.split('T')[0]}-${backup.id}.json`;
        
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

    const importBackup = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                // 验证备份格式
                if (!importData.interfaces || !Array.isArray(importData.interfaces)) {
                    alert('无效的备份文件格式');
                    return;
                }

                // 创建新的备份ID
                const importedBackup = {
                    ...importData,
                    id: `imported-${Date.now()}`,
                    importedAt: new Date().toISOString(),
                    description: `${importData.description} (导入)`
                };

                const savedBackups = JSON.parse(localStorage.getItem('config-backups') || '[]');
                savedBackups.unshift(importedBackup);
                
                // 限制备份数量
                if (savedBackups.length > maxBackups) {
                    savedBackups.splice(maxBackups);
                }

                localStorage.setItem('config-backups', JSON.stringify(savedBackups));
                setBackups(savedBackups);
                
                alert('备份导入成功！');
            } catch (error) {
                console.error('Import error:', error);
                alert('导入备份失败：文件格式错误');
            }
        };
        reader.readAsText(file);
        
        // 重置文件输入
        event.target.value = '';
    };

    const clearAllBackups = () => {
        if (!confirm('确定要清除所有备份吗？此操作不可恢复。')) return;
        
        localStorage.removeItem('config-backups');
        setBackups([]);
        setSelectedBackup(null);
    };

    const getBackupSize = (backup) => {
        const sizeInBytes = JSON.stringify(backup).length;
        if (sizeInBytes < 1024) return `${sizeInBytes} B`;
        if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getTimeDifference = (timestamp) => {
        const now = new Date();
        const backupTime = new Date(timestamp);
        const diffMs = now - backupTime;
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        return `${diffDays} 天前`;
    };

    // 自动备份功能
    useEffect(() => {
        saveSettings();
    }, [autoBackupEnabled, maxBackups]);

    return html`
        <${Modal} onClose=${onClose} title="配置备份管理" size="large">
            <div class="backup-manager">
                <!-- 操作工具栏 -->
                <div class="backup-toolbar">
                    <div class="toolbar-left">
                        <button 
                            class="btn btn-primary btn-sm"
                            onClick=${createManualBackup}
                        >
                            <span class="btn-icon">💾</span>
                            创建备份
                        </button>
                        <label class="btn btn-secondary btn-sm file-input-label">
                            <span class="btn-icon">📥</span>
                            导入备份
                            <input 
                                type="file" 
                                accept=".json"
                                onChange=${importBackup}
                                style="display: none;"
                            />
                        </label>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${clearAllBackups}
                            disabled=${backups.length === 0}
                        >
                            <span class="btn-icon">🗑️</span>
                            清除所有
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <span class="backup-count">共 ${backups.length} 个备份</span>
                    </div>
                </div>

                <!-- 备份设置 -->
                <div class="backup-settings">
                    <h3>备份设置</h3>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label class="setting-label">
                                <input
                                    type="checkbox"
                                    checked=${autoBackupEnabled}
                                    onChange=${(e) => setAutoBackupEnabled(e.target.checked)}
                                />
                                启用自动备份
                            </label>
                            <p class="setting-description">
                                在配置变更时自动创建备份
                            </p>
                        </div>
                        <div class="setting-item">
                            <label class="setting-label">
                                最大备份数量
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value=${maxBackups}
                                onChange=${(e) => setMaxBackups(parseInt(e.target.value) || 10)}
                                class="form-input"
                                style="width: 80px;"
                            />
                            <p class="setting-description">
                                超过此数量时自动删除最旧的备份
                            </p>
                        </div>
                    </div>
                </div>

                <!-- 备份列表 -->
                <div class="backups-content">
                    ${backups.length === 0 ? html`
                        <div class="empty-state">
                            <div class="empty-icon">💾</div>
                            <h3>暂无备份</h3>
                            <p>创建第一个配置备份以保护您的设置</p>
                            <button 
                                class="btn btn-primary"
                                onClick=${createManualBackup}
                            >
                                创建备份
                            </button>
                        </div>
                    ` : html`
                        <div class="backups-list">
                            ${backups.map(backup => html`
                                <div 
                                    class="backup-card ${selectedBackup?.id === backup.id ? 'selected' : ''}"
                                    key=${backup.id}
                                    onClick=${() => setSelectedBackup(backup)}
                                >
                                    <div class="backup-header">
                                        <div class="backup-info">
                                            <h4 class="backup-description">${backup.description}</h4>
                                            <div class="backup-meta">
                                                <span class="backup-time">
                                                    ${new Date(backup.timestamp).toLocaleString('zh-CN')}
                                                </span>
                                                <span class="backup-age">
                                                    (${getTimeDifference(backup.timestamp)})
                                                </span>
                                            </div>
                                        </div>
                                        <div class="backup-actions">
                                            <button 
                                                class="btn btn-primary btn-sm"
                                                onClick=${(e) => {
                                                    e.stopPropagation();
                                                    restoreBackup(backup);
                                                }}
                                                title="恢复此备份"
                                            >
                                                <span class="btn-icon">🔄</span>
                                                恢复
                                            </button>
                                            <button 
                                                class="btn btn-secondary btn-sm"
                                                onClick=${(e) => {
                                                    e.stopPropagation();
                                                    exportBackup(backup);
                                                }}
                                                title="导出备份"
                                            >
                                                <span class="btn-icon">📤</span>
                                                导出
                                            </button>
                                            <button 
                                                class="btn btn-error btn-sm"
                                                onClick=${(e) => {
                                                    e.stopPropagation();
                                                    deleteBackup(backup.id);
                                                }}
                                                title="删除备份"
                                            >
                                                <span class="btn-icon">🗑️</span>
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                    <div class="backup-stats">
                                        <div class="stat-item">
                                            <span class="stat-label">接口数量:</span>
                                            <span class="stat-value">${backup.interfaceCount}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">备份大小:</span>
                                            <span class="stat-value">${getBackupSize(backup)}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">版本:</span>
                                            <span class="stat-value">${backup.version}</span>
                                        </div>
                                    </div>
                                    ${backup.importedAt && html`
                                        <div class="backup-imported">
                                            <span class="imported-badge">已导入</span>
                                            导入时间: ${new Date(backup.importedAt).toLocaleString('zh-CN')}
                                        </div>
                                    `}
                                </div>
                            `)}
                        </div>
                    `}
                </div>

                <!-- 备份预览 -->
                ${selectedBackup && html`
                    <div class="backup-preview">
                        <h3>备份详情</h3>
                        <div class="preview-content">
                            <div class="preview-summary">
                                <h4>包含的接口 (${selectedBackup.interfaceCount})</h4>
                                <div class="interfaces-summary">
                                    ${selectedBackup.interfaces.map(iface => html`
                                        <div class="interface-summary" key=${iface.id}>
                                            <span class="interface-name">${iface.name}</span>
                                            <span class="interface-protocol">${iface.protocol}</span>
                                            <span class="interface-status ${iface.status}">${iface.status}</span>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        </div>
                    </div>
                `}
            </div>
        <//>
    `;
};

// 导出自动备份功能
export const createAutoBackup = (interfaces, description) => {
    const settings = JSON.parse(localStorage.getItem('backup-settings') || '{}');
    if (settings.autoBackupEnabled === false) return null;

    const backup = {
        id: `auto-backup-${Date.now()}`,
        timestamp: new Date().toISOString(),
        description: description || `自动备份 - ${new Date().toLocaleString('zh-CN')}`,
        interfaceCount: interfaces.length,
        interfaces: interfaces.map(iface => ({ ...iface })),
        version: '1.0',
        source: 'ProDB Collector Auto Backup'
    };

    const savedBackups = JSON.parse(localStorage.getItem('config-backups') || '[]');
    savedBackups.unshift(backup);

    // 限制备份数量
    const maxBackups = settings.maxBackups || 10;
    if (savedBackups.length > maxBackups) {
        savedBackups.splice(maxBackups);
    }

    localStorage.setItem('config-backups', JSON.stringify(savedBackups));
    return backup;
};

export default ConfigBackupManager;