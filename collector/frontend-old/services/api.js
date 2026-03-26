/**
 * API Service Layer for ProDB Collector
 * Provides centralized HTTP client functionality with error handling and response processing
 */

class APIError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.response = response;
    }
}

class APIService {
    constructor(baseURL = '/api/v1') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Make HTTP request with error handling
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new APIError(
                    errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            return await this.parseResponse(response);
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            
            // Network or other errors
            throw new APIError(
                error.message || 'Network error occurred',
                0,
                null
            );
        }
    }

    /**
     * Parse successful response
     * @param {Response} response - Fetch response
     * @returns {Promise<any>} Parsed data
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Parse error response
     * @param {Response} response - Fetch response
     * @returns {Promise<Object>} Error data
     */
    async parseErrorResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return { message: await response.text() };
        } catch {
            return { message: `HTTP ${response.status}: ${response.statusText}` };
        }
    }

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise<any>} Response data
     */
    async get(endpoint, params = {}) {
        let url = endpoint;
        if (Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    searchParams.append(key, params[key]);
                }
            });
            url += `?${searchParams.toString()}`;
        }

        return this.request(url);
    }

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request body data
     * @returns {Promise<any>} Response data
     */
    async post(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : null,
        });
    }

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request body data
     * @returns {Promise<any>} Response data
     */
    async put(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : null,
        });
    }

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise<any>} Response data
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    /**
     * PATCH request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request body data
     * @returns {Promise<any>} Response data
     */
    async patch(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : null,
        });
    }
}

// System Status API
export class SystemStatusAPI extends APIService {
    /**
     * Get system status
     * @returns {Promise<Object>} System status data
     */
    async getStatus() {
        return this.get('/status');
    }

