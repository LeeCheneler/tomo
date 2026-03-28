# 11. MCP server support

Date: 2026-03-28

## Status

Accepted

## Context

Tomo's built-in tools (read_file, run_command, etc.) cover common development tasks, but users need access to external tools — databases, APIs, cloud services, custom workflows — without modifying tomo's source code. The Model Context Protocol (MCP) is an open standard that defines how AI clients discover and invoke tools from external servers, and a growing ecosystem of MCP servers already exists.

Key constraints:

- Tomo is a terminal-first CLI tool — UX must work within `/settings` interactive menus
- Multiple MCP servers may be configured simultaneously, some local (stdio) and some remote (HTTP)
- Tool naming must not collide with built-in tools or across servers
- Users need fine-grained control: enable/disable individual tools, not just entire servers
- Connection failures should not block the app or other servers

## Decision

### Custom JSON-RPC client over the official SDK

We implemented the MCP protocol directly rather than using `@modelcontextprotocol/sdk`. The protocol is JSON-RPC 2.0 with a small surface area — `initialize`, `tools/list`, and `tools/call` are the only methods needed. A custom implementation avoids a dependency, keeps the bundle small, and gives full control over error handling and transport behaviour.

The client is split into three layers:

- **Transport** (`McpTransport` interface) — handles the wire protocol. `StdioTransport` spawns a child process and communicates via newline-delimited JSON over stdin/stdout. `HttpTransport` sends POST requests and parses SSE responses.
- **Client** (`McpClient`) — manages the MCP lifecycle: initialize handshake, tool discovery, tool invocation. Accepts any `McpTransport` via constructor injection.
- **Manager** (`McpManager`) — starts multiple servers from config, namespaces tool definitions, routes tool calls, and handles graceful shutdown.

### Tool namespacing with double-underscore separator

MCP tools are namespaced as `mcp__<server-name>__<tool-name>` to avoid collisions. The server name comes from the MCP `initialize` handshake (`serverInfo.name`), not user input — this avoids naming issues (spaces, special characters) and removes a manual step from the setup flow. Duplicate server names are auto-suffixed (`server-2`, `server-3`).

The `__` separator was chosen because it's unlikely to appear in tool names naturally, can be used as a JavaScript object key without quoting, and is easy to split programmatically.

### Enable/disable over approval prompts

We initially implemented an `autoApprove` model where MCP tool calls would show a confirmation prompt before executing (similar to file write confirmations). This was replaced with a simpler enable/disable model:

- Servers can be enabled/disabled entirely
- Individual tools are toggled in Tool Availability (disabled by default when a server is first added)
- Only enabled tools are sent in the tool definitions array to the LLM
- Disabled tools are also blocked at execution time as a safety net (the model may call tools it saw in previous turns before they were disabled)

The enable/disable model is simpler to understand, requires fewer interactions per session, and is consistent with how built-in tools already work in `/settings`.

### Independent server startup

`McpManager.startAll()` starts each server independently using `Promise.all` with per-server try/catch. A failing server does not block others. Failed servers are tracked and surfaced as startup warnings. The settings UI shows a warning indicator on failed servers and offers a reconnect shortcut (`r`).

### Server name auto-discovery

When adding a server via `/settings`, tomo connects immediately, performs the MCP initialize handshake, and uses `serverInfo.name` from the response as the config key. This eliminates a manual naming step and ensures the name matches what the server identifies itself as.

### Lazy manager restart on config change

The MCP manager is started at app mount time. On each message submit, the desired server set (from config) is compared against the manager's connected servers. If they differ — a server was added, removed, or failed to connect previously — the manager is shut down and recreated. This handles mid-session config changes from `/settings` without requiring an app restart.

### Resources and notifications deprioritized

MCP defines two additional primitives — resources (`resources/list`, `resources/read`) and server notifications (`notifications/tools/list_changed`). Neither is implemented:

- **Resources**: No major MCP client (Claude Desktop, Cursor, Windsurf, Claude Code) has shipped meaningful resources support as of mid-2025. Most MCP server authors expose data access as tools instead.
- **Notifications**: Restarting tomo is sufficient to pick up tool list changes. The complexity of live notification handling is not justified.

Both can be added later if the ecosystem adoption changes.

## Consequences

- MCP servers are a first-class feature alongside built-in tools, managed through the same `/settings` UI
- No external dependencies added — the protocol implementation is ~500 lines across transport, client, and manager
- Tool namespacing means MCP tool names are longer in the LLM context (`mcp__server__tool` vs `tool`), consuming slightly more tokens
- Environment variable substitution in server config supports secrets without storing them in YAML
- The `tools` config record is shared between built-in and MCP tools — MCP tool entries use namespaced keys and follow the same boolean toggle pattern
- Adding a new transport type (e.g. WebSocket) requires implementing the `McpTransport` interface — no changes to the client or manager
