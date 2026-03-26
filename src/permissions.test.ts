import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  isPathWithinCwd,
  resolvePermissions,
} from "./permissions";

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
    expect(result.edit_file).toBe(false);
  });

  it("can disable a default-enabled permission", () => {
    const result = resolvePermissions({ read_file: false });
    expect(result.read_file).toBe(false);
  });

  it("merges all overrides", () => {
    const result = resolvePermissions({
      read_file: false,
      write_file: true,
      edit_file: true,
    });
    expect(result).toEqual({
      read_file: false,
      write_file: true,
      edit_file: true,
      run_command: false,
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
