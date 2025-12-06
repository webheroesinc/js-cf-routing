import { HttpError } from '@whi/http-errors';
import { Router } from 'itty-router';
import { corsHeaders, CorsConfig, buildCorsHeaders } from './cors.js';
import { ResponseContext } from './response-context.js';
import { Context, Middleware, Params, Env } from './context.js';
import Loganite from 'loganite';

// Re-export types from context
export { Context, Middleware, Params, Env };

// Add type definitions for request augmentation
declare global {
    interface Request {
        params?: Record<string, string>;
    }
}

/**
 * Build a Response from handler return value and context settings.
 *
 * @param result The return value from a route handler
 * @param ctx The request context
 * @param corsConfig Optional CORS configuration
 * @returns A properly formatted Response
 */
export function buildResponse<E extends Env, P extends Params, S>(
    result: any,
    ctx: Context<E, P, S>,
    corsConfig?: CorsConfig
): Response {
    // If handler returns a Response directly, use it as-is
    if (result instanceof Response) {
        return result;
    }

    // Get CORS headers
    const requestOrigin = ctx.request.headers.get('Origin');
    const corsHeadersToApply = corsConfig
        ? buildCorsHeaders(corsConfig, requestOrigin)
        : corsHeaders;

    // Build response using context settings merged with defaults
    const headers = new Headers({
        'Content-Type': 'application/json',
        ...corsHeadersToApply,
    });

    // Merge in any custom headers from the context (overrides defaults)
    ctx.response.headers.forEach((value, key) => {
        headers.set(key, value);
    });

    return new Response(JSON.stringify(result), {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
    });
}

/**
 * Build an error Response from an error, preserving HttpError details and headers.
 *
 * @param error The error that was thrown
 * @param ctx The request context
 * @param corsConfig Optional CORS configuration
 * @returns An error Response
 */
export function buildErrorResponse<E extends Env, P extends Params, S>(
    error: unknown,
    ctx: Context<E, P, S>,
    corsConfig?: CorsConfig
): Response {
    ctx.log.error(`Error: ${error}`);

    // Get CORS headers
    const requestOrigin = ctx.request.headers.get('Origin');
    const corsHeadersToApply = corsConfig
        ? buildCorsHeaders(corsConfig, requestOrigin)
        : corsHeaders;

    if (error instanceof HttpError) {
        // Use HttpError.toResponse() to preserve details and headers
        const response = error.toResponse();

        // Create new headers merging CORS with error's headers
        const headers = new Headers({
            ...corsHeadersToApply,
        });
        response.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    // Unknown error - return 500
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeadersToApply,
        },
    });
}

/**
 * Creates a Context object for a request.
 *
 * @param request The incoming request
 * @param env Environment bindings
 * @param params Route parameters
 * @param log Logger instance
 * @returns A fresh Context object
 */
export function createContext<E extends Env, P extends Params, S = Record<string, any>>(
    request: Request,
    env: E,
    params: P,
    log: Loganite
): Context<E, P, S> {
    return {
        request,
        env,
        params,
        state: {} as S,
        response: new ResponseContext(),
        log,
    };
}

/**
 * Base class for route handlers in WorkerRouter
 *
 * Extend this class to create handlers for specific routes. By default, all HTTP methods
 * throw a 405 Method Not Allowed error. Override the methods you want to support.
 *
 * Response customization:
 * - Use `ctx.response` to modify status, statusText, or headers before returning data
 * - Return a `Response` object directly for full control
 * - Return plain data for default JSON serialization
 *
 * @typeParam E - Environment type
 * @typeParam P - Route parameters type
 * @typeParam S - State type for middleware-set data
 *
 * @category Handlers
 *
 * @example
 * ```typescript
 * class UserHandler extends RouteHandler<Env, { id: string }> {
 *   async get(ctx) {
 *     return { userId: ctx.params.id };
 *   }
 *
 *   async post(ctx) {
 *     const body = await ctx.request.json();
 *     // Customize response
 *     ctx.response.status = 201;
 *     ctx.response.headers.set('X-Created-Id', ctx.params.id);
 *     return { userId: ctx.params.id, created: true, data: body };
 *   }
 * }
 *
 * router.defineRouteHandler('/users/:id', UserHandler);
 * ```
 */
