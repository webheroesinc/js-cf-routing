/**
 * @packageDocumentation
 * Routing framework for Cloudflare Workers built on itty-router with error handling, CORS, and class-based route handlers.
 *
 * @example
 * ```typescript
 * import { WorkerRouter, RouteHandler } from '@whi/cf-routing';
 *
 * class HealthHandler extends RouteHandler {
 *   async get() {
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

export * from './cors';
export * from './router';
export { HttpError } from '@whi/http-errors';
