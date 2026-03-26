/**
 * TestingPage 页面组件测试
 */

import TestingPage from '../../pages/TestingPage.js';

describe('TestingPage 页面', () => {
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
            scanDevices: () => Promise.resolve([
                { ip: '192.168.1.100', protocols: ['OPC_UA'] }
            ])
        });
        
        window.protocolsService = mockProtocolsService;
    });

    afterEach(() => {
        test.cleanupTestContainer();
        delete window.protocolsService;
    });

    it('应该渲染测试模式选择器', () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        const modeSelector = container.querySelector('.test-mode-selector');
        expect(modeSelector).toBeTruthy();
        
        const singleButton = container.querySelector('button[data-mode="single"]');
        const scanButton = container.querySelector('button[data-mode="scan"]');
        const batchButton = container.querySelector('button[data-mode="batch"]');
        
        expect(singleButton).toBeTruthy();
        expect(scanButton).toBeTruthy();
        expect(batchButton).toBeTruthy();
    });

    it('应该默认显示单点测试模式', () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        const singleButton = container.querySelector('button[data-mode="single"]');
        expect(singleButton.classList.contains('active')).toBeTruthy();
        
        const protocolTester = container.querySelector('.protocol-tester');
        expect(protocolTester).toBeTruthy();
    });

    it('应该切换到设备扫描模式', () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        const scanButton = container.querySelector('button[data-mode="scan"]');
        test.simulateClick(scanButton);

        expect(scanButton.classList.contains('active')).toBeTruthy();
        
        const deviceScanner = container.querySelector('.device-scanner');
        expect(deviceScanner).toBeTruthy();
    });

    it('应该切换到批量测试模式', () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        const batchButton = container.querySelector('button[data-mode="batch"]');
        test.simulateClick(batchButton);

        expect(batchButton.classList.contains('active')).toBeTruthy();
        
        const batchTester = container.querySelector('.batch-tester');
        expect(batchTester).toBeTruthy();
    });

    it('应该显示测试结果', async () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        // 模拟测试完成
        const testResult = {
            protocol: 'OPC_UA',
            testType: 'connect',
            success: true,
            duration: 1250,
            data: { serverInfo: { productName: 'Test Server' } }
        };

        // 触发测试结果更新
        const page = container.querySelector('.testing-container');
        page.dispatchEvent(new CustomEvent('testComplete', { detail: testResult }));

        await test.waitFor(() => container.querySelector('.test-results'));
        
        const results = container.querySelector('.test-results');
        expect(results).toBeTruthy();
        expect(results.textContent).toContain('OPC_UA');
        expect(results.textContent).toContain('1250ms');
    });

    it('应该显示成功的测试结果', async () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        // 添加成功的测试结果
        const successResult = {
            protocol: 'OPC_UA',
            testType: 'connect',
            success: true,
            duration: 1250,
            data: { connected: true }
        };

        const page = container.querySelector('.testing-container');
        page.dispatchEvent(new CustomEvent('testComplete', { detail: successResult }));

        await test.waitFor(() => container.querySelector('.result-item.success'));
        
        const resultItem = container.querySelector('.result-item.success');
        expect(resultItem).toBeTruthy();
    });

    it('应该显示失败的测试结果', async () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        // 添加失败的测试结果
        const failureResult = {
            protocol: 'MODBUS_TCP',
            testType: 'connect',
            success: false,
            error: '连接超时'
        };

        const page = container.querySelector('.testing-container');
        page.dispatchEvent(new CustomEvent('testComplete', { detail: failureResult }));

        await test.waitFor(() => container.querySelector('.result-item.error'));
        
        const resultItem = container.querySelector('.result-item.error');
        expect(resultItem).toBeTruthy();
        expect(resultItem.textContent).toContain('连接超时');
    });

    it('应该清空测试结果', () => {
        const { render } = preact;
        
        render(preact.createElement(TestingPage), container);

        // 添加一些测试结果
        const page = container.querySelector('.testing-container');
        page.dispatchEvent(new CustomEvent('testComplete', { 
            detail: { protocol: 'OPC_UA', success: true } 
        }));

        // 清空结果
        const clearButton = container.querySelector('.clear-results-button');
        if (clearButton) {
            test.simulateClick(clearButton);
            
            const results = container.querySelectorAll('.result-item');
            expect(results.length).toBe(0);
        }
    });
});