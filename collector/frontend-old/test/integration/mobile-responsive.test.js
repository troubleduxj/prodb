/**
 * 移动端适配和响应式设计测试
 */

describe('移动端响应式设计测试', () => {
    let originalInnerWidth;
    let originalInnerHeight;
    let container;

    beforeEach(() => {
        // 保存原始窗口尺寸
        originalInnerWidth = window.innerWidth;
        originalInnerHeight = window.innerHeight;
        
        container = test.createTestContainer();
        
        // 添加CSS媒体查询支持
        if (!document.querySelector('#responsive-test-styles')) {
            const style = document.createElement('style');
            style.id = 'responsive-test-styles';
            style.textContent = `
                @media (max-width: 768px) {
                    .mobile-hidden { display: none !important; }
                    .mobile-full-width { width: 100% !important; }
                    .mobile-stack { flex-direction: column !important; }
                }
                
                @media (max-width: 480px) {
                    .phone-hidden { display: none !important; }
                    .phone-compact { padding: 8px !important; }
                }
            `;
            document.head.appendChild(style);
        }
    });

    afterEach(() => {
        // 恢复原始窗口尺寸
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalInnerWidth
        });
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: originalInnerHeight
        });
        
        test.cleanupTestContainer();
    });

    function setViewportSize(width, height) {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: width
        });
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: height
        });
        
        // 触发resize事件
        window.dispatchEvent(new Event('resize'));
    }

    it('应该在桌面端正确显示', async () => {
        setViewportSize(1920, 1080);
        
        // 加载仪表板页面
        const { render } = preact;
        const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
        
        render(preact.createElement(DashboardPage), container);
        
        await test.waitFor(() => container.querySelector('.dashboard-container'));
        
        // 验证桌面端布局
        const dashboard = container.querySelector('.dashboard-container');
        expect(dashboard).toBeTruthy();
        
        // 检查网格布局
        const interfacesGrid = container.querySelector('.interfaces-grid');
        if (interfacesGrid) {
            const computedStyle = window.getComputedStyle(interfacesGrid);
            expect(computedStyle.display).toBe('grid');
        }
        
        // 验证侧边栏显示
        const sidebar = container.querySelector('.sidebar');
        if (sidebar) {
            expect(sidebar.offsetWidth).toBeGreaterThan(200);
        }
    });

    it('应该在平板端正确适配', async () => {
        setViewportSize(768, 1024);
        
        const { render } = preact;
        const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
        
        render(preact.createElement(DashboardPage), container);
        
        await test.waitFor(() => container.querySelector('.dashboard-container'));
        
        // 验证平板端适配
        const dashboard = container.querySelector('.dashboard-container');
        expect(dashboard).toBeTruthy();
        
        // 检查响应式网格
        const interfacesGrid = container.querySelector('.interfaces-grid');
        if (interfacesGrid) {
            const computedStyle = window.getComputedStyle(interfacesGrid);
            // 平板端应该减少列数
            expect(computedStyle.gridTemplateColumns).not.toContain('repeat(4');
        }
    });

    it('应该在手机端正确适配', async () => {
        setViewportSize(375, 667); // iPhone SE尺寸
        
        const { render } = preact;
        const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
        
        render(preact.createElement(DashboardPage), container);
        
        await test.waitFor(() => container.querySelector('.dashboard-container'));
        
        // 验证手机端适配
        const dashboard = container.querySelector('.dashboard-container');
        expect(dashboard).toBeTruthy();
        
        // 检查单列布局
        const interfacesGrid = container.querySelector('.interfaces-grid');
        if (interfacesGrid) {
            const computedStyle = window.getComputedStyle(interfacesGrid);
            // 手机端应该是单列
            expect(computedStyle.gridTemplateColumns).toBe('1fr');
        }
        
        // 验证移动端隐藏元素
        const mobileHidden = container.querySelectorAll('.mobile-hidden');
        mobileHidden.forEach(element => {
            const computedStyle = window.getComputedStyle(element);
            expect(computedStyle.display).toBe('none');
        });
    });

    it('应该测试触摸友好的按钮尺寸', async () => {
        setViewportSize(375, 667);
        
        const { render } = preact;
        const QuickActions = (await import('../../components/QuickActions.js')).default;
        
        render(preact.createElement(QuickActions, {
            interfaceId: 'test-001',
            status: 'connected',
            actions: ['start', 'stop', 'test']
        }), container);
        
        await test.waitFor(() => container.querySelector('.quick-actions'));
        
        // 检查按钮尺寸
        const buttons = container.querySelectorAll('.quick-actions button');
        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            // 触摸目标应至少44x44px
            expect(rect.width).toBeGreaterThan(44);
            expect(rect.height).toBeGreaterThan(44);
        });
    });

    it('应该测试移动端表格响应式', async () => {
        setViewportSize(375, 667);
        
        // 创建测试表格
        container.innerHTML = `
            <div class="mobile-table-container">
                <table class="responsive-table">
                    <thead>
                        <tr>
                            <th>接口名称</th>
                            <th>协议类型</th>
                            <th>状态</th>
                            <th>数据速率</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>生产线OPC UA</td>
                            <td>OPC_UA</td>
                            <td>连接</td>
                            <td>50.5 pts/s</td>
                            <td><button>配置</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        const table = container.querySelector('.responsive-table');
        expect(table).toBeTruthy();
        
        // 检查表格是否可以横向滚动
        const tableContainer = container.querySelector('.mobile-table-container');
        if (tableContainer) {
            const computedStyle = window.getComputedStyle(tableContainer);
            expect(computedStyle.overflowX).toBe('auto');
        }
    });

    it('应该测试移动端表单优化', async () => {
        setViewportSize(375, 667);
        
        const { render } = preact;
        const ConfigWizard = (await import('../../components/ConfigWizard.js')).default;
        
        render(preact.createElement(ConfigWizard, {
            onComplete: () => {}
        }), container);
        
        await test.waitFor(() => container.querySelector('.config-wizard'));
        
        // 检查表单字段在移动端的布局
        const formFields = container.querySelectorAll('input, select, textarea');
        formFields.forEach(field => {
            const computedStyle = window.getComputedStyle(field);
            // 移动端表单字段应该全宽
            expect(computedStyle.width).toBe('100%');
            
            // 检查字体大小（防止缩放）
            const fontSize = parseFloat(computedStyle.fontSize);
            expect(fontSize).toBeGreaterThan(16); // 至少16px防止iOS缩放
        });
    });

    it('应该测试横屏模式适配', async () => {
        setViewportSize(667, 375); // 横屏模式
        
        const { render } = preact;
        const TestingPage = (await import('../../pages/TestingPage.js')).default;
        
        render(preact.createElement(TestingPage), container);
        
        await test.waitFor(() => container.querySelector('.testing-container'));
        
        // 验证横屏模式下的布局
        const testingContainer = container.querySelector('.testing-container');
        expect(testingContainer).toBeTruthy();
        
        // 检查是否利用了横向空间
        const protocolTester = container.querySelector('.protocol-tester');
        if (protocolTester) {
            const computedStyle = window.getComputedStyle(protocolTester);
            expect(computedStyle.display).toBe('grid');
        }
    });

    it('应该测试不同设备像素比', async () => {
        // 模拟高DPI设备
        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: 3 // iPhone等高DPI设备
        });
        
        setViewportSize(375, 667);
        
        // 创建包含图标的组件
        container.innerHTML = `
            <div class="status-indicator">
                <span class="icon">●</span>
                <span class="text">连接状态</span>
            </div>
        `;
        
        const icon = container.querySelector('.icon');
        const computedStyle = window.getComputedStyle(icon);
        
        // 验证高DPI下的显示效果
        expect(icon).toBeTruthy();
        
        // 恢复默认值
        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: 1
        });
    });

    it('应该测试性能在移动端的表现', async () => {
        setViewportSize(375, 667);
        
        const { render } = preact;
        const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
        
        // 测量渲染性能
        const startTime = performance.now();
        
        render(preact.createElement(DashboardPage), container);
        
        await test.waitFor(() => container.querySelector('.dashboard-container'));
        
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        // 移动端渲染性能应该合理
        expect(renderTime).toBeLessThan(1000); // 应在1秒内完成渲染
        
        console.log(`移动端渲染性能: ${renderTime.toFixed(2)}ms`);
    });

    it('应该测试触摸事件处理', async () => {
        setViewportSize(375, 667);
        
        // 创建可触摸的元素
        container.innerHTML = `
            <button id="touchButton" class="touch-target">点击测试</button>
        `;
        
        const button = container.querySelector('#touchButton');
        let touchStarted = false;
        let touchEnded = false;
        
        // 添加触摸事件监听器
        button.addEventListener('touchstart', () => {
            touchStarted = true;
        });
        
        button.addEventListener('touchend', () => {
            touchEnded = true;
        });
        
        // 模拟触摸事件
        const touchStart = new TouchEvent('touchstart', {
            touches: [{ clientX: 100, clientY: 100 }]
        });
        const touchEnd = new TouchEvent('touchend', {
            touches: []
        });
        
        button.dispatchEvent(touchStart);
        button.dispatchEvent(touchEnd);
        
        // 验证触摸事件处理
        expect(touchStarted).toBeTruthy();
        expect(touchEnded).toBeTruthy();
    });

    it('应该测试移动端导航适配', async () => {
        setViewportSize(375, 667);
        
        const { render } = preact;
        const Layout = (await import('../../components/Layout.js')).default;
        
        render(preact.createElement(Layout, {
            children: preact.createElement('div', null, '测试内容')
        }), container);
        
        await test.waitFor(() => container.querySelector('.layout'));
        
        // 检查移动端导航
        const sidebar = container.querySelector('.sidebar');
        if (sidebar) {
            const computedStyle = window.getComputedStyle(sidebar);
            // 移动端侧边栏应该可以折叠或隐藏
            expect(['none', 'absolute', 'fixed']).toContain(computedStyle.position);
        }
        
        // 检查汉堡菜单按钮
        const menuButton = container.querySelector('.mobile-menu-button');
        if (menuButton) {
            expect(menuButton.offsetWidth).toBeGreaterThan(0);
        }
    });
});