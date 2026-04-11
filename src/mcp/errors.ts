/**
 * Thrown when an MCP OAuth authorization flow is aborted before it completes.
 *
 * Raised from the HTTP client wrapper when the user cancels the browser-auth
 * prompt, when the chat disconnects mid-flow, or when the loopback wait is
 * aborted by signal. Manager and UI layers can match on this type to print a
 * user-friendly "authorization cancelled" message instead of a generic error.
 */
export class McpAuthCancelledError extends Error {
  constructor(serverName: string) {
    super(`MCP server '${serverName}' authorization cancelled`);
    this.name = "McpAuthCancelledError";
  }
}
