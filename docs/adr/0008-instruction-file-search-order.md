# 8. Instruction file search order

Date: 2026-03-20

## Status

Accepted

## Context

Tomo supports loading instruction files (system prompts) from disk to customise LLM behaviour. Multiple conventions exist across AI tools — `claude.md` (Claude Code), `agents.md` (agent frameworks) — and files can live in different locations (tool-specific directories, project root, home directory).

The search needs to support both global (user-wide) and local (project-specific) instructions, combining them when both exist.

## Decision

Search three directory types per location, in preference order:

1. `.tomo/` — tomo's own convention
2. `.claude/` — Claude Code convention
3. Bare directory (project root or home) — general convention

Within each directory, filenames are searched case-insensitively in order: `claude.md` then `agents.md`. First match wins per location.

**Root locations:** `~/.tomo/`, `~/.claude/`, `~/`
**Local locations:** `./.tomo/`, `./.claude/`, `./`

When a local file is found, the root search is constrained to the **same filename** only. For example, a local `agents.md` will only pair with a root `agents.md` — it won't combine with a root `claude.md`. This prevents accidental cross-contamination between instruction files meant for different tools.

When no local file exists, the root search uses the full preference order.

Combined content is sent as a system message: root first, then local, separated by `---`.

## Consequences

- Users can reuse existing `claude.md` or `agents.md` files without creating tomo-specific copies
- The `.tomo/` directory takes precedence, so tomo-specific overrides always win
- Filename anchoring prevents surprising combinations (e.g. a Claude Code `claude.md` mixing with an unrelated `agents.md`)
- Adding support for new conventions only requires extending the directory and filename lists
- Files are read once at startup — changes require restarting tomo
