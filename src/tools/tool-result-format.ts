import type { ToolResultFormat, ToolResultStatus } from "./types";

/**
 * Formats a tool result's output for the LLM, adding explicit status markers
 * only where the raw text would be ambiguous.
 *
 * Errors and denials are prefixed so the LLM cannot mistake them for normal
 * informational output, and absence of those prefixes implicitly signals
 * success. Successful diff results get a natural-language preamble because a
 * bare unified-diff does not obviously read as "the edit worked" to weaker
 * models, and we have observed them reissuing identical edits after a
 * successful one.
 *
 * Plain-text successes are returned verbatim: wrapping them in a "SUCCESS:"
 * prefix would create contradictions like "SUCCESS: No results found" that
 * confuse the LLM more than they help.
 */
export function formatToolResultForLlm(
  output: string,
  status: ToolResultStatus,
  format: ToolResultFormat,
): string {
  if (status === "error") return `ERROR: ${output}`;
  if (status === "denied") return `DENIED: ${output}`;
  if (format === "diff")
    return `Edit applied successfully. Unified diff:\n${output}`;
  return output;
}
