import { afterEach, describe, expect, it, vi } from "vitest";
import { getSystemInfo } from "./system-info";

vi.mock("node:os", () => ({
  platform: () => "linux",
  release: () => "6.1.0",
  arch: () => "x64",
  userInfo: () => ({ username: "testuser" }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSystemInfo", () => {
  it("returns a formatted system info string with date", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/home/testuser/project");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));
    process.env.SHELL = "/bin/bash";

    const result = getSystemInfo();

    expect(result).toBe(
      "System: linux (6.1.0), arch: x64, shell: /bin/bash, user: testuser, cwd: /home/testuser/project, date: 2026-04-06T12:00:00.000Z",
    );
    vi.useRealTimers();
  });

  it("falls back to unknown when SHELL is not set", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp");
    const original = process.env.SHELL;
    delete process.env.SHELL;

    const result = getSystemInfo();

    expect(result).toContain("shell: unknown");

    if (original) {
      process.env.SHELL = original;
    }
  });
});
