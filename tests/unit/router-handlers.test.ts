import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRoute, handleMiddleware, WorkerRouter, Env } from '../../src/router';
import { HttpError } from '../../src/index';

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

    it('should include CORS headers in successful response', async () => {
        const handler = async () => ({ result: 'ok' });
        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
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

    it('should include CORS headers in error response', async () => {
        const handler = async () => {
            throw new HttpError(400, 'Bad Request');
        };

        const wrappedHandler = handleRoute(mockRouter, handler);
        const response = await wrappedHandler(mockRequest, mockEnv);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
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

    it('should include CORS headers in middleware error response', async () => {
        const middleware = async () => {
            throw new HttpError(403, 'Forbidden');
        };

        const wrappedMiddleware = handleMiddleware(mockRouter, middleware);
        const response = await wrappedMiddleware(mockRequest, mockEnv);

        expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('*');
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
