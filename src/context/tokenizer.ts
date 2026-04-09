import { encodingForModel } from "js-tiktoken";
import type { ChatMessage } from "../provider/client";

/**
 * Approximate token encoder using cl100k_base (GPT-4 tokenizer).
 *
 * Not exact for every model but within ~10% for most modern LLMs,
 * which is sufficient for context window management.
 */
const encoder = encodingForModel("gpt-4o");

/** Returns the approximate token count for a string. */
export function countTokens(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Per-message overhead tokens added by the chat format.
 *
 * OpenAI's chat format adds ~4 tokens per message for role tags and
 * delimiters. This is a conservative estimate that works across providers.
 */
const MESSAGE_OVERHEAD = 4;

/** Returns the approximate token count for a chat message. */
export function countMessageTokens(message: ChatMessage): number {
  let tokens = MESSAGE_OVERHEAD;

  if (typeof message.content === "string") {
    tokens += countTokens(message.content);
  } else {
    // ContentPart array — count text parts
    for (const part of message.content) {
      if (part.type === "text") {
        tokens += countTokens(part.text);
      }
    }
  }

  if (message.role === "assistant" && message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += countTokens(tc.function.name);
      tokens += countTokens(tc.function.arguments);
    }
  }

  if (message.role === "tool") {
    tokens += countTokens(message.tool_call_id);
  }

  return tokens;
}
