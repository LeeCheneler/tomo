import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type McpOAuthState,
  deleteOAuthState,
  readOAuthState,
  writeOAuthState,
} from "./oauth-storage";

describe("oauth-storage", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "tomo-oauth-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("readOAuthState", () => {
    it("returns an empty state when the file is missing", () => {
      expect(readOAuthState(dir, "github")).toEqual({});
    });

    it("returns an empty state when the file is malformed JSON", () => {
      writeFileSync(resolve(dir, "github.json"), "not json");
      expect(readOAuthState(dir, "github")).toEqual({});
    });

    it("returns an empty state when JSON does not match the schema", () => {
      writeFileSync(
        resolve(dir, "github.json"),
        JSON.stringify({ tokens: { access_token: 123 } }),
      );
      expect(readOAuthState(dir, "github")).toEqual({});
    });

    it("round-trips a full state", () => {
      const state: McpOAuthState = {
        clientInformation: { client_id: "abc", client_secret: "s" },
        tokens: {
          access_token: "at",
          token_type: "Bearer",
          refresh_token: "rt",
          expires_in: 3600,
          scope: "read write",
        },
        codeVerifier: "verifier-value",
        discoveryState: {
          authorizationServerUrl: "https://auth.example.com",
        },
        redirectPort: 54321,
      };
      writeOAuthState(dir, "github", state);
      expect(readOAuthState(dir, "github")).toEqual(state);
    });

    it("round-trips a server name that contains URL separators", () => {
      // Regression: a user configured the MCP connection with the full
      // server URL as its key (e.g. "https://mcp.atlassian.com/v1/mcp").
      // Slashes and colons must not produce a nested path whose parent
      // directories do not exist.
      const urlishName = "https://mcp.atlassian.com/v1/mcp";
      writeOAuthState(dir, urlishName, { codeVerifier: "v" });
      expect(readOAuthState(dir, urlishName).codeVerifier).toBe("v");
    });

    it("preserves unknown fields on nested SDK objects via loose parsing", () => {
      const raw = {
        tokens: {
          access_token: "at",
          token_type: "Bearer",
          unknown_field: "kept",
        },
      };
      writeFileSync(resolve(dir, "github.json"), JSON.stringify(raw));
      const state = readOAuthState(dir, "github");
      expect(state.tokens).toMatchObject({
        access_token: "at",
        token_type: "Bearer",
        unknown_field: "kept",
      });
    });
  });

  describe("writeOAuthState", () => {
    it("creates the parent directory if missing", () => {
      const nested = resolve(dir, "nested");
      writeOAuthState(nested, "github", { codeVerifier: "v" });
      expect(readOAuthState(nested, "github").codeVerifier).toBe("v");
    });

    it("writes the state file with mode 0600", () => {
      writeOAuthState(dir, "github", { codeVerifier: "v" });
      const mode = statSync(resolve(dir, "github.json")).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("creates the parent directory with mode 0700", () => {
      const nested = resolve(dir, "nested");
      writeOAuthState(nested, "github", { codeVerifier: "v" });
      const mode = statSync(nested).mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it("overwrites existing state atomically", () => {
      writeOAuthState(dir, "github", { codeVerifier: "v1" });
      writeOAuthState(dir, "github", { codeVerifier: "v2" });
      expect(readOAuthState(dir, "github").codeVerifier).toBe("v2");
    });

    it("writes formatted JSON", () => {
      writeOAuthState(dir, "github", { codeVerifier: "v" });
      const contents = readFileSync(resolve(dir, "github.json"), "utf-8");
      expect(contents).toContain("\n");
    });

    it("overwrites a stale tmp file left from a prior crash", () => {
      writeFileSync(resolve(dir, "github.json.tmp"), "garbage");
      writeOAuthState(dir, "github", { codeVerifier: "v" });
      expect(readOAuthState(dir, "github").codeVerifier).toBe("v");
    });
  });

  describe("deleteOAuthState", () => {
    it("deletes an existing state file", () => {
      writeOAuthState(dir, "github", { codeVerifier: "v" });
      deleteOAuthState(dir, "github");
      expect(readOAuthState(dir, "github")).toEqual({});
    });

    it("is a no-op for a missing file", () => {
      expect(() => deleteOAuthState(dir, "missing")).not.toThrow();
    });
  });
});
