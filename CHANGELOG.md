# Changelog

All notable changes to `@whi/cf-routing` will be documented in this file.
Releases up to 0.7.0 predate it; see the git tags.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- `@whi/http-errors` is updated to 0.3.0, so an `HttpError` can carry
  several cookies: pass its headers as an array of name-value pairs (or a
  `Headers` object) and every one is sent. `HttpError.headers` is now typed as `HeadersInit`
  rather than `Record<string, string>`, so code that reads a value with
  `err.headers['X-Foo']` needs a cast or `new Headers(err.headers).get('X-Foo')`.

### Fixed

- Cookies a handler or middleware sets on `ctx.response.headers` are sent
  even when the request then fails, for example clearing a session cookie
  before throwing a 401. Previously an error response dropped them without
  any error. Other headers set on `ctx.response` still apply only to
  successful responses. ([#12](https://github.com/webheroesinc/js-cf-routing/issues/12))

## [0.8.1] - 2026-11-20

### Fixed

- Every cookie a handler appends with `ctx.response.headers.append('Set-Cookie', …)`
  reaches the response; previously only the last one was sent, and the others
  were dropped without any error. ([#9](https://github.com/webheroesinc/js-cf-routing/issues/9))

## [0.8.0] - 2026-10-08

### Changed

- Route parameters are percent-decoded before reaching middleware and
  handlers: `/items/dGVzdA%3D%3D` gives `ctx.params.id === 'dGVzdA=='`, and an
  encoded `%2F` stays inside its parameter. A malformed escape such as `%E0`
  gets a 400 before any middleware runs. Code that already decodes
  `ctx.params` itself now decodes twice (`%253D` becomes `=` instead of `%3D`)
  and should stop. ([#3](https://github.com/webheroesinc/js-cf-routing/issues/3))

### Fixed

- The built router's `fetch` is typed as returning `Promise<Response>` rather
  than `Promise<unknown>`, so a Worker entry point that forwards to it compiles
  with `satisfies ExportedHandler<Env>`.
- A router-level CORS `origins` callback can declare the type of its `data`
  (for example `({ data }: { data: MyData }) => …`) instead of being rejected.
