# Tomo

> 友 — friend, companion

Terminal-native AI chat client built with Ink and TypeScript. Connects to local LLM providers (Ollama and any OpenAI-compatible endpoint), supports streaming responses with thinking text extraction, and provides tool-calling capabilities.

- **Local first** — no third-party AI providers or search APIs required
- **OpenAI-compatible** — works with Ollama, llama.cpp, vLLM, LocalAI, or any compliant endpoint
- **Pluggable tools** — web search via DuckDuckGo, guarded CLI command execution
- **Convention-based config** — global config in `~/.tomo/`, local overrides in `./.tomo/`

## Install

Download the latest binary from [Releases](https://github.com/LeeCheneler/tomo/releases).

On macOS, you'll need to remove the quarantine attribute before running:

```bash
xattr -cr tomo
```
