import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./write-file";

const tmpDir = resolve(import.meta.dirname, "../../.test-write-file-tmp");
const mockContext = {
  renderInteractive: vi.fn().mockResolvedValue("approved"),
  reportProgress: vi.fn(),
};

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  mockContext.renderInteractive.mockResolvedValue("approved");
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

  it("returns error for empty path", async () => {
    const tool = getTool("write_file");
    const result = await tool?.execute(
      JSON.stringify({ path: "", content: "x" }),
      mockContext,
    );

    expect(result).toBe("Error: no file path provided");
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
});
