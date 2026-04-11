import { describe, expect, it, vi } from "vitest";
import { McpAuthCancelledError } from "./errors";
import { createMcpAuthStore } from "./mcp-auth-store";

describe("createMcpAuthStore", () => {
  describe("push + peek", () => {
    it("peek returns null when empty", () => {
      const store = createMcpAuthStore();
      expect(store.peek()).toBeNull();
      expect(store.size()).toBe(0);
    });

    it("push returns an id and a pending promise, and the entry is visible via peek", () => {
      const store = createMcpAuthStore();
      const handle = store.push({
        serverName: "github",
        authUrl: "https://auth.example.com/authorize?state=abc",
      });
      expect(handle.id).toBeTruthy();
      expect(handle.pending).toBeInstanceOf(Promise);
      expect(store.size()).toBe(1);
      const front = store.peek();
      expect(front?.id).toBe(handle.id);
      expect(front?.serverName).toBe("github");
      expect(front?.authUrl).toBe(
        "https://auth.example.com/authorize?state=abc",
      );
    });

    it("peek returns a stable reference for the same front entry", () => {
      const store = createMcpAuthStore();
      store.push({ serverName: "a", authUrl: "u" });
      const first = store.peek();
      const second = store.peek();
      expect(first).toBe(second);
    });

    it("peek always returns the front entry (FIFO)", () => {
      const store = createMcpAuthStore();
      const first = store.push({ serverName: "a", authUrl: "u1" });
      store.push({ serverName: "b", authUrl: "u2" });
      expect(store.peek()?.id).toBe(first.id);
    });
  });

  describe("resolveWithCode", () => {
    it("resolves the pending promise and removes the entry", async () => {
      const store = createMcpAuthStore();
      const handle = store.push({ serverName: "x", authUrl: "u" });
      store.resolveWithCode(handle.id, "the-code");
      await expect(handle.pending).resolves.toBe("the-code");
      expect(store.peek()).toBeNull();
    });

    it("is a no-op for an unknown id", () => {
      const store = createMcpAuthStore();
      expect(() => store.resolveWithCode("missing", "code")).not.toThrow();
    });
  });

  describe("cancel", () => {
    it("rejects the pending promise with McpAuthCancelledError and removes the entry", async () => {
      const store = createMcpAuthStore();
      const handle = store.push({ serverName: "github", authUrl: "u" });
      store.cancel(handle.id);
      await expect(handle.pending).rejects.toBeInstanceOf(
        McpAuthCancelledError,
      );
      await expect(handle.pending).rejects.toThrow(
        /MCP server 'github' authorization cancelled/,
      );
      expect(store.peek()).toBeNull();
    });

    it("is a no-op for an unknown id", () => {
      const store = createMcpAuthStore();
      expect(() => store.cancel("missing")).not.toThrow();
    });
  });

  describe("dismiss", () => {
    it("removes the entry from the queue without settling the promise", async () => {
      const store = createMcpAuthStore();
      const handle = store.push({ serverName: "x", authUrl: "u" });
      store.dismiss(handle.id);
      expect(store.peek()).toBeNull();

      // Prove the promise did not settle by racing it against a short timer.
      const timeout = new Promise<string>((resolve) =>
        setTimeout(() => resolve("timed out"), 10),
      );
      await expect(Promise.race([handle.pending, timeout])).resolves.toBe(
        "timed out",
      );
    });

    it("is a no-op for an unknown id", () => {
      const store = createMcpAuthStore();
      expect(() => store.dismiss("missing")).not.toThrow();
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers on push, resolveWithCode, cancel, and dismiss", () => {
      const store = createMcpAuthStore();
      const listener = vi.fn();
      store.subscribe(listener);

      const first = store.push({ serverName: "a", authUrl: "u" });
      expect(listener).toHaveBeenCalledTimes(1);

      store.resolveWithCode(first.id, "code");
      expect(listener).toHaveBeenCalledTimes(2);

      const second = store.push({ serverName: "b", authUrl: "u" });
      expect(listener).toHaveBeenCalledTimes(3);

      store.cancel(second.id);
      // Capture the error to avoid an unhandled rejection warning.
      second.pending.catch(() => {});
      expect(listener).toHaveBeenCalledTimes(4);

      const third = store.push({ serverName: "c", authUrl: "u" });
      expect(listener).toHaveBeenCalledTimes(5);

      store.dismiss(third.id);
      expect(listener).toHaveBeenCalledTimes(6);
    });

    it("unsubscribe stops further notifications", () => {
      const store = createMcpAuthStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      store.push({ serverName: "a", authUrl: "u" });
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      store.push({ serverName: "b", authUrl: "u" });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify when resolveWithCode/cancel/dismiss hit an unknown id", () => {
      const store = createMcpAuthStore();
      const listener = vi.fn();
      store.subscribe(listener);
      store.resolveWithCode("missing", "code");
      store.cancel("missing");
      store.dismiss("missing");
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
