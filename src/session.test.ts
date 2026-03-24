import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendMessage,
  createSession,
  listSessions,
  loadMostRecentSession,
  loadSession,
} from "./session";

const tmpDir = resolve(import.meta.dirname, "../.test-session-tmp");

vi.mock("node:os", () => ({
  homedir: () => tmpDir,
}));

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("createSession", () => {
  it("creates a session with correct defaults", () => {
    const session = createSession("ollama", "qwen3:8b");
    expect(session.id).toBeDefined();
    expect(session.provider).toBe("ollama");
    expect(session.model).toBe("qwen3:8b");
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeDefined();
    expect(session.updatedAt).toBeDefined();
  });

  it("generates unique IDs", () => {
    const s1 = createSession("ollama", "qwen3:8b");
    const s2 = createSession("ollama", "qwen3:8b");
    expect(s1.id).not.toBe(s2.id);
  });
});

describe("appendMessage / loadSession", () => {
  it("round-trips messages through JSONL", () => {
    const session = createSession("ollama", "qwen3:8b");
    const msg1 = { id: "msg-1", role: "user" as const, content: "hello" };
    const msg2 = {
      id: "msg-2",
      role: "assistant" as const,
      content: "hi there",
    };

    appendMessage(session, msg1);
    appendMessage(session, msg2);

    const loaded = loadSession(session.id);
    expect(loaded?.id).toBe(session.id);
    expect(loaded?.provider).toBe("ollama");
    expect(loaded?.model).toBe("qwen3:8b");
    expect(loaded?.messages).toEqual([msg1, msg2]);
  });

  it("returns null for non-existent session", () => {
    expect(loadSession("nonexistent")).toBeNull();
  });

  it("creates the sessions directory and file on first append", () => {
    const session = createSession("ollama", "qwen3:8b");
    const msg = { id: "msg-1", role: "user" as const, content: "hello" };

    appendMessage(session, msg);

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toEqual([msg]);
  });

  it("appends incrementally without rewriting earlier messages", () => {
    const session = createSession("ollama", "qwen3:8b");

    appendMessage(session, {
      id: "msg-1",
      role: "user",
      content: "first",
    });
    appendMessage(session, {
      id: "msg-2",
      role: "assistant",
      content: "second",
    });
    appendMessage(session, {
      id: "msg-3",
      role: "user",
      content: "third",
    });

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toHaveLength(3);
    expect(loaded?.messages[0].content).toBe("first");
    expect(loaded?.messages[2].content).toBe("third");
  });

  it("round-trips user messages with images", () => {
    const session = createSession("ollama", "qwen3:8b");
    const msg = {
      id: "msg-1",
      role: "user" as const,
      content: "what is this?",
      images: [
        {
          name: "photo.png",
          dataUri: "data:image/png;base64,iVBORw0KGgo=",
        },
      ],
    };

    appendMessage(session, msg);

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toEqual([msg]);
  });

  it("round-trips assistant messages with tool_calls", () => {
    const session = createSession("ollama", "qwen3:8b");
    const msg = {
      id: "msg-1",
      role: "assistant" as const,
      content: "",
      tool_calls: [
        {
          id: "call-1",
          function: {
            name: "ask",
            arguments: '{"question":"pick one","options":["a","b"]}',
          },
        },
      ],
    };

    appendMessage(session, msg);

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toEqual([msg]);
  });

  it("round-trips tool result messages", () => {
    const session = createSession("ollama", "qwen3:8b");
    const msg = {
      id: "msg-1",
      role: "tool" as const,
      content: "a",
      tool_call_id: "call-1",
    };

    appendMessage(session, msg);

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toEqual([msg]);
  });

  it("preserves session metadata across appends", () => {
    const session = createSession("ollama", "qwen3:8b");

    appendMessage(session, {
      id: "msg-1",
      role: "user",
      content: "hello",
    });

    const loaded = loadSession(session.id);
    expect(loaded?.createdAt).toBe(session.createdAt);
    expect(loaded?.provider).toBe(session.provider);
    expect(loaded?.model).toBe(session.model);
  });
});

describe("listSessions", () => {
  it("returns empty array when no sessions exist", () => {
    expect(listSessions()).toEqual([]);
  });

  it("returns sessions sorted by most recently updated", () => {
    const s1 = createSession("ollama", "qwen3:8b");
    appendMessage(s1, { id: "m1", role: "user", content: "old" });

    const s2 = createSession("ollama", "qwen3:8b");
    appendMessage(s2, { id: "m2", role: "user", content: "new" });

    // Set explicit mtimes so ordering is deterministic
    const sessDir = resolve(tmpDir, ".tomo", "sessions");
    const older = new Date("2026-03-20T10:00:00Z");
    const newer = new Date("2026-03-20T12:00:00Z");
    utimesSync(resolve(sessDir, `${s1.id}.jsonl`), older, older);
    utimesSync(resolve(sessDir, `${s2.id}.jsonl`), newer, newer);

    const sessions = listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe(s2.id);
    expect(sessions[1].id).toBe(s1.id);
  });

  it("includes first message for preview", () => {
    const session = createSession("ollama", "qwen3:8b");
    appendMessage(session, { id: "m1", role: "user", content: "hello" });
    appendMessage(session, {
      id: "m2",
      role: "assistant",
      content: "hi there",
    });

    const sessions = listSessions();
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe("hello");
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      const s = createSession("ollama", "qwen3:8b");
      appendMessage(s, { id: `m${i}`, role: "user", content: `msg ${i}` });
    }

    const sessions = listSessions(3);
    expect(sessions).toHaveLength(3);
  });

  it("skips malformed files", () => {
    const dir = resolve(tmpDir, ".tomo", "sessions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "bad.jsonl"), "not json\n", "utf-8");

    const session = createSession("ollama", "qwen3:8b");
    appendMessage(session, { id: "m1", role: "user", content: "hello" });

    const sessions = listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(session.id);
  });
});

describe("loadMostRecentSession", () => {
  it("returns null when no sessions exist", () => {
    expect(loadMostRecentSession()).toBeNull();
  });

  it("returns the most recently updated session with messages", () => {
    const s1 = createSession("ollama", "qwen3:8b");
    appendMessage(s1, { id: "m1", role: "user", content: "old" });

    const s2 = createSession("ollama", "qwen3:8b");
    appendMessage(s2, { id: "m2", role: "user", content: "new" });

    // Set explicit mtimes so ordering is deterministic
    const sessDir = resolve(tmpDir, ".tomo", "sessions");
    const older = new Date("2026-03-20T10:00:00Z");
    const newer = new Date("2026-03-20T12:00:00Z");
    utimesSync(resolve(sessDir, `${s1.id}.jsonl`), older, older);
    utimesSync(resolve(sessDir, `${s2.id}.jsonl`), newer, newer);

    const most = loadMostRecentSession();
    expect(most?.id).toBe(s2.id);
    expect(most?.messages).toHaveLength(1);
    expect(most?.messages[0].content).toBe("new");
  });
});
