/// <reference types="@cloudflare/workers-types" />

import {
    DurableObjectRouter,
    DurableObjectRouteHandler,
    Env as BaseEnv,
    HttpError,
} from '../../lib/index.js';

export interface Env extends BaseEnv {
    LOG_LEVEL: string;
    COUNTER: DurableObjectNamespace;
}

// Example Durable Object route handler
class CounterHandler extends DurableObjectRouteHandler<Env> {
    async get(request: Request): Promise<any> {
        const count = (await this.ctx.storage.get<number>('count')) || 0;
        return { count };
    }

    async post(request: Request): Promise<any> {
        const body = await request.json<{ increment?: number }>();
        const currentCount = (await this.ctx.storage.get<number>('count')) || 0;
        const newCount = currentCount + (body.increment || 1);
        await this.ctx.storage.put('count', newCount);
        return { count: newCount };
    }

    async delete(request: Request): Promise<any> {
        await this.ctx.storage.delete('count');
        return { count: 0, reset: true };
    }
}

// Example handler with state
class StateHandler extends DurableObjectRouteHandler<Env, { key: string }> {
    async get(request: Request, params?: { key: string }): Promise<any> {
        if (!params?.key) {
            throw new HttpError(400, 'Key is required');
        }
        const value = await this.ctx.storage.get<string>(params.key);
        return { key: params.key, value: value || null };
    }

    async put(request: Request, params?: { key: string }): Promise<any> {
        if (!params?.key) {
            throw new HttpError(400, 'Key is required');
        }
        const body = await request.json<{ value: string }>();
        await this.ctx.storage.put(params.key, body.value);
        return { key: params.key, value: body.value, stored: true };
    }
}

// Additional handlers for info and reset
class InfoHandler extends DurableObjectRouteHandler<Env> {
    async get(request: Request): Promise<any> {
        return {
            id: this.ctx.id.toString(),
            name: 'Counter Durable Object',
        };
    }
}

class ResetHandler extends DurableObjectRouteHandler<Env> {
    async post(request: Request): Promise<any> {
        await this.ctx.storage.deleteAll();
        return { reset: true };
    }
}

// Durable Object class
export class Counter implements DurableObject {
    private router: DurableObjectRouter<Env>;

    constructor(ctx: DurableObjectState, env: Env) {
        this.router = new DurableObjectRouter<Env>(ctx, env, 'counter');

        // Register route handlers
        this.router.defineRouteHandler('/count', CounterHandler);
        this.router.defineRouteHandler('/state/:key', StateHandler);
        this.router.defineRouteHandler('/info', InfoHandler);
        this.router.defineRouteHandler('/reset', ResetHandler);
    }

    async fetch(request: Request): Promise<Response> {
        return this.router.handle(request);
    }
}

// Worker that creates and routes to Durable Object
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Get or create a Counter instance
        const id = env.COUNTER.idFromName('test-counter');
        const counter = env.COUNTER.get(id);

        // Forward request to the Durable Object
        return counter.fetch(request);
    },
};
