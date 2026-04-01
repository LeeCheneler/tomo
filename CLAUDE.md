# Tomo

Terminal-native AI chat client built with React/Ink and TypeScript.

## Project Structure

See `CONTRIBUTING.md` for architecture guidelines and `repository-restructure.md` for the migration plan.

- `src/` — new codebase (being built up feature by feature)
- `old/` — reference implementation (read-only, being replaced)

## Coding Guidelines

### TypeScript

- Strict mode. No `any` unless absolutely unavoidable — and if you must, add a comment explaining why.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and mapped types.
- Use explicit return types on exported functions. Inferred return types are fine for non-exported helpers and hooks.
- Never use `.js` extensions in imports. Use extensionless paths: `from "./config/hook"` not `from "./config/hook.js"`.
- Never use namespace imports (`import * as X`). Always use named imports: `import { foo, bar } from "./module"`.
- Never use type casts (`as`). Use zod schemas or runtime checks to narrow types. If `yaml.parse` returns `unknown`, validate it through a zod schema — don't cast it.

### React / Ink

- Business logic lives in hooks. Components are rendering only.
- Feature-specific hooks are co-located in the same file as their component — not exported, not in a separate file.
- Shared hooks (used by 2+ features) live in `src/hooks/`.
- Use `<Box paddingLeft={n}>` for indentation. Never use hardcoded space strings like `{"    "}`.
- Parents own layout. A child component does not know its indentation depth.

### Function Arguments

Never destructure parameters in the function signature. Always assign a named variable.

Bad:

```typescript
export function AppHeader({ version, model, provider }: AppHeaderProps) {
```

Good:

```typescript
export function AppHeader(props: AppHeaderProps) {
```

This applies to all functions, not just components. Destructure inside the body if needed.

### General

- Keep functions small and pure where possible.
- No premature abstraction. Duplicate code is acceptable until a pattern appears 3+ times.
- Match existing patterns in the codebase. When in doubt, look at how similar things are already done.

## Comment Rules

These rules are mandatory. Every PR must follow them.

### JSDoc on All Exports and Functions

Every export — functions, constants, objects, types, interfaces — must have a JSDoc comment. Every function (exported or not) must have one too. Keep it to one line when possible.

```typescript
/** Loads and validates the YAML config from disk. */
export function loadConfig(): Config {
```

```typescript
/** Environment variable access with required/optional variants. */
export const env = {
  /** Returns the value of a required environment variable. Throws if missing or empty. */
  get(name: string): string {
```

### Skip Argument Documentation When Obvious

Do NOT document parameters that are self-explanatory from their names and types. Only document parameters when their purpose, constraints, or behaviour is non-obvious.

Good — arguments are trivially clear:

```typescript
/** Returns the sum of two numbers. */
function add(a: number, b: number): number {
  return a + b;
}
```

Good — `depth` has a non-obvious constraint worth documenting:

```typescript
/**
 * Spawns a sub-agent to handle a task.
 * @param depth - Current nesting depth. Must not exceed maxDepth from agent config.
 */
function spawnAgent(prompt: string, depth: number): Promise<string> {
```

Bad — restating what the types already say:

```typescript
/**
 * Returns the sum of two numbers.
 * @param a - The first number.
 * @param b - The second number.
 * @returns The sum.
 */
function add(a: number, b: number): number {
```

### Inline Comments for Non-Obvious Logic

Add inline comments when:

- An algorithm is non-trivial (explain the approach, not each line)
- Code has a subtle reason for existing (why, not what)
- A workaround is in place (link to the issue or explain the constraint)

Do NOT add inline comments that restate what the code does:

```typescript
// Bad — the code already says this
const total = items.length; // Get total number of items

// Good — explains WHY, not WHAT
// Ink's Static component requires a stable key to avoid re-rendering the
// entire list when new items are appended.
const staticItems = messages.map((m) => ({ ...m, key: m.id }));
```

## Testing Rules

These rules are mandatory. All code must have corresponding tests.

### Test Everything

Every function, hook, and component must have tests. No exceptions. If you write code, you write tests for it in the same commit.

- Source files have a colocated test file: `foo.ts` → `foo.test.ts`, `bar.tsx` → `bar.test.tsx`.
- Tests go next to their source, not in a separate `__tests__/` directory (except integration tests).

### Mock Only at Boundaries

Mock the filesystem, network, and external processes. Do NOT mock internal modules, hooks, or components.

Good — mocking a boundary:

```typescript
vi.spyOn(fs, "readFileSync").mockReturnValue("yaml content");
vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
```

Bad — mocking internals:

```typescript
// Don't do this. Test the real implementation.
vi.mock("../config", () => ({ loadConfig: vi.fn() }));
vi.mock("../hooks/use-list-navigation", () => ({ useListNavigation: vi.fn() }));
```

If a test is hard to write without mocking internals, that's a signal the code needs refactoring — not more mocks.

### Test Behaviour, Not Implementation

- Test what a function returns or what a component renders, not how it gets there.
- For hooks: test the state transitions through the returned values.
- For components: render with `renderInk` from `src/test-utils/ink`, simulate input, assert on `lastFrame()`.
- Do not assert on internal state or implementation details.

### Test Utilities

- **Rendering:** Use `renderInk()` from `src/test-utils/ink` instead of `render` from `ink-testing-library`. It wraps `stdin.write()` to auto-flush Ink's input parser and React re-renders, so every `stdin.write()` returns a `Promise` and should be awaited.
- **Key constants:** Use `keys` from `src/test-utils/keys` for special key inputs instead of raw escape sequences. Write `stdin.write(keys.up)` not `stdin.write("\x1b[A")`.
- Never import directly from `ink-testing-library` in test files.

### Integration Tests

A small set of integration tests in `src/__tests__/integration/` verify end-to-end flows (command → menu → result). These are supplementary — the bulk of coverage comes from unit tests.

## Scripts

```bash
pnpm dev            # run in dev mode
pnpm build          # bundle with tsup
pnpm test           # run tests
pnpm test:watch     # run tests in watch mode
pnpm typecheck      # type check
pnpm lint           # lint
pnpm format         # format
```
