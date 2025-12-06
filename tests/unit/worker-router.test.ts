import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    WorkerRouter,
    RouteHandler,
    Env,
    Context,
    Middleware,
    createContext,
} from '../../src/router';
import { HttpError } from '../../src/index';
import { ResponseContext } from '../../src/response-context';
import Loganite from 'loganite';

// Helper to create a mock context for testing handlers directly
function createMockContext<
    E extends Env = Env,
    P = Record<string, string>,
    D = Record<string, any>,
>(request: Request, env: E, params: P = {} as P): Context<E, P, D> {
    return {
        request,
        env,
        params,
        data: {} as D,
        response: new ResponseContext(),
        log: new Loganite('test', 'fatal'),
    };
}

describe('WorkerRouter', () => {
    let router: WorkerRouter<Env>;

    beforeEach(() => {
        router = new WorkerRouter('test-router');
        router.log.setLevel('fatal');
    });

    describe('constructor', () => {
        it('should create router with default name', () => {
            const defaultRouter = new WorkerRouter();
            expect(defaultRouter.name).toBe('unnamed');
        });

        it('should create router with custom name', () => {
            expect(router.name).toBe('test-router');
        });

        it('should initialize logger with fatal level', () => {
            const newRouter = new WorkerRouter('new-router');
            expect(newRouter.log).toBeDefined();
        });

        it('should have OPTIONS handler registered for CORS', () => {
            expect(router.router).toBeDefined();
        });
    });

    describe('middleware registration', () => {
        it('should register middleware via use() and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.use(middleware);

            expect(result).toBe(router);
        });

        it('should register path-specific middleware via use() and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.use('/api/*', middleware);

            expect(result).toBe(router);
        });

        it('should register GET middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.get('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register POST middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.post('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PUT middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.put('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register DELETE middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.delete('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register PATCH middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.patch('/test', middleware);

            expect(result).toBe(router);
        });

        it('should register ALL middleware (deprecated) and return this for chaining', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();
            const result = router.all('/test', middleware);

            expect(result).toBe(router);
        });

        it('should allow method chaining for multiple routes', () => {
            const middleware1: Middleware<Env> = async (ctx, next) => next();
            const middleware2: Middleware<Env> = async (ctx, next) => next();

            const result = router.use('/route1', middleware1).use('/route2', middleware2);

            expect(result).toBe(router);
        });
    });

    describe('defineRouteHandler', () => {
        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { message: 'GET handler' };
            }

            async post(ctx: Context<Env>) {
                return { message: 'POST handler' };
            }
        }

        it('should register route handler and return this for chaining', () => {
            const result = router.defineRouteHandler('/api/test', TestHandler);

            expect(result).toBe(router);
        });

        it('should pass logger to route handler', () => {
            router.defineRouteHandler('/api/test', TestHandler);
            expect(router.log).toBeDefined();
        });

        it('should allow chaining with other route registrations', () => {
            const middleware: Middleware<Env> = async (ctx, next) => next();

            const result = router
                .use('/middleware', middleware)
                .defineRouteHandler('/api/test', TestHandler)
                .use('/another', middleware);

            expect(result).toBe(router);
        });
    });

    describe('build', () => {
        it('should return the underlying itty-router instance', () => {
            const builtRouter = router.build();

            expect(builtRouter).toBe(router.router);
        });

        it('should add 404 handler after build', () => {
            router.build();
            expect(router.router).toBeDefined();
        });

        it('should be callable after registering routes', () => {
            router.use('/test', async (ctx, next) => next());
            const builtRouter = router.build();

            expect(builtRouter).toBe(router.router);
        });

        it('should return 404 for unmatched routes', async () => {
            const builtRouter = router.build();
            const request = new Request('https://example.com/nonexistent');
            const env = { LOG_LEVEL: 'fatal' };

            const response = await builtRouter.fetch(request, env);

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body).toEqual({ error: 'Not found' });
        });
    });
});

describe('RouteHandler', () => {
    class TestHandler extends RouteHandler<Env> {}

    it('should throw 405 Method Not Allowed for unimplemented GET', async () => {
        const handler = new TestHandler('/test');
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });

        await expect(handler.get(ctx)).rejects.toThrow(HttpError);
        await expect(handler.get(ctx)).rejects.toThrow('Method Not Allowed');
    });

    it('should throw 405 Method Not Allowed for unimplemented POST', async () => {
        const handler = new TestHandler('/test');
        const ctx = createMockContext(new Request('https://example.com/test', { method: 'POST' }), {
            LOG_LEVEL: 'fatal',
        });

        await expect(handler.post(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented PUT', async () => {
        const handler = new TestHandler('/test');
        const ctx = createMockContext(new Request('https://example.com/test', { method: 'PUT' }), {
            LOG_LEVEL: 'fatal',
        });

        await expect(handler.put(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented DELETE', async () => {
        const handler = new TestHandler('/test');
        const ctx = createMockContext(
            new Request('https://example.com/test', { method: 'DELETE' }),
            { LOG_LEVEL: 'fatal' }
        );

        await expect(handler.delete(ctx)).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented PATCH', async () => {
        const handler = new TestHandler('/test');
        const ctx = createMockContext(
            new Request('https://example.com/test', { method: 'PATCH' }),
            { LOG_LEVEL: 'fatal' }
        );

        await expect(handler.patch(ctx)).rejects.toThrow(HttpError);
    });

    it('should initialize with custom logger', () => {
        const customLog = vi.fn() as any;
        customLog.setLevel = vi.fn();

        const handler = new TestHandler('/test', { log: customLog });

        expect(handler.log).toBe(customLog);
    });

    it('should create default logger if not provided', () => {
        const handler = new TestHandler('/test');

        expect(handler.log).toBeDefined();
    });

    it('should allow subclass to implement GET method', async () => {
        class CustomHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { message: 'custom GET' };
            }
        }

        const handler = new CustomHandler('/test');
        const ctx = createMockContext(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const result = await handler.get(ctx);

        expect(result).toEqual({ message: 'custom GET' });
    });

    it('should allow subclass to implement POST method', async () => {
        class CustomHandler extends RouteHandler<Env> {
            async post(ctx: Context<Env>) {
                return { message: 'custom POST' };
            }
        }

        const handler = new CustomHandler('/test');
        const ctx = createMockContext(new Request('https://example.com/test', { method: 'POST' }), {
            LOG_LEVEL: 'fatal',
        });
        const result = await handler.post(ctx);

        expect(result).toEqual({ message: 'custom POST' });
    });

    it('should receive params in handler methods via ctx', async () => {
        class ParamsHandler extends RouteHandler<Env, { id: string }> {
            async get(ctx: Context<Env, { id: string }>) {
                return { params: ctx.params };
            }
        }

        const handler = new ParamsHandler('/user/:id');
        const ctx = createMockContext<Env, { id: string }>(
            new Request('https://example.com/user/123'),
            { LOG_LEVEL: 'fatal' },
            { id: '123' }
        );
        const result = await handler.get(ctx);

        expect(result.params).toEqual({ id: '123' });
    });

    it('should allow customizing response via ctx.response in full router flow', async () => {
        class CustomResponseHandler extends RouteHandler<Env> {
            async post(ctx: Context<Env>) {
                ctx.response.status = 201;
                ctx.response.headers.set('X-Custom', 'header-value');
                ctx.response.headers.set('Set-Cookie', 'session=abc123');
                return { created: true };
            }
        }

        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');
        router.defineRouteHandler('/api/resource', CustomResponseHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/api/resource', { method: 'POST' });
        const response = await builtRouter.fetch(request, { LOG_LEVEL: 'fatal' });

        expect(response.status).toBe(201);
        expect(response.headers.get('X-Custom')).toBe('header-value');
        expect(response.headers.get('Set-Cookie')).toBe('session=abc123');
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const body = await response.json();
        expect(body).toEqual({ created: true });
    });

    it('should allow returning Response directly for full control', async () => {
        class FullControlHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return new Response('<html><body>Hello</body></html>', {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html',
                        'X-Custom-Header': 'custom-value',
                    },
                });
            }
        }

        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');
        router.defineRouteHandler('/page', FullControlHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/page');
        const response = await builtRouter.fetch(request, { LOG_LEVEL: 'fatal' });

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/html');
        expect(response.headers.get('X-Custom-Header')).toBe('custom-value');

        const body = await response.text();
        expect(body).toBe('<html><body>Hello</body></html>');
    });

    it('should have fresh response context for each request', async () => {
        let callCount = 0;

        class FreshContextHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                callCount++;
                // Context should always start with default status 200
                const wasDefault = ctx.response.status === 200;
                ctx.response.status = 201;
                return { callCount, wasDefault };
            }
        }

        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');
        router.defineRouteHandler('/api/test', FreshContextHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/api/test');
        const env = { LOG_LEVEL: 'fatal' };

        // First request
        const response1 = await builtRouter.fetch(request, env);
        const body1 = await response1.json();
        expect(body1.wasDefault).toBe(true);
        expect(response1.status).toBe(201);

        // Second request - should have fresh context with default status
        const response2 = await builtRouter.fetch(request, env);
        const body2 = await response2.json();
        expect(body2.wasDefault).toBe(true);
        expect(response2.status).toBe(201);
    });
});

describe('WorkerRouter CORS Configuration', () => {
    it('should use CorsConfig when provided to constructor', async () => {
        const router = new WorkerRouter<Env>('test', {
            cors: { origins: 'https://example.com', credentials: true },
        });
        router.log.setLevel('fatal');

        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/test', {
            headers: { Origin: 'https://example.com' },
        });
        const response = await builtRouter.fetch(request, { LOG_LEVEL: 'fatal' });

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should support origin array with dynamic matching', async () => {
        const router = new WorkerRouter<Env>('test', {
            cors: {
                origins: ['https://app1.example.com', 'https://app2.example.com'],
                credentials: true,
            },
        });
        router.log.setLevel('fatal');

        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        // Request from allowed origin
        const request1 = new Request('https://example.com/test', {
            headers: { Origin: 'https://app1.example.com' },
        });
        const response1 = await builtRouter.fetch(request1, { LOG_LEVEL: 'fatal' });
        expect(response1.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app1.example.com'
        );
        expect(response1.headers.get('Vary')).toBe('Origin');

        // Request from non-allowed origin
        const request2 = new Request('https://example.com/test', {
            headers: { Origin: 'https://malicious.com' },
        });
        const response2 = await builtRouter.fetch(request2, { LOG_LEVEL: 'fatal' });
        expect(response2.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should use dynamic handler.cors() method and apply consistently to OPTIONS and actual responses', async () => {
        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        class HandlerWithDynamicCors extends RouteHandler<Env> {
            cors(ctx: Context<Env>) {
                const origin = ctx.request.headers.get('Origin');
                if (origin === 'https://allowed.example.com') {
                    return { origins: origin, credentials: true };
                }
                return undefined;
            }

            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', HandlerWithDynamicCors);
        const builtRouter = router.build();

        // Test OPTIONS request from allowed origin
        const optionsRequest = new Request('https://example.com/test', {
            method: 'OPTIONS',
            headers: { Origin: 'https://allowed.example.com' },
        });
        const optionsResponse = await builtRouter.fetch(optionsRequest, { LOG_LEVEL: 'fatal' });

        expect(optionsResponse.status).toBe(204);
        expect(optionsResponse.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://allowed.example.com'
        );
        expect(optionsResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');

        // Test GET request - should have same CORS headers
        const getRequest = new Request('https://example.com/test', {
            headers: { Origin: 'https://allowed.example.com' },
        });
        const getResponse = await builtRouter.fetch(getRequest, { LOG_LEVEL: 'fatal' });

        expect(getResponse.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://allowed.example.com'
        );
        expect(getResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');

        // Test request from non-allowed origin - no CORS origin header
        const blockedRequest = new Request('https://example.com/test', {
            headers: { Origin: 'https://blocked.example.com' },
        });
        const blockedResponse = await builtRouter.fetch(blockedRequest, { LOG_LEVEL: 'fatal' });
        expect(blockedResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should prefer handler.cors() over router.corsConfig', async () => {
        const router = new WorkerRouter<Env>('test', {
            cors: { origins: 'https://router.example.com' },
        });
        router.log.setLevel('fatal');

        class HandlerWithOwnCors extends RouteHandler<Env> {
            cors(ctx: Context<Env>) {
                return { origins: 'https://handler.example.com' as const };
            }

            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        class HandlerWithoutCors extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/with-cors', HandlerWithOwnCors);
        router.defineRouteHandler('/without-cors', HandlerWithoutCors);
        const builtRouter = router.build();

        // Handler with own cors should use handler's config
        const request1 = new Request('https://example.com/with-cors');
        const response1 = await builtRouter.fetch(request1, { LOG_LEVEL: 'fatal' });
        expect(response1.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://handler.example.com'
        );

        // Handler without cors should fall back to router's config
        const request2 = new Request('https://example.com/without-cors');
        const response2 = await builtRouter.fetch(request2, { LOG_LEVEL: 'fatal' });
        expect(response2.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://router.example.com'
        );
    });

    it('should use router corsConfig for catch-all OPTIONS when no handler cors', async () => {
        const router = new WorkerRouter<Env>('test', {
            cors: { origins: '*' },
        });
        router.log.setLevel('fatal');

        class DefaultHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', DefaultHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/test', {
            method: 'OPTIONS',
        });
        const response = await builtRouter.fetch(request, { LOG_LEVEL: 'fatal' });

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should allow cors() to use request context for dynamic decisions', async () => {
        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        class ContextAwareCorsHandler extends RouteHandler<Env, { id: string }> {
            cors(ctx: Context<Env, { id: string }>) {
                // Different CORS for different resource IDs
                if (ctx.params.id === 'public') {
                    return { origins: '*' };
                }
                // Private resources only from specific origin
                return { origins: 'https://admin.example.com', credentials: true };
            }

            async get(ctx: Context<Env, { id: string }>) {
                return { id: ctx.params.id };
            }
        }

        router.defineRouteHandler('/resource/:id', ContextAwareCorsHandler);
        const builtRouter = router.build();

        // Public resource - allows any origin
        const publicRequest = new Request('https://example.com/resource/public');
        const publicResponse = await builtRouter.fetch(publicRequest, { LOG_LEVEL: 'fatal' });
        expect(publicResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');

        // Private resource - only specific origin
        const privateRequest = new Request('https://example.com/resource/secret', {
            headers: { Origin: 'https://admin.example.com' },
        });
        const privateResponse = await builtRouter.fetch(privateRequest, { LOG_LEVEL: 'fatal' });
        expect(privateResponse.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://admin.example.com'
        );
        expect(privateResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
});

describe('Middleware with next() pattern', () => {
    it('should execute middleware before handler', async () => {
        const executionOrder: string[] = [];

        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        router.use(async (ctx, next) => {
            executionOrder.push('middleware-before');
            const response = await next();
            executionOrder.push('middleware-after');
            return response;
        });

        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                executionOrder.push('handler');
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        await builtRouter.fetch(new Request('https://example.com/test'), { LOG_LEVEL: 'fatal' });

        expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after']);
    });

    it('should allow middleware to short-circuit', async () => {
        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        router.use(async (ctx, next) => {
            // Short-circuit without calling next()
            return new Response(JSON.stringify({ cached: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                // This should not be called
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        const response = await builtRouter.fetch(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const body = await response.json();

        expect(body).toEqual({ cached: true });
    });

    it('should allow middleware to set data for handler', async () => {
        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        router.use(async (ctx, next) => {
            ctx.data.user = { id: '123', name: 'Test User' };
            return next();
        });

        class TestHandler extends RouteHandler<
            Env,
            Record<string, string>,
            { user: { id: string; name: string } }
        > {
            async get(
                ctx: Context<Env, Record<string, string>, { user: { id: string; name: string } }>
            ) {
                return { user: ctx.data.user };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        const response = await builtRouter.fetch(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });
        const body = await response.json();

        expect(body).toEqual({ user: { id: '123', name: 'Test User' } });
    });

    it('should handle errors thrown in middleware', async () => {
        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');

        router.use(async (ctx, next) => {
            throw new HttpError(401, 'Unauthorized', { code: 'AUTH_FAILED' });
        });

        class TestHandler extends RouteHandler<Env> {
            async get(ctx: Context<Env>) {
                return { data: 'test' };
            }
        }

        router.defineRouteHandler('/test', TestHandler);
        const builtRouter = router.build();

        const response = await builtRouter.fetch(new Request('https://example.com/test'), {
            LOG_LEVEL: 'fatal',
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body).toEqual({ error: 'Unauthorized', code: 'AUTH_FAILED' });
    });
});
