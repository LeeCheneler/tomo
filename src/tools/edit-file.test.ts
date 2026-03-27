import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./edit-file";

const tmpDir = resolve(import.meta.dirname, "../../.test-edit-file-tmp");
const mockContext = {
  renderInteractive: vi.fn().mockResolvedValue("approved"),
  reportProgress: vi.fn(),
  permissions: {},
  signal: new AbortController().signal,
  depth: 0,
  providerConfig: {
    baseUrl: "http://localhost",
    model: "test-model",
    apiKey: undefined,
    maxTokens: 1024,
    contextWindow: 8192,
  },

  allowedCommands: [],
};

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  mockContext.renderInteractive.mockResolvedValue("approved");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("edit_file tool", () => {
  it("is registered as interactive", () => {
    const tool = getTool("edit_file");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("edit_file");
    expect(tool?.interactive).toBeUndefined();
  });

  it("replaces a unique string in the file", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello world\ngoodbye world\n");
    const tool = getTool("edit_file");

    const result = await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello world",
        new_string: "hi world",
      }),
      mockContext,
    );

    expect(result).toContain("Successfully edited");
    expect(readFileSync(filePath, "utf-8")).toBe("hi world\ngoodbye world\n");
  });

  it("returns error when old_string is not found", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");

    const result = await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "missing",
        new_string: "replaced",
      }),
      mockContext,
    );

    expect(result).toContain("old_string not found");
    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("returns error when old_string is not unique", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "dup\ndup\n");
    const tool = getTool("edit_file");

    const result = await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "dup",
        new_string: "replaced",
      }),
      mockContext,
    );

    expect(result).toContain("found 2 times");
    expect(result).toContain("must be unique");
    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("returns error for non-existent file", async () => {
    const tool = getTool("edit_file");
    const result = await tool?.execute(
      JSON.stringify({
        path: resolve(tmpDir, "nope.txt"),
        old_string: "x",
        new_string: "y",
      }),
      mockContext,
    );

    expect(result).toContain("file not found");
  });

  it("throws for empty path", async () => {
    const tool = getTool("edit_file");
    await expect(
      tool?.execute(
        JSON.stringify({ path: "", old_string: "x", new_string: "y" }),
        mockContext,
      ),
    ).rejects.toThrow("no file path provided");
  });

  it("throws for empty old_string", async () => {
    const tool = getTool("edit_file");
    await expect(
      tool?.execute(
        JSON.stringify({
          path: resolve(tmpDir, "test.txt"),
          old_string: "",
          new_string: "y",
        }),
        mockContext,
      ),
    ).rejects.toThrow("old_string must not be empty");
  });

  it("returns error when old_string equals new_string", async () => {
    const tool = getTool("edit_file");
    const result = await tool?.execute(
      JSON.stringify({
        path: resolve(tmpDir, "test.txt"),
        old_string: "same",
        new_string: "same",
      }),
      mockContext,
    );

    expect(result).toBe("Error: old_string and new_string are identical");
  });

  it("returns denial message when user denies", async () => {
    mockContext.renderInteractive.mockResolvedValue("denied");
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");

    const result = await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello",
        new_string: "bye",
      }),
      mockContext,
    );

    expect(result).toBe("The user denied this edit.");
    // File should be unchanged
    expect(readFileSync(filePath, "utf-8")).toBe("hello\n");
  });

  it("calls renderInteractive for confirmation", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");

    await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello",
        new_string: "bye",
      }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("skips confirmation when write_file permission granted and path in cwd", async () => {
    const filePath = resolve(process.cwd(), ".test-edit-perm.txt");
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");
    const ctx = {
      ...mockContext,
      permissions: { write_file: true },
    };

    const result = await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello",
        new_string: "bye",
      }),
      ctx,
    );

    expect(result).toContain("Successfully edited");
    expect(ctx.renderInteractive).not.toHaveBeenCalled();
    expect(readFileSync(filePath, "utf-8")).toBe("bye\n");
    rmSync(filePath, { force: true });
  });

  it("still prompts when write_file permission granted but path outside cwd", async () => {
    const filePath = "/tmp/.test-edit-perm-outside.txt";
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");
    const ctx = {
      ...mockContext,
      permissions: { write_file: true },
    };

    await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello",
        new_string: "bye",
      }),
      ctx,
    );

    expect(ctx.renderInteractive).toHaveBeenCalledTimes(1);
    rmSync(filePath, { force: true });
  });

  it("prompts when write_file permission not granted even for cwd paths", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello\n");
    const tool = getTool("edit_file");

    await tool?.execute(
      JSON.stringify({
        path: filePath,
        old_string: "hello",
        new_string: "bye",
      }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });
});
