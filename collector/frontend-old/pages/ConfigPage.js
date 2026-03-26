import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import ConfigWizard from '../components/ConfigWizard.js';
import BatchOperations from '../components/BatchOperations.js';
import ConfigClipboard, { copyConfigToClipboard } from '../components/ConfigClipboard.js';
import QuickCreateDialog from '../components/QuickCreateDialog.js';
import ConfigTemplateManager from '../components/ConfigTemplateManager.js';
import ConfigBackupManager, { createAutoBackup } from '../components/ConfigBackupManager.js';
import ConfigHistoryManager, { addConfigHistory } from '../components/ConfigHistoryManager.js';
import ConfigImportExport from '../components/ConfigImportExport.js';
import ConfigValidator from '../components/ConfigValidator.js';
import ProtectedComponent, { ProtectedButton, SensitiveDataDisplay } from '../components/AccessControl.js';
import OperationLogger, { SimpleLogViewer } from '../components/OperationLogger.js';
import { configAPI } from '../services/api.js';
import securityService from '../services/security.js';

const ConfigPage = () => {
    const [view, setView] = useState('list'); // 'list', 'create', 'edit'
    const [interfaces, setInterfaces] = useState([]);
    const [selectedInterface, setSelectedInterface] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [clipboardConfig, setClipboardConfig] = useState(null);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCreateTemplate, setQuickCreateTemplate] = useState(null);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [showBackupManager, setShowBackupManager] = useState(false);
    const [showHistoryManager, setShowHistoryManager] = useState(false);
    const [showImportExport, setShowImportExport] = useState(false);
    const [showOperationLog, setShowOperationLog] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    useEffect(() => {
        loadInterfaces();
    }, []);

    const loadInterfaces = async () => {
        setLoading(true);
        try {
            // Mock data for now - replace with actual API call
            const mockInterfaces = [
                {
                    id: 'opc-ua-001',
                    name: '生产线OPC UA服务器',
                    protocol: 'OPC_UA',
                    enabled: true,
                    status: 'connected',
                    config: {
                        endpoint: 'opc.tcp://192.168.1.100:4840',
                        securityPolicy: 'None',
                        securityMode: 'None'
                    },
                    createdAt: '2024-01-15T10:00:00Z',
                    updatedAt: '2024-01-15T10:30:00Z'
                },
                {
                    id: 'modbus-001',
                    name: 'PLC Modbus TCP',
                    protocol: 'MODBUS_TCP',
                    enabled: true,
                    status: 'disconnected',
                    config: {
                        host: '192.168.1.101',
                        port: 502,
                        slaveId: 1
                    },
                    createdAt: '2024-01-15T09:00:00Z',
                    updatedAt: '2024-01-15T09:15:00Z'
                }
            ];
            setInterfaces(mockInterfaces);
        } catch (error) {
            console.error('Failed to load interfaces:', error);
            setMessage('加载接口配置失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInterface = () => {
        setSelectedInterface(null);
        setView('create');
    };

    const handleEditInterface = (interfaceConfig) => {
        setSelectedInterface(interfaceConfig);
        setView('edit');
    };

    const handleDeleteInterface = async (interfaceId) => {
        const interfaceToDelete = interfaces.find(iface => iface.id === interfaceId);
        if (!interfaceToDelete) return;
        
        // Security confirmation for delete operation
        const confirmed = await securityService.requestSecurityConfirmation(
            'delete_interface',
            `interface:${interfaceId}`,
            `确定要删除接口 "${interfaceToDelete.name}" 吗？此操作不可撤销。`
        );
        
        if (confirmed) {
            try {
                // Create backup before delete
                createAutoBackup(interfaces, `删除接口 "${interfaceToDelete.name}" 前的自动备份`);
                
                // Mock delete - replace with actual API call
                setInterfaces(prev => prev.filter(iface => iface.id !== interfaceId));
                
                // Add to history
                addConfigHistory('delete', interfaceToDelete, null, {
                    affectedInterfaces: [interfaceId],
                    dataFlowInterruption: true
                });
                
                // Log the operation
                securityService.logOperation('delete_interface', `interface:${interfaceId}`, {
                    interfaceName: interfaceToDelete.name,
                    protocol: interfaceToDelete.protocol
                });
                
                setMessage('接口配置已删除');
            } catch (error) {
                console.error('Failed to delete interface:', error);
                securityService.logFailedOperation('delete_interface', `interface:${interfaceId}`, error);
                setMessage('删除接口配置失败');
            }
        }
    };

    const handleWizardComplete = async (config) => {
        try {
            // Validate configuration before saving
            const schema = getConfigSchema(config.protocol);
            const validation = securityService.validateConfig(config, schema);
            
            if (!validation.isValid) {
                setValidationResult(validation);
                setMessage('配置验证失败，请检查错误信息');
                return;
            }
            
            if (view === 'edit') {
                // Security confirmation for update
                const confirmed = await securityService.requestSecurityConfirmation(
                    'update_interface',
                    `interface:${selectedInterface.id}`,
                    `确定要更新接口 "${selectedInterface.name}" 的配置吗？`
                );
                
                if (!confirmed) return;
                
                // Create backup before update
                createAutoBackup(interfaces, `更新接口 "${selectedInterface.name}" 前的自动备份`);
                
                // Update existing interface
                const updatedInterface = {
                    ...selectedInterface,
                    ...config,
                    updatedAt: new Date().toISOString()
                };
                
                // Track changes for history
                const changes = [];
                Object.keys(config).forEach(key => {
                    if (JSON.stringify(selectedInterface[key]) !== JSON.stringify(config[key])) {
                        changes.push({
                            field: key,
                            oldValue: selectedInterface[key],
                            newValue: config[key]
                        });
                    }
                });
                
                setInterfaces(prev => 
                    prev.map(iface => 
                        iface.id === selectedInterface.id ? updatedInterface : iface
                    )
                );
                
                // Add to history
                addConfigHistory('update', updatedInterface, changes, {
                    affectedInterfaces: [updatedInterface.id],
                    configValidation: validation
                });
                
                // Log the operation
                securityService.logOperation('update_interface', `interface:${selectedInterface.id}`, {
                    interfaceName: selectedInterface.name,
                    protocol: config.protocol,
                    changesCount: changes.length,
                    validation: validation
                });
                
                setMessage('接口配置已更新');
            } else {
                // Create new interface
                const newInterface = {
                    id: `interface-${Date.now()}`,
                    ...config,
                    status: 'disconnected',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                setInterfaces(prev => [...prev, newInterface]);
                
                // Add to history
                addConfigHistory('create', newInterface, null, {
                    affectedInterfaces: [newInterface.id],
                    configValidation: validation
                });
                
                // Log the operation
                securityService.logOperation('create_interface', `interface:${newInterface.id}`, {
                    interfaceName: newInterface.name,
                    protocol: config.protocol,
                    validation: validation
                });
                
                setMessage('接口配置已创建');
            }
            setView('list');
            setValidationResult(null);
        } catch (error) {
            console.error('Failed to save interface:', error);
            securityService.logFailedOperation(
                view === 'edit' ? 'update_interface' : 'create_interface',
                view === 'edit' ? `interface:${selectedInterface.id}` : 'new_interface',
                error
            );
            setMessage('保存接口配置失败');
        }
    };

    // Get configuration schema based on protocol
    const getConfigSchema = (protocol) => {
        const schemas = {
            'OPC_UA': {
                required: ['endpoint'],
                fields: {
                    endpoint: [
                        { type: 'required', message: 'OPC UA端点地址是必需的' },
                        { type: 'url', message: '请输入有效的OPC UA端点地址' }
                    ],
                    username: [
                        { type: 'minLength', params: [3], message: '用户名至少3个字符' }
                    ],
                    password: [
                        { type: 'minLength', params: [6], message: '密码至少6个字符' }
                    ]
                }
            },
            'MODBUS_TCP': {
                required: ['host', 'port'],
                fields: {
                    host: [
                        { type: 'required', message: 'Modbus主机地址是必需的' },
                        { type: 'ipAddress', message: '请输入有效的IP地址' }
                    ],
                    port: [
                        { type: 'required', message: 'Modbus端口是必需的' },
                        { type: 'port', message: '请输入有效的端口号(1-65535)' }
                    ],
                    slaveId: [
                        { type: 'required', message: '从站ID是必需的' }
                    ]
                }
            },
            'MQTT': {
                required: ['broker', 'port'],
                fields: {
                    broker: [
                        { type: 'required', message: 'MQTT代理地址是必需的' }
                    ],
                    port: [
                        { type: 'required', message: 'MQTT端口是必需的' },
                        { type: 'port', message: '请输入有效的端口号(1-65535)' }
                    ],
                    clientId: [
                        { type: 'required', message: '客户端ID是必需的' },
                        { type: 'minLength', params: [3], message: '客户端ID至少3个字符' }
                    ]
                }
            }
        };
        
        return schemas[protocol] || { required: [], fields: {} };
    };

    const handleWizardCancel = () => {
        setView('list');
        setSelectedInterface(null);
    };

    // Batch Operations Handlers
    const handleBatchOperation = async (action, ids) => {
        const selectedInterfaces = interfaces.filter(iface => ids.includes(iface.id));
        
        switch (action) {
            case 'start':
                // Mock start operation
                setInterfaces(prev => prev.map(iface => 
                    ids.includes(iface.id) ? { ...iface, status: 'connected' } : iface
                ));
                setMessage(`已启动 ${ids.length} 个接口`);
                break;
                
            case 'stop':
                // Mock stop operation
                setInterfaces(prev => prev.map(iface => 
                    ids.includes(iface.id) ? { ...iface, status: 'disconnected' } : iface
                ));
                setMessage(`已停止 ${ids.length} 个接口`);
                break;
                
            case 'enable':
                setInterfaces(prev => prev.map(iface => 
                    ids.includes(iface.id) ? { ...iface, enabled: true } : iface
                ));
                setMessage(`已启用 ${ids.length} 个接口`);
                break;
                
            case 'disable':
                setInterfaces(prev => prev.map(iface => 
                    ids.includes(iface.id) ? { ...iface, enabled: false } : iface
                ));
                setMessage(`已禁用 ${ids.length} 个接口`);
                break;
                
            case 'delete':
                setInterfaces(prev => prev.filter(iface => !ids.includes(iface.id)));
                setMessage(`已删除 ${ids.length} 个接口`);
                break;
                
            case 'duplicate':
                const duplicates = selectedInterfaces.map(iface => {
                    const baseName = iface.name.replace(/\s*\(副本\d*\)$/, '');
                    const copyNumber = getCopyNumber(baseName);
                    return {
                        ...iface,
                        id: `interface-${Date.now()}-${Math.random()}`,
                        name: `${baseName}${copyNumber > 0 ? ` (副本${copyNumber})` : ' (副本)'}`,
                        status: 'disconnected',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                });
                setInterfaces(prev => [...prev, ...duplicates]);
                setMessage(`已复制 ${ids.length} 个接口`);
                break;
                
            case 'copy':
                if (selectedInterfaces.length === 1) {
                    const config = copyConfigToClipboard(selectedInterfaces[0]);
                    setClipboardConfig(config);
                } else {
                    // For multiple selections, copy as array
                    const configs = selectedInterfaces.map(iface => copyConfigToClipboard(iface));
                    setClipboardConfig({ multiple: true, configs });
                }
                break;
                
            case 'export':
                exportConfigurations(selectedInterfaces);
                setMessage(`已导出 ${ids.length} 个接口配置`);
                break;
                
            case 'test':
                // Mock test operation
                setMessage(`正在测试 ${ids.length} 个接口连接...`);
                // Simulate async test
                setTimeout(() => {
                    setMessage(`测试完成: ${ids.length} 个接口`);
                }, 2000);
                break;
                
            default:
                console.warn('Unknown batch operation:', action);
        }
    };

    const getCopyNumber = (baseName) => {
        const existingCopies = interfaces.filter(iface => 
            iface.name.startsWith(baseName) && iface.name.includes('副本')
        );
        return existingCopies.length;
    };

    const exportConfigurations = (interfacesToExport) => {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'ProDB Collector',
            interfaces: interfacesToExport.map(iface => {
                const { id, status, createdAt, updatedAt, ...cleanConfig } = iface;
                return cleanConfig;
            })
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `collector-config-${new Date().toISOString().split('T')[0]}.json`;
        
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

    // Quick Create Handlers
    const handleQuickCreate = () => {
        setQuickCreateTemplate(null);
        setShowQuickCreate(true);
    };

    const handleQuickCreateFromExisting = (templateInterface) => {
        setQuickCreateTemplate(templateInterface);
        setShowQuickCreate(true);
    };

    const handleQuickCreateComplete = (config) => {
        const newInterface = {
            id: `interface-${Date.now()}`,
            ...config,
            status: 'disconnected',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setInterfaces(prev => [...prev, newInterface]);
        setMessage('接口配置已创建');
        setShowQuickCreate(false);
        setQuickCreateTemplate(null);
    };

    // Clipboard Handlers
    const handleConfigPaste = (config) => {
        if (config.multiple) {
            // Handle multiple configs
            const newInterfaces = config.configs.map((cfg, index) => ({
                id: `interface-${Date.now()}-${index}`,
                ...cfg,
                name: `${cfg.name} (粘贴)`,
                status: 'disconnected',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
            setInterfaces(prev => [...prev, ...newInterfaces]);
            setMessage(`已粘贴 ${newInterfaces.length} 个接口配置`);
        } else {
            // Handle single config
            const newInterface = {
                id: `interface-${Date.now()}`,
                ...config,
                name: `${config.name} (粘贴)`,
                status: 'disconnected',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setInterfaces(prev => [...prev, newInterface]);
            setMessage('接口配置已粘贴');
        }
    };

    const handleClearClipboard = () => {
        setClipboardConfig(null);
        setMessage('剪贴板已清除');
    };

    // Template Management Handlers
    const handleApplyTemplate = (templateConfig) => {
        const newInterface = {
            id: `interface-${Date.now()}`,
            ...templateConfig,
            status: 'disconnected',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        setInterfaces(prev => [...prev, newInterface]);
        
        // Add to history
        addConfigHistory('create', newInterface, null, {
            affectedInterfaces: [newInterface.id],
            configValidation: { valid: true }
        });
        
        setMessage(`已从模板创建接口: ${newInterface.name}`);
        setShowTemplateManager(false);
    };

    // Backup Management Handlers
    const handleRestoreBackup = (backupInterfaces) => {
        // Create backup of current state before restore
        createAutoBackup(interfaces, '恢复备份前的自动备份');
        
        setInterfaces(backupInterfaces);
        
        // Add to history
        addConfigHistory('restore', null, null, {
            affectedInterfaces: backupInterfaces.map(iface => iface.id),
            configValidation: { valid: true }
        });
        
        setMessage(`已恢复 ${backupInterfaces.length} 个接口配置`);
        setShowBackupManager(false);
    };

    // Import/Export Handlers
    const handleImportConfigs = (importedInterfaces) => {
        // Create backup before import
        createAutoBackup(interfaces, '导入配置前的自动备份');
        
        setInterfaces(prev => [...prev, ...importedInterfaces]);
        
        // Add to history for each imported interface
        importedInterfaces.forEach(iface => {
            addConfigHistory('create', iface, null, {
                affectedInterfaces: [iface.id],
                configValidation: { valid: true }
            });
        });
        
        setMessage(`成功导入 ${importedInterfaces.length} 个接口配置`);
        setShowImportExport(false);
    };

    if (view === 'create' || view === 'edit') {
        return html`
            <div class="config-page">
                <${ConfigWizard}
                    onComplete=${handleWizardComplete}
                    onCancel=${handleWizardCancel}
                    initialData=${selectedInterface}
                    mode=${view}
                />
            </div>
        `;
    }

    return html`
        <div class="config-page">
            <div class="page-header">
                <div class="header-content">
                    <h1>
                        <span class="page-icon">⚙️</span>
                        接口配置管理
                    </h1>
                    <p class="page-description">
                        管理采集器的接口配置，支持多种工业协议和批量操作
                    </p>
                </div>
                <div class="header-actions">
                    <div class="action-group">
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowTemplateManager(true)}
                            title="配置模板管理"
                        >
                            <span class="btn-icon">📋</span>
                            模板
                        </button>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowBackupManager(true)}
                            title="配置备份管理"
                        >
                            <span class="btn-icon">💾</span>
                            备份
                        </button>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowHistoryManager(true)}
                            title="配置变更历史"
                        >
                            <span class="btn-icon">📜</span>
                            历史
                        </button>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowImportExport(true)}
                            title="导入导出配置"
                        >
                            <span class="btn-icon">📁</span>
                            导入导出
                        </button>
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowOperationLog(true)}
                            title="查看操作日志"
                        >
                            <span class="btn-icon">📋</span>
                            操作日志
                        </button>
                    </div>
                    <div class="action-group">
                        <button 
                            class="btn btn-secondary"
                            onClick=${handleCreateInterface}
                        >
                            <span class="btn-icon">⚙️</span>
                            向导创建
                        </button>
                        <button 
                            class="btn btn-primary"
                            onClick=${handleQuickCreate}
                        >
                            <span class="btn-icon">⚡</span>
                            快速创建
                        </button>
                    </div>
                </div>
            </div>

            <!-- Configuration Clipboard -->
            ${clipboardConfig && html`
                <${ConfigClipboard}
                    clipboardConfig=${clipboardConfig}
                    onPasteConfig=${handleConfigPaste}
                    onClearClipboard=${handleClearClipboard}
                />
            `}

            ${message && html`
                <div class="alert alert- ${message.includes('失败') ? 'error' : 'success'}">
                    ${message}
                    <button 
                        class="message-close"
                        onClick=${() => setMessage('')}
                    >
                        ✕
                    </button>
                </div>
            `}

            <!-- Batch Operations Toolbar -->
            ${!loading && interfaces.length > 0 && html`
                <${BatchOperations}
                    interfaces=${interfaces}
                    selectedIds=${selectedIds}
                    onSelectionChange=${setSelectedIds}
                    onBatchOperation=${handleBatchOperation}
                    onQuickCreate=${handleQuickCreate}
                    onQuickCreateFromExisting=${handleQuickCreateFromExisting}
                    clipboardConfig=${clipboardConfig}
                    onConfigPaste=${handleConfigPaste}
                />
            `}

            <div class="interfaces-section">
                ${loading ? html`
                    <div class="loading-state">
                        <span class="spinner"></span>
                        正在加载接口配置...
                    </div>
                ` : interfaces.length === 0 ? html`
                    <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg text-center p-12">
                        <div class="empty-icon">📡</div>
                        <h3>暂无接口配置</h3>
                        <p>使用快速创建或向导创建第一个接口配置</p>
                        <div class="empty-actions">
                            <button 
                                class="btn btn-primary"
                                onClick=${handleQuickCreate}
                            >
                                <span class="btn-icon">⚡</span>
                                快速创建
                            </button>
                            <button 
                                class="btn btn-secondary"
                                onClick=${handleCreateInterface}
                            >
                                <span class="btn-icon">⚙️</span>
                                向导创建
                            </button>
                        </div>
                    </div>
                ` : html`
                    <div class="interfaces-grid">
                        ${interfaces.map(iface => html`
                            <div class="modern-card card-hover ${iface.status} ${selectedIds.includes(iface.id) ? 'selected' : ''}" key=${iface.id}>
                                <!-- Selection Checkbox -->
                                <div class="card-selection">
                                    <input
                                        type="checkbox"
                                        class="selection-checkbox"
                                        checked=${selectedIds.includes(iface.id)}
                                        onChange=${(e) => {
                                            if (e.target.checked) {
                                                setSelectedIds(prev => [...prev, iface.id]);
                                            } else {
                                                setSelectedIds(prev => prev.filter(id => id !== iface.id));
                                            }
                                        }}
                                    />
                                </div>

                                <div class="card-header">
                                    <div class="interface-info">
                                        <h3 class="interface-name">${iface.name}</h3>
                                        <div class="interface-badges">
                                            <span class="badge badge-primary">${iface.protocol}</span>
                                            ${!iface.enabled && html`
                                                <span class="badge badge-warning">已禁用</span>
                                            `}
                                        </div>
                                    </div>
                                    <div class="interface-status">
                                        <span class="status-indicator ${iface.status}">
                                            ${iface.status === 'connected' ? '🟢' : 
                                              iface.status === 'disconnected' ? '🟡' : '🔴'}
                                            ${iface.status === 'connected' ? '已连接' : 
                                              iface.status === 'disconnected' ? '未连接' : '错误'}
                                        </span>
                                    </div>
                                </div>

                                <div class="card-body">
                                    <div class="config-preview">
                                        ${Object.entries(iface.config).slice(0, 3).map(([key, value]) => html`
                                            <div class="config-item" key=${key}>
                                                <span class="config-key">${key}:</span>
                                                <span class="config-value">
                                                    ${key.includes('password') || key.includes('secret') || key.includes('token') 
                                                        ? html`<${SensitiveDataDisplay} 
                                                            data=${value} 
                                                            fieldName=${key}
                                                            showMasked=${true}
                                                            allowReveal=${false}
                                                        />`
                                                        : value
                                                    }
                                                </span>
                                            </div>
                                        `)}
                                        ${Object.keys(iface.config).length > 3 && html`
                                            <div class="config-more">
                                                +${Object.keys(iface.config).length - 3} 更多参数
                                            </div>
                                        `}
                                    </div>

                                    <div class="interface-meta">
                                        <div class="meta-item">
                                            <span class="meta-label">创建:</span>
                                            <span class="meta-value">
                                                ${new Date(iface.createdAt).toLocaleDateString('zh-CN')}
                                            </span>
                                        </div>
                                        <div class="meta-item">
                                            <span class="meta-label">更新:</span>
                                            <span class="meta-value">
                                                ${new Date(iface.updatedAt).toLocaleDateString('zh-CN')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="card-actions">
                                    <button 
                                        class="btn btn-secondary btn-sm"
                                        onClick=${() => handleEditInterface(iface)}
                                        title="编辑接口配置"
                                    >
                                        <span class="btn-icon">✏️</span>
                                        编辑
                                    </button>
                                    <button 
                                        class="btn btn-outline btn-sm"
                                        onClick=${() => {
                                            const config = copyConfigToClipboard(iface);
                                            setClipboardConfig(config);
                                            setMessage('配置已复制到剪贴板');
                                        }}
                                        title="复制配置"
                                    >
                                        <span class="btn-icon">📋</span>
                                        复制
                                    </button>
                                    <button 
                                        class="btn btn-info btn-sm"
                                        onClick=${() => handleQuickCreateFromExisting(iface)}
                                        title="基于此配置创建新接口"
                                    >
                                        <span class="btn-icon">🔄</span>
                                        复制
                                    </button>
                                    <button 
                                        class="btn btn-outline btn-sm"
                                        onClick=${() => {
                                            // TODO: Implement test functionality
                                            alert('测试功能开发中...');
                                        }}
                                        title="测试连接"
                                    >
                                        <span class="btn-icon">🧪</span>
                                        测试
                                    </button>
                                    <${ProtectedButton}
                                        requiredPermission="delete"
                                        resource=${`interface:${iface.id}`}
                                        operation="delete_interface"
                                        confirmMessage=${`确定要删除接口 "${iface.name}" 吗？此操作不可撤销。`}
                                        onClick=${() => handleDeleteInterface(iface.id)}
                                        className="btn btn-error btn-sm"
                                        title="删除接口"
                                    >
                                        <span class="btn-icon">🗑️</span>
                                        删除
                                    <//>
                                    
                                </div>
                            </div>
                        `)}
                    </div>
                `}
            </div>

            <!-- Quick Create Dialog -->
            ${showQuickCreate && html`
                <${QuickCreateDialog}
                    onClose=${() => {
                        setShowQuickCreate(false);
                        setQuickCreateTemplate(null);
                    }}
                    onCreate=${handleQuickCreateComplete}
                    templateInterface=${quickCreateTemplate}
                    existingInterfaces=${interfaces}
                />
            `}

            <!-- Template Manager Dialog -->
            ${showTemplateManager && html`
                <${ConfigTemplateManager}
                    onClose=${() => setShowTemplateManager(false)}
                    onApplyTemplate=${handleApplyTemplate}
                    existingInterfaces=${interfaces}
                />
            `}

            <!-- Backup Manager Dialog -->
            ${showBackupManager && html`
                <${ConfigBackupManager}
                    onClose=${() => setShowBackupManager(false)}
                    onRestoreBackup=${handleRestoreBackup}
                    currentInterfaces=${interfaces}
                />
            `}

            <!-- History Manager Dialog -->
            ${showHistoryManager && html`
                <${ConfigHistoryManager}
                    onClose=${() => setShowHistoryManager(false)}
                    interfaces=${interfaces}
                />
            `}

            <!-- Import/Export Dialog -->
            ${showImportExport && html`
                <${ConfigImportExport}
                    onClose=${() => setShowImportExport(false)}
                    onImport=${handleImportConfigs}
                    interfaces=${interfaces}
                />
            `}

            <!-- Operation Log Dialog -->
            ${showOperationLog && html`
                <div class="dialog-overlay">
                    <div class="dialog-container large">
                        <div class="dialog-header">
                            <h3>操作日志</h3>
                            <button 
                                class="close-btn"
                                onClick=${() => setShowOperationLog(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div class="dialog-content">
                            <${OperationLogger} 
                                showFilters=${true}
                                maxEntries=${200}
                                autoRefresh=${true}
                            />
                        </div>
                    </div>
                </div>
            `}

            <!-- Configuration Validation Results -->
            ${validationResult && !validationResult.isValid && html`
                <div class="validation-overlay">
                    <div class="validation-dialog">
                        <div class="dialog-header">
                            <h3>配置验证失败</h3>
                            <button 
                                class="close-btn"
                                onClick=${() => setValidationResult(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div class="dialog-content">
                            <${ConfigValidator} 
                                config=${null}
                                schema=${null}
                                validationResult=${validationResult}
                                showWarnings=${true}
                            />
                        </div>
                        <div class="dialog-actions">
                            <button 
                                class="btn btn-primary"
                                onClick=${() => setValidationResult(null)}
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            `}

            <!-- Security Status Panel (for admin users) -->
            <${ProtectedComponent} requiredPermission="admin">
                <div class="security-status-panel">
                    <${SimpleLogViewer} 
                        operations=${['create_interface', 'update_interface', 'delete_interface']}
                        maxEntries=${5}
                    />
                </div>
            <//>
        </div>
    `;
};

export default ConfigPage;
