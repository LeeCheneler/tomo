import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openUrl } from "./open-url";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockedSpawn = vi.mocked(spawn);

/** Creates a fake ChildProcess that can simulate spawn success or failure. */
function fakeChild(): ChildProcess {
  const proc = Object.assign(new EventEmitter(), {
    unref: vi.fn(),
  });
  return proc as unknown as ChildProcess;
}

describe("openUrl", () => {
  afterEach(() => {
    mockedSpawn.mockReset();
  });

  it("spawns macOS `open` with the URL", async () => {
    const child = fakeChild();
    mockedSpawn.mockReturnValue(child);

    const promise = openUrl("https://example.com/authorize?state=abc");
    child.emit("spawn");
    await promise;

    expect(mockedSpawn).toHaveBeenCalledWith(
      "open",
      ["https://example.com/authorize?state=abc"],
      { stdio: "ignore", detached: true },
    );
  });

  it("unrefs the child after spawn so it outlives the tick", async () => {
    const child = fakeChild();
    mockedSpawn.mockReturnValue(child);

    const promise = openUrl("https://example.com");
    child.emit("spawn");
    await promise;

    expect(child.unref).toHaveBeenCalledTimes(1);
  });

  it("rejects when the spawn errors (e.g. `open` not on PATH)", async () => {
    const child = fakeChild();
    mockedSpawn.mockReturnValue(child);

    const promise = openUrl("https://example.com");
    child.emit("error", new Error("spawn open ENOENT"));

    await expect(promise).rejects.toThrow("spawn open ENOENT");
  });
});
