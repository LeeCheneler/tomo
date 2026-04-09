import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");
const { openPager } = await import("./open-pager");

describe("openPager", () => {
  const originalPager = process.env.PAGER;

  beforeEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  afterEach(() => {
    if (originalPager === undefined) {
      delete process.env.PAGER;
    } else {
      process.env.PAGER = originalPager;
    }
  });

  it("spawns less by default with -R +G and pipes content via stdin", () => {
    delete process.env.PAGER;
    openPager("hello");
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith("less", ["-R", "+G"], {
      input: "hello",
      stdio: ["pipe", "inherit", "inherit"],
    });
  });

  it("uses PAGER env var when set to an allowed binary", () => {
    process.env.PAGER = "more";
    openPager("hello");
    expect(spawnSync).toHaveBeenCalledWith(
      "more",
      ["-R", "+G"],
      expect.any(Object),
    );
  });

  it("is a no-op when PAGER is not allow-listed", () => {
    process.env.PAGER = "vim";
    openPager("hello");
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
