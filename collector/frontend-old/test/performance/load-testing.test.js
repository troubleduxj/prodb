/**
 * 负载测试和并发测试
 */

describe('负载和并发测试', () => {
    let performanceMetrics = [];
    let memoryUsage = [];

    beforeEach(() => {
        performanceMetrics = [];
        memoryUsage = [];
        
        // 开始性能监控
        if (performance.memory) {
            memoryUsage.push({
                timestamp: Date.now(),
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            });
        }
    });

    afterEach(() => {
        // 记录最终内存使用
        if (performance.memory) {
            memoryUsage.push({
                timestamp: Date.now(),
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            });
            
            // 检查内存泄漏
            if (memoryUsage.length >= 2) {
                const initial = memoryUsage[0];
                const final = memoryUsage[memoryUsage.length - 1];
                const memoryIncrease = final.used - initial.used;
                
                console.log(`内存使用变化: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
                
                // 内存增长不应超过50MB
                expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
            }
        }
    });

    function measurePerformance(name, fn) {
        return async (...args) => {
            const startTime = performance.now();
            const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            
            const result = await fn(...args);
            
            const endTime = performance.now();
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            
            performanceMetrics.push({
                name,
                duration: endTime - startTime,
                memoryDelta: endMemory - startMemory,
                timestamp: Date.now()
            });
            
            return result;
        };
    }

    it('应该测试大量接口数据的渲染性能', async () => {
        const { render } = preact;
        const container = test.createTestContainer();
        
        // 生成大量测试数据
        const largeInterfaceList = Array.from({ length: 1000 }, (_, i) => ({
            id: `interface-${i}`,
            name: `接口 ${i}`,
            type: i % 3 === 0 ? 'OPC_UA' : i % 3 === 1 ? 'MODBUS_TCP' : 'MQTT',
            status: i % 4 === 0 ? 'connected' : i % 4 === 1 ? 'disconnected' : 'error',
            dataRate: Math.random() * 100,
            errorRate: Math.random() * 5,
            lastData: new Date().toISOString()
        }));
        
        // Mock API响应
        window.api = {
            get: async (url) => {
                if (url === '/interfaces') {
                    return largeInterfaceList;
                }
                return {};
            }
        };
        
        const renderLargeList = measurePerformance('大量数据渲染', async () => {
            const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
            render(preact.createElement(DashboardPage), container);
            
            await test.waitFor(() => container.querySelector('.interfaces-grid'));
            
            // 验证渲染结果
            const interfaceCards = container.querySelectorAll('.interface-card');
            expect(interfaceCards.length).toBeGreaterThan(0);
        });
        
        await renderLargeList();
        
        // 检查渲染性能
        const renderMetric = performanceMetrics.find(m => m.name === '大量数据渲染');
        expect(renderMetric.duration).toBeLessThan(5000); // 应在5秒内完成
        
        console.log(`大量数据渲染性能: ${renderMetric.duration.toFixed(2)}ms`);
        
        test.cleanupTestContainer();
        delete window.api;
    });

    it('应该测试虚拟滚动性能', async () => {
        const container = test.createTestContainer();
        
        // 创建虚拟滚动列表
        const VirtualScrollList = (await import('../../components/VirtualScrollList.js')).default;
        
        const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `项目 ${i}`,
            value: Math.random() * 1000
        }));
        
        const renderVirtualList = measurePerformance('虚拟滚动渲染', async () => {
            const { render } = preact;
            
            render(preact.createElement(VirtualScrollList, {
                items: largeDataSet,
                itemHeight: 50,
                containerHeight: 400,
                renderItem: (item) => preact.createElement('div', { key: item.id }, item.name)
            }), container);
            
            await test.waitFor(() => container.querySelector('.virtual-scroll-container'));
        });
        
        await renderVirtualList();
        
        // 测试滚动性能
        const scrollContainer = container.querySelector('.virtual-scroll-container');
        const scrollPerformance = measurePerformance('虚拟滚动', async () => {
            // 模拟快速滚动
            for (let i = 0; i < 100; i++) {
                scrollContainer.scrollTop = i * 50;
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        });
        
        await scrollPerformance();
        
        // 验证虚拟滚动性能
        const scrollMetric = performanceMetrics.find(m => m.name === '虚拟滚动');
        expect(scrollMetric.duration).toBeLessThan(2000); // 滚动应该流畅
        
        console.log(`虚拟滚动性能: ${scrollMetric.duration.toFixed(2)}ms`);
        
        test.cleanupTestContainer();
    });

    it('应该测试并发API请求性能', async () => {
        let requestCount = 0;
        const requestTimes = [];
        
        // Mock API with performance tracking
        window.api = {
            get: async (url) => {
                const startTime = performance.now();
                requestCount++;
                
                // 模拟网络延迟
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
                
                const endTime = performance.now();
                requestTimes.push(endTime - startTime);
                
                return {
                    id: `response-${requestCount}`,
                    data: `test data ${requestCount}`,
                    timestamp: new Date().toISOString()
                };
            }
        };
        
        const concurrentRequests = measurePerformance('并发API请求', async () => {
            const concurrency = 20;
            const requestsPerBatch = 5;
            
            const promises = [];
            
            // 创建并发请求
            for (let i = 0; i < concurrency; i++) {
                for (let j = 0; j < requestsPerBatch; j++) {
                    promises.push(window.api.get(`/test/${i}-${j}`));
                }
            }
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(concurrency * requestsPerBatch);
            
            return results;
        });
        
        const results = await concurrentRequests();
        
        // 分析并发性能
        const concurrentMetric = performanceMetrics.find(m => m.name === '并发API请求');
        const avgRequestTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
        const maxRequestTime = Math.max(...requestTimes);
        
        expect(concurrentMetric.duration).toBeLessThan(10000); // 总时间应在10秒内
        expect(avgRequestTime).toBeLessThan(500); // 平均请求时间应小于500ms
        expect(results.length).toBe(100); // 所有请求都应成功
        
        console.log(`并发API测试: 总时间 ${concurrentMetric.duration.toFixed(2)}ms, 平均请求时间 ${avgRequestTime.toFixed(2)}ms`);
        
        delete window.api;
    });

    it('应该测试状态更新频率性能', async () => {
        const container = test.createTestContainer();
        const { render } = preact;
        
        let updateCount = 0;
        const updateTimes = [];
        
        // Mock实时状态更新
        const RealTimeMonitor = (await import('../../components/RealTimeMonitor.js')).default;
        
        const statusUpdateTest = measurePerformance('状态更新', async () => {
            render(preact.createElement(RealTimeMonitor, {
                refreshInterval: 100, // 100ms更新间隔
                onUpdate: () => {
                    updateCount++;
                    updateTimes.push(performance.now());
                }
            }), container);
            
            // 运行10秒的状态更新
            await new Promise(resolve => setTimeout(resolve, 10000));
        });
        
        await statusUpdateTest();
        
        // 分析更新性能
        const expectedUpdates = 100; // 10秒 / 100ms = 100次更新
        const actualUpdateRate = updateCount / 10; // 每秒更新次数
        
        expect(updateCount).toBeGreaterThan(expectedUpdates * 0.8); // 至少80%的更新
        expect(actualUpdateRate).toBeGreaterThan(8); // 每秒至少8次更新
        
        // 检查更新间隔稳定性
        if (updateTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < updateTimes.length; i++) {
                intervals.push(updateTimes[i] - updateTimes[i - 1]);
            }
            
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const intervalVariance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
            
            expect(avgInterval).toBeLessThan(150); // 平均间隔应接近100ms
            expect(intervalVariance).toBeLessThan(1000); // 间隔变化应该稳定
            
            console.log(`状态更新性能: ${updateCount}次更新, 平均间隔 ${avgInterval.toFixed(2)}ms`);
        }
        
        test.cleanupTestContainer();
    });

    it('应该测试内存使用和垃圾回收', async () => {
        if (!performance.memory) {
            console.log('浏览器不支持内存监控，跳过内存测试');
            return;
        }
        
        const container = test.createTestContainer();
        const { render } = preact;
        
        const initialMemory = performance.memory.usedJSHeapSize;
        const memorySnapshots = [initialMemory];
        
        const memoryStressTest = measurePerformance('内存压力测试', async () => {
            // 创建和销毁大量组件
            for (let cycle = 0; cycle < 10; cycle++) {
                // 创建大量组件
                const components = [];
                for (let i = 0; i < 100; i++) {
                    const StatusIndicator = (await import('../../components/StatusIndicator.js')).default;
                    components.push(preact.createElement(StatusIndicator, {
                        key: `${cycle}-${i}`,
                        value: `status-${i}`,
                        type: 'status'
                    }));
                }
                
                // 渲染组件
                render(preact.createElement('div', null, ...components), container);
                
                // 记录内存使用
                memorySnapshots.push(performance.memory.usedJSHeapSize);
                
                // 清空容器（模拟组件销毁）
                container.innerHTML = '';
                
                // 强制垃圾回收（如果支持）
                if (window.gc) {
                    window.gc();
                }
                
                // 等待一段时间
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 再次记录内存
                memorySnapshots.push(performance.memory.usedJSHeapSize);
            }
        });
        
        await memoryStressTest();
        
        const finalMemory = performance.memory.usedJSHeapSize;
        const memoryIncrease = finalMemory - initialMemory;
        const maxMemory = Math.max(...memorySnapshots);
        
        // 内存使用分析
        expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // 内存增长应小于20MB
        expect(maxMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // 峰值内存应小于50MB
        
        console.log(`内存测试: 初始 ${(initialMemory / 1024 / 1024).toFixed(2)}MB, 最终 ${(finalMemory / 1024 / 1024).toFixed(2)}MB, 增长 ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        
        test.cleanupTestContainer();
    });

    it('应该测试长时间运行稳定性', async () => {
        const container = test.createTestContainer();
        const { render } = preact;
        
        let errorCount = 0;
        let operationCount = 0;
        const performanceLog = [];
        
        // 模拟长时间运行的应用
        const longRunningTest = measurePerformance('长时间运行', async () => {
            const DashboardPage = (await import('../../pages/DashboardPage.js')).default;
            
            // Mock API with occasional errors
            window.api = {
                get: async (url) => {
                    operationCount++;
                    
                    // 5%的错误率
                    if (Math.random() < 0.05) {
                        errorCount++;
                        throw new Error('模拟网络错误');
                    }
                    
                    return {
                        id: 'test',
                        status: 'running',
                        interfaces: []
                    };
                }
            };
            
            render(preact.createElement(DashboardPage), container);
            
            // 运行30秒，每秒记录性能
            for (let second = 0; second < 30; second++) {
                const startTime = performance.now();
                
                // 模拟用户操作
                const buttons = container.querySelectorAll('button');
                if (buttons.length > 0) {
                    const randomButton = buttons[Math.floor(Math.random() * buttons.length)];
                    test.simulateClick(randomButton);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const endTime = performance.now();
                performanceLog.push({
                    second,
                    operationTime: endTime - startTime,
                    memoryUsed: performance.memory ? performance.memory.usedJSHeapSize : 0
                });
            }
        });
        
        await longRunningTest();
        
        // 分析长时间运行稳定性
        const avgOperationTime = performanceLog.reduce((sum, log) => sum + log.operationTime, 0) / performanceLog.length;
        const errorRate = errorCount / operationCount;
        
        expect(errorRate).toBeLessThan(0.1); // 错误率应小于10%
        expect(avgOperationTime).toBeLessThan(1100); // 平均操作时间应接近1秒
        
        // 检查性能是否随时间退化
        const firstHalf = performanceLog.slice(0, 15);
        const secondHalf = performanceLog.slice(15);
        
        const firstHalfAvg = firstHalf.reduce((sum, log) => sum + log.operationTime, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, log) => sum + log.operationTime, 0) / secondHalf.length;
        
        const performanceDegradation = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        expect(performanceDegradation).toBeLessThan(0.2); // 性能退化应小于20%
        
        console.log(`长时间运行测试: 操作 ${operationCount}次, 错误 ${errorCount}次, 平均操作时间 ${avgOperationTime.toFixed(2)}ms`);
        
        test.cleanupTestContainer();
        delete window.api;
    });
});