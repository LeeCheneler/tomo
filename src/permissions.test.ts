import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  isPathWithinCwd,
  resolvePermissions,
  withFilePermission,
} from "./permissions";
import { denied, ok } from "./tools/types";
import type { ToolContext } from "./tools/types";

describe("resolvePermissions", () => {
  it("returns defaults when no config provided", () => {
    expect(resolvePermissions()).toEqual(DEFAULT_PERMISSIONS);
  });

  it("returns defaults when config is undefined", () => {
    expect(resolvePermissions(undefined)).toEqual(DEFAULT_PERMISSIONS);
  });

  it("overrides defaults with provided config", () => {
    const result = resolvePermissions({ write_file: true });
    expect(result.write_file).toBe(true);
    expect(result.read_file).toBe(true);
  });

  it("can disable a default-enabled permission", () => {
    const result = resolvePermissions({ read_file: false });
    expect(result.read_file).toBe(false);
  });

  it("merges all overrides", () => {
    const result = resolvePermissions({
      read_file: false,
      write_file: true,
    });
    expect(result).toEqual({
      read_file: false,
      write_file: true,
    });
  });
});

describe("isPathWithinCwd", () => {
  it("returns true for files in cwd", () => {
    const filePath = resolve(process.cwd(), "src/test.ts");
    expect(isPathWithinCwd(filePath)).toBe(true);
  });

  it("returns true for files in nested subdirectories", () => {
    const filePath = resolve(process.cwd(), "a/b/c/deep.txt");
    expect(isPathWithinCwd(filePath)).toBe(true);
  });

  it("returns true for cwd itself", () => {
    expect(isPathWithinCwd(process.cwd())).toBe(true);
  });

  it("returns false for files outside cwd", () => {
    expect(isPathWithinCwd("/tmp/outside.txt")).toBe(false);
  });

  it("returns false for parent directory traversal", () => {
    const filePath = resolve(process.cwd(), "../outside.txt");
    expect(isPathWithinCwd(filePath)).toBe(false);
  });

  it("handles relative paths by resolving them", () => {
    expect(isPathWithinCwd("./src/test.ts")).toBe(true);
  });
});

describe("withFilePermission", () => {
  function makeContext(overrides?: Partial<ToolContext>): ToolContext {
    return {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      reportProgress: vi.fn(),
      permissions: { read_file: true, write_file: false },
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "",
        model: "",
        maxTokens: 1000,
        contextWindow: 4000,
      },
      allowedCommands: [],
      ...overrides,
    };
  }

  it("auto-approves when permission granted and path within cwd", async () => {
    const execute = vi.fn().mockReturnValue(ok("done"));
    const renderConfirm = vi.fn();
    const filePath = resolve(process.cwd(), "src/test.ts");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: true, write_file: false },
      }),
      permission: "read_file",
      filePath,
      execute,
      renderConfirm,
      denyMessage: ok("denied"),
    });

    expect(result).toEqual(ok("done"));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(renderConfirm).not.toHaveBeenCalled();
  });

  it("prompts when permission granted but path outside cwd", async () => {
    const execute = vi.fn().mockReturnValue(ok("done"));
    const renderConfirm = vi.fn().mockResolvedValue("approved");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: true, write_file: false },
      }),
      permission: "read_file",
      filePath: "/tmp/outside.txt",
      execute,
      renderConfirm,
      denyMessage: ok("denied"),
    });

    expect(result).toEqual(ok("done"));
    expect(renderConfirm).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("prompts when permission not granted even for cwd paths", async () => {
    const execute = vi.fn().mockReturnValue(ok("done"));
    const renderConfirm = vi.fn().mockResolvedValue("approved");
    const filePath = resolve(process.cwd(), "src/test.ts");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: false, write_file: false },
      }),
      permission: "read_file",
      filePath,
      execute,
      renderConfirm,
      denyMessage: ok("denied"),
    });

    expect(result).toEqual(ok("done"));
    expect(renderConfirm).toHaveBeenCalledTimes(1);
  });

  it("returns deny message when user denies confirmation", async () => {
    const execute = vi.fn();
    const renderConfirm = vi.fn().mockResolvedValue("denied");
    const filePath = resolve(process.cwd(), "src/test.ts");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: false, write_file: false },
      }),
      permission: "read_file",
      filePath,
      execute,
      renderConfirm,
      denyMessage: denied("The user denied this read."),
    });

    expect(result).toEqual(denied("The user denied this read."));
    expect(execute).not.toHaveBeenCalled();
  });

  it("works with write_file permission", async () => {
    const execute = vi.fn().mockReturnValue(ok("written"));
    const renderConfirm = vi.fn();
    const filePath = resolve(process.cwd(), "src/test.ts");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: true, write_file: true },
      }),
      permission: "write_file",
      filePath,
      execute,
      renderConfirm,
      denyMessage: ok("denied"),
    });

    expect(result).toEqual(ok("written"));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(renderConfirm).not.toHaveBeenCalled();
  });

  it("handles async execute functions", async () => {
    const execute = vi.fn().mockResolvedValue(ok("async result"));
    const renderConfirm = vi.fn();
    const filePath = resolve(process.cwd(), "src/test.ts");

    const result = await withFilePermission({
      context: makeContext({
        permissions: { read_file: true, write_file: false },
      }),
      permission: "read_file",
      filePath,
      execute,
      renderConfirm,
      denyMessage: ok("denied"),
    });

    expect(result).toEqual(ok("async result"));
  });
});
