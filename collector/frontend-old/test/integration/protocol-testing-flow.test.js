/**
 * 协议测试流程集成测试
 */

describe('协议测试流程集成测试', () => {
    let container;
    let mockApi;

    beforeEach(() => {
        container = test.createTestContainer();
        mockApi = test.createMock({
            post: (url, data) => {
                if (url === '/test/protocol') {
                    return Promise.resolve({
                        success: true,
                        duration: 1250,
                        data: { 
                            serverInfo: { 
                                productName: 'Test OPC UA Server',
                                softwareVersion: '1.0.0'
                            }
                        }
                    });
                }
                if (url === '/scan/devices') {
                    return Promise.resolve([
                        {
                            ip: '192.168.1.100',
                            hostname: 'plc-001',
                            protocols: ['OPC_UA'],
                            services: [
                                { port: 4840, protocol: 'OPC_UA', info: 'Test Server' }
                            ],
                            responseTime: 45
                        }
                    ]);
                }
            }
        });
        
        window.api = mockApi;
    });

    afterEach(() => {
        test.cleanupTestContainer();
        delete window.api;
    });

    it('应该完成完整的OPC UA测试流程', async () => {
        // 1. 加载测试页面
        const { render } = preact;
        const TestingPage = (await import('../../pages/TestingPage.js')).default;
        
        render(preact.createElement(TestingPage), container);

        // 2. 选择OPC UA协议
        await test.waitFor(() => container.querySelector('select[name="protocol"]'));
        
        const protocolSelect = container.querySelector('select[name="protocol"]');
        protocolSelect.value = 'OPC_UA';
        test.simulateEvent(protocolSelect, 'change');

        // 3. 填写连接配置
        await test.waitFor(() => container.querySelector('input[name="endpoint"]'));
        
        const endpointInput = container.querySelector('input[name="endpoint"]');
        test.simulateInput(endpointInput, 'opc.tcp://192.168.1.100:4840');

        // 4. 执行连接测试
        const testButton = container.querySelector('.test-button');
        test.simulateClick(testButton);

        // 5. 验证API调用
        await test.waitFor(() => mockApi.calls.length > 0);
        
        expect(mockApi.calls[0].method).toBe('post');
        expect(mockApi.calls[0].args[0]).toBe('/test/protocol');
        expect(mockApi.calls[0].args[1].protocol).toBe('OPC_UA');

        // 6. 验证测试结果显示
        await test.waitFor(() => container.querySelector('.test-result.success'));
        
        const result = container.querySelector('.test-result');
        expect(result.classList.contains('success')).toBeTruthy();
        expect(result.textContent).toContain('Test OPC UA Server');
    });

    it('应该完成设备扫描流程', async () => {
        // 1. 加载测试页面
        const { render } = preact;
        const TestingPage = (await import('../../pages/TestingPage.js')).default;
        
        render(preact.createElement(TestingPage), container);

        // 2. 切换到设备扫描模式
        const scanButton = container.querySelector('button[data-mode="scan"]');
        test.simulateClick(scanButton);

        // 3. 配置扫描参数
        await test.waitFor(() => container.querySelector('input[name="ipRange"]'));
        
        const ipRangeInput = container.querySelector('input[name="ipRange"]');
        test.simulateInput(ipRangeInput, '192.168.1.0/24');

        // 4. 执行设备扫描
        const scanStartButton = container.querySelector('.scan-button');
        test.simulateClick(scanStartButton);

        // 5. 验证API调用
        await test.waitFor(() => mockApi.calls.length > 0);
        
        expect(mockApi.calls[0].method).toBe('post');
        expect(mockApi.calls[0].args[0]).toBe('/scan/devices');

        // 6. 验证扫描结果显示
        await test.waitFor(() => container.querySelector('.scan-results'));
        
        const results = container.querySelector('.scan-results');
        expect(results.textContent).toContain('192.168.1.100');
        expect(results.textContent).toContain('plc-001');
    });

    it('应该处理测试错误情况', async () => {
        // 模拟API错误
        mockApi.post = () => Promise.reject(new Error('连接超时'));

        // 1. 加载测试页面
        const { render } = preact;
        const TestingPage = (await import('../../pages/TestingPage.js')).default;
        
        render(preact.createElement(TestingPage), container);

        // 2. 配置并执行测试
        await test.waitFor(() => container.querySelector('input[name="endpoint"]'));
        
        const endpointInput = container.querySelector('input[name="endpoint"]');
        test.simulateInput(endpointInput, 'opc.tcp://192.168.1.100:4840');

        const testButton = container.querySelector('.test-button');
        test.simulateClick(testButton);

        // 3. 验证错误处理
        await test.waitFor(() => container.querySelector('.test-result.error'));
        
        const result = container.querySelector('.test-result');
        expect(result.classList.contains('error')).toBeTruthy();
        expect(result.textContent).toContain('连接超时');
    });

    it('应该支持批量测试流程', async () => {
        // 配置批量测试API响应
        mockApi.post = (url, data) => {
            if (url === '/test/batch') {
                return Promise.resolve({
                    results: [
                        { protocol: 'OPC_UA', success: true, duration: 1200 },
                        { protocol: 'MODBUS_TCP', success: false, error: '连接拒绝' }
                    ]
                });
            }
        };

        // 1. 加载测试页面
        const { render } = preact;
        const TestingPage = (await import('../../pages/TestingPage.js')).default;
        
        render(preact.createElement(TestingPage), container);

        // 2. 切换到批量测试模式
        const batchButton = container.querySelector('button[data-mode="batch"]');
        test.simulateClick(batchButton);

        // 3. 添加测试配置
        await test.waitFor(() => container.querySelector('.batch-tester'));
        
        const addConfigButton = container.querySelector('.add-config-button');
        test.simulateClick(addConfigButton);

        // 4. 执行批量测试
        const batchTestButton = container.querySelector('.batch-test-button');
        test.simulateClick(batchTestButton);

        // 5. 验证批量测试结果
        await test.waitFor(() => container.querySelector('.batch-results'));
        
        const results = container.querySelector('.batch-results');
        expect(results.textContent).toContain('OPC_UA');
        expect(results.textContent).toContain('MODBUS_TCP');
    });
});