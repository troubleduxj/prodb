/**
 * Quick Configuration Templates Component for ProDB Collector
 * Provides predefined templates and quick configuration options
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { SUPPORTED_PROTOCOLS } from '../services/protocols.js';

const QuickConfigTemplates = ({ onTemplateSelect, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState('common');
    const [searchTerm, setSearchTerm] = useState('');

    // Predefined configuration templates
    const templates = {
        common: [
            {
                id: 'opcua-local',
                name: 'OPC UA 本地服务器',
                description: '连接本地OPC UA服务器的标准配置',
                protocol: 'OPC_UA',
                icon: '🏠',
                config: {
                    name: 'OPC UA 本地服务器',
                    protocol: 'OPC_UA',
                    config: {
                        endpoint: 'opc.tcp://localhost:4840',
                        securityPolicy: 'None',
                        securityMode: 'None',
                        timeout: 5000
                    },
                    pollInterval: 1000,
                    maxRetries: 3,
                    enabled: true
                }
            },
            {
                id: 'modbus-plc',
                name: 'Modbus TCP PLC',
                description: '标准PLC Modbus TCP连接配置',
                protocol: 'MODBUS_TCP',
                icon: '🏭',
                config: {
                    name: 'Modbus TCP PLC',
                    protocol: 'MODBUS_TCP',
                    config: {
                        host: '192.168.1.100',
                        port: 502,
                        slaveId: 1,
                        timeout: 3000
                    },
                    pollInterval: 1000,
                    maxRetries: 3,
                    enabled: true
                }
            },
            {
                id: 'mqtt-broker',
                name: 'MQTT 消息代理',
                description: '连接MQTT消息代理的标准配置',
                protocol: 'MQTT',
                icon: '📨',
                config: {
                    name: 'MQTT 消息代理',
                    protocol: 'MQTT',
                    config: {
                        broker: 'mqtt://localhost',
                        port: 1883,
                        clientId: 'collector-client',
                        topic: 'sensors/+/data',
                        qos: 0,
                        keepAlive: 60
                    },
                    pollInterval: 1000,
                    maxRetries: 3,
                    enabled: true
                }
            }
        ],
        industrial: [
            {
                id: 'siemens-s7',
                name: 'Siemens S7 PLC',
                description: '西门子S7系列PLC连接配置',
                protocol: 'OPC_UA',
                icon: '⚙️',
                config: {
                    name: 'Siemens S7 PLC',
                    protocol: 'OPC_UA',
                    config: {
                        endpoint: 'opc.tcp://192.168.1.100:4840',
                        securityPolicy: 'Basic256Sha256',
                        securityMode: 'SignAndEncrypt',
                        timeout: 10000
                    },
                    pollInterval: 500,
                    maxRetries: 5,
                    enabled: true
                }
            },
            {
                id: 'ab-logix',
                name: 'Allen-Bradley ControlLogix',
                description: 'AB ControlLogix PLC Ethernet/IP配置',
                protocol: 'ETHERNET_IP',
                icon: '🔧',
                config: {
                    name: 'Allen-Bradley ControlLogix',
                    protocol: 'ETHERNET_IP',
                    config: {
                        host: '192.168.1.100',
                        port: 44818,
                        slot: 0,
                        timeout: 5000
                    },
                    pollInterval: 1000,
                    maxRetries: 3,
                    enabled: true
                }
            },
            {
                id: 'schneider-m580',
                name: 'Schneider M580 PLC',
                description: '施耐德M580系列PLC Modbus配置',
                protocol: 'MODBUS_TCP',
                icon: '⚡',
                config: {
                    name: 'Schneider M580 PLC',
                    protocol: 'MODBUS_TCP',
                    config: {
                        host: '192.168.1.100',
                        port: 502,
                        slaveId: 1,
                        timeout: 5000
                    },
                    pollInterval: 800,
                    maxRetries: 3,
                    enabled: true
                }
            }
        ],
        iot: [
            {
                id: 'mqtt-aws',
                name: 'AWS IoT Core',
                description: 'AWS IoT Core MQTT连接配置',
                protocol: 'MQTT',
                icon: '☁️',
                config: {
                    name: 'AWS IoT Core',
                    protocol: 'MQTT',
                    config: {
                        broker: 'mqtts://your-endpoint.iot.region.amazonaws.com',
                        port: 8883,
                        clientId: 'collector-aws-client',
                        topic: 'device/+/telemetry',
                        qos: 1,
                        keepAlive: 300
                    },
                    pollInterval: 5000,
                    maxRetries: 5,
                    enabled: true
                }
            },
            {
                id: 'mqtt-azure',
                name: 'Azure IoT Hub',
                description: 'Azure IoT Hub MQTT连接配置',
                protocol: 'MQTT',
                icon: '🌐',
                config: {
                    name: 'Azure IoT Hub',
                    protocol: 'MQTT',
                    config: {
                        broker: 'mqtts://your-hub.azure-devices.net',
                        port: 8883,
                        clientId: 'collector-azure-client',
                        topic: 'devices/+/messages/events',
                        qos: 1,
                        keepAlive: 240
                    },
                    pollInterval: 5000,
                    maxRetries: 5,
                    enabled: true
                }
            }
        ],
        testing: [
            {
                id: 'opcua-simulator',
                name: 'OPC UA 模拟器',
                description: '用于测试的OPC UA模拟器配置',
                protocol: 'OPC_UA',
                icon: '🧪',
                config: {
                    name: 'OPC UA 测试模拟器',
                    protocol: 'OPC_UA',
                    config: {
                        endpoint: 'opc.tcp://localhost:53530/OPCUA/SimulationServer',
                        securityPolicy: 'None',
                        securityMode: 'None',
                        timeout: 5000
                    },
                    pollInterval: 2000,
                    maxRetries: 1,
                    enabled: true
                }
            },
            {
                id: 'modbus-simulator',
                name: 'Modbus 模拟器',
                description: '用于测试的Modbus模拟器配置',
                protocol: 'MODBUS_TCP',
                icon: '🔬',
                config: {
                    name: 'Modbus 测试模拟器',
                    protocol: 'MODBUS_TCP',
                    config: {
                        host: '127.0.0.1',
                        port: 5020,
                        slaveId: 1,
                        timeout: 3000
                    },
                    pollInterval: 2000,
                    maxRetries: 1,
                    enabled: true
                }
            }
        ]
    };

    const categories = {
        common: { name: '常用配置', icon: '⭐' },
        industrial: { name: '工业设备', icon: '🏭' },
        iot: { name: 'IoT平台', icon: '🌐' },
        testing: { name: '测试模拟', icon: '🧪' }
    };

    const getFilteredTemplates = () => {
        const categoryTemplates = templates[selectedCategory] || [];
        if (!searchTerm) return categoryTemplates;
        
        return categoryTemplates.filter(template =>
            template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.protocol.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const handleTemplateSelect = (template) => {
        onTemplateSelect(template.config);
    };

    const handleCustomCreate = (protocolType) => {
        const protocol = SUPPORTED_PROTOCOLS[protocolType];
        if (!protocol) return;

        const defaultConfig = {
            name: `新建 ${protocol.name} 接口`,
            protocol: protocolType,
            config: {},
            enabled: true
        };

        // Set default values for protocol parameters
        protocol.params.forEach(param => {
            if (param.default !== undefined) {
                defaultConfig.config[param.name] = param.default;
            }
        });

        onTemplateSelect(defaultConfig);
    };

    const filteredTemplates = getFilteredTemplates();

    return html`
        <div class="quick-config-templates">
            <div class="templates-header">
                <h2>快速配置模板</h2>
                <p>选择预定义模板快速创建接口配置</p>
                <button class="close-button" onClick=${onClose}>✕</button>
            </div>

            <div class="templates-content">
                <!-- Category Tabs -->
                <div class="category-tabs">
                    ${Object.entries(categories).map(([key, category]) => html`
                        <button
                            key=${key}
                            class="category-tab ${selectedCategory === key ? 'active' : ''}"
                            onClick=${() => setSelectedCategory(key)}
                        >
                            <span class="tab-icon">${category.icon}</span>
                            <span class="tab-name">${category.name}</span>
                        </button>
                    `)}
                </div>

                <!-- Search -->
                <div class="templates-search">
                    <input
                        type="text"
                        class="search-input"
                        placeholder="搜索模板..."
                        value=${searchTerm}
                        onInput=${(e) => setSearchTerm(e.target.value)}
                    />
                    <span class="search-icon">🔍</span>
                </div>

                <!-- Templates Grid -->
                <div class="templates-grid">
                    ${filteredTemplates.length === 0 ? html`
                        <div class="no-templates">
                            <div class="no-templates-icon">📋</div>
                            <h3>未找到模板</h3>
                            <p>尝试更改搜索条件或选择其他分类</p>
                        </div>
                    ` : filteredTemplates.map(template => html`
                        <div 
                            key=${template.id}
                            class="template-card"
                            onClick=${() => handleTemplateSelect(template)}
                        >
                            <div class="template-header">
                                <span class="template-icon">${template.icon}</span>
                                <div class="template-info">
                                    <h3 class="template-name">${template.name}</h3>
                                    <span class="template-protocol">${template.protocol}</span>
                                </div>
                            </div>
                            <p class="template-description">${template.description}</p>
                            <div class="template-preview">
                                ${Object.entries(template.config.config).slice(0, 2).map(([key, value]) => html`
                                    <div class="preview-item" key=${key}>
                                        <span class="preview-key">${key}:</span>
                                        <span class="preview-value">${value}</span>
                                    </div>
                                `)}
                                ${Object.keys(template.config.config).length > 2 && html`
                                    <div class="preview-more">
                                        +${Object.keys(template.config.config).length - 2} 更多
                                    </div>
                                `}
                            </div>
                        </div>
                    `)}
                </div>

                <!-- Custom Protocol Creation -->
                <div class="custom-creation">
                    <h3>或创建自定义配置</h3>
                    <div class="protocol-options">
                        ${Object.entries(SUPPORTED_PROTOCOLS).map(([key, protocol]) => html`
                            <button
                                key=${key}
                                class="protocol-option"
                                onClick=${() => handleCustomCreate(key)}
                            >
                                <span class="protocol-icon" style="color: ${protocol.color}">
                                    ${protocol.icon}
                                </span>
                                <span class="protocol-name">${protocol.name}</span>
                            </button>
                        `)}
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default QuickConfigTemplates;