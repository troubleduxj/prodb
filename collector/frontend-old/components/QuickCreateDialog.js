/**
 * Quick Create Dialog Component for ProDB Collector
 * Provides quick interface creation based on existing configurations or templates
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { SUPPORTED_PROTOCOLS } from '../services/protocols.js';

const QuickCreateDialog = ({ 
    onClose, 
    onCreate, 
    templateInterface = null,
    existingInterfaces = []
}) => {
    const [step, setStep] = useState(1); // 1: Choose method, 2: Configure, 3: Review
    const [createMethod, setCreateMethod] = useState('template'); // 'template', 'existing', 'blank'
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedExisting, setSelectedExisting] = useState(null);
    const [newConfig, setNewConfig] = useState({
        name: '',
        protocol: '',
        config: {},
        enabled: true
    });
    const [validationErrors, setValidationErrors] = useState({});

    useEffect(() => {
        if (templateInterface) {
            setCreateMethod('existing');
            setSelectedExisting(templateInterface);
            setStep(2);
            initializeFromExisting(templateInterface);
        }
    }, [templateInterface]);

    const initializeFromExisting = (sourceInterface) => {
        const baseName = sourceInterface.name.replace(/\s*\(副本\d*\)$/, '');
        const copyNumber = getCopyNumber(baseName);
        
        setNewConfig({
            name: `${baseName}${copyNumber > 0 ? ` (副本${copyNumber})` : ' (副本)'}`,
            protocol: sourceInterface.protocol,
            config: { ...sourceInterface.config },
            enabled: true,
            pollInterval: sourceInterface.pollInterval || 1000,
            maxRetries: sourceInterface.maxRetries || 3
        });
    };

    const getCopyNumber = (baseName) => {
        const existingCopies = existingInterfaces.filter(iface => 
            iface.name.startsWith(baseName) && iface.name.includes('副本')
        );
        return existingCopies.length;
    };

    const quickTemplates = {
        'OPC_UA': {
            name: 'OPC UA 标准配置',
            config: {
                endpoint: 'opc.tcp://localhost:4840',
                securityPolicy: 'None',
                securityMode: 'None',
                timeout: 5000
            }
        },
        'MODBUS_TCP': {
            name: 'Modbus TCP 标准配置',
            config: {
                host: '192.168.1.100',
                port: 502,
                slaveId: 1,
                timeout: 3000
            }
        },
        'MQTT': {
            name: 'MQTT 标准配置',
            config: {
                broker: 'mqtt://localhost',
                port: 1883,
                clientId: 'collector-client',
                topic: 'sensors/+/data',
                qos: 0
            }
        },
        'ETHERNET_IP': {
            name: 'Ethernet/IP 标准配置',
            config: {
                host: '192.168.1.100',
                port: 44818,
                slot: 0,
                timeout: 5000
            }
        }
    };

    const handleMethodSelect = (method) => {
        setCreateMethod(method);
        setStep(2);
    };

    const handleTemplateSelect = (protocol) => {
        const template = quickTemplates[protocol];
        setSelectedTemplate(protocol);
        setNewConfig({
            name: template.name,
            protocol: protocol,
            config: { ...template.config },
            enabled: true
        });
    };

    const handleExistingSelect = (interfaceConfig) => {
        setSelectedExisting(interfaceConfig);
        initializeFromExisting(interfaceConfig);
    };

    const handleConfigChange = (field, value) => {
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            setNewConfig(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setNewConfig(prev => ({
                ...prev,
                [field]: value
            }));
        }
        
        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => ({
                ...prev,
                [field]: null
            }));
        }
    };

    const validateConfig = () => {
        const errors = {};
        
        if (!newConfig.name.trim()) {
            errors.name = '接口名称不能为空';
        } else if (existingInterfaces.some(iface => iface.name === newConfig.name.trim())) {
            errors.name = '接口名称已存在';
        }
        
        if (!newConfig.protocol) {
            errors.protocol = '请选择协议类型';
        }
        
        // Protocol-specific validation
        const protocol = SUPPORTED_PROTOCOLS[newConfig.protocol];
        if (protocol) {
            protocol.params.forEach(param => {
                const value = newConfig.config[param.name];
                if (param.required && (!value || value.toString().trim() === '')) {
                    errors[`config.${param.name}`] = `${param.label || param.name} 是必填项`;
                }
            });
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 2 && !validateConfig()) {
            return;
        }
        setStep(step + 1);
    };

    const handleCreate = () => {
        if (validateConfig()) {
            onCreate(newConfig);
            onClose();
        }
    };

    const renderMethodSelection = () => html`
        <div class="method-selection">
            <h3>选择创建方式</h3>
            
            <div class="method-options">
                <div 
                    class="method-option ${createMethod === 'template' ? 'selected' : ''}"
                    onClick=${() => handleMethodSelect('template')}
                >
                    <div class="option-icon">📋</div>
                    <div class="option-content">
                        <h4>使用模板</h4>
                        <p>从预定义模板快速创建</p>
                    </div>
                </div>
                
                <div 
                    class="method-option ${createMethod === 'existing' ? 'selected' : ''}"
                    onClick=${() => handleMethodSelect('existing')}
                >
                    <div class="option-icon">🔄</div>
                    <div class="option-content">
                        <h4>基于现有配置</h4>
                        <p>复制并修改现有接口配置</p>
                    </div>
                </div>
                
                <div 
                    class="method-option ${createMethod === 'blank' ? 'selected' : ''}"
                    onClick=${() => handleMethodSelect('blank')}
                >
                    <div class="option-icon">✨</div>
                    <div class="option-content">
                        <h4>从头创建</h4>
                        <p>创建全新的接口配置</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const renderConfiguration = () => html`
        <div class="configuration-step">
            ${createMethod === 'template' && html`
                <div class="template-selection">
                    <h3>选择协议模板</h3>
                    <div class="protocol-grid">
                        ${Object.entries(quickTemplates).map(([protocol, template]) => html`
                            <div 
                                key=${protocol}
                                class="protocol-card ${selectedTemplate === protocol ? 'selected' : ''}"
                                onClick=${() => handleTemplateSelect(protocol)}
                            >
                                <div class="protocol-icon">
                                    ${SUPPORTED_PROTOCOLS[protocol]?.icon || '📡'}
                                </div>
                                <div class="protocol-info">
                                    <h4>${SUPPORTED_PROTOCOLS[protocol]?.name || protocol}</h4>
                                    <p>${template.name}</p>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}
            
            ${createMethod === 'existing' && !templateInterface && html`
                <div class="existing-selection">
                    <h3>选择源接口</h3>
                    <div class="existing-list">
                        ${existingInterfaces.map(iface => html`
                            <div 
                                key=${iface.id}
                                class="existing-item ${selectedExisting?.id === iface.id ? 'selected' : ''}"
                                onClick=${() => handleExistingSelect(iface)}
                            >
                                <div class="item-info">
                                    <h4>${iface.name}</h4>
                                    <span class="protocol-badge">${iface.protocol}</span>
                                </div>
                                <div class="item-status">
                                    <span class="status-indicator ${iface.status}">
                                        ${iface.status === 'connected' ? '🟢' : 
                                          iface.status === 'disconnected' ? '🟡' : '🔴'}
                                    </span>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}
            
            ${(selectedTemplate || selectedExisting || createMethod === 'blank') && html`
                <div class="config-form">
                    <h3>配置接口</h3>
                    
                    <div class="form-group">
                        <label class="form-label">接口名称 *</label>
                        <input
                            type="text"
                            class="form-input ${validationErrors.name ? 'error' : ''}"
                            value=${newConfig.name}
                            onInput=${(e) => handleConfigChange('name', e.target.value)}
                            placeholder="输入接口名称"
                        />
                        ${validationErrors.name && html`
                            <span class="error-message">${validationErrors.name}</span>
                        `}
                    </div>
                    
                    ${createMethod === 'blank' && html`
                        <div class="form-group">
                            <label class="form-label">协议类型 *</label>
                            <select
                                class="form-select ${validationErrors.protocol ? 'error' : ''}"
                                value=${newConfig.protocol}
                                onChange=${(e) => {
                                    const protocol = e.target.value;
                                    handleConfigChange('protocol', protocol);
                                    if (protocol && quickTemplates[protocol]) {
                                        setNewConfig(prev => ({
                                            ...prev,
                                            config: { ...quickTemplates[protocol].config }
                                        }));
                                    }
                                }}
                            >
                                <option value="">选择协议</option>
                                ${Object.entries(SUPPORTED_PROTOCOLS).map(([key, protocol]) => html`
                                    <option value=${key} key=${key}>${protocol.name}</option>
                                `)}
                            </select>
                            ${validationErrors.protocol && html`
                                <span class="error-message">${validationErrors.protocol}</span>
                            `}
                        </div>
                    `}
                    
                    ${newConfig.protocol && SUPPORTED_PROTOCOLS[newConfig.protocol] && html`
                        <div class="protocol-config">
                            <h4>协议参数</h4>
                            ${SUPPORTED_PROTOCOLS[newConfig.protocol].params.map(param => html`
                                <div class="form-group" key=${param.name}>
                                    <label class="form-label">
                                        ${param.label || param.name}
                                        ${param.required && html`<span class="required">*</span>`}
                                    </label>
                                    <input
                                        type=${param.type || 'text'}
                                        class="form-input ${validationErrors[`config.${param.name}`] ? 'error' : ''}"
                                        value=${newConfig.config[param.name] || ''}
                                        onInput=${(e) => handleConfigChange(`config.${param.name}`, e.target.value)}
                                        placeholder=${param.placeholder || ''}
                                    />
                                    ${validationErrors[`config.${param.name}`] && html`
                                        <span class="error-message">${validationErrors[`config.${param.name}`]}</span>
                                    `}
                                </div>
                            `)}
                        </div>
                    `}
                </div>
            `}
        </div>
    `;

    const renderReview = () => html`
        <div class="review-step">
            <h3>确认配置</h3>
            
            <div class="config-preview">
                <div class="preview-section">
                    <h4>基本信息</h4>
                    <div class="preview-item">
                        <span class="preview-label">接口名称:</span>
                        <span class="preview-value">${newConfig.name}</span>
                    </div>
                    <div class="preview-item">
                        <span class="preview-label">协议类型:</span>
                        <span class="preview-value">${SUPPORTED_PROTOCOLS[newConfig.protocol]?.name || newConfig.protocol}</span>
                    </div>
                </div>
                
                <div class="preview-section">
                    <h4>协议配置</h4>
                    ${Object.entries(newConfig.config).map(([key, value]) => html`
                        <div class="preview-item" key=${key}>
                            <span class="preview-label">${key}:</span>
                            <span class="preview-value">
                                ${key.includes('password') ? '••••••••' : value}
                            </span>
                        </div>
                    `)}
                </div>
            </div>
        </div>
    `;

    return html`
        <div class="quick-create-dialog">
            <div class="dialog-overlay" onClick=${onClose}></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2>快速创建接口</h2>
                    <button class="close-button" onClick=${onClose}>✕</button>
                </div>
                
                <div class="dialog-body">
                    <!-- Step Indicator -->
                    <div class="step-indicator">
                        <div class="step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}">
                            <span class="step-number">1</span>
                            <span class="step-label">选择方式</span>
                        </div>
                        <div class="step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}">
                            <span class="step-number">2</span>
                            <span class="step-label">配置接口</span>
                        </div>
                        <div class="step ${step >= 3 ? 'active' : ''}">
                            <span class="step-number">3</span>
                            <span class="step-label">确认创建</span>
                        </div>
                    </div>
                    
                    <!-- Step Content -->
                    <div class="step-content">
                        ${step === 1 && renderMethodSelection()}
                        ${step === 2 && renderConfiguration()}
                        ${step === 3 && renderReview()}
                    </div>
                </div>
                
                <div class="dialog-footer">
                    <div class="footer-actions">
                        ${step > 1 && html`
                            <button 
                                class="btn btn-secondary"
                                onClick=${() => setStep(step - 1)}
                            >
                                上一步
                            </button>
                        `}
                        
                        <button 
                            class="btn btn-outline"
                            onClick=${onClose}
                        >
                            取消
                        </button>
                        
                        ${step < 3 ? html`
                            <button 
                                class="btn btn-primary"
                                onClick=${handleNext}
                                disabled=${step === 2 && !newConfig.name.trim()}
                            >
                                下一步
                            </button>
                        ` : html`
                            <button 
                                class="btn btn-primary"
                                onClick=${handleCreate}
                            >
                                创建接口
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default QuickCreateDialog;