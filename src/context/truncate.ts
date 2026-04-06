import type { ChatMessage } from "../provider/client";
import { countMessageTokens } from "./tokenizer";

/**
 * Headroom factor — reserve 5% of the context window as a safety buffer
 * since token counts are approximate (different tokenizers per model).
 */
const HEADROOM = 0.05;

/** Default tokens reserved for the model's response. */
const RESPONSE_RESERVE = 4096;

/**
 * Truncates messages to fit within a context window budget.
 *
 * Counts tokens for each message using an approximate tokenizer, then
 * drops the oldest non-system messages until the total fits within
 * `contextWindow - responseReserve - headroom`.
 *
 * The system message (first message if role is "system") is never dropped.
 * At least one non-system message is always kept.
 */
export function truncateMessages(
  messages: ChatMessage[],
  contextWindow: number,
): ChatMessage[] {
  if (messages.length === 0) return messages;

  const budget = Math.floor(contextWindow * (1 - HEADROOM) - RESPONSE_RESERVE);
  if (budget <= 0) return messages;

  // Count tokens for every message
  const tokenCounts = messages.map(countMessageTokens);
  const total = tokenCounts.reduce((sum, n) => sum + n, 0);

  if (total <= budget) return messages;

  // Find where non-system messages start
  const systemCount = messages[0]?.role === "system" ? 1 : 0;
  const systemTokens = tokenCounts
    .slice(0, systemCount)
    .reduce((s, n) => s + n, 0);

  // Drop oldest non-system messages until under budget, always keeping at least one
  let dropCount = 0;
  let nonSystemTokens = total - systemTokens;
  const nonSystemCounts = tokenCounts.slice(systemCount);

  while (
    systemTokens + nonSystemTokens > budget &&
    dropCount < nonSystemCounts.length - 1
  ) {
    nonSystemTokens -= nonSystemCounts[dropCount];
    dropCount++;
  }

  if (dropCount === 0) return messages;

  return [
    ...messages.slice(0, systemCount),
    ...messages.slice(systemCount + dropCount),
  ];
}
