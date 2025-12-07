import { describe, it, expect, vi } from 'vitest';
import { buildResponse, buildErrorResponse, Env, Context, Params } from '../../src/router';
import { HttpError, ResponseContext } from '../../src/index';
import { Logger } from '../../src/logger';

// Helper to create a mock context
function createMockContext<E extends Env = Env, P extends Params = Params, D = Record<string, any>>(
    request: Request,
    env: E,
    params: P = {} as P
): Context<E, P, D> {
    return {
        request,
        env,
        params,
        data: {} as D,
        response: new ResponseContext(),
        log: new Logger('test', 'fatal'),
    };
}

describe('buildResponse', () => {
    it('should return JSON response with 200 status by default', () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildResponse({ message: 'success' }, ctx);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should serialize result to JSON', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildResponse({ message: 'success', data: 123 }, ctx);

        const body = await response.json();
        expect(body).toEqual({ message: 'success', data: 123 });
    });

    it('should use custom status from ctx.response', () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        ctx.response.status = 201;
        ctx.response.statusText = 'Created';

        const response = buildResponse({ created: true }, ctx);

        expect(response.status).toBe(201);
        expect(response.statusText).toBe('Created');
    });

    it('should include custom headers from ctx.response', () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        ctx.response.headers.set('X-Custom', 'value');
        ctx.response.headers.set('Set-Cookie', 'session=abc123');

        const response = buildResponse({ data: 'test' }, ctx);

        expect(response.headers.get('X-Custom')).toBe('value');
        expect(response.headers.get('Set-Cookie')).toBe('session=abc123');
    });

    it('should include CORS headers when configured', () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildResponse({ data: 'test' }, ctx, { origins: '*' });

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, POST, PUT, DELETE, OPTIONS'
        );
    });

    it('should pass through Response objects directly', () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const directResponse = new Response('custom', { status: 418 });

        const response = buildResponse(directResponse, ctx);

        expect(response).toBe(directResponse);
        expect(response.status).toBe(418);
    });
});

describe('buildErrorResponse', () => {
    it('should return 500 for generic errors', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(new Error('Something broke'), ctx);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('should use HttpError status and message', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(new HttpError(401, 'Unauthorized'), ctx);

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('should include HttpError details in response', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(
            new HttpError(400, 'Validation failed', { field: 'email', reason: 'invalid format' }),
            ctx
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body).toEqual({
            error: 'Validation failed',
            field: 'email',
            reason: 'invalid format',
        });
    });

    it('should include HttpError headers in response', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(
            new HttpError(401, 'Session expired', null, { 'Set-Cookie': 'session=; Max-Age=0' }),
            ctx
        );

        expect(response.status).toBe(401);
        expect(response.headers.get('Set-Cookie')).toBe('session=; Max-Age=0');
    });

    it('should include CORS headers when configured', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(new HttpError(400, 'Bad Request'), ctx, {
            origins: '*',
        });

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, POST, PUT, DELETE, OPTIONS'
        );
    });

    it('should handle 404 Not Found error', async () => {
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const response = buildErrorResponse(new HttpError(404, 'Resource not found'), ctx);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body).toEqual({ error: 'Resource not found' });
    });
});

describe('ResponseContext', () => {
    it('should have default values', () => {
        const ctx = new ResponseContext();

        expect(ctx.status).toBe(200);
        expect(ctx.statusText).toBe('OK');
        expect(ctx.headers).toBeInstanceOf(Headers);
    });

    it('should allow setting custom status', () => {
        const ctx = new ResponseContext();
        ctx.status = 201;
        ctx.statusText = 'Created';

        expect(ctx.status).toBe(201);
        expect(ctx.statusText).toBe('Created');
    });

    it('should allow setting custom headers', () => {
        const ctx = new ResponseContext();
        ctx.headers.set('X-Custom-Header', 'custom-value');
        ctx.headers.set('Set-Cookie', 'session=abc123');

        expect(ctx.headers.get('X-Custom-Header')).toBe('custom-value');
        expect(ctx.headers.get('Set-Cookie')).toBe('session=abc123');
    });

    it('should reset to default values', () => {
        const ctx = new ResponseContext();
        ctx.status = 201;
        ctx.statusText = 'Created';
        ctx.headers.set('X-Custom-Header', 'value');

        ctx.reset();

        expect(ctx.status).toBe(200);
        expect(ctx.statusText).toBe('OK');
        expect(ctx.headers.get('X-Custom-Header')).toBeNull();
    });
});
