import { HttpError } from '@whi/http-errors';
import { Router } from 'itty-router';
import { corsHeaders, CorsConfig, buildCorsHeaders } from './cors.js';
import { ResponseContext } from './response-context.js';
import Loganite from 'loganite';

// Add type definitions for request augmentation
declare global {
    interface Request {
        params?: Record<string, string>;
    }
}

/**
 * Base environment interface for Cloudflare Workers
 * @category Types
 */
export interface Env {
    /** Logging level (e.g., 'debug', 'info', 'warn', 'error', 'fatal') */
    LOG_LEVEL: string;
}

/**
 * Wrapper function to handle JSON responses and errors for route handlers
 *
 * Supports three return patterns:
 * 1. Return a Response object directly for full control
 * 2. Modify this.response (ResponseContext) and return data for the body
 * 3. Return plain data (current behavior - JSON serialized with defaults)
 *
 * @param handler The route handler function
 * @param responseContext Optional ResponseContext for customizing response properties
 * @param getCorsConfig Function to get CORS config dynamically from the handler
 * @returns A wrapped handler function that handles JSON responses and errors
 */
export const handleRoute = <E extends Env>(
    worker_router: WorkerRouter<E>,
    handler: (request: Request, env: E, params?: Record<string, string>) => Promise<any>,
    responseContext?: ResponseContext,
    getCorsConfig?: (request: Request, env: E, params?: Record<string, string>) => CorsConfig | undefined
) => {
    return async (request: Request, env: E) => {
        try {
            if (env.LOG_LEVEL) worker_router.log.setLevel(env.LOG_LEVEL);
            worker_router.log.trace(`Incoming request %s '%s'`, request.method, request.url);

            // Reset context before each request if provided
            if (responseContext) {
                responseContext.reset();
            }

            const result = await handler(request, env, request.params);

            // If handler returns a Response directly, use it as-is
            if (result instanceof Response) {
                return result;
            }

            // Get CORS headers: handler.cors() > router.corsConfig > defaults
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = getCorsConfig?.(request, env, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? worker_router.corsConfig;
            const corsHeadersToApply = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            // Build response using context settings (if provided) merged with defaults
            const headers = new Headers({
                'Content-Type': 'application/json',
                ...corsHeadersToApply,
            });

            // Merge in any custom headers from the context (overrides defaults)
            if (responseContext) {
                responseContext.headers.forEach((value, key) => {
                    headers.set(key, value);
                });
            }

            return new Response(JSON.stringify(result), {
                status: responseContext?.status ?? 200,
                statusText: responseContext?.statusText ?? 'OK',
                headers,
            });
        } catch (error) {
            worker_router.log.error(`Error in route handler: ${error}`);
            const status = error instanceof HttpError ? error.status : 500;
            const message = error instanceof HttpError ? error.message : 'Internal Server Error';

            // Get CORS headers: handler.cors() > router.corsConfig > defaults
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = getCorsConfig?.(request, env, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? worker_router.corsConfig;
            const corsHeadersToApply = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: message }), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        }
    };
};

/**
 * Route parameters extracted from URL path
 * @category Types
 */
export type Params = Record<string, string>;

/**
 * Middleware function type for WorkerRouter
 * @typeParam P - Route parameters type
 * @category Types
 */
export type Middleware<P extends Params = Params> = (
    request: Request,
    env: any,
    params: P
) => Promise<void> | void;

/**
 * Wrapper function for middleware to handle errors consistently
 *
 * @param middleware The middleware function
 * @returns A wrapped middleware function that handles errors
 */
export function handleMiddleware<P extends Params = Params>(
    worker_router: WorkerRouter<any>,
    middleware: Middleware<P>
) {
    return async (request: Request, env: any) => {
        try {
            if (env.LOG_LEVEL) worker_router.log.setLevel(env.LOG_LEVEL);
            await middleware(request, env, request.params as P);
            return null; // Continue to next middleware/handler
        } catch (error) {
            worker_router.log.error(`Error in middleware: ${error}`);
            const status = error instanceof HttpError ? error.status : 500;
            const message = error instanceof HttpError ? error.message : 'Internal Server Error';

            // Get CORS headers based on config
            const requestOrigin = request.headers.get('Origin');
            const corsHeadersToApply = worker_router.corsConfig
                ? buildCorsHeaders(worker_router.corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: message }), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        }
    };
}

