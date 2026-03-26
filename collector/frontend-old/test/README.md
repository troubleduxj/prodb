# 采集器前端测试文档

## 概述

本目录包含采集器前端的完整测试套件，包括单元测试、组件测试和集成测试。测试框架基于轻量级的自定义测试工具，专为采集器前端的技术栈设计。

## 测试结构

```
test/
├── test-framework.js              # 轻量级测试框架
├── run-tests.html                 # 测试运行器界面
├── README.md                      # 测试文档
├── components/                    # 组件测试
│   ├── status-indicator.test.js   # 状态指示器测试
│   ├── quick-actions.test.js      # 快速操作测试
│   └── protocol-tester.test.js    # 协议测试器测试
├── services/                      # 服务测试
│   ├── api.test.js               # API服务测试
│   └── protocols.test.js         # 协议服务测试
├── utils/                        # 工具函数测试
│   ├── validation.test.js        # 验证工具测试
│   └── helpers.test.js           # 辅助函数测试
├── pages/                        # 页面组件测试
│   ├── dashboard-page.test.js    # 仪表板页面测试
│   └── testing-page.test.js      # 测试页面测试
└── integration/                  # 集成测试
    ├── protocol-testing-flow.test.js    # 协议测试流程
    └── config-management-flow.test.js   # 配置管理流程
```

## 测试框架特性

### 核心功能
- **轻量级设计**: 无需外部依赖，专为采集器前端优化
- **断言支持**: 提供常用的断言方法（toBe, toEqual, toBeTruthy等）
- **Mock工具**: 内置Mock功能，支持API和服务模拟
- **DOM测试**: 提供DOM操作和事件模拟工具
- **异步测试**: 支持Promise和异步操作测试

### 测试工具
- `describe()`: 测试套件组织
- `it()`: 单个测试用例
- `expect()`: 断言验证
- `test.createMock()`: 创建Mock对象
- `test.waitFor()`: 异步等待工具
- `test.simulateEvent()`: 事件模拟

## 运行测试

### 方法1: 浏览器运行
1. 打开 `test/run-tests.html`
2. 点击相应的测试按钮：
   - "运行所有测试": 执行完整测试套件
   - "仅单元测试": 只运行组件和工具测试
   - "仅集成测试": 只运行集成和页面测试

### 方法2: 命令行运行
```bash
# 启动本地服务器
python -m http.server 8080

# 访问测试页面
open http://localhost:8080/test/run-tests.html
```

## 测试覆盖范围

### 组件测试 (Components)
- **StatusIndicator**: 状态指示器组件
  - 不同状态的渲染测试
  - 样式类应用测试
  - 属性传递测试
  
- **QuickActions**: 快速操作组件
  - 按钮渲染测试
  - API调用测试
  - 状态管理测试
  
- **ProtocolTester**: 协议测试器组件
  - 协议选择测试
  - 配置表单测试
  - 测试执行测试

### 服务测试 (Services)
- **API服务**: HTTP请求处理
  - GET/POST请求测试
  - 错误处理测试
  - 请求头设置测试
  
- **协议服务**: 协议相关功能
  - 连接测试功能
  - 设备扫描功能
  - 配置验证功能

### 工具测试 (Utils)
- **验证工具**: 数据验证功能
  - 表单验证测试
  - 协议配置验证测试
  - 自定义验证规则测试
  
- **辅助函数**: 通用工具函数
  - 时间格式化测试
  - 防抖节流测试
  - 对象操作测试

### 页面测试 (Pages)
- **仪表板页面**: 主要界面功能
  - 数据加载测试
  - 状态显示测试
  - 自动刷新测试
  
- **测试页面**: 协议测试界面
  - 模式切换测试
  - 测试执行测试
  - 结果显示测试

### 集成测试 (Integration)
- **协议测试流程**: 端到端协议测试
  - 完整测试流程验证
  - 错误处理验证
  - 批量测试验证
  
- **配置管理流程**: 配置相关操作
  - 配置向导流程验证
  - 模板应用验证
  - 批量操作验证

## 测试最佳实践

### 1. 测试组织
```javascript
describe('组件名称', () => {
    let container;
    
    beforeEach(() => {
        container = test.createTestContainer();
    });
    
    afterEach(() => {
        test.cleanupTestContainer();
    });
    
    it('应该测试特定功能', () => {
        // 测试代码
    });
});
```

### 2. Mock使用
```javascript
const mockApi = test.createMock({
    get: () => Promise.resolve({ data: 'test' }),
    post: () => Promise.resolve({ success: true })
});

window.api = mockApi;
```

### 3. 异步测试
```javascript
it('应该处理异步操作', async () => {
    // 触发异步操作
    triggerAsyncAction();
    
    // 等待结果
    await test.waitFor(() => container.querySelector('.result'));
    
    // 验证结果
    expect(container.querySelector('.result')).toBeTruthy();
});
```

### 4. 事件模拟
```javascript
it('应该响应用户交互', () => {
    const button = container.querySelector('button');
    
    // 模拟点击
    test.simulateClick(button);
    
    // 模拟输入
    const input = container.querySelector('input');
    test.simulateInput(input, 'test value');
});
```

## 测试数据和Mock

### API Mock数据
```javascript
const mockSystemStatus = {
    id: 'collector-001',
    status: 'running',
    uptime: 86400,
    dataPoints: 1250,
    errorCount: 3
};

const mockInterfaces = [
    {
        id: 'opc-ua-001',
        name: '生产线OPC UA服务器',
        type: 'OPC_UA',
        status: 'connected',
        dataRate: 50.5
    }
];
```

### 协议测试Mock
```javascript
const mockProtocolTest = {
    success: true,
    duration: 1250,
    data: {
        serverInfo: {
            productName: 'Test OPC UA Server',
            softwareVersion: '1.0.0'
        }
    }
};
```

## 性能测试

### 组件渲染性能
- 测试组件初始渲染时间
- 验证大数据量下的性能表现
- 检查内存泄漏问题

### API调用性能
- 测试API响应时间
- 验证并发请求处理
- 检查错误恢复机制

## 测试报告

测试运行器会生成详细的测试报告，包括：
- 通过/失败统计
- 测试执行时间
- 错误详情和堆栈跟踪
- 覆盖率信息

## 持续集成

### 自动化测试
```bash
# 在CI/CD流程中运行测试
npm run test:headless

# 生成测试报告
npm run test:report
```

### 测试质量门禁
- 所有测试必须通过
- 代码覆盖率 > 80%
- 无严重的测试警告

## 故障排除

### 常见问题
1. **测试超时**: 增加waitFor超时时间
2. **Mock失效**: 检查Mock对象的生命周期
3. **DOM查询失败**: 确认元素渲染完成
4. **异步竞态**: 使用适当的等待机制

### 调试技巧
```javascript
// 添加调试输出
console.log('测试状态:', container.innerHTML);

// 暂停测试执行
await new Promise(resolve => setTimeout(resolve, 1000));

// 检查Mock调用
console.log('API调用记录:', mockApi.calls);
```

## 扩展测试

### 添加新测试
1. 在相应目录创建测试文件
2. 遵循命名约定: `*.test.js`
3. 使用标准的测试结构
4. 更新测试运行器配置

### 自定义断言
```javascript
// 扩展expect方法
test.expect.extend({
    toBeValidConfig(received) {
        const isValid = validateConfig(received);
        return {
            pass: isValid,
            message: () => `期望配置有效，但验证失败`
        };
    }
});
```

这个测试套件确保了采集器前端的质量和稳定性，为持续开发和维护提供了可靠的保障。