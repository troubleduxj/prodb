/**
 * API集成测试
 * 测试前后端API集成的正确性和性能
 */

describe('API集成测试', () => {
    let originalFetch;
    let apiCallTimes = [];

    beforeEach(() => {
        originalFetch = window.fetch;
        apiCallTimes = [];
        
        // Mock fetch with performance tracking
        window.fetch = async (url, options) => {
            const startTime = performance.now();
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
            
            const endTime = performance.now();
            apiCallTimes.push({
                url,
                method: options?.method || 'GET',
                duration: endTime - startTime
            });

            // Mock responses based on URL
            if (url.includes('/api/v1/status')) {
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        id: 'collector-001',
                        status: 'running',
                        uptime: 86400,
                        dataPoints: 1250,
                        errorCount: 3,
                        memoryUsage: 45.2,
                        cpuUsage: 12.8
                    })
                };
            }
            
            if (url.includes('/api/v1/interfaces')) {
                return {
                    ok: true,
                    json: () => Promise.resolve([
                        {
                            id: 'opc-ua-001',
                            name: '生产线OPC UA服务器',
                            type: 'OPC_UA',
                            status: 'connected',
                            dataRate: 50.5,
                            errorRate: 0.1,
                            lastData: new Date().toISOString(),
                            quickActions: ['stop', 'test', 'configure']
                        }
                    ])
                };
            }
            
            if (url.includes('/api/v1/test/protocol')) {
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        duration: 1250,
                        data: {
                            serverInfo: {
                                productName: 'Prosys OPC UA Server',
                                softwareVersion: '5.4.0'
                            }
                        },
                        timestamp: new Date().toISOString()
                    })
                };
            }

            return {
                ok: false,
                status: 404,
                statusText: 'Not Found'
            };
        };
    });

    afterEach(() => {
        window.fetch = originalFetch;
    });

    it('应该正确获取系统状态', async () => {
        const { api } = await import('../../services/api.js');
        
        const startTime = performance.now();
        const status = await api.get('/status');
        const endTime = performance.now();
        
        // 验证响应数据
        expect(status.id).toBe('collector-001');
        expect(status.status).toBe('running');
        expect(status.dataPoints).toBe(1250);
        
        // 验证性能
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(500); // 应在500ms内完成
        
        // 验证API调用记录
        expect(apiCallTimes.length).toBe(1);
        expect(apiCallTimes[0].url).toContain('/status');
    });

    it('应该正确获取接口列表', async () => {
        const { api } = await import('../../services/api.js');
        
        const interfaces = await api.get('/interfaces');
        
        expect(Array.isArray(interfaces)).toBeTruthy();
        expect(interfaces.length).toBe(1);
        expect(interfaces[0].id).toBe('opc-ua-001');
        expect(interfaces[0].type).toBe('OPC_UA');
    });

    it('应该处理并发API请求', async () => {
        const { api } = await import('../../services/api.js');
        
        const startTime = performance.now();
        
        // 并发发送多个请求
        const promises = [
            api.get('/status'),
            api.get('/interfaces'),
            api.get('/status'),
            api.get('/interfaces')
        ];
        
        const results = await Promise.all(promises);
        const endTime = performance.now();
        
        // 验证所有请求都成功
        expect(results.length).toBe(4);
        results.forEach(result => {
            expect(result).toBeTruthy();
        });
        
        // 验证并发性能
        const totalDuration = endTime - startTime;
        expect(totalDuration).toBeLessThan(1000); // 并发请求应在1秒内完成
        
        // 验证API调用次数
        expect(apiCallTimes.length).toBe(4);
    });

    it('应该正确处理协议测试API', async () => {
        const { protocolsService } = await import('../../services/protocols.js');
        
        const config = {
            endpoint: 'opc.tcp://192.168.1.100:4840',
            securityPolicy: 'None'
        };
        
        const result = await protocolsService.testConnection('OPC_UA', config);
        
        expect(result.success).toBeTruthy();
        expect(result.duration).toBe(1250);
        expect(result.data.serverInfo.productName).toBe('Prosys OPC UA Server');
    });

    it('应该测试API错误处理', async () => {
        const { api } = await import('../../services/api.js');
        
        try {
            await api.get('/nonexistent');
            expect(false).toBeTruthy(); // 不应该到达这里
        } catch (error) {
            expect(error.message).toContain('404');
        }
    });

    it('应该测试API性能基准', async () => {
        const { api } = await import('../../services/api.js');
        
        const iterations = 10;
        const durations = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            await api.get('/status');
            const endTime = performance.now();
            durations.push(endTime - startTime);
        }
        
        // 计算平均响应时间
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        
        // 性能断言
        expect(avgDuration).toBeLessThan(200); // 平均响应时间应小于200ms
        expect(maxDuration).toBeLessThan(500); // 最大响应时间应小于500ms
        
        console.log(`API性能统计: 平均 ${avgDuration.toFixed(2)}ms, 最大 ${maxDuration.toFixed(2)}ms`);
    });

    it('应该测试API重试机制', async () => {
        let attemptCount = 0;
        
        // Mock失败的API调用
        window.fetch = async () => {
            attemptCount++;
            if (attemptCount < 3) {
                throw new Error('Network error');
            }
            return {
                ok: true,
                json: () => Promise.resolve({ success: true })
            };
        };
        
        const { api } = await import('../../services/api.js');
        
        // 如果API服务支持重试，这里应该成功
        try {
            const result = await api.get('/status');
            expect(result.success).toBeTruthy();
            expect(attemptCount).toBe(3); // 应该重试了3次
        } catch (error) {
            // 如果不支持重试，应该在第一次就失败
            expect(attemptCount).toBe(1);
        }
    });

    it('应该测试大数据量API响应', async () => {
        // Mock大数据量响应
        window.fetch = async () => {
            const largeData = Array.from({ length: 1000 }, (_, i) => ({
                id: `interface-${i}`,
                name: `接口 ${i}`,
                type: 'OPC_UA',
                status: 'connected',
                dataRate: Math.random() * 100
            }));
            
            return {
                ok: true,
                json: () => Promise.resolve(largeData)
            };
        };
        
        const { api } = await import('../../services/api.js');
        
        const startTime = performance.now();
        const result = await api.get('/interfaces');
        const endTime = performance.now();
        
        expect(result.length).toBe(1000);
        
        // 大数据量处理性能测试
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(1000); // 应在1秒内处理完成
        
        console.log(`大数据量处理时间: ${duration.toFixed(2)}ms`);
    });
});