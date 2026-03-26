/**
 * Ethernet/IP Protocol Specific Tester
 * Provides Ethernet/IP testing functionality for Allen-Bradley PLCs and compatible devices
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

import { protocolService } from '../../services/protocols.js';
import { devLog } from '../../utils/helpers.js';

const html = htm.bind(h);

const EthernetIpTester = ({ config, onConfigChange, onTestComplete, isLoading, setIsLoading }) => {
    const [testType, setTestType] = useState('connect');
    const [tagName, setTagName] = useState('');
    const [tagValue, setTagValue] = useState('');
    const [tagType, setTagType] = useState('DINT');
    const [readResults, setReadResults] = useState([]);
    const [deviceInfo, setDeviceInfo] = useState(null);

    // Ethernet/IP specific test methods
    const testMethods = [
        { id: 'connect', label: '连接测试', description: '测试与Ethernet/IP设备的连接' },
        { id: 'deviceInfo', label: '设备信息', description: '获取设备标识和状态信息' },
        { id: 'readTag', label: '读取标签', description: '读取指定标签的数值' },
        { id: 'writeTag', label: '写入标签', description: '写入标签数值' },
        { id: 'listTags', label: '列举标签', description: '获取设备中的标签列表' }
    ];

    // Common tag data types
    const tagDataTypes = [
        { value: 'BOOL', label: 'BOOL - 布尔值' },
        { value: 'SINT', label: 'SINT - 8位有符号整数' },
        { value: 'INT', label: 'INT - 16位有符号整数' },
        { value: 'DINT', label: 'DINT - 32位有符号整数' },
        { value: 'LINT', label: 'LINT - 64位有符号整数' },
        { value: 'REAL', label: 'REAL - 32位浮点数' },
        { value: 'LREAL', label: 'LREAL - 64位浮点数' },
        { value: 'STRING', label: 'STRING - 字符串' }
    ];

    // Execute Ethernet/IP specific test
    const executeTest = async () => {
        if (!validateConfig()) return;

        setIsLoading(true);
        try {
            let result;
            
            switch (testType) {
                case 'connect':
                    result = await testConnection();
                    break;
                case 'deviceInfo':
                    result = await testDeviceInfo();
                    break;
                case 'readTag':
                    result = await testReadTag();
                    break;
                case 'writeTag':
                    result = await testWriteTag();
                    break;
                case 'listTags':
                    result = await testListTags();
                    break;
                default:
                    throw new Error(`Unknown test type: ${testType}`);
            }

            onTestComplete(result);
            devLog('Ethernet/IP test completed:', result);

        } catch (error) {
            console.error('Ethernet/IP test failed:', error);
            const errorResult = {
                id: `ethernetip-error-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType,
                success: false,
                duration: 0,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            onTestComplete(errorResult);
        } finally {
            setIsLoading(false);
        }
    };

    // Test Ethernet/IP connection
    const testConnection = async () => {
        const startTime = Date.now();
        
        const result = await protocolService.testConnection('ETHERNET_IP', config, 'connect');
        
        // Add Ethernet/IP specific connection info
        if (result.success && result.data) {
            result.data.ethernetIpInfo = {
                host: config.host,
                port: config.port || 44818,
                slot: config.slot || 0,
                timeout: config.timeout || 5000,
                protocolVersion: 'CIP',
                connectionType: 'Explicit Messaging'
            };
        }

        return result;
    };

    // Test device information retrieval
    const testDeviceInfo = async () => {
        const startTime = Date.now();
        
        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Simulate device info retrieval
            const mockDeviceInfo = {
                vendorId: 1, // Rockwell Automation
                deviceType: 14, // Programmable Logic Controller
                productCode: 55, // CompactLogix
                majorRevision: 20,
                minorRevision: 11,
                status: 0x60FF, // Device operational
                serialNumber: 0x12345678,
                productName: 'CompactLogix L32E',
                state: 'Run',
                faultInfo: 'No Faults'
            };

            setDeviceInfo(mockDeviceInfo);

            return {
                id: `ethernetip-deviceinfo-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'deviceInfo',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    deviceInfo: mockDeviceInfo,
                    identity: {
                        vendor: 'Rockwell Automation',
                        productType: 'Programmable Logic Controller',
                        productName: mockDeviceInfo.productName,
                        revision: `${mockDeviceInfo.majorRevision}.${mockDeviceInfo.minorRevision}`
                    }
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `ethernetip-deviceinfo-error-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'deviceInfo',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test tag reading
    const testReadTag = async () => {
        const startTime = Date.now();
        
        if (!tagName) {
            throw new Error('Please specify a tag name to read');
        }

        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Generate mock tag value based on data type
            let mockValue;
            switch (tagType) {
                case 'BOOL':
                    mockValue = Math.random() > 0.5;
                    break;
                case 'SINT':
                    mockValue = Math.floor(Math.random() * 256) - 128;
                    break;
                case 'INT':
                    mockValue = Math.floor(Math.random() * 65536) - 32768;
                    break;
                case 'DINT':
                    mockValue = Math.floor(Math.random() * 2000000) - 1000000;
                    break;
                case 'REAL':
                    mockValue = Math.random() * 1000;
                    break;
                case 'STRING':
                    mockValue = `TestString_${Date.now()}`;
                    break;
                default:
                    mockValue = Math.floor(Math.random() * 1000);
            }

            const tagData = {
                tagName,
                dataType: tagType,
                value: mockValue,
                status: 'Good',
                timestamp: new Date().toISOString()
            };

            setReadResults([tagData]);

            return {
                id: `ethernetip-readtag-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'readTag',
                success: true,
                duration: Date.now() - startTime,
                data: tagData,
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `ethernetip-readtag-error-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'readTag',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test tag writing
    const testWriteTag = async () => {
        const startTime = Date.now();
        
        if (!tagName) {
            throw new Error('Please specify a tag name to write');
        }
        if (!tagValue) {
            throw new Error('Please specify a value to write');
        }

        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Validate and convert value based on data type
            let convertedValue;
            try {
                switch (tagType) {
                    case 'BOOL':
                        convertedValue = tagValue.toLowerCase() === 'true' || tagValue === '1';
                        break;
                    case 'SINT':
                    case 'INT':
                    case 'DINT':
                        convertedValue = parseInt(tagValue);
                        if (isNaN(convertedValue)) throw new Error('Invalid integer value');
                        break;
                    case 'REAL':
                    case 'LREAL':
                        convertedValue = parseFloat(tagValue);
                        if (isNaN(convertedValue)) throw new Error('Invalid float value');
                        break;
                    case 'STRING':
                        convertedValue = tagValue.toString();
                        break;
                    default:
                        convertedValue = tagValue;
                }
            } catch (conversionError) {
                throw new Error(`Value conversion failed: ${conversionError.message}`);
            }

            const writeData = {
                tagName,
                dataType: tagType,
                value: convertedValue,
                originalValue: tagValue,
                status: 'Written',
                timestamp: new Date().toISOString()
            };

            return {
                id: `ethernetip-writetag-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'writeTag',
                success: true,
                duration: Date.now() - startTime,
                data: writeData,
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `ethernetip-writetag-error-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'writeTag',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test tag listing
    const testListTags = async () => {
        const startTime = Date.now();
        
        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Generate mock tag list
            const mockTags = [
                { name: 'Program:MainProgram.Temperature', dataType: 'REAL', scope: 'Program' },
                { name: 'Program:MainProgram.Pressure', dataType: 'REAL', scope: 'Program' },
                { name: 'Program:MainProgram.FlowRate', dataType: 'REAL', scope: 'Program' },
                { name: 'Program:MainProgram.PumpStatus', dataType: 'BOOL', scope: 'Program' },
                { name: 'Program:MainProgram.ValvePosition', dataType: 'INT', scope: 'Program' },
                { name: 'Global.SystemMode', dataType: 'DINT', scope: 'Controller' },
                { name: 'Global.AlarmCount', dataType: 'INT', scope: 'Controller' },
                { name: 'Global.ProductionCount', dataType: 'DINT', scope: 'Controller' },
                { name: 'Local:1:I.Data[0]', dataType: 'DINT', scope: 'IO' },
                { name: 'Local:2:O.Data[0]', dataType: 'DINT', scope: 'IO' }
            ];

            setReadResults(mockTags.map(tag => ({
                tagName: tag.name,
                dataType: tag.dataType,
                scope: tag.scope,
                status: 'Available'
            })));

            return {
                id: `ethernetip-listtags-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'listTags',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    tagCount: mockTags.length,
                    tags: mockTags
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `ethernetip-listtags-error-${Date.now()}`,
                protocol: 'ETHERNET_IP',
                testType: 'listTags',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Validate configuration
    const validateConfig = () => {
        if (!config.host) {
            throw new Error('Host/IP Address is required');
        }
        return true;
    };

    // Check if test requires tag name
    const requiresTagName = () => {
        return ['readTag', 'writeTag'].includes(testType);
    };

    // Check if test requires tag value
    const requiresTagValue = () => {
        return testType === 'writeTag';
    };

    return html`
        <div class="ethernetip-tester">
            <div class="tester-header">
                <h3>🏭 Ethernet/IP 协议测试</h3>
                <p class="tester-description">测试Ethernet/IP设备连接、标签读写和设备信息获取</p>
            </div>

            <!-- Test Method Selection -->
            <div class="test-methods">
                <label class="form-label">测试功能</label>
                <div class="method-grid">
                    ${testMethods.map(method => html`
                        <div 
                            key=${method.id}
                            class="method-card ${testType === method.id ? 'active' : ''}"
                            onClick=${() => setTestType(method.id)}
                        >
                            <div class="method-title">${method.label}</div>
                            <div class="method-description">${method.description}</div>
                        </div>
                    `)}
                </div>
            </div>

            <!-- Device Information -->
            ${deviceInfo && html`
                <div class="device-info">
                    <h4>设备信息</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">产品名称:</span>
                            <span class="value">${deviceInfo.productName}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">固件版本:</span>
                            <span class="value">${deviceInfo.majorRevision}.${deviceInfo.minorRevision}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">设备状态:</span>
                            <span class="value status-${deviceInfo.state.toLowerCase()}">${deviceInfo.state}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">序列号:</span>
                            <span class="value">0x${deviceInfo.serialNumber.toString(16).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            `}

            <!-- Tag Parameters -->
            ${requiresTagName() && html`
                <div class="tag-parameters">
                    <h4>标签参数</h4>
                    <div class="parameter-grid">
                        <div class="form-field">
                            <label class="form-label">标签名称</label>
                            <input
                                type="text"
                                class="form-input"
                                value=${tagName}
                                onChange=${(e) => setTagName(e.target.value)}
                                placeholder="Program:MainProgram.Temperature"
                            />
                            <div class="field-hint">例: Program:MainProgram.Temperature 或 Global.SystemMode</div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">数据类型</label>
                            <select 
                                class="form-select"
                                value=${tagType}
                                onChange=${(e) => setTagType(e.target.value)}
                            >
                                ${tagDataTypes.map(type => html`
                                    <option key=${type.value} value=${type.value}>
                                        ${type.label}
                                    </option>
                                `)}
                            </select>
                        </div>
                        ${requiresTagValue() && html`
                            <div class="form-field">
                                <label class="form-label">写入值</label>
                                <input
                                    type="text"
                                    class="form-input"
                                    value=${tagValue}
                                    onChange=${(e) => setTagValue(e.target.value)}
                                    placeholder=${getValuePlaceholder()}
                                />
                                <div class="field-hint">${getValueHint()}</div>
                            </div>
                        `}
                    </div>
                </div>
            `}

            <!-- Test Action -->
            <div class="test-action">
                <button
                    class="btn btn-primary btn-lg"
                    onClick=${executeTest}
                    disabled=${isLoading || (requiresTagName() && !tagName) || (requiresTagValue() && !tagValue)}
                >
                    ${isLoading ? '测试中...' : `执行${testMethods.find(m => m.id === testType)?.label}`}
                </button>
            </div>

            <!-- Results Display -->
            ${readResults.length > 0 && html`
                <div class="results-display">
                    <h4>
                        ${testType === 'listTags' ? '标签列表' : 
                          testType === 'readTag' ? '读取结果' : '测试结果'}
                    </h4>
                    <div class="results-table">
                        <div class="table-header">
                            <div>标签名称</div>
                            <div>数据类型</div>
                            ${testType === 'listTags' ? html`<div>作用域</div>` : html`<div>值</div>`}
                            <div>状态</div>
                        </div>
                        ${readResults.map((result, index) => html`
                            <div key=${index} class="table-row">
                                <div class="tag-name">${result.tagName}</div>
                                <div class="data-type">${result.dataType}</div>
                                <div class="tag-value">
                                    ${testType === 'listTags' ? result.scope : 
                                      (typeof result.value === 'boolean' ? 
                                        (result.value ? 'TRUE' : 'FALSE') : 
                                        result.value)}
                                </div>
                                <div class="status ${result.status.toLowerCase()}">${result.status}</div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Ethernet/IP Reference -->
            <div class="ethernetip-reference">
                <details>
                    <summary>Ethernet/IP 参考信息</summary>
                    <div class="reference-content">
                        <div class="ref-group">
                            <h5>常用数据类型</h5>
                            <ul>
                                <li><strong>BOOL</strong> - 布尔值 (true/false)</li>
                                <li><strong>SINT</strong> - 8位有符号整数 (-128 to 127)</li>
                                <li><strong>INT</strong> - 16位有符号整数 (-32,768 to 32,767)</li>
                                <li><strong>DINT</strong> - 32位有符号整数 (-2,147,483,648 to 2,147,483,647)</li>
                                <li><strong>REAL</strong> - 32位浮点数</li>
                                <li><strong>STRING</strong> - 字符串</li>
                            </ul>
                        </div>
                        <div class="ref-group">
                            <h5>标签命名示例</h5>
                            <ul>
                                <li>Program:MainProgram.Temperature</li>
                                <li>Global.SystemMode</li>
                                <li>Local:1:I.Data[0] (输入模块)</li>
                                <li>Local:2:O.Data[0] (输出模块)</li>
                            </ul>
                        </div>
                        <div class="ref-group">
                            <h5>连接参数</h5>
                            <ul>
                                <li><strong>端口</strong> - 通常为 44818 (EtherNet/IP)</li>
                                <li><strong>槽位</strong> - CPU槽位号 (通常为 0)</li>
                                <li><strong>超时</strong> - 连接超时时间 (毫秒)</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    `;

    // Helper functions
    function getValuePlaceholder() {
        switch (tagType) {
            case 'BOOL': return 'true 或 false';
            case 'SINT': return '-128 到 127';
            case 'INT': return '-32768 到 32767';
            case 'DINT': return '整数值';
            case 'REAL': return '浮点数值';
            case 'STRING': return '字符串值';
            default: return '输入值';
        }
    }

    function getValueHint() {
        switch (tagType) {
            case 'BOOL': return '布尔值: true/false 或 1/0';
            case 'SINT': return '8位有符号整数 (-128 到 127)';
            case 'INT': return '16位有符号整数 (-32,768 到 32,767)';
            case 'DINT': return '32位有符号整数';
            case 'REAL': return '32位浮点数 (例: 123.45)';
            case 'STRING': return '字符串 (例: "Hello World")';
            default: return '';
        }
    }
};

export default EthernetIpTester;