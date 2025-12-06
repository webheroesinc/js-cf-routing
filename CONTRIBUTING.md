# Contributing to @whi/cf-routing

Thank you for your interest in contributing! This document provides guidelines and information for developing and testing this library.

## Development Setup

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
.
├── src/                    # Source code
│   ├── index.ts           # Main exports
│   ├── router.ts          # Router implementations
│   ├── context.ts         # Context and Middleware types
│   ├── response-context.ts # ResponseContext class
│   └── cors.ts            # CORS utilities
├── lib/                   # Compiled JavaScript (generated)
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── fixtures/          # Test worker implementations
│   └── setup.ts           # Test utilities
└── Makefile               # Build automation
```

## Testing

This library uses **integration testing** to validate functionality in a simulated Cloudflare Workers environment.

### Test Stack

- **Vitest** - Test runner with coverage
- **Miniflare v3** - Local Cloudflare Workers runtime
- **esbuild** - Fast bundler for test fixtures

### Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### How Tests Work

1. **Build library** - TypeScript compiled to `lib/`
2. **Bundle test fixtures** - Test workers bundled with esbuild to `tests/fixtures/dist/`
3. **Run tests** - Miniflare loads bundled workers and executes tests

The integration tests simulate real usage by:
- Creating test workers that import the library
- Loading them into Miniflare (local Workers runtime)
- Making HTTP requests and validating responses

### Building Test Fixtures

**Default (esbuild - faster):**
```bash
npm run build:tests
```

**Alternative (wrangler - for production parity testing):**
```bash
# If you need to verify behavior matches production wrangler bundling
npx wrangler deploy --config tests/fixtures/wrangler-worker.toml \
  --dry-run --outfile tests/fixtures/dist/worker-router-test.js
```

**Important:** Use `--outfile` (not `--outdir`) with wrangler. The `--outdir` option only creates a README without the bundle.

### Coverage

Run `npm run test:coverage` to see code coverage. The project maintains >80% coverage thresholds.

Unit tests import directly from `src/` to enable accurate coverage measurement.

## Code Style

```bash
npm run format        # Format code
npm run format:check  # Check formatting
```

We use Prettier for code formatting. Run `npm run format` before committing.

## Making Changes

### Adding Features

1. Add source code to `src/`
2. Export from `src/index.ts` if public API
3. Add tests in `tests/unit/` or `tests/integration/`
4. Update type definitions (TypeScript handles this automatically)
5. Run tests to verify

### Modifying Router Behavior

If changing router behavior:
1. Update `src/router.ts`
2. Add/update tests in `tests/integration/`
3. Update test fixtures in `tests/fixtures/` if needed
4. Rebuild and test: `npm test`

### Re-exporting Dependencies

If a dependency needs to be available to consumers (like `HttpError`):
```typescript
// src/index.ts
export { HttpError } from '@whi/http-errors';
```

This prevents duplicate classes when bundling test fixtures.

## Build Process

### Using Make

The Makefile defines file targets for incremental builds:

```bash
make lib/index.js                                      # Build library
make tests/fixtures/dist/worker-router-test.js        # Build worker test
make tests/fixtures/dist/durable-object-router-test.js # Build DO test
```

Make only rebuilds when source files change (based on timestamps).

### Using npm scripts

For running commands (not building files):
```bash
npm run build        # Build library
npm run build:tests  # Build test fixtures
npm test            # Run tests
```

**Note:** npm scripts use pre-hooks to automatically build dependencies.

## Troubleshooting

### "Module not found" errors in tests

**Issue:** Miniflare can't resolve imports.

**Solution:** Test fixtures must import from `lib/index.js` (not `@whi/cf-routing`):
```typescript
// Good
import { WorkerRouter } from '../../lib/index.js';

// Bad
import { WorkerRouter } from '@whi/cf-routing';
```

### Duplicate class errors (e.g., HttpError2)

**Issue:** esbuild creates duplicate classes when the same module is imported from different sources.

**Solution:** Import shared dependencies from the library itself:
```typescript
// Good
import { WorkerRouter, HttpError } from '../../lib/index.js';

// Bad - creates duplicates
import { WorkerRouter } from '../../lib/index.js';
import { HttpError } from '@whi/http-errors';
```

### Tests pass but coverage is low

Ensure unit tests import from `src/` not `lib/`. Coverage is measured on source files only.

## Future Test Improvements

Here are potential enhancements to better replicate consumer usage patterns:

### Test Fixture Enhancements
- Multi-parameter routes (e.g., `/org/:orgId/user/:userId`)
- Query parameter handling and validation
- Request body parsing edge cases (invalid JSON, non-JSON content types)
- Middleware chaining scenarios (auth → logging → handler)
- Headers inspection and manipulation

### Real-World Scenario Tests
Consider adding `tests/scenarios/` for common patterns:
- API with authentication middleware
- CRUD resource with input validation
- Durable Object-backed session management
- Rate limiting middleware
- Request/response logging patterns

### Durable Object Advanced Patterns
- Alarm handling
- WebSocket support
- Transaction patterns with `this.storage`

### Documentation-Driven Testing
- Test all README code examples as actual tests
- Ensure copy-pasteable examples always work
- Maintain examples in sync with API changes

These improvements would increase confidence that consumers can replicate documented patterns successfully.

## Documentation

API documentation is automatically generated from TypeScript source code and JSDoc comments using TypeDoc.

- Documentation is auto-deployed to GitHub Pages on every push to master
- View live docs at: https://webheroesinc.github.io/js-cf-routing/
- Generate locally: `npm run docs`

When adding or modifying public APIs:
1. Add JSDoc comments with `@param`, `@returns`, and `@example` tags
2. Use `@category` to organize exports (Routers, Handlers, Utilities, Types)
3. Include code examples in `@example` blocks
4. Run `npm run docs` to verify the output

## Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add JSDoc comments for any new public APIs
5. Run tests: `npm test`
6. Format code: `npm run format`
7. Commit with clear messages
8. Submit a pull request

## Questions?

Open an issue on GitHub for questions or discussion about contributing.
