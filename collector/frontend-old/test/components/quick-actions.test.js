/**
 * QuickActions 组件单元测试
 */

import QuickActions from '../../components/QuickActions.js';

describe('QuickActions 组件', () => {
    let container;
    let mockApi;

    beforeEach(() => {
        container = test.createTestContainer();
        mockApi = test.createMock({
            startInterface: () => Promise.resolve({ success: true }),
            stopInterface: () => Promise.resolve({ success: true }),
            testInterface: () => Promise.resolve({ success: true })
        });
        
        // Mock API
        window.api = mockApi;
    });

    afterEach(() => {
        test.cleanupTestContainer();
        delete window.api;
    });

    it('应该渲染启动按钮当接口停止时', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start', 'test', 'configure']
        }), container);

        const startButton = container.querySelector('[data-action="start"]');
        expect(startButton).toBeTruthy();
        expect(startButton.textContent).toContain('启动');
    });

    it('应该渲染停止按钮当接口运行时', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'connected',
            actions: ['stop', 'test', 'configure']
        }), container);

        const stopButton = container.querySelector('[data-action="stop"]');
        expect(stopButton).toBeTruthy();
        expect(stopButton.textContent).toContain('停止');
    });

    it('应该调用启动接口API', async () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start']
        }), container);

        const startButton = container.querySelector('[data-action="start"]');
        test.simulateClick(startButton);

        await test.waitFor(() => mockApi.calls.length > 0);
        
        expect(mockApi.calls[0].method).toBe('startInterface');
        expect(mockApi.calls[0].args[0]).toBe('test-001');
    });

    it('应该调用停止接口API', async () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'connected',
            actions: ['stop']
        }), container);

        const stopButton = container.querySelector('[data-action="stop"]');
        test.simulateClick(stopButton);

        await test.waitFor(() => mockApi.calls.length > 0);
        
        expect(mockApi.calls[0].method).toBe('stopInterface');
        expect(mockApi.calls[0].args[0]).toBe('test-001');
    });

    it('应该调用测试接口API', async () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['test']
        }), container);

        const testButton = container.querySelector('[data-action="test"]');
        test.simulateClick(testButton);

        await test.waitFor(() => mockApi.calls.length > 0);
        
        expect(mockApi.calls[0].method).toBe('testInterface');
        expect(mockApi.calls[0].args[0]).toBe('test-001');
    });

    it('应该禁用按钮在加载状态', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start'],
            loading: true
        }), container);

        const startButton = container.querySelector('[data-action="start"]');
        expect(startButton.disabled).toBeTruthy();
    });

    it('应该显示加载指示器', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start'],
            loading: true
        }), container);

        const loadingIndicator = container.querySelector('.loading');
        expect(loadingIndicator).toBeTruthy();
    });

    it('应该处理错误状态', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'error',
            actions: ['start', 'test']
        }), container);

        const container_element = container.querySelector('.quick-actions');
        expect(container_element.classList.contains('error')).toBeTruthy();
    });

    it('应该只渲染允许的操作', () => {
        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start', 'configure']
        }), container);

        const startButton = container.querySelector('[data-action="start"]');
        const configButton = container.querySelector('[data-action="configure"]');
        const testButton = container.querySelector('[data-action="test"]');
        
        expect(startButton).toBeTruthy();
        expect(configButton).toBeTruthy();
        expect(testButton).toBeFalsy();
    });

    it('应该触发回调函数', async () => {
        let callbackCalled = false;
        const onAction = (action, interfaceId) => {
            callbackCalled = true;
            expect(action).toBe('start');
            expect(interfaceId).toBe('test-001');
        };

        const { render } = preact;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'disconnected',
            actions: ['start'],
            onAction
        }), container);

        const startButton = container.querySelector('[data-action="start"]');
        test.simulateClick(startButton);

        await test.waitFor(() => callbackCalled);
        expect(callbackCalled).toBeTruthy();
    });
});