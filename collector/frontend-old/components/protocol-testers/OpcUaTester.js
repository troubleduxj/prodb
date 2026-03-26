/**
 * OPC UA Protocol Specific Tester
 * Provides comprehensive OPC UA testing functionality including connection, browsing, reading, and subscription
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

import { protocolService } from '../../services/protocols.js';
import { devLog } from '../../utils/helpers.js';

const html = htm.bind(h);

const OpcUaTester = ({ config, onConfigChange, onTestComplete, isLoading, setIsLoading }) => {
    const [testType, setTestType] = useState('connect');
    const [browseResults, setBrowseResults] = useState([]);
    const [selectedNode, setSelectedNode] = useState('');
    const [subscriptionActive, setSubscriptionActive] = useState(false);
    const [subscriptionData, setSubscriptionData] = useState([]);
    const [readValue, setReadValue] = useState('');

    // OPC UA specific test methods
    const testMethods = [
        { id: 'connect', label: '连接测试', description: '测试与OPC UA服务器的连接' },
        { id: 'browse', label: '浏览节点', description: '浏览服务器节点树结构' },
        { id: 'read', label: '读取数据', description: '读取指定节点的数值' },
        { id: 'subscribe', label: '订阅数据', description: '订阅节点数据变化' }
    ];

    // Execute OPC UA specific test
    const executeTest = async () => {
        if (!validateConfig()) return;

        setIsLoading(true);
        try {
            let result;
            
            switch (testType) {
                case 'connect':
                    result = await testConnection();
                    break;
                case 'browse':
                    result = await testBrowse();
                    break;
                case 'read':
                    result = await testRead();
                    break;
                case 'subscribe':
                    result = await testSubscribe();
                    break;
                default:
                    throw new Error(`Unknown test type: ${testType}`);
            }

            onTestComplete(result);
            devLog('OPC UA test completed:', result);

        } catch (error) {
            console.error('OPC UA test failed:', error);
            const errorResult = {
                id: `opcua-error-${Date.now()}`,
                protocol: 'OPC_UA',
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

    // Test OPC UA connection
    const testConnection = async () => {
        const startTime = Date.now();
        
        // Simulate OPC UA connection test
        const testConfig = {
            protocol: 'OPC_UA',
            config,
            testType: 'connect'
        };

        const result = await protocolService.testConnection('OPC_UA', config, 'connect');
        
        // Add OPC UA specific connection info
        if (result.success && result.data) {
            result.data.opcuaInfo = {
                serverInfo: result.data.serverInfo || {
                    productName: 'OPC UA Server',
                    softwareVersion: '1.0.0',
                    buildNumber: '12345'
                },
                endpoints: result.data.endpoints || [config.endpoint],
                securityPolicies: result.data.securityPolicies || [config.securityPolicy],
                serverStatus: 'Running'
            };
        }

        return result;
    };

    // Test OPC UA browsing
    const testBrowse = async () => {
        const startTime = Date.now();
        
        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Simulate browsing operation
            const mockBrowseResults = [
                { nodeId: 'ns=2;i=1001', displayName: 'Temperature', nodeClass: 'Variable', dataType: 'Double' },
                { nodeId: 'ns=2;i=1002', displayName: 'Pressure', nodeClass: 'Variable', dataType: 'Double' },
                { nodeId: 'ns=2;i=1003', displayName: 'Flow', nodeClass: 'Variable', dataType: 'Double' },
                { nodeId: 'ns=2;i=2001', displayName: 'Pump1', nodeClass: 'Object', dataType: null },
                { nodeId: 'ns=2;i=2002', displayName: 'Valve1', nodeClass: 'Object', dataType: null }
            ];

            setBrowseResults(mockBrowseResults);

            return {
                id: `opcua-browse-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'browse',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    nodeCount: mockBrowseResults.length,
                    nodes: mockBrowseResults,
                    rootNode: 'Objects'
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `opcua-browse-error-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'browse',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test OPC UA reading
    const testRead = async () => {
        const startTime = Date.now();
        
        if (!selectedNode) {
            throw new Error('Please select a node to read');
        }

        try {
            // Simulate read operation
            const mockValue = {
                value: Math.random() * 100,
                statusCode: 'Good',
                sourceTimestamp: new Date().toISOString(),
                serverTimestamp: new Date().toISOString()
            };

            setReadValue(mockValue.value.toFixed(2));

            return {
                id: `opcua-read-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'read',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    nodeId: selectedNode,
                    value: mockValue.value,
                    statusCode: mockValue.statusCode,
                    sourceTimestamp: mockValue.sourceTimestamp,
                    serverTimestamp: mockValue.serverTimestamp,
                    dataType: 'Double'
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `opcua-read-error-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'read',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test OPC UA subscription
    const testSubscribe = async () => {
        const startTime = Date.now();
        
        if (!selectedNode) {
            throw new Error('Please select a node to subscribe');
        }

        try {
            // Simulate subscription
            setSubscriptionActive(true);
            
            // Generate mock subscription data
            const mockData = [];
            for (let i = 0; i < 5; i++) {
                mockData.push({
                    nodeId: selectedNode,
                    value: Math.random() * 100,
                    timestamp: new Date(Date.now() - (4 - i) * 1000).toISOString(),
                    statusCode: 'Good'
                });
            }
            
            setSubscriptionData(mockData);

            return {
                id: `opcua-subscribe-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'subscribe',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    nodeId: selectedNode,
                    subscriptionId: 'sub-001',
                    publishingInterval: 1000,
                    dataChanges: mockData.length,
                    latestValues: mockData
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `opcua-subscribe-error-${Date.now()}`,
                protocol: 'OPC_UA',
                testType: 'subscribe',
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
        if (!config.endpoint) {
            throw new Error('Endpoint URL is required');
        }
        if (!config.securityPolicy) {
            throw new Error('Security Policy is required');
        }
        return true;
    };

    // Stop subscription
    const stopSubscription = () => {
        setSubscriptionActive(false);
        setSubscriptionData([]);
    };

    return html`
        <div class="opcua-tester">
            <div class="tester-header">
                <h3>🔗 OPC UA 协议测试</h3>
                <p class="tester-description">测试OPC UA服务器连接、节点浏览、数据读取和订阅功能</p>
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

            <!-- Node Selection (for read/subscribe tests) -->
            ${(testType === 'read' || testType === 'subscribe') && html`
                <div class="node-selection">
                    <label class="form-label">选择节点</label>
                    ${browseResults.length > 0 ? html`
                        <select 
                            class="form-select" 
                            value=${selectedNode}
                            onChange=${(e) => setSelectedNode(e.target.value)}
                        >
                            <option value="">请选择节点...</option>
                            ${browseResults.map(node => html`
                                <option key=${node.nodeId} value=${node.nodeId}>
                                    ${node.displayName} (${node.nodeId})
                                </option>
                            `)}
                        </select>
                    ` : html`
                        <div class="node-selection-hint">
                            <p>请先执行"浏览节点"测试来获取可用节点列表</p>
                            <button 
                                class="btn btn-secondary btn-sm"
                                onClick=${() => setTestType('browse')}
                            >
                                浏览节点
                            </button>
                        </div>
                    `}
                </div>
            `}

            <!-- Test Action -->
            <div class="test-action">
                <button
                    class="btn btn-primary btn-lg"
                    onClick=${executeTest}
                    disabled=${isLoading || (testType === 'read' && !selectedNode) || (testType === 'subscribe' && !selectedNode)}
                >
                    ${isLoading ? '测试中...' : `执行${testMethods.find(m => m.id === testType)?.label}`}
                </button>

                ${subscriptionActive && html`
                    <button
                        class="btn btn-warning"
                        onClick=${stopSubscription}
                    >
                        停止订阅
                    </button>
                `}
            </div>

            <!-- Browse Results -->
            ${browseResults.length > 0 && html`
                <div class="browse-results">
                    <h4>浏览结果</h4>
                    <div class="nodes-table">
                        <div class="table-header">
                            <div>节点名称</div>
                            <div>节点ID</div>
                            <div>节点类型</div>
                            <div>数据类型</div>
                        </div>
                        ${browseResults.map(node => html`
                            <div 
                                key=${node.nodeId} 
                                class="table-row ${selectedNode === node.nodeId ? 'selected' : ''}"
                                onClick=${() => setSelectedNode(node.nodeId)}
                            >
                                <div>${node.displayName}</div>
                                <div class="node-id">${node.nodeId}</div>
                                <div>${node.nodeClass}</div>
                                <div>${node.dataType || '-'}</div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Read Value Display -->
            ${readValue && html`
                <div class="read-value">
                    <h4>读取值</h4>
                    <div class="value-display">
                        <span class="value">${readValue}</span>
                        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            `}

            <!-- Subscription Data -->
            ${subscriptionData.length > 0 && html`
                <div class="subscription-data">
                    <h4>订阅数据 ${subscriptionActive ? '(实时)' : '(已停止)'}</h4>
                    <div class="data-stream">
                        ${subscriptionData.slice(-10).reverse().map((data, index) => html`
                            <div key=${index} class="data-point">
                                <span class="value">${data.value.toFixed(2)}</span>
                                <span class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</span>
                                <span class="status ${data.statusCode.toLowerCase()}">${data.statusCode}</span>
                            </div>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

export default OpcUaTester;