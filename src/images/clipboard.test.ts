import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectImagePath,
  readClipboardImage,
  readImageFile,
} from "./clipboard";

// Mock node:fs for binary file reads.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => Buffer.from("fake-png-data")),
    unlinkSync: vi.fn(),
  };
});

// Mock node:child_process for osascript calls.
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn(() => "") };
});

// Mock platform to control macOS detection.
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, platform: vi.fn(() => "darwin") };
});

const { existsSync, readFileSync, unlinkSync } = await import("node:fs");
const { execFileSync } = await import("node:child_process");
const { platform } = await import("node:os");

afterEach(() => {
  vi.mocked(existsSync).mockReset();
  vi.mocked(readFileSync).mockReset();
  vi.mocked(unlinkSync).mockReset();
  vi.mocked(execFileSync).mockReset();
  vi.mocked(platform).mockReturnValue("darwin");
});

describe("readImageFile", () => {
  it("returns attachment for a valid PNG file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("png-bytes"));

    const result = readImageFile("/tmp/test.png");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("test.png");
    expect(result?.dataUri).toBe(
      `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`,
    );
  });

  it("returns attachment for JPEG files", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("jpg-bytes"));

    expect(readImageFile("/tmp/photo.jpg")?.name).toBe("photo.jpg");
    expect(readImageFile("/tmp/photo.jpeg")?.name).toBe("photo.jpeg");
  });

  it("returns null for unsupported extension", () => {
    expect(readImageFile("/tmp/doc.pdf")).toBeNull();
    expect(readImageFile("/tmp/video.mp4")).toBeNull();
  });

  it("returns null for non-existent file", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(readImageFile("/tmp/missing.png")).toBeNull();
  });

  it("returns null when readFileSync throws", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("permission denied");
    });
    expect(readImageFile("/tmp/locked.png")).toBeNull();
  });

  it("expands ~ to home directory", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("data"));

    readImageFile("~/Pictures/screenshot.png");
    const calledPath = vi.mocked(existsSync).mock.calls[0][0];
    expect(String(calledPath)).not.toContain("~");
    expect(String(calledPath)).toContain("Pictures/screenshot.png");
  });
});

describe("detectImagePath", () => {
  it("detects an absolute image path at end of text", () => {
    vi.mocked(existsSync).mockImplementation(
      (p) => String(p) === resolve("/tmp/test.png"),
    );
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("img"));

    const result = detectImagePath("look at /tmp/test.png");
    expect(result).not.toBeNull();
    expect(result?.pathStart).toBe(8);
    expect(result?.attachment.name).toBe("test.png");
  });

  it("detects ~/ path at end of text", () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith("Photos/cat.jpg"),
    );
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("img"));

    const result = detectImagePath("check ~/Photos/cat.jpg");
    expect(result).not.toBeNull();
    expect(result?.pathStart).toBe(6);
    expect(result?.attachment.name).toBe("cat.jpg");
  });

  it("returns null for non-image extension", () => {
    expect(detectImagePath("open /tmp/file.txt")).toBeNull();
  });

  it("returns null when no valid path found", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(detectImagePath("no path here.png")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(detectImagePath("")).toBeNull();
  });

  it("handles trailing whitespace", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("img"));

    const result = detectImagePath("/tmp/test.png   ");
    expect(result).not.toBeNull();
    expect(result?.attachment.name).toBe("test.png");
  });
});

describe("readClipboardImage", () => {
  it("returns null on non-macOS platform", () => {
    vi.mocked(platform).mockReturnValue("linux");
    expect(readClipboardImage()).toBeNull();
  });

  it("reads file reference from clipboard", () => {
    vi.mocked(execFileSync).mockReturnValue("/tmp/image.png\n");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("file-data"));

    const result = readClipboardImage();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("image.png");
    expect(execFileSync).toHaveBeenCalledWith(
      "osascript",
      expect.arrayContaining(["-l", "JavaScript"]),
      expect.any(Object),
    );
  });

  it("falls back to raw image data when no file reference", () => {
    // First call (JXA file reference) returns empty.
    // Second call (clipboard info) returns PNG class.
    // Third call (extract PNG) succeeds.
    vi.mocked(execFileSync)
      .mockReturnValueOnce("")
      .mockReturnValueOnce("«class PNGf», 12345\n")
      .mockReturnValueOnce("");
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("raw-png"));

    const result = readClipboardImage();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("clipboard.png");
    expect(unlinkSync).toHaveBeenCalled();
  });

  it("returns null when clipboard has no image data", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("")
      .mockReturnValueOnce("«class utf8», 42\n");

    expect(readClipboardImage()).toBeNull();
  });

  it("returns null when osascript fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("osascript timeout");
    });
    expect(readClipboardImage()).toBeNull();
  });

  it("cleans up temp file when extraction fails", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("")
      .mockReturnValueOnce("«class PNGf», 12345\n")
      .mockImplementationOnce(() => {
        throw new Error("write failed");
      });

    readClipboardImage();
    expect(unlinkSync).toHaveBeenCalled();
  });
});
