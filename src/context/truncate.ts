import type { ChatMessage } from "../provider/client";

/**
 * Truncates messages to fit within a context window budget.
 *
 * The input budget is `contextWindow - maxTokens`, where maxTokens is the
 * number of tokens reserved for the model's response.
 *
 * Uses the last known prompt token count to estimate whether the next request
 * will exceed the budget. If so, drops the oldest non-system messages until
 * the estimated token count fits.
 *
 * The system message (first message if role is "system") is never dropped.
 */
export function truncateMessages(
  messages: ChatMessage[],
  contextWindow: number,
  maxTokens: number,
  lastPromptTokens: number | null,
): ChatMessage[] {
  if (!lastPromptTokens || messages.length === 0) return messages;

  const budget = contextWindow - maxTokens;
  if (budget <= 0) return messages;

  // Find where non-system messages start
  const systemCount = messages[0]?.role === "system" ? 1 : 0;

  const lastNonSystemCount = messages.length - systemCount;
  if (lastNonSystemCount <= 0) return messages;

  // Estimate tokens per non-system message from the last request's prompt_tokens.
  // Subtract a rough system message overhead estimate.
  const systemOverhead =
    systemCount > 0 ? Math.floor(lastPromptTokens * 0.1) : 0;
  const tokensForMessages = lastPromptTokens - systemOverhead;
  const tokensPerMessage =
    lastNonSystemCount > 0
      ? tokensForMessages / lastNonSystemCount
      : tokensForMessages;

  // Estimate total tokens for the current message list
  const estimatedTotal = systemOverhead + lastNonSystemCount * tokensPerMessage;

  if (estimatedTotal <= budget) return messages;

  // Drop oldest non-system messages until under budget
  const systemMessages = messages.slice(0, systemCount);
  const nonSystemMessages = messages.slice(systemCount);

  let dropCount = 0;
  let estimated = estimatedTotal;
  while (estimated > budget && dropCount < nonSystemMessages.length - 1) {
    estimated -= tokensPerMessage;
    dropCount++;
  }

  return [...systemMessages, ...nonSystemMessages.slice(dropCount)];
}
