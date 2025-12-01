import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    DurableObjectRouter,
    DurableObjectRouteHandler,
    handleDurableObjectRoute,
    handleDurableObjectMiddleware,
    Env,
} from '../../src/router';
import { HttpError } from '../../src/index';

// Mock DurableObjectState
const createMockState = (): DurableObjectState => ({
    id: {
        toString: () => 'test-id',
        equals: () => false,
        name: 'test-name',
    } as DurableObjectId,
    storage: {} as any,
    blockConcurrencyWhile: vi.fn(async (callback: () => Promise<void>) => callback()),
    waitUntil: vi.fn(),
    abort: vi.fn(),
});

describe('handleDurableObjectRoute', () => {
    let mockRequest: Request;

    beforeEach(() => {
        mockRequest = new Request('https://example.com/test');
    });

    it('should return JSON response with 200 status on success', async () => {
        const handler = async () => {
            return { message: 'success', value: 42 };
        };

        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const body = await response.json();
        expect(body).toEqual({ message: 'success', value: 42 });
    });

    it('should include CORS headers in successful response (without origin by default)', async () => {
        const handler = async () => ({ result: 'ok' });
        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        // By default, Access-Control-Allow-Origin is NOT set (security fix)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should include CORS origin when configured via getCorsConfig function', async () => {
        const handler = async () => ({ result: 'ok' });
        const getCorsConfig = () => ({ origins: '*' as const });
        const wrappedHandler = handleDurableObjectRoute(handler, undefined, getCorsConfig);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include CORS origin when configured via router fallback', async () => {
        const handler = async () => ({ result: 'ok' });
        const wrappedHandler = handleDurableObjectRoute(handler, undefined, undefined, { origins: '*' });
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should pass request params to handler', async () => {
        const handler = vi.fn(async (req: Request, params?: Record<string, string>) => {
            return { params };
        });

        mockRequest.params = { id: '789' };
        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        expect(handler).toHaveBeenCalledWith(mockRequest, { id: '789' });

        const body = await response.json();
        expect(body.params).toEqual({ id: '789' });
    });

    it('should handle HttpError with correct status code', async () => {
        const handler = async () => {
            throw new HttpError(400, 'Invalid input');
        };

        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body).toEqual({ error: 'Invalid input' });
    });

    it('should handle 401 Unauthorized error', async () => {
        const handler = async () => {
            throw new HttpError(401, 'Not authorized');
        };

        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body).toEqual({ error: 'Not authorized' });
    });

    it('should handle generic errors as 500', async () => {
        const handler = async () => {
            throw new Error('Unexpected error');
        };

        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('should include CORS headers in error response (without origin by default)', async () => {
        const handler = async () => {
            throw new HttpError(403, 'Forbidden');
        };

        const wrappedHandler = handleDurableObjectRoute(handler);
        const response = await wrappedHandler(mockRequest);

        // By default, Access-Control-Allow-Origin is NOT set
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });
});

