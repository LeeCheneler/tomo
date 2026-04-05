import { homedir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../chat/message";
import { mockFs } from "../test-utils/mock-fs";
import {
  SESSIONS_DIR,
  appendSessionMessage,
  createSessionPath,
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
