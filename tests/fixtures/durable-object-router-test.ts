/// <reference types="@cloudflare/workers-types" />

import {
    DurableObjectRouter,
    DurableObjectRouteHandler,
    DurableObjectContext,
    DurableObjectMiddleware,
    Env as BaseEnv,
    HttpError,
} from '../../lib/index.js';

export interface Env extends BaseEnv {
    LOG_LEVEL: string;
    COUNTER: DurableObjectNamespace;
}

// Example Durable Object route handler - uses this.storage for storage access
class CounterHandler extends DurableObjectRouteHandler<Env> {
    async get(ctx: DurableObjectContext): Promise<any> {
        const count = (await this.storage.get<number>('count')) || 0;
        return { count };
    }

    async post(ctx: DurableObjectContext): Promise<any> {
        const body = await ctx.request.json<{ increment?: number }>();
        const currentCount = (await this.storage.get<number>('count')) || 0;
        const newCount = currentCount + (body.increment || 1);
        await this.storage.put('count', newCount);
        return { count: newCount };
    }

    async delete(ctx: DurableObjectContext): Promise<any> {
        await this.storage.delete('count');
        return { count: 0, reset: true };
    }
}

// Example handler with params
class StateHandler extends DurableObjectRouteHandler<Env, { key: string }> {
    async get(ctx: DurableObjectContext<{ key: string }>): Promise<any> {
        if (!ctx.params?.key) {
            throw new HttpError(400, 'Key is required');
        }
        const value = await this.storage.get<string>(ctx.params.key);
        return { key: ctx.params.key, value: value || null };
    }

    async put(ctx: DurableObjectContext<{ key: string }>): Promise<any> {
        if (!ctx.params?.key) {
            throw new HttpError(400, 'Key is required');
        }
        const body = await ctx.request.json<{ value: string }>();
        await this.storage.put(ctx.params.key, body.value);
        return { key: ctx.params.key, value: body.value, stored: true };
    }
}

// Additional handlers for info and reset
class InfoHandler extends DurableObjectRouteHandler<Env> {
    async get(ctx: DurableObjectContext): Promise<any> {
        return {
            id: this.id.toString(),
            name: 'Counter Durable Object',
        };
    }
}

class ResetHandler extends DurableObjectRouteHandler<Env> {
    async post(ctx: DurableObjectContext): Promise<any> {
        await this.storage.deleteAll();
        return { reset: true };
    }
}

// Durable Object class
export class Counter implements DurableObject {
    private router: DurableObjectRouter<Env>;

    constructor(state: DurableObjectState, env: Env) {
        this.router = new DurableObjectRouter<Env>(state, env, 'counter');

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
