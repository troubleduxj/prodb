/**
 * ProtocolTester 组件单元测试
 */

import ProtocolTester from '../../components/ProtocolTester.js';

describe('ProtocolTester 组件', () => {
    let container;
    let mockProtocolsService;

    beforeEach(() => {
        container = test.createTestContainer();
        mockProtocolsService = test.createMock({
            testConnection: () => Promise.resolve({
                success: true,
                duration: 1250,
                data: { serverInfo: { productName: 'Test Server' } }
            }),
            getSupportedProtocols: () => Promise.resolve(['OPC_UA', 'MODBUS_TCP', 'MQTT'])
        });
        
        window.protocolsService = mockProtocolsService;
    });

    afterEach(() => {
        test.cleanupTestContainer();
        delete window.protocolsService;
    });

    it('应该渲染协议选择器', () => {
        const { render } = preact;
        
        render(preact.createElement(ProtocolTester, {
            protocol: 'OPC_UA'
        }), container);

        const protocolSelect = container.querySelector('select[name="protocol"]');
        expect(protocolSelect).toBeTruthy();
    });

    it('应该显示协议特定的配置字段', () => {
        const { render } = preact;
        
        render(preact.createElement(ProtocolTester, {
            protocol: 'OPC_UA'
        }), container);

        const endpointField = container.querySelector('input[name="endpoint"]');
        expect(endpointField).toBeTruthy();
    });

    it('应该执行连接测试', async () => {
        const { render } = preact;
        
        render(preact.createElement(ProtocolTester, {
            protocol: 'OPC_UA'
        }), container);

        const testButton = container.querySelector('.test-button');
        test.simulateClick(testButton);

        await test.waitFor(() => mockProtocolsService.calls.length > 0);
        
        expect(mockProtocolsService.calls[0].method).toBe('testConnection');
    });

    it('应该显示测试结果', async () => {
        const { render } = preact;
        
        render(preact.createElement(ProtocolTester, {
            protocol: 'OPC_UA'
        }), container);

        const testButton = container.querySelector('.test-button');
        test.simulateClick(testButton);

        await test.waitFor(() => container.querySelector('.test-result'));
        
        const result = container.querySelector('.test-result');
        expect(result).toBeTruthy();
        expect(result.classList.contains('success')).toBeTruthy();
    });

    it('应该处理测试错误', async () => {
        mockProtocolsService.testConnection = () => Promise.reject(new Error('连接失败'));
        
        const { render } = preact;
        
        render(preact.createElement(ProtocolTester, {
            protocol: 'OPC_UA'
        }), container);

        const testButton = container.querySelector('.test-button');
        test.simulateClick(testButton);

        await test.waitFor(() => container.querySelector('.test-result.error'));
        
        const result = container.querySelector('.test-result');
        expect(result.classList.contains('error')).toBeTruthy();
    });
});