# Tomo

> 友 — friend, companion

Terminal-native AI chat client. Works with [Ollama](https://ollama.com), [OpenCode Zen](https://opencode.ai), and [OpenRouter](https://openrouter.ai).

## Install

```bash
brew tap leecheneler/tomo
brew install tomo
```

Or download the latest binary from [Releases](https://github.com/LeeCheneler/tomo/releases).

## Quick Start

1. Run `tomo`
2. On first launch, `/provider` opens automatically — select a provider type, enter the URL and API key (if needed), and pick a model
3. Start chatting

Tomo supports three provider types:

| Type           | Description                           | Auth                                               |
| -------------- | ------------------------------------- | -------------------------------------------------- |
| `ollama`       | Local Ollama instance                 | None required                                      |
| `opencode-zen` | OpenCode Zen API                      | `apiKey` in config or `OPENCODE_API_KEY` env var   |
| `openrouter`   | OpenRouter (access to many providers) | `apiKey` in config or `OPENROUTER_API_KEY` env var |

Context window size is auto-detected for all provider types.

## Slash Commands

Type `/` to see available commands with autocomplete suggestions.

| Command         | Description                                     |
| --------------- | ----------------------------------------------- |
| `/new`          | Start a new conversation                        |
| `/session`      | Browse and load previous sessions               |
| `/session <id>` | Load a session by ID                            |
| `/model`        | Switch the active model                         |
| `/provider`     | Manage providers (add/remove)                   |
| `/settings`     | Manage tools, permissions, allowed commands, and MCP servers |
| `/context`      | Show context window usage stats                 |
| `/skills`       | List available skills                           |
| `/help`         | List available commands                         |

## Tools

Tomo can read, write, and search files, run commands, and more. Tools are enabled by default and the model calls them as needed.

| Tool         | Description                                           | Default  |
| ------------ | ----------------------------------------------------- | -------- |
| Read File    | Read file contents with line numbers                  | Enabled  |
| Write File   | Create or overwrite a file                            | Enabled  |
| Edit File    | Apply string replacements to a file                   | Enabled  |
| Glob         | Find files by glob pattern (respects `.gitignore`)    | Enabled  |
| Grep         | Search file contents by regex (respects `.gitignore`) | Enabled  |
| Run Command  | Run a shell command                                   | Enabled  |
| Ask          | Ask the user a question                               | Enabled  |
| Skill        | Load specialized task instructions                    | Enabled  |
| Agent        | Spawn sub-agents for parallel research/exploration    | Enabled  |
| Web Search   | Search the web via Tavily API                         | Disabled |

Web Search requires a [Tavily](https://tavily.com) API key. Set `TAVILY_API_KEY` in your environment and enable the tool with `/settings`.

Agent spawns headless sub-agents that can read files, search code, and explore the codebase in parallel. The model decides when to spawn agents and how many. Active agents show color-coded progress indicators with tool call counts.

## MCP Servers

Tomo supports the [Model Context Protocol](https://modelcontextprotocol.io) (MCP) for connecting to external tool servers. MCP servers extend Tomo with additional tools — database access, API integrations, file systems, and more.

Use `/settings` → **MCP Servers** to add, remove, and configure servers. Individual tools within a server can be toggled off to hide them from the model while keeping the server connected.

### Config

MCP servers are stored in the global config (`~/.tomo/config.yaml`) under `mcpServers`:

```yaml
mcpServers:
  my-http-server:
    transport: http
    url: https://mcp.example.com/mcp
    headers:
      Authorization: "Bearer ${MCP_API_KEY}"
    enabled: true
    tools:
      - name: get_data
        enabled: true
        description: "Fetch data from the API"

  my-stdio-server:
    transport: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/tmp"
    env:
      SOME_VAR: "${MY_ENV_VAR}"
    enabled: true
```

**HTTP transport** fields: `url` (required), `headers` (optional).

**Stdio transport** fields: `command` (required), `args` (optional), `env` (optional).

Both transports support `enabled` and `tools` fields.

### Environment Variables

Use `${VAR_NAME}` in any string value to reference environment variables. This is useful for keeping secrets out of config files:

```yaml
headers:
  Authorization: "Bearer ${MCP_API_KEY}"
```

If the variable is not set, it resolves to an empty string.

## Permissions

Write and edit operations prompt for confirmation by default. Read File is auto-allowed. Use `/settings` → **Tool Permissions** to change this, or set in config:

```yaml
permissions:
  read_file: true
  write_file: true  # covers both Write File and Edit File
```

Run Command prompts by default. Commands can be auto-approved via allowed commands in config. Use exact commands or `prefix:*` for all commands starting with a given prefix:

```yaml
allowed_commands:
  - "git:*"
  - "npm:*"
  - "npm test"
```

File operations outside the current working directory always prompt regardless of permissions.

## Config

Config lives at `~/.tomo/config.yaml` (global) with optional local overrides at `./.tomo/config.yaml`.

On first run, an empty config is created and `/provider` launches automatically to set up your first provider. You can also edit the config file directly:

```yaml
activeProvider: ollama
activeModel: qwen3:8b
maxTokens: 8192

providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
    # contextWindow: 32768  # optional override (auto-detected)
    # models:               # optional per-model overrides
    #   qwen3:4b:
    #     maxTokens: 16384
  - name: openrouter
    type: openrouter
    baseUrl: https://openrouter.ai/api
    apiKey: sk-or-...  # or set OPENROUTER_API_KEY env var
```

Use `/provider` to add or remove providers interactively.

### Agents

Sub-agent behaviour is configurable via an optional `agents` section:

```yaml
agents:
  maxDepth: 1         # maximum nesting depth (default: 1)
  maxConcurrent: 3    # max agents running at once (default: 3)
  timeoutSeconds: 300 # per-agent timeout (default: 300)
  tools:              # tools available to agents (default below)
    - read_file
    - glob
    - grep
    - web_search
    - skill
```

All fields are optional — sensible defaults apply if the section is omitted entirely.

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
