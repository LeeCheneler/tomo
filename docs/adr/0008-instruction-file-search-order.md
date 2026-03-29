# 8. Instruction file search order

Date: 2026-03-20

## Status

Superseded

## Context

Tomo supports loading instruction files (system prompts) from disk to customise LLM behaviour. Multiple conventions exist across AI tools — `claude.md` (Claude Code), `agents.md` (agent frameworks) — and files can live in different locations (tool-specific directories, project root, home directory).

The search needs to support both global (user-wide) and local (project-specific) instructions, combining them when both exist.

## Decision (original)

Search three directory types per location, in preference order:

1. `.tomo/` — tomo's own convention
2. `.claude/` — Claude Code convention
3. Bare directory (project root or home) — general convention

Within each directory, filenames are searched case-insensitively in order: `claude.md` then `agents.md`. First match wins per location.

## Superseded by

As of 2026-03-29, instruction files use two fixed paths only:

- **Global:** `~/tomo.md`
- **Local:** `.tomo/tomo.md`

Support for `claude.md`, `agents.md`, `.claude/`, and bare directory search was removed. The multi-path search added complexity with no real benefit — tomo should use its own convention rather than piggyback on other tools' file layouts. See issue #222.

## Consequences

- Users must rename existing `claude.md` or `agents.md` files to the new paths
- No case-insensitive search needed — paths are fixed
- No filename anchoring logic — both locations always pair
- Simpler instruction loading code with fewer edge cases
