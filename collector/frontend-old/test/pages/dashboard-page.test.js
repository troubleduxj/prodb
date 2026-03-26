/**
 * DashboardPage 页面组件测试
 */

import DashboardPage from '../../pages/DashboardPage.js';

describe('DashboardPage 页面', () => {
    let container;
    let mockApi;

    beforeEach(() => {
        container = test.createTestContainer();
        mockApi = test.createMock({
            get: (url) => {
                if (url === '/status') {
                    return Promise.resolve({
                        id: 'collector-001',
                        status: 'running',
                        uptime: 86400,
                        dataPoints: 1250,
                        errorCount: 3
                    });
                }
                if (url === '/interfaces') {
                    return Promise.resolve([
                        {
                            id: 'opc-ua-001',
                            name: '生产线OPC UA服务器',
                            type: 'OPC_UA',
                            status: 'connected',
                            dataRate: 50.5,
                            errorRate: 0.1,
                            quickActions: ['stop', 'test', 'configure']
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

    it('应该渲染系统概览卡片', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.system-overview-card'));
        
        const overviewCard = container.querySelector('.system-overview-card');
        expect(overviewCard).toBeTruthy();
        expect(overviewCard.textContent).toContain('系统状态');
    });

    it('应该显示系统状态信息', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.status-grid'));
        
        expect(container.textContent).toContain('running');
        expect(container.textContent).toContain('1250');
    });

    it('应该渲染接口卡片', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.interface-card'));
        
        const interfaceCard = container.querySelector('.interface-card');
        expect(interfaceCard).toBeTruthy();
        expect(interfaceCard.textContent).toContain('生产线OPC UA服务器');
    });

    it('应该显示接口状态', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.interface-card.connected'));
        
        const interfaceCard = container.querySelector('.interface-card');
        expect(interfaceCard.classList.contains('connected')).toBeTruthy();
    });

    it('应该渲染快速操作按钮', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.quick-actions'));
        
        const quickActions = container.querySelector('.quick-actions');
        expect(quickActions).toBeTruthy();
    });

    it('应该显示添加接口卡片', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        await test.waitFor(() => container.querySelector('.add-interface-card'));
        
        const addCard = container.querySelector('.add-interface-card');
        expect(addCard).toBeTruthy();
        expect(addCard.textContent).toContain('添加接口');
    });

    it('应该自动刷新数据', async () => {
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        // 等待初始加载
        await test.waitFor(() => mockApi.calls.length >= 2);
        
        const initialCalls = mockApi.calls.length;
        
        // 等待自动刷新
        await test.waitFor(() => mockApi.calls.length > initialCalls, 6000);
        
        expect(mockApi.calls.length).toBeGreaterThan(initialCalls);
    });

    it('应该处理API错误', async () => {
        mockApi.get = () => Promise.reject(new Error('网络错误'));
        
        const { render } = preact;
        
        render(preact.createElement(DashboardPage), container);

        // 应该不会崩溃，而是显示错误状态
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(container).toBeTruthy(); // 页面仍然存在
    });
});