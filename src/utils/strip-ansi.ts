// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escape codes requires control characters
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

/** Strips ANSI escape codes (colors, bold, etc.) from a string. */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}
