import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { ChatMessage } from "../chat/message";
import { appendFile, ensureDir } from "../utils/fs";

/** Directory where session JSONL files are stored (~/.tomo/sessions/). */
export const SESSIONS_DIR = resolve(homedir(), ".tomo", "sessions");

/** Generates a new session file path with a timestamp and UUID. */
export function createSessionPath(): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const id = crypto.randomUUID();
  return resolve(SESSIONS_DIR, `${now}-${id}.jsonl`);
}

/** Appends a chat message as a JSON line to the session file. */
export function appendSessionMessage(
  sessionPath: string,
  message: ChatMessage,
): void {
  ensureDir(dirname(sessionPath));
  appendFile(sessionPath, `${JSON.stringify(message)}\n`);
}
