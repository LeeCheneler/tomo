import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectImagePath, readImageFile } from "./images";

const tmpDir = resolve(import.meta.dirname, "../.test-images-tmp");

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("readImageFile", () => {
  it("reads a PNG file as a data URI", () => {
    const filePath = resolve(tmpDir, "test.png");
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(filePath, content);

    const result = readImageFile(filePath);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("test.png");
    expect(result?.dataUri).toBe(
      `data:image/png;base64,${content.toString("base64")}`,
    );
  });

  it("reads a JPEG file as a data URI", () => {
    const filePath = resolve(tmpDir, "test.jpg");
    writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    const result = readImageFile(filePath);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("test.jpg");
    expect(result?.dataUri).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("returns null for non-existent file", () => {
    expect(readImageFile("/nonexistent/file.png")).toBeNull();
  });

  it("returns null for unsupported format", () => {
    const filePath = resolve(tmpDir, "test.tiff");
    writeFileSync(filePath, "data");
    expect(readImageFile(filePath)).toBeNull();
  });

  it("returns null for non-image extension", () => {
    expect(readImageFile("/tmp/file.txt")).toBeNull();
  });
});

describe("detectImagePath", () => {
  it("detects an absolute path at the end of text", () => {
    const filePath = resolve(tmpDir, "photo.png");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(`look at ${filePath}`);
    expect(result).not.toBeNull();
    expect(result?.attachment.name).toBe("photo.png");
    expect(result?.pathStart).toBe(8);
  });

  it("detects a standalone absolute path", () => {
    const filePath = resolve(tmpDir, "photo.png");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(filePath);
    expect(result).not.toBeNull();
    expect(result?.pathStart).toBe(0);
  });

  it("handles paths with spaces", () => {
    const filePath = resolve(tmpDir, "my screenshot.png");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(filePath);
    expect(result).not.toBeNull();
    expect(result?.attachment.name).toBe("my screenshot.png");
  });

  it("returns null for non-existent path", () => {
    expect(detectImagePath("/nonexistent/file.png")).toBeNull();
  });

  it("returns null for text without image paths", () => {
    expect(detectImagePath("hello world")).toBeNull();
  });

  it("returns null for non-image extensions", () => {
    expect(detectImagePath("/tmp/file.txt")).toBeNull();
  });

  it("handles trailing whitespace", () => {
    const filePath = resolve(tmpDir, "photo.png");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(`${filePath}  `);
    expect(result).not.toBeNull();
  });

  it("is case-insensitive for extensions", () => {
    const filePath = resolve(tmpDir, "photo.PNG");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(filePath);
    expect(result).not.toBeNull();
  });

  it("detects path preceded by non-whitespace character", () => {
    const filePath = resolve(tmpDir, "photo.png");
    writeFileSync(filePath, Buffer.from([0x89, 0x50]));

    const result = detectImagePath(`whats this?${filePath}`);
    expect(result).not.toBeNull();
    expect(result?.attachment.name).toBe("photo.png");
  });

  it("strips preceding text and returns correct pathStart", () => {
    const filePath = resolve(tmpDir, "img.jpg");
    writeFileSync(filePath, Buffer.from([0xff, 0xd8]));

    const prefix = "describe this image";
    const result = detectImagePath(`${prefix}${filePath}`);
    expect(result).not.toBeNull();
    expect(result?.pathStart).toBe(prefix.length);
  });
});

describe("readClipboardImage", () => {
  it("returns null on non-darwin platforms", async () => {
    vi.resetModules();
    vi.doMock("node:os", () => ({
      platform: () => "linux",
      tmpdir: () => "/tmp",
      homedir: () => "/home/test",
    }));
    const { readClipboardImage } = await import("./images");
    expect(readClipboardImage()).toBeNull();
    vi.doUnmock("node:os");
    vi.resetModules();
  });
});
