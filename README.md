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

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `/new`          | Start a new conversation           |
| `/session`      | Browse and load previous sessions  |
| `/session <id>` | Load a session by ID               |
| `/model`        | Switch the active model            |
| `/configure`    | Manage providers (add/remove)      |
| `/context`      | Show context window usage stats    |
| `/tools`        | Toggle tools on/off                |
| `/grant`        | Manage tool permissions            |
| `/skills`       | List available skills              |
| `/help`         | List available commands            |

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
| `skill`       | Load specialized task instructions                    | Enabled  |
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
    # contextWindow: 32768  # optional (auto-detected)
    # models:
    #   qwen3:4b:
    #     maxTokens: 16384
  # - name: zen
  #   type: opencode-zen
  #   baseUrl: https://opencode.ai/zen
  #   apiKey: ...  # or set OPENCODE_API_KEY env var
  # - name: openrouter
  #   type: openrouter
  #   baseUrl: https://openrouter.ai/api
  #   apiKey: ...  # or set OPENROUTER_API_KEY env var
```

Use `/configure` to add or remove providers interactively, or edit the config file directly.

## Instruction Files

Tomo loads instruction files as system messages. It checks `.tomo/`, `.claude/`, and the current directory for `claude.md` or `agents.md`. Both global (`~/`) and local (`./`) files are combined.

## Skills

Skills are reusable instruction sets that the model can load for specialized tasks. Each skill lives in its own directory with a `SKILL.md` file.

**Locations:**

- Global: `~/.tomo/skills/<skill-name>/SKILL.md`
- Local: `./.tomo/skills/<skill-name>/SKILL.md`

Local skills override global skills with the same name.

**Format:**

```markdown
---
name: my-skill
description: What this skill does
---

Instruction content loaded as context when the skill is invoked.
```

Use `/skills` to list available skills. The model will automatically load relevant skills when appropriate, or you can ask it to use a specific skill.

## Images

Tomo supports sending images to vision-capable models (e.g. Qwen 2.5 VL).

- **Paste a file** — copy an image file in Finder and `Cmd+V` in tomo. The file path is detected and the image is auto-attached.
- **Paste a screenshot** — take a screenshot or copy image content, then press `Ctrl+V` to attach from clipboard (macOS).

Attached images appear in the bottom bar as `[Img 1][Img 2]` etc. Press `↓` to navigate into images, `←→` to select, and `⌫` to remove.

## Sessions

Conversations are saved automatically. Use `/session` to browse or `/session <id>` to resume.
