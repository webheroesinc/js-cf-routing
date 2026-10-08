# Changelog

All notable changes to `@whi/cf-routing` will be documented in this file.
Releases up to 0.7.0 predate it; see the git tags.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
