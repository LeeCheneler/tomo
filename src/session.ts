import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { DisplayMessage } from "./components/message-list";
import type { ImageAttachment } from "./images";
import type { ToolCall } from "./provider/client";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: DisplayMessage[];
}

interface MetaEntry {
  type: "meta";
  id: string;
  createdAt: string;
  provider: string;
  model: string;
}

type MessageEntry =
  | {
      type: "message";
      id: string;
      role: "user";
      content: string;
      images?: ImageAttachment[];
    }
  | { type: "message"; id: string; role: "system"; content: string }
  | {
      type: "message";
      id: string;
      role: "assistant";
      content: string;
      tool_calls?: ToolCall[];
    }
  | {
      type: "message";
      id: string;
      role: "tool";
      content: string;
      tool_call_id: string;
    };

let _lastSavedSessionId: string | null = null;

/** Returns the session ID of the last session written to disk, or null. */
export function getLastSavedSessionId(): string | null {
  return _lastSavedSessionId;
}

/** Returns the path to the sessions directory (~/.tomo/sessions/). */
function sessionsDir(): string {
  return resolve(homedir(), ".tomo", "sessions");
}

/** Returns the file path for a session by ID. */
function sessionPath(id: string): string {
  return resolve(sessionsDir(), `${id}.jsonl`);
}

/** Creates the sessions directory if it doesn't exist. */
function ensureSessionsDir(): void {
  const dir = sessionsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Reads the first N lines of a file efficiently (up to 16KB). */
function readHeadLines(path: string, count: number): string[] {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(16384);
    const bytesRead = readSync(fd, buf, 0, 16384, 0);
    const content = buf.toString("utf-8", 0, bytesRead);
    return content.split("\n").slice(0, count);
  } finally {
    closeSync(fd);
  }
}

/** Creates a new empty session in memory. No disk I/O. */
export function createSession(provider: string, model: string): Session {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider,
    model,
    messages: [],
  };
}

/** Appends a message to the session's JSONL file. Creates the file with a meta line if needed. */
export function appendMessage(session: Session, message: DisplayMessage): void {
  ensureSessionsDir();

  const path = sessionPath(session.id);
  if (!existsSync(path)) {
    const meta: MetaEntry = {
      type: "meta",
      id: session.id,
      createdAt: session.createdAt,
      provider: session.provider,
      model: session.model,
    };
    writeFileSync(path, `${JSON.stringify(meta)}\n`, "utf-8");
  }

  const entry: MessageEntry = { type: "message", ...message } as MessageEntry;
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
  _lastSavedSessionId = session.id;
}

/** Loads a session by ID. Returns null if not found. */
export function loadSession(id: string): Session | null {
  const path = sessionPath(id);
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  const meta = JSON.parse(lines[0]) as MetaEntry;
  const messages: DisplayMessage[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i]) as MessageEntry;
      if (entry.type === "message") {
        const { type: _, ...msg } = entry;
        messages.push(msg as DisplayMessage);
      }
    } catch {
      // Skip malformed lines
    }
  }

  const stat = statSync(path);

  return {
    id: meta.id,
    createdAt: meta.createdAt,
    updatedAt: stat.mtime.toISOString(),
    provider: meta.provider,
    model: meta.model,
    messages,
  };
}

/** Returns all sessions sorted by most recently updated, with first message for preview. */
export function listSessions(limit = 50): Session[] {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const sessions: Session[] = [];

  for (const file of files) {
    try {
      const path = resolve(dir, file);
      const lines = readHeadLines(path, 2);
      const meta = JSON.parse(lines[0]) as MetaEntry;
      const stat = statSync(path);

      const messages: DisplayMessage[] = [];
      if (lines[1]) {
        try {
          const entry = JSON.parse(lines[1]) as MessageEntry;
          if (entry.type === "message") {
            const { type: _, ...msg } = entry;
            messages.push(msg as DisplayMessage);
          }
        } catch {
          // First message line malformed or truncated
        }
      }

      sessions.push({
        id: meta.id,
        createdAt: meta.createdAt,
        updatedAt: stat.mtime.toISOString(),
        provider: meta.provider,
        model: meta.model,
        messages,
      });
    } catch {
      // Skip malformed session files
    }
  }

  return sessions
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

/** Loads the most recently updated session, or null if none exist. */
export function loadMostRecentSession(): Session | null {
  const sessions = listSessions();
  if (sessions.length === 0) return null;
  return loadSession(sessions[0].id);
}
