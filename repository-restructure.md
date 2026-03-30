# Repository Restructure

Target structure for reorganising `src/` from type-grouped to feature-grouped.

## Principles

1. **Group by feature, not type.** If a file only exists to serve one feature, it lives in that feature's directory.
2. **Shared primitives are the exception.** Truly stateless, reusable UI components live in `ui/`. Truly reusable hooks live in `hooks/`. Everything else dissolves into its feature.
3. **Co-locate hooks with components.** Feature-specific hooks live in the same file as their component. They aren't exported or split into separate files.
4. **Components render, hooks think.** Business logic in hooks, JSX in components.
5. **Menus are self-sufficient.** They own their internal state and step navigation. Parents receive a result, not intermediate mutations.
6. **No hardcoded padding strings.** Use `<Indent>`, `<Box paddingLeft>`, or layout primitives. Components don't know their indentation depth.
7. **Commands are thin.** A command parses input, renders a menu component, and interprets the result. No business logic in commands.

## Target Structure

```
src/
├── index.tsx                           # Entry point
├── app.tsx                             # Root app component
│
├── chat/                               # Chat feature
│   ├── use-chat.ts                     # Chat state management hook
│   ├── use-chat.test.tsx
│   ├── completion-loop.ts              # Stream → execute tools → repeat
│   ├── completion-loop.test.ts
│   ├── chat-input.tsx                  # User input with autocomplete
│   ├── chat-input.test.tsx
│   ├── header.tsx                      # App header with logo
│   ├── thinking-indicator.tsx          # Streaming/thinking state
│   ├── thinking-indicator.test.tsx
│   ├── agent-indicators.tsx            # Active agent status
│   ├── agent-indicators.test.tsx
│   └── messages/                       # Message rendering by role
│       ├── message-list.tsx
│       ├── message-list.test.tsx
│       ├── user-message.tsx
│       ├── user-message.test.tsx
│       ├── assistant-message.tsx
│       ├── assistant-message.test.tsx
│       ├── system-message.tsx
│       ├── system-message.test.tsx
│       ├── tool-message.tsx
│       └── tool-message.test.tsx
│
├── settings/                           # Settings feature
│   ├── command.ts                      # /settings command (thin)
│   ├── command.test.ts
│   ├── settings-menu.tsx               # Main settings menu (renamed from settings-selector)
│   ├── settings-menu.test.tsx
│   ├── provider-manager.tsx            # Add/remove/edit providers
│   ├── provider-manager.test.tsx
│   ├── allowed-commands-editor.tsx
│   ├── allowed-commands-editor.test.tsx
│   ├── tool-availability-editor.tsx
│   ├── tool-availability-editor.test.tsx
│   ├── tool-permissions-editor.tsx
│   ├── tool-permissions-editor.test.tsx
│   ├── skill-sets-manager.tsx
│   ├── skill-sets-manager.test.tsx
│   ├── skill-set-sources-editor.tsx
│   └── skill-set-sources-editor.test.tsx
│
├── model/                              # Model selection feature
│   ├── command.ts                      # /model command (thin)
│   ├── command.test.ts
│   ├── model-selector.tsx
│   └── model-selector.test.tsx
│
├── session/                            # Session feature
│   ├── command.ts                      # /session command (thin)
│   ├── command.test.ts
│   ├── session-selector.tsx
│   ├── session-selector.test.tsx
│   ├── session.ts                      # Session persistence logic
│   └── session.test.ts
│
├── tools/                              # Tool implementations
│   ├── registry.ts
│   ├── registry.test.ts
│   ├── types.ts
│   ├── types.test.ts
│   ├── index.ts                        # Auto-registers all tools
│   ├── execution.ts                    # Tool execution hook (from hooks/tool-execution)
│   ├── execution.test.ts
│   ├── test-helpers.ts
│   ├── ask/
│   │   ├── ask.ts
│   │   ├── ask.test.ts
│   │   ├── ask-selector.tsx            # Interactive question UI
│   │   └── ask-selector.test.tsx
│   ├── file/
│   │   ├── read-file.ts
│   │   ├── read-file.test.ts
│   │   ├── write-file.ts
│   │   ├── write-file.test.ts
│   │   ├── edit-file.ts
│   │   ├── edit-file.test.ts
│   │   ├── format-diff.ts
│   │   ├── format-diff.test.ts
│   │   ├── write-file-confirm.tsx      # Write/edit confirmation dialog
│   │   ├── write-file-confirm.test.tsx
│   │   ├── file-access-confirm.tsx     # Out-of-cwd access confirmation
│   │   └── file-access-confirm.test.tsx
│   ├── search/
│   │   ├── glob.ts
│   │   ├── glob.test.ts
│   │   ├── grep.ts
│   │   └── grep.test.ts
│   ├── run-command/
│   │   ├── run-command.ts
│   │   ├── run-command.test.ts
│   │   ├── command-confirm.tsx         # Command execution confirmation
│   │   ├── command-confirm.test.tsx
│   │   ├── command-safety.ts           # Command allow-list checking
│   │   └── command-safety.test.ts
│   ├── agent.ts
│   ├── agent.test.ts
│   ├── agent-tracker.ts
│   ├── agent-tracker.test.ts
│   ├── web-search.ts
│   ├── web-search.test.ts
│   ├── skill.ts
│   └── skill.test.ts
│
├── commands/                           # Command registry + simple commands
│   ├── registry.ts
│   ├── registry.test.ts
│   ├── types.ts
│   ├── index.ts                        # Imports from feature dirs to register all
│   ├── help.ts
│   ├── help.test.ts
│   ├── new.ts
│   ├── new.test.ts
│   ├── context.ts
│   └── context.test.ts
│
├── ui/                                 # Shared stateless UI primitives
│   ├── indent.tsx                      # NEW — replaces hardcoded space strings
│   ├── indent.test.tsx
│   ├── menu.tsx                        # NEW — cursor-navigable list primitive
│   ├── menu.test.tsx
│   ├── menu-item.tsx                   # NEW — row with cursor indicator + label
│   ├── menu-item.test.tsx
│   ├── section-header.tsx              # NEW — "── Title ──" dividers
│   ├── section-header.test.tsx
│   ├── input-field.tsx                 # NEW — labeled inline text input
│   ├── input-field.test.tsx
│   ├── checkbox-list.tsx
│   ├── checkbox-list.test.tsx
│   ├── confirm.tsx                     # Renamed from confirm-prompt
│   ├── confirm.test.tsx
│   ├── hint-bar.tsx
│   ├── hint-bar.test.tsx
│   ├── text-input.tsx
│   ├── text-input.test.tsx
│   ├── markdown.tsx
│   └── markdown.test.tsx
│
├── hooks/                              # Shared stateless hooks
│   ├── use-list-navigation.ts
│   ├── use-list-navigation.test.tsx
│   ├── use-autocomplete.ts
│   └── use-autocomplete.test.tsx
│
├── provider/                           # AI provider client
│   ├── client.ts
│   ├── client.test.ts
│   ├── sse.ts
│   └── sse.test.ts
│
├── mcp/                                # MCP feature
│   ├── manager.ts
│   ├── manager.test.ts
│   ├── client.ts
│   ├── client.test.ts
│   ├── types.ts
│   ├── stdio-transport.ts
│   ├── stdio-transport.test.ts
│   ├── http-transport.ts
│   ├── http-transport.test.ts
│   ├── mcp-server-selector.tsx         # Moved from components/
│   └── mcp-server-selector.test.tsx
│
├── skills/                             # Skill loading and registry
│   ├── command.ts                      # /skills command
│   ├── command.test.ts
│   ├── registry.ts
│   ├── registry.test.ts
│   ├── types.ts
│   ├── loader.ts
│   ├── loader.test.ts
│   └── index.ts
│
├── skill-sets/                         # Skill set source management
│   ├── sources.ts
│   └── sources.test.ts
│
├── context/                            # Message context management
│   ├── truncate.ts
│   └── truncate.test.ts
│
├── config.ts                           # Config file management (YAML)
├── config.test.ts
├── permissions.ts                      # Permission checking
├── permissions.test.ts
├── instructions.ts                     # Instruction file loading
├── instructions.test.ts
├── env.ts                              # Environment variable helpers
├── env.test.ts
├── errors.ts                           # Error types
├── errors.test.ts
├── git.ts                              # Git helpers
├── git.test.ts
├── images.ts                           # Image handling
├── images.test.ts
└── strip-ansi.ts                       # ANSI escape stripping
    strip-ansi.test.ts
```

