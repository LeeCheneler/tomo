# Epic 1 — Project Scaffolding & Basic Chat

Set up the project from scratch and get a working single-turn chat loop against a local Ollama instance. User types a message, gets a streamed response with thinking text displayed separately and markdown rendered for the terminal.

## Tickets

### E1-01: Initialise project structure

Set up TypeScript project with Ink. Configure `tsup` for building. Set up `package.json` with a bin entry so the tool can be run as a CLI command. Create the directory structure:

```
src/
  index.tsx          # entry point
  config/
  core/
  providers/
  tools/
  ui/
```

Acceptance criteria:

- `npm run build` produces a working binary
- Running the binary renders a blank Ink app in the terminal

---

### E1-02: Test infrastructure

Set up the test runner and establish the testing pattern for the project. Configure for TypeScript and React/Ink component testing.

Acceptance criteria:

- Test runner is configured and `npm test` works
- At least one example unit test exists and passes
- React/Ink component testing is possible (e.g. via `ink-testing-library`)

---

### E1-03: Config schema and loader

Define the config schema for a **single default provider** (endpoint URL, default model), tool settings, and thinking parser config. Implement the config loader that reads `~/.tomo/config.yaml`, then overlays `./.tomo/config.yaml` if present. Use a YAML parsing library. Create a default config on first run if none exists.

The schema at this stage supports only one provider entry. Multi-provider support is added in Epic 3.

```yaml
# Minimal single-provider config for Epic 1
provider:
  endpoint: http://localhost:11434/v1
  defaultModel: qwen3-coder:30b

tools:
  exec:
    timeout: 30000
    allowlist: []
    denylist: []

thinking:
  parser: think-tags
```

Acceptance criteria:

- Config loads from global path
- Local override merges correctly on top
- Missing config file triggers creation of a sensible default
- Config is validated against the schema with clear error messages
- Unit tests cover loading, merging, validation, and default creation

---

### E1-04: Provider client — basic message sending

Build the provider client module. Takes an endpoint URL and model name. Sends a `POST` to `/v1/chat/completions` with a messages array. Supports streaming (`stream: true`). Consumes the SSE response and yields tokens as they arrive.

Acceptance criteria:

- Sends a valid request to Ollama's OpenAI-compatible endpoint
- Streams tokens back via an async iterable or callback
- Handles connection errors gracefully (endpoint down, model not found)
- Unit tests cover token parsing and error cases (mock the HTTP layer)

---

### E1-05: Thinking text stream parser

Build the `think-tags` parser that processes the token stream in real-time. Detects `<think>` opening and `</think>` closing tags. Routes tokens to either a "thinking" channel or a "response" channel. Handle edge cases: tags split across chunk boundaries, nested tags (treat as literal), no thinking at all.

Acceptance criteria:

- Correctly splits a stream containing `<think>` tags into two channels
- Handles tags split across SSE chunks
- Passes through content unchanged when no tags are present
- Unit tests cover normal, split-boundary, nested, and no-thinking cases

---

### E1-06: Markdown rendering for terminal output

LLM responses are markdown-heavy (code blocks, lists, headings, bold/italic). Add a markdown-to-terminal rendering layer so responses display well in the TUI. Evaluate existing libraries (e.g. `marked-terminal`, `ink-markdown`, or similar) or implement a lightweight renderer. Must handle at minimum: code blocks with syntax highlighting, inline code, bold, italic, lists, and headings.

Acceptance criteria:

- Code blocks render with syntax highlighting and visual boundaries
- Inline formatting (bold, italic, inline code) renders correctly
- Lists and headings render with appropriate indentation/styling
- Raw markdown is never shown to the user in normal output
- Graceful degradation for unsupported markdown features (render as plain text)

---

### E1-07: Ink UI — input and output

Scaffold the Ink app with a basic layout: scrollable output area at the top, text input at the bottom. Wire up the input to send a message to the provider client. Render streamed response tokens through the markdown renderer into the output area as they arrive. Display thinking text in a separate area (dimmed or italic) above the main response.

Acceptance criteria:

- User can type a message and press enter
- Response streams into the output area token by token, rendered as markdown
- Thinking text renders visually distinct from the response
- Input is disabled while a response is streaming

---

### E1-08: Single-turn end-to-end wiring

Connect config → provider client → stream parser → markdown renderer → UI. On launch, read config, initialise the provider client with the configured endpoint/model, and enter the chat loop. No history — each message is sent independently.

Acceptance criteria:

- Launch the tool, type a message, see a streamed response with thinking and markdown rendering
- Config changes (different model) take effect on next launch
- Clean error handling if Ollama isn't running
