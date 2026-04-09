/**
 * Shell metacharacters that indicate a compound or potentially dangerous command.
 *
 * Any command containing these patterns bypasses the allowed-commands list and
 * always requires explicit user confirmation.
 */
const COMPOUND_PATTERNS = ["&&", "||", ";", "|", "$(", "`", ">", "<", "&"];

/** Checks whether a command string contains shell compound operators or redirections. */
export function isCompoundCommand(command: string): boolean {
  return COMPOUND_PATTERNS.some((p) => command.includes(p));
}

/**
 * Checks whether a command is in the allowed list.
 *
 * Supports two match styles:
 * - Exact match: `"npm test"` matches only `"npm test"`
 * - Prefix match: `"git:*"` matches any command whose base command is `"git"`
 */
export function isCommandAllowed(
  command: string,
  allowedCommands: readonly string[],
): boolean {
  const trimmed = command.trim();
  const match = trimmed.match(/^\S+/);
  const baseCommand = match ? match[0] : "";

  for (const entry of allowedCommands) {
    if (entry === trimmed) return true;
    if (entry.endsWith(":*") && baseCommand === entry.slice(0, -2)) return true;
  }

  return false;
}
