import { describe, it, expect } from 'vitest';
import { corsHeaders, addCorsHeaders, createCorsHandler } from '../../lib/cors.js';

describe('CORS Utilities', () => {
    describe('corsHeaders', () => {
        it('should have correct default CORS headers', () => {
            expect(corsHeaders).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(corsHeaders).toHaveProperty('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers');
            expect(corsHeaders).toHaveProperty('Access-Control-Max-Age', '86400');
            expect(corsHeaders).toHaveProperty('Access-Control-Allow-Credentials', 'true');
        });
    });

    describe('addCorsHeaders', () => {
        it('should add CORS headers to response', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse);

            expect(modifiedResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
            expect(modifiedResponse.headers.get('Content-Type')).toBe('text/plain');
            expect(modifiedResponse.status).toBe(200);
        });

        it('should preserve existing headers', () => {
            const originalResponse = new Response('test', {
                status: 200,
                headers: { 'X-Custom-Header': 'custom-value' },
            });

            const modifiedResponse = addCorsHeaders(originalResponse);

            expect(modifiedResponse.headers.get('X-Custom-Header')).toBe('custom-value');
            expect(modifiedResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
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
