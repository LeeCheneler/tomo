# Epic 3 — Provider & Model Configuration

Extend the config schema from a single provider to support multiple named providers. Allow switching between providers and models at runtime via slash commands.

## Tickets

### E3-01: Multi-provider config support

Extend the config schema from Epic 1's single `provider` entry to a named `providers` map with a `defaultProvider` key. Each entry has an endpoint URL and optional default model. Migrate the config loader and validation. Ensure backward compatibility is not needed — this is a schema change before any users exist.

```yaml
# Before (Epic 1)
provider:
  endpoint: http://localhost:11434/v1
  defaultModel: qwen3-coder:30b

# After (Epic 3)
defaultProvider: local-ollama

providers:
  local-ollama:
    endpoint: http://localhost:11434/v1
    defaultModel: qwen3-coder:30b

  llama-cpp:
    endpoint: http://localhost:8080/v1
    defaultModel: default
```

Acceptance criteria:

- Config supports multiple providers under a `providers` key
- Each provider has a name (the map key), `endpoint`, and optional `defaultModel`
- `defaultProvider` selects the active provider on launch
- Config loads and validates correctly
- Existing tests updated for the new schema
- Default config generation creates the new format

---

### E3-02: `/providers` command — list configured providers

Display all configured providers with their names, endpoints, and whether they're currently active. Register with the slash command router from Epic 2.

Acceptance criteria:

- Lists all providers from config
- Highlights the currently active provider
- Shows endpoint URL for each

---

### E3-03: `/models` command — list available models

Query the active provider's `/v1/models` endpoint and display the available models. Handle providers that don't support this endpoint gracefully.

Acceptance criteria:

- Lists models from the provider's API
- Handles connection errors and unsupported endpoints
- Shows which model is currently active

---

### E3-04: `/use` command — switch provider and model

Allow the user to switch the active provider and/or model for the current session. Syntax: `/use <provider>` to switch provider (uses its default model), or `/use <provider> <model>` to switch both. Update the session metadata.

Acceptance criteria:

- Switching provider updates the client for subsequent messages
- Session metadata records the new provider/model
- Invalid provider or model names show a clear error

---

### E3-05: Status bar — display active provider and model

Add a persistent status bar to the Ink UI (top or bottom) showing the current provider name and model. Updates when the user switches via `/use`.

Acceptance criteria:

- Status bar visible at all times
- Reflects the active provider and model
- Updates immediately on `/use` commands
