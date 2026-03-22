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
maxTokens: 8192

providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
    # contextWindow: 32768  # optional override (auto-detected for Ollama)
    # models:                # optional per-model overrides
    #   qwen3:4b:
    #     maxTokens: 16384
```

- `maxTokens` — global default for max response tokens (default: 8192)
- `contextWindow` — optional override per provider (auto-detected from Ollama, falls back to 4096)
- `models.<name>.maxTokens` — optional per-model override for max response tokens

## Permissions

Tool permissions control whether the model can use file tools without prompting for confirmation. Defaults:

| Tool         | Default |
| ------------ | ------- |
| `read_file`  | Allowed |
| `write_file` | Prompt  |
| `edit_file`  | Prompt  |

Use `/grant` to toggle permissions interactively, or set them in `.tomo/config.yaml`:

```yaml
permissions:
  read_file: true
  write_file: true
  edit_file: true
```

File operations targeting paths outside the current working directory always require confirmation regardless of permission settings.

## Tools

Tools are model-initiated actions the LLM can call during a conversation.

| Tool          | Description                                           | Permission   | Default  |
| ------------- | ----------------------------------------------------- | ------------ | -------- |
| `read_file`   | Read file contents with line numbers                  | `read_file`  | Enabled  |
| `write_file`  | Create or overwrite a file                            | `write_file` | Enabled  |
| `edit_file`   | Apply string replacements to a file                   | `edit_file`  | Enabled  |
| `glob`        | Find files by glob pattern (respects `.gitignore`)    | `read_file`  | Enabled  |
| `grep`        | Search file contents by regex (respects `.gitignore`) | `read_file`  | Enabled  |
| `run_command` | Run a shell command (always prompts)                  | —            | Enabled  |
| `ask`         | Ask the user a multiple-choice question               | —            | Enabled  |
| `web_search`  | Search the web via Tavily API                         | —            | Disabled |

`web_search` uses the [Tavily](https://tavily.com) search API. Set `TAVILY_API_KEY` in your environment and enable the tool with `/tools`.

## Slash Commands

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `/help`                 | List available commands                 |
| `/new`                  | Start a new conversation                |
| `/session`              | Browse and load previous sessions       |
| `/session <id>`         | Load a session by ID                    |
| `/models`               | List available models from the provider |
| `/use`                  | Interactive model picker                |
| `/use <model>`          | Switch to a different model             |
| `/use <provider/model>` | Switch provider and model               |
| `/context`              | Show context window usage stats         |
| `/tools`                | List available tools                    |
| `/grant`                | Manage tool permissions                 |

Commands autocomplete as you type with ghost text suggestions.

## Instruction Files

Tomo loads instruction files and sends them as a system message to the LLM. Files are searched case-insensitively in order of preference:

1. `.tomo/` directory
2. `.claude/` directory
3. Current/home directory

Within each directory, `claude.md` is checked before `agents.md`. Both global (`~/`) and local (`./`) locations are searched and combined.

## Keyboard Shortcuts

| Key                   | Action                            |
| --------------------- | --------------------------------- |
| `Enter`               | Send message                      |
| `Shift+Enter`         | Insert newline                    |
| `Escape`              | Cancel streaming                  |
| `Ctrl+C`              | Clear input, or exit (double-tap) |
| `←` `→`               | Move cursor                       |
| `↑` `↓`               | Move cursor across lines          |
| `Ctrl+A` / `Ctrl+E`   | Jump to start/end of input        |
| `Option+←` `Option+→` | Skip words                        |

## Sessions

Conversations are automatically saved to `~/.tomo/sessions/` as JSONL files. On exit, tomo displays a resume command:

```
  Resume with /session <id>
```

Use `/session` to browse previous sessions or `/session <id>` to load one directly.
