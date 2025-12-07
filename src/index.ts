/**
 * @packageDocumentation
 * Routing framework for Cloudflare Workers built on itty-router with error handling, CORS, and class-based route handlers.
 *
 * @example
 * ```typescript
 * import { WorkerRouter, RouteHandler, Context } from '@whi/cf-routing';
 *
 * class HealthHandler extends RouteHandler {
 *   async get(ctx: Context) {
 *     return { status: 'healthy' };
 *   }
 * }
 *
 * const router = new WorkerRouter('my-worker')
 *   .defineRouteHandler('/health', HealthHandler)
 *   .build();
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

export * from './context.js';
export * from './cors.js';
export * from './logger.js';
export * from './router.js';
export * from './response-context.js';
export { HttpError } from '@whi/http-errors';
