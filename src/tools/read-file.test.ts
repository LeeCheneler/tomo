import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./read-file";

const tmpDir = resolve(import.meta.dirname, "../../.test-read-file-tmp");
const mockContext = {
  renderInteractive: vi.fn().mockResolvedValue("approved"),
  reportProgress: vi.fn(),
  permissions: { read_file: true },
  signal: new AbortController().signal,
  depth: 0,
  providerConfig: {
    baseUrl: "http://localhost",
    model: "test-model",
    apiKey: undefined,
    maxTokens: 1024,
    contextWindow: 8192,
  },
};

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
  mockContext.renderInteractive.mockResolvedValue("approved");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("read_file tool", () => {
  it("is registered as non-interactive", () => {
    const tool = getTool("read_file");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("read_file");
    expect(tool?.interactive).toBe(false);
  });

  it("reads a file and returns numbered lines", async () => {
    const filePath = resolve(tmpDir, "test.txt");
    writeFileSync(filePath, "hello\nworld\n");

    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: filePath }),
      mockContext,
    );

    expect(result).toContain("hello");
    expect(result).toContain("world");
    expect(result).toContain("1 |");
    expect(result).toContain("2 |");
  });

  it("returns error for non-existent file", async () => {
    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: resolve(tmpDir, "nope.txt") }),
      mockContext,
    );

    expect(result).toContain("Error: file not found");
  });

  it("throws for empty path", async () => {
    const tool = getTool("read_file");
    await expect(
      tool?.execute(JSON.stringify({ path: "" }), mockContext),
    ).rejects.toThrow("no file path provided");
  });

  it("returns error for directories", async () => {
    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: tmpDir }),
      mockContext,
    );

    expect(result).toContain("is a directory");
  });

  it("truncates files exceeding 500 lines", async () => {
    const lines = Array.from({ length: 600 }, (_, i) => `line ${i + 1}`);
    const filePath = resolve(tmpDir, "big.txt");
    writeFileSync(filePath, lines.join("\n"));

    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: filePath }),
      mockContext,
    );

    expect(result).toContain("showing first 500 of 600 lines");
    expect(result).toContain("line 1");
    expect(result).toContain("line 500");
    expect(result).not.toContain("line 501");
  });

  it("supports startLine and endLine for range reads", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const filePath = resolve(tmpDir, "range.txt");
    writeFileSync(filePath, lines.join("\n"));

    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: filePath, startLine: 5, endLine: 10 }),
      mockContext,
    );

    expect(result).toContain("lines 5-10 of 20");
    expect(result).toContain("line 5");
    expect(result).toContain("line 10");
    expect(result).not.toContain("line 4\n");
    expect(result).not.toContain("line 11");
  });

  it("clamps line range to file bounds", async () => {
    const filePath = resolve(tmpDir, "short.txt");
    writeFileSync(filePath, "a\nb\nc\n");

    const tool = getTool("read_file");
    const result = await tool?.execute(
      JSON.stringify({ path: filePath, startLine: 1, endLine: 100 }),
      mockContext,
    );

    expect(result).toContain("lines 1-4 of 4");
  });

  it("does not prompt when read_file permission is granted and path in cwd", async () => {
    const filePath = resolve(tmpDir, "allowed.txt");
    writeFileSync(filePath, "content\n");
    const tool = getTool("read_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath }),
      mockContext,
    );

    expect(result).toContain("content");
    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("prompts when read_file permission is not granted", async () => {
    const filePath = resolve(tmpDir, "gated.txt");
    writeFileSync(filePath, "secret\n");
    const tool = getTool("read_file");
    const ctx = {
      ...mockContext,
      permissions: { read_file: false },
    };

    const result = await tool?.execute(JSON.stringify({ path: filePath }), ctx);

    expect(ctx.renderInteractive).toHaveBeenCalledTimes(1);
    expect(result).toContain("secret");
  });

  it("returns denial when user denies read", async () => {
    const filePath = resolve(tmpDir, "denied.txt");
    writeFileSync(filePath, "secret\n");
    const tool = getTool("read_file");
    const ctx = {
      ...mockContext,
      renderInteractive: vi.fn().mockResolvedValue("denied"),
      permissions: { read_file: false },
    };

    const result = await tool?.execute(JSON.stringify({ path: filePath }), ctx);

    expect(result).toBe("The user denied this read.");
  });

  it("prompts for files outside cwd even with permission granted", async () => {
    const filePath = "/tmp/.test-read-outside.txt";
    writeFileSync(filePath, "outside\n");
    const tool = getTool("read_file");

    const result = await tool?.execute(
      JSON.stringify({ path: filePath }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
    expect(result).toContain("outside");
    rmSync(filePath, { force: true });
  });
});
