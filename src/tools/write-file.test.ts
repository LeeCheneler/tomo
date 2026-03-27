import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";
import { makeMockContext } from "./test-helpers";

// Import to trigger registration
import "./write-file";

const tmpDir = resolve(import.meta.dirname, "../../.test-write-file-tmp");
let mockContext = makeMockContext({ permissions: {} });

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  mockContext = makeMockContext({ permissions: {} });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("write_file tool", () => {
  it("is registered as interactive", () => {
    const tool = getTool("write_file");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("write_file");
    // interactive defaults to true (undefined)
    expect(tool?.interactive).toBeUndefined();
  });

  it("writes a new file", async () => {
    const filePath = resolve(tmpDir, "new.txt");
    const tool = getTool("write_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath, content: "hello world\n" }),
      mockContext,
    );

    expect(result).toContain("Successfully wrote to");
    expect(readFileSync(filePath, "utf-8")).toBe("hello world\n");
  });

  it("overwrites an existing file", async () => {
    const filePath = resolve(tmpDir, "existing.txt");
    writeFileSync(filePath, "old content\n");
    const tool = getTool("write_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath, content: "new content\n" }),
      mockContext,
    );

    expect(result).toContain("Successfully wrote to");
    expect(readFileSync(filePath, "utf-8")).toBe("new content\n");
  });

  it("creates parent directories", async () => {
    const filePath = resolve(tmpDir, "a/b/c/deep.txt");
    const tool = getTool("write_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath, content: "deep\n" }),
      mockContext,
    );

    expect(result).toContain("Successfully wrote to");
    expect(readFileSync(filePath, "utf-8")).toBe("deep\n");
  });

  it("throws for empty path", async () => {
    const tool = getTool("write_file");
    await expect(
      tool?.execute(JSON.stringify({ path: "", content: "x" }), mockContext),
    ).rejects.toThrow("no file path provided");
    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("returns denial message when user denies", async () => {
    mockContext.renderInteractive.mockResolvedValue("denied");
    const filePath = resolve(tmpDir, "denied.txt");
    const tool = getTool("write_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath, content: "should not exist" }),
      mockContext,
    );

    expect(result).toBe("The user denied this write.");
  });

  it("calls renderInteractive for confirmation", async () => {
    const filePath = resolve(tmpDir, "confirm.txt");
    const tool = getTool("write_file");

    await tool?.execute(
      JSON.stringify({ path: filePath, content: "test\n" }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("skips confirmation when write_file permission granted and path in cwd", async () => {
    const filePath = resolve(process.cwd(), ".test-write-perm.txt");
    const tool = getTool("write_file");
    const ctx = {
      ...mockContext,
      permissions: { write_file: true },
    };

    const result = await tool?.execute(
      JSON.stringify({ path: filePath, content: "auto\n" }),
      ctx,
    );

    expect(result).toContain("Successfully wrote to");
    expect(ctx.renderInteractive).not.toHaveBeenCalled();
    // Clean up
    rmSync(filePath, { force: true });
  });

  it("still prompts when write_file permission granted but path outside cwd", async () => {
    const filePath = "/tmp/.test-write-perm-outside.txt";
    const tool = getTool("write_file");
    const ctx = {
      ...mockContext,
      permissions: { write_file: true },
    };

    await tool?.execute(
      JSON.stringify({ path: filePath, content: "test\n" }),
      ctx,
    );

    expect(ctx.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("prompts when write_file permission not granted even for cwd paths", async () => {
    const filePath = resolve(tmpDir, "no-perm.txt");
    const tool = getTool("write_file");

    await tool?.execute(
      JSON.stringify({ path: filePath, content: "test\n" }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });
});
