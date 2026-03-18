# Epic 4 — Tool System

Build the generic tool infrastructure: registry, provider integration, conversation loop, and UI rendering. This epic contains no specific tools — it provides the foundation that Epics 5 and 6 build on.

## Tickets

### E4-01: Tool registry and dispatch system

Build the tool registry — a central map of tool name → tool definition (OpenAI function schema) + handler function. Build the dispatcher that matches a tool call from the model response to the correct handler and invokes it.

Acceptance criteria:

- Tools can be registered with a name, JSON schema, and async handler
- Dispatcher correctly routes tool calls to handlers
- Unknown tool names are handled with a clear error fed back to the model
- Unit tests cover registration, dispatch, and unknown tool handling

---

### E4-02: Extend provider client for tool calling

Update the provider client to include the `tools` array from the registry in requests. Detect `tool_calls` in the streamed response (note: tool calls may not be streamed token-by-token — handle both streamed and non-streamed tool call responses). Return tool calls to the caller for dispatch.

Acceptance criteria:

- Tools array is included in provider requests when tools are registered
- Tool calls in the response are detected and parsed correctly
- `tool_call_id`, function name, and arguments are extracted
- No tools registered = no `tools` key sent (avoid confusing models that don't support tools)

---

### E4-03: Tool call conversation loop

Implement the full tool-calling loop: model responds with a tool call → dispatch to handler → append assistant tool_call message and tool result message to history → re-send to provider → model synthesises final response. Handle multiple sequential tool calls in a single turn.

Acceptance criteria:

- Single tool call round-trips work end to end
- Multiple sequential tool calls in one turn are handled
- Conversation history correctly includes tool call and result messages
- Model receives tool results and produces a final response
- Session persistence includes tool call messages

---

### E4-04: Tool call UI rendering

Display tool invocations in the chat output. Show the tool name and parameters when a tool is called. Show the result (collapsed or summarised) when it returns. Visually distinguish tool activity from normal conversation.

Acceptance criteria:

- Tool call is visible in the UI with name and parameters
- Tool result is shown (collapsible or truncated for long results)
- Tool activity is visually distinct from user/assistant messages
- Streaming continues to work correctly around tool calls
