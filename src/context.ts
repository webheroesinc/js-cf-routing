import { ResponseContext } from './response-context.js';
import Loganite from 'loganite';

/**
 * Route parameters extracted from URL path
 * @category Types
 */
export type Params = Record<string, string>;

/**
 * Base environment interface for Cloudflare Workers
 * @category Types
 */
export interface Env {
    /** Logging level (e.g., 'debug', 'info', 'warn', 'error', 'fatal') */
    LOG_LEVEL: string;
}

/**
 * Context object passed to all middleware and route handlers.
 *
 * Provides access to the request, environment, route parameters,
 * shared data for middleware communication, and response customization.
 *
 * @typeParam E - Environment type extending base Env interface
 * @typeParam P - Route parameters type
 * @typeParam D - Data type for middleware-set data
 *
 * @category Context
 *
 * @example
 * ```typescript
 * // Middleware setting data
 * const authMiddleware: Middleware<Env, Params, { user: User }> = async (ctx, next) => {
 *     ctx.data.user = await validateToken(ctx.request);
 *     return next();
 * };
 *
 * // Handler reading data
 * class UserHandler extends RouteHandler<Env, { id: string }, { user: User }> {
 *     async get(ctx) {
 *         const user = ctx.data.user;
 *         return { user };
 *     }
 * }
 * ```
 */
export interface Context<E = Env, P = Params, D = Record<string, any>> {
    /** Original incoming request */
    request: Request;

    /** Worker environment bindings */
    env: E;

    /** Route parameters from URL (e.g., { id: '123' } from '/users/:id') */
    params: P;

    /**
     * Shared data for middleware to pass to handlers.
     * Use this to store computed data like authenticated user, parsed body, etc.
     */
    data: D;

    /** Response customization (status, headers) */
    response: ResponseContext;

    /** Logger instance */
    log: Loganite;
}

/**
 * Middleware function type with next() pattern.
 *
 * Middleware can:
 * - Run code before calling next() (pre-processing)
 * - Run code after calling next() (post-processing)
 * - Short-circuit by returning a Response without calling next()
 * - Throw HttpError to return an error response
 *
 * @typeParam E - Environment type
 * @typeParam P - Route parameters type
 * @typeParam D - Data type for middleware-set data
 *
 * @category Types
 *
 * @example
 * ```typescript
 * const timingMiddleware: Middleware = async (ctx, next) => {
 *     const start = Date.now();
 *
 *     const response = await next();
 *
 *     ctx.log.info(`Request took ${Date.now() - start}ms`);
 *     return response;
 * };
 * ```
 */
export type Middleware<E = Env, P = Params, D = Record<string, any>> = (
    ctx: Context<E, P, D>,
    next: () => Promise<Response>
) => Promise<Response>;
