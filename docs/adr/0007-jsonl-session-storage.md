# 7. JSONL append-only session storage

Date: 2026-03-20

## Status

Accepted

## Context

Tomo persists chat sessions to disk so users can resume conversations. Sessions can grow large — hundreds of thousands of tokens over extended use. The storage format needs to handle frequent writes (after every message) without degrading as sessions grow.

The initial implementation used full JSON files, rewriting the entire session on every message. This is O(n) per write and becomes expensive for large sessions.

## Decision

Use JSONL (JSON Lines) with append-only writes. Each session is a `.jsonl` file in `~/.tomo/sessions/`. The first line is a metadata entry (id, timestamps, provider, model). Each subsequent line is a message entry (id, role, content).

New messages are appended with `appendFileSync` — O(1) per write regardless of session size. The session file is created lazily on the first message, so empty sessions don't produce files on disk.

For listing sessions, only the first two lines are read (16KB buffer) to get metadata and a first-message preview, avoiding loading full message histories.

## Consequences

- Writes are constant-time — no performance degradation as sessions grow
- Listing sessions is efficient (partial reads, file mtime for sort order)
- Loading a full session requires reading and parsing every line — acceptable since it only happens on explicit `/session` load, not on every startup
- The format is not easily editable by hand (no pretty-printing), but sessions are not intended to be manually edited
- Updating metadata (if needed in future) requires rewriting the file, but this is a rare operation
