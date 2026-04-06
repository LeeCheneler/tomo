/** Returns true if the input is a skill invocation (double `//` followed by a word character). */
export function isSkill(input: string): boolean {
  return /^\/\/[a-zA-Z]/.test(input);
}