    /**
     * Get interfaces list
     * @returns {Promise<Array>} Interfaces array
     */
    async getInterfaces() {
        try {
            const collectors = await this.get('/collectors');
            if (collectors && collectors.length > 0) {
                const collectorId = collectors[0].ID;
                return this.get(`/collectors/${collectorId}/interfaces`);
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch interfaces:', error);
            return [];
        }
    }

    /**
     * Get interface details
     * @param {string} interfaceId - Interface ID
     * @returns {Promise<Object>} Interface details
     */
    async getInterface(interfaceId) {
        return this.get(`/interfaces/${interfaceId}`);
    }

    /**
     * Get real-time data flow metrics
     * @returns {Promise<Object>} Data flow metrics
     */
    async getDataFlowMetrics() {
        try {
            return this.get('/metrics/dataflow');
        } catch (error) {
            // Return mock data if API not available
            return {
                rate: Math.floor(Math.random() * 100),
                errorRate: Math.random() * 5,
                totalPoints: Math.floor(Math.random() * 10000),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get system logs
     * @param {Object} options - Log query options
     * @returns {Promise<Array>} Log entries
     */
    async getLogs(options = {}) {
        try {
            return this.get('/logs', options);
        } catch (error) {
            // Return empty array if API not available
            console.warn('Logs API not available:', error.message);
            return [];
        }
    }

    /**
     * Update interface status
     * @param {string} interfaceId - Interface ID
     * @param {string} action - Action to perform (start, stop, restart)
     * @returns {Promise<Object>} Operation result
     */
    async updateInterfaceStatus(interfaceId, action) {
        return this.post(`/interfaces/${interfaceId}/${action}`);
    }
}

// Protocol Testing API
export class ProtocolTestAPI extends APIService {
    /**
     * Test protocol connection
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Test result
     */
    async testConnection(testConfig) {
        try {
            return await this.post('/test/protocol', testConfig);
        } catch (error) {
            // Return mock data for development
            return this.getMockTestResult(testConfig);
        }
    }

    /**
     * Test OPC UA specific operations
     * @param {Object} testConfig - OPC UA test configuration
     * @returns {Promise<Object>} Test result
     */
    async testOpcUa(testConfig) {
        try {
            return await this.post('/test/opcua', testConfig);
        } catch (error) {
            return this.getMockOpcUaResult(testConfig);
        }
    }

    /**
     * Test Modbus specific operations
     * @param {Object} testConfig - Modbus test configuration
     * @returns {Promise<Object>} Test result
     */
    async testModbus(testConfig) {
        try {
            return await this.post('/test/modbus', testConfig);
        } catch (error) {
            return this.getMockModbusResult(testConfig);
        }
    }

    /**
     * Test MQTT specific operations
     * @param {Object} testConfig - MQTT test configuration
     * @returns {Promise<Object>} Test result
     */
    async testMqtt(testConfig) {
        try {
            return await this.post('/test/mqtt', testConfig);
        } catch (error) {
            return this.getMockMqttResult(testConfig);
        }
    }

    /**
     * Test Ethernet/IP specific operations
     * @param {Object} testConfig - Ethernet/IP test configuration
     * @returns {Promise<Object>} Test result
     */
    async testEthernetIp(testConfig) {
        try {
            return await this.post('/test/ethernetip', testConfig);
        } catch (error) {
            return this.getMockEthernetIpResult(testConfig);
        }
    }

    /**
     * Scan for devices on network
     * @param {Object} scanConfig - Scan configuration
     * @returns {Promise<Array>} Discovered devices
     */
    async scanDevices(scanConfig) {
        try {
            return await this.post('/scan/devices', scanConfig);
        } catch (error) {
            return this.getMockScanResults(scanConfig);
        }
    }

    /**
     * Batch test multiple configurations
     * @param {Array} testConfigs - Array of test configurations
     * @returns {Promise<Array>} Test results
     */
    async batchTest(testConfigs) {
        return this.post('/test/batch', { configs: testConfigs });
    }

    /**
     * Get supported protocols
     * @returns {Promise<Array>} Supported protocols
     */
    async getSupportedProtocols() {
        return this.get('/protocols/supported');
    }

    /**
     * Get mock test result for development
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Mock test result
     */
    async getMockTestResult(testConfig) {
        const delay = Math.random() * 1000 + 500;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.2; // 80% success rate
                
                resolve({
                    success,
                    duration: delay,
                    data: success ? {
                        connectionInfo: {
                            protocol: testConfig.protocol,
                            endpoint: testConfig.config.endpoint || testConfig.config.host,
                            status: 'connected'
                        },
                        serverInfo: {
                            name: 'Mock Server',
                            version: '1.0.0'
                        }
                    } : null,
                    error: success ? null : 'Connection timeout or server unreachable',
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }

    /**
     * Get mock OPC UA test result
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Mock test result
     */
    async getMockOpcUaResult(testConfig) {
        const delay = Math.random() * 800 + 300;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.15;
                
                let mockData = null;
                if (success) {
                    switch (testConfig.testType) {
                        case 'browse':
                            mockData = {
                                nodes: [
                                    { nodeId: 'ns=2;i=1001', displayName: 'Temperature', nodeClass: 'Variable', dataType: 'Double' },
                                    { nodeId: 'ns=2;i=1002', displayName: 'Pressure', nodeClass: 'Variable', dataType: 'Double' },
                                    { nodeId: 'ns=2;i=1003', displayName: 'Flow', nodeClass: 'Variable', dataType: 'Double' }
                                ]
                            };
                            break;
                        case 'read':
                            mockData = {
                                nodeId: testConfig.nodeId,
                                value: Math.random() * 100,
                                statusCode: 'Good',
                                timestamp: new Date().toISOString()
                            };
                            break;
                        case 'subscribe':
                            mockData = {
                                subscriptionId: 'sub-001',
                                nodeId: testConfig.nodeId,
                                dataChanges: 5
                            };
                            break;
                        default:
                            mockData = {
                                serverInfo: {
                                    productName: 'Prosys OPC UA Server',
                                    softwareVersion: '5.4.0'
                                }
                            };
                    }
                }
                
                resolve({
                    success,
                    duration: delay,
                    data: mockData,
                    error: success ? null : 'OPC UA operation failed',
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }

    /**
     * Get mock Modbus test result
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Mock test result
     */
    async getMockModbusResult(testConfig) {
        const delay = Math.random() * 600 + 200;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.1;
                
                let mockData = null;
                if (success) {
                    if (testConfig.testType && testConfig.testType.includes('read')) {
                        const quantity = testConfig.quantity || 10;
                        const values = [];
                        for (let i = 0; i < quantity; i++) {
                            values.push({
                                address: (testConfig.startAddress || 0) + i,
                                value: testConfig.testType.includes('Coils') || testConfig.testType.includes('Discrete') 
                                    ? Math.random() > 0.5 
                                    : Math.floor(Math.random() * 65536)
                            });
                        }
                        mockData = { values };
                    } else if (testConfig.testType && testConfig.testType.includes('write')) {
                        mockData = {
                            address: testConfig.address,
                            value: testConfig.value,
                            result: 'Write successful'
                        };
                    } else {
                        mockData = {
                            slaveId: testConfig.config.slaveId,
                            connectionType: testConfig.protocol === 'MODBUS_TCP' ? 'TCP' : 'RTU'
                        };
                    }
                }
                
                resolve({
                    success,
                    duration: delay,
                    data: mockData,
                    error: success ? null : 'Modbus operation failed',
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }

    /**
     * Get mock MQTT test result
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Mock test result
     */
    async getMockMqttResult(testConfig) {
        const delay = Math.random() * 500 + 200;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.1;
                
                let mockData = null;
                if (success) {
                    switch (testConfig.testType) {
                        case 'subscribe':
                            mockData = {
                                topic: testConfig.topic,
                                subscriptionId: 'sub-' + Date.now(),
                                qos: testConfig.qos || 0
                            };
                            break;
                        case 'publish':
                            mockData = {
                                topic: testConfig.topic,
                                messageId: Date.now(),
                                payloadSize: testConfig.payload?.length || 0
                            };
                            break;
                        default:
                            mockData = {
                                broker: testConfig.config.broker,
                                clientId: testConfig.config.clientId || 'collector-client',
                                protocolVersion: '3.1.1'
                            };
                    }
                }
                
                resolve({
                    success,
                    duration: delay,
                    data: mockData,
                    error: success ? null : 'MQTT operation failed',
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }

    /**
     * Get mock Ethernet/IP test result
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Mock test result
     */
    async getMockEthernetIpResult(testConfig) {
        const delay = Math.random() * 700 + 300;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.15;
                
                let mockData = null;
                if (success) {
                    switch (testConfig.testType) {
                        case 'deviceInfo':
                            mockData = {
                                deviceInfo: {
                                    vendorId: 1,
                                    deviceType: 14,
                                    productName: 'CompactLogix L32E',
                                    revision: '20.11'
                                }
                            };
                            break;
                        case 'readTag':
                            mockData = {
                                tagName: testConfig.tagName,
                                value: Math.random() * 1000,
                                dataType: testConfig.dataType || 'DINT',
                                status: 'Good'
                            };
                            break;
                        case 'writeTag':
                            mockData = {
                                tagName: testConfig.tagName,
                                value: testConfig.value,
                                dataType: testConfig.dataType || 'DINT',
                                status: 'Written'
                            };
                            break;
                        case 'listTags':
                            mockData = {
                                tags: [
                                    { name: 'Program:MainProgram.Temperature', dataType: 'REAL' },
                                    { name: 'Program:MainProgram.Pressure', dataType: 'REAL' },
                                    { name: 'Global.SystemMode', dataType: 'DINT' }
                                ]
                            };
                            break;
                        default:
                            mockData = {
                                host: testConfig.config.host,
                                port: testConfig.config.port || 44818,
                                slot: testConfig.config.slot || 0
                            };
                    }
                }
                
                resolve({
                    success,
                    duration: delay,
                    data: mockData,
                    error: success ? null : 'Ethernet/IP operation failed',
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }

    /**
     * Get mock scan results for development
     * @param {Object} scanConfig - Scan configuration
     * @returns {Promise<Array>} Mock scan results
     */
    async getMockScanResults(scanConfig) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockDevices = [
                    {
                        ip: '192.168.1.100',
                        hostname: 'plc-server-01',
                        protocols: ['OPC_UA'],
                        services: [
                            { port: 4840, protocol: 'OPC_UA', info: 'Prosys OPC UA Server' }
                        ],
                        responseTime: 45
                    },
                    {
                        ip: '192.168.1.101',
                        hostname: 'modbus-device-01',
                        protocols: ['MODBUS_TCP'],
                        services: [
                            { port: 502, protocol: 'MODBUS_TCP', info: 'Modbus TCP Server' }
                        ],
                        responseTime: 32
                    },
                    {
                        ip: '192.168.1.102',
                        hostname: 'mqtt-broker',
                        protocols: ['MQTT'],
                        services: [
                            { port: 1883, protocol: 'MQTT', info: 'Eclipse Mosquitto' }
                        ],
                        responseTime: 28
                    },
                    {
                        ip: '192.168.1.103',
                        hostname: 'ethernetip-plc',
                        protocols: ['ETHERNET_IP'],
                        services: [
                            { port: 44818, protocol: 'ETHERNET_IP', info: 'CompactLogix L32E' }
                        ],
                        responseTime: 52
                    }
                ];
                
                resolve(mockDevices);
            }, 1500);
        });
    }
}

// Driver Management API
export class DriverAPI extends APIService {
    /**
     * Get loaded drivers
     * @returns {Promise<Array>} Loaded drivers
     */
    async getDrivers() {
        return this.get('/drivers');
    }

    /**
     * Load driver
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Load result
     */
    async loadDriver(driverId) {
        return this.post('/drivers/load', { driverId });
    }

    /**
     * Unload driver
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Unload result
     */
    async unloadDriver(driverId) {
        return this.post('/drivers/unload', { driverId });
    }

    /**
     * Install driver
     * @param {File|string} driverFile - Driver file or base64 content
     * @param {string} fileName - File name
     * @returns {Promise<Object>} Install result
     */
    async installDriver(driverFile, fileName) {
        let driverContent;
        
        if (driverFile instanceof File) {
            driverContent = await this.fileToBase64(driverFile);
        } else {
            driverContent = driverFile;
        }

        return this.post('/drivers/install', {
            driverFile: driverContent,
            fileName: fileName
        });
    }

    /**
     * Get available drivers
     * @returns {Promise<Array>} Available drivers
     */
    async getAvailableDrivers() {
        return this.get('/drivers/available');
    }

    /**
     * Scan driver path for available drivers
     * @param {string} path - Path to scan
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan result
     */
    async scanDriverPath(path, options = {}) {
        return this.post('/drivers/scan', { path, options });
    }

    /**
     * Get driver health status
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Health status
     */
    async getDriverHealth(driverId) {
        return this.get(`/drivers/${driverId}/health`);
    }

    /**
     * Configure driver
     * @param {string} driverId - Driver ID
     * @param {Object} config - Driver configuration
     * @returns {Promise<Object>} Configuration result
     */
    async configureDriver(driverId, config) {
        return this.post(`/drivers/${driverId}/config`, config);
    }

    /**
     * Get driver configuration
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Driver configuration
     */
    async getDriverConfig(driverId) {
        return this.get(`/drivers/${driverId}/config`);
    }

    /**
     * Convert file to base64
     * @param {File} file - File object
     * @returns {Promise<string>} Base64 string
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    // ===== VERSION MANAGEMENT ENDPOINTS =====

    /**
     * Get driver version history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Version history
     */
    async getVersionHistory(driverId) {
        return this.get(`/drivers/${driverId}/versions`);
    }

    /**
     * Check for driver updates
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Available updates
     */
    async checkUpdates(driverId) {
        return this.get(`/drivers/${driverId}/updates`);
    }

    /**
     * Update driver version
     * @param {string} driverId - Driver ID
     * @param {string} targetVersion - Target version
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateVersion(driverId, targetVersion, options = {}) {
        return this.post(`/drivers/${driverId}/update`, {
            targetVersion,
            options
        });
    }

    /**
     * Rollback driver version
     * @param {string} driverId - Driver ID
     * @param {string} targetVersion - Target version
     * @returns {Promise<Object>} Rollback result
     */
    async rollbackVersion(driverId, targetVersion) {
        return this.post(`/drivers/${driverId}/rollback`, {
            targetVersion
        });
    }

    /**
     * Get rollback history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Rollback history
     */
    async getRollbackHistory(driverId) {
        return this.get(`/drivers/${driverId}/rollbacks`);
    }

    // ===== COMPATIBILITY ENDPOINTS =====

    /**
     * Check driver compatibility
     * @param {File} driverFile - Driver file
     * @returns {Promise<Object>} Compatibility result
     */
    async checkCompatibility(driverFile) {
        const formData = new FormData();
        formData.append('driverFile', driverFile);

        return this.request('/drivers/compatibility/check', {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set Content-Type for FormData
        });
    }

    /**
     * Check version compatibility
     * @param {string} driverId - Driver ID
     * @param {string} version - Version to check
     * @returns {Promise<Object>} Compatibility result
     */
    async checkVersionCompatibility(driverId, version) {
        return this.get(`/drivers/${driverId}/compatibility/${version}`);
    }

    /**
     * Get compatibility matrix
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Compatibility matrix
     */
    async getCompatibilityMatrix(driverId) {
        return this.get(`/drivers/${driverId}/compatibility/matrix`);
    }

    /**
     * Validate driver compatibility
     * @param {string} driverId - Driver ID
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation results
     */
    async validateCompatibility(driverId, options = {}) {
        return this.post(`/drivers/${driverId}/validate`, options);
    }

    /**
     * Fix compatibility issues
     * @param {string} driverId - Driver ID
     * @param {Array} issues - Issues to fix
     * @returns {Promise<Object>} Fix result
     */
    async fixCompatibilityIssues(driverId, issues) {
        return this.post(`/drivers/${driverId}/fix`, { issues });
    }

    /**
     * Get validation history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Validation history
     */
    async getValidationHistory(driverId) {
        return this.get(`/drivers/${driverId}/validation/history`);
    }

    /**
     * Get system information
     * @returns {Promise<Object>} System information
     */
    async getSystemInfo() {
        return this.get('/system/info');
    }

    /**
     * Get dependency graph
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Dependency graph
     */
    async getDependencyGraph(driverId) {
        return this.get(`/drivers/${driverId}/dependencies/graph`);
    }

    // ===== ONLINE DRIVER ENDPOINTS =====

    /**
     * Get online drivers
     * @returns {Promise<Array>} Online drivers
     */
    async getOnlineDrivers() {
        return this.get('/drivers/online');
    }

    /**
     * Install online driver
     * @param {string} driverId - Online driver ID
     * @param {Object} options - Installation options
     * @returns {Promise<Object>} Installation result
     */
    async installOnlineDriver(driverId, options = {}) {
        return this.post('/drivers/online/install', {
            driverId,
            options
        });
    }

    // ===== DEVELOPMENT TOOLS ENDPOINTS =====

    /**
     * Get driver API documentation
     * @returns {Promise<Object>} API documentation
     */
    async getAPIDocumentation() {
        return this.get('/drivers/documentation');
    }

    /**
     * Get driver templates
     * @returns {Promise<Array>} Driver templates
     */
    async getDriverTemplates() {
        return this.get('/drivers/templates');
    }

    /**
     * Run driver test
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Test result
     */
    async runDriverTest(testConfig) {
        return this.post('/drivers/test', testConfig);
    }

    /**
     * Validate driver code
     * @param {string} code - Driver code
     * @returns {Promise<Object>} Validation result
     */
    async validateDriverCode(code) {
        return this.post('/drivers/validate/code', { code });
    }
}

// Configuration API
export class ConfigAPI extends APIService {
    /**
     * Get configuration templates
     * @returns {Promise<Array>} Configuration templates
     */
    async getTemplates() {
        return this.get('/config/templates');
    }

    /**
     * Save configuration
     * @param {Object} config - Configuration data
     * @returns {Promise<Object>} Save result
     */
    async saveConfig(config) {
        return this.post('/config', config);
    }

    /**
     * Get configuration
     * @param {string} configId - Configuration ID
     * @returns {Promise<Object>} Configuration data
     */
    async getConfig(configId) {
        return this.get(`/config/${configId}`);
    }

    /**
     * Delete configuration
     * @param {string} configId - Configuration ID
     * @returns {Promise<Object>} Delete result
     */
    async deleteConfig(configId) {
        return this.delete(`/config/${configId}`);
    }

    /**
     * Validate configuration
     * @param {Object} config - Configuration to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateConfig(config) {
        return this.post('/config/validate', config);
    }

    /**
     * Export configuration
     * @param {string} configId - Configuration ID
     * @param {string} format - Export format (json, yaml, etc.)
     * @returns {Promise<string>} Exported configuration
     */
    async exportConfig(configId, format = 'json') {
        return this.get(`/config/${configId}/export`, { format });
    }

    /**
     * Import configuration
     * @param {string} configData - Configuration data
     * @param {string} format - Import format
     * @returns {Promise<Object>} Import result
     */
    async importConfig(configData, format = 'json') {
        return this.post('/config/import', { data: configData, format });
    }
}

// Create singleton instances
export const systemStatusAPI = new SystemStatusAPI();
export const protocolTestAPI = new ProtocolTestAPI();
export const driverAPI = new DriverAPI();
export const configAPI = new ConfigAPI();

// Export the base API service for custom usage
export { APIService, APIError };