import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { ChatMessage } from "../chat/message";
import { appendFile, ensureDir, listDir, readFile } from "../utils/fs";

/** Directory where session JSONL files are stored (~/.tomo/sessions/). */
export const SESSIONS_DIR = resolve(homedir(), ".tomo", "sessions");

/** Generates a new session file path with a timestamp and UUID. */
export function createSessionPath(): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const id = crypto.randomUUID();
  return resolve(SESSIONS_DIR, `${now}-${id}.jsonl`);
}

/** Summary of a saved session for display in the session list. */
export interface SessionSummary {
  /** Full path to the session JSONL file. */
  path: string;
  /** When the session was created. */
  date: Date;
  /** First user message in the session, or null if none. */
  firstMessage: string | null;
}

/** Extracts the timestamp from a session filename back to a Date. */
function parseSessionDate(filename: string): Date {
  // Filename format: 2026-04-05T19-45-00-123Z-<uuid>.jsonl
  // Restore colons and dots: 2026-04-05T19:45:00.123Z
  const timestampPart = filename.slice(0, 24);
  const restored = timestampPart.replace(
    /-(\d{2})-(\d{2})-(\d{3})Z/,
    ":$1:$2.$3Z",
  );
  return new Date(restored);
}

/** Reads a session file and returns the content of the first user message. */
function readFirstUserMessage(path: string): string | null {
  const content = readFile(path);
  for (const line of content.split("\n")) {
    if (!line) continue;
    const msg = JSON.parse(line) as ChatMessage;
    if (msg.role === "user") return msg.content;
  }
  return null;
}

/** Lists all saved sessions, newest first. */
export function listSessions(): SessionSummary[] {
  const filenames = listDir(SESSIONS_DIR).filter((f) => f.endsWith(".jsonl"));
  return filenames
    .sort()
    .reverse()
    .map((filename) => {
      const path = resolve(SESSIONS_DIR, filename);
      return {
        path,
        date: parseSessionDate(filename),
        firstMessage: readFirstUserMessage(path),
      };
    });
}

/** Reads all messages from a session JSONL file. */
export function readSessionMessages(sessionPath: string): ChatMessage[] {
  const content = readFile(sessionPath);
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatMessage);
}

/** Appends a chat message as a JSON line to the session file. */
export function appendSessionMessage(
  sessionPath: string,
  message: ChatMessage,
): void {
  ensureDir(dirname(sessionPath));
  appendFile(sessionPath, `${JSON.stringify(message)}\n`);
}
