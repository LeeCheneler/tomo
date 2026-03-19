# 3. ESM bundle output

Date: 2026-03-19

## Status

Accepted

## Context

The tsup bundler can output either CommonJS (CJS) or ECMAScript Modules (ESM). The original plan was to use CJS because Node SEA's `useCodeCache` option requires it for faster startup. The project uses `"type": "module"` in package.json.

## Decision

Use ESM as the bundle output format.

Ink and its dependency yoga-layout use top-level `await`, which is incompatible with CJS. Since the core TUI framework requires ESM features, CJS is not viable.

## Consequences

- Cannot use `useCodeCache` in the SEA config, meaning slightly slower cold starts
- Some transitive dependencies use CJS `require()` for Node builtins, requiring a `createRequire` shim in the bundle
- The bundle must be a single file (no code splitting) since Node SEA can only embed one JS file
