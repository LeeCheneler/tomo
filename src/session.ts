import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { DisplayMessage } from "./components/message-list";

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: DisplayMessage[];
}

interface MetaEntry {
  type: "meta";
  id: string;
  name: string;
  createdAt: string;
  provider: string;
  model: string;
}

interface MessageEntry {
  type: "message";
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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

/** Reads the first line of a file efficiently (up to 4KB). */
function readFirstLine(path: string): string {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(4096);
    const bytesRead = readSync(fd, buf, 0, 4096, 0);
    const content = buf.toString("utf-8", 0, bytesRead);
    const idx = content.indexOf("\n");
    return idx === -1 ? content : content.slice(0, idx);
  } finally {
    closeSync(fd);
  }
}

/** Creates a new empty session in memory. No disk I/O. */
export function createSession(provider: string, model: string): Session {
  return {
    id: crypto.randomUUID(),
    name: "New session",
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
      name: session.name,
      createdAt: session.createdAt,
      provider: session.provider,
      model: session.model,
    };
    writeFileSync(path, `${JSON.stringify(meta)}\n`, "utf-8");
  }

  const entry: MessageEntry = {
    type: "message",
    id: message.id,
    role: message.role,
    content: message.content,
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
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
        messages.push({
          id: entry.id,
          role: entry.role,
          content: entry.content,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  const stat = statSync(path);

  return {
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: stat.mtime.toISOString(),
    provider: meta.provider,
    model: meta.model,
    messages,
  };
}

/** Returns all sessions sorted by most recently updated. Messages are not loaded. */
export function listSessions(): Session[] {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const sessions: Session[] = [];

  for (const file of files) {
    try {
      const path = resolve(dir, file);
      const firstLine = readFirstLine(path);
      const meta = JSON.parse(firstLine) as MetaEntry;
      const stat = statSync(path);

      sessions.push({
        id: meta.id,
        name: meta.name,
        createdAt: meta.createdAt,
        updatedAt: stat.mtime.toISOString(),
        provider: meta.provider,
        model: meta.model,
        messages: [],
      });
    } catch {
      // Skip malformed session files
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Loads the most recently updated session, or null if none exist. */
export function loadMostRecentSession(): Session | null {
  const sessions = listSessions();
  if (sessions.length === 0) return null;
  return loadSession(sessions[0].id);
}
