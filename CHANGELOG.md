# Changelog

All notable changes to `@whi/cf-routing` will be documented in this file.
Releases up to 0.7.0 predate it; see the git tags.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- The built router's `fetch` is typed as returning `Promise<Response>` rather
  than `Promise<unknown>`, so a Worker entry point that forwards to it compiles
  with `satisfies ExportedHandler<Env>`.
- A router-level CORS `origins` callback can declare the type of its `data`
  (for example `({ data }: { data: MyData }) => …`) instead of being rejected.
