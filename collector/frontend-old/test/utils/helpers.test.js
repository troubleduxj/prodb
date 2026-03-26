/**
 * 辅助函数单元测试
 */

import { helpers } from '../../utils/helpers.js';

describe('辅助函数', () => {
    
    it('应该格式化运行时间', () => {
        expect(helpers.formatUptime(3661)).toBe('1小时1分钟1秒');
        expect(helpers.formatUptime(86400)).toBe('1天0小时0分钟');
        expect(helpers.formatUptime(60)).toBe('1分钟0秒');
    });

    it('应该格式化文件大小', () => {
        expect(helpers.formatFileSize(1024)).toBe('1.00 KB');
        expect(helpers.formatFileSize(1048576)).toBe('1.00 MB');
        expect(helpers.formatFileSize(1073741824)).toBe('1.00 GB');
    });

    it('应该格式化时间戳', () => {
        const timestamp = '2024-01-15T10:30:00Z';
        const formatted = helpers.formatTime(timestamp);
        expect(formatted).toContain('2024');
        expect(formatted).toContain('10:30');
    });

    it('应该防抖函数调用', (done) => {
        let callCount = 0;
        const debouncedFn = helpers.debounce(() => {
            callCount++;
        }, 100);

        // 快速调用多次
        debouncedFn();
        debouncedFn();
        debouncedFn();

        // 应该只执行一次
        setTimeout(() => {
            expect(callCount).toBe(1);
            done();
        }, 150);
    });

    it('应该节流函数调用', (done) => {
        let callCount = 0;
        const throttledFn = helpers.throttle(() => {
            callCount++;
        }, 100);

        // 快速调用多次
        throttledFn();
        throttledFn();
        throttledFn();

        // 立即应该执行一次
        expect(callCount).toBe(1);

        setTimeout(() => {
            throttledFn();
            expect(callCount).toBe(2);
            done();
        }, 150);
    });

    it('应该深度克隆对象', () => {
        const original = {
            a: 1,
            b: { c: 2, d: [3, 4] },
            e: new Date('2024-01-01')
        };

        const cloned = helpers.deepClone(original);
        
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
        expect(cloned.b.d).not.toBe(original.b.d);
    });

    it('应该生成唯一ID', () => {
        const id1 = helpers.generateId();
        const id2 = helpers.generateId();
        
        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(0);
    });

    it('应该检查对象是否为空', () => {
        expect(helpers.isEmpty({})).toBeTruthy();
        expect(helpers.isEmpty([])).toBeTruthy();
        expect(helpers.isEmpty('')).toBeTruthy();
        expect(helpers.isEmpty(null)).toBeTruthy();
        expect(helpers.isEmpty(undefined)).toBeTruthy();
        
        expect(helpers.isEmpty({ a: 1 })).toBeFalsy();
        expect(helpers.isEmpty([1])).toBeFalsy();
        expect(helpers.isEmpty('test')).toBeFalsy();
    });

    it('应该获取嵌套对象属性', () => {
        const obj = {
            a: {
                b: {
                    c: 'value'
                }
            }
        };

        expect(helpers.getNestedValue(obj, 'a.b.c')).toBe('value');
        expect(helpers.getNestedValue(obj, 'a.b.x', 'default')).toBe('default');
        expect(helpers.getNestedValue(obj, 'x.y.z')).toBeUndefined();
    });

    it('应该设置嵌套对象属性', () => {
        const obj = {};
        
        helpers.setNestedValue(obj, 'a.b.c', 'value');
        
        expect(obj.a.b.c).toBe('value');
    });

    it('应该合并对象', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { b: { d: 3 }, e: 4 };
        
        const merged = helpers.mergeDeep(obj1, obj2);
        
        expect(merged.a).toBe(1);
        expect(merged.b.c).toBe(2);
        expect(merged.b.d).toBe(3);
        expect(merged.e).toBe(4);
    });

    it('应该转换驼峰命名', () => {
        expect(helpers.toCamelCase('hello-world')).toBe('helloWorld');
        expect(helpers.toCamelCase('hello_world')).toBe('helloWorld');
        expect(helpers.toCamelCase('hello world')).toBe('helloWorld');
    });

    it('应该转换短横线命名', () => {
        expect(helpers.toKebabCase('helloWorld')).toBe('hello-world');
        expect(helpers.toKebabCase('HelloWorld')).toBe('hello-world');
    });
});