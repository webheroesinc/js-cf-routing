/// <reference types="@cloudflare/workers-types" />

import {
    WorkerRouter,
    RouteHandler,
    Env as BaseEnv,
    HttpError,
    Context,
    Middleware,
} from '../../lib/index.js';

export interface Env extends BaseEnv {
    LOG_LEVEL: string;
}

// Example route handler that extends RouteHandler
class HealthHandler extends RouteHandler<Env> {
    async get(ctx: Context<Env>): Promise<any> {
        return { status: 'healthy', timestamp: new Date().toISOString() };
    }
}

// Example route handler with params
class UserHandler extends RouteHandler<Env, { id: string }> {
    async get(ctx: Context<Env, { id: string }>): Promise<any> {
        if (!ctx.params?.id) {
            throw new HttpError(400, 'User ID is required');
        }
        return { user_id: ctx.params.id, name: 'Test User' };
    }

    async post(ctx: Context<Env, { id: string }>): Promise<any> {
        const body = await ctx.request.json();
        return { user_id: ctx.params?.id, created: true, data: body };
    }

    async delete(ctx: Context<Env, { id: string }>): Promise<any> {
        if (!ctx.params?.id) {
            throw new HttpError(400, 'User ID is required');
        }
        return { user_id: ctx.params.id, deleted: true };
    }
}

// Example route handler that throws errors
class ErrorHandler extends RouteHandler<Env> {
    async get(ctx: Context<Env>): Promise<any> {
        throw new HttpError(400, 'Bad Request Error');
    }

    async post(ctx: Context<Env>): Promise<any> {
        throw new Error('Internal Server Error');
    }
}

// Test middleware using new next() pattern
const testMiddleware: Middleware<Env> = async (ctx, next) => {
    // Add a custom header via middleware
    if (ctx.request.url.includes('middleware-test')) {
        // Middleware can validate or modify request
        const url = new URL(ctx.request.url);
        if (!url.searchParams.has('token')) {
            throw new HttpError(401, 'Unauthorized');
        }
    }
    // Continue to next middleware/handler
    return next();
};

// Create router and register routes
const router = new WorkerRouter<Env>('test-worker');

// Register middleware
router.use('/middleware-test/*', testMiddleware);

// Register route handlers
router.defineRouteHandler('/health', HealthHandler);
router.defineRouteHandler('/users/:id', UserHandler);
router.defineRouteHandler('/error', ErrorHandler);

// Additional route handlers
class PingHandler extends RouteHandler<Env> {
    async get(ctx: Context<Env>): Promise<any> {
        return { message: 'pong' };
    }
}

class EchoHandler extends RouteHandler<Env> {
    async post(ctx: Context<Env>): Promise<any> {
        const body = await ctx.request.json();
        return { echo: body };
    }
}

// Register direct route handlers
router.defineRouteHandler('/ping', PingHandler);
router.defineRouteHandler('/echo', EchoHandler);

// Build router with 404 handler
const builtRouter = router.build();

// Export worker
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return builtRouter.fetch(request, env, ctx) as Promise<Response>;
    },
};