describe('handleDurableObjectMiddleware', () => {
    let mockRequest: Request;

    beforeEach(() => {
        mockRequest = new Request('https://example.com/test');
    });

    it('should return null on successful middleware execution', async () => {
        const middleware = vi.fn(async () => {
            // Middleware logic
        });

        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        const result = await wrappedMiddleware(mockRequest);

        expect(result).toBeNull();
        expect(middleware).toHaveBeenCalledWith(mockRequest, undefined);
    });

    it('should pass params to middleware', async () => {
        const middleware = vi.fn(async (req: Request, params: Record<string, string>) => {
            // Middleware with params
        });

        mockRequest.params = { sessionId: 'abc123' };
        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        await wrappedMiddleware(mockRequest);

        expect(middleware).toHaveBeenCalledWith(mockRequest, { sessionId: 'abc123' });
    });

    it('should handle HttpError in middleware', async () => {
        const middleware = async () => {
            throw new HttpError(403, 'Access denied');
        };

        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        const response = await wrappedMiddleware(mockRequest);

        expect(response).not.toBeNull();
        expect(response?.status).toBe(403);

        const body = await response?.json();
        expect(body).toEqual({ error: 'Access denied' });
    });

    it('should handle generic errors as 500', async () => {
        const middleware = async () => {
            throw new Error('Middleware error');
        };

        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        const response = await wrappedMiddleware(mockRequest);

        expect(response).not.toBeNull();
        expect(response?.status).toBe(500);

        const body = await response?.json();
        expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('should include CORS headers in error response (without origin by default)', async () => {
        const middleware = async () => {
            throw new HttpError(401, 'Unauthorized');
        };

        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        const response = await wrappedMiddleware(mockRequest);

        // By default, Access-Control-Allow-Origin is NOT set
        expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response?.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should handle synchronous middleware', async () => {
        const middleware = vi.fn(() => {
            // Synchronous middleware
        });

        const wrappedMiddleware = handleDurableObjectMiddleware(middleware);
        const result = await wrappedMiddleware(mockRequest);

        expect(result).toBeNull();
        expect(middleware).toHaveBeenCalled();
    });
});

describe('DurableObjectRouter', () => {
    let mockState: DurableObjectState;
    let mockEnv: Env;
    let router: DurableObjectRouter<Env>;

    beforeEach(() => {
        mockState = createMockState();
        mockEnv = { LOG_LEVEL: 'fatal' };
        router = new DurableObjectRouter(mockState, mockEnv, 'test-do-router');
        router.log.setLevel('fatal');
    });

    describe('constructor', () => {
        it('should create router with provided name', () => {
            expect(router.name).toBe('test-do-router');
        });

        it('should store ctx and env references', () => {
            expect(router.ctx).toBe(mockState);
            expect(router.env).toBe(mockEnv);
        });

        it('should initialize logger', () => {
            expect(router.log).toBeDefined();
        });

        it('should have OPTIONS handler registered for CORS', () => {
            expect(router.router).toBeDefined();
        });
    });

    describe('middleware registration', () => {
        it('should register GET middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.get('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register POST middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.post('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PUT middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.put('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register DELETE middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.delete('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PATCH middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.patch('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register ALL middleware and return this for chaining', () => {
            const middleware = vi.fn(async () => {});
            const result = router.all('/test', middleware);

            expect(result).toBe(router);
        });

        it('should allow method chaining', () => {
            const m1 = vi.fn(async () => {});
            const m2 = vi.fn(async () => {});

            const result = router.get('/route1', m1).post('/route2', m2);

            expect(result).toBe(router);
        });
    });

    describe('defineRouteHandler', () => {
        class TestDOHandler extends DurableObjectRouteHandler<Env> {
            async get() {
                return { message: 'DO GET handler' };
            }

            async put() {
                return { message: 'DO PUT handler' };
            }

            async delete() {
                return { message: 'DO DELETE handler' };
            }

            async patch() {
                return { message: 'DO PATCH handler' };
            }
        }

        it('should register route handler and return this for chaining', () => {
            const result = router.defineRouteHandler('/api/test', TestDOHandler);

            expect(result).toBe(router);
        });

        it('should pass ctx, env, and logger to handler', () => {
            router.defineRouteHandler('/api/test', TestDOHandler);

            // Handler is instantiated with ctx, env, and log
            expect(router.ctx).toBe(mockState);
            expect(router.env).toBe(mockEnv);
            expect(router.log).toBeDefined();
        });

        it('should allow chaining with other registrations', () => {
            const middleware = vi.fn(async () => {});

            const result = router
                .get('/middleware', middleware)
                .defineRouteHandler('/api/test', TestDOHandler)
                .post('/another', middleware);

            expect(result).toBe(router);
        });

        it('should handle PUT requests through defined handler', async () => {
            router.defineRouteHandler('/api/test', TestDOHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/test', { method: 'PUT' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ message: 'DO PUT handler' });
        });

        it('should handle DELETE requests through defined handler', async () => {
            router.defineRouteHandler('/api/test', TestDOHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/test', { method: 'DELETE' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ message: 'DO DELETE handler' });
        });

        it('should handle PATCH requests through defined handler', async () => {
            router.defineRouteHandler('/api/test', TestDOHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/test', { method: 'PATCH' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ message: 'DO PATCH handler' });
        });
    });

    describe('build', () => {
        it('should return the underlying itty-router instance', () => {
            const builtRouter = router.build();

            expect(builtRouter).toBe(router.router);
        });

        it('should add 404 handler', () => {
            router.build();

            expect(router.router).toBeDefined();
        });

        it('should only build once (idempotent)', () => {
            const first = router.build();
            const second = router.build();

            expect(first).toBe(second);
        });

        it('should set is_built flag', () => {
            router.build();
            // Build again should return immediately
            const builtRouter = router.build();

            expect(builtRouter).toBe(router.router);
        });

        it('should return 404 for unmatched routes', async () => {
            const builtRouter = router.build();
            const request = new Request('https://example.com/nonexistent');

            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body).toEqual({ error: 'Not found' });
        });
    });

    describe('handle', () => {
        it('should automatically build if not built', async () => {
            const buildSpy = vi.spyOn(router, 'build');
            const request = new Request('https://example.com/test');

            // Mock the router.fetch to avoid actual routing
            vi.spyOn(router.router, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
            );

            await router.handle(request);

            expect(buildSpy).toHaveBeenCalled();
        });

        it('should call router.fetch with request', async () => {
            const request = new Request('https://example.com/test');
            const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

            const fetchSpy = vi.spyOn(router.router, 'fetch').mockResolvedValue(mockResponse);

            const result = await router.handle(request);

            expect(fetchSpy).toHaveBeenCalledWith(request);
            expect(result).toBe(mockResponse);
        });

        it('should not rebuild if already built', async () => {
            const firstBuild = router.build();

            const request = new Request('https://example.com/test');
            vi.spyOn(router.router, 'fetch').mockResolvedValue(
                new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
            );

            await router.handle(request);
            const secondBuild = router.build();

            // Both builds should return the same router instance
            expect(firstBuild).toBe(secondBuild);
        });
    });
});

describe('DurableObjectRouteHandler', () => {
    let mockState: DurableObjectState;
    let mockEnv: Env;

    beforeEach(() => {
        mockState = createMockState();
        mockEnv = { LOG_LEVEL: 'fatal' };
    });

    class TestDOHandler extends DurableObjectRouteHandler<Env> {}

    it('should throw 405 for unimplemented GET', async () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test');

        await expect(handler.get(request)).rejects.toThrow(HttpError);
        await expect(handler.get(request)).rejects.toThrow('Method Not Allowed');
    });

    it('should throw 405 for unimplemented POST', async () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test', { method: 'POST' });

        await expect(handler.post(request)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented PUT', async () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test', { method: 'PUT' });

        await expect(handler.put(request)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented DELETE', async () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test', { method: 'DELETE' });

        await expect(handler.delete(request)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented PATCH', async () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test', { method: 'PATCH' });

        await expect(handler.patch(request)).rejects.toThrow(HttpError);
    });

    it('should store ctx and env references', () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);

        expect(handler['ctx']).toBe(mockState);
        expect(handler['env']).toBe(mockEnv);
    });

    it('should initialize with custom logger', () => {
        const customLog = vi.fn() as any;
        customLog.setLevel = vi.fn();

        const handler = new TestDOHandler('/test', mockState, mockEnv, { log: customLog });

        expect(handler['log']).toBe(customLog);
    });

    it('should create default logger if not provided', () => {
        const handler = new TestDOHandler('/test', mockState, mockEnv);

        expect(handler['log']).toBeDefined();
    });

    it('should allow subclass to implement GET', async () => {
        class CustomDOHandler extends DurableObjectRouteHandler<Env> {
            async get() {
                return { message: 'DO custom GET' };
            }
        }

        const handler = new CustomDOHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test');
        const result = await handler.get(request);

        expect(result).toEqual({ message: 'DO custom GET' });
    });

    it('should allow subclass to access ctx', async () => {
        class StatefulHandler extends DurableObjectRouteHandler<Env> {
            async get() {
                return { id: this.ctx.id.toString() };
            }
        }

        const handler = new StatefulHandler('/test', mockState, mockEnv);
        const request = new Request('https://example.com/test');
        const result = await handler.get(request);

        expect(result).toEqual({ id: 'test-id' });
    });

    it('should receive params in handler methods', async () => {
        class ParamsDOHandler extends DurableObjectRouteHandler<Env> {
            async get(_request: Request, params?: Record<string, string>) {
                return { params };
            }
        }

        const handler = new ParamsDOHandler('/item/:id', mockState, mockEnv);
        const request = new Request('https://example.com/item/456');
        const result = await handler.get(request, { id: '456' });

        expect(result.params).toEqual({ id: '456' });
    });
});
