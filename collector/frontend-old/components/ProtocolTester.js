/**
 * Protocol Tester Component
 * Provides single protocol testing functionality with dynamic configuration
 * Integrates protocol-specific testers for enhanced functionality
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import services
import { protocolService, SUPPORTED_PROTOCOLS } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

// Import protocol-specific testers
import { OpcUaTester, ModbusTester, MqttTester, EthernetIpTester } from './protocol-testers/index.js';

const html = htm.bind(h);

const ProtocolTester = ({ 
    protocol, 
    onProtocolChange, 
    onTestComplete, 
    isLoading, 
    setIsLoading 
}) => {
    const [config, setConfig] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [testType, setTestType] = useState('connect');
    const [lastTestResult, setLastTestResult] = useState(null);

    // Initialize config when protocol changes
    useEffect(() => {
        if (protocol) {
            const defaultConfig = protocolService.getDefaultConfig(protocol);
            setConfig(defaultConfig);
            setValidationErrors({});
            
            // Set default test type
            const protocolDef = SUPPORTED_PROTOCOLS[protocol];
            if (protocolDef && protocolDef.testMethods.length > 0) {
                setTestType(protocolDef.testMethods[0]);
            }
            
            devLog('Protocol changed to:', protocol, 'with config:', defaultConfig);
        }
    }, [protocol]);

    // Handle configuration change
    const handleConfigChange = (paramName, value) => {
        const newConfig = { ...config, [paramName]: value };
        setConfig(newConfig);
        
        // Clear validation error for this field
        if (validationErrors[paramName]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[paramName];
                return newErrors;
            });
        }
        
        devLog('Config updated:', paramName, '=', value);
    };

    // Validate configuration
    const validateConfiguration = () => {
        const validation = protocolService.validateConfig(protocol, config);
        
        if (!validation.valid) {
            const errors = {};
            validation.errors.forEach(error => {
                // Try to map error to specific field
                const protocolDef = SUPPORTED_PROTOCOLS[protocol];
                const param = protocolDef?.params.find(p => 
                    error.toLowerCase().includes(p.label.toLowerCase())
                );
                if (param) {
                    errors[param.name] = error;
                } else {
                    errors.general = error;
                }
            });
            setValidationErrors(errors);
            return false;
        }
        
        setValidationErrors({});
        return true;
    };

    // Execute test
    const executeTest = async () => {
        if (!validateConfiguration()) {
            return;
        }

        setIsLoading(true);
        try {
            devLog('Starting test:', protocol, testType, config);
            
            const result = await protocolService.testConnection(protocol, config, testType);
            setLastTestResult(result);
            onTestComplete(result);
            
            devLog('Test completed:', result);
            
        } catch (error) {
            console.error('Test execution failed:', error);
            const errorResult = {
                id: `error-${Date.now()}`,
                protocol,
                testType,
                success: false,
                duration: 0,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            setLastTestResult(errorResult);
            onTestComplete(errorResult);
        } finally {
            setIsLoading(false);
        }
    };

    // Get protocol definition
    const protocolDef = SUPPORTED_PROTOCOLS[protocol];
    if (!protocolDef) {
        return html`
            <div class="protocol-tester error">
                <p>Unknown protocol: ${protocol}</p>
            </div>
        `;
    }

    // Check if protocol has specialized tester
    const hasSpecializedTester = ['OPC_UA', 'MODBUS_TCP', 'MODBUS_RTU', 'MQTT', 'ETHERNET_IP'].includes(protocol);

    return html`
        <div class="protocol-tester">
            <!-- Protocol Selection -->
            <div class="protocol-selection">
                <label class="form-label">协议类型</label>
                <div class="protocol-selector">
                    ${Object.entries(SUPPORTED_PROTOCOLS).map(([key, proto]) => html`
                        <button
                            key=${key}
                            class="protocol-option ${protocol === key ? 'active' : ''}"
                            onClick=${() => onProtocolChange(key)}
                            title=${proto.description}
                        >
                            <span class="protocol-icon">${proto.icon}</span>
                            <span class="protocol-name">${proto.name}</span>
                        </button>
                    `)}
                </div>
            </div>

            <!-- Configuration Form -->
            <div class="config-form">
                <h3>连接配置</h3>
                <div class="form-grid">
                    ${protocolDef.params.map(param => html`
                        <div key=${param.name} class="form-field">
                            <label class="form-label">
                                ${param.label}
                                ${param.required && html`<span class="required">*</span>`}
                            </label>
                            ${renderFormField(param, config[param.name], handleConfigChange)}
                            ${validationErrors[param.name] && html`
                                <div class="field-error">${validationErrors[param.name]}</div>
                            `}
                        </div>
                    `)}
                </div>
                
                ${validationErrors.general && html`
                    <div class="form-error">${validationErrors.general}</div>
                `}
            </div>

            <!-- Protocol-Specific Tester or Generic Tester -->
            ${hasSpecializedTester ? html`
                <div class="specialized-tester">
                    ${protocol === 'OPC_UA' && html`
                        <${OpcUaTester}
                            config=${config}
                            onConfigChange=${setConfig}
                            onTestComplete=${onTestComplete}
                            isLoading=${isLoading}
                            setIsLoading=${setIsLoading}
                        />
                    `}
                    ${(protocol === 'MODBUS_TCP' || protocol === 'MODBUS_RTU') && html`
                        <${ModbusTester}
                            config=${config}
                            onConfigChange=${setConfig}
                            onTestComplete=${onTestComplete}
                            isLoading=${isLoading}
                            setIsLoading=${setIsLoading}
                            protocolType=${protocol}
                        />
                    `}
                    ${protocol === 'MQTT' && html`
                        <${MqttTester}
                            config=${config}
                            onConfigChange=${setConfig}
                            onTestComplete=${onTestComplete}
                            isLoading=${isLoading}
                            setIsLoading=${setIsLoading}
                        />
                    `}
                    ${protocol === 'ETHERNET_IP' && html`
                        <${EthernetIpTester}
                            config=${config}
                            onConfigChange=${setConfig}
                            onTestComplete=${onTestComplete}
                            isLoading=${isLoading}
                            setIsLoading=${setIsLoading}
                        />
                    `}
                </div>
            ` : html`
                <!-- Generic Test Interface for other protocols -->
                <div class="generic-tester">
                    <!-- Test Type Selection -->
                    <div class="test-type-selection">
                        <label class="form-label">测试类型</label>
                        <div class="test-type-selector">
                            ${protocolDef.testMethods.map(method => html`
                                <button
                                    key=${method}
                                    class="test-type-option ${testType === method ? 'active' : ''}"
                                    onClick=${() => setTestType(method)}
                                >
                                    ${getTestMethodLabel(method)}
                                </button>
                            `)}
                        </div>
                    </div>

                    <!-- Test Actions -->
                    <div class="test-actions">
                        <button
                            class="btn btn-primary btn-lg"
                            onClick=${executeTest}
                            disabled=${isLoading}
                        >
                            ${isLoading ? '测试中...' : `测试 ${protocolDef.name}`}
                        </button>
                        
                        <button
                            class="btn btn-secondary"
                            onClick=${() => {
                                const defaultConfig = protocolService.getDefaultConfig(protocol);
                                setConfig(defaultConfig);
                                setValidationErrors({});
                            }}
                            disabled=${isLoading}
                        >
                            重置配置
                        </button>
                    </div>

                    <!-- Last Test Result Preview -->
                    ${lastTestResult && html`
                        <div class="last-result-preview">
                            <h4>最近测试结果</h4>
                            <div class="result-summary ${lastTestResult.success ? 'success' : 'error'}">
                                <div class="result-status">
                                    <span class="status-icon">
                                        ${lastTestResult.success ? '✅' : '❌'}
                                    </span>
                                    <span class="status-text">
                                        ${lastTestResult.success ? '测试成功' : '测试失败'}
                                    </span>
                                    <span class="result-duration">${lastTestResult.duration}ms</span>
                                </div>
                                ${lastTestResult.error && html`
                                    <div class="result-error">${lastTestResult.error}</div>
                                `}
                                ${lastTestResult.success && lastTestResult.data && html`
                                    <div class="result-data">
                                        <details>
                                            <summary>查看详细数据</summary>
                                            <pre>${JSON.stringify(lastTestResult.data, null, 2)}</pre>
                                        </details>
                                    </div>
                                `}
                            </div>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
};

// Helper function to render form fields
const renderFormField = (param, value, onChange) => {
    const commonProps = {
        value: value || '',
        onChange: (e) => onChange(param.name, e.target.value),
        placeholder: param.placeholder || '',
        required: param.required
    };

    switch (param.type) {
        case 'select':
            return html`
                <select class="form-select" ...${commonProps}>
                    <option value="">请选择...</option>
                    ${param.options.map(option => html`
                        <option key=${option} value=${option} selected=${value === option}>
                            ${option}
                        </option>
                    `)}
                </select>
            `;
        
        case 'number':
            return html`
                <input
                    type="number"
                    class="form-input"
                    min=${param.min}
                    max=${param.max}
                    ...${commonProps}
                />
            `;
        
        case 'password':
            return html`
                <input
                    type="password"
                    class="form-input"
                    ...${commonProps}
                />
            `;
        
        case 'text':
        default:
            return html`
                <input
                    type="text"
                    class="form-input"
                    ...${commonProps}
                />
            `;
    }
};

// Helper function to get test method labels
const getTestMethodLabel = (method) => {
    const labels = {
        connect: '连接测试',
        browse: '浏览节点',
        read: '读取数据',
        subscribe: '订阅数据',
        readCoils: '读取线圈',
        readDiscreteInputs: '读取离散输入',
        readHoldingRegisters: '读取保持寄存器',
        readInputRegisters: '读取输入寄存器',
        publish: '发布消息',
        readTag: '读取标签',
        writeTag: '写入标签'
    };
    return labels[method] || method;
};

export default ProtocolTester;