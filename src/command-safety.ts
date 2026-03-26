/**
 * Pure functions for analysing shell commands: compound detection,
 * destructive pattern matching, and glob-style command pattern matching.
 */

/** Regex patterns that indicate a potentially destructive command. */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*[rf]|--recursive|--force)\b/,
  /\bgit\s+push\s+.*(-f|--force)\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+(-\w*f\w*|--force)\b/,
  /\bchmod\s+(-\w*R|--recursive)\b/,
  /\bchown\s+(-\w*R|--recursive)\b/,
  /\bkill\s+-9\b/,
  /\bkillall\b/,
  /\bdocker\s+rm\b/,
  /\bdocker\s+system\s+prune\b/,
  /\bkubectl\s+delete\b/,
  /\bdrop\s+table\b/i,
  /\bdrop\s+database\b/i,
];

/**
 * Detect whether a command string contains chaining or substitution operators
 * outside of quoted strings. Compound commands skip pattern matching in the
 * approval flow.
 */
export function isCompoundCommand(command: string): boolean {
  const stripped = command.replace(/"[^"]*"|'[^']*'/g, "");
  return /&&|\|\||[;|`]|\$\(/.test(stripped);
}

/**
 * Scan the raw command string for patterns that indicate a destructive
 * operation (e.g. `rm -rf`, `git push --force`).
 */
export function isDestructiveCommand(command: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/**
 * Simple glob-style prefix matching for command patterns.
 *
 * - `"git *"` matches any command starting with `"git "`
 * - `"npm test"` (no wildcard) matches only the exact string `"npm test"`
 * - `"*"` matches everything
 */
export function matchesCommandPattern(
  command: string,
  pattern: string,
): boolean {
  if (pattern === "*") return true;

  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) return command === pattern;

  const prefix = pattern.slice(0, starIndex);
  return command.startsWith(prefix);
}
