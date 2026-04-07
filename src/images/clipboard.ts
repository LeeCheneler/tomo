import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { basename, extname, resolve } from "node:path";

/** An image attached to a user message. */
export interface ImageAttachment {
  /** Display name for the image (filename or "clipboard.png"). */
  name: string;
  /** Full data URI with base64-encoded content (e.g. data:image/png;base64,...). */
  dataUri: string;
}

/** Map of supported image extensions to MIME types. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

/**
 * Reads an image file from disk and returns it as a base64 data URI.
 * Returns null if the file doesn't exist, isn't a supported format, or can't be read.
 */
export function readImageFile(filePath: string): ImageAttachment | null {
  const ext = extname(filePath).toLowerCase();
  const mime = IMAGE_EXTENSIONS[ext];
  if (!mime) return null;

  const resolved = filePath.startsWith("~/")
    ? resolve(homedir(), filePath.slice(2))
    : resolve(filePath);

  if (!existsSync(resolved)) return null;

  try {
    const data = readFileSync(resolved);
    return {
      name: basename(resolved),
      dataUri: `data:${mime};base64,${data.toString("base64")}`,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if text ends with an absolute path to an image file.
 *
 * Scans backward through each `/` in the text, trying progressively
 * longer paths until one resolves to an existing image file. Handles
 * paths with spaces and `~/` home expansion.
 */
export function detectImagePath(
  text: string,
): { pathStart: number; attachment: ImageAttachment } | null {
  const trimmed = text.trimEnd();
  if (!/\.(?:png|jpe?g|gif|webp|bmp)$/i.test(trimmed)) return null;

  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (trimmed[i] !== "/") continue;

    const start = i > 0 && trimmed[i - 1] === "~" ? i - 1 : i;
    const candidatePath = trimmed.slice(start);
    const attachment = readImageFile(candidatePath);
    if (attachment) {
      return { pathStart: start, attachment };
    }
  }

  return null;
}

/**
 * Reads a file reference from the clipboard (e.g. file copied in Finder).
 * Uses JXA with NSPasteboard to read the public.file-url pasteboard type.
 */
function readClipboardFileAsImage(): ImageAttachment | null {
  try {
    const script = [
      'ObjC.import("AppKit");',
      "var pb = $.NSPasteboard.generalPasteboard;",
      'var fileType = "public.file-url";',
      "var available = pb.availableTypeFromArray([fileType]);",
      "if (available && available.js) {",
      "  var urlStr = pb.stringForType(fileType);",
      "  if (urlStr) {",
      "    var url = $.NSURL.URLWithString(urlStr);",
      '    if (url && url.isFileURL) { url.path.js; } else { ""; }',
      '  } else { ""; }',
      '} else { ""; }',
    ].join("\n");

    const filePath = execFileSync(
      "osascript",
      ["-l", "JavaScript", "-e", script],
      {
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();

    if (!filePath) return null;
    return readImageFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Reads raw image data from the clipboard (screenshots, copied image content).
 * Checks for PNG/TIFF/JPEG2000 data, extracts as PNG via AppleScript.
 */
function readClipboardRawImage(): ImageAttachment | null {
  const tmpFile = resolve(
    tmpdir(),
    `tomo-clipboard-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );

  try {
    const info = execFileSync("osascript", ["-e", "clipboard info"], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (
      !info.includes("«class PNGf»") &&
      !info.includes("«class TIFF»") &&
      !info.includes("«class jp2 »")
    ) {
      return null;
    }

    execFileSync(
      "osascript",
      [
        "-e",
        "set png to (the clipboard as «class PNGf»)",
        "-e",
        `set f to open for access POSIX file "${tmpFile}" with write permission`,
        "-e",
        "write png to f",
        "-e",
        "close access f",
      ],
      { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] },
    );

    const data = readFileSync(tmpFile);
    unlinkSync(tmpFile);

    return {
      name: "clipboard.png",
      dataUri: `data:image/png;base64,${data.toString("base64")}`,
    };
  } catch {
    try {
      unlinkSync(tmpFile);
    } catch {
      // temp file may not exist
    }
    return null;
  }
}

/**
 * Reads an image from the system clipboard (macOS only).
 *
 * Tries two strategies in order:
 * 1. File reference — if a file was copied in Finder, reads the file from disk
 * 2. Raw image data — if image content was copied (screenshot, editor), extracts PNG data
 *
 * Returns null if no image is on the clipboard or on non-macOS platforms.
 */
export function readClipboardImage(): ImageAttachment | null {
  if (platform() !== "darwin") return null;
  return readClipboardFileAsImage() ?? readClipboardRawImage();
}
