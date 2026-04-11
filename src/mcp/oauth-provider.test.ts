import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMcpOAuthProvider } from "./oauth-provider";
import { readOAuthState, writeOAuthState } from "./oauth-storage";

const REDIRECT_URI = "http://127.0.0.1:54321/callback";

function makeTokens(overrides: Partial<OAuthTokens> = {}): OAuthTokens {
  return {
    access_token: "at",
    token_type: "Bearer",
    ...overrides,
  };
}

describe("createMcpOAuthProvider", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "tomo-oauth-provider-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("clientMetadata", () => {
    it("returns a tomo-branded metadata document with token_endpoint_auth_method 'none' for public clients", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      const metadata = provider.clientMetadata;
      expect(metadata.client_name).toBe("tomo");
      expect(metadata.redirect_uris).toEqual([REDIRECT_URI]);
      expect(metadata.grant_types).toEqual([
        "authorization_code",
        "refresh_token",
      ]);
      expect(metadata.response_types).toEqual(["code"]);
      expect(metadata.token_endpoint_auth_method).toBe("none");
      expect(metadata.scope).toBeUndefined();
    });

    it("uses client_secret_basic when a clientSecret is configured", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { clientId: "id", clientSecret: "secret" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientMetadata.token_endpoint_auth_method).toBe(
        "client_secret_basic",
      );
    });

    it("forwards the configured scope into clientMetadata", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { scope: "read write" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientMetadata.scope).toBe("read write");
    });
  });

  describe("redirectUrl", () => {
    it("returns the configured redirect URI", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.redirectUrl).toBe(REDIRECT_URI);
    });
  });

  describe("state", () => {
    it("returns a non-empty value so the SDK always embeds state in the auth URL", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.state().length).toBeGreaterThan(0);
    });

    it("returns a fresh value on each call", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.state()).not.toBe(provider.state());
    });
  });

  describe("clientInformation", () => {
    it("returns undefined when no config and no persisted state (SDK triggers DCR)", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientInformation()).toBeUndefined();
    });

    it("returns a synthesised object when config.clientId is set", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { clientId: "pre-registered" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientInformation()).toEqual({
        client_id: "pre-registered",
      });
    });

    it("includes client_secret when configured", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { clientId: "pre", clientSecret: "s3cret" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientInformation()).toEqual({
        client_id: "pre",
        client_secret: "s3cret",
      });
    });

    it("prefers configured clientId over any persisted client information", () => {
      writeOAuthState(dir, "github", {
        clientInformation: { client_id: "persisted" },
      });
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { clientId: "from-config" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientInformation()).toEqual({
        client_id: "from-config",
      });
    });

    it("returns persisted client information when config is empty", () => {
      writeOAuthState(dir, "github", {
        clientInformation: { client_id: "from-dcr" },
      });
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.clientInformation()).toEqual({
        client_id: "from-dcr",
      });
    });
  });

  describe("saveClientInformation", () => {
    it("persists the provided client information to disk", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      const info: OAuthClientInformationFull = {
        client_id: "from-dcr",
        client_secret: "dcr-secret",
        redirect_uris: [REDIRECT_URI],
      };
      provider.saveClientInformation(info);
      expect(readOAuthState(dir, "github").clientInformation).toEqual(info);
    });
  });

  describe("tokens / saveTokens", () => {
    it("returns undefined when no tokens are persisted", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.tokens()).toBeUndefined();
    });

    it("round-trips tokens via saveTokens + tokens()", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      const tokens = makeTokens({ refresh_token: "rt", expires_in: 3600 });
      provider.saveTokens(tokens);
      expect(provider.tokens()).toEqual(tokens);
    });

    it("overwrites previously persisted tokens (refresh rotation)", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.saveTokens(makeTokens({ access_token: "old" }));
      provider.saveTokens(makeTokens({ access_token: "new" }));
      expect(provider.tokens()?.access_token).toBe("new");
    });
  });

  describe("codeVerifier / saveCodeVerifier", () => {
    it("round-trips the PKCE verifier", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.saveCodeVerifier("verifier-value");
      expect(provider.codeVerifier()).toBe("verifier-value");
    });

    it("throws when no verifier is persisted", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(() => provider.codeVerifier()).toThrow(
        /no PKCE code verifier persisted for MCP server 'github'/,
      );
    });
  });

  describe("discoveryState / saveDiscoveryState", () => {
    it("round-trips discovery state", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      const state: OAuthDiscoveryState = {
        authorizationServerUrl: "https://auth.example.com",
      };
      provider.saveDiscoveryState(state);
      expect(provider.discoveryState()).toEqual(state);
    });

    it("returns undefined when no discovery state is persisted", () => {
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      expect(provider.discoveryState()).toBeUndefined();
    });
  });

  describe("redirectToAuthorization", () => {
    it("invokes the onRedirect callback with the authorization URL", async () => {
      const onRedirect = vi.fn();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect,
      });
      const url = new URL("https://auth.example.com/authorize?state=abc");
      await provider.redirectToAuthorization(url);
      expect(onRedirect).toHaveBeenCalledWith(url);
    });

    it("awaits an async onRedirect", async () => {
      let resolved = false;
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: async () => {
          await Promise.resolve();
          resolved = true;
        },
      });
      await provider.redirectToAuthorization(
        new URL("https://auth.example.com/authorize"),
      );
      expect(resolved).toBe(true);
    });
  });

  describe("invalidateCredentials", () => {
    function seedFullState(): void {
      writeOAuthState(dir, "github", {
        clientInformation: { client_id: "dcr-id" },
        tokens: makeTokens(),
        codeVerifier: "v",
        discoveryState: { authorizationServerUrl: "https://auth" },
        redirectPort: 12345,
      });
    }

    it("'all' deletes the state file entirely", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("all");
      expect(readOAuthState(dir, "github")).toEqual({});
    });

    it("'tokens' clears only the tokens field", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("tokens");
      const state = readOAuthState(dir, "github");
      expect(state.tokens).toBeUndefined();
      expect(state.clientInformation).toEqual({ client_id: "dcr-id" });
      expect(state.codeVerifier).toBe("v");
      expect(state.discoveryState).toEqual({
        authorizationServerUrl: "https://auth",
      });
      expect(state.redirectPort).toBe(12345);
    });

    it("'client' clears only the clientInformation field", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("client");
      const state = readOAuthState(dir, "github");
      expect(state.clientInformation).toBeUndefined();
      expect(state.tokens).toEqual(makeTokens());
    });

    it("'client' does not affect pre-registered clientInformation returned by the provider", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        config: { clientId: "pre" },
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("client");
      expect(provider.clientInformation()).toEqual({ client_id: "pre" });
    });

    it("'verifier' clears only the codeVerifier field", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("verifier");
      const state = readOAuthState(dir, "github");
      expect(state.codeVerifier).toBeUndefined();
      expect(state.tokens).toEqual(makeTokens());
    });

    it("'discovery' clears only the discoveryState field", () => {
      seedFullState();
      const provider = createMcpOAuthProvider({
        serverName: "github",
        dataDir: dir,
        redirectUri: REDIRECT_URI,
        onRedirect: vi.fn(),
      });
      provider.invalidateCredentials("discovery");
      const state = readOAuthState(dir, "github");
      expect(state.discoveryState).toBeUndefined();
      expect(state.tokens).toEqual(makeTokens());
    });
  });
});
