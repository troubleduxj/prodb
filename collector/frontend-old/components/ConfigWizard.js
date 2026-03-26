/**
 * Configuration Wizard Component for ProDB Collector
 * Provides step-by-step interface configuration with validation and testing
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { SUPPORTED_PROTOCOLS, protocolService } from '../services/protocols.js';
import { validator, formValidators } from '../utils/validation.js';
import { protocolTestAPI } from '../services/api.js';

const ConfigWizard = ({ onComplete, onCancel, initialData = null, mode = 'create' }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [config, setConfig] = useState(initialData || {
        name: '',
        protocol: '',
        enabled: true,
        config: {}
    });
    const [validationErrors, setValidationErrors] = useState({});
    const [validationWarnings, setValidationWarnings] = useState({});
    const [isValidating, setIsValidating] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    const steps = [
        { 
            id: 'protocol', 
            title: '选择协议', 
            component: ProtocolSelection,
            description: '选择要配置的工业协议类型'
        },
        { 
            id: 'basic', 
            title: '基本配置', 
            component: BasicConfig,
            description: '配置协议连接参数'
        },
        { 
            id: 'advanced', 
            title: '高级设置', 
            component: AdvancedConfig,
            description: '配置高级选项和优化参数'
        },
        { 
            id: 'test', 
            title: '测试连接', 
            component: ConnectionTest,
            description: '验证配置的正确性'
        },
        { 
            id: 'summary', 
            title: '完成配置', 
            component: ConfigSummary,
            description: '确认配置信息并保存'
        }
    ];

    // Real-time validation
    useEffect(() => {
        if (config.protocol && currentStep >= 1) {
            validateCurrentStep();
        }
    }, [config, currentStep]);

    const validateCurrentStep = async () => {
        setIsValidating(true);
        const errors = {};
        const warnings = {};

        try {
            switch (steps[currentStep].id) {
                case 'protocol':
                    if (!config.protocol) {
                        errors.protocol = ['请选择协议类型'];
                    }
                    if (!config.name || config.name.trim() === '') {
                        errors.name = ['请输入接口名称'];
                    }
                    break;

                case 'basic':
                    if (config.protocol) {
                        const protocolDef = SUPPORTED_PROTOCOLS[config.protocol];
                        if (protocolDef) {
                            // Validate required parameters
                            protocolDef.params.forEach(param => {
                                if (param.required && (!config.config[param.name] || config.config[param.name] === '')) {
                                    if (!errors.config) errors.config = {};
                                    errors.config[param.name] = [`${param.label}是必填项`];
                                }

                                // Type and range validation
                                const value = config.config[param.name];
                                if (value !== undefined && value !== '') {
                                    const validation = validateParameter(param, value);
                                    if (!validation.valid) {
                                        if (!errors.config) errors.config = {};
                                        errors.config[param.name] = validation.errors;
                                    }
                                    if (validation.warnings.length > 0) {
                                        if (!warnings.config) warnings.config = {};
                                        warnings.config[param.name] = validation.warnings;
                                    }
                                }
                            });

                            // Protocol-specific validation
                            const protocolValidation = protocolService.validateConfig(config.protocol, config.config);
                            if (!protocolValidation.valid) {
                                if (!errors.config) errors.config = {};
                                errors.config._general = protocolValidation.errors;
                            }
                            if (protocolValidation.warnings.length > 0) {
                                if (!warnings.config) warnings.config = {};
                                warnings.config._general = protocolValidation.warnings;
                            }
                        }
                    }
                    break;

                case 'advanced':
                    // Validate advanced settings
                    if (config.pollInterval && (config.pollInterval < 100 || config.pollInterval > 60000)) {
                        errors.pollInterval = ['轮询间隔应在100-60000毫秒之间'];
                    }
                    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
                        errors.maxRetries = ['重试次数应在0-10之间'];
                    }
                    break;
            }
        } catch (error) {
            console.error('Validation error:', error);
            errors._general = ['验证过程中发生错误'];
        }

        setValidationErrors(errors);
        setValidationWarnings(warnings);
        setIsValidating(false);

        return Object.keys(errors).length === 0;
    };

    const validateParameter = (param, value) => {
        const errors = [];
        const warnings = [];

        switch (param.type) {
            case 'number':
                if (isNaN(value)) {
                    errors.push(`${param.label}必须是数字`);
                } else {
                    const numValue = Number(value);
                    if (param.min !== undefined && numValue < param.min) {
                        errors.push(`${param.label}不能小于${param.min}`);
                    }
                    if (param.max !== undefined && numValue > param.max) {
                        errors.push(`${param.label}不能大于${param.max}`);
                    }
                }
                break;
            case 'select':
                if (param.options && !param.options.includes(value)) {
                    errors.push(`${param.label}必须是以下值之一: ${param.options.join(', ')}`);
                }
                break;
            case 'text':
                if (param.name === 'endpoint' && config.protocol === 'OPC_UA') {
                    if (!value.startsWith('opc.tcp://')) {
                        warnings.push('OPC UA端点应以"opc.tcp://"开头');
                    }
                }
                break;
        }

        return { valid: errors.length === 0, errors, warnings };
    };

    const nextStep = async () => {
        const isValid = await validateCurrentStep();
        if (isValid) {
            setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
        }
    };

    const prevStep = () => {
        setCurrentStep(Math.max(currentStep - 1, 0));
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const result = await protocolService.testConnection(
                config.protocol,
                config.config,
                'connect'
            );
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleComplete = () => {
        if (onComplete) {
            onComplete(config);
        }
    };

    const updateConfig = (updates) => {
        setConfig(prev => ({
            ...prev,
            ...updates
        }));
    };

    const updateConfigField = (field, value) => {
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            setConfig(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setConfig(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const canProceed = () => {
        return Object.keys(validationErrors).length === 0 && !isValidating;
    };

    const isLastStep = currentStep === steps.length - 1;
    const currentStepData = steps[currentStep];

    return html`
        <div class="config-wizard">
            <!-- 步骤指示器 -->
            <div class="wizard-steps">
                ${steps.map((step, index) => html`
                    <div class="step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}" key=${step.id}>
                        <div class="step-number">
                            ${index < currentStep ? html`<span class="check-icon">✓</span>` : index + 1}
                        </div>
                        <div class="step-info">
                            <div class="step-title">${step.title}</div>
                            <div class="step-description">${step.description}</div>
                        </div>
                    </div>
                `)}
            </div>

            <!-- 当前步骤内容 -->
            <div class="wizard-content">
                <div class="step-header">
                    <h2>${currentStepData.title}</h2>
                    <p class="step-description">${currentStepData.description}</p>
                </div>

                <div class="step-body">
                    <${currentStepData.component} 
                        config=${config}
                        onConfigChange=${updateConfig}
                        onFieldChange=${updateConfigField}
                        errors=${validationErrors}
                        warnings=${validationWarnings}
                        isValidating=${isValidating}
                        testResult=${testResult}
                        isTesting=${isTesting}
                        onTest=${testConnection}
                        mode=${mode}
                    />
                </div>
            </div>

            <!-- 导航按钮 -->
            <div class="wizard-navigation">
                <div class="nav-left">
                    ${currentStep > 0 && html`
                        <button 
                            onClick=${prevStep} 
                            class="btn btn-secondary"
                            disabled=${isValidating || isTesting}
                        >
                            <span class="btn-icon">←</span>
                            上一步
                        </button>
                    `}
                    ${onCancel && html`
                        <button 
                            onClick=${onCancel} 
                            class="btn btn-outline"
                            disabled=${isValidating || isTesting}
                        >
                            取消
                        </button>
                    `}
                </div>

                <div class="nav-right">
                    ${!isLastStep && html`
                        <button 
                            onClick=${nextStep}
                            class="btn btn-primary"
                            disabled=${!canProceed() || isTesting}
                        >
                            下一步
                            <span class="btn-icon">→</span>
                        </button>
                    `}
                    ${isLastStep && html`
                        <button 
                            onClick=${handleComplete}
                            class="btn btn-success"
                            disabled=${!canProceed() || isTesting}
                        >
                            <span class="btn-icon">✓</span>
                            ${mode === 'edit' ? '保存更改' : '完成配置'}
                        </button>
                    `}
                </div>
            </div>

            <!-- 验证状态指示器 -->
            ${isValidating && html`
                <div class="validation-indicator">
                    <span class="spinner"></span>
                    正在验证配置...
                </div>
            `}
        </div>
    `;
};

// Protocol Selection Step Component
const ProtocolSelection = ({ config, onConfigChange, onFieldChange, errors, warnings }) => {
    const protocolOptions = Object.entries(SUPPORTED_PROTOCOLS).map(([key, protocol]) => ({
        value: key,
        label: protocol.name,
        description: protocol.description,
        icon: protocol.icon,
        color: protocol.color
    }));

    const handleProtocolSelect = (protocolType) => {
        const defaultConfig = protocolService.getDefaultConfig(protocolType);
        onConfigChange({
            protocol: protocolType,
            config: defaultConfig
        });
    };

    return html`
        <div class="protocol-selection">
            <!-- 接口名称 -->
            <div class="form-group">
                <label for="interface-name" class="form-label">
                    接口名称 <span class="required">*</span>
                </label>
                <input
                    type="text"
                    id="interface-name"
                    class="form-input ${errors.name ? 'error' : ''}"
                    value=${config.name || ''}
                    onInput=${(e) => onFieldChange('name', e.target.value)}
                    placeholder="输入接口名称，例如：生产线OPC UA服务器"
                />
                ${errors.name && html`
                    <div class="form-error">
                        ${errors.name.map(error => html`<div>${error}</div>`)}
                    </div>
                `}
            </div>

            <!-- 协议选择 -->
            <div class="form-group">
                <label class="form-label">
                    协议类型 <span class="required">*</span>
                </label>
                <div class="protocol-grid">
                    ${protocolOptions.map(option => html`
                        <div 
                            class="protocol-card ${config.protocol === option.value ? 'selected' : ''}"
                            onClick=${() => handleProtocolSelect(option.value)}
                            key=${option.value}
                        >
                            <div class="protocol-icon" style="color: ${option.color}">
                                ${option.icon}
                            </div>
                            <div class="protocol-info">
                                <h3 class="protocol-name">${option.label}</h3>
                                <p class="protocol-description">${option.description}</p>
                            </div>
                            <div class="protocol-selector">
                                <input 
                                    type="radio" 
                                    name="protocol" 
                                    value=${option.value}
                                    checked=${config.protocol === option.value}
                                    onChange=${() => handleProtocolSelect(option.value)}
                                />
                            </div>
                        </div>
                    `)}
                </div>
                ${errors.protocol && html`
                    <div class="form-error">
                        ${errors.protocol.map(error => html`<div>${error}</div>`)}
                    </div>
                `}
            </div>

            <!-- 协议信息展示 -->
            ${config.protocol && html`
                <div class="protocol-info-panel">
                    <h4>协议信息</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">协议名称:</span>
                            <span class="info-value">${SUPPORTED_PROTOCOLS[config.protocol].name}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">支持功能:</span>
                            <span class="info-value">
                                ${SUPPORTED_PROTOCOLS[config.protocol].testMethods.join(', ')}
                            </span>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};

// Basic Configuration Step Component
const BasicConfig = ({ config, onFieldChange, errors, warnings, isValidating }) => {
    if (!config.protocol) {
        return html`
            <div class="config-placeholder">
                <p>请先选择协议类型</p>
            </div>
        `;
    }

    const protocolDef = SUPPORTED_PROTOCOLS[config.protocol];
    const configErrors = errors.config || {};
    const configWarnings = warnings.config || {};

    const renderField = (param) => {
        const fieldValue = config.config[param.name] || '';
        const fieldErrors = configErrors[param.name] || [];
        const fieldWarnings = configWarnings[param.name] || [];
        const hasError = fieldErrors.length > 0;
        const hasWarning = fieldWarnings.length > 0;

        switch (param.type) {
            case 'select':
                return html`
                    <select
                        class="form-select ${hasError ? 'error' : hasWarning ? 'warning' : ''}"
                        value=${fieldValue}
                        onChange=${(e) => onFieldChange(`config.${param.name}`, e.target.value)}
                    >
                        <option value="">请选择${param.label}</option>
                        ${param.options.map(option => html`
                            <option value=${option} key=${option}>${option}</option>
                        `)}
                    </select>
                `;
            case 'password':
                return html`
                    <input
                        type="password"
                        class="form-input ${hasError ? 'error' : hasWarning ? 'warning' : ''}"
                        value=${fieldValue}
                        onInput=${(e) => onFieldChange(`config.${param.name}`, e.target.value)}
                        placeholder=${param.placeholder || `输入${param.label}`}
                    />
                `;
            case 'number':
                return html`
                    <input
                        type="number"
                        class="form-input ${hasError ? 'error' : hasWarning ? 'warning' : ''}"
                        value=${fieldValue}
                        onInput=${(e) => onFieldChange(`config.${param.name}`, e.target.value)}
                        placeholder=${param.placeholder || `输入${param.label}`}
                        min=${param.min}
                        max=${param.max}
                    />
                `;
            default:
                return html`
                    <input
                        type="text"
                        class="form-input ${hasError ? 'error' : hasWarning ? 'warning' : ''}"
                        value=${fieldValue}
                        onInput=${(e) => onFieldChange(`config.${param.name}`, e.target.value)}
                        placeholder=${param.placeholder || `输入${param.label}`}
                    />
                `;
        }
    };

    return html`
        <div class="basic-config">
            <div class="config-form">
                ${protocolDef.params.map(param => html`
                    <div class="form-group" key=${param.name}>
                        <label class="form-label">
                            ${param.label}
                            ${param.required && html`<span class="required">*</span>`}
                        </label>
                        ${renderField(param)}
                        ${configErrors[param.name] && html`
                            <div class="form-error">
                                ${configErrors[param.name].map(error => html`<div>${error}</div>`)}
                            </div>
                        `}
                        ${configWarnings[param.name] && html`
                            <div class="form-warning">
                                ${configWarnings[param.name].map(warning => html`<div>${warning}</div>`)}
                            </div>
                        `}
                    </div>
                `)}

                <!-- 通用错误信息 -->
                ${configErrors._general && html`
                    <div class="form-error general-error">
                        ${configErrors._general.map(error => html`<div>${error}</div>`)}
                    </div>
                `}
                ${configWarnings._general && html`
                    <div class="form-warning general-warning">
                        ${configWarnings._general.map(warning => html`<div>${warning}</div>`)}
                    </div>
                `}
            </div>

            <!-- 实时验证指示器 -->
            ${isValidating && html`
                <div class="validation-status">
                    <span class="spinner small"></span>
                    正在验证参数...
                </div>
            `}
        </div>
    `;
};

// Advanced Configuration Step Component
const AdvancedConfig = ({ config, onFieldChange, errors, warnings }) => {
    return html`
        <div class="advanced-config">
            <div class="config-section">
                <h3>连接设置</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">轮询间隔 (毫秒)</label>
                        <input
                            type="number"
                            class="form-input ${errors.pollInterval ? 'error' : ''}"
                            value=${config.pollInterval || 1000}
                            onInput=${(e) => onFieldChange('pollInterval', parseInt(e.target.value))}
                            min="100"
                            max="60000"
                        />
                        ${errors.pollInterval && html`
                            <div class="form-error">
                                ${errors.pollInterval.map(error => html`<div>${error}</div>`)}
                            </div>
                        `}
                    </div>
                    <div class="form-group">
                        <label class="form-label">重试次数</label>
                        <input
                            type="number"
                            class="form-input ${errors.maxRetries ? 'error' : ''}"
                            value=${config.maxRetries || 3}
                            onInput=${(e) => onFieldChange('maxRetries', parseInt(e.target.value))}
                            min="0"
                            max="10"
                        />
                        ${errors.maxRetries && html`
                            <div class="form-error">
                                ${errors.maxRetries.map(error => html`<div>${error}</div>`)}
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <div class="config-section">
                <h3>数据处理</h3>
                <div class="form-group">
                    <label class="form-checkbox">
                        <input
                            type="checkbox"
                            checked=${config.enableBuffer || false}
                            onChange=${(e) => onFieldChange('enableBuffer', e.target.checked)}
                        />
                        启用数据缓冲
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-checkbox">
                        <input
                            type="checkbox"
                            checked=${config.enableCompression || false}
                            onChange=${(e) => onFieldChange('enableCompression', e.target.checked)}
                        />
                        启用数据压缩
                    </label>
                </div>
            </div>

            <div class="config-section">
                <h3>日志设置</h3>
                <div class="form-group">
                    <label class="form-label">日志级别</label>
                    <select
                        class="form-select"
                        value=${config.logLevel || 'INFO'}
                        onChange=${(e) => onFieldChange('logLevel', e.target.value)}
                    >
                        <option value="DEBUG">调试</option>
                        <option value="INFO">信息</option>
                        <option value="WARN">警告</option>
                        <option value="ERROR">错误</option>
                    </select>
                </div>
            </div>
        </div>
    `;
};

// Connection Test Step Component
const ConnectionTest = ({ config, testResult, isTesting, onTest }) => {
    const canTest = config.protocol && config.config && Object.keys(config.config).length > 0;

    return html`
        <div class="connection-test">
            <div class="test-section">
                <h3>连接测试</h3>
                <p>测试配置的连接参数是否正确</p>
                
                <div class="test-controls">
                    <button
                        class="btn btn-primary"
                        onClick=${onTest}
                        disabled=${!canTest || isTesting}
                    >
                        ${isTesting ? html`
                            <span class="spinner small"></span>
                            正在测试...
                        ` : html`
                            <span class="btn-icon">🔧</span>
                            开始测试
                        `}
                    </button>
                </div>

                <!-- 测试结果 -->
                ${testResult && html`
                    <div class="test-result ${testResult.success ? 'success' : 'error'}">
                        <div class="result-header">
                            <span class="result-icon">
                                ${testResult.success ? '✅' : '❌'}
                            </span>
                            <span class="result-status">
                                ${testResult.success ? '连接成功' : '连接失败'}
                            </span>
                            ${testResult.duration && html`
                                <span class="result-duration">${testResult.duration}ms</span>
                            `}
                        </div>
                        
                        ${testResult.success && testResult.data && html`
                            <div class="result-data">
                                <h4>连接信息</h4>
                                <pre>${JSON.stringify(testResult.data, null, 2)}</pre>
                            </div>
                        `}
                        
                        ${!testResult.success && testResult.error && html`
                            <div class="result-error">
                                <h4>错误信息</h4>
                                <p>${testResult.error}</p>
                            </div>
                        `}
                    </div>
                `}

                <!-- 配置预览 -->
                <div class="config-preview">
                    <h4>配置预览</h4>
                    <div class="preview-content">
                        <div class="preview-item">
                            <span class="preview-label">接口名称:</span>
                            <span class="preview-value">${config.name}</span>
                        </div>
                        <div class="preview-item">
                            <span class="preview-label">协议类型:</span>
                            <span class="preview-value">${SUPPORTED_PROTOCOLS[config.protocol]?.name}</span>
                        </div>
                        ${Object.entries(config.config).map(([key, value]) => html`
                            <div class="preview-item" key=${key}>
                                <span class="preview-label">${key}:</span>
                                <span class="preview-value">${value}</span>
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Configuration Summary Step Component
const ConfigSummary = ({ config, mode }) => {
    return html`
        <div class="config-summary">
            <div class="summary-header">
                <h3>${mode === 'edit' ? '配置更改摘要' : '配置摘要'}</h3>
                <p>请确认以下配置信息无误</p>
            </div>

            <div class="summary-content">
                <div class="summary-section">
                    <h4>基本信息</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">接口名称</span>
                            <span class="summary-value">${config.name}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">协议类型</span>
                            <span class="summary-value">${SUPPORTED_PROTOCOLS[config.protocol]?.name}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">状态</span>
                            <span class="summary-value ${config.enabled ? 'enabled' : 'disabled'}">
                                ${config.enabled ? '启用' : '禁用'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="summary-section">
                    <h4>连接参数</h4>
                    <div class="summary-grid">
                        ${Object.entries(config.config).map(([key, value]) => html`
                            <div class="summary-item" key=${key}>
                                <span class="summary-label">${key}</span>
                                <span class="summary-value">${key.includes('password') ? '••••••••' : value}</span>
                            </div>
                        `)}
                    </div>
                </div>

                ${(config.pollInterval || config.maxRetries || config.logLevel) && html`
                    <div class="summary-section">
                        <h4>高级设置</h4>
                        <div class="summary-grid">
                            ${config.pollInterval && html`
                                <div class="summary-item">
                                    <span class="summary-label">轮询间隔</span>
                                    <span class="summary-value">${config.pollInterval}ms</span>
                                </div>
                            `}
                            ${config.maxRetries && html`
                                <div class="summary-item">
                                    <span class="summary-label">重试次数</span>
                                    <span class="summary-value">${config.maxRetries}</span>
                                </div>
                            `}
                            ${config.logLevel && html`
                                <div class="summary-item">
                                    <span class="summary-label">日志级别</span>
                                    <span class="summary-value">${config.logLevel}</span>
                                </div>
                            `}
                        </div>
                    </div>
                `}
            </div>

            <div class="summary-actions">
                <div class="action-note">
                    <p>点击"${mode === 'edit' ? '保存更改' : '完成配置'}"将${mode === 'edit' ? '更新' : '创建'}此接口配置</p>
                </div>
            </div>
        </div>
    `;
};

export default ConfigWizard;