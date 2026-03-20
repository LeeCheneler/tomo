import type { ChatMessage } from "../provider/client";

/** The fraction of the context window reserved for the model's response. */
const RESPONSE_RESERVE = 0.25;

/**
 * Truncates messages to fit within a context window budget.
 *
 * Uses the last known prompt token count to estimate whether the next request
 * will exceed the budget. If so, drops the oldest non-system messages until
 * the estimated token count fits.
 *
 * Estimation: calculates a tokens-per-message average from the last request,
 * then uses it to estimate the cost of the current message list.
 *
 * The system message (first message if role is "system") is never dropped.
 */
export function truncateMessages(
  messages: ChatMessage[],
  contextWindow: number,
  lastPromptTokens: number | null,
): ChatMessage[] {
  if (!lastPromptTokens || messages.length === 0) return messages;

  const budget = Math.floor(contextWindow * (1 - RESPONSE_RESERVE));

  // Find where non-system messages start
  const systemCount = messages[0]?.role === "system" ? 1 : 0;

  // Count how many non-system messages were in the last request.
  // The current messages list may have grown since then (new user msg + assistant response),
  // but we use the last known count as a baseline.
  const lastNonSystemCount = messages.length - systemCount;
  if (lastNonSystemCount <= 0) return messages;

  // Estimate tokens per non-system message from the last request's prompt_tokens.
  // Subtract a rough system message overhead (use 1/4 of prompt tokens as a floor).
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
