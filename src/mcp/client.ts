import { Client } from "@modelcontextprotocol/sdk/client";
// `.js` extensions are required for these subpath imports because the SDK's
// package.json `exports` map uses a literal `./*` → `./dist/esm/*` rule.
// esbuild's resolver will not resolve them without the explicit extension.
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { z } from "zod";
import { MCP_OAUTH_DIR } from "../config/file";
import type { McpConnection } from "../config/schema";
import { openUrl } from "../utils/open-url";
import { withAuthRetry } from "./auth-retry";
import { createHttpAuthFlow } from "./http-auth-flow";
import type { McpAuthStore } from "./mcp-auth-store";
import { createLoopbackCatcher } from "./oauth-loopback";
import { type McpOAuthConfig, createMcpOAuthProvider } from "./oauth-provider";
import { readOAuthState, writeOAuthState } from "./oauth-storage";

/** A discovered tool exposed by an MCP server. */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Result returned by a tool call to an MCP server. */
export interface McpCallResult {
  /** Concatenated text content from the result, or an error message. */
  text: string;
  /** Whether the server flagged the result as an error. */
  isError: boolean;
}

/** Unified MCP client wrapper around the official SDK transports. */
export interface McpClient {
  /** Connects to the server and performs the initialize handshake. */
  connect: () => Promise<void>;
  /** Lists tools exposed by the server. Connect first. */
  listTools: () => Promise<McpToolDefinition[]>;
  /** Calls a tool by name with the given arguments. Connect first. */
  callTool: (
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<McpCallResult>;
  /** Closes the underlying transport and any auxiliary resources. */
  disconnect: () => Promise<void>;
}

/** Schema for the minimum shape we read from each MCP content block. */
const contentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

/** Schema for the standard MCP CallTool result we depend on. */
const callToolResultSchema = z.object({
  content: z.array(z.unknown()).default([]),
  isError: z.boolean().optional(),
});

/** Concatenates the text blocks of an MCP CallTool result into a single string. */
export function flattenContent(content: readonly unknown[]): string {
  return content
    .map((raw) => {
      const parsed = contentBlockSchema.safeParse(raw);
      if (!parsed.success) return "";
      if (parsed.data.type === "text" && parsed.data.text !== undefined) {
        return parsed.data.text;
      }
      return `[${parsed.data.type} content]`;
    })
    .join("\n");
}

/** Identity retry wrapper — invokes the operation directly with no auth handling. */
const directInvoke = <T>(op: () => Promise<T>): Promise<T> => op();

/**
 * Builds a UI-aware `onRedirect` that pushes an entry onto an auth store
 * and races the loopback catcher against the store's pending promise, so
 * Esc cancels and loopback wins both settle the retry wrapper cleanly.
 * Extracted from `createHttpMcpClient` so the race + dismiss cleanup is
 * unit-testable with fake dependencies.
 */
export function buildUiAwareOnRedirect(
  flow: Pick<import("./http-auth-flow").HttpAuthFlow, "beginFlow">,
  catcher: Pick<import("./oauth-loopback").LoopbackCatcher, "waitForCode">,
  authUi: McpAuthStore,
  serverName: string,
): (authorizationUrl: URL) => Promise<void> {
  return async (authorizationUrl) => {
    const expectedState = authorizationUrl.searchParams.get("state") ?? "";
    const abort = new AbortController();
    const loopbackCode = catcher.waitForCode({
      expectedState,
      signal: abort.signal,
    });
    const uiHandle = authUi.push({
      serverName,
      authUrl: authorizationUrl.toString(),
    });

    // Race the loopback code against a user-pasted code from the modal.
    // Whichever settles first drives the flow; the loser is discarded.
    const raced = Promise.race([loopbackCode, uiHandle.pending]);

    // Whenever the race settles, remove the modal entry. Errors swallowed
    // here — the `raced` promise itself is what withAuthRetry awaits.
    void raced.then(
      () => authUi.dismiss(uiHandle.id),
      () => authUi.dismiss(uiHandle.id),
    );

    flow.beginFlow(abort, raced);
    await openUrl(authorizationUrl.toString());
  };
}

/**
 * Wraps an SDK transport in an `McpClient`, handling the protocol-layer calls
 * (`listTools`, `callTool`, `disconnect`). The optional `retry` parameter lets
 * the HTTP variant interpose OAuth-aware retries around every operation while
 * the stdio variant uses the default identity wrapper.
 */
function wrapTransport(
  transport: Transport,
  retry: <T>(op: () => Promise<T>) => Promise<T> = directInvoke,
): McpClient {
  const client = new Client(
    { name: "tomo", version: "0.0.0" },
    { capabilities: {} },
  );

  return {
    async connect() {
      await retry(() => client.connect(transport));
    },

    async listTools() {
      const result = await retry(() => client.listTools());
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },

    async callTool(name, args, signal) {
      return retry(async () => {
        const raw = await client.callTool(
          { name, arguments: args },
          undefined,
          signal ? { signal } : undefined,
        );
        // The non-task call shape always has `content`. The task-based shape
        // (`toolResult`) is unused here, so the content branch always holds.
        const parsed = callToolResultSchema.parse(raw);
        return {
          text: flattenContent(parsed.content),
          isError: parsed.isError === true,
        };
      });
    },

    async disconnect() {
      await transport.close();
    },
  };
}

/** Creates a stdio MCP client for the given connection config. */
export function createStdioMcpClient(connection: {
  command: string;
  args: readonly string[];
  env?: Record<string, string>;
}): McpClient {
  const transport = new StdioClientTransport({
    command: connection.command,
    args: [...connection.args],
    env: connection.env,
    // Capture stderr instead of letting it print over the Ink UI / test output.
    // We don't currently surface it anywhere — phase 3+ can pipe it to the chat log.
    stderr: "pipe",
  });
  return wrapTransport(transport);
}

/** Construction options for `createHttpMcpClient`. */
export interface CreateHttpMcpClientOptions {
  /** Server name — used as the state-file stem for persisted OAuth credentials. */
  serverName: string;
  /** URL of the MCP server. */
  url: string;
  /** Static headers (e.g. API-key auth). Coexists with OAuth. */
  headers?: Record<string, string>;
  /** Optional pre-registered OAuth client configuration. */
  auth?: McpOAuthConfig;
  /** Overrides the default OAuth state directory. Tests use this to write under a tmp dir. */
  authDataDir?: string;
  /**
   * When provided, the OAuth flow pushes an entry onto this store so the
   * chat UI can render an auth-in-progress modal and surface cancellation.
   */
  authUi?: McpAuthStore;
}

/**
 * Creates a streamable-HTTP MCP client for the given connection config.
 *
 * Eagerly binds a loopback HTTP server so the registered redirect URI is
 * stable from the first SDK read of `clientMetadata.redirect_uris`. If a
 * previous run persisted a bound port in the server's OAuth state file, the
 * loopback reuses it so a DCR-registered redirect URI keeps working across
 * restarts; otherwise an ephemeral port is bound and persisted for next time.
 *
 * The returned client wraps every SDK operation (`connect`, `listTools`,
 * `callTool`) with `withAuthRetry`, so a `401` that triggers the SDK's
 * `redirectToAuthorization` flow is caught transparently: our provider's
 * `onRedirect` opens the user's browser and registers a promise for the
 * authorization code, the wrapper awaits it, exchanges it via
 * `transport.finishAuth`, and retries the original operation.
 */
export async function createHttpMcpClient(
  options: CreateHttpMcpClientOptions,
): Promise<McpClient> {
  const dataDir = options.authDataDir ?? MCP_OAUTH_DIR;

  // Reuse the bound port across restarts when one has been persisted so the
  // DCR-registered redirect URI stays valid.
  const persisted = readOAuthState(dataDir, options.serverName);
  const catcher = await createLoopbackCatcher({ port: persisted.redirectPort });
  if (persisted.redirectPort !== catcher.port) {
    writeOAuthState(dataDir, options.serverName, {
      ...persisted,
      redirectPort: catcher.port,
    });
  }

  // Mutable live transport+client — both get replaced when an initial
  // connect triggers OAuth. The SDK's `StreamableHTTPClientTransport.start`
  // and `Client.connect` both refuse to run a second time on the same
  // instance, so retrying after `finishAuth` requires a fresh pair.
  let liveTransport: StreamableHTTPClientTransport | null = null;
  let liveClient: Client | null = null;

  /* v8 ignore start -- finishAuth closure is reached only on a real SDK-driven 401, covered end-to-end in M7 */
  const authFlow = createHttpAuthFlow({
    catcher,
    openUrl,
    finishAuth: async (code) => {
      if (!liveTransport) throw new Error("no transport to finish auth on");
      await liveTransport.finishAuth(code);
    },
  });
  /* v8 ignore stop */

  const provider = createMcpOAuthProvider({
    serverName: options.serverName,
    dataDir,
    config: options.auth,
    redirectUri: catcher.redirectUri,
    // When there is no UI store the flow is loopback-only. When one is
    // provided, we instead push a modal entry and race the loopback code
    // against the UI's pending promise so Esc-to-cancel and loopback-win
    // both settle the retry wrapper.
    onRedirect: options.authUi
      ? buildUiAwareOnRedirect(
          authFlow,
          catcher,
          options.authUi,
          options.serverName,
        )
      : authFlow.onRedirect,
  });

  /** Builds a fresh transport+client pair wired to the shared provider. */
  const buildPair = () => {
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      authProvider: provider,
      requestInit: options.headers ? { headers: options.headers } : {},
    });
    const client = new Client(
      { name: "tomo", version: "0.0.0" },
      { capabilities: {} },
    );
    return { transport, client };
  };

  return {
    async connect() {
      // First attempt on a fresh pair. If the server is already authorised
      // (tokens cached from a previous run), this succeeds directly.
      const first = buildPair();
      liveTransport = first.transport;
      try {
        await first.client.connect(first.transport);
        liveClient = first.client;
        return;
      } catch (error) {
        /* v8 ignore start -- reauth flow is covered end-to-end in M7 */
        if (!(error instanceof UnauthorizedError)) throw error;
        const pending = authFlow.retryContext.pendingCode();
        if (!pending) throw error;

        const code = await pending;
        authFlow.retryContext.clearPending();
        // Exchange on the transport that actually received the 401 — it
        // holds the discovery state needed for the token exchange.
        await first.transport.finishAuth(code);
        // finishAuth has saved tokens in the provider; a new pair will read
        // them via provider.tokens() on its next request.
        await first.transport.close();

        const second = buildPair();
        liveTransport = second.transport;
        await second.client.connect(second.transport);
        liveClient = second.client;
        /* v8 ignore stop */
      }
    },

    async listTools() {
      if (!liveClient) throw new Error("not connected");
      const c = liveClient;
      const result = await withAuthRetry(authFlow.retryContext, () =>
        c.listTools(),
      );
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },

    async callTool(name, args, signal) {
      if (!liveClient) throw new Error("not connected");
      const c = liveClient;
      return withAuthRetry(authFlow.retryContext, async () => {
        const raw = await c.callTool(
          { name, arguments: args },
          undefined,
          signal ? { signal } : undefined,
        );
        const parsed = callToolResultSchema.parse(raw);
        return {
          text: flattenContent(parsed.content),
          isError: parsed.isError === true,
        };
      });
    },

    async disconnect() {
      authFlow.abortIfActive();
      if (liveTransport) {
        await liveTransport.close();
      }
      liveTransport = null;
      liveClient = null;
      await catcher.close();
    },
  };
}

/** Optional overrides threaded into the underlying client factories. */
export interface McpClientContext {
  /** Overrides the default OAuth state directory. */
  authDataDir?: string;
  /** Auth store used to render an in-progress modal for HTTP connections. */
  authUi?: McpAuthStore;
}

/** Builds an MCP client from a connection config, dispatching on transport type. */
export async function createMcpClient(
  name: string,
  connection: McpConnection,
  context: McpClientContext = {},
): Promise<McpClient> {
  if (connection.transport === "stdio") {
    return createStdioMcpClient({
      command: connection.command,
      args: connection.args,
      env: connection.env,
    });
  }
  return createHttpMcpClient({
    serverName: name,
    url: connection.url,
    headers: connection.headers,
    auth: connection.auth,
    authDataDir: context.authDataDir,
    authUi: context.authUi,
  });
}
