/**
 * 协议服务单元测试
 */

import { protocolsService } from '../../services/protocols.js';

describe('协议服务', () => {
    let mockApi;

    beforeEach(() => {
        mockApi = test.createMock({
            post: () => Promise.resolve({
                success: true,
                duration: 1250,
                data: { serverInfo: { productName: 'Test Server' } }
            }),
            get: () => Promise.resolve([
                { ip: '192.168.1.100', protocols: ['OPC_UA'] }
            ])
        });
        
        // Mock API
        protocolsService.api = mockApi;
    });

    it('应该测试OPC UA连接', async () => {
        const config = {
            endpoint: 'opc.tcp://192.168.1.100:4840',
            securityPolicy: 'None'
        };

        const result = await protocolsService.testConnection('OPC_UA', config);
        
        expect(mockApi.calls.length).toBe(1);
        expect(mockApi.calls[0].method).toBe('post');
        expect(mockApi.calls[0].args[0]).toBe('/test/protocol');
        expect(result.success).toBeTruthy();
    });

    it('应该测试Modbus连接', async () => {
        const config = {
            host: '192.168.1.100',
            port: 502,
            slaveId: 1
        };

        await protocolsService.testConnection('MODBUS_TCP', config);
        
        const requestData = mockApi.calls[0].args[1];
        expect(requestData.protocol).toBe('MODBUS_TCP');
        expect(requestData.config).toEqual(config);
    });

    it('应该扫描设备', async () => {
        const scanConfig = {
            ipRange: '192.168.1.0/24',
            protocols: ['OPC_UA', 'MODBUS_TCP']
        };

        const result = await protocolsService.scanDevices(scanConfig);
        
        expect(mockApi.calls.length).toBe(1);
        expect(mockApi.calls[0].method).toBe('post');
        expect(mockApi.calls[0].args[0]).toBe('/scan/devices');
        expect(result.length).toBe(1);
    });

    it('应该获取支持的协议列表', () => {
        const protocols = protocolsService.getSupportedProtocols();
        
        expect(protocols).toContain('OPC_UA');
        expect(protocols).toContain('MODBUS_TCP');
        expect(protocols).toContain('MQTT');
    });

    it('应该获取协议配置参数', () => {
        const params = protocolsService.getProtocolParams('OPC_UA');
        
        expect(params).toContain('endpoint');
        expect(params).toContain('securityPolicy');
    });

    it('应该验证协议配置', () => {
        const config = {
            endpoint: 'opc.tcp://192.168.1.100:4840'
        };

        const isValid = protocolsService.validateConfig('OPC_UA', config);
        expect(isValid).toBeTruthy();
    });

    it('应该检测无效配置', () => {
        const config = {
            // 缺少必需的endpoint
        };

        const isValid = protocolsService.validateConfig('OPC_UA', config);
        expect(isValid).toBeFalsy();
    });

    it('应该处理批量测试', async () => {
        const testConfigs = [
            { protocol: 'OPC_UA', config: { endpoint: 'opc.tcp://192.168.1.100:4840' } },
            { protocol: 'MODBUS_TCP', config: { host: '192.168.1.101', port: 502 } }
        ];

        mockApi.post = () => Promise.resolve({
            results: [
                { success: true, protocol: 'OPC_UA' },
                { success: false, protocol: 'MODBUS_TCP', error: '连接超时' }
            ]
        });

        const results = await protocolsService.batchTest(testConfigs);
        
        expect(results.results.length).toBe(2);
        expect(results.results[0].success).toBeTruthy();
        expect(results.results[1].success).toBeFalsy();
    });
});