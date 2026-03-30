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

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Run the app with tsx                 |
| `pnpm build`        | Bundle with tsup                     |
| `pnpm build:sea`    | Build standalone binary via Node SEA |
| `pnpm lint`         | Lint with Biome                      |
| `pnpm format`       | Format with Biome                    |
| `pnpm format:check` | Check formatting                     |
| `pnpm typecheck`    | Run TypeScript type checking         |
| `pnpm test`         | Run tests with Vitest                |
| `pnpm test:watch`   | Run tests in watch mode              |

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

## Architecture

### Feature-Grouped Structure

Code is organised by feature, not by type. If a file only exists to serve one feature, it lives in that feature's directory. Shared, stateless primitives live in `ui/` and `hooks/`.

```
src/
├── chat/           # Chat feature — input, messages, streaming
├── settings/       # Settings feature — menu, provider manager, editors
├── session/        # Session feature — selector, persistence
├── model/          # Model selection feature
├── tools/          # Tool implementations, grouped by domain
├── mcp/            # MCP client, transports, server selector
├── skills/         # Skill loading, registry, command
├── commands/       # Command registry + simple commands (help, new, context)
├── ui/             # Shared stateless UI primitives only
├── hooks/          # Shared stateless hooks only
└── provider/       # AI provider client
```

**Rule of thumb:** if a feature has more than one file, it gets its own directory. Trivial single-file commands stay in `commands/`.

### Component Patterns

Business logic lives in hooks. Components are rendering only.

Feature-specific hooks are co-located in the same file as their component — they don't need their own file or export. Only genuinely reusable hooks (e.g. `useListNavigation`) live in the shared `hooks/` directory.

```tsx
// settings/settings-menu.tsx

// Hook owns all state and logic — not exported
function useSettingsMenu(config: Config) {
  const [step, setStep] = useState<Step>("main")
  const navigation = useListNavigation(items)

  const handleSelect = (item: MenuItem) => { /* ... */ }

  return { step, navigation, items, handleSelect }
}

// Component is pure rendering
export function SettingsMenu({ config, onDone, onCancel }: Props) {
  const { step, navigation, items, handleSelect } = useSettingsMenu(config)

  return (
    <Menu items={items} onSelect={handleSelect} onCancel={onCancel}
      renderItem={(item, active) => <MenuItem active={active} label={item.label} />}
    />
  )
}
```

## Design System

### UI Primitives

Shared, stateless building blocks in `ui/`. These handle layout and interaction patterns so feature components don't have to.

| Primitive | Purpose                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------- |
| `Indent`  | Wraps children with consistent indentation via `paddingLeft`. Replaces all hardcoded space strings. |
| TBD       |                                                                                                     |

### Layout Rules

- **No hardcoded space strings.** Never use `{"    "}` or `{"  "}` for indentation. Use `<Indent level={n}>` or `<Box paddingLeft={n}>`.
- **Parents own layout.** A menu item doesn't know its indentation depth — its parent applies `<Indent>` around it.
- **Consistent spacing.** One indent level = 2 characters. Use `gap` and `marginBottom` on `<Box>` for vertical spacing.

## UX Patterns

TBD

## Testing Strategy

### Principles

- **Test in isolation first.** Each menu should be testable without its parent command or the chat state.
- **Colocated test files.** Tests live next to their source file (`foo.test.tsx` beside `foo.tsx`).
- **Integration tests are thin.** A small number of tests in `__tests__/integration/` that verify the command → menu → result wiring works. These are not exhaustive — the unit tests cover behaviour.
- **Mock at boundaries.** Mock the provider client, filesystem, and config. Don't mock internal components or hooks.

## Architecture Decision Records

Significant technical decisions are recorded as ADRs in `docs/adr/`. We use [adr-tools](https://github.com/npryce/adr-tools) to manage them.

To create a new ADR:

```bash
adr new "Title of decision"
```

This creates a numbered markdown file in `docs/adr/` with the standard template. Fill in the Context, Decision, and Consequences sections.
