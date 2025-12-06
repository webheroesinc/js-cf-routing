import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    DurableObjectRouter,
    DurableObjectRouteHandler,
    DurableObjectContext,
    DurableObjectMiddleware,
    Env,
} from '../../src/router';
import { HttpError, ResponseContext } from '../../src/index';
import Loganite from 'loganite';

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

// Helper to create a mock DurableObjectContext
function createMockDOContext<
    E extends Env = Env,
    P extends Record<string, string> = Record<string, string>,
    S = Record<string, any>,
>(
    request: Request,
    env: E,
    doState: DurableObjectState,
    params: P = {} as P
): DurableObjectContext<E, P, S> {
    return {
        request,
        env,
        params,
        state: {} as S,
        response: new ResponseContext(),
        log: new Loganite('test', 'fatal'),
        doState,
    };
}

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

        it('should store doState and env references', () => {
            expect(router.doState).toBe(mockState);
            expect(router.env).toBe(mockEnv);
        });

        it('should initialize logger', () => {
            expect(router.log).toBeDefined();
        });

        it('should have OPTIONS handler registered for CORS', () => {
            expect(router.router).toBeDefined();
        });
    });

    describe('middleware registration with use()', () => {
        it('should register global middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.use(middleware);

            expect(result).toBe(router);
        });

        it('should register path-specific middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.use('/test/*', middleware);

            expect(result).toBe(router);
        });

        it('should throw error if path is provided without middleware', () => {
            expect(() => router.use('/test' as any)).toThrow(
                'Middleware function required when path is specified'
            );
        });
    });

    describe('deprecated method registration', () => {
        it('should register GET middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.get('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register POST middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.post('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PUT middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.put('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register DELETE middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.delete('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PATCH middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.patch('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register ALL middleware and return this for chaining', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const result = router.all('/test', middleware);

            expect(result).toBe(router);
        });

        it('should allow method chaining', () => {
            const m1: DurableObjectMiddleware<Env> = async (ctx, next) => next();
            const m2: DurableObjectMiddleware<Env> = async (ctx, next) => next();

            const result = router.get('/route1', m1).post('/route2', m2);

            expect(result).toBe(router);
        });
    });

    describe('defineRouteHandler', () => {
        class TestDOHandler extends DurableObjectRouteHandler<Env> {
            async get(ctx: DurableObjectContext<Env>) {
                return { message: 'DO GET handler' };
            }

            async put(ctx: DurableObjectContext<Env>) {
                return { message: 'DO PUT handler' };
            }

            async delete(ctx: DurableObjectContext<Env>) {
                return { message: 'DO DELETE handler' };
            }

            async patch(ctx: DurableObjectContext<Env>) {
                return { message: 'DO PATCH handler' };
            }
        }

        it('should register route handler and return this for chaining', () => {
            const result = router.defineRouteHandler('/api/test', TestDOHandler);

            expect(result).toBe(router);
        });

        it('should allow chaining with other registrations', () => {
            const middleware: DurableObjectMiddleware<Env> = async (ctx, next) => next();

            const result = router
                .use(middleware)
                .defineRouteHandler('/api/test', TestDOHandler)
                .use('/another/*', middleware);

            expect(result).toBe(router);
        });

        it('should handle GET requests through defined handler', async () => {
            router.defineRouteHandler('/api/test', TestDOHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ message: 'DO GET handler' });
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

        it('should handle HttpError in route handler', async () => {
            class ErrorHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    throw new HttpError(400, 'Bad Request');
                }
            }

            router.defineRouteHandler('/api/error', ErrorHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/error', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body).toEqual({ error: 'Bad Request' });
        });

        it('should handle generic errors as 500 in route handler', async () => {
            class ErrorHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    throw new Error('Something went wrong');
                }
            }

            router.defineRouteHandler('/api/error', ErrorHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/api/error', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body).toEqual({ error: 'Internal Server Error' });
        });
    });

    describe('middleware chain execution', () => {
        it('should execute middleware in order with next()', async () => {
            const executionOrder: string[] = [];

            class TestHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    executionOrder.push('handler');
                    return { success: true };
                }
            }

            const middleware1: DurableObjectMiddleware<Env> = async (ctx, next) => {
                executionOrder.push('middleware1-before');
                const response = await next();
                executionOrder.push('middleware1-after');
                return response;
            };

            const middleware2: DurableObjectMiddleware<Env> = async (ctx, next) => {
                executionOrder.push('middleware2-before');
                const response = await next();
                executionOrder.push('middleware2-after');
                return response;
            };

            router.use(middleware1);
            router.use(middleware2);
            router.defineRouteHandler('/test', TestHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            await builtRouter.fetch(request);

            expect(executionOrder).toEqual([
                'middleware1-before',
                'middleware2-before',
                'handler',
                'middleware2-after',
                'middleware1-after',
            ]);
        });

        it('should allow middleware to short-circuit the chain', async () => {
            const executionOrder: string[] = [];

            class TestHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    executionOrder.push('handler');
                    return { success: true };
                }
            }

            const earlyReturnMiddleware: DurableObjectMiddleware<Env> = async (ctx, next) => {
                executionOrder.push('early-return');
                return new Response(JSON.stringify({ blocked: true }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            router.use(earlyReturnMiddleware);
            router.defineRouteHandler('/test', TestHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body).toEqual({ blocked: true });
            expect(executionOrder).toEqual(['early-return']);
        });

        it('should allow middleware to modify ctx.state for downstream handlers', async () => {
            interface AuthState {
                userId: string;
            }

            class TestHandler extends DurableObjectRouteHandler<
                Env,
                Record<string, string>,
                AuthState
            > {
                async get(ctx: DurableObjectContext<Env, Record<string, string>, AuthState>) {
                    return { userId: ctx.state.userId };
                }
            }

            const authMiddleware: DurableObjectMiddleware<
                Env,
                Record<string, string>,
                AuthState
            > = async (ctx, next) => {
                ctx.state.userId = 'user-123';
                return next();
            };

            router.use(authMiddleware as DurableObjectMiddleware<Env>);
            router.defineRouteHandler('/test', TestHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ userId: 'user-123' });
        });

        it('should handle HttpError thrown in middleware', async () => {
            const errorMiddleware: DurableObjectMiddleware<Env> = async () => {
                throw new HttpError(401, 'Unauthorized');
            };

            class TestHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    return { success: true };
                }
            }

            router.use(errorMiddleware);
            router.defineRouteHandler('/test', TestHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body).toEqual({ error: 'Unauthorized' });
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

            await router.handle(request);

            expect(buildSpy).toHaveBeenCalled();
        });

        it('should call router.fetch with request', async () => {
            const request = new Request('https://example.com/test');
            const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
            });

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

            expect(firstBuild).toBe(secondBuild);
        });
    });

    describe('CORS configuration', () => {
        it('should include CORS headers in response when configured', async () => {
            const routerWithCors = new DurableObjectRouter(mockState, mockEnv, 'test-cors', {
                cors: { origins: '*' },
            });

            class TestHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    return { success: true };
                }
            }

            routerWithCors.defineRouteHandler('/test', TestHandler);
            const builtRouter = routerWithCors.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });

        it('should not include CORS origin by default', async () => {
            class TestHandler extends DurableObjectRouteHandler<Env> {
                async get() {
                    return { success: true };
                }
            }

            router.defineRouteHandler('/test', TestHandler);
            const builtRouter = router.build();

            const request = new Request('https://example.com/test', { method: 'GET' });
            const response = await builtRouter.fetch(request);

            expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
            expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
                'GET, POST, PUT, DELETE, OPTIONS'
            );
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
        const handler = new TestDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test'),
            mockEnv,
            mockState
        );

        await expect(handler.get(ctx)).rejects.toThrow(HttpError);
        await expect(handler.get(ctx)).rejects.toThrow('Method Not Allowed');
    });

    it('should throw 405 for unimplemented POST', async () => {
        const handler = new TestDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test', { method: 'POST' }),
            mockEnv,
            mockState
        );

        await expect(handler.post(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented PUT', async () => {
        const handler = new TestDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test', { method: 'PUT' }),
            mockEnv,
            mockState
        );

        await expect(handler.put(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented DELETE', async () => {
        const handler = new TestDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test', { method: 'DELETE' }),
            mockEnv,
            mockState
        );

        await expect(handler.delete(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 for unimplemented PATCH', async () => {
        const handler = new TestDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test', { method: 'PATCH' }),
            mockEnv,
            mockState
        );

        await expect(handler.patch(ctx)).rejects.toThrow(HttpError);
    });

    it('should initialize with custom logger', () => {
        const customLog = vi.fn() as any;
        customLog.setLevel = vi.fn();

        const handler = new TestDOHandler('/test', { log: customLog });

        expect(handler.log).toBe(customLog);
    });

    it('should create default logger if not provided', () => {
        const handler = new TestDOHandler('/test');

        expect(handler.log).toBeDefined();
    });

    it('should allow subclass to implement GET', async () => {
        class CustomDOHandler extends DurableObjectRouteHandler<Env> {
            async get() {
                return { message: 'DO custom GET' };
            }
        }

        const handler = new CustomDOHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test'),
            mockEnv,
            mockState
        );
        const result = await handler.get(ctx);

        expect(result).toEqual({ message: 'DO custom GET' });
    });

    it('should allow subclass to access doState through ctx', async () => {
        class StatefulHandler extends DurableObjectRouteHandler<Env> {
            async get(ctx: DurableObjectContext<Env>) {
                return { id: ctx.doState.id.toString() };
            }
        }

        const handler = new StatefulHandler('/test');
        const ctx = createMockDOContext(
            new Request('https://example.com/test'),
            mockEnv,
            mockState
        );
        const result = await handler.get(ctx);

        expect(result).toEqual({ id: 'test-id' });
    });

    it('should receive params through ctx', async () => {
        class ParamsDOHandler extends DurableObjectRouteHandler<Env, { id: string }> {
            async get(ctx: DurableObjectContext<Env, { id: string }>) {
                return { params: ctx.params };
            }
        }

        const handler = new ParamsDOHandler('/item/:id');
        const ctx = createMockDOContext<Env, { id: string }>(
            new Request('https://example.com/item/456'),
            mockEnv,
            mockState,
            { id: '456' }
        );
        const result = await handler.get(ctx);

        expect(result.params).toEqual({ id: '456' });
    });

    it('should allow modifying response through ctx.response', async () => {
        class CustomResponseHandler extends DurableObjectRouteHandler<Env> {
            async get(ctx: DurableObjectContext<Env>) {
                ctx.response.status = 201;
                ctx.response.statusText = 'Created';
                ctx.response.headers.set('X-Custom', 'value');
                return { created: true };
            }
        }

        const router = new DurableObjectRouter(mockState, mockEnv, 'test');
        router.defineRouteHandler('/test', CustomResponseHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/test', { method: 'GET' });
        const response = await builtRouter.fetch(request);

        expect(response.status).toBe(201);
        expect(response.statusText).toBe('Created');
        expect(response.headers.get('X-Custom')).toBe('value');
    });
});

describe('DurableObjectContext', () => {
    let mockState: DurableObjectState;
    let mockEnv: Env;

    beforeEach(() => {
        mockState = createMockState();
        mockEnv = { LOG_LEVEL: 'fatal' };
    });

    it('should have all required properties', () => {
        const ctx = createMockDOContext(
            new Request('https://example.com/test'),
            mockEnv,
            mockState
        );

        expect(ctx.request).toBeInstanceOf(Request);
        expect(ctx.env).toBe(mockEnv);
        expect(ctx.params).toEqual({});
        expect(ctx.state).toEqual({});
        expect(ctx.response).toBeInstanceOf(ResponseContext);
        expect(ctx.log).toBeInstanceOf(Loganite);
        expect(ctx.doState).toBe(mockState);
    });

    it('should allow setting params', () => {
        const ctx = createMockDOContext<Env, { id: string }>(
            new Request('https://example.com/test'),
            mockEnv,
            mockState,
            { id: '123' }
        );

        expect(ctx.params).toEqual({ id: '123' });
    });

    it('should allow setting state', () => {
        interface AuthState {
            userId: string;
        }
        const ctx = createMockDOContext<Env, Record<string, string>, AuthState>(
            new Request('https://example.com/test'),
            mockEnv,
            mockState
        );

        ctx.state.userId = 'user-456';
        expect(ctx.state.userId).toBe('user-456');
    });
});
