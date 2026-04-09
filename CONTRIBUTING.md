# Contributing to Tomo

Thanks for your interest. This document covers everything you need to work on Tomo locally and get a change merged.

## Prerequisites

- [Node.js 25](https://nodejs.org/) (pinned in `.nvmrc`)
- [pnpm](https://pnpm.io/) 10.11.1 (pinned in `package.json` via `packageManager`)
- [mise](https://mise.jdx.dev/) recommended for managing the Node version

## Getting Started

```bash
git clone https://github.com/LeeCheneler/tomo.git
cd tomo
mise install        # installs Node from .nvmrc
pnpm install        # installs deps and sets up git hooks via lefthook
pnpm dev            # runs tomo from source
```

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Run the app from source with tsx     |
| `pnpm build`        | Bundle with tsup                     |
| `pnpm build:sea`    | Build a standalone binary via Node SEA |
| `pnpm lint`         | Lint with Biome                      |
| `pnpm format`       | Format with Biome                    |
| `pnpm format:check` | Check formatting without writing     |
| `pnpm typecheck`    | Run `tsc --noEmit`                   |
| `pnpm test`         | Run tests with Vitest                |
| `pnpm test:watch`   | Run tests in watch mode              |

## Project Structure

Code is grouped by feature, not by type. If a file only exists to serve one feature, it lives in that feature's directory. Shared, stateless primitives live in `ui/`.

```
src/
├── chat/         # chat UI, input, completion loop, message rendering
├── commands/     # slash command registry + simple commands
├── settings/     # /settings menu and submenus (providers, tools, MCP, etc)
├── session/      # session persistence and the session browser
├── model/        # model selector
├── tools/        # built-in tools (read, write, edit, glob, grep, run, agent, ...)
├── mcp/          # MCP client, transports, manager
├── skills/       # skill loading + registry
├── skill-sets/   # git-backed skill set discovery
├── provider/     # AI provider client (OpenAI-compatible)
├── prompt/       # system prompt building, instruction file loading
├── config/       # config schema (zod) and file loader
├── ui/           # shared stateless UI primitives
├── input/        # text edit + cursor primitives
├── markdown/     # markdown renderer for assistant output
├── images/       # clipboard image paste handling
├── context/      # context window tracking
├── agent/        # sub-agent runtime
├── utils/        # filesystem, env, version helpers
└── test-utils/   # ink renderer wrapper, key constants, msw helpers
```

**Rule of thumb:** if a feature has more than one file, it gets its own directory. Trivial single-file commands stay in `commands/`.

## Coding Rules

### TypeScript

- Strict mode. No `any` unless absolutely unavoidable — and if you must, add a comment explaining why.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and mapped types.
- Use explicit return types on exported functions. Inferred return types are fine for non-exported helpers.
- Never use `.js` extensions in imports — use extensionless paths.
- Never use namespace imports (`import * as X`). Always named imports.
- Never use type casts (`as`). Use zod schemas or runtime checks to narrow `unknown`.

### React / Ink

- Business logic lives in hooks. Components are rendering only.
- Feature-specific hooks are co-located in the same file as their component — not exported, not in a separate file.
- Use `<Box paddingLeft={n}>` or `<Indent>` for indentation. Never hardcoded space strings like `{"    "}`.
- Parents own layout. A child component does not know its indentation depth.

### Function Arguments

Never destructure parameters in a function signature. Always assign a named variable and destructure inside the body if needed.

```ts
// Bad
export function AppHeader({ version, model, provider }: AppHeaderProps) { … }

// Good
export function AppHeader(props: AppHeaderProps) {
  const { version, model, provider } = props;
  …
}
```

### Comments and JSDoc

Every exported symbol — functions, constants, types, interfaces — and every function (exported or not) gets a JSDoc comment. Keep it to one line when possible.

```ts
/** Loads and validates the YAML config from disk. */
export function loadConfig(): Config { … }
```

Skip parameter docs when names and types make the purpose obvious. Document parameters only when their constraints or behaviour are non-obvious.

Inline comments explain *why*, not *what*. Don't restate what the code already says.

## Testing

Every function, hook, and component has tests. Tests live next to their source: `foo.ts → foo.test.ts`, `bar.tsx → bar.test.tsx`.

- **Mock at boundaries.** Mock the filesystem, network, and external processes. Do not mock internal modules, hooks, or components. If a test is hard to write without mocking internals, that's a signal the code needs refactoring.
- **Test behaviour, not implementation.** Test what a function returns or what a component renders, not how it gets there.
- **Use the project test utilities.** Render Ink components with `renderInk()` from `src/test-utils/ink` and use `keys` from `src/test-utils/keys` for special key inputs. Don't import directly from `ink-testing-library`.

The project enforces 100% coverage. CI will fail if a change drops coverage below the threshold.

## Pull Request Workflow

1. **Branch from `main`** using the convention `<type>/<issue-number>-<short-description>`. Examples:
   - `feat/42-add-search`
   - `fix/resolve-login-timeout`
   - `chore/update-dependencies`

   Where `<type>` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`, `style`, `build`.

2. **Commit with [conventional commits](https://www.conventionalcommits.org/)**:

   ```
   <type>(<optional-scope>): <subject>
   ```

   Subject is imperative, lowercase, no period. Add a body for non-obvious changes — explain *why*, not *what*.

3. **Open a PR with a semantic title** matching the same `<type>(<scope>): <subject>` format. CI enforces this via [semantic-pull-request](https://github.com/amannn/action-semantic-pull-request).

4. **CI must pass.** Every PR runs build, lint, format check, typecheck, and tests with coverage. PRs are auto-labelled by their title prefix and rolled into draft release notes via release-drafter.

## Pre-commit Hooks

[Lefthook](https://lefthook.dev) runs lint, format check, and typecheck on every commit. Hooks install automatically via the `prepare` script when you run `pnpm install`.

If a hook fails, fix the issue and create a new commit — do not amend.

## Architecture Decision Records

Significant technical decisions are recorded as ADRs in `docs/adr/`. We use [adr-tools](https://github.com/npryce/adr-tools).

Create a new ADR with:

```bash
adr new "Title of decision"
```

This generates a numbered file in `docs/adr/`. Fill in the Context, Decision, and Consequences sections.
