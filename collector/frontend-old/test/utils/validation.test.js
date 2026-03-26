/**
 * 验证工具单元测试
 */

import { validator, Validator, protocolValidators, formValidators } from '../../utils/validation.js';

describe('验证工具', () => {
    
    it('应该验证必填字段', () => {
        const result = validator.validateField('name', '', [
            { type: 'required' }
        ]);
        
        expect(result.valid).toBeFalsy();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('required');
    });

    it('应该验证邮箱格式', () => {
        const result = validator.validateField('email', 'invalid-email', [
            { type: 'email' }
        ]);
        const data = { email: 'invalid-email' };
        
        const result = validation.validate(data, rules);
        
        expect(result.isValid).toBeFalsy();
        expect(result.errors.email).toContain('邮箱格式');
    });

    it('应该验证数字范围', () => {
        const rules = { port: { min: 1, max: 65535 } };
        const data = { port: 70000 };
        
        const result = validation.validate(data, rules);
        
        expect(result.isValid).toBeFalsy();
        expect(result.errors.port).toContain('范围');
    });

    it('应该验证字符串长度', () => {
        const rules = { password: { minLength: 8 } };
        const data = { password: '123' };
        
        const result = validation.validate(data, rules);
        
        expect(result.isValid).toBeFalsy();
        expect(result.errors.password).toContain('长度');
    });

    it('应该验证IP地址格式', () => {
        expect(validation.isValidIP('192.168.1.1')).toBeTruthy();
        expect(validation.isValidIP('256.1.1.1')).toBeFalsy();
        expect(validation.isValidIP('invalid-ip')).toBeFalsy();
    });

    it('应该验证端口号', () => {
        expect(validation.isValidPort(80)).toBeTruthy();
        expect(validation.isValidPort(65535)).toBeTruthy();
        expect(validation.isValidPort(0)).toBeFalsy();
        expect(validation.isValidPort(70000)).toBeFalsy();
    });

    it('应该验证URL格式', () => {
        expect(validation.isValidURL('http://example.com')).toBeTruthy();
        expect(validation.isValidURL('https://example.com:8080/path')).toBeTruthy();
        expect(validation.isValidURL('invalid-url')).toBeFalsy();
    });

    it('应该验证OPC UA端点', () => {
        expect(validation.isValidOpcUaEndpoint('opc.tcp://192.168.1.100:4840')).toBeTruthy();
        expect(validation.isValidOpcUaEndpoint('http://invalid')).toBeFalsy();
    });

    it('应该通过有效数据验证', () => {
        const rules = {
            name: { required: true, minLength: 2 },
            port: { required: true, min: 1, max: 65535 }
        };
        const data = {
            name: 'Test Interface',
            port: 4840
        };
        
        const result = validation.validate(data, rules);
        
        expect(result.isValid).toBeTruthy();
        expect(Object.keys(result.errors).length).toBe(0);
    });

    it('应该支持自定义验证函数', () => {
        const rules = {
            custom: {
                validator: (value) => value === 'expected',
                message: '值必须是expected'
            }
        };
        const data = { custom: 'wrong' };
        
        const result = validation.validate(data, rules);
        
        expect(result.isValid).toBeFalsy();
        expect(result.errors.custom).toBe('值必须是expected');
    });

    it('应该验证协议配置', () => {
        const opcuaConfig = {
            endpoint: 'opc.tcp://192.168.1.100:4840',
            securityPolicy: 'None'
        };
        
        const result = validation.validateProtocolConfig('OPC_UA', opcuaConfig);
        expect(result.isValid).toBeTruthy();
    });

    it('应该检测无效的协议配置', () => {
        const invalidConfig = {
            endpoint: 'invalid-endpoint'
        };
        
        const result = validation.validateProtocolConfig('OPC_UA', invalidConfig);
        expect(result.isValid).toBeFalsy();
    });
});