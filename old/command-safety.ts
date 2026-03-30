/**
 * Pure functions for analysing shell commands: compound detection
 * and allowed command matching.
 */

/**
 * Strip quoted strings from a command to avoid false positives on operators
 * inside quotes. Handles escaped quotes within double-quoted strings.
 *
 * - Double quotes: handles \" escapes, e.g. "hello \"world\"" is one token
 * - Single quotes: no escapes (POSIX behaviour), e.g. 'hello' is one token
 */
function stripQuotedStrings(command: string): string {
  return command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "");
}

/**
 * Detect whether a command string could execute multiple commands or inject
 * unintended commands via shell operators outside of quoted strings.
 *
 * Detected operators:
 * - Chaining: && || ;
 * - Pipes: |
 * - Subshell/substitution: $() ${} ` `
 * - Process substitution: <() >()
 * - Newlines (act as ; in shell)
 */
export function isCompoundCommand(command: string): boolean {
  // Newlines always indicate compound — check before stripping
  if (command.includes("\n")) return true;

  const stripped = stripQuotedStrings(command);

  return /&&|\|\||[;|`]|\$[({]|[<>]\(/.test(stripped);
}

/**
 * Check whether a command is allowed by the allowed commands list.
 *
 * Entries can be:
 * - Exact match: `"npm test"` matches only `"npm test"`
 * - Prefix match: `"git:*"` matches any command whose first word is `"git"`
 */
export function isCommandAllowed(
  command: string,
  allowedCommands: string[],
  options?: { skipPrefix?: boolean },
): boolean {
  const commandWord = command.split(" ")[0];

  for (const entry of allowedCommands) {
    // Exact match — always checked
    if (command === entry) return true;

    // Prefix match — skipped for compound commands
    if (!options?.skipPrefix && entry.endsWith(":*")) {
      const prefix = entry.slice(0, -2);
      if (commandWord === prefix) return true;
    }
  }

  return false;
}
