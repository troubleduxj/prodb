/**
 * Protocol Service Layer for ProDB Collector
 * Handles protocol-specific operations and configurations
 */

import { protocolTestAPI } from './api.js';

// Supported protocol definitions
export const SUPPORTED_PROTOCOLS = {
    'OPC_UA': {
        name: 'OPC UA',
        description: 'OPC Unified Architecture protocol for industrial automation',
        params: [
            { name: 'endpoint', label: 'Endpoint URL', type: 'text', required: true, placeholder: 'opc.tcp://192.168.1.100:4840' },
            { name: 'securityPolicy', label: 'Security Policy', type: 'select', required: true, options: ['None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256'] },
            { name: 'securityMode', label: 'Security Mode', type: 'select', required: true, options: ['None', 'Sign', 'SignAndEncrypt'] },
            { name: 'username', label: 'Username', type: 'text', required: false },
            { name: 'password', label: 'Password', type: 'password', required: false },
            { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 5000 }
        ],
        testMethods: ['connect', 'browse', 'read', 'subscribe'],
        icon: '🔗',
        color: '#2563eb'
    },
    'OPC_DA': {
        name: 'OPC DA',
        description: 'OPC Data Access protocol for legacy systems',
        params: [
            { name: 'server', label: 'Server Name', type: 'text', required: true, placeholder: 'Matrikon.OPC.Server' },
            { name: 'clsid', label: 'CLSID', type: 'text', required: false },
            { name: 'username', label: 'Username', type: 'text', required: false },
            { name: 'password', label: 'Password', type: 'password', required: false },
            { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 5000 }
        ],
        testMethods: ['connect', 'browse', 'read'],
        icon: '📊',
        color: '#059669'
    },
    'MODBUS_TCP': {
        name: 'Modbus TCP',
        description: 'Modbus TCP/IP protocol for industrial devices',
        params: [
            { name: 'host', label: 'Host/IP Address', type: 'text', required: true, placeholder: '192.168.1.100' },
            { name: 'port', label: 'Port', type: 'number', required: true, default: 502 },
            { name: 'slaveId', label: 'Slave ID', type: 'number', required: true, default: 1, min: 1, max: 255 },
            { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 3000 }
        ],
        testMethods: ['connect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters'],
        icon: '🔌',
        color: '#dc2626'
    },
    'MODBUS_RTU': {
        name: 'Modbus RTU',
        description: 'Modbus RTU serial protocol',
        params: [
            { name: 'port', label: 'Serial Port', type: 'text', required: true, placeholder: 'COM1 or /dev/ttyUSB0' },
            { name: 'baudRate', label: 'Baud Rate', type: 'select', required: true, options: [9600, 19200, 38400, 57600, 115200], default: 9600 },
            { name: 'dataBits', label: 'Data Bits', type: 'select', required: true, options: [7, 8], default: 8 },
            { name: 'stopBits', label: 'Stop Bits', type: 'select', required: true, options: [1, 2], default: 1 },
            { name: 'parity', label: 'Parity', type: 'select', required: true, options: ['None', 'Even', 'Odd'], default: 'None' },
            { name: 'slaveId', label: 'Slave ID', type: 'number', required: true, default: 1, min: 1, max: 255 },
            { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 3000 }
        ],
        testMethods: ['connect', 'readCoils', 'readDiscreteInputs', 'readHoldingRegisters', 'readInputRegisters'],
        icon: '📡',
        color: '#d97706'
    },
    'MQTT': {
        name: 'MQTT',
        description: 'Message Queuing Telemetry Transport protocol',
        params: [
            { name: 'broker', label: 'Broker Address', type: 'text', required: true, placeholder: 'mqtt://192.168.1.100' },
            { name: 'port', label: 'Port', type: 'number', required: true, default: 1883 },
            { name: 'clientId', label: 'Client ID', type: 'text', required: false, placeholder: 'collector-client' },
            { name: 'username', label: 'Username', type: 'text', required: false },
            { name: 'password', label: 'Password', type: 'password', required: false },
            { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'sensors/+/data' },
            { name: 'qos', label: 'QoS Level', type: 'select', required: false, options: [0, 1, 2], default: 0 },
            { name: 'keepAlive', label: 'Keep Alive (s)', type: 'number', required: false, default: 60 }
        ],
        testMethods: ['connect', 'subscribe', 'publish'],
        icon: '📨',
        color: '#7c3aed'
    },
    'ETHERNET_IP': {
        name: 'Ethernet/IP',
        description: 'Ethernet/IP protocol for Allen-Bradley PLCs',
        params: [
            { name: 'host', label: 'Host/IP Address', type: 'text', required: true, placeholder: '192.168.1.100' },
            { name: 'port', label: 'Port', type: 'number', required: false, default: 44818 },
            { name: 'slot', label: 'Slot', type: 'number', required: false, default: 0 },
            { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 5000 }
        ],
        testMethods: ['connect', 'readTag', 'writeTag'],
        icon: '🏭',
        color: '#0891b2'
    }
};

