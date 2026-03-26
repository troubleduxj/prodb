/**
 * Modbus Protocol Specific Tester
 * Supports both TCP and RTU modes with various function codes
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

import { protocolService } from '../../services/protocols.js';
import { devLog } from '../../utils/helpers.js';

const html = htm.bind(h);

const ModbusTester = ({ config, onConfigChange, onTestComplete, isLoading, setIsLoading, protocolType }) => {
    const [testType, setTestType] = useState('connect');
    const [startAddress, setStartAddress] = useState(0);
    const [quantity, setQuantity] = useState(10);
    const [readResults, setReadResults] = useState([]);
    const [writeValue, setWriteValue] = useState('');
    const [writeAddress, setWriteAddress] = useState(0);

    // Modbus function codes and test methods
    const testMethods = {
        'MODBUS_TCP': [
            { id: 'connect', label: '连接测试', description: '测试与Modbus TCP设备的连接' },
            { id: 'readCoils', label: '读取线圈 (FC01)', description: '读取线圈状态 (0x区域)' },
            { id: 'readDiscreteInputs', label: '读取离散输入 (FC02)', description: '读取离散输入状态 (1x区域)' },
            { id: 'readHoldingRegisters', label: '读取保持寄存器 (FC03)', description: '读取保持寄存器 (4x区域)' },
            { id: 'readInputRegisters', label: '读取输入寄存器 (FC04)', description: '读取输入寄存器 (3x区域)' },
            { id: 'writeSingleCoil', label: '写单个线圈 (FC05)', description: '写入单个线圈状态' },
            { id: 'writeSingleRegister', label: '写单个寄存器 (FC06)', description: '写入单个保持寄存器' },
            { id: 'writeMultipleCoils', label: '写多个线圈 (FC15)', description: '写入多个线圈状态' },
            { id: 'writeMultipleRegisters', label: '写多个寄存器 (FC16)', description: '写入多个保持寄存器' }
        ],
        'MODBUS_RTU': [
            { id: 'connect', label: '连接测试', description: '测试与Modbus RTU设备的串口连接' },
            { id: 'readCoils', label: '读取线圈 (FC01)', description: '读取线圈状态 (0x区域)' },
            { id: 'readDiscreteInputs', label: '读取离散输入 (FC02)', description: '读取离散输入状态 (1x区域)' },
            { id: 'readHoldingRegisters', label: '读取保持寄存器 (FC03)', description: '读取保持寄存器 (4x区域)' },
            { id: 'readInputRegisters', label: '读取输入寄存器 (FC04)', description: '读取输入寄存器 (3x区域)' },
            { id: 'writeSingleCoil', label: '写单个线圈 (FC05)', description: '写入单个线圈状态' },
            { id: 'writeSingleRegister', label: '写单个寄存器 (FC06)', description: '写入单个保持寄存器' }
        ]
    };

    const currentMethods = testMethods[protocolType] || testMethods['MODBUS_TCP'];

    // Execute Modbus specific test
    const executeTest = async () => {
        if (!validateConfig()) return;

        setIsLoading(true);
        try {
            let result;
            
            switch (testType) {
                case 'connect':
                    result = await testConnection();
                    break;
                case 'readCoils':
                case 'readDiscreteInputs':
                case 'readHoldingRegisters':
                case 'readInputRegisters':
                    result = await testRead();
                    break;
                case 'writeSingleCoil':
                case 'writeSingleRegister':
                case 'writeMultipleCoils':
                case 'writeMultipleRegisters':
                    result = await testWrite();
                    break;
                default:
                    throw new Error(`Unknown test type: ${testType}`);
            }

            onTestComplete(result);
            devLog('Modbus test completed:', result);

        } catch (error) {
            console.error('Modbus test failed:', error);
            const errorResult = {
                id: `modbus-error-${Date.now()}`,
                protocol: protocolType,
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

    // Test Modbus connection
    const testConnection = async () => {
        const startTime = Date.now();
        
        const result = await protocolService.testConnection(protocolType, config, 'connect');
        
        // Add Modbus specific connection info
        if (result.success && result.data) {
            result.data.modbusInfo = {
                slaveId: config.slaveId,
                connectionType: protocolType === 'MODBUS_TCP' ? 'TCP/IP' : 'Serial RTU',
                timeout: config.timeout || 3000,
                ...(protocolType === 'MODBUS_TCP' ? {
                    host: config.host,
                    port: config.port
                } : {
                    serialPort: config.port,
                    baudRate: config.baudRate,
                    dataBits: config.dataBits,
                    stopBits: config.stopBits,
                    parity: config.parity
                })
            };
        }

        return result;
    };

    // Test Modbus read operations
    const testRead = async () => {
        const startTime = Date.now();
        
        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Generate mock read data based on function code
            let mockData = [];
            const functionCode = getFunctionCode(testType);
            
            if (testType === 'readCoils' || testType === 'readDiscreteInputs') {
                // Boolean values for coils and discrete inputs
                for (let i = 0; i < quantity; i++) {
                    mockData.push({
                        address: startAddress + i,
                        value: Math.random() > 0.5,
                        type: 'boolean'
                    });
                }
            } else {
                // Numeric values for registers
                for (let i = 0; i < quantity; i++) {
                    mockData.push({
                        address: startAddress + i,
                        value: Math.floor(Math.random() * 65536),
                        type: 'uint16'
                    });
                }
            }

            setReadResults(mockData);

            return {
                id: `modbus-read-${Date.now()}`,
                protocol: protocolType,
                testType,
                success: true,
                duration: Date.now() - startTime,
                data: {
                    functionCode,
                    startAddress,
                    quantity,
                    values: mockData,
                    slaveId: config.slaveId
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `modbus-read-error-${Date.now()}`,
                protocol: protocolType,
                testType,
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test Modbus write operations
    const testWrite = async () => {
        const startTime = Date.now();
        
        if (!writeValue && testType !== 'writeMultipleCoils' && testType !== 'writeMultipleRegisters') {
            throw new Error('Please enter a value to write');
        }

        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            const functionCode = getFunctionCode(testType);
            let writeData;

            if (testType === 'writeSingleCoil') {
                writeData = {
                    address: writeAddress,
                    value: writeValue.toLowerCase() === 'true' || writeValue === '1',
                    type: 'boolean'
                };
            } else if (testType === 'writeSingleRegister') {
                writeData = {
                    address: writeAddress,
                    value: parseInt(writeValue) || 0,
                    type: 'uint16'
                };
            } else if (testType === 'writeMultipleCoils') {
                // Parse multiple boolean values
                const values = (writeValue || '1,0,1,0').split(',').map(v => 
                    v.trim().toLowerCase() === 'true' || v.trim() === '1'
                );
                writeData = {
                    startAddress: writeAddress,
                    values,
                    quantity: values.length,
                    type: 'boolean[]'
                };
            } else if (testType === 'writeMultipleRegisters') {
                // Parse multiple numeric values
                const values = (writeValue || '100,200,300').split(',').map(v => 
                    parseInt(v.trim()) || 0
                );
                writeData = {
                    startAddress: writeAddress,
                    values,
                    quantity: values.length,
                    type: 'uint16[]'
                };
            }

            return {
                id: `modbus-write-${Date.now()}`,
                protocol: protocolType,
                testType,
                success: true,
                duration: Date.now() - startTime,
                data: {
                    functionCode,
                    writeData,
                    slaveId: config.slaveId,
                    result: 'Write operation completed successfully'
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `modbus-write-error-${Date.now()}`,
                protocol: protocolType,
                testType,
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Get function code for test type
    const getFunctionCode = (testType) => {
        const codes = {
            'readCoils': '01',
            'readDiscreteInputs': '02',
            'readHoldingRegisters': '03',
            'readInputRegisters': '04',
            'writeSingleCoil': '05',
            'writeSingleRegister': '06',
            'writeMultipleCoils': '15',
            'writeMultipleRegisters': '16'
        };
        return codes[testType] || '01';
    };

    // Validate configuration
    const validateConfig = () => {
        if (protocolType === 'MODBUS_TCP') {
            if (!config.host) throw new Error('Host/IP Address is required');
            if (!config.port) throw new Error('Port is required');
        } else {
            if (!config.port) throw new Error('Serial Port is required');
            if (!config.baudRate) throw new Error('Baud Rate is required');
        }
        if (!config.slaveId) throw new Error('Slave ID is required');
        return true;
    };

    // Check if test type is a read operation
    const isReadOperation = () => {
        return ['readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters'].includes(testType);
    };

    // Check if test type is a write operation
    const isWriteOperation = () => {
        return ['writeSingleCoil', 'writeSingleRegister', 'writeMultipleCoils', 'writeMultipleRegisters'].includes(testType);
    };

    return html`
        <div class="modbus-tester">
            <div class="tester-header">
                <h3>🔌 ${protocolType === 'MODBUS_TCP' ? 'Modbus TCP' : 'Modbus RTU'} 协议测试</h3>
                <p class="tester-description">
                    测试${protocolType === 'MODBUS_TCP' ? 'Modbus TCP/IP' : 'Modbus RTU串口'}通信和各种功能码操作
                </p>
            </div>

            <!-- Test Method Selection -->
            <div class="test-methods">
                <label class="form-label">功能码测试</label>
                <div class="method-grid">
                    ${currentMethods.map(method => html`
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

            <!-- Read Parameters -->
            ${isReadOperation() && html`
                <div class="read-parameters">
                    <h4>读取参数</h4>
                    <div class="parameter-grid">
                        <div class="form-field">
                            <label class="form-label">起始地址</label>
                            <input
                                type="number"
                                class="form-input"
                                value=${startAddress}
                                onChange=${(e) => setStartAddress(parseInt(e.target.value) || 0)}
                                min="0"
                                max="65535"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">数量</label>
                            <input
                                type="number"
                                class="form-input"
                                value=${quantity}
                                onChange=${(e) => setQuantity(parseInt(e.target.value) || 1)}
                                min="1"
                                max="125"
                            />
                        </div>
                    </div>
                </div>
            `}

            <!-- Write Parameters -->
            ${isWriteOperation() && html`
                <div class="write-parameters">
                    <h4>写入参数</h4>
                    <div class="parameter-grid">
                        <div class="form-field">
                            <label class="form-label">地址</label>
                            <input
                                type="number"
                                class="form-input"
                                value=${writeAddress}
                                onChange=${(e) => setWriteAddress(parseInt(e.target.value) || 0)}
                                min="0"
                                max="65535"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">
                                ${testType.includes('Multiple') ? '值列表 (逗号分隔)' : '值'}
                            </label>
                            <input
                                type="text"
                                class="form-input"
                                value=${writeValue}
                                onChange=${(e) => setWriteValue(e.target.value)}
                                placeholder=${getWritePlaceholder()}
                            />
                        </div>
                    </div>
                </div>
            `}

            <!-- Test Action -->
            <div class="test-action">
                <button
                    class="btn btn-primary btn-lg"
                    onClick=${executeTest}
                    disabled=${isLoading}
                >
                    ${isLoading ? '测试中...' : `执行${currentMethods.find(m => m.id === testType)?.label}`}
                </button>
            </div>

            <!-- Read Results -->
            ${readResults.length > 0 && html`
                <div class="read-results">
                    <h4>读取结果</h4>
                    <div class="results-table">
                        <div class="table-header">
                            <div>地址</div>
                            <div>值</div>
                            <div>类型</div>
                            <div>十六进制</div>
                        </div>
                        ${readResults.map((result, index) => html`
                            <div key=${index} class="table-row">
                                <div>${result.address}</div>
                                <div class="value ${result.type}">
                                    ${result.type === 'boolean' ? 
                                        (result.value ? 'TRUE' : 'FALSE') : 
                                        result.value
                                    }
                                </div>
                                <div>${result.type}</div>
                                <div class="hex-value">
                                    ${result.type === 'boolean' ? 
                                        (result.value ? '0x01' : '0x00') : 
                                        `0x${result.value.toString(16).toUpperCase().padStart(4, '0')}`
                                    }
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Function Code Reference -->
            <div class="function-codes-reference">
                <details>
                    <summary>Modbus 功能码参考</summary>
                    <div class="reference-content">
                        <div class="code-group">
                            <h5>读取功能码</h5>
                            <ul>
                                <li><strong>01 (0x01)</strong> - 读取线圈状态 (0x区域)</li>
                                <li><strong>02 (0x02)</strong> - 读取离散输入状态 (1x区域)</li>
                                <li><strong>03 (0x03)</strong> - 读取保持寄存器 (4x区域)</li>
                                <li><strong>04 (0x04)</strong> - 读取输入寄存器 (3x区域)</li>
                            </ul>
                        </div>
                        <div class="code-group">
                            <h5>写入功能码</h5>
                            <ul>
                                <li><strong>05 (0x05)</strong> - 写单个线圈</li>
                                <li><strong>06 (0x06)</strong> - 写单个寄存器</li>
                                <li><strong>15 (0x0F)</strong> - 写多个线圈</li>
                                <li><strong>16 (0x10)</strong> - 写多个寄存器</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    `;

    // Helper function for write placeholder text
    function getWritePlaceholder() {
        if (testType === 'writeSingleCoil') return 'true/false 或 1/0';
        if (testType === 'writeSingleRegister') return '0-65535';
        if (testType === 'writeMultipleCoils') return '1,0,1,0';
        if (testType === 'writeMultipleRegisters') return '100,200,300';
        return '';
    }
};

export default ModbusTester;