/**
 * 轻量级测试框架
 * 专为采集器前端设计的简单测试工具
 */

class TestFramework {
    constructor() {
        this.tests = [];
        this.results = [];
        this.currentSuite = null;
    }

    describe(suiteName, callback) {
        this.currentSuite = suiteName;
        console.log(`\n📋 测试套件: ${suiteName}`);
        callback();
        this.currentSuite = null;
    }

    it(testName, callback) {
        const fullName = this.currentSuite ? `${this.currentSuite} - ${testName}` : testName;
        this.tests.push({ name: fullName, callback });
    }

    async runTests() {
        console.log('\n🚀 开始运行测试...\n');
        
        for (const test of this.tests) {
            try {
                await test.callback();
                this.results.push({ name: test.name, status: 'passed' });
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.results.push({ name: test.name, status: 'failed', error });
                console.log(`❌ ${test.name}`);
                console.log(`   错误: ${error.message}`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        
        console.log('\n📊 测试结果汇总:');
        console.log(`✅ 通过: ${passed}`);
        console.log(`❌ 失败: ${failed}`);
        console.log(`📈 总计: ${this.results.length}`);
        
        if (failed > 0) {
            console.log('\n❌ 失败的测试:');
            this.results
                .filter(r => r.status === 'failed')
                .forEach(r => console.log(`   - ${r.name}: ${r.error.message}`));
        }
    }

    // 断言方法
    expect(actual) {
        return {
            toBe: (expected) => {
                if (actual !== expected) {
                    throw new Error(`期望 ${expected}, 但得到 ${actual}`);
                }
            },
            toEqual: (expected) => {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`期望 ${JSON.stringify(expected)}, 但得到 ${JSON.stringify(actual)}`);
                }
            },
            toBeTruthy: () => {
                if (!actual) {
                    throw new Error(`期望真值, 但得到 ${actual}`);
                }
            },
            toBeFalsy: () => {
                if (actual) {
                    throw new Error(`期望假值, 但得到 ${actual}`);
                }
            },
            toContain: (expected) => {
                if (!actual.includes(expected)) {
                    throw new Error(`期望包含 ${expected}, 但在 ${actual} 中未找到`);
                }
            },
            toThrow: () => {
                let threw = false;
                try {
                    actual();
                } catch (e) {
                    threw = true;
                }
                if (!threw) {
                    throw new Error('期望抛出异常, 但没有抛出');
                }
            }
        };
    }

    // Mock 工具
    createMock(methods = {}) {
        const mock = {
            calls: [],
            ...methods
        };

        // 包装所有方法以记录调用
        Object.keys(methods).forEach(key => {
            const original = methods[key];
            mock[key] = (...args) => {
                mock.calls.push({ method: key, args });
                return original(...args);
            };
        });

        return mock;
    }

    // DOM 测试工具
    createTestContainer() {
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        return container;
    }

    cleanupTestContainer() {
        const container = document.getElementById('test-container');
        if (container) {
            container.remove();
        }
    }

    // 异步测试工具
    async waitFor(condition, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await condition()) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`等待条件超时 (${timeout}ms)`);
    }

    // 事件模拟
    simulateEvent(element, eventType, eventData = {}) {
        const event = new Event(eventType, { bubbles: true });
        Object.assign(event, eventData);
        element.dispatchEvent(event);
    }

    simulateClick(element) {
        this.simulateEvent(element, 'click');
    }

    simulateInput(element, value) {
        element.value = value;
        this.simulateEvent(element, 'input');
    }
}

// 全局测试实例
window.TestFramework = TestFramework;
window.test = new TestFramework();

// 导出常用方法到全局
window.describe = (name, callback) => test.describe(name, callback);
window.it = (name, callback) => test.it(name, callback);
window.expect = (actual) => test.expect(actual);