export class ProtocolService {
    constructor() {
        this.testResults = new Map();
        this.activeTests = new Set();
    }

    /**
     * Get protocol definition
     * @param {string} protocolType - Protocol type
     * @returns {Object|null} Protocol definition
     */
    getProtocol(protocolType) {
        return SUPPORTED_PROTOCOLS[protocolType] || null;
    }

    /**
     * Get all supported protocols
     * @returns {Object} All protocol definitions
     */
    getAllProtocols() {
        return SUPPORTED_PROTOCOLS;
    }

    /**
     * Get protocol list for selection
     * @returns {Array} Protocol options
     */
    getProtocolOptions() {
        return Object.entries(SUPPORTED_PROTOCOLS).map(([key, protocol]) => ({
            value: key,
            label: protocol.name,
            description: protocol.description,
            icon: protocol.icon,
            color: protocol.color
        }));
    }

    /**
     * Validate protocol configuration
     * @param {string} protocolType - Protocol type
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateConfig(protocolType, config) {
        const protocol = this.getProtocol(protocolType);
        if (!protocol) {
            return { valid: false, errors: ['Unknown protocol type'] };
        }

        const errors = [];
        const warnings = [];

        // Check required parameters
        protocol.params.forEach(param => {
            if (param.required && (!config[param.name] || config[param.name] === '')) {
                errors.push(`${param.label} is required`);
            }

            // Type validation
            if (config[param.name] !== undefined && config[param.name] !== '') {
                const value = config[param.name];
                
                switch (param.type) {
                    case 'number':
                        if (isNaN(value)) {
                            errors.push(`${param.label} must be a number`);
                        } else {
                            const numValue = Number(value);
                            if (param.min !== undefined && numValue < param.min) {
                                errors.push(`${param.label} must be at least ${param.min}`);
                            }
                            if (param.max !== undefined && numValue > param.max) {
                                errors.push(`${param.label} must be at most ${param.max}`);
                            }
                        }
                        break;
                    case 'select':
                        if (param.options && !param.options.includes(value)) {
                            errors.push(`${param.label} must be one of: ${param.options.join(', ')}`);
                        }
                        break;
                }
            }
        });

        // Protocol-specific validation
        switch (protocolType) {
            case 'OPC_UA':
                if (config.endpoint && !config.endpoint.startsWith('opc.tcp://')) {
                    warnings.push('OPC UA endpoint should start with "opc.tcp://"');
                }
                break;
            case 'MQTT':
                if (config.broker && !config.broker.match(/^mqtts?:\/\//)) {
                    warnings.push('MQTT broker should start with "mqtt://" or "mqtts://"');
                }
                break;
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Test protocol connection
     * @param {string} protocolType - Protocol type
     * @param {Object} config - Protocol configuration
     * @param {string} testType - Type of test to perform
     * @returns {Promise<Object>} Test result
     */
    async testConnection(protocolType, config, testType = 'connect') {
        const testId = `${protocolType}-${Date.now()}`;
        this.activeTests.add(testId);

        try {
            const testConfig = {
                protocol: protocolType,
                config,
                testType
            };

            const result = await protocolTestAPI.testConnection(testConfig);
            
            const testResult = {
                id: testId,
                protocol: protocolType,
                testType,
                success: result.success,
                duration: result.duration,
                data: result.data,
                error: result.error,
                timestamp: new Date().toISOString()
            };

            this.testResults.set(testId, testResult);
            return testResult;

        } catch (error) {
            const testResult = {
                id: testId,
                protocol: protocolType,
                testType,
                success: false,
                duration: 0,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.testResults.set(testId, testResult);
            return testResult;

        } finally {
            this.activeTests.delete(testId);
        }
    }

    /**
     * Scan for devices
     * @param {Object} scanConfig - Scan configuration
     * @returns {Promise<Array>} Discovered devices
     */
    async scanDevices(scanConfig) {
        try {
            return await protocolTestAPI.scanDevices(scanConfig);
        } catch (error) {
            console.error('Device scan failed:', error);
            return [];
        }
    }

    /**
     * Batch test multiple configurations
     * @param {Array} testConfigs - Array of test configurations
     * @returns {Promise<Array>} Test results
     */
    async batchTest(testConfigs) {
        const results = [];
        
        for (const testConfig of testConfigs) {
            const result = await this.testConnection(
                testConfig.protocol,
                testConfig.config,
                testConfig.testType || 'connect'
            );
            results.push(result);
        }

        return results;
    }

    /**
     * Get test results
     * @param {string} testId - Test ID (optional)
     * @returns {Array|Object} Test results
     */
    getTestResults(testId = null) {
        if (testId) {
            return this.testResults.get(testId);
        }
        return Array.from(this.testResults.values());
    }

    /**
     * Clear test results
     * @param {string} testId - Test ID (optional, clears all if not provided)
     */
    clearTestResults(testId = null) {
        if (testId) {
            this.testResults.delete(testId);
        } else {
            this.testResults.clear();
        }
    }

    /**
     * Check if test is active
     * @param {string} testId - Test ID
     * @returns {boolean} True if test is active
     */
    isTestActive(testId) {
        return this.activeTests.has(testId);
    }

    /**
     * Get default configuration for protocol
     * @param {string} protocolType - Protocol type
     * @returns {Object} Default configuration
     */
    getDefaultConfig(protocolType) {
        const protocol = this.getProtocol(protocolType);
        if (!protocol) return {};

        const config = {};
        protocol.params.forEach(param => {
            if (param.default !== undefined) {
                config[param.name] = param.default;
            }
        });

        return config;
    }

    /**
     * Generate configuration template
     * @param {string} protocolType - Protocol type
     * @param {Object} customValues - Custom values to override defaults
     * @returns {Object} Configuration template
     */
    generateTemplate(protocolType, customValues = {}) {
        const defaultConfig = this.getDefaultConfig(protocolType);
        return { ...defaultConfig, ...customValues };
    }

    /**
     * Export test results
     * @param {string} format - Export format (json, csv)
     * @returns {string} Exported data
     */
    exportTestResults(format = 'json') {
        const results = this.getTestResults();
        
        switch (format.toLowerCase()) {
            case 'csv':
                return this.exportToCSV(results);
            case 'json':
            default:
                return JSON.stringify(results, null, 2);
        }
    }

    /**
     * Export results to CSV format
     * @param {Array} results - Test results
     * @returns {string} CSV data
     */
    exportToCSV(results) {
        if (results.length === 0) return '';

        const headers = ['Protocol', 'Test Type', 'Success', 'Duration (ms)', 'Error', 'Timestamp'];
        const rows = results.map(result => [
            result.protocol,
            result.testType,
            result.success,
            result.duration,
            result.error || '',
            result.timestamp
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return csvContent;
    }
}

// Create singleton instance
export const protocolService = new ProtocolService();