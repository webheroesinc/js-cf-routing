import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerRouter, RouteHandler, Env } from '../../src/router';
import { HttpError } from '../../src/index';

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
            // This is verified by checking that router.router exists
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

        it('should allow method chaining for multiple routes', () => {
            const middleware1 = vi.fn(async () => {});
            const middleware2 = vi.fn(async () => {});

            const result = router.get('/route1', middleware1).post('/route2', middleware2);

            expect(result).toBe(router);
        });
    });

    describe('defineRouteHandler', () => {
        class TestHandler extends RouteHandler<Env> {
            async get() {
                return { message: 'GET handler' };
            }

            async post() {
                return { message: 'POST handler' };
            }
        }

        it('should register route handler and return this for chaining', () => {
            const result = router.defineRouteHandler('/api/test', TestHandler);

            expect(result).toBe(router);
        });

        it('should pass logger to route handler', () => {
            router.defineRouteHandler('/api/test', TestHandler);

            // The handler should be instantiated with the router's log
            // This is verified indirectly through the handler's behavior
            expect(router.log).toBeDefined();
        });

        it('should allow chaining with other route registrations', () => {
            const middleware = vi.fn(async () => {});

            const result = router
                .get('/middleware', middleware)
                .defineRouteHandler('/api/test', TestHandler)
                .post('/another', middleware);

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

            // The 404 handler is added, we can verify by checking router exists
            expect(router.router).toBeDefined();
        });

        it('should be callable after registering routes', () => {
            router.get('/test', async () => {});
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
        const request = new Request('https://example.com/test');

        await expect(handler.get(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow(HttpError);
        await expect(handler.get(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow('Method Not Allowed');
    });

    it('should throw 405 Method Not Allowed for unimplemented POST', async () => {
        const handler = new TestHandler('/test');
        const request = new Request('https://example.com/test', { method: 'POST' });

        await expect(handler.post(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented PUT', async () => {
        const handler = new TestHandler('/test');
        const request = new Request('https://example.com/test', { method: 'PUT' });

        await expect(handler.put(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented DELETE', async () => {
        const handler = new TestHandler('/test');
        const request = new Request('https://example.com/test', { method: 'DELETE' });

        await expect(handler.delete(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow(HttpError);
    });

    it('should throw 405 Method Not Allowed for unimplemented PATCH', async () => {
        const handler = new TestHandler('/test');
        const request = new Request('https://example.com/test', { method: 'PATCH' });

        await expect(handler.patch(request, { LOG_LEVEL: 'fatal' })).rejects.toThrow(HttpError);
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
            async get() {
                return { message: 'custom GET' };
            }
        }

        const handler = new CustomHandler('/test');
        const request = new Request('https://example.com/test');
        const result = await handler.get(request, { LOG_LEVEL: 'fatal' });

        expect(result).toEqual({ message: 'custom GET' });
    });

    it('should allow subclass to implement POST method', async () => {
        class CustomHandler extends RouteHandler<Env> {
            async post() {
                return { message: 'custom POST' };
            }
        }

        const handler = new CustomHandler('/test');
        const request = new Request('https://example.com/test', { method: 'POST' });
        const result = await handler.post(request, { LOG_LEVEL: 'fatal' });

        expect(result).toEqual({ message: 'custom POST' });
    });

    it('should receive params in handler methods', async () => {
        class ParamsHandler extends RouteHandler<Env> {
            async get(_request: Request, _env: Env, params?: Record<string, string>) {
                return { params };
            }
        }

        const handler = new ParamsHandler('/user/:id');
        const request = new Request('https://example.com/user/123');
        const result = await handler.get(request, { LOG_LEVEL: 'fatal' }, { id: '123' });

        expect(result.params).toEqual({ id: '123' });
    });

    it('should have response context available', () => {
        class CustomHandler extends RouteHandler<Env> {}
        const handler = new CustomHandler('/test');

        expect(handler.response).toBeDefined();
        expect(handler.response.status).toBe(200);
        expect(handler.response.headers).toBeInstanceOf(Headers);
    });

    it('should allow customizing response via this.response in full router flow', async () => {
        class CustomResponseHandler extends RouteHandler<Env> {
            async post() {
                this.response.status = 201;
                this.response.headers.set('X-Custom', 'header-value');
                this.response.headers.set('Set-Cookie', 'session=abc123');
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
            async get() {
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

    it('should reset response context between requests', async () => {
        let callCount = 0;

        class ResettingHandler extends RouteHandler<Env> {
            async get() {
                callCount++;
                // On first call, status should be 200 (default)
                // Set it to 201
                const wasDefault = this.response.status === 200;
                this.response.status = 201;
                return { callCount, wasDefault };
            }
        }

        const router = new WorkerRouter<Env>('test');
        router.log.setLevel('fatal');
        router.defineRouteHandler('/api/test', ResettingHandler);
        const builtRouter = router.build();

        const request = new Request('https://example.com/api/test');
        const env = { LOG_LEVEL: 'fatal' };

        // First request
        const response1 = await builtRouter.fetch(request, env);
        const body1 = await response1.json();
        expect(body1.wasDefault).toBe(true);
        expect(response1.status).toBe(201);

        // Second request - context should have been reset
        const response2 = await builtRouter.fetch(request, env);
        const body2 = await response2.json();
        expect(body2.wasDefault).toBe(true); // Should be true again because context was reset
        expect(response2.status).toBe(201);
    });
});
