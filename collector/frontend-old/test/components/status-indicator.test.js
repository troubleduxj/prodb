/**
 * StatusIndicator 组件单元测试
 */

import StatusIndicator from '../../components/StatusIndicator.js';

describe('StatusIndicator 组件', () => {
    let container;

    beforeEach(() => {
        container = test.createTestContainer();
    });

    afterEach(() => {
        test.cleanupTestContainer();
    });

    it('应该正确渲染连接状态', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            value: 'connected',
            type: 'status'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator).toBeTruthy();
        expect(indicator.classList.contains('connected')).toBeTruthy();
    });

    it('应该正确渲染断开状态', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            value: 'disconnected',
            type: 'status'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator.classList.contains('disconnected')).toBeTruthy();
    });

    it('应该正确渲染错误状态', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            value: 'error',
            type: 'status'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator.classList.contains('error')).toBeTruthy();
    });

    it('应该显示标签文本', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            label: '连接状态',
            value: 'connected',
            type: 'status'
        }), container);

        expect(container.textContent).toContain('连接状态');
    });

    it('应该支持不同的尺寸', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            value: 'connected',
            type: 'status',
            size: 'small'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator.classList.contains('small')).toBeTruthy();
    });

    it('应该正确处理计数器类型', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            label: '数据点数',
            value: 1250,
            type: 'counter'
        }), container);

        expect(container.textContent).toContain('1250');
    });

    it('应该正确处理信息类型', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            label: '运行时间',
            value: '2小时30分钟',
            type: 'info'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator.classList.contains('info')).toBeTruthy();
        expect(container.textContent).toContain('2小时30分钟');
    });

    it('应该处理空值', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            label: '测试',
            value: null,
            type: 'status'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator).toBeTruthy();
    });

    it('应该支持自定义类名', () => {
        const { render } = preact;
        
        render(preact.createElement(StatusIndicator, {
            value: 'connected',
            type: 'status',
            className: 'custom-class'
        }), container);

        const indicator = container.querySelector('.status-indicator');
        expect(indicator.classList.contains('custom-class')).toBeTruthy();
    });
});