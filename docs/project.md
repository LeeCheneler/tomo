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
- **Package manager:** pnpm
- **TUI framework:** Ink (React-based terminal UI)
- **Build tool:** tsup (esbuild-based bundler)
- **Test runner:** Vitest
- **Config format:** YAML
- **Session storage:** JSONL files on disk (append-only)
- **Distribution:** Node SEA standalone binary → Homebrew

## Goals

### Chat with local LLMs

Connect to Ollama or any OpenAI-compatible endpoint. Stream responses token-by-token. Extract and display thinking text (e.g. `<think>` tags from Qwen3/DeepSeek R1) separately from the main response. Render markdown in the terminal (code blocks with syntax highlighting, inline formatting, lists, headings).

### Session persistence

Save conversations to disk as JSON. Resume previous sessions. Support slash commands for session management (`/new`, `/sessions`, `/rename`). Handle context window limits by truncating oldest messages from the request while preserving the full history on disk.

### Multiple providers and models

Configure multiple named providers in YAML. Switch between providers and models at runtime via `/use`. Query available models from the provider's `/v1/models` endpoint. Display active provider and model in a status bar.

### Pluggable tool system

Tool registry maps tool names to OpenAI function schemas and async handlers. Provider client includes tool definitions in requests. Full tool-calling loop: model requests a tool call → dispatch to handler → return result → model synthesises final response. Multiple sequential tool calls per turn.

### Web search

Hit `lite.duckduckgo.com` via HTTP, parse HTML to extract results (title, URL, snippet). No API keys. Registered as a `web_search` tool in the registry.

### CLI command execution

Guarded `run_command` tool with an approval prompt before execution. Configurable timeout (default 30s). Output truncation for long results. Allowlist/denylist for auto-approve/auto-reject by command prefix.

### Config

Global config at `~/.tomo/config.yaml`, local overrides at `./.tomo/config.yaml`. YAML format. Validated against a schema with clear error messages. Default config created on first run.

### Distribution

Standalone binary via Node SEA (no Node.js required on target). GitHub release automation with checksums. Homebrew formula for `brew install`. npm package as a fallback install method.
