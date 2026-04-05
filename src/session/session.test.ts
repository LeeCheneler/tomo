import { homedir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../chat/message";
import { mockFs } from "../test-utils/mock-fs";
import {
  SESSIONS_DIR,
  appendSessionMessage,
  createSessionPath,
  listSessions,
  readSessionMessages,
} from "./session";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/mock-home",
}));

describe("SESSIONS_DIR", () => {
  it("resolves to ~/.tomo/sessions", () => {
    expect(SESSIONS_DIR).toBe(resolve(homedir(), ".tomo", "sessions"));
  });
});

describe("createSessionPath", () => {
  // ISO timestamp with colons/dots replaced by dashes, then a UUID, then .jsonl
  const FILENAME_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.jsonl$/;

  it("returns a path inside SESSIONS_DIR matching the expected format", () => {
    const path = createSessionPath();
    const filename = path.slice(SESSIONS_DIR.length + 1);
    expect(path.startsWith(SESSIONS_DIR)).toBe(true);
    expect(filename).toMatch(FILENAME_PATTERN);
  });

  it("generates unique paths on each call", () => {
    const a = createSessionPath();
    const b = createSessionPath();
    expect(a).not.toBe(b);
  });
});

describe("appendSessionMessage", () => {
  let fs: ReturnType<typeof mockFs>;

  afterEach(() => {
    fs.restore();
  });

  it("writes a JSON line to the session file", () => {
    fs = mockFs();
    const sessionPath = resolve(SESSIONS_DIR, "test-session.jsonl");
    const message: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "hello",
    };

    appendSessionMessage(sessionPath, message);

    const content = fs.getFile(sessionPath);
    expect(content).toBe(`${JSON.stringify(message)}\n`);
  });

  it("appends multiple messages as separate lines", () => {
    fs = mockFs();
    const sessionPath = resolve(SESSIONS_DIR, "test-session.jsonl");
    const msg1: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "hello",
    };
    const msg2: ChatMessage = {
      id: "msg-2",
      role: "assistant",
      content: "hi there",
    };

    appendSessionMessage(sessionPath, msg1);
    appendSessionMessage(sessionPath, msg2);

    const content = fs.getFile(sessionPath) ?? "";
    const lines = content.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(msg1);
    expect(JSON.parse(lines[1])).toEqual(msg2);
  });

  it("handles all message types", () => {
    fs = mockFs();
    const sessionPath = resolve(SESSIONS_DIR, "test-session.jsonl");
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "assistant", content: "hi" },
      { id: "3", role: "command", command: "model", result: "switched" },
      { id: "4", role: "error", content: "oops" },
      { id: "5", role: "interrupted" },
    ];

    for (const msg of messages) {
      appendSessionMessage(sessionPath, msg);
    }

    const lines = (fs.getFile(sessionPath) ?? "").trimEnd().split("\n");
    expect(lines).toHaveLength(5);
    for (let i = 0; i < messages.length; i++) {
      expect(JSON.parse(lines[i])).toEqual(messages[i]);
    }
  });
});

describe("listSessions", () => {
  let fs: ReturnType<typeof mockFs>;

  afterEach(() => {
    fs.restore();
  });

  it("returns empty array when no sessions exist", () => {
    fs = mockFs();
    expect(listSessions()).toEqual([]);
  });

  it("returns sessions sorted newest first", () => {
    const older = `${SESSIONS_DIR}/2026-04-01T10-00-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`;
    const newer = `${SESSIONS_DIR}/2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-ffffffffffff.jsonl`;
    fs = mockFs({
      [older]: `${JSON.stringify({ id: "1", role: "user", content: "old" })}\n`,
      [newer]: `${JSON.stringify({ id: "2", role: "user", content: "new" })}\n`,
    });

    const sessions = listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].firstMessage).toBe("new");
    expect(sessions[1].firstMessage).toBe("old");
  });

  it("parses the date from the filename", () => {
    const path = `${SESSIONS_DIR}/2026-04-05T19-45-30-123Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`;
    fs = mockFs({
      [path]: `${JSON.stringify({ id: "1", role: "user", content: "hi" })}\n`,
    });

    const sessions = listSessions();
    expect(sessions[0].date).toEqual(new Date("2026-04-05T19:45:30.123Z"));
  });

  it("extracts the first user message skipping non-user messages", () => {
    const path = `${SESSIONS_DIR}/2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`;
    const lines = [
      JSON.stringify({
        id: "1",
        role: "command",
        command: "new",
        result: "done",
      }),
      JSON.stringify({ id: "2", role: "user", content: "actual first" }),
      JSON.stringify({ id: "3", role: "user", content: "second" }),
    ];
    fs = mockFs({ [path]: `${lines.join("\n")}\n` });

    const sessions = listSessions();
    expect(sessions[0].firstMessage).toBe("actual first");
  });

  it("returns null firstMessage when session has no user messages", () => {
    const path = `${SESSIONS_DIR}/2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`;
    fs = mockFs({
      [path]: `${JSON.stringify({ id: "1", role: "command", command: "new", result: "done" })}\n`,
    });

    const sessions = listSessions();
    expect(sessions[0].firstMessage).toBeNull();
  });

  it("includes the full file path", () => {
    const path = `${SESSIONS_DIR}/2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`;
    fs = mockFs({
      [path]: `${JSON.stringify({ id: "1", role: "user", content: "hi" })}\n`,
    });

    const sessions = listSessions();
    expect(sessions[0].path).toBe(path);
  });

  it("ignores non-jsonl files in the sessions directory", () => {
    fs = mockFs({
      [`${SESSIONS_DIR}/notes.txt`]: "not a session",
      [`${SESSIONS_DIR}/2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl`]: `${JSON.stringify({ id: "1", role: "user", content: "hi" })}\n`,
    });

    const sessions = listSessions();
    expect(sessions).toHaveLength(1);
  });
});

describe("readSessionMessages", () => {
  let fs: ReturnType<typeof mockFs>;

  afterEach(() => {
    fs.restore();
  });

  it("reads all messages from a JSONL file", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "assistant", content: "hi" },
    ];
    const path = resolve(SESSIONS_DIR, "test.jsonl");
    fs = mockFs({
      [path]: `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`,
    });

    const result = readSessionMessages(path);
    expect(result).toEqual(messages);
  });

  it("skips empty lines", () => {
    const path = resolve(SESSIONS_DIR, "test.jsonl");
    const content = `${JSON.stringify({ id: "1", role: "user", content: "hi" })}\n\n`;
    fs = mockFs({ [path]: content });

    const result = readSessionMessages(path);
    expect(result).toHaveLength(1);
  });
});
