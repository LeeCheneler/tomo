import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  type McpOAuthState,
  deleteOAuthState,
  readOAuthState,
  writeOAuthState,
} from "./oauth-storage";

/** Pre-registered OAuth client configuration sourced from the MCP connection config. */
export interface McpOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

/**
 * Tomo's narrowed `OAuthClientProvider`. Every persistence method is
 * synchronous (backed by local JSON files) and every optional hook from the
 * SDK's interface is implemented as required. Callers that need the wider SDK
 * type can simply assign an `McpOAuthProvider` into an `OAuthClientProvider`.
 */
export interface McpOAuthProvider extends OAuthClientProvider {
  get redirectUrl(): string;
  get clientMetadata(): OAuthClientMetadata;
  clientInformation(): OAuthClientInformationMixed | undefined;
  saveClientInformation(info: OAuthClientInformationMixed): void;
  tokens(): OAuthTokens | undefined;
  saveTokens(tokens: OAuthTokens): void;
  redirectToAuthorization(authorizationUrl: URL): Promise<void>;
  saveCodeVerifier(codeVerifier: string): void;
  codeVerifier(): string;
  discoveryState(): OAuthDiscoveryState | undefined;
  saveDiscoveryState(state: OAuthDiscoveryState): void;
  invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): void;
}

/** Construction options for `createMcpOAuthProvider`. */
export interface McpOAuthProviderOptions {
  /** Name of the MCP server — used as the state-file stem. */
  serverName: string;
  /** Directory holding per-server state files (typically `MCP_OAUTH_DIR`). */
  dataDir: string;
  /** Optional pre-registered client configuration. When `clientId` is set, dynamic client registration is skipped. */
  config?: McpOAuthConfig;
  /** Full redirect URI to advertise in `clientMetadata.redirect_uris` (e.g. `http://127.0.0.1:PORT/callback`). */
  redirectUri: string;
  /** Invoked when the SDK is ready to drive the user to the authorization URL. */
  onRedirect: (authorizationUrl: URL) => void | Promise<void>;
}

/**
 * Merges updates into the current state for a server and writes the result back
 * to disk. Returns the new state so callers can chain further reads.
 */
function updateState(
  opts: McpOAuthProviderOptions,
  patch: Partial<McpOAuthState>,
): McpOAuthState {
  const current = readOAuthState(opts.dataDir, opts.serverName);
  const next: McpOAuthState = { ...current, ...patch };
  writeOAuthState(opts.dataDir, opts.serverName, next);
  return next;
}

/** Builds the static `OAuthClientMetadata` document derived from provider options. */
function buildClientMetadata(
  opts: McpOAuthProviderOptions,
): OAuthClientMetadata {
  const metadata: OAuthClientMetadata = {
    client_name: "tomo",
    redirect_uris: [opts.redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: opts.config?.clientSecret
      ? "client_secret_basic"
      : "none",
  };
  if (opts.config?.scope) {
    metadata.scope = opts.config.scope;
  }
  return metadata;
}

/** Returns the pre-registered client information synthesised from config, or undefined when none is configured. */
function preRegisteredClient(
  opts: McpOAuthProviderOptions,
): OAuthClientInformation | undefined {
  if (!opts.config?.clientId) return undefined;
  const info: OAuthClientInformation = { client_id: opts.config.clientId };
  if (opts.config.clientSecret) {
    info.client_secret = opts.config.clientSecret;
  }
  return info;
}

/**
 * Creates a disk-backed `OAuthClientProvider` for a single MCP server.
 *
 * State is persisted under `<dataDir>/<serverName>.json` at mode 0600 so that
 * tokens, client registration, PKCE verifier, discovery cache, and the loopback
 * redirect port survive restarts. Pre-registered clients in `opts.config` take
 * precedence over any persisted client information and cause the SDK to skip
 * dynamic client registration.
 */
export function createMcpOAuthProvider(
  opts: McpOAuthProviderOptions,
): McpOAuthProvider {
  const clientMetadata = buildClientMetadata(opts);

  return {
    get redirectUrl(): string {
      return opts.redirectUri;
    },

    get clientMetadata(): OAuthClientMetadata {
      return clientMetadata;
    },

    clientInformation(): OAuthClientInformationMixed | undefined {
      const preRegistered = preRegisteredClient(opts);
      if (preRegistered) return preRegistered;
      return readOAuthState(opts.dataDir, opts.serverName).clientInformation;
    },

    saveClientInformation(info: OAuthClientInformationMixed): void {
      updateState(opts, { clientInformation: info });
    },

    tokens(): OAuthTokens | undefined {
      return readOAuthState(opts.dataDir, opts.serverName).tokens;
    },

    saveTokens(tokens: OAuthTokens): void {
      updateState(opts, { tokens });
    },

    async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
      await opts.onRedirect(authorizationUrl);
    },

    saveCodeVerifier(codeVerifier: string): void {
      updateState(opts, { codeVerifier });
    },

    codeVerifier(): string {
      const verifier = readOAuthState(
        opts.dataDir,
        opts.serverName,
      ).codeVerifier;
      if (!verifier) {
        throw new Error(
          `no PKCE code verifier persisted for MCP server '${opts.serverName}'`,
        );
      }
      return verifier;
    },

    discoveryState(): OAuthDiscoveryState | undefined {
      return readOAuthState(opts.dataDir, opts.serverName).discoveryState;
    },

    saveDiscoveryState(state: OAuthDiscoveryState): void {
      updateState(opts, { discoveryState: state });
    },

    invalidateCredentials(
      scope: "all" | "client" | "tokens" | "verifier" | "discovery",
    ): void {
      if (scope === "all") {
        deleteOAuthState(opts.dataDir, opts.serverName);
        return;
      }
      const current = readOAuthState(opts.dataDir, opts.serverName);
      const next: McpOAuthState = { ...current };
      if (scope === "client") next.clientInformation = undefined;
      if (scope === "tokens") next.tokens = undefined;
      if (scope === "verifier") next.codeVerifier = undefined;
      if (scope === "discovery") next.discoveryState = undefined;
      writeOAuthState(opts.dataDir, opts.serverName, next);
    },
  };
}