## Migration Map

Every current file and where it moves. Files not listed stay in place.

### `src/components/` → dissolved into features

| Current                                   | Target                                  | Notes                                |
| ----------------------------------------- | --------------------------------------- | ------------------------------------ |
| `components/chat-input.tsx`               | `chat/chat-input.tsx`                   |                                      |
| `components/header.tsx`                   | `chat/header.tsx`                       |                                      |
| `components/thinking-indicator.tsx`       | `chat/thinking-indicator.tsx`           |                                      |
| `components/agent-indicators.tsx`         | `chat/agent-indicators.tsx`             |                                      |
| `components/message-list.tsx`             | `chat/messages/message-list.tsx`        |                                      |
| `components/user-message.tsx`             | `chat/messages/user-message.tsx`        |                                      |
| `components/assistant-message.tsx`        | `chat/messages/assistant-message.tsx`   |                                      |
| `components/system-message.tsx`           | `chat/messages/system-message.tsx`      |                                      |
| `components/tool-message.tsx`             | `chat/messages/tool-message.tsx`        |                                      |
| `components/settings-selector.tsx`        | `settings/settings-menu.tsx`            | Rename + refactor to self-sufficient |
| `components/provider-manager.tsx`         | `settings/provider-manager.tsx`         |                                      |
| `components/allowed-commands-editor.tsx`  | `settings/allowed-commands-editor.tsx`  |                                      |
| `components/tool-availability-editor.tsx` | `settings/tool-availability-editor.tsx` |                                      |
| `components/tool-permissions-editor.tsx`  | `settings/tool-permissions-editor.tsx`  |                                      |
| `components/skill-sets-manager.tsx`       | `settings/skill-sets-manager.tsx`       |                                      |
| `components/skill-set-sources-editor.tsx` | `settings/skill-set-sources-editor.tsx` |                                      |
| `components/model-selector.tsx`           | `model/model-selector.tsx`              |                                      |
| `components/session-selector.tsx`         | `session/session-selector.tsx`          |                                      |
| `components/ask-selector.tsx`             | `tools/ask/ask-selector.tsx`            | Co-located with its tool             |
| `components/command-confirm.tsx`          | `tools/run-command/command-confirm.tsx` | Co-located with its tool             |
| `components/write-file-confirm.tsx`       | `tools/file/write-file-confirm.tsx`     | Co-located with its tool             |
| `components/file-access-confirm.tsx`      | `tools/file/file-access-confirm.tsx`    | Co-located with its tool             |
| `components/mcp-server-selector.tsx`      | `mcp/mcp-server-selector.tsx`           |                                      |
| `components/checkbox-list.tsx`            | `ui/checkbox-list.tsx`                  | Shared primitive                     |
| `components/confirm-prompt.tsx`           | `ui/confirm.tsx`                        | Rename                               |
| `components/hint-bar.tsx`                 | `ui/hint-bar.tsx`                       | Shared primitive                     |
| `components/text-input.tsx`               | `ui/text-input.tsx`                     | Shared primitive                     |
| `components/markdown.tsx`                 | `ui/markdown.tsx`                       | Shared primitive                     |

