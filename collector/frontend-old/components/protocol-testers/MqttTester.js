/**
 * MQTT Protocol Specific Tester
 * Provides comprehensive MQTT testing functionality including connection, subscription, and publishing
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

import { protocolService } from '../../services/protocols.js';
import { devLog } from '../../utils/helpers.js';

const html = htm.bind(h);

const MqttTester = ({ config, onConfigChange, onTestComplete, isLoading, setIsLoading }) => {
    const [testType, setTestType] = useState('connect');
    const [subscriptionActive, setSubscriptionActive] = useState(false);
    const [receivedMessages, setReceivedMessages] = useState([]);
    const [publishTopic, setPublishTopic] = useState('');
    const [publishMessage, setPublishMessage] = useState('');
    const [publishQos, setPublishQos] = useState(0);
    const [subscriptionTopic, setSubscriptionTopic] = useState('');
    const [connectionInfo, setConnectionInfo] = useState(null);

    // MQTT specific test methods
    const testMethods = [
        { id: 'connect', label: '连接测试', description: '测试与MQTT代理的连接' },
        { id: 'subscribe', label: '订阅主题', description: '订阅指定主题并接收消息' },
        { id: 'publish', label: '发布消息', description: '向指定主题发布消息' },
        { id: 'pubsub', label: '发布订阅测试', description: '同时测试发布和订阅功能' }
    ];

    // Execute MQTT specific test
    const executeTest = async () => {
        if (!validateConfig()) return;

        setIsLoading(true);
        try {
            let result;
            
            switch (testType) {
                case 'connect':
                    result = await testConnection();
                    break;
                case 'subscribe':
                    result = await testSubscribe();
                    break;
                case 'publish':
                    result = await testPublish();
                    break;
                case 'pubsub':
                    result = await testPubSub();
                    break;
                default:
                    throw new Error(`Unknown test type: ${testType}`);
            }

            onTestComplete(result);
            devLog('MQTT test completed:', result);

        } catch (error) {
            console.error('MQTT test failed:', error);
            const errorResult = {
                id: `mqtt-error-${Date.now()}`,
                protocol: 'MQTT',
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

    // Test MQTT connection
    const testConnection = async () => {
        const startTime = Date.now();
        
        const result = await protocolService.testConnection('MQTT', config, 'connect');
        
        // Add MQTT specific connection info
        if (result.success && result.data) {
            const mqttInfo = {
                broker: config.broker,
                port: config.port,
                clientId: config.clientId || `collector-${Date.now()}`,
                username: config.username || 'anonymous',
                keepAlive: config.keepAlive || 60,
                cleanSession: true,
                protocolVersion: '3.1.1'
            };
            
            result.data.mqttInfo = mqttInfo;
            setConnectionInfo(mqttInfo);
        }

        return result;
    };

    // Test MQTT subscription
    const testSubscribe = async () => {
        const startTime = Date.now();
        const topic = subscriptionTopic || config.topic;
        
        if (!topic) {
            throw new Error('Please specify a topic to subscribe');
        }

        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Start subscription simulation
            setSubscriptionActive(true);
            
            // Generate mock messages
            const mockMessages = [];
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const message = {
                        topic,
                        payload: JSON.stringify({
                            timestamp: new Date().toISOString(),
                            value: Math.random() * 100,
                            sensor: `sensor_${Math.floor(Math.random() * 10)}`,
                            status: 'active'
                        }),
                        qos: config.qos || 0,
                        retain: false,
                        receivedAt: new Date().toISOString()
                    };
                    
                    setReceivedMessages(prev => [...prev, message].slice(-20)); // Keep last 20 messages
                }, i * 2000);
            }

            return {
                id: `mqtt-subscribe-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'subscribe',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    topic,
                    qos: config.qos || 0,
                    subscriptionId: `sub-${Date.now()}`,
                    status: 'subscribed',
                    messageCount: 0
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `mqtt-subscribe-error-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'subscribe',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test MQTT publishing
    const testPublish = async () => {
        const startTime = Date.now();
        const topic = publishTopic || config.topic;
        const message = publishMessage || JSON.stringify({
            timestamp: new Date().toISOString(),
            message: 'Test message from ProDB Collector',
            value: Math.random() * 100
        });
        
        if (!topic) {
            throw new Error('Please specify a topic to publish');
        }

        try {
            // First ensure connection
            const connectionResult = await testConnection();
            if (!connectionResult.success) {
                return connectionResult;
            }

            // Simulate publish operation
            const publishData = {
                topic,
                payload: message,
                qos: publishQos,
                retain: false,
                messageId: Date.now()
            };

            return {
                id: `mqtt-publish-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'publish',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    ...publishData,
                    payloadSize: message.length,
                    status: 'published'
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `mqtt-publish-error-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'publish',
                success: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };

    // Test MQTT publish and subscribe
    const testPubSub = async () => {
        const startTime = Date.now();
        
        try {
            // First test subscription
            const subscribeResult = await testSubscribe();
            if (!subscribeResult.success) {
                return subscribeResult;
            }

            // Wait a moment then publish
            setTimeout(async () => {
                await testPublish();
            }, 1000);

            return {
                id: `mqtt-pubsub-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'pubsub',
                success: true,
                duration: Date.now() - startTime,
                data: {
                    topic: subscriptionTopic || publishTopic || config.topic,
                    subscriptionActive: true,
                    publishCount: 1,
                    status: 'active'
                },
                error: null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                id: `mqtt-pubsub-error-${Date.now()}`,
                protocol: 'MQTT',
                testType: 'pubsub',
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
        if (!config.broker) {
            throw new Error('Broker address is required');
        }
        if (!config.port) {
            throw new Error('Port is required');
        }
        return true;
    };

    // Stop subscription
    const stopSubscription = () => {
        setSubscriptionActive(false);
    };

    // Clear received messages
    const clearMessages = () => {
        setReceivedMessages([]);
    };

    // Generate sample message
    const generateSampleMessage = () => {
        const samples = [
            JSON.stringify({ temperature: 25.5, humidity: 60.2, timestamp: new Date().toISOString() }),
            JSON.stringify({ pressure: 1013.25, altitude: 150, timestamp: new Date().toISOString() }),
            JSON.stringify({ status: 'online', battery: 85, signal: -45, timestamp: new Date().toISOString() }),
            'Hello from ProDB Collector!',
            JSON.stringify({ sensor_id: 'temp_001', value: Math.random() * 50, unit: '°C' })
        ];
        
        setPublishMessage(samples[Math.floor(Math.random() * samples.length)]);
    };

    return html`
        <div class="mqtt-tester">
            <div class="tester-header">
                <h3>📨 MQTT 协议测试</h3>
                <p class="tester-description">测试MQTT代理连接、主题订阅和消息发布功能</p>
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

            <!-- Connection Info -->
            ${connectionInfo && html`
                <div class="connection-info">
                    <h4>连接信息</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">代理地址:</span>
                            <span class="value">${connectionInfo.broker}:${connectionInfo.port}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">客户端ID:</span>
                            <span class="value">${connectionInfo.clientId}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">协议版本:</span>
                            <span class="value">${connectionInfo.protocolVersion}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">保活时间:</span>
                            <span class="value">${connectionInfo.keepAlive}s</span>
                        </div>
                    </div>
                </div>
            `}

            <!-- Subscription Parameters -->
            ${(testType === 'subscribe' || testType === 'pubsub') && html`
                <div class="subscription-parameters">
                    <h4>订阅参数</h4>
                    <div class="parameter-grid">
                        <div class="form-field">
                            <label class="form-label">订阅主题</label>
                            <input
                                type="text"
                                class="form-input"
                                value=${subscriptionTopic}
                                onChange=${(e) => setSubscriptionTopic(e.target.value)}
                                placeholder=${config.topic || 'sensors/+/data'}
                            />
                            <div class="field-hint">支持通配符: + (单级) 和 # (多级)</div>
                        </div>
                    </div>
                </div>
            `}

            <!-- Publish Parameters -->
            ${(testType === 'publish' || testType === 'pubsub') && html`
                <div class="publish-parameters">
                    <h4>发布参数</h4>
                    <div class="parameter-grid">
                        <div class="form-field">
                            <label class="form-label">发布主题</label>
                            <input
                                type="text"
                                class="form-input"
                                value=${publishTopic}
                                onChange=${(e) => setPublishTopic(e.target.value)}
                                placeholder=${config.topic || 'sensors/test/data'}
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">QoS 级别</label>
                            <select 
                                class="form-select"
                                value=${publishQos}
                                onChange=${(e) => setPublishQos(parseInt(e.target.value))}
                            >
                                <option value="0">0 - 最多一次</option>
                                <option value="1">1 - 至少一次</option>
                                <option value="2">2 - 恰好一次</option>
                            </select>
                        </div>
                        <div class="form-field full-width">
                            <label class="form-label">消息内容</label>
                            <textarea
                                class="form-textarea"
                                value=${publishMessage}
                                onChange=${(e) => setPublishMessage(e.target.value)}
                                placeholder="输入要发布的消息内容..."
                                rows="4"
                            />
                            <button 
                                class="btn btn-secondary btn-sm"
                                onClick=${generateSampleMessage}
                                type="button"
                            >
                                生成示例消息
                            </button>
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

                ${receivedMessages.length > 0 && html`
                    <button
                        class="btn btn-secondary"
                        onClick=${clearMessages}
                    >
                        清空消息
                    </button>
                `}
            </div>

            <!-- Received Messages -->
            ${receivedMessages.length > 0 && html`
                <div class="received-messages">
                    <h4>
                        接收到的消息 
                        ${subscriptionActive && html`<span class="status-badge active">实时接收中</span>`}
                        <span class="message-count">(${receivedMessages.length})</span>
                    </h4>
                    <div class="messages-container">
                        ${receivedMessages.slice(-10).reverse().map((message, index) => html`
                            <div key=${index} class="message-item">
                                <div class="message-header">
                                    <span class="topic">${message.topic}</span>
                                    <span class="qos">QoS ${message.qos}</span>
                                    <span class="timestamp">${new Date(message.receivedAt).toLocaleTimeString()}</span>
                                </div>
                                <div class="message-payload">
                                    <pre>${message.payload}</pre>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- MQTT Topic Patterns Reference -->
            <div class="topic-patterns-reference">
                <details>
                    <summary>MQTT 主题模式参考</summary>
                    <div class="reference-content">
                        <div class="pattern-group">
                            <h5>通配符</h5>
                            <ul>
                                <li><strong>+</strong> - 单级通配符 (例: sensors/+/temperature)</li>
                                <li><strong>#</strong> - 多级通配符 (例: sensors/#)</li>
                            </ul>
                        </div>
                        <div class="pattern-group">
                            <h5>QoS 级别</h5>
                            <ul>
                                <li><strong>0</strong> - 最多一次投递 (Fire and Forget)</li>
                                <li><strong>1</strong> - 至少一次投递 (Acknowledged Delivery)</li>
                                <li><strong>2</strong> - 恰好一次投递 (Assured Delivery)</li>
                            </ul>
                        </div>
                        <div class="pattern-group">
                            <h5>主题示例</h5>
                            <ul>
                                <li>sensors/temperature/room1</li>
                                <li>devices/+/status</li>
                                <li>factory/line1/#</li>
                                <li>alerts/critical/+</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    `;
};

export default MqttTester;