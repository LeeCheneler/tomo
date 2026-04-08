import { describe, expect, it, vi } from "vitest";
import { createPromptQueue } from "./prompt-queue";

describe("createPromptQueue", () => {
  it("starts empty", () => {
    const queue = createPromptQueue();
    expect(queue.peek()).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it("enqueues and peeks a confirm entry", () => {
    const queue = createPromptQueue();
    queue.enqueueConfirm("Allow?");
    expect(queue.size()).toBe(1);
    const front = queue.peek();
    expect(front?.kind).toBe("confirm");
    if (front?.kind === "confirm") {
      expect(front.message).toBe("Allow?");
    }
  });

  it("enqueues and peeks an ask entry", () => {
    const queue = createPromptQueue();
    queue.enqueueAsk("Which one?", ["A", "B"]);
    expect(queue.size()).toBe(1);
    const front = queue.peek();
    expect(front?.kind).toBe("ask");
    if (front?.kind === "ask") {
      expect(front.question).toBe("Which one?");
      expect(front.options).toEqual(["A", "B"]);
    }
  });

  it("resolves a confirm entry and advances", async () => {
    const queue = createPromptQueue();
    const promise = queue.enqueueConfirm("Allow?");
    queue.resolveConfirm(true);
    expect(await promise).toBe(true);
    expect(queue.peek()).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it("resolves an ask entry and advances", async () => {
    const queue = createPromptQueue();
    const promise = queue.enqueueAsk("Pick one", ["A", "B"]);
    queue.resolveAsk("A");
    expect(await promise).toBe("A");
    expect(queue.peek()).toBeNull();
  });

  it("resolves entries in FIFO order", async () => {
    const queue = createPromptQueue();
    const first = queue.enqueueConfirm("First?");
    const second = queue.enqueueAsk("Second?");
    const third = queue.enqueueConfirm("Third?");
    expect(queue.size()).toBe(3);

    expect(queue.peek()?.kind).toBe("confirm");
    queue.resolveConfirm(true);
    expect(await first).toBe(true);
    expect(queue.size()).toBe(2);

    expect(queue.peek()?.kind).toBe("ask");
    queue.resolveAsk("answer");
    expect(await second).toBe("answer");
    expect(queue.size()).toBe(1);

    queue.resolveConfirm(false);
    expect(await third).toBe(false);
    expect(queue.size()).toBe(0);
  });

  it("preserves label and detail on confirm entries", () => {
    const queue = createPromptQueue();
    queue.enqueueConfirm("Allow?", {
      label: "Run Command",
      detail: "git push",
    });
    const front = queue.peek();
    if (front?.kind === "confirm") {
      expect(front.label).toBe("Run Command");
      expect(front.detail).toBe("git push");
    }
  });

  it("preserves diff on confirm entries", () => {
    const queue = createPromptQueue();
    queue.enqueueConfirm("Apply?", { diff: "+added\n-removed" });
    const front = queue.peek();
    if (front?.kind === "confirm") {
      expect(front.diff).toBe("+added\n-removed");
    }
  });

  it("is a no-op when resolving confirm on empty queue", () => {
    const queue = createPromptQueue();
    expect(() => queue.resolveConfirm(true)).not.toThrow();
  });

  it("is a no-op when resolving ask on empty queue", () => {
    const queue = createPromptQueue();
    expect(() => queue.resolveAsk("test")).not.toThrow();
  });

  it("is a no-op when resolving confirm but front is an ask entry", () => {
    const queue = createPromptQueue();
    queue.enqueueAsk("Which?");
    queue.resolveConfirm(true);
    expect(queue.size()).toBe(1);
    expect(queue.peek()?.kind).toBe("ask");
  });

  it("is a no-op when resolving ask but front is a confirm entry", () => {
    const queue = createPromptQueue();
    queue.enqueueConfirm("Allow?");
    queue.resolveAsk("test");
    expect(queue.size()).toBe(1);
    expect(queue.peek()?.kind).toBe("confirm");
  });

  it("notifies subscribers on enqueue", () => {
    const queue = createPromptQueue();
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.enqueueConfirm("Allow?");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies subscribers on resolve", () => {
    const queue = createPromptQueue();
    const listener = vi.fn();
    queue.enqueueConfirm("Allow?");
    queue.subscribe(listener);
    queue.resolveConfirm(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops notifying after unsubscribe", () => {
    const queue = createPromptQueue();
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    unsubscribe();
    queue.enqueueConfirm("Allow?");
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple concurrent subscribers", () => {
    const queue = createPromptQueue();
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    queue.subscribe(listenerA);
    queue.subscribe(listenerB);
    queue.enqueueConfirm("Allow?");
    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerB).toHaveBeenCalledOnce();
  });
});
