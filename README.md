# Cloudflare Workers Routing

[![License: LGPL-3.0](https://img.shields.io/badge/License-LGPL--3.0-blue.svg?style=flat-square)](https://www.gnu.org/licenses/lgpl-3.0)
[![npm version](https://img.shields.io/npm/v/@whi/cf-routing.svg?style=flat-square)](https://www.npmjs.com/package/@whi/cf-routing)

Class-based routing framework for Cloudflare Workers and Durable Objects built on [itty-router](https://github.com/kwhitley/itty-router).

## Features

- **Class-based Route Handlers** - Organize routes using ES6 classes
- **Built-in Error Handling** - Automatic JSON error responses with proper status codes
- **CORS Support** - Pre-configured CORS headers for all responses
- **Type Safety** - Full TypeScript support with generic types
- **Durable Objects** - First-class support for Durable Object routing
- **Middleware** - Easy middleware registration with error handling
- **Method Chaining** - Fluent API for route registration

## Installation

```bash
npm install @whi/cf-routing
```

## Quick Start

### Worker Router

```typescript
import { WorkerRouter, RouteHandler } from '@whi/cf-routing';

class HealthHandler extends RouteHandler {
    async get() {
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
import { DurableObjectRouter, DurableObjectRouteHandler } from '@whi/cf-routing';

class CounterHandler extends DurableObjectRouteHandler {
    async get() {
        return { count: await this.ctx.storage.get('count') || 0 };
    }

    async post() {
        const count = await this.ctx.storage.get('count') || 0;
        await this.ctx.storage.put('count', count + 1);
        return { count: count + 1 };
    }
}

export class Counter {
    constructor(ctx, env) {
        this.router = new DurableObjectRouter(ctx, env, 'counter')
            .defineRouteHandler('/count', CounterHandler);
    }

    async fetch(request) {
        return this.router.handle(request);
    }
}
```

## Key Features

### Route Handlers

Create route handlers by extending the base classes and implementing HTTP methods:

```typescript
class UserHandler extends RouteHandler<Env, { id: string }> {
    async get(request, env, params) {
        return { userId: params.id };
    }

    async post(request, env, params) {
        const body = await request.json();
        return { userId: params.id, created: true };
    }
}

router.defineRouteHandler('/users/:id', UserHandler);
```

### Automatic Error Handling

Throw `HttpError` for proper HTTP status codes:

```typescript
import { HttpError } from '@whi/cf-routing';

async get(request, env, params) {
    if (!params?.id) {
        throw new HttpError(400, 'ID required');
    }
    // Errors automatically become JSON responses
}
```

### Response Customization

Customize status codes and headers via `this.response`:

```typescript
async post(request, env, params) {
    this.response.status = 201;
    this.response.headers.set('Set-Cookie', 'session=abc123');
    return { created: true };
}
```

Or return a `Response` directly for full control:

```typescript
async get() {
    return new Response('<html>...</html>', {
        headers: { 'Content-Type': 'text/html' }
    });
}
```

### Built-in CORS

All responses include CORS headers automatically. Customize if needed:

```typescript
import { corsHeaders, createCorsHandler } from '@whi/cf-routing';
```

### Middleware Support

Chain middleware for authentication, logging, etc:

```typescript
router
    .all('/api/*', authMiddleware)
    .defineRouteHandler('/api/users', UserHandler);
```

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
