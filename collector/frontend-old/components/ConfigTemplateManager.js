import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const ConfigTemplateManager = ({ onClose, onApplyTemplate, existingInterfaces = [] }) => {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showCreateTemplate, setShowCreateTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDescription, setNewTemplateDescription] = useState('');
    const [selectedInterface, setSelectedInterface] = useState('');

    // 预设模板
    const presetTemplates = [
        {
            id: 'opcua-basic',
            name: 'OPC UA 基础模板',
            description: '标准 OPC UA 服务器连接配置',
            category: 'preset',
            protocol: 'OPC_UA',
            config: {
                name: 'OPC UA 服务器',
                protocol: 'OPC_UA',
                enabled: true,
                config: {
                    endpoint: 'opc.tcp://localhost:4840',
                    securityPolicy: 'None',
                    securityMode: 'None',
                    username: '',
                    password: '',
                    timeout: 5000,
                    reconnectInterval: 10000
                }
            }
        },
        {
            id: 'modbus-tcp-basic',
            name: 'Modbus TCP 基础模板',
            description: '标准 Modbus TCP 设备连接配置',
            category: 'preset',
            protocol: 'MODBUS_TCP',
            config: {
                name: 'Modbus TCP 设备',
                protocol: 'MODBUS_TCP',
                enabled: true,
                config: {
                    host: '192.168.1.100',
                    port: 502,
                    slaveId: 1,
                    timeout: 3000,
                    reconnectInterval: 5000
                }
            }
        },
        {
            id: 'mqtt-basic',
            name: 'MQTT 基础模板',
            description: '标准 MQTT 代理连接配置',
            category: 'preset',
            protocol: 'MQTT',
            config: {
                name: 'MQTT 代理',
                protocol: 'MQTT',
                enabled: true,
                config: {
                    broker: 'localhost',
                    port: 1883,
                    clientId: 'collector-client',
                    username: '',
                    password: '',
                    keepAlive: 60,
                    cleanSession: true,
                    topics: ['data/+']
                }
            }
        },
        {
            id: 'ethernet-ip-basic',
            name: 'Ethernet/IP 基础模板',
            description: '标准 Ethernet/IP 设备连接配置',
            category: 'preset',
            protocol: 'ETHERNET_IP',
            config: {
                name: 'Ethernet/IP 设备',
                protocol: 'ETHERNET_IP',
                enabled: true,
                config: {
                    host: '192.168.1.100',
                    port: 44818,
                    slot: 0,
                    timeout: 5000,
                    reconnectInterval: 10000
                }
            }
        }
    ];

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = () => {
        // 从 localStorage 加载用户自定义模板
        const savedTemplates = JSON.parse(localStorage.getItem('config-templates') || '[]');
        setTemplates([...presetTemplates, ...savedTemplates]);
    };

    const saveTemplate = () => {
        if (!newTemplateName.trim() || !selectedInterface) {
            alert('请输入模板名称并选择接口');
            return;
        }

        const sourceInterface = existingInterfaces.find(iface => iface.id === selectedInterface);
        if (!sourceInterface) {
            alert('选择的接口不存在');
            return;
        }

        const newTemplate = {
            id: `custom-${Date.now()}`,
            name: newTemplateName.trim(),
            description: newTemplateDescription.trim() || '用户自定义模板',
            category: 'custom',
            protocol: sourceInterface.protocol,
            createdAt: new Date().toISOString(),
            config: {
                name: sourceInterface.name,
                protocol: sourceInterface.protocol,
                enabled: sourceInterface.enabled,
                config: { ...sourceInterface.config }
            }
        };

        // 保存到 localStorage
        const savedTemplates = JSON.parse(localStorage.getItem('config-templates') || '[]');
        savedTemplates.push(newTemplate);
        localStorage.setItem('config-templates', JSON.stringify(savedTemplates));

        // 更新状态
        setTemplates(prev => [...prev, newTemplate]);
        
        // 重置表单
        setNewTemplateName('');
        setNewTemplateDescription('');
        setSelectedInterface('');
        setShowCreateTemplate(false);
    };

    const deleteTemplate = (templateId) => {
        if (!confirm('确定要删除此模板吗？')) return;

        // 只能删除自定义模板
        const template = templates.find(t => t.id === templateId);
        if (template && template.category === 'custom') {
            const savedTemplates = JSON.parse(localStorage.getItem('config-templates') || '[]');
            const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
            localStorage.setItem('config-templates', JSON.stringify(updatedTemplates));
            
            setTemplates(prev => prev.filter(t => t.id !== templateId));
        }
    };

    const applyTemplate = (template) => {
        const config = {
            ...template.config,
            name: `${template.config.name} - ${new Date().toLocaleString('zh-CN')}`
        };
        onApplyTemplate(config);
        onClose();
    };

    const exportTemplates = () => {
        const customTemplates = templates.filter(t => t.category === 'custom');
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'ProDB Collector Templates',
            templates: customTemplates
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `config-templates-${new Date().toISOString().split('T')[0]}.json`;
        
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

    const importTemplates = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                if (importData.templates && Array.isArray(importData.templates)) {
                    const savedTemplates = JSON.parse(localStorage.getItem('config-templates') || '[]');
                    const newTemplates = importData.templates.map(template => ({
                        ...template,
                        id: `imported-${Date.now()}-${Math.random()}`,
                        category: 'custom'
                    }));
                    
                    const updatedTemplates = [...savedTemplates, ...newTemplates];
                    localStorage.setItem('config-templates', JSON.stringify(updatedTemplates));
                    
                    setTemplates(prev => [...prev, ...newTemplates]);
                    alert(`成功导入 ${newTemplates.length} 个模板`);
                } else {
                    alert('无效的模板文件格式');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('导入模板失败：文件格式错误');
            }
        };
        reader.readAsText(file);
        
        // 重置文件输入
        event.target.value = '';
    };

    const groupedTemplates = templates.reduce((groups, template) => {
        const category = template.category || 'custom';
        if (!groups[category]) groups[category] = [];
        groups[category].push(template);
        return groups;
    }, {});

    return html`
        <${Modal} onClose=${onClose} title="配置模板管理" size="large">
            <div class="template-manager">
                <!-- 操作工具栏 -->
                <div class="template-toolbar">
                    <div class="toolbar-left">
                        <button 
                            class="btn btn-primary btn-sm"
                            onClick=${() => setShowCreateTemplate(true)}
                            disabled=${existingInterfaces.length === 0}
                        >
                            <span class="btn-icon">➕</span>
                            创建模板
                        </button>
                        <button 
                            class="btn btn-secondary btn-sm"
                            onClick=${exportTemplates}
                        >
                            <span class="btn-icon">📤</span>
                            导出模板
                        </button>
                        <label class="btn btn-secondary btn-sm file-input-label">
                            <span class="btn-icon">📥</span>
                            导入模板
                            <input 
                                type="file" 
                                accept=".json"
                                onChange=${importTemplates}
                                style="display: none;"
                            />
                        </label>
                    </div>
                </div>

                <!-- 创建模板对话框 -->
                ${showCreateTemplate && html`
                    <div class="create-template-dialog">
                        <div class="dialog-header">
                            <h3>创建配置模板</h3>
                            <button 
                                class="close-btn"
                                onClick=${() => setShowCreateTemplate(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div class="dialog-body">
                            <div class="form-group">
                                <label>模板名称</label>
                                <input
                                    type="text"
                                    value=${newTemplateName}
                                    onChange=${(e) => setNewTemplateName(e.target.value)}
                                    placeholder="输入模板名称"
                                    class="form-input"
                                />
                            </div>
                            <div class="form-group">
                                <label>模板描述</label>
                                <textarea
                                    value=${newTemplateDescription}
                                    onChange=${(e) => setNewTemplateDescription(e.target.value)}
                                    placeholder="输入模板描述（可选）"
                                    class="form-textarea"
                                    rows="2"
                                />
                            </div>
                            <div class="form-group">
                                <label>基于接口</label>
                                <select
                                    value=${selectedInterface}
                                    onChange=${(e) => setSelectedInterface(e.target.value)}
                                    class="form-select"
                                >
                                    <option value="">选择接口</option>
                                    ${existingInterfaces.map(iface => html`
                                        <option value=${iface.id} key=${iface.id}>
                                            ${iface.name} (${iface.protocol})
                                        </option>
                                    `)}
                                </select>
                            </div>
                        </div>
                        <div class="dialog-actions">
                            <button 
                                class="btn btn-secondary"
                                onClick=${() => setShowCreateTemplate(false)}
                            >
                                取消
                            </button>
                            <button 
                                class="btn btn-primary"
                                onClick=${saveTemplate}
                            >
                                创建模板
                            </button>
                        </div>
                    </div>
                `}

                <!-- 模板列表 -->
                <div class="templates-content">
                    ${Object.entries(groupedTemplates).map(([category, categoryTemplates]) => html`
                        <div class="template-category" key=${category}>
                            <h3 class="category-title">
                                ${category === 'preset' ? '🏭 预设模板' : '👤 自定义模板'}
                                <span class="category-count">(${categoryTemplates.length})</span>
                            </h3>
                            <div class="templates-grid">
                                ${categoryTemplates.map(template => html`
                                    <div 
                                        class="template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}"
                                        key=${template.id}
                                        onClick=${() => setSelectedTemplate(template)}
                                    >
                                        <div class="template-header">
                                            <div class="template-info">
                                                <h4 class="template-name">${template.name}</h4>
                                                <span class="protocol-badge">${template.protocol}</span>
                                            </div>
                                            ${template.category === 'custom' && html`
                                                <button 
                                                    class="delete-template-btn"
                                                    onClick=${(e) => {
                                                        e.stopPropagation();
                                                        deleteTemplate(template.id);
                                                    }}
                                                    title="删除模板"
                                                >
                                                    🗑️
                                                </button>
                                            `}
                                        </div>
                                        <p class="template-description">${template.description}</p>
                                        ${template.createdAt && html`
                                            <div class="template-meta">
                                                创建时间: ${new Date(template.createdAt).toLocaleString('zh-CN')}
                                            </div>
                                        `}
                                        <div class="template-actions">
                                            <button 
                                                class="btn btn-primary btn-sm"
                                                onClick=${(e) => {
                                                    e.stopPropagation();
                                                    applyTemplate(template);
                                                }}
                                            >
                                                应用模板
                                            </button>
                                        </div>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `)}
                </div>

                <!-- 模板预览 -->
                ${selectedTemplate && html`
                    <div class="template-preview">
                        <h3>模板预览</h3>
                        <div class="config-preview">
                            <pre>${JSON.stringify(selectedTemplate.config, null, 2)}</pre>
                        </div>
                    </div>
                `}
            </div>
        <//>
    `;
};

export default ConfigTemplateManager;