All corresponding `.test.tsx` files move with their source.

### `src/commands/` → feature commands split out

| Current                | Target                 | Notes                  |
| ---------------------- | ---------------------- | ---------------------- |
| `commands/registry.ts` | `commands/registry.ts` | Stays                  |
| `commands/types.ts`    | `commands/types.ts`    | Stays                  |
| `commands/index.ts`    | `commands/index.ts`    | Stays, imports updated |
| `commands/help.ts`     | `commands/help.ts`     | Stays (trivial)        |
| `commands/new.ts`      | `commands/new.ts`      | Stays (trivial)        |
| `commands/context.ts`  | `commands/context.ts`  | Stays (trivial)        |
| `commands/model.ts`    | `model/command.ts`     |                        |
| `commands/session.ts`  | `session/command.ts`   |                        |
| `commands/settings.ts` | `settings/command.ts`  |                        |
| `commands/skills.ts`   | `skills/command.ts`    |                        |

### `src/hooks/` → distributed

| Current                        | Target                         | Notes          |
| ------------------------------ | ------------------------------ | -------------- |
| `hooks/use-chat.ts`            | `chat/use-chat.ts`             | Chat-specific  |
| `hooks/tool-execution.ts`      | `tools/execution.ts`           | Tool-specific  |
| `hooks/use-list-navigation.ts` | `hooks/use-list-navigation.ts` | Stays (shared) |
| `hooks/use-autocomplete.ts`    | `hooks/use-autocomplete.ts`    | Stays (shared) |

### `src/tools/` → subdirectories by domain

| Current                  | Target                             | Notes                  |
| ------------------------ | ---------------------------------- | ---------------------- |
| `tools/ask.ts`           | `tools/ask/ask.ts`                 |                        |
| `tools/read-file.ts`     | `tools/file/read-file.ts`          |                        |
| `tools/write-file.ts`    | `tools/file/write-file.ts`         |                        |
| `tools/edit-file.ts`     | `tools/file/edit-file.ts`          |                        |
| `tools/format-diff.ts`   | `tools/file/format-diff.ts`        |                        |
| `tools/glob.ts`          | `tools/search/glob.ts`             |                        |
| `tools/grep.ts`          | `tools/search/grep.ts`             |                        |
| `tools/run-command.ts`   | `tools/run-command/run-command.ts` |                        |
| `tools/registry.ts`      | `tools/registry.ts`                | Stays                  |
| `tools/types.ts`         | `tools/types.ts`                   | Stays                  |
| `tools/index.ts`         | `tools/index.ts`                   | Stays, imports updated |
| `tools/test-helpers.ts`  | `tools/test-helpers.ts`            | Stays                  |
| `tools/agent.ts`         | `tools/agent.ts`                   | Stays (single file)    |
| `tools/agent-tracker.ts` | `tools/agent-tracker.ts`           | Stays (single file)    |
| `tools/web-search.ts`    | `tools/web-search.ts`              | Stays (single file)    |
| `tools/skill.ts`         | `tools/skill.ts`                   | Stays (single file)    |

