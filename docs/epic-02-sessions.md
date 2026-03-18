# Epic 2 — Session Management & Chat History

Add persistent sessions so conversations are preserved between exchanges and between launches. Support slash commands for session management. Handle context window limits as history grows.

## Tickets

### E2-01: Session data model and persistence

Define the session data structure (ID, name, timestamps, provider, model, messages array). Implement save/load functions targeting `~/.tomo/sessions/<id>.json`. Generate IDs using a short random string (nanoid or similar).

Acceptance criteria:

- Sessions save to disk as JSON after each exchange
- Sessions load correctly from disk
- Corrupt or missing files are handled gracefully
- Unit tests cover save, load, and error handling

---

### E2-02: Conversation history in provider requests

Update the provider client call to send the full message history from the active session, not just the latest message. Append each user message and assistant response to the session's message array.

Acceptance criteria:

- Multi-turn conversations work — model has context from earlier messages
- History grows correctly across exchanges
- Session file on disk reflects the full history

---

### E2-03: Slash command parser and router

Implement input interception for messages starting with `/`. Parse the command name and arguments. Route to a command handler registry. If the command is unrecognised, show an error rather than sending it to the model. Build a `/help` command that lists available commands.

Acceptance criteria:

- `/help` displays available commands
- Unknown slash commands show an error message
- Normal messages (not starting with `/`) are sent to the provider as before
- Command registry is extensible (Epic 3 adds more commands)

---

### E2-04: `/new` command — start a new session

Create a new empty session, set it as active, and update the UI to reflect a fresh conversation.

Acceptance criteria:

- `/new` creates a new session file on disk
- UI clears and is ready for a fresh conversation
- Previous session is saved before switching

---

### E2-05: `/sessions` command — list and select sessions

List all saved sessions with their ID, name (if set), last updated timestamp, and a preview of the first user message. Present as a navigable list. Selecting a session loads it and resumes the conversation.

Acceptance criteria:

- Sessions listed in reverse chronological order
- User can navigate the list and select a session
- Selected session loads and displays the existing message history
- User can press escape to cancel and return to the current session

---

### E2-06: `/rename` command — label a session

Allow the user to give the current session a human-friendly name. Updates the session metadata and persists immediately.

Acceptance criteria:

- `/rename My API Exploration` updates the session name
- Name appears in the `/sessions` list
- Persisted to the session JSON file

---

### E2-07: Auto-create session on launch

On app launch with no active session, automatically create a new session. Always start fresh on launch — previous sessions are accessible via `/sessions`.

Acceptance criteria:

- First launch creates a session automatically
- App is immediately usable without any slash commands

---

### E2-08: Context window management

As conversation history grows, it will eventually exceed the model's context window. Implement a strategy to handle this. Recommended approach: truncate oldest messages (keeping the system message if present) when the estimated token count approaches the model's limit. Show a subtle indicator in the UI when messages have been truncated from context.

Acceptance criteria:

- Long conversations don't fail due to context overflow
- Oldest messages are dropped from the request (not from the session file — full history is always persisted)
- User is informed when context truncation is active
- Token estimation is reasonable (doesn't need to be exact — character-based heuristic is fine)
