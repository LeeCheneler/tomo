# Tomo — Project Overview

> **Tomo** (友 — friend, companion). A terminal-native AI chat client built with Ink (React for CLIs) and TypeScript. Connects to local LLM providers (Ollama and any OpenAI-compatible endpoint), supports streaming responses with thinking text extraction, and provides tool-calling capabilities including local web search and guarded CLI command execution.

## Design Principles

- **Local first** — no third-party AI providers or search APIs required
- **OpenAI-compatible** — targets the `/v1/chat/completions` schema, works with Ollama, llama.cpp, vLLM, LocalAI, or any compliant endpoint
- **Pluggable tools** — tool registry pattern so new capabilities can be added without touching the core conversation loop
- **Convention-based config** — global config in `~/.tomo/`, local overrides in `./.tomo/` within the working directory

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js
- **TUI framework:** Ink (React-based terminal UI)
- **Build tool:** tsup (fast, zero-config bundler)
- **Config format:** YAML
- **Session storage:** JSON files on disk

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│                  Ink TUI Layer                │
│  (input, message display, status bar, menus) │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│              Core Engine                      │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Conversation │  │   Slash Command      │   │
│  │ Manager      │  │   Router             │   │
│  └──────┬──────┘  └──────────────────────┘   │
│         │                                     │
│  ┌──────▼──────┐  ┌──────────────────────┐   │
│  │  Provider    │  │   Tool Registry      │   │
│  │  Client      │  │   & Dispatcher       │   │
│  └─────────────┘  └──────────────────────┘   │
│                                               │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │  Config      │  │   Session            │   │
│  │  Loader      │  │   Store              │   │
│  └─────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────┘
               │                 │
     ┌─────────▼──┐    ┌────────▼─────────┐
     │   Ollama /  │    │  Tool Handlers   │
     │   LLM API   │    │  (search, exec)  │
     └────────────┘    └──────────────────┘
```

## Config Structure

### Global config: `~/.tomo/config.yaml`

```yaml
defaultProvider: local-ollama

providers:
  local-ollama:
    endpoint: http://localhost:11434/v1
    defaultModel: qwen3-coder:30b

  llama-cpp:
    endpoint: http://localhost:8080/v1
    defaultModel: default

tools:
  exec:
    timeout: 30000
    allowlist: []
    denylist: []

thinking:
  # default parser for models that emit <think> tags
  parser: think-tags
```

### Local override: `./.tomo/config.yaml`

Merges on top of global config. Useful for per-project model or tool settings.

### Session files: `~/.tomo/sessions/<id>.json`

```json
{
  "id": "a1b2c3d4",
  "name": null,
  "createdAt": "2026-03-18T10:00:00Z",
  "updatedAt": "2026-03-18T10:05:00Z",
  "provider": "local-ollama",
  "model": "qwen3-coder:30b",
  "messages": [
    { "role": "user", "content": "hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

## Thinking Text Handling

Not standardised across models. Tomo uses a configurable parser approach:

| Model Family | Thinking Format                             | Parser       |
| ------------ | ------------------------------------------- | ------------ |
| Qwen3        | `<think>...</think>` tags in content stream | `think-tags` |
| DeepSeek R1  | `<think>...</think>` tags in content stream | `think-tags` |
| Most others  | No dedicated thinking output                | `none`       |

The `think-tags` parser splits the streamed content in real-time, routing text inside `<think>` tags to a separate "thinking" display area (dimmed/italic) and everything else to the main response area.

## Tool Calling Flow

```
User sends message
        │
        ▼
Provider receives messages + tool definitions
        │
        ▼
Model responds ─── normal content ──► render to UI
   │
   └── tool_calls array
        │
        ▼
Tool dispatcher resolves handler
        │
        ▼
[If exec tool] ──► Show approval prompt ──► User approves/rejects
        │
        ▼
Execute handler, capture result
        │
        ▼
Append tool_call message + tool result to history
        │
        ▼
Re-send to provider for model to synthesise final response
```

## DuckDuckGo Search Approach

Hit `lite.duckduckgo.com` via HTTP, parse the HTML response to extract search results. No API keys, no third-party search providers. Returns structured results (title, URL, snippet) to the model as tool content.

---

## Work Breakdown

Six epics, ordered by dependency. Each epic has its own detailed spec:

| Epic | Name                                                        | Dependencies |
| ---- | ----------------------------------------------------------- | ------------ |
| 1    | [Project Scaffolding & Basic Chat](./epic-01-scaffolding.md) | —            |
| 2    | [Session Management & Chat History](./epic-02-sessions.md)   | Epic 1       |
| 3    | [Provider & Model Configuration](./epic-03-providers.md)     | Epic 2       |
| 4    | [Tool System](./epic-04-tool-system.md)                      | Epic 1       |
| 5    | [Web Search Tool](./epic-05-web-search.md)                   | Epic 4       |
| 6    | [CLI Command Execution](./epic-06-cli-execution.md)          | Epic 4       |

```
Epic 1 ──► Epic 2 ──► Epic 3
  │
  └──────► Epic 4 ──► Epic 5
                 └──► Epic 6
```

Epics 2/3 and 4/5/6 can be worked in parallel once Epic 1 is complete.
