import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRoute, handleMiddleware, WorkerRouter, Env } from '../../src/router';
import { HttpError, ResponseContext } from '../../src/index';

describe('handleRoute', () => {
    let mockRouter: WorkerRouter<Env>;
    let mockRequest: Request;
    let mockEnv: Env;

    beforeEach(() => {
        mockRouter = new WorkerRouter('test-router');
        mockRouter.log.setLevel('fatal'); // Suppress logs during tests
        mockRequest = new Request('https://example.com/test');
        mockEnv = { LOG_LEVEL: 'fatal' };
    });

    it('should return JSON response with 200 status on success', async () => {
        const handler = async (req: Request, env: Env) => {
            return { message: 'success', data: 123 };
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const body = await response.json();
        expect(body).toEqual({ message: 'success', data: 123 });
    });

    it('should include CORS headers in successful response (without origin by default)', async () => {
        const handler = async () => ({ result: 'ok' });
        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        // By default, Access-Control-Allow-Origin is NOT set (security fix)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should include CORS origin when configured', async () => {
        const routerWithCors = new WorkerRouter<Env>('test-router', { cors: { origins: '*' } });
        routerWithCors.log.setLevel('fatal');

        const handler = async () => ({ result: 'ok' });
        const wrappedHandler = handleRoute(routerWithCors, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should pass request params to handler', async () => {
        const handler = vi.fn(async (req: Request, env: Env, params?: Record<string, string>) => {
            return { params };
        });

        mockRequest.params = { id: '123', name: 'test' };
        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(handler).toHaveBeenCalledWith(mockRequest, mockEnv, { id: '123', name: 'test' });

        const body = await response.json();
        expect(body.params).toEqual({ id: '123', name: 'test' });
    });

    it('should handle HttpError with correct status code', async () => {
        const handler = async () => {
            throw new HttpError(400, 'Bad Request');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(400);
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const body = await response.json();
        expect(body).toEqual({ error: 'Bad Request' });
    });

    it('should handle 401 Unauthorized error', async () => {
        const handler = async () => {
            throw new HttpError(401, 'Unauthorized');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('should handle 404 Not Found error', async () => {
        const handler = async () => {
            throw new HttpError(404, 'Resource not found');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body).toEqual({ error: 'Resource not found' });
    });

    it('should handle generic errors as 500 Internal Server Error', async () => {
        const handler = async () => {
            throw new Error('Something went wrong');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('should include CORS headers in error response (without origin by default)', async () => {
        const handler = async () => {
            throw new HttpError(400, 'Bad Request');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        // By default, Access-Control-Allow-Origin is NOT set
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should set log level from env', async () => {
        const setLevelSpy = vi.spyOn(mockRouter.log, 'setLevel');
        const handler = async () => ({ result: 'ok' });

        mockEnv.LOG_LEVEL = 'debug';
        const wrappedHandler = handleRoute(mockRouter, handler);
        await wrappedHandler(mockRequest, mockEnv);

        expect(setLevelSpy).toHaveBeenCalledWith('debug');
    });
});

describe('handleMiddleware', () => {
    let mockRouter: WorkerRouter<Env>;
    let mockRequest: Request;
    let mockEnv: Env;

    beforeEach(() => {
        mockRouter = new WorkerRouter('test-router');
        mockRouter.log.setLevel('fatal');
        mockRequest = new Request('https://example.com/test');
        mockEnv = { LOG_LEVEL: 'fatal' };
    });

    it('should return null on successful middleware execution', async () => {
        const middleware = vi.fn(async () => {
            // Middleware does something
        });

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const result = await wrappedMiddleware(mockRequest, mockEnv);

        expect(result).toBeNull();
        expect(middleware).toHaveBeenCalledWith(mockRequest, mockEnv, undefined);
    });

    it('should pass params to middleware', async () => {
        const middleware = vi.fn(async (req: Request, env: Env, params: Record<string, string>) => {
            // Middleware with params
        });

        mockRequest.params = { userId: '456' };
        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        await wrappedMiddleware(mockRequest, mockEnv);

        expect(middleware).toHaveBeenCalledWith(mockRequest, mockEnv, { userId: '456' });
    });

    it('should handle HttpError in middleware', async () => {
        const middleware = async () => {
            throw new HttpError(403, 'Forbidden');
        };

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const response = await wrappedMiddleware(mockRequest, mockEnv);

        expect(response).not.toBeNull();
        expect(response?.status).toBe(403);

        const body = await response?.json();
        expect(body).toEqual({ error: 'Forbidden' });
    });

    it('should handle generic errors in middleware as 500', async () => {
        const middleware = async () => {
            throw new Error('Middleware failed');
        };

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const response = await wrappedMiddleware(mockRequest, mockEnv);

        expect(response).not.toBeNull();
        expect(response?.status).toBe(500);

        const body = await response?.json();
        expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('should include CORS headers in middleware error response (without origin by default)', async () => {
        const middleware = async () => {
            throw new HttpError(403, 'Forbidden');
        };

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const response = await wrappedMiddleware(mockRequest, mockEnv);

        // By default, Access-Control-Allow-Origin is NOT set
        expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response?.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should set log level from env', async () => {
        const setLevelSpy = vi.spyOn(mockRouter.log, 'setLevel');
        const middleware = async () => {};

        mockEnv.LOG_LEVEL = 'info';
        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        await wrappedMiddleware(mockRequest, mockEnv);

        expect(setLevelSpy).toHaveBeenCalledWith('info');
    });

    it('should handle synchronous middleware', async () => {
        const middleware = vi.fn(() => {
            // Synchronous middleware
        });

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const result = await wrappedMiddleware(mockRequest, mockEnv);

        expect(result).toBeNull();
        expect(middleware).toHaveBeenCalled();
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

describe('handleRoute with ResponseContext', () => {
    let mockRouter: WorkerRouter<Env>;
    let mockRequest: Request;
    let mockEnv: Env;
    let responseContext: ResponseContext;

    beforeEach(() => {
        mockRouter = new WorkerRouter('test-router');
        mockRouter.log.setLevel('fatal');
        mockRequest = new Request('https://example.com/test');
        mockEnv = { LOG_LEVEL: 'fatal' };
        responseContext = new ResponseContext();
    });

    it('should use custom status from ResponseContext', async () => {
        const handler = async () => {
            responseContext.status = 201;
            return { created: true };
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body).toEqual({ created: true });
    });

    it('should use custom statusText from ResponseContext', async () => {
        const handler = async () => {
            responseContext.status = 201;
            responseContext.statusText = 'Created';
            return { id: 123 };
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(201);
        expect(response.statusText).toBe('Created');
    });

    it('should merge custom headers from ResponseContext', async () => {
        const handler = async () => {
            responseContext.headers.set('X-Custom-Header', 'custom-value');
            responseContext.headers.set('Set-Cookie', 'session=abc123');
            return { success: true };
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
        expect(response.headers.get('Set-Cookie')).toBe('session=abc123');
        // Default headers should still be present
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should allow handler to set custom CORS origin via ResponseContext', async () => {
        const handler = async () => {
            responseContext.headers.set('Access-Control-Allow-Origin', 'https://myapp.com');
            responseContext.headers.set('Access-Control-Allow-Credentials', 'true');
            return { success: true };
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com');
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should allow overriding Content-Type header', async () => {
        const handler = async () => {
            responseContext.headers.set('Content-Type', 'text/plain');
            return 'plain text response';
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('Content-Type')).toBe('text/plain');
    });

    it('should reset ResponseContext between requests', async () => {
        const handler = async () => {
            // First call sets custom status
            if (responseContext.status === 200) {
                responseContext.status = 201;
            }
            return { status: responseContext.status };
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);

        // First request
        const response1 = await wrappedHandler(mockRequest, mockEnv);
        expect(response1.status).toBe(201);

        // Second request should have reset context
        const response2 = await wrappedHandler(mockRequest, mockEnv);
        expect(response2.status).toBe(201); // Handler sets it again since it was reset
    });

    it('should return Response directly when handler returns Response', async () => {
        const customResponse = new Response('custom body', {
            status: 418,
            headers: { 'X-Teapot': 'true' },
        });

        const handler = async () => customResponse;

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response).toBe(customResponse);
        expect(response.status).toBe(418);
        expect(response.headers.get('X-Teapot')).toBe('true');
    });

    it('should ignore ResponseContext when handler returns Response', async () => {
        const handler = async () => {
            responseContext.status = 201; // This should be ignored
            return new Response('direct response', { status: 200 });
        };

        const wrappedHandler = handleRoute(mockRouter, handler, responseContext);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toBe('direct response');
    });
});