export abstract class RouteHandler<
    E extends Env = Env,
    P extends Params = Params,
    S = Record<string, any>,
> {
    protected path: string;
    log: Loganite;

    constructor(path: string, options?: { log?: Loganite }) {
        this.path = path;

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
     *   cors(ctx): CorsConfig | undefined {
     *     const origin = ctx.request.headers.get('Origin');
     *     if (origin?.endsWith('.myapp.com')) {
     *       return { origins: origin, credentials: true };
     *     }
     *     return undefined; // Use router default or no CORS
     *   }
     *
     *   async get(ctx) {
     *     return { data: 'hello' };
     *   }
     * }
     * ```
     */
    cors(ctx: Context<E, P, S>): CorsConfig | undefined {
        return undefined;
    }

    // HTTP method handlers that can be implemented by subclasses
    async get(ctx: Context<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async post(ctx: Context<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async put(ctx: Context<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async delete(ctx: Context<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async patch(ctx: Context<E, P, S>): Promise<any> {
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
 * Internal type for storing middleware with path patterns
 */
interface MiddlewareEntry<E extends Env> {
    path: string | null; // null means global (matches all)
    method: string | null; // null means all methods
    middleware: Middleware<E, any, any>;
}

/**
 * Router for Cloudflare Workers with class-based handlers and middleware support
 *
 * Features:
 * - Middleware with next() pattern (pre/post processing, short-circuit)
 * - Context object for sharing state between middleware and handlers
 * - Automatic error handling with HttpError support
 * - CORS configuration at router and handler level
 *
 * @typeParam E - Environment type extending base Env interface
 *
 * @category Routers
 *
 * @example
 * ```typescript
 * const router = new WorkerRouter<Env>('my-worker')
 *   .use(loggingMiddleware)
 *   .use('/api/*', authMiddleware)
 *   .defineRouteHandler('/users/:id', UserHandler)
 *   .build();
 *
 * export default {
 *   async fetch(request, env, ctx) {
 *     return router.fetch(request, env, ctx);
 *   }
 * };
 * ```
 */
export class WorkerRouter<E extends Env> {
    /** Router name for logging */
    name: string;
    /** Logger instance */
    log: Loganite;
    /** Underlying itty-router instance for path matching */
    router: ReturnType<typeof Router>;
    /** CORS configuration */
    corsConfig?: CorsConfig;
    /** Registered middlewares */
    private middlewares: MiddlewareEntry<E>[] = [];
    /** Whether the router has been built */
    private isBuilt: boolean = false;

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
     * Register global middleware or path-specific middleware
     *
     * @param pathOrMiddleware - Path pattern or middleware function
     * @param middleware - Middleware function (if path provided)
     * @returns This router instance for chaining
     *
     * @example
     * ```typescript
     * // Global middleware
     * router.use(loggingMiddleware);
     *
     * // Path-specific middleware
     * router.use('/api/*', authMiddleware);
     * ```
     */
    use<P extends Params = Params, S = Record<string, any>>(
        pathOrMiddleware: string | Middleware<E, P, S>,
        middleware?: Middleware<E, P, S>
    ): WorkerRouter<E> {
        if (typeof pathOrMiddleware === 'function') {
            // Global middleware
            this.middlewares.push({
                path: null,
                method: null,
                middleware: pathOrMiddleware,
            });
        } else {
            // Path-specific middleware
            if (!middleware) {
                throw new Error('Middleware function required when path is specified');
            }
            this.middlewares.push({
                path: pathOrMiddleware,
                method: null,
                middleware,
            });
        }
        return this;
    }

    /**
     * Register middleware for all HTTP methods on a path
     * @deprecated Use .use() instead for middleware. This will be removed in a future version.
     */
    all<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        return this.use(path, middleware);
    }

    /**
     * Register middleware for GET requests
     * @deprecated Use .use() for middleware or .defineRouteHandler() for route handlers.
     */
    get<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        this.middlewares.push({ path, method: 'GET', middleware });
        return this;
    }

    /**
     * @deprecated Use .use() for middleware or .defineRouteHandler() for route handlers.
     */
    post<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        this.middlewares.push({ path, method: 'POST', middleware });
        return this;
    }

    /**
     * @deprecated Use .use() for middleware or .defineRouteHandler() for route handlers.
     */
    put<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        this.middlewares.push({ path, method: 'PUT', middleware });
        return this;
    }

    /**
     * @deprecated Use .use() for middleware or .defineRouteHandler() for route handlers.
     */
    delete<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        this.middlewares.push({ path, method: 'DELETE', middleware });
        return this;
    }

    /**
     * @deprecated Use .use() for middleware or .defineRouteHandler() for route handlers.
     */
    patch<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: Middleware<E, P, S>
    ): WorkerRouter<E> {
        this.middlewares.push({ path, method: 'PATCH', middleware });
        return this;
    }

    /**
     * Register a class-based route handler for all HTTP methods
     *
     * @param path - Route path pattern (e.g., '/users/:id')
     * @param handler_cls - RouteHandler class to instantiate
     * @returns This router instance for chaining
     *
     * @example
     * ```typescript
     * class UserHandler extends RouteHandler<Env, { id: string }> {
     *   async get(ctx) {
     *     return { userId: ctx.params.id };
     *   }
     * }
     *
     * router.defineRouteHandler('/users/:id', UserHandler);
     * ```
     */
    defineRouteHandler<P extends Params = Params, S = Record<string, any>>(
        path: string,
        handler_cls: new (
            ...args: ConstructorParameters<typeof RouteHandler>
        ) => RouteHandler<E, P, S>
    ): WorkerRouter<E> {
        const handler = new handler_cls(path, {
            log: this.log,
        });

        // Register OPTIONS handler for CORS preflight
        this.router.options(path, (request: Request, env: E) => {
            const ctx = createContext<E, P, S>(request, env, (request.params || {}) as P, this.log);
            if (env.LOG_LEVEL) ctx.log.setLevel(env.LOG_LEVEL);

            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = handler.cors(ctx);
            const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;
            const headersToUse = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Create handler wrapper for each HTTP method
        const createMethodHandler = (method: 'get' | 'post' | 'put' | 'delete' | 'patch') => {
            return async (request: Request, env: E) => {
                const ctx = createContext<E, P, S>(
                    request,
                    env,
                    (request.params || {}) as P,
                    this.log
                );
                if (env.LOG_LEVEL) ctx.log.setLevel(env.LOG_LEVEL);
                ctx.log.trace(`Incoming request %s '%s'`, request.method, request.url);

                // Get CORS config for this handler
                const handlerCorsConfig = handler.cors(ctx);
                const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;

                // Build the middleware chain
                const matchingMiddlewares = this.getMatchingMiddlewares(request, path);

                // Final handler that calls the route handler method
                const finalHandler: Middleware<E, P, S> = async (ctx) => {
                    const result = await handler[method](ctx);
                    return buildResponse(result, ctx, effectiveCorsConfig);
                };

                // Execute the chain
                return this.executeChain(
                    ctx,
                    [...matchingMiddlewares, finalHandler],
                    effectiveCorsConfig
                );
            };
        };

        // Register each HTTP method
        this.router.get(path, createMethodHandler('get'));
        this.router.post(path, createMethodHandler('post'));
        this.router.put(path, createMethodHandler('put'));
        this.router.delete(path, createMethodHandler('delete'));
        this.router.patch(path, createMethodHandler('patch'));

        return this;
    }

    /**
     * Get middlewares that match the current request
     */
    private getMatchingMiddlewares(request: Request, path: string): Middleware<E, any, any>[] {
        const method = request.method;
        const url = new URL(request.url);

        return this.middlewares
            .filter((entry) => {
                // Check method match
                if (entry.method && entry.method !== method) {
                    return false;
                }

                // Check path match
                if (entry.path === null) {
                    return true; // Global middleware
                }

                // Simple path matching (supports wildcards like /api/*)
                const pattern = entry.path.replace(/\*/g, '.*').replace(/:[^/]+/g, '[^/]+');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(url.pathname);
            })
            .map((entry) => entry.middleware);
    }

    /**
     * Execute the middleware chain with next() pattern
     */
    private async executeChain<P extends Params, S>(
        ctx: Context<E, P, S>,
        middlewares: Middleware<E, P, S>[],
        corsConfig?: CorsConfig
    ): Promise<Response> {
        let index = 0;

        const next = async (): Promise<Response> => {
            if (index >= middlewares.length) {
                // No more middlewares - this shouldn't happen if chain is built correctly
                throw new Error('Middleware chain exhausted without returning a response');
            }

            const middleware = middlewares[index++];

            try {
                return await middleware(ctx, next);
            } catch (error) {
                return buildErrorResponse(error, ctx, corsConfig);
            }
        };

        try {
            return await next();
        } catch (error) {
            return buildErrorResponse(error, ctx, corsConfig);
        }
    }

    /**
     * Build the router and add 404 handler
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
        if (this.isBuilt) {
            return this.router;
        }

        // Handle CORS preflight requests (catch-all for routes without custom OPTIONS handlers)
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

        this.isBuilt = true;
        return this.router;
    }
}

/**
 * Context for Durable Object handlers, extends base Context with DO-specific fields
 *
 * @category Context
 */
export interface DurableObjectContext<E = Env, P = Params, S = Record<string, any>>
    extends Context<E, P, S> {
    /** Durable Object state for storage access */
    doState: DurableObjectState;
}

/**
 * Creates a Context object for a Durable Object request.
 */
export function createDurableObjectContext<
    E extends Env,
    P extends Params,
    S = Record<string, any>,
>(
    request: Request,
    env: E,
    params: P,
    doState: DurableObjectState,
    log: Loganite
): DurableObjectContext<E, P, S> {
    return {
        request,
        env,
        params,
        state: {} as S,
        response: new ResponseContext(),
        log,
        doState,
    };
}

/**
 * Middleware function type for DurableObjectRouter (uses next() pattern)
 * @category Types
 */
export type DurableObjectMiddleware<E = Env, P = Params, S = Record<string, any>> = (
    ctx: DurableObjectContext<E, P, S>,
    next: () => Promise<Response>
) => Promise<Response>;

/**
 * Base class for route handlers in DurableObjectRouter
 *
 * Extend this class to create handlers for Durable Object routes with access to state and environment.
 * By default, all HTTP methods throw a 405 Method Not Allowed error. Override the methods you want to support.
 *
 * Response customization:
 * - Use `ctx.response` to modify status, statusText, or headers before returning data
 * - Return a `Response` object directly for full control
 * - Return plain data for default JSON serialization
 *
 * @typeParam E - Environment type
 * @typeParam P - Route parameters type
 * @typeParam S - State type for middleware-set data
 *
 * @category Handlers
 *
 * @example
 * ```typescript
 * class CounterHandler extends DurableObjectRouteHandler<Env> {
 *   async get(ctx) {
 *     const count = await ctx.doState.storage.get<number>('count') || 0;
 *     return { count };
 *   }
 *
 *   async post(ctx) {
 *     const current = await ctx.doState.storage.get<number>('count') || 0;
 *     await ctx.doState.storage.put('count', current + 1);
 *     ctx.response.status = 201;
 *     return { count: current + 1 };
 *   }
 * }
 * ```
 */
export abstract class DurableObjectRouteHandler<
    E extends Env = Env,
    P extends Params = Params,
    S = Record<string, any>,
> {
    protected path: string;
    log: Loganite;

    constructor(path: string, options?: { log?: Loganite }) {
        this.path = path;

        if (options?.log) this.log = options.log;
        else this.log = new Loganite(path, 'fatal');
    }

    /**
     * Define CORS configuration for this route handler.
     */
    cors(ctx: DurableObjectContext<E, P, S>): CorsConfig | undefined {
        return undefined;
    }

    // HTTP method handlers that can be implemented by subclasses
    async get(ctx: DurableObjectContext<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async post(ctx: DurableObjectContext<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async put(ctx: DurableObjectContext<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async delete(ctx: DurableObjectContext<E, P, S>): Promise<any> {
        throw new HttpError(405, 'Method Not Allowed');
    }

    async patch(ctx: DurableObjectContext<E, P, S>): Promise<any> {
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
 * Internal type for storing middleware with path patterns (DurableObject version)
 */
interface DurableObjectMiddlewareEntry<E extends Env> {
    path: string | null;
    method: string | null;
    middleware: DurableObjectMiddleware<E, any, any>;
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
 *       .use(loggingMiddleware)
 *       .defineRouteHandler('/count', CounterHandler);
 *   }
 *
 *   async fetch(request: Request): Promise<Response> {
 *     return this.router.handle(request);
 *   }
 * }
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
    doState: DurableObjectState;
    /** Environment bindings */
    env: E;
    /** CORS configuration */
    corsConfig?: CorsConfig;
    /** Registered middlewares */
    private middlewares: DurableObjectMiddlewareEntry<E>[] = [];
    /** Whether the router has been built */
    private isBuilt: boolean = false;

    constructor(
        doState: DurableObjectState,
        env: E,
        name: string,
        options?: DurableObjectRouterOptions,
        ...args: Parameters<typeof Router>
    ) {
        this.name = name;
        this.doState = doState;
        this.env = env;
        this.corsConfig = options?.cors;
        this.router = Router(...args);
        this.log = new Loganite(name, 'fatal');
    }

    /**
     * Register global middleware or path-specific middleware
     */
    use<P extends Params = Params, S = Record<string, any>>(
        pathOrMiddleware: string | DurableObjectMiddleware<E, P, S>,
        middleware?: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        if (typeof pathOrMiddleware === 'function') {
            this.middlewares.push({
                path: null,
                method: null,
                middleware: pathOrMiddleware,
            });
        } else {
            if (!middleware) {
                throw new Error('Middleware function required when path is specified');
            }
            this.middlewares.push({
                path: pathOrMiddleware,
                method: null,
                middleware,
            });
        }
        return this;
    }

    /** @deprecated Use .use() instead */
    all<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        return this.use(path, middleware);
    }

    /** @deprecated Use .use() or .defineRouteHandler() */
    get<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        this.middlewares.push({ path, method: 'GET', middleware });
        return this;
    }

    /** @deprecated Use .use() or .defineRouteHandler() */
    post<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        this.middlewares.push({ path, method: 'POST', middleware });
        return this;
    }

    /** @deprecated Use .use() or .defineRouteHandler() */
    put<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        this.middlewares.push({ path, method: 'PUT', middleware });
        return this;
    }

    /** @deprecated Use .use() or .defineRouteHandler() */
    delete<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        this.middlewares.push({ path, method: 'DELETE', middleware });
        return this;
    }

    /** @deprecated Use .use() or .defineRouteHandler() */
    patch<P extends Params = Params, S = Record<string, any>>(
        path: string,
        middleware: DurableObjectMiddleware<E, P, S>
    ): DurableObjectRouter<E> {
        this.middlewares.push({ path, method: 'PATCH', middleware });
        return this;
    }

    defineRouteHandler<P extends Params = Params, S = Record<string, any>>(
        path: string,
        handler_cls: new (
            ...args: ConstructorParameters<typeof DurableObjectRouteHandler>
        ) => DurableObjectRouteHandler<E, P, S>
    ): DurableObjectRouter<E> {
        const handler = new handler_cls(path, {
            log: this.log,
        });

        // Register OPTIONS handler for CORS preflight
        this.router.options(path, (request: Request) => {
            const ctx = createDurableObjectContext<E, P, S>(
                request,
                this.env,
                (request.params || {}) as P,
                this.doState,
                this.log
            );

            const requestOrigin = request.headers.get('Origin');
            const handlerCorsConfig = handler.cors(ctx);
            const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;
            const headersToUse = effectiveCorsConfig
                ? buildCorsHeaders(effectiveCorsConfig, requestOrigin)
                : corsHeaders;

            return new Response(null, {
                status: 204,
                headers: headersToUse,
            });
        });

        // Create handler wrapper for each HTTP method
        const createMethodHandler = (method: 'get' | 'post' | 'put' | 'delete' | 'patch') => {
            return async (request: Request) => {
                const ctx = createDurableObjectContext<E, P, S>(
                    request,
                    this.env,
                    (request.params || {}) as P,
                    this.doState,
                    this.log
                );
                if (this.env.LOG_LEVEL) ctx.log.setLevel(this.env.LOG_LEVEL);

                const handlerCorsConfig = handler.cors(ctx);
                const effectiveCorsConfig = handlerCorsConfig ?? this.corsConfig;

                const matchingMiddlewares = this.getMatchingMiddlewares(request, path);

                const finalHandler: DurableObjectMiddleware<E, P, S> = async (ctx) => {
                    const result = await handler[method](ctx);
                    return buildResponse(result, ctx, effectiveCorsConfig);
                };

                return this.executeChain(
                    ctx,
                    [...matchingMiddlewares, finalHandler],
                    effectiveCorsConfig
                );
            };
        };

        this.router.get(path, createMethodHandler('get'));
        this.router.post(path, createMethodHandler('post'));
        this.router.put(path, createMethodHandler('put'));
        this.router.delete(path, createMethodHandler('delete'));
        this.router.patch(path, createMethodHandler('patch'));

        return this;
    }

    private getMatchingMiddlewares(
        request: Request,
        path: string
    ): DurableObjectMiddleware<E, any, any>[] {
        const method = request.method;
        const url = new URL(request.url);

        return this.middlewares
            .filter((entry) => {
                if (entry.method && entry.method !== method) {
                    return false;
                }
                if (entry.path === null) {
                    return true;
                }
                const pattern = entry.path.replace(/\*/g, '.*').replace(/:[^/]+/g, '[^/]+');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(url.pathname);
            })
            .map((entry) => entry.middleware);
    }

    private async executeChain<P extends Params, S>(
        ctx: DurableObjectContext<E, P, S>,
        middlewares: DurableObjectMiddleware<E, P, S>[],
        corsConfig?: CorsConfig
    ): Promise<Response> {
        let index = 0;

        const next = async (): Promise<Response> => {
            if (index >= middlewares.length) {
                throw new Error('Middleware chain exhausted without returning a response');
            }

            const middleware = middlewares[index++];

            try {
                return await middleware(ctx, next);
            } catch (error) {
                return buildErrorResponse(error, ctx, corsConfig);
            }
        };

        try {
            return await next();
        } catch (error) {
            return buildErrorResponse(error, ctx, corsConfig);
        }
    }

    build(): DurableObjectRouter<E>['router'] {
        if (this.isBuilt) {
            return this.router;
        }

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

        this.isBuilt = true;
        return this.router;
    }

    handle(request: Request): Promise<Response> {
        if (!this.isBuilt) {
            this.build();
        }
        return this.router.fetch(request) as Promise<Response>;
    }
}
