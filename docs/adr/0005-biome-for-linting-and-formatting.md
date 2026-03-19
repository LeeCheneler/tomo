# 5. Biome for linting and formatting

Date: 2026-03-19

## Status

Accepted

## Context

The project needs a linter and formatter for TypeScript and TSX files. The traditional choice is ESLint + Prettier, but this requires configuring and maintaining two separate tools with potential conflicts between them.

## Decision

Use Biome as a single tool for both linting and formatting.

## Consequences

- Single tool to configure and maintain instead of two
- Faster than ESLint + Prettier (Biome is written in Rust)
- Biome's rule set is smaller than ESLint's ecosystem of plugins, but sufficient for this project
