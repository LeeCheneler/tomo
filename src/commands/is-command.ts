/** Returns true if the input is a slash command (single `/` followed by a word character). */
export function isCommand(input: string): boolean {
  return /^\/[a-zA-Z]/.test(input);
}
