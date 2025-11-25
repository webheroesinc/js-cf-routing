/// <reference types="@cloudflare/workers-types" />

import { WorkerRouter, RouteHandler, Env as BaseEnv, HttpError } from '../../lib/index.js';

export interface Env extends BaseEnv {
    LOG_LEVEL: string;
}

// Example route handler that extends RouteHandler
class HealthHandler extends RouteHandler<Env> {
    async get(request: Request, env: Env): Promise<any> {
        return { status: 'healthy', timestamp: new Date().toISOString() };
    }
}

// Example route handler with params
class UserHandler extends RouteHandler<Env, { id: string }> {
    async get(request: Request, env: Env, params?: { id: string }): Promise<any> {
        if (!params?.id) {
            throw new HttpError(400, 'User ID is required');
        }
        return { user_id: params.id, name: 'Test User' };
    }

    async post(request: Request, env: Env, params?: { id: string }): Promise<any> {
        const body = await request.json();
        return { user_id: params?.id, created: true, data: body };
    }

    async delete(request: Request, env: Env, params?: { id: string }): Promise<any> {
        if (!params?.id) {
            throw new HttpError(400, 'User ID is required');
        }
        return { user_id: params.id, deleted: true };
    }
}

// Example route handler that throws errors
class ErrorHandler extends RouteHandler<Env> {
    async get(request: Request, env: Env): Promise<any> {
        throw new HttpError(400, 'Bad Request Error');
    }

    async post(request: Request, env: Env): Promise<any> {
        throw new Error('Internal Server Error');
    }
}

// Test middleware
const testMiddleware = async (request: Request, env: Env, params: any) => {
    // Add a custom header via middleware
    if (request.url.includes('middleware-test')) {
        // Middleware can validate or modify request
        const url = new URL(request.url);
        if (!url.searchParams.has('token')) {
            throw new HttpError(401, 'Unauthorized');
        }
    }
};

// Create router and register routes
const router = new WorkerRouter<Env>('test-worker');

// Register middleware
router.all('/middleware-test/*', testMiddleware);

// Register route handlers
router.defineRouteHandler('/health', HealthHandler);
router.defineRouteHandler('/users/:id', UserHandler);
router.defineRouteHandler('/error', ErrorHandler);

// Additional route handlers
class PingHandler extends RouteHandler<Env> {
    async get(request: Request, env: Env): Promise<any> {
        return { message: 'pong' };
    }
}

class EchoHandler extends RouteHandler<Env> {
    async post(request: Request, env: Env): Promise<any> {
        const body = await request.json();
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
