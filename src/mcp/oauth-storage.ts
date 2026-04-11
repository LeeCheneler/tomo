import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { z } from "zod";

/** Schema for a persisted OAuth token response. Loose so unknown fields from future SDK versions survive a round-trip. */
const oauthTokensSchema = z.looseObject({
  access_token: z.string(),
  token_type: z.string(),
  id_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
});

/** Schema for persisted OAuth client information. Loose to keep unknown registration response fields. */
const oauthClientInformationSchema = z.looseObject({
  client_id: z.string(),
  client_secret: z.string().optional(),
  client_id_issued_at: z.number().optional(),
  client_secret_expires_at: z.number().optional(),
});

/** Schema for persisted OAuth discovery state. Loose — the nested metadata blobs come from the SDK and are treated opaquely. */
const oauthDiscoveryStateSchema = z.looseObject({
  authorizationServerUrl: z.string(),
});

/** Schema for the full on-disk state file for one MCP server. */
const mcpOAuthStateSchema = z.object({
  clientInformation: oauthClientInformationSchema.optional(),
  tokens: oauthTokensSchema.optional(),
  codeVerifier: z.string().optional(),
  discoveryState: oauthDiscoveryStateSchema.optional(),
  redirectPort: z.number().int().min(1).max(65535).optional(),
});

/** On-disk OAuth state for a single MCP server. */
export interface McpOAuthState {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  discoveryState?: OAuthDiscoveryState;
  redirectPort?: number;
}

/**
 * Converts an arbitrary MCP server name into a filesystem-safe stem so it
 * can be used as a filename. Any character outside `[a-zA-Z0-9._-]` is
 * replaced with `_` — this covers URL separators (`/`, `:`), whitespace,
 * and everything else that would break a single-segment file path. Two
 * server names that differ only in unsafe characters can collide, which
 * is an acceptable trade-off for keeping the filenames human-readable.
 */
function toSafeFileName(serverName: string): string {
  return serverName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Returns the absolute path of the state file for the given server. */
function stateFilePath(dir: string, serverName: string): string {
  return resolve(dir, `${toSafeFileName(serverName)}.json`);
}

/** Reads persisted OAuth state for a server. Returns an empty state for a missing, unreadable, or malformed file. */
export function readOAuthState(dir: string, serverName: string): McpOAuthState {
  const path = stateFilePath(dir, serverName);
  if (!existsSync(path)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
  const result = mcpOAuthStateSchema.safeParse(raw);
  return result.success ? result.data : {};
}

/**
 * Atomically writes OAuth state to disk. The parent directory is created with
 * mode 0700 if missing and the state file is always written with mode 0600.
 * Uses a temp-file + rename so a crash mid-write cannot leave a partial file.
 */
export function writeOAuthState(
  dir: string,
  serverName: string,
  state: McpOAuthState,
): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = stateFilePath(dir, serverName);
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  chmodSync(tmpPath, 0o600);
  renameSync(tmpPath, path);
}

/** Deletes the state file for a server. No-op if the file does not exist. */
export function deleteOAuthState(dir: string, serverName: string): void {
  const path = stateFilePath(dir, serverName);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