### `src/` root → mostly stays

| Current              | Target                                | Notes                           |
| -------------------- | ------------------------------------- | ------------------------------- |
| `session.ts`         | `session/session.ts`                  | Co-located with session feature |
| `command-safety.ts`  | `tools/run-command/command-safety.ts` | Co-located with run-command     |
| `completion-loop.ts` | `chat/completion-loop.ts`             | Chat-specific                   |

Everything else at root (`config.ts`, `env.ts`, `errors.ts`, `git.ts`, `images.ts`, `instructions.ts`, `permissions.ts`, `strip-ansi.ts`) stays. These are shared utilities used across multiple features — not worth a `lib/` directory for the current count.

## New Files to Create

These are new UI primitives that don't exist yet. Create them before migrating existing components.

| File                    | Purpose                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui/indent.tsx`         | `<Indent level={n}>` — wraps children with `paddingLeft={n * 2}`. Replaces all `{"    "}` strings.                                                           |
| `ui/menu.tsx`           | `<Menu items onSelect onCancel renderItem hints>` — cursor-navigable list. Wraps `useListNavigation`. Renders cursor indicator, keyboard handling, hint bar. |
| `ui/menu-item.tsx`      | `<MenuItem active label hint icon>` — single row with cursor indicator and label.                                                                            |
| `ui/section-header.tsx` | `<SectionHeader title>` — renders `── Title ──` dividers. Replaces hardcoded decorator strings.                                                              |
| `ui/input-field.tsx`    | `<InputField label value onChange active>` — labeled inline text input with cursor indicator. Replaces patterns like `{"    ❯ Base URL: "}`.                 |

## Refactoring Order

Each step leaves the codebase in a working state with passing tests.

### Phase 1: Create primitives (no breakage)

1. Create `ui/indent.tsx` with tests
2. Create `ui/menu.tsx` and `ui/menu-item.tsx` with tests
3. Create `ui/section-header.tsx` with tests
4. Create `ui/input-field.tsx` with tests

### Phase 2: Migrate one menu end-to-end (validate the pattern)

5. Move `ask-selector.tsx` to `tools/ask/`, refactor to use primitives
6. Move `ask.ts` to `tools/ask/`, update imports
7. Verify the ask tool works correctly with the new structure

### Phase 3: Move files to feature directories

Do this in small batches — move files, update imports, run tests.

8. Create `chat/` — move chat-input, header, thinking-indicator, agent-indicators, messages, use-chat, completion-loop
9. Create `session/` — move session-selector, session command, session.ts
10. Create `model/` — move model-selector, model command
11. Create `settings/` — move settings-selector (rename to settings-menu), provider-manager, all editors, settings command
12. Move mcp-server-selector into `mcp/`
13. Move skills command into `skills/`
14. Move tool confirms into `tools/file/` and `tools/run-command/`
15. Move shared primitives to `ui/` — checkbox-list, confirm-prompt (rename to confirm), hint-bar, text-input, markdown
16. Create `tools/` subdirectories — `file/`, `search/`, `run-command/`, `ask/`
17. Move tool-execution hook to `tools/execution.ts`
18. Move command-safety to `tools/run-command/`
19. Delete empty `components/` directory

### Phase 4: Refactor components to use primitives

Migrate components one at a time to use `<Menu>`, `<Indent>`, `<MenuItem>`, `<SectionHeader>`, `<InputField>` — eliminating hardcoded padding strings.

20. Refactor `ask-selector` (already moved in phase 2)
21. Refactor `session-selector`
22. Refactor `model-selector`
23. Refactor `settings-menu` + make self-sufficient
24. Refactor `provider-manager` + simplify callback chain
25. Refactor `mcp-server-selector`
26. Refactor `checkbox-list` to use `<Indent>` internally
27. Refactor `confirm` to use `<Indent>` internally
28. Refactor `chat-input` autocomplete rendering

### Phase 5: Slim down callback chains

29. Refactor settings command → settings-menu to use result-based pattern instead of callback forwarding
30. Refactor tool execution → confirm dialogs to simplify callback nesting
31. Audit remaining callback chains and flatten where possible

### Phase 6: Integration tests

32. Add `__tests__/integration/` with tests for key flows:
    - `/settings` command → settings menu → provider add → result
    - `/model` command → model selector → result
    - `/session` command → session selector → result
    - Ask tool → ask selector → result
