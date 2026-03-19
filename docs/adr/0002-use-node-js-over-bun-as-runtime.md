# 2. Use Node.js over Bun as runtime

Date: 2026-03-19

## Status

Accepted

## Context

Tomo is a terminal-native AI chat client built with Ink (React for CLIs). It needs to be distributed as a standalone binary. We evaluated both Node.js and Bun as the runtime.

Bun was attractive because `bun build --compile` produces a standalone binary in a single command, and Bun natively runs TypeScript — which would have eliminated the need for tsx, tsup, and the complex Node SEA build pipeline. Bun also includes a built-in package manager, which would have replaced pnpm.

## Decision

Use Node.js (v25) as the runtime.

Bun was ruled out because Ink has runtime issues under Bun — renders hang indefinitely and `console.Console` constructor errors occur in the patch-console dependency. These are fundamental incompatibilities with the TUI framework the project depends on.

## Consequences

- The SEA build pipeline is more complex (official binary download, dynamic config generation, codesigning)
- We need tsx for dev, tsup for bundling, and pnpm for package management — tools Bun would have replaced
- We get full Ink/React compatibility and a mature, well-tested runtime
- If Bun's Ink compatibility improves in the future, this decision could be revisited
