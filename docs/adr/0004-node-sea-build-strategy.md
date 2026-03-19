# 4. Node SEA build strategy

Date: 2026-03-19

## Status

Accepted

## Context

Tomo is distributed as a standalone binary via Node Single Executable Applications (SEA). Node 25.5+ introduced `node --build-sea`, which combines blob generation and injection in a single command, replacing the legacy `--experimental-sea-config` + postject workflow.

Node binaries installed via homebrew or mise do not include the SEA fuse sentinel required for injection. Only official nodejs.org binaries have it.

## Decision

Use `node --build-sea` with an official Node binary downloaded at build time.

The build script (`scripts/build-sea.sh`) downloads the official binary, caches it locally, and generates the SEA config dynamically because it contains an absolute path to the cached binary. The same script is used in both local dev and CI.

## Consequences

- First build requires downloading the official Node binary (~130MB); subsequent builds use the cache
- The SEA config is generated at build time, not checked in
- The resulting binary is ~134MB (full Node runtime embedded)
- Contributors using homebrew or mise for Node don't need to change their setup — the build script handles the official binary separately
