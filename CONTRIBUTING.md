# Contributing to Tomo

## Prerequisites

- [Node.js 25](https://nodejs.org/) (pinned in `.nvmrc`)
- [pnpm](https://pnpm.io/) (pinned in `package.json` via `packageManager`)
- [mise](https://mise.jdx.dev/) (recommended for managing Node version)

## Getting Started

```bash
git clone https://github.com/LeeCheneler/tomo.git
cd tomo
mise install        # installs Node from .nvmrc
pnpm install        # installs deps and sets up git hooks
pnpm dev            # runs the app in dev mode
```

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Run the app with tsx |
| `pnpm build` | Bundle with tsup |
| `pnpm build:sea` | Build standalone binary via Node SEA |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm format:check` | Check formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run tests with Vitest |
| `pnpm test:watch` | Run tests in watch mode |

## Pull Request Workflow

1. Create a branch from `main` using the convention `<type>/<issue-number>-<description>` (e.g. `feat/42-add-search`)
2. Make your changes and commit using [conventional commits](https://www.conventionalcommits.org/) (e.g. `feat: add search`, `fix: resolve timeout`)
3. Open a PR with a semantic title matching the same format — this is enforced by CI
4. CI runs build, lint, format check, typecheck, and tests — all must pass
5. PRs are auto-labelled based on their title prefix and included in draft release notes via release-drafter

## Commit Conventions

Use [conventional commit](https://www.conventionalcommits.org/) format:

```
<type>(<optional scope>): <subject>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`, `style`, `build`

## Pre-commit Hooks

Lefthook runs lint, format check, and typecheck on every commit. These are installed automatically via the `prepare` script when you run `pnpm install`.
