import { describe, it, expect } from 'vitest';
import {
    corsHeaders,
    addCorsHeaders,
    createCorsHandler,
    buildCorsHeaders,
    CorsConfig,
} from '../../src/cors.js';

describe('CORS Utilities', () => {
    describe('corsHeaders', () => {
        it('should have correct default CORS headers', () => {
            // Access-Control-Allow-Origin is NOT included by default (security fix)
            expect(corsHeaders).not.toHaveProperty('Access-Control-Allow-Origin');
            expect(corsHeaders).toHaveProperty(
                'Access-Control-Allow-Methods',
                'GET, POST, PUT, DELETE, OPTIONS'
            );
            expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers');
            expect(corsHeaders).toHaveProperty('Access-Control-Max-Age', '86400');
            // Access-Control-Allow-Credentials is NOT included by default (was incompatible with *)
            expect(corsHeaders).not.toHaveProperty('Access-Control-Allow-Credentials');
        });
    });

    describe('buildCorsHeaders', () => {
        it('should build headers with wildcard origin', () => {
            const config: CorsConfig = { origins: '*' };
            const headers = buildCorsHeaders(config);

            expect(headers['Access-Control-Allow-Origin']).toBe('*');
            expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
        });

        it('should build headers with specific origin', () => {
            const config: CorsConfig = { origins: 'https://example.com' };
            const headers = buildCorsHeaders(config);

            expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
        });

        it('should build headers with origin array (matching request)', () => {
            const config: CorsConfig = { origins: ['https://example.com', 'https://other.com'] };
            const headers = buildCorsHeaders(config, 'https://example.com');

            expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
            expect(headers['Vary']).toBe('Origin');
        });

        it('should not include origin for array when request origin not in list', () => {
            const config: CorsConfig = { origins: ['https://example.com'] };
            const headers = buildCorsHeaders(config, 'https://malicious.com');

            expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
        });

        it('should add credentials header when enabled with specific origin', () => {
            const config: CorsConfig = { origins: 'https://example.com', credentials: true };
            const headers = buildCorsHeaders(config);

            expect(headers['Access-Control-Allow-Credentials']).toBe('true');
        });

        it('should not add credentials header without origin', () => {
            const config: CorsConfig = { credentials: true };
            const headers = buildCorsHeaders(config);

            expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
        });

        it('should allow custom methods and headers', () => {
            const config: CorsConfig = {
                origins: '*',
                methods: 'GET, POST',
                headers: 'X-Custom-Header',
                maxAge: '3600',
            };
            const headers = buildCorsHeaders(config);

            expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
            expect(headers['Access-Control-Allow-Headers']).toBe('X-Custom-Header');
            expect(headers['Access-Control-Max-Age']).toBe('3600');
        });
    });

    describe('addCorsHeaders', () => {
        it('should add default CORS headers to response (without origin)', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse);

            // Default headers don't include origin
            expect(modifiedResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
            expect(modifiedResponse.headers.get('Access-Control-Allow-Methods')).toBe(
                'GET, POST, PUT, DELETE, OPTIONS'
            );
            expect(modifiedResponse.headers.get('Content-Type')).toBe('text/plain');
            expect(modifiedResponse.status).toBe(200);
        });

        it('should add CORS headers with config', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse, { origins: '*' });

            expect(modifiedResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });

        it('should preserve existing headers', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'X-Custom-Header': 'custom-value' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse);

            expect(modifiedResponse.headers.get('X-Custom-Header')).toBe('custom-value');
        });

        it('should NOT override existing CORS headers', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'Access-Control-Allow-Origin': 'https://myapp.com' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse, { origins: '*' });

            // Should preserve the handler's custom origin
            expect(modifiedResponse.headers.get('Access-Control-Allow-Origin')).toBe(
                'https://myapp.com'
            );
        });

        it('should preserve response body', async () => {
            const originalResponse = new Response('test body', { status: 200 });
            const modifiedResponse = addCorsHeaders(originalResponse);
            const body = await modifiedResponse.text();

            expect(body).toBe('test body');
        });
    });

    describe('createCorsHandler', () => {
        it('should handle OPTIONS preflight requests', async () => {
            const customCorsHeaders = {
                'Access-Control-Allow-Origin': 'https://example.com',
                'Access-Control-Allow-Methods': 'GET, POST',
            };

            const corsHandler = createCorsHandler(customCorsHeaders);
            const request = new Request('http://localhost/test', { method: 'OPTIONS' });
            const mockHandler = async () => new Response('should not be called');

            const response = await corsHandler(request, mockHandler);

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
            expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
        });

        it('should add CORS headers to handler response', async () => {
            const customCorsHeaders = {
                'Access-Control-Allow-Origin': 'https://example.com',
            };

            const corsHandler = createCorsHandler(customCorsHeaders);
            const request = new Request('http://localhost/test', { method: 'GET' });
            const mockHandler = async () => new Response('test response', { status: 200 });

            const response = await corsHandler(request, mockHandler);

            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
            const body = await response.text();
            expect(body).toBe('test response');
        });
    });
});
