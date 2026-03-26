/**
 * 配置管理流程集成测试
 */

describe('配置管理流程集成测试', () => {
    let container;
    let mockApi;

    beforeEach(() => {
        container = test.createTestContainer();
        mockApi = test.createMock({
            get: (url) => {
                if (url === '/interfaces') {
                    return Promise.resolve([
                        {
                            id: 'opc-ua-001',
                            name: '生产线OPC UA',
                            type: 'OPC_UA',
                            config: {
                                endpoint: 'opc.tcp://192.168.1.100:4840',
                                securityPolicy: 'None'
                            }
                        }
                    ]);
                }
                if (url === '/config/templates') {
                    return Promise.resolve([
                        {
                            id: 'opcua-basic',
                            name: 'OPC UA 基础模板',
                            protocol: 'OPC_UA',
                            config: {
                                endpoint: 'opc.tcp://localhost:4840',
                                securityPolicy: 'None'
                            }
                        }
                    ]);
                }
            },
            post: (url, data) => {
                if (url === '/interfaces') {
                    return Promise.resolve({
                        id: 'new-interface-001',
                        ...data
                    });
                }
                if (url === '/test/connection') {
                    return Promise.resolve({ success: true });
                }
            },
            put: () => Promise.resolve({ success: true }),
            delete: () => Promise.resolve({ success: true })
        });
        
        window.api = mockApi;
    });

    afterEach(() => {
        test.cleanupTestContainer();
        delete window.api;
    });

    it('应该完成配置向导流程', async () => {
        // 1. 加载配置页面
        const { render } = preact;
        const ConfigPage = (await import('../../pages/ConfigPage.js')).default;
        
        render(preact.createElement(ConfigPage), container);

        // 2. 点击添加新接口
        await test.waitFor(() => container.querySelector('.add-interface-button'));
        
        const addButton = container.querySelector('.add-interface-button');
        test.simulateClick(addButton);

        // 3. 验证配置向导启动
        await test.waitFor(() => container.querySelector('.config-wizard'));
        
        const wizard = container.querySelector('.config-wizard');
        expect(wizard).toBeTruthy();

        // 4. 第一步：选择协议
        const protocolSelect = container.querySelector('select[name="protocol"]');
        protocolSelect.value = 'OPC_UA';
        test.simulateEvent(protocolSelect, 'change');

        const nextButton = container.querySelector('.wizard-navigation .btn-primary');
        test.simulateClick(nextButton);

        // 5. 第二步：基本配置
        await test.waitFor(() => container.querySelector('input[name="name"]'));
        
        const nameInput = container.querySelector('input[name="name"]');
        test.simulateInput(nameInput, '测试OPC UA接口');

        const endpointInput = container.querySelector('input[name="endpoint"]');
        test.simulateInput(endpointInput, 'opc.tcp://192.168.1.100:4840');

        test.simulateClick(nextButton);

        // 6. 跳过高级设置
        test.simulateClick(nextButton);

        // 7. 第四步：测试连接
        await test.waitFor(() => container.querySelector('.connection-test'));
        
        const testButton = container.querySelector('.test-connection-button');
        test.simulateClick(testButton);

        // 验证连接测试API调用
        await test.waitFor(() => mockApi.calls.some(call => call.args[0] === '/test/connection'));

        test.simulateClick(nextButton);

        // 8. 第五步：完成配置
        await test.waitFor(() => container.querySelector('.config-summary'));
        
        const finishButton = container.querySelector('.wizard-navigation .btn-primary');
        test.simulateClick(finishButton);

        // 9. 验证接口创建API调用
        await test.waitFor(() => mockApi.calls.some(call => call.args[0] === '/interfaces'));
        
        const createCall = mockApi.calls.find(call => call.args[0] === '/interfaces' && call.method === 'post');
        expect(createCall).toBeTruthy();
        expect(createCall.args[1].name).toBe('测试OPC UA接口');
    });

    it('应该支持配置模板应用', async () => {
        // 1. 加载配置页面
        const { render } = preact;
        const ConfigPage = (await import('../../pages/ConfigPage.js')).default;
        
        render(preact.createElement(ConfigPage), container);

        // 2. 打开模板选择
        await test.waitFor(() => container.querySelector('.template-button'));
        
        const templateButton = container.querySelector('.template-button');
        test.simulateClick(templateButton);

        // 3. 验证模板加载
        await test.waitFor(() => mockApi.calls.some(call => call.args[0] === '/config/templates'));

        // 4. 选择模板
        await test.waitFor(() => container.querySelector('.template-item'));
        
        const templateItem = container.querySelector('.template-item');
        test.simulateClick(templateItem);

        // 5. 验证模板应用
        const applyButton = container.querySelector('.apply-template-button');
        test.simulateClick(applyButton);

        // 6. 验证配置字段填充
        await test.waitFor(() => container.querySelector('input[name="endpoint"]'));
        
        const endpointInput = container.querySelector('input[name="endpoint"]');
        expect(endpointInput.value).toBe('opc.tcp://localhost:4840');
    });

    it('应该支持批量操作', async () => {
        // 1. 加载配置页面
        const { render } = preact;
        const ConfigPage = (await import('../../pages/ConfigPage.js')).default;
        
        render(preact.createElement(ConfigPage), container);

        // 2. 等待接口列表加载
        await test.waitFor(() => container.querySelector('.interface-list'));

        // 3. 选择多个接口
        const checkboxes = container.querySelectorAll('.interface-checkbox');
        checkboxes.forEach(checkbox => {
            test.simulateClick(checkbox);
        });

        // 4. 打开批量操作菜单
        const batchButton = container.querySelector('.batch-operations-button');
        test.simulateClick(batchButton);

        // 5. 执行批量启动
        const batchStartButton = container.querySelector('.batch-start-button');
        test.simulateClick(batchStartButton);

        // 6. 验证批量操作API调用
        await test.waitFor(() => mockApi.calls.length > 1);
        
        const batchCalls = mockApi.calls.filter(call => call.method === 'put');
        expect(batchCalls.length).toBeGreaterThan(0);
    });

    it('应该支持配置导入导出', async () => {
        // 1. 加载配置页面
        const { render } = preact;
        const ConfigPage = (await import('../../pages/ConfigPage.js')).default;
        
        render(preact.createElement(ConfigPage), container);

        // 2. 测试配置导出
        const exportButton = container.querySelector('.export-config-button');
        test.simulateClick(exportButton);

        // 验证导出功能触发
        await test.waitFor(() => mockApi.calls.some(call => call.args[0] === '/interfaces'));

        // 3. 测试配置导入
        const importButton = container.querySelector('.import-config-button');
        test.simulateClick(importButton);

        // 4. 模拟文件选择
        const fileInput = container.querySelector('input[type="file"]');
        const mockFile = new File(['{"interfaces": []}'], 'config.json', { type: 'application/json' });
        
        Object.defineProperty(fileInput, 'files', {
            value: [mockFile],
            writable: false
        });
        
        test.simulateEvent(fileInput, 'change');

        // 5. 确认导入
        const confirmImportButton = container.querySelector('.confirm-import-button');
        test.simulateClick(confirmImportButton);

        // 验证导入处理
        await test.waitFor(() => container.querySelector('.import-progress'));
    });

    it('应该支持配置备份和恢复', async () => {
        // 1. 加载配置页面
        const { render } = preact;
        const ConfigPage = (await import('../../pages/ConfigPage.js')).default;
        
        render(preact.createElement(ConfigPage), container);

        // 2. 创建配置备份
        const backupButton = container.querySelector('.create-backup-button');
        test.simulateClick(backupButton);

        // 验证备份创建
        await test.waitFor(() => mockApi.calls.some(call => call.args[0].includes('/backup')));

        // 3. 查看备份历史
        const historyButton = container.querySelector('.backup-history-button');
        test.simulateClick(historyButton);

        // 4. 恢复备份
        await test.waitFor(() => container.querySelector('.backup-item'));
        
        const restoreButton = container.querySelector('.restore-backup-button');
        test.simulateClick(restoreButton);

        // 5. 确认恢复操作
        const confirmButton = container.querySelector('.confirm-restore-button');
        test.simulateClick(confirmButton);

        // 验证恢复API调用
        await test.waitFor(() => mockApi.calls.some(call => call.args[0].includes('/restore')));
    });
});