/**
 * Base class for route handlers in WorkerRouter
 *
 * Extend this class to create handlers for specific routes. By default, all HTTP methods
 * throw a 405 Method Not Allowed error. Override the methods you want to support.
 *
 * Response customization:
 * - Use `this.response` to modify status, statusText, or headers before returning data
 * - Return a `Response` object directly for full control
 * - Return plain data for default JSON serialization
 *
 * @typeParam E - Environment type
 * @typeParam P - Route parameters type
 *
 * @category Handlers
 *
 * @example
 * ```typescript
 * class UserHandler extends RouteHandler<Env, { id: string }> {
 *   async get(request, env, params) {
 *     return { userId: params.id };
 *   }
 *
 *   async post(request, env, params) {
 *     const body = await request.json();
 *     // Customize response
 *     this.response.status = 201;
 *     this.response.headers.set('X-Created-Id', params.id);
 *     return { userId: params.id, created: true, data: body };
 *   }
 * }
 *
 * router.defineRouteHandler('/users/:id', UserHandler);
 * ```
 */
export abstract class RouteHandler<E = any, P extends Params = Params> {
    protected path: string;
    log: Loganite;

    /**
     * Response context for customizing the response.
     * Modify status, statusText, or headers before returning data.
     *
     * @example
     * ```typescript
     * this.response.status = 201;
     * this.response.headers.set('Set-Cookie', 'session=abc123');
     * return { created: true };
     * ```
     */
    response: ResponseContext;

    constructor(path: string, options?: { log?: Loganite }) {
        this.path = path;
        this.response = new ResponseContext();

        if (options?.log) this.log = options.log;
        else this.log = new Loganite(path, 'fatal');
    }

    /**
     * Define CORS configuration for this route handler.
     * Override this method to enable CORS with dynamic configuration based on the request.
     * The same config is automatically applied to both OPTIONS preflight and actual responses.
     *
     * Return undefined to use the router's default CORS config (if any).
     *
     * @example
     * ```typescript
     * class MyHandler extends RouteHandler<Env> {
     *   cors(request: Request, env: Env): CorsConfig | undefined {
     *     const origin = request.headers.get('Origin');
     *     if (origin?.endsWith('.myapp.com')) {
     *       return { origins: origin, credentials: true };
     *     }
     *     return undefined; // Use router default or no CORS
     *   }
     *
     *   async get() {
     *     return { data: 'hello' };
     *   }
     * }
     * ```
     */
    cors(request: Request, env: E, params?: P): CorsConfig | undefined {
        return undefined;
    }

