# Cloudflare Workers Routing

[![License: LGPL-3.0](https://img.shields.io/badge/License-LGPL--3.0-blue.svg?style=flat-square)](https://www.gnu.org/licenses/lgpl-3.0)
[![npm version](https://img.shields.io/npm/v/@whi/cf-routing.svg?style=flat-square)](https://www.npmjs.com/package/@whi/cf-routing)

Class-based routing framework for Cloudflare Workers and Durable Objects built on [itty-router](https://github.com/kwhitley/itty-router).

## Features

- **Class-based Route Handlers** - Organize routes using ES6 classes
- **Context Object** - Single `ctx` argument with request, env, params, state, and response
- **Middleware with next()** - Koa/Hono-style middleware for pre/post processing
- **Built-in Error Handling** - Automatic JSON error responses with proper status codes
- **CORS Support** - Configurable CORS at router and handler level
- **Type Safety** - Full TypeScript support with generic types
- **Durable Objects** - First-class support for Durable Object routing

## Installation

```bash
npm install @whi/cf-routing
```

## Quick Start

### Worker Router

```typescript
import { WorkerRouter, RouteHandler, Context } from '@whi/cf-routing';

class HealthHandler extends RouteHandler {
    async get(ctx: Context) {
        return { status: 'healthy' };
    }
}

const router = new WorkerRouter()
    .defineRouteHandler('/health', HealthHandler)
    .build();

export default {
    async fetch(request, env, ctx) {
        return router.fetch(request, env, ctx);
    },
};
```

### Durable Object Router

```typescript
import { DurableObjectRouter, DurableObjectRouteHandler, DurableObjectContext } from '@whi/cf-routing';

class CounterHandler extends DurableObjectRouteHandler {
    async get(ctx: DurableObjectContext) {
        // Access storage via this.storage (flattened from DurableObjectState)
        return { count: await this.storage.get('count') || 0 };
    }

    async post(ctx: DurableObjectContext) {
        const count = await this.storage.get('count') || 0;
        await this.storage.put('count', count + 1);
        return { count: count + 1 };
    }
}

export class Counter {
    constructor(state, env) {
        this.router = new DurableObjectRouter(state, env, 'counter')
            .defineRouteHandler('/count', CounterHandler);
    }

    async fetch(request) {
        return this.router.handle(request);
    }
}
```

## Key Features

### Route Handlers

Create route handlers by extending the base classes. All handler methods receive a `ctx` object:

```typescript
class UserHandler extends RouteHandler<Env, { id: string }> {
    async get(ctx: Context<Env, { id: string }>) {
        return { userId: ctx.params.id };
    }

    async post(ctx: Context<Env, { id: string }>) {
        const body = await ctx.request.json();
        return { userId: ctx.params.id, created: true };
    }
}

router.defineRouteHandler('/users/:id', UserHandler);
```

The `ctx` object contains:
- `ctx.request` - The incoming Request
- `ctx.env` - Environment bindings (Worker handlers only)
- `ctx.params` - Route parameters (e.g., `{ id: '123' }`)
- `ctx.data` - Shared data for middleware communication
- `ctx.response` - Response customization (status, headers)
- `ctx.log` - Logger instance

For **DurableObject handlers**, the handler instance also has:
- `this.storage` - DurableObjectStorage (flattened from state)
- `this.id` - DurableObjectId
- `this.state` - Raw DurableObjectState (for blockConcurrencyWhile, etc.)
- `this.env` - Environment bindings

### Automatic Error Handling

Throw `HttpError` for proper HTTP status codes:

```typescript
import { HttpError } from '@whi/cf-routing';

async get(ctx: Context<Env, { id: string }>) {
    if (!ctx.params?.id) {
        throw new HttpError(400, 'ID required');
    }
    // Errors automatically become JSON responses
}
```

### Response Customization

Customize status codes and headers via `ctx.response`:

```typescript
async post(ctx: Context) {
    ctx.response.status = 201;
    ctx.response.headers.set('Set-Cookie', 'session=abc123');
    return { created: true };
}
```

Or return a `Response` directly for full control:

```typescript
async get(ctx: Context) {
    return new Response('<html>...</html>', {
        headers: { 'Content-Type': 'text/html' }
    });
}
```

### Middleware with next()

Middleware uses the Koa/Hono-style `next()` pattern for pre/post processing:

```typescript
import { Middleware } from '@whi/cf-routing';

const authMiddleware: Middleware<Env> = async (ctx, next) => {
    // Pre-processing
    const token = ctx.request.headers.get('Authorization');
    if (!token) {
        throw new HttpError(401, 'Unauthorized');
    }
    ctx.data.userId = validateToken(token);

    // Call next middleware/handler
    const response = await next();

    // Post-processing (optional)
    return response;
};

router
    .use(authMiddleware)                    // Global middleware
    .use('/api/*', rateLimitMiddleware)     // Path-specific middleware
    .defineRouteHandler('/api/users', UserHandler);
```

For **DurableObject middleware**, the signature is `(ctx, state, next)` where `state` is the DurableObjectState:

```typescript
import { DurableObjectMiddleware } from '@whi/cf-routing';

const sessionMiddleware: DurableObjectMiddleware = async (ctx, state, next) => {
    const session = await state.storage.get('session');
    ctx.data.session = session;
    return next();
};
```

### CORS Support

Configure CORS at the router level or per-handler with dynamic control:

```typescript
// Router-level CORS (applies to all handlers without their own cors())
const router = new WorkerRouter<Env>('api', {
    cors: { origins: '*' }
});

// Per-handler dynamic CORS
class ApiHandler extends RouteHandler<Env> {
    cors(ctx: Context<Env>) {
        const origin = ctx.request.headers.get('Origin');
        // Allow specific subdomains
        if (origin?.endsWith('.myapp.com')) {
            return { origins: origin, credentials: true };
        }
        return undefined; // Use router default
    }

    async get(ctx: Context<Env>) {
        return { data: 'hello' };
    }
}
```

CORS headers are automatically consistent between OPTIONS preflight and actual responses.

## Documentation

**https://webheroesinc.github.io/js-cf-routing/**

API documentation is automatically generated from source code using TypeDoc and deployed on every push to master.

To generate locally:

```bash
npm run docs         # Generate documentation in docs/
npm run docs:watch   # Generate docs in watch mode
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and contribution guidelines.

### Running Tests

```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # With coverage report
```

### Building

```bash
npm run build            # Build TypeScript to lib/
npm run format           # Format code with Prettier
```

## License

LGPL-3.0

## Credits

Built on top of [itty-router](https://github.com/kwhitley/itty-router) by Kevin Whitley.
