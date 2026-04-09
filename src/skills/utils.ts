/** Returns true if the input is a skill invocation (double `//` followed by a word character). */
export function isSkill(input: string): boolean {
  return /^\/\/[a-zA-Z]/.test(input);
}

/** Parsed skill invocation with the skill name and user text after it. */
export interface ParsedSkill {
  name: string;
  userText: string;
}

/** Extracts the skill name and remaining text from a `//skill` input. */
export function parseSkillInput(input: string): ParsedSkill {
  const withoutPrefix = input.slice(2);
  const spaceIndex = withoutPrefix.indexOf(" ");
  if (spaceIndex === -1) {
    return { name: withoutPrefix, userText: "" };
  }
  return {
    name: withoutPrefix.slice(0, spaceIndex),
    userText: withoutPrefix.slice(spaceIndex + 1).trim(),
  };
}