    // HTTP method handlers that can be implemented by subclasses
    async get(request: Request, env: E, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async post(request: Request, env: E, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async put(request: Request, env: E, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async delete(request: Request, env: E, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async patch(request: Request, env: E, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }
}

/**
 * Options for WorkerRouter constructor
 *
 * @category Types
 */
export interface WorkerRouterOptions {
    /**
     * CORS configuration for the router.
     * If not provided, default CORS headers (without Access-Control-Allow-Origin) are used.
     */
    cors?: CorsConfig;
}

/**
 * Router for Cloudflare Workers with class-based handlers and automatic error handling
 *
 * @typeParam E - Environment type extending base Env interface
 *
 * @category Routers
 *
 * @example
 * ```typescript
 * const router = new WorkerRouter<Env>('my-worker')
 *   .defineRouteHandler('/health', HealthHandler)
 *   .get('/ping', async () => ({ message: 'pong' }))
 *   .build();
 *
 * export default {
 *   async fetch(request, env, ctx) {
 *     return router.fetch(request, env, ctx);
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // With CORS configuration
 * const router = new WorkerRouter<Env>('my-worker', {
 *   cors: {
 *     origins: ['https://myapp.com', 'https://staging.myapp.com'],
 *     credentials: true,
 *   }
 * });
 * ```
 */
export class WorkerRouter<E extends Env> {
    /** Router name for logging */
    name: string;
    /** Logger instance */
    log: Loganite;
    /** Underlying itty-router instance */
    router: ReturnType<typeof Router>;
    /** CORS configuration */
    corsConfig?: CorsConfig;

    /**
     * Create a new WorkerRouter
     * @param name - Router name (default: 'unnamed')
     * @param options - Router options including CORS configuration
     * @param args - Additional arguments passed to itty-router
     */
    constructor(
        name: string = 'unnamed',
        options?: WorkerRouterOptions,
        ...args: Parameters<typeof Router>
    ) {
        this.name = name;
        this.corsConfig = options?.cors;
        this.router = Router(...args);
        this.log = new Loganite(name, 'fatal');
    }

    /**
     * Register middleware for all HTTP methods
     * @param path - Route path pattern (e.g., '/api/*')
     * @param middleware - Middleware function
     * @returns This router instance for chaining
     */
    all<P extends Params = Params>(path: string, middleware: Middleware<P>): WorkerRouter<E> {
        this.router.all(path, handleMiddleware(this, middleware));
        return this;
    }

    /**
     * Register middleware for GET requests
     * @param path - Route path pattern
     * @param middleware - Middleware function
     * @returns This router instance for chaining
     */
    get(path: string, middleware: Middleware): WorkerRouter<E> {
        this.router.get(path, handleMiddleware(this, middleware));
        return this;
    }

    post(path: string, middleware: Middleware): WorkerRouter<E> {
        this.router.post(path, handleMiddleware(this, middleware));
        return this;
    }

    put(path: string, middleware: Middleware): WorkerRouter<E> {
        this.router.put(path, handleMiddleware(this, middleware));
        return this;
    }

    delete(path: string, middleware: Middleware): WorkerRouter<E> {
        this.router.delete(path, handleMiddleware(this, middleware));
        return this;
    }

    patch(path: string, middleware: Middleware): WorkerRouter<E> {
        this.router.patch(path, handleMiddleware(this, middleware));
        return this;
    }

    /**
     * Register a class-based route handler for all HTTP methods
     *
     * Automatically registers GET, POST, PUT, DELETE, and PATCH methods from the handler class.
     *
     * @param path - Route path pattern (e.g., '/users/:id')
     * @param handler_cls - RouteHandler class to instantiate
     * @returns This router instance for chaining
     *
     * @example
     * ```typescript
     * class UserHandler extends RouteHandler<Env, { id: string }> {
     *   async get(request, env, params) {
     *     return { userId: params.id };
     *   }
     * }
     *
     * router.defineRouteHandler('/users/:id', UserHandler);
     * ```
     */
    defineRouteHandler(
        path: string,
        handler_cls: new (...args: ConstructorParameters<typeof RouteHandler>) => RouteHandler<E>
    ): WorkerRouter<E> {
        const handler = new handler_cls(path, {
            log: this.log,
        });

        // Create a function to get CORS config dynamically from the handler
        const getCorsConfig = (request: Request, env: E, params?: Record<string, string>) =>
            handler.cors(request, env, params);

        // Register OPTIONS handler with consistent CORS headers (calls handler.cors())
        this.router.options(path, (request: Request, env: E) => {
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = handler.cors(request, env, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;
            const headersToUse = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Register each HTTP method with the router, passing the dynamic CORS getter
        this.router.post(
            path,
            handleRoute(
                this,
                (request: Request, env: E, params?: Record<string, string>) =>
                    handler.post(request, env, params),
                handler.response,
                getCorsConfig
            )
        );
        this.router.get(
            path,
            handleRoute(
                this,
                (request: Request, env: E, params?: Record<string, string>) =>
                    handler.get(request, env, params),
                handler.response,
                getCorsConfig
            )
        );
        this.router.put(
            path,
            handleRoute(
                this,
                (request: Request, env: E, params?: Record<string, string>) =>
                    handler.put(request, env, params),
                handler.response,
                getCorsConfig
            )
        );
        this.router.delete(
            path,
            handleRoute(
                this,
                (request: Request, env: E, params?: Record<string, string>) =>
                    handler.delete(request, env, params),
                handler.response,
                getCorsConfig
            )
        );
        this.router.patch(
            path,
            handleRoute(
                this,
                (request: Request, env: E, params?: Record<string, string>) =>
                    handler.patch(request, env, params),
                handler.response,
                getCorsConfig
            )
        );

        return this;
    }

    /**
     * Build the router and add 404 handler
     *
     * Must be called before using the router in a Worker's fetch handler.
     *
     * @returns The underlying itty-router instance
     *
     * @example
     * ```typescript
     * const router = new WorkerRouter('my-worker')
     *   .defineRouteHandler('/health', HealthHandler)
     *   .build();
     *
     * export default {
     *   async fetch(request, env, ctx) {
     *     return router.fetch(request, env, ctx);
     *   }
     * };
     * ```
     */
    build(): WorkerRouter<E>['router'] {
        // Handle CORS preflight requests (catch-all for routes without custom OPTIONS handlers)
        // Registered here so specific route OPTIONS handlers take precedence
        this.router.options('*', (request: Request) => {
            const requestOrigin = request.headers.get('Origin');
            const headersToUse = this.corsConfig
                ? buildCorsHeaders(this.corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Handle 404 - Route not found
        this.router.all('*', (request: Request) => {
            const requestOrigin = request.headers.get('Origin');
            const corsHeadersToApply = this.corsConfig
                ? buildCorsHeaders(this.corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        });

        return this.router;
    }
}

/**
 * Wrapper function to handle JSON responses and errors for Durable Object route handlers
 *
 * Supports three return patterns:
 * 1. Return a Response object directly for full control
 * 2. Modify this.response (ResponseContext) and return data for the body
 * 3. Return plain data (current behavior - JSON serialized with defaults)
 *
 * @param handler The route handler function
 * @param responseContext Optional ResponseContext for customizing response properties
 * @param getCorsConfig Function to get CORS config dynamically, or static config
 * @param routerCorsConfig Router-level CORS config (fallback)
 * @returns A wrapped handler function that handles JSON responses and errors
 */
export const handleDurableObjectRoute = (
    handler: (request: Request, params?: Record<string, string>) => Promise<any>,
    responseContext?: ResponseContext,
    getCorsConfig?: (request: Request, params?: Record<string, string>) => CorsConfig | undefined,
    routerCorsConfig?: CorsConfig
) => {
    return async (request: Request) => {
        try {
            // Reset context before each request if provided
            if (responseContext) {
                responseContext.reset();
            }

            const result = await handler(request, request.params);

            // If handler returns a Response directly, use it as-is
            if (result instanceof Response) {
                return result;
            }

            // Get CORS headers: handler.cors() > router.corsConfig > defaults
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = getCorsConfig?.(request, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? routerCorsConfig;
            const corsHeadersToApply = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            // Build response using context settings (if provided) merged with defaults
            const headers = new Headers({
                'Content-Type': 'application/json',
                ...corsHeadersToApply,
            });

            // Merge in any custom headers from the context (overrides defaults)
            if (responseContext) {
                responseContext.headers.forEach((value, key) => {
                    headers.set(key, value);
                });
            }

            return new Response(JSON.stringify(result), {
                status: responseContext?.status ?? 200,
                statusText: responseContext?.statusText ?? 'OK',
                headers,
            });
        } catch (error) {
            // console.error(`Error in route handler: ${error}`);
            const status = error instanceof HttpError ? error.status : 500;
            const message = error instanceof HttpError ? error.message : 'Internal Server Error';

            // Get CORS headers: handler.cors() > router.corsConfig > defaults
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = getCorsConfig?.(request, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? routerCorsConfig;
            const corsHeadersToApply = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: message }), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        }
    };
};

/**
 * Middleware function type for DurableObjectRouter
 * @typeParam P - Route parameters type
 * @category Types
 */
export type DurableObjectMiddleware<P extends Params = Params> = (
    request: Request,
    params: P
) => Promise<void> | void;

/**
 * Wrapper function for middleware to handle errors consistently
 *
 * @param middleware The middleware function
 * @param corsConfig Optional CORS configuration
 * @returns A wrapped middleware function that handles errors
 */
export function handleDurableObjectMiddleware<P extends Params = Params>(
    middleware: DurableObjectMiddleware<P>,
    corsConfig?: CorsConfig
) {
    return async (request: Request) => {
        try {
            await middleware(request, request.params as P);
            return null; // Continue to next middleware/handler
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            const message = error instanceof HttpError ? error.message : 'Internal Server Error';

            // Get CORS headers based on config
            const requestOrigin = request.headers.get('Origin');
            const corsHeadersToApply = corsConfig
                ? buildCorsHeaders(corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: message }), {
                status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        }
    };
}

/**
 * Base class for route handlers in DurableObjectRouter
 *
 * Extend this class to create handlers for Durable Object routes with access to state and environment.
 * By default, all HTTP methods throw a 405 Method Not Allowed error. Override the methods you want to support.
 *
 * Response customization:
 * - Use `this.response` to modify status, statusText, or headers before returning data
 * - Return a `Response` object directly for full control
 * - Return plain data for default JSON serialization
 *
 * @typeParam E - Environment type
 * @typeParam P - Route parameters type
 *
 * @category Handlers
 *
 * @example
 * ```typescript
 * class CounterHandler extends DurableObjectRouteHandler<Env> {
 *   async get() {
 *     const count = await this.ctx.storage.get<number>('count') || 0;
 *     return { count };
 *   }
 *
 *   async post() {
 *     const current = await this.ctx.storage.get<number>('count') || 0;
 *     await this.ctx.storage.put('count', current + 1);
 *     this.response.status = 201;
 *     return { count: current + 1 };
 *   }
 * }
 * ```
 */
export abstract class DurableObjectRouteHandler<E extends Env, P extends Params = Params> {
    protected path: string;
    protected ctx: DurableObjectState;
    protected env: E;
    protected log: Loganite;

    /**
     * Response context for customizing the response.
     * Modify status, statusText, or headers before returning data.
     *
     * @example
     * ```typescript
     * this.response.status = 201;
     * this.response.headers.set('Set-Cookie', 'session=abc123');
     * return { created: true };
     * ```
     */
    response: ResponseContext;

    constructor(path: string, ctx: DurableObjectState, env: E, options?: { log?: Loganite }) {
        this.path = path;
        this.ctx = ctx;
        this.env = env;
        this.response = new ResponseContext();

        if (options?.log) this.log = options.log;
        else this.log = new Loganite(path, 'fatal');
    }

    /**
     * Define CORS configuration for this route handler.
     * Override this method to enable CORS with dynamic configuration based on the request.
     * The same config is automatically applied to both OPTIONS preflight and actual responses.
     *
     * Return undefined to use the router's default CORS config (if any).
     *
     * @example
     * ```typescript
     * class MyHandler extends DurableObjectRouteHandler<Env> {
     *   cors(request: Request): CorsConfig | undefined {
     *     const origin = request.headers.get('Origin');
     *     if (origin?.endsWith('.myapp.com')) {
     *       return { origins: origin, credentials: true };
     *     }
     *     return undefined;
     *   }
     *
     *   async get() {
     *     return { data: 'hello' };
     *   }
     * }
     * ```
     */
    cors(request: Request, params?: P): CorsConfig | undefined {
        return undefined;
    }

    // HTTP method handlers that can be implemented by subclasses
    async get(request: Request, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async post(request: Request, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async put(request: Request, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async delete(request: Request, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async patch(request: Request, params?: P): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }
}

/**
 * Options for DurableObjectRouter constructor
 *
 * @category Types
 */
export interface DurableObjectRouterOptions {
    /**
     * CORS configuration for the router.
     * If not provided, default CORS headers (without Access-Control-Allow-Origin) are used.
     */
    cors?: CorsConfig;
}

/**
 * Router for Cloudflare Durable Objects with class-based handlers and state management
 *
 * @typeParam E - Environment type extending base Env interface
 *
 * @category Routers
 *
 * @example
 * ```typescript
 * export class Counter implements DurableObject {
 *   private router: DurableObjectRouter<Env>;
 *
 *   constructor(ctx: DurableObjectState, env: Env) {
 *     this.router = new DurableObjectRouter(ctx, env, 'counter')
 *       .defineRouteHandler('/count', CounterHandler)
 *       .defineRouteHandler('/reset', ResetHandler);
 *   }
 *
 *   async fetch(request: Request): Promise<Response> {
 *     return this.router.handle(request);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With CORS configuration
 * const router = new DurableObjectRouter(ctx, env, 'counter', {
 *   cors: {
 *     origins: ['https://myapp.com'],
 *     credentials: true,
 *   }
 * });
 * ```
 */
export class DurableObjectRouter<E extends Env> {
    /** Logger instance */
    log: Loganite;
    /** Router name for logging */
    name: string;
    /** Underlying itty-router instance */
    router: ReturnType<typeof Router>;
    /** Durable Object state */
    ctx: DurableObjectState;
    /** Environment bindings */
    env: E;
    /** CORS configuration */
    corsConfig?: CorsConfig;
    private is_built: boolean = false;

    /**
     * Create a new DurableObjectRouter
     * @param ctx - Durable Object state
     * @param env - Environment bindings
     * @param name - Router name for logging
     * @param options - Router options including CORS configuration
     * @param args - Additional arguments passed to itty-router
     */
    constructor(
        ctx: DurableObjectState,
        env: E,
        name: string,
        options?: DurableObjectRouterOptions,
        ...args: Parameters<typeof Router>
    ) {
        this.name = name;
        this.ctx = ctx;
        this.env = env;
        this.corsConfig = options?.cors;
        this.router = Router(...args);
        this.log = new Loganite(name, 'fatal');
    }

    all<P extends Params = Params>(
        path: string,
        middleware: DurableObjectMiddleware<P>
    ): DurableObjectRouter<E> {
        this.router.all(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    get(path: string, middleware: DurableObjectMiddleware): DurableObjectRouter<E> {
        this.router.get(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    post(path: string, middleware: DurableObjectMiddleware): DurableObjectRouter<E> {
        this.router.post(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    put(path: string, middleware: DurableObjectMiddleware): DurableObjectRouter<E> {
        this.router.put(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    delete(path: string, middleware: DurableObjectMiddleware): DurableObjectRouter<E> {
        this.router.delete(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    patch(path: string, middleware: DurableObjectMiddleware): DurableObjectRouter<E> {
        this.router.patch(path, handleDurableObjectMiddleware(middleware, this.corsConfig));
        return this;
    }

    defineRouteHandler(
        path: string,
        handler_cls: new (
            ...args: ConstructorParameters<typeof DurableObjectRouteHandler>
        ) => DurableObjectRouteHandler<E>
    ): DurableObjectRouter<E> {
        const handler = new handler_cls(path, this.ctx, this.env, {
            log: this.log,
        });

        // Create a function to get CORS config dynamically from the handler
        const getCorsConfig = (request: Request, params?: Record<string, string>) =>
            handler.cors(request, params);

        // Register OPTIONS handler with consistent CORS headers (calls handler.cors())
        this.router.options(path, (request: Request) => {
            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = handler.cors(request, request.params);
            const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;
            const headersToUse = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Register each HTTP method with the router, passing the dynamic CORS getter
        this.router.post(
            path,
            handleDurableObjectRoute(
                (request: Request, params?: Record<string, string>) =>
                    handler.post(request, params),
                handler.response,
                getCorsConfig,
                this.corsConfig
            )
        );
        this.router.get(
            path,
            handleDurableObjectRoute(
                (request: Request, params?: Record<string, string>) => handler.get(request, params),
                handler.response,
                getCorsConfig,
                this.corsConfig
            )
        );
        this.router.put(
            path,
            handleDurableObjectRoute(
                (request: Request, params?: Record<string, string>) => handler.put(request, params),
                handler.response,
                getCorsConfig,
                this.corsConfig
            )
        );
        this.router.delete(
            path,
            handleDurableObjectRoute(
                (request: Request, params?: Record<string, string>) =>
                    handler.delete(request, params),
                handler.response,
                getCorsConfig,
                this.corsConfig
            )
        );
        this.router.patch(
            path,
            handleDurableObjectRoute(
                (request: Request, params?: Record<string, string>) =>
                    handler.patch(request, params),
                handler.response,
                getCorsConfig,
                this.corsConfig
            )
        );

        return this;
    }

    build(): DurableObjectRouter<E>['router'] {
        if (this.is_built) {
            return this.router;
        }

        // Handle CORS preflight requests (catch-all for routes without custom OPTIONS handlers)
        // Registered here so specific route OPTIONS handlers take precedence
        this.router.options('*', (request: Request) => {
            const requestOrigin = request.headers.get('Origin');
            const headersToUse = this.corsConfig
                ? buildCorsHeaders(this.corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Handle 404 - Route not found
        this.router.all('*', (request: Request) => {
            const requestOrigin = request.headers.get('Origin');
            const corsHeadersToApply = this.corsConfig
                ? buildCorsHeaders(this.corsConfig, requestOrigin)
                : corsHeaders;

            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeadersToApply,
                },
            });
        });

        this.is_built = true;

        return this.router;
    }

    /**
     * Handle a request using the router
     *
     * Automatically builds the router if not already built.
     *
     * @param request - The request to handle
     * @returns A response promise
     *
     * @example
     * ```typescript
     * async fetch(request: Request): Promise<Response> {
     *   return this.router.handle(request);
     * }
     * ```
     */
    handle(request: Request): Promise<Response> {
        if (!this.is_built) {
            this.build();
        }
        return this.router.fetch(request) as Promise<Response>;
    }
}
