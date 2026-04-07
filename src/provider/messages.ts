import type { ChatMessage as DisplayMessage } from "../chat/message";
import { stripAnsi } from "../utils/strip-ansi";
import type { ChatMessage as ProviderMessage } from "./client";

/**
 * Builds the provider message array from display messages.
 * Prepends the system prompt at index 0, then maps user and assistant
 * display messages to the provider format. Other message types (command,
 * error, interrupted) are skipped as they are UI-only.
 *
 * Assistant messages are stripped of ANSI escape codes before being sent
 * to the provider. Display messages contain rendered markdown with ANSI
 * formatting — sending those codes back would waste context tokens.
 */
export function buildProviderMessages(
  messages: DisplayMessage[],
  systemPrompt: string,
): ProviderMessage[] {
  const result: ProviderMessage[] = [{ role: "system", content: systemPrompt }];
  for (const msg of messages) {
    if (msg.role === "user" && msg.images && msg.images.length > 0) {
      result.push({
        role: "user",
        content: [
          { type: "text", text: msg.content },
          ...msg.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.dataUri },
          })),
        ],
      });
    } else if (msg.role === "user" || msg.role === "skill") {
      result.push({ role: "user", content: msg.content });
    }
    if (msg.role === "assistant") {
      result.push({ role: "assistant", content: stripAnsi(msg.content) });
    }
    if (msg.role === "tool-call") {
      result.push({
        role: "assistant",
        content: msg.content,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });
    }
    if (msg.role === "tool-result") {
      result.push({
        role: "tool",
        content: msg.output,
        tool_call_id: msg.toolCallId,
      });
    }
  }
  return result;
}
