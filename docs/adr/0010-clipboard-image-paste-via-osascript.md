# 10. Image paste: file path detection and osascript clipboard

Date: 2026-03-24

## Status

Accepted

## Context

Tomo needs to attach images to messages for vision-capable models. There are two distinct user workflows:

1. **Copy a file in Finder, paste in terminal** — the terminal receives the file path as text, not the image data. Reading the clipboard's `«class PNGf»` in this case yields the file's icon, not its content.
2. **Take a screenshot or copy image content from an app** — the clipboard contains raw image data (no file path pasted).

Node.js has no built-in API for reading binary clipboard contents. The application runs inside an Ink (React for terminal) render loop, so any clipboard access must not corrupt terminal output.

Alternatives considered for clipboard image data:

1. **`pbpaste`** — macOS built-in, but only outputs text clipboard contents. Cannot read image data.
2. **`pngpaste`** — Third-party CLI that reads clipboard images to a file. Works well but requires users to install an extra dependency.
3. **Native Node addon** — Would require a compiled native module, complicating the single-binary distribution via Node SEA (see ADR-0004).
4. **`osascript` (AppleScript)** — macOS built-in. Can extract raw image data as PNG via `the clipboard as «class PNGf»`. No extra dependencies.

## Decision

Use two complementary strategies:

### 1. File path detection via Cmd+V (cross-platform)

When text is entered in the chat input, the character handler checks whether the accumulated value ends with an absolute path to an image file (`/path/to/image.png` or `~/path/to/image.png`). If the file exists and has a supported image extension, it is read from disk, attached as an image, and the path text is stripped from the input.

This handles the "Copy as Pathname" workflow (Option+Cmd+C in Finder, then Cmd+V in terminal). The backward-scanning algorithm tries each `/` position and checks `existsSync`, handling paths with spaces and any preceding character (e.g. `question?/path/to/image.png`).

A `useRef` tracks the accumulated value/cursor across React's batched state updates, since Ink fires `useInput` per character during a paste but React batches the `setValue` calls, making the closure value stale.

### 2. Ctrl+V clipboard read (macOS only)

`Ctrl+V` triggers two strategies in order via `readClipboardImage()`:

**a) File reference detection via JXA** — uses `osascript -l JavaScript` with the ObjC bridge to access `NSPasteboard`, checking for `public.file-url` entries. If a file URL is found and points to an image, the file is read directly from disk. This handles files copied in Finder with Cmd+C, avoiding the `«class PNGf»` icon data.

**b) Raw image data via AppleScript** — falls back to reading `«class PNGf»` clipboard data for screenshots and image content copied from apps. Writes to a temp file, reads, base64-encodes, and cleans up.

All `execSync` calls use `stdio: ["pipe", "pipe", "pipe"]` to prevent output from corrupting Ink's terminal rendering.

On non-macOS platforms, `readClipboardImage()` returns `null` immediately. Linux and Windows support can be added later using `xclip`/`xsel` and PowerShell respectively.

## Consequences

- **File path detection is cross-platform** — works on any OS where the terminal pastes file paths as text.
- **Ctrl+V clipboard access is macOS only** for now. Silently does nothing on other platforms.
- **Blocking I/O** — `existsSync`/`readFileSync` run per character when the value ends with an image extension (fast, < 1ms). `execSync` runs on Ctrl+V (< 100ms). Both are acceptable for user-initiated actions.
- **No extra dependencies** — works out of the box on macOS.
- **Handles paths with spaces** — the backward-scanning path detection correctly handles macOS file names with spaces by trying each `/` position against `existsSync`.
