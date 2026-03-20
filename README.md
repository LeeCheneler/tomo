# Tomo

> 友 — friend, companion

Terminal-native AI chat client built with Ink and TypeScript. Connects to Ollama or any OpenAI-compatible endpoint with streaming responses and markdown rendering.

- **Local first** — no third-party AI providers required
- **OpenAI-compatible** — works with Ollama, llama.cpp, vLLM, LocalAI, or any compliant endpoint
- **Session persistence** — conversations saved to disk, resume with `/session`
- **Convention-based config** — global config in `~/.tomo/`, local overrides in `./.tomo/`

## Install

Download the latest binary from [Releases](https://github.com/LeeCheneler/tomo/releases).

On macOS, you'll need to remove the quarantine attribute before running:

```bash
xattr -cr tomo
```

## Config

Tomo looks for config at `~/.tomo/config.yaml` (global) and `./.tomo/config.yaml` (local override). A default config is created on first run.

```yaml
activeProvider: ollama
activeModel: qwen3:8b

providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | List available commands |
| `/new` | Start a new conversation |
| `/session` | Browse and load previous sessions |
| `/session <id>` | Load a session by ID |
| `/models` | List available models from the provider |
| `/use` | Interactive model picker |
| `/use <model>` | Switch to a different model |
| `/use <provider/model>` | Switch provider and model |

Commands autocomplete as you type with ghost text suggestions.

## Instruction Files

Tomo loads instruction files and sends them as a system message to the LLM. Files are searched case-insensitively in order of preference:

1. `.tomo/` directory
2. `.claude/` directory
3. Current/home directory

Within each directory, `claude.md` is checked before `agents.md`. Both global (`~/`) and local (`./`) locations are searched and combined.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | Insert newline |
| `Escape` | Cancel streaming |
| `Ctrl+C` | Clear input, or exit (double-tap) |
| `←` `→` | Move cursor |
| `↑` `↓` | Move cursor across lines |
| `Ctrl+A` / `Ctrl+E` | Jump to start/end of input |
| `Option+←` `Option+→` | Skip words |

## Sessions

Conversations are automatically saved to `~/.tomo/sessions/` as JSONL files. On exit, tomo displays a resume command:

```
  Resume with /session <id>
```

Use `/session` to browse previous sessions or `/session <id>` to load one directly.

## Development

```bash
pnpm install
pnpm dev        # run in development
pnpm test       # run tests
pnpm build      # bundle to dist/tomo.js
pnpm build:sea  # build standalone binary
```
