# Tomo

> 友 — friend, companion

Terminal-native AI chat client. Local-first, works with Ollama or any OpenAI-compatible endpoint.

## Install

```bash
brew tap leecheneler/tomo
brew install tomo
```

Or download the latest binary from [Releases](https://github.com/LeeCheneler/tomo/releases).

## Quick Start

1. Install and run [Ollama](https://ollama.com)
2. Pull a model: `ollama pull qwen3:8b`
3. Run `tomo`

That's it. Tomo creates a default config on first run pointing at Ollama on localhost.

## Slash Commands

Type `/` to see available commands with autocomplete suggestions.

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `/new`                  | Start a new conversation                |
| `/session`              | Browse and load previous sessions       |
| `/session <id>`         | Load a session by ID                    |
| `/models`               | List available models from the provider |
| `/use`                  | Interactive model picker                |
| `/use <model>`          | Switch to a different model             |
| `/use <provider/model>` | Switch provider and model               |
| `/context`              | Show context window usage stats         |
| `/tools`                | Toggle tools on/off                     |
| `/grant`                | Manage tool permissions                 |
| `/help`                 | List available commands                 |

## Tools

Tomo can read, write, and search files, run commands, and more. Tools are enabled by default and the model calls them as needed.

| Tool          | Description                                           | Default  |
| ------------- | ----------------------------------------------------- | -------- |
| `read_file`   | Read file contents with line numbers                  | Enabled  |
| `write_file`  | Create or overwrite a file                            | Enabled  |
| `edit_file`   | Apply string replacements to a file                   | Enabled  |
| `glob`        | Find files by glob pattern (respects `.gitignore`)    | Enabled  |
| `grep`        | Search file contents by regex (respects `.gitignore`) | Enabled  |
| `run_command` | Run a shell command (always prompts)                  | Enabled  |
| `ask`         | Ask the user a question                               | Enabled  |
| `web_search`  | Search the web via Tavily API                         | Disabled |

`web_search` requires a [Tavily](https://tavily.com) API key. Set `TAVILY_API_KEY` in your environment and enable the tool with `/tools`.

## Permissions

Write operations (`write_file`, `edit_file`) prompt for confirmation by default. `read_file` is auto-allowed. Use `/grant` to change this, or set in config:

```yaml
permissions:
  read_file: true
  write_file: true
  edit_file: true
```

File operations outside the current working directory always prompt regardless of permissions.

## Config

Config lives at `~/.tomo/config.yaml` (global) with optional local overrides at `./.tomo/config.yaml`. A default is created on first run.

```yaml
activeProvider: ollama
activeModel: qwen3:8b
maxTokens: 8192

providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
    # contextWindow: 32768  # optional (auto-detected for Ollama)
    # models:
    #   qwen3:4b:
    #     maxTokens: 16384
```

## Instruction Files

Tomo loads instruction files as system messages. It checks `.tomo/`, `.claude/`, and the current directory for `claude.md` or `agents.md`. Both global (`~/`) and local (`./`) files are combined.

## Sessions

Conversations are saved automatically. Use `/session` to browse or `/session <id>` to resume.
