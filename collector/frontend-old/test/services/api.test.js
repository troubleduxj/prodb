/**
 * API 服务单元测试
 */

import { api } from '../../services/api.js';

describe('API 服务', () => {
    let originalFetch;
    let mockFetch;

    beforeEach(() => {
        originalFetch = window.fetch;
        mockFetch = test.createMock({
            fetch: (url, options) => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: {} })
            })
        });
        window.fetch = mockFetch.fetch;
    });

    afterEach(() => {
        window.fetch = originalFetch;
    });

    it('应该发送GET请求', async () => {
        await api.get('/test');
        
        expect(mockFetch.calls.length).toBe(1);
        expect(mockFetch.calls[0].args[0]).toBe('/api/v1/test');
        expect(mockFetch.calls[0].args[1].method).toBe('GET');
    });

    it('应该发送POST请求', async () => {
        const data = { test: 'data' };
        await api.post('/test', data);
        
        expect(mockFetch.calls.length).toBe(1);
        expect(mockFetch.calls[0].args[0]).toBe('/api/v1/test');
        expect(mockFetch.calls[0].args[1].method).toBe('POST');
        expect(mockFetch.calls[0].args[1].body).toBe(JSON.stringify(data));
    });

    it('应该处理错误响应', async () => {
        mockFetch.fetch = () => Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        try {
            await api.get('/nonexistent');
            expect(false).toBeTruthy(); // 不应该到达这里
        } catch (error) {
            expect(error.message).toContain('404');
        }
    });

    it('应该设置正确的请求头', async () => {
        await api.post('/test', { data: 'test' });
        
        const headers = mockFetch.calls[0].args[1].headers;
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('应该处理网络错误', async () => {
        mockFetch.fetch = () => Promise.reject(new Error('Network error'));

        try {
            await api.get('/test');
            expect(false).toBeTruthy(); // 不应该到达这里
        } catch (error) {
            expect(error.message).toBe('Network error');
        }
    });

    it('应该支持自定义请求头', async () => {
        await api.get('/test', { 'Authorization': 'Bearer token' });
        
        const headers = mockFetch.calls[0].args[1].headers;
        expect(headers['Authorization']).toBe('Bearer token');
    });

    it('应该处理空响应', async () => {
        mockFetch.fetch = () => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null)
        });

        const result = await api.get('/test');
        expect(result).toBe(null);
    });
});