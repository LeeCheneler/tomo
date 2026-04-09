# 12. Use execFileSync instead of execSync to prevent shell injection

Date: 2026-04-06

## Status

Accepted

## Context

Tools like grep, glob, and git-context use `child_process` to shell out to `grep`, `git ls-files`, and `git` commands. The original implementation used `execSync` with template-literal command strings, escaping user-supplied values with `JSON.stringify()`.

`JSON.stringify` wraps values in double quotes and escapes `"` and `\`, but it does **not** escape shell metacharacters that are interpreted inside double-quoted strings:

- `$(cmd)` — command substitution
- `` `cmd` `` — backtick substitution
- `${var}` — variable expansion

Since these tools accept input from the LLM (search patterns, file globs, include filters), a prompt-injected or hallucinated pattern like `$(rm -rf /)` would be executed by the shell.

## Decision

Replace all `execSync(templateString)` calls with `execFileSync(binary, argsArray)`.

`execFileSync` spawns the process directly without a shell, so arguments are passed as-is to the target binary with no metacharacter interpretation. This eliminates the entire class of shell injection vulnerabilities regardless of input content.

## Consequences

- All user/LLM-supplied values (patterns, paths, globs) are now safe from shell injection by construction — no escaping logic required.
- Tests mock `execFileSync` instead of `execSync`. Test helpers that matched against a command string now join `[file, ...args]` for pattern matching.
- Any future `child_process` usage in tools should follow this pattern: use `execFileSync`/`spawnSync` with argument arrays, never `execSync` with string interpolation.
