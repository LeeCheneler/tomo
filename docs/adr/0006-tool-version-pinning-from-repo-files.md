# 6. Tool version pinning from repo files

Date: 2026-03-19

## Status

Accepted

## Context

Node and pnpm versions need to be consistent across local development, CI, and the SEA build. Hardcoding versions in multiple places (CI workflows, mise config, scripts) creates drift risk.

## Decision

Pin tool versions in canonical repo files and reference them everywhere else:

- **Node version**: `.nvmrc` (read by `actions/setup-node` via `node-version-file`, and by mise/nvm locally)
- **pnpm version**: `packageManager` field in `package.json` (read by `pnpm/action-setup` automatically)
- **Bun/other tools**: `.mise.toml` for local development

CI workflows reference these files instead of hardcoding version numbers.

## Consequences

- Single source of truth for each tool version
- Version updates are a one-line change in one file
- CI and local dev are guaranteed to use the same versions
- Contributors using nvm, fnm, or mise all read from `.nvmrc`
