/**
 * Pure functions for analysing shell commands: compound detection
 * and glob-style command pattern matching.
 */

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
