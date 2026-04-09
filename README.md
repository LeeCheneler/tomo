# Tomo

> 友 — friend, companion

Terminal-native AI chat client built with React and Ink. Works with [Ollama](https://ollama.com), [OpenCode Zen](https://opencode.ai), and [OpenRouter](https://openrouter.ai).

## Install

```bash
brew tap leecheneler/tomo
brew install tomo
```

Or download the latest binary from [Releases](https://github.com/LeeCheneler/tomo/releases).

## Quick Start

1. Run `tomo`
2. Open `/settings → Providers` and add a provider (URL + API key if needed)
3. Pick a model with `/model`
4. Start chatting

Type `/` to see available commands and `//` to browse skills.

## Slash Commands

| Command     | Description                       |
| ----------- | --------------------------------- |
| `/new`      | Start a new session               |
| `/session`  | Browse and load saved sessions    |
| `/model`    | Switch the active model           |
| `/settings` | Manage providers, tools, MCP, etc |
| `/context`  | Show context window usage         |
| `/help`     | List commands and shortcuts       |

## Keyboard Shortcuts

| Key      | Action                                                 |
| -------- | ------------------------------------------------------ |
| `Tab`    | View the full conversation in your system pager        |
| `↑`      | Browse input history                                   |
| `Esc`    | Cancel an in-flight response, or clear the input       |
| `Cmd+V`  | Paste an image file path (e.g. copied from Finder)     |
| `Ctrl+V` | Paste an image from the clipboard (e.g. a screenshot) |
| `↓`      | When images are attached, enter image navigation mode  |

In image navigation mode: `← →` select, `Backspace` removes, `↑` or `Esc` exits.

The pager defaults to `less`. Set `PAGER` to override (allow-listed: `less`, `more`, `most`, `bat`, `cat`).

## Tools

The model can call tools to read files, run commands, and more. Tools are enabled by default; toggle them in `/settings → Tools`.

| Tool         | Description                                        | Default  |
| ------------ | -------------------------------------------------- | -------- |
| Read File    | Read file contents with line numbers               | Enabled  |
| Write File   | Create or overwrite a file                         | Enabled  |
| Edit File    | Apply string replacements to a file                | Enabled  |
| Glob         | Find files by glob pattern (respects `.gitignore`) | Enabled  |
| Grep         | Search file contents by regex                      | Enabled  |
| Run Command  | Run a shell command                                | Enabled  |
| Ask          | Ask the user a question                            | Enabled  |
| Skill        | Load specialised task instructions                 | Enabled  |
| Agent        | Spawn sub-agents for parallel research             | Enabled  |
| Web Search   | Search the web via Tavily API                      | Disabled |

**Web Search** requires a [Tavily](https://tavily.com) API key. Set `TAVILY_API_KEY` in your environment and enable the tool in `/settings → Tools`.

**Agent** spawns headless sub-agents that can read and explore the codebase in parallel. The model decides when to spawn them. Active agents show colour-coded progress indicators with tool call counts. Configure depth, concurrency, and the tools available to sub-agents under `agents` in your config file.

## Permissions

Write and edit operations prompt for confirmation by default. Read File is auto-allowed inside the current working directory. Manage permissions in `/settings → Permissions`, or in your config file:

```yaml
permissions:
  cwdReadFile: true # auto-allow reads inside cwd (default: true)
  cwdWriteFile: true # auto-allow writes inside cwd
  globalReadFile: true # auto-allow reads outside cwd
  globalWriteFile: true # auto-allow writes outside cwd
```

File operations outside the current working directory require the `global*` permissions even when the matching `cwd*` permission is enabled.

Run Command prompts by default. Auto-approve commands with an allow list under `/settings → Allowed Commands`, or in config:

```yaml
allowedCommands:
  - "git:*" # any command starting with "git "
  - "npm:*"
  - "npm test" # exact match
```

## MCP Servers

Tomo supports the [Model Context Protocol](https://modelcontextprotocol.io) for connecting to external tool servers. MCP tools appear alongside built-in tools and the model can call them transparently.

Manage servers in `/settings → MCP Servers`, or in config under `mcp.connections`:

```yaml
mcp:
  connections:
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

    my-http-server:
      transport: http
      url: https://mcp.example.com/mcp
      headers:
        Authorization: "Bearer ${MCP_API_KEY}"
      enabled: true
```

**Stdio transport** fields: `command` (required), `args`, `env`.
**HTTP transport** fields: `url` (required), `headers`.

Use `${VAR_NAME}` in any string value to interpolate an environment variable. Missing variables resolve to an empty string. This keeps secrets out of the config file.

## Skills

Skills are reusable instruction sets the model can load for specialised tasks. Each skill lives in its own directory with a `SKILL.md` file.

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

Type `//` to browse available skills, then `//skill-name` to invoke one. The model will also load relevant skills automatically when appropriate.

## Skill Sets

Skill sets are collections of skills shared via git repos. A single repo can contain multiple skill sets, each marked by a `tomo-skills.json` file.

**Repo structure:**

```
my-skills-repo/
  dev/
    tomo-skills.json        # { "name": "dev", "description": "Dev tools" }
    commit/
      SKILL.md
    pr/
      SKILL.md
  design/
    tomo-skills.json        # { "name": "design" }
    web/
      SKILL.md
```

Skills from skill sets are namespaced as `setName:skillName` (e.g. `dev:commit`) to avoid conflicts with global and local skills.

Manage sources and toggle individual sets under `/settings → Skill Sets`. Sources are cloned to `~/.tomo/skill-set-sources/`. Skill sets are off by default — opt in per set.

In config:

```yaml
skillSets:
  sources:
    - url: "git@github.com:org/my-skills.git"
      enabledSets:
        - dev
```

## Sessions

Conversations are saved automatically as JSONL files under `~/.tomo/sessions/`. Use `/session` to browse and resume a previous conversation. Press `Tab` from the input to view the current conversation in your system pager.

## Instruction Files

Tomo loads optional instruction files as system messages from two locations:

- **Global:** `~/tomo.md`
- **Local:** `.tomo/tomo.md`

When both exist, they are combined. Use them for project-specific context, conventions, or rules you want the model to follow.

## Configuration

Config lives at `~/.tomo/config.yaml` (global) with optional local overrides at `./.tomo/config.yaml`. On first run, an empty config is created and `/settings → Providers` opens automatically so you can configure your first provider.

Most settings are managed interactively via `/settings`. A minimal config looks like this:

```yaml
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
  - name: openrouter
    type: openrouter
    baseUrl: https://openrouter.ai/api
    apiKey: sk-or-... # or set OPENROUTER_API_KEY
```

Provider API keys can also come from environment variables: `OPENCODE_API_KEY`, `OPENROUTER_API_KEY`. Ollama needs no auth.

The full schema (permissions, allowedCommands, agents, mcp, skillSets, tools) is defined in `src/config/schema.ts`.

### Agents

Sub-agent behaviour is configurable under `agents`:

```yaml
agents:
  maxDepth: 1 # maximum nesting depth
  maxConcurrent: 3 # max agents running at once
  maxTimeoutSeconds: 300 # per-agent timeout
  tools: # tools available to sub-agents
    - read_file
    - glob
    - grep
    - web_search
    - skill
    - run_command
```

All fields are optional and default to the values shown above.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
