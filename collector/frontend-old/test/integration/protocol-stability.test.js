/**
 * 协议连接和数据传输稳定性测试
 */

describe('协议连接稳定性测试', () => {
    let mockProtocolService;
    let connectionAttempts = [];
    let dataTransmissions = [];

    beforeEach(() => {
        connectionAttempts = [];
        dataTransmissions = [];
        
        mockProtocolService = {
            testConnection: async (protocol, config) => {
                const attempt = {
                    protocol,
                    config,
                    timestamp: Date.now(),
                    success: Math.random() > 0.1 // 90% 成功率
                };
                connectionAttempts.push(attempt);
                
                if (!attempt.success) {
                    throw new Error('连接失败');
                }
                
                return {
                    success: true,
                    duration: Math.random() * 2000 + 500, // 500-2500ms
                    data: {
                        serverInfo: {
                            productName: `${protocol} Test Server`,
                            version: '1.0.0'
                        }
                    }
                };
            },
            
            readData: async (protocol, nodeId) => {
                const transmission = {
                    protocol,
                    nodeId,
                    timestamp: Date.now(),
                    success: Math.random() > 0.05 // 95% 成功率
                };
                dataTransmissions.push(transmission);
                
                if (!transmission.success) {
                    throw new Error('数据读取失败');
                }
                
                return {
                    value: Math.random() * 100,
                    quality: 'Good',
                    timestamp: new Date().toISOString()
                };
            }
        };
        
        window.protocolService = mockProtocolService;
    });

    afterEach(() => {
        delete window.protocolService;
    });

    it('应该测试OPC UA连接稳定性', async () => {
        const protocol = 'OPC_UA';
        const config = {
            endpoint: 'opc.tcp://192.168.1.100:4840',
            securityPolicy: 'None'
        };
        
        const testCount = 20;
        const results = [];
        
        // 执行多次连接测试
        for (let i = 0; i < testCount; i++) {
            try {
                const result = await mockProtocolService.testConnection(protocol, config);
                results.push({ success: true, duration: result.duration });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
            
            // 模拟连接间隔
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 分析稳定性
        const successCount = results.filter(r => r.success).length;
        const successRate = successCount / testCount;
        const avgDuration = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.duration, 0) / successCount;
        
        // 稳定性断言
        expect(successRate).toBeGreaterThan(0.8); // 成功率应大于80%
        expect(avgDuration).toBeLessThan(3000); // 平均连接时间应小于3秒
        
        console.log(`OPC UA连接稳定性: 成功率 ${(successRate * 100).toFixed(1)}%, 平均耗时 ${avgDuration.toFixed(0)}ms`);
    });

    it('应该测试Modbus连接稳定性', async () => {
        const protocol = 'MODBUS_TCP';
        const config = {
            host: '192.168.1.100',
            port: 502,
            slaveId: 1
        };
        
        const testCount = 15;
        const connectionTimes = [];
        
        for (let i = 0; i < testCount; i++) {
            const startTime = performance.now();
            
            try {
                await mockProtocolService.testConnection(protocol, config);
                const endTime = performance.now();
                connectionTimes.push(endTime - startTime);
            } catch (error) {
                // 记录失败但继续测试
                console.log(`连接失败 ${i + 1}: ${error.message}`);
            }
        }
        
        // 连接时间稳定性分析
        if (connectionTimes.length > 0) {
            const avgTime = connectionTimes.reduce((sum, t) => sum + t, 0) / connectionTimes.length;
            const maxTime = Math.max(...connectionTimes);
            const minTime = Math.min(...connectionTimes);
            const variance = connectionTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / connectionTimes.length;
            const stdDev = Math.sqrt(variance);
            
            // 时间稳定性断言
            expect(stdDev).toBeLessThan(avgTime * 0.5); // 标准差应小于平均值的50%
            expect(maxTime - minTime).toBeLessThan(2000); // 最大最小差值应小于2秒
            
            console.log(`Modbus连接时间稳定性: 平均 ${avgTime.toFixed(0)}ms, 标准差 ${stdDev.toFixed(0)}ms`);
        }
    });

    it('应该测试数据传输稳定性', async () => {
        const protocols = ['OPC_UA', 'MODBUS_TCP', 'MQTT'];
        const nodeIds = ['ns=2;i=1001', 'HR001', 'sensor/temperature'];
        
        const transmissionResults = [];
        
        // 测试不同协议的数据传输
        for (let i = 0; i < protocols.length; i++) {
            const protocol = protocols[i];
            const nodeId = nodeIds[i];
            
            // 每个协议测试10次数据读取
            for (let j = 0; j < 10; j++) {
                try {
                    const startTime = performance.now();
                    const data = await mockProtocolService.readData(protocol, nodeId);
                    const endTime = performance.now();
                    
                    transmissionResults.push({
                        protocol,
                        success: true,
                        duration: endTime - startTime,
                        quality: data.quality
                    });
                } catch (error) {
                    transmissionResults.push({
                        protocol,
                        success: false,
                        error: error.message
                    });
                }
                
                // 模拟数据采集间隔
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // 分析传输稳定性
        const protocolStats = {};
        protocols.forEach(protocol => {
            const protocolResults = transmissionResults.filter(r => r.protocol === protocol);
            const successCount = protocolResults.filter(r => r.success).length;
            const avgDuration = protocolResults
                .filter(r => r.success)
                .reduce((sum, r) => sum + r.duration, 0) / successCount;
            
            protocolStats[protocol] = {
                successRate: successCount / protocolResults.length,
                avgDuration
            };
        });
        
        // 验证每个协议的稳定性
        Object.entries(protocolStats).forEach(([protocol, stats]) => {
            expect(stats.successRate).toBeGreaterThan(0.9); // 数据传输成功率应大于90%
            expect(stats.avgDuration).toBeLessThan(500); // 数据读取时间应小于500ms
            
            console.log(`${protocol} 数据传输: 成功率 ${(stats.successRate * 100).toFixed(1)}%, 平均耗时 ${stats.avgDuration.toFixed(0)}ms`);
        });
    });

    it('应该测试网络中断恢复能力', async () => {
        let networkAvailable = true;
        let reconnectAttempts = 0;
        
        // Mock网络中断和恢复
        const originalTestConnection = mockProtocolService.testConnection;
        mockProtocolService.testConnection = async (protocol, config) => {
            if (!networkAvailable) {
                reconnectAttempts++;
                throw new Error('网络不可用');
            }
            return originalTestConnection(protocol, config);
        };
        
        const protocol = 'OPC_UA';
        const config = { endpoint: 'opc.tcp://192.168.1.100:4840' };
        
        // 正常连接
        let result = await mockProtocolService.testConnection(protocol, config);
        expect(result.success).toBeTruthy();
        
        // 模拟网络中断
        networkAvailable = false;
        
        // 尝试重连（应该失败）
        for (let i = 0; i < 3; i++) {
            try {
                await mockProtocolService.testConnection(protocol, config);
            } catch (error) {
                expect(error.message).toBe('网络不可用');
            }
        }
        
        // 网络恢复
        networkAvailable = true;
        
        // 重连应该成功
        result = await mockProtocolService.testConnection(protocol, config);
        expect(result.success).toBeTruthy();
        expect(reconnectAttempts).toBe(3);
        
        console.log(`网络中断测试: 重连尝试 ${reconnectAttempts} 次，最终恢复成功`);
    });

    it('应该测试高频数据采集稳定性', async () => {
        const protocol = 'OPC_UA';
        const nodeId = 'ns=2;i=1001';
        const sampleCount = 100;
        const interval = 10; // 10ms间隔，模拟高频采集
        
        const samples = [];
        const startTime = performance.now();
        
        // 高频数据采集
        for (let i = 0; i < sampleCount; i++) {
            try {
                const sampleStart = performance.now();
                const data = await mockProtocolService.readData(protocol, nodeId);
                const sampleEnd = performance.now();
                
                samples.push({
                    index: i,
                    value: data.value,
                    quality: data.quality,
                    duration: sampleEnd - sampleStart,
                    timestamp: sampleEnd
                });
            } catch (error) {
                samples.push({
                    index: i,
                    error: error.message,
                    timestamp: performance.now()
                });
            }
            
            // 控制采集频率
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        const endTime = performance.now();
        const totalDuration = endTime - startTime;
        
        // 分析高频采集性能
        const successSamples = samples.filter(s => !s.error);
        const successRate = successSamples.length / sampleCount;
        const avgSampleTime = successSamples.reduce((sum, s) => sum + s.duration, 0) / successSamples.length;
        const actualFrequency = sampleCount / (totalDuration / 1000); // 实际采集频率 Hz
        
        // 高频采集稳定性断言
        expect(successRate).toBeGreaterThan(0.95); // 高频采集成功率应大于95%
        expect(avgSampleTime).toBeLessThan(100); // 单次采集时间应小于100ms
        expect(actualFrequency).toBeGreaterThan(50); // 实际频率应大于50Hz
        
        console.log(`高频采集测试: 成功率 ${(successRate * 100).toFixed(1)}%, 平均耗时 ${avgSampleTime.toFixed(1)}ms, 频率 ${actualFrequency.toFixed(1)}Hz`);
    });

    it('应该测试并发连接稳定性', async () => {
        const protocols = ['OPC_UA', 'MODBUS_TCP', 'MQTT'];
        const configs = [
            { endpoint: 'opc.tcp://192.168.1.100:4840' },
            { host: '192.168.1.101', port: 502 },
            { broker: '192.168.1.102', port: 1883 }
        ];
        
        const concurrentConnections = 5;
        const connectionPromises = [];
        
        // 创建并发连接
        for (let i = 0; i < concurrentConnections; i++) {
            protocols.forEach((protocol, index) => {
                const promise = mockProtocolService.testConnection(protocol, configs[index])
                    .then(result => ({ protocol, success: true, result }))
                    .catch(error => ({ protocol, success: false, error: error.message }));
                
                connectionPromises.push(promise);
            });
        }
        
        // 等待所有并发连接完成
        const results = await Promise.all(connectionPromises);
        
        // 分析并发连接结果
        const protocolResults = {};
        protocols.forEach(protocol => {
            const protocolConnections = results.filter(r => r.protocol === protocol);
            const successCount = protocolConnections.filter(r => r.success).length;
            
            protocolResults[protocol] = {
                total: protocolConnections.length,
                success: successCount,
                successRate: successCount / protocolConnections.length
            };
        });
        
        // 验证并发连接稳定性
        Object.entries(protocolResults).forEach(([protocol, stats]) => {
            expect(stats.successRate).toBeGreaterThan(0.8); // 并发连接成功率应大于80%
            
            console.log(`${protocol} 并发连接: ${stats.success}/${stats.total} 成功，成功率 ${(stats.successRate * 100).toFixed(1)}%`);
        });
    });
});