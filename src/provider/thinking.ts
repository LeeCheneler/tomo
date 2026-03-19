const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

export interface ThinkingChunk {
  type: "thinking" | "content";
  text: string;
}

/**
 * Returns the length of the longest suffix of `text` that is a prefix of `tag`.
 * Used to detect partial tags at chunk boundaries.
 */
function findPartialTagLength(text: string, tag: string): number {
  for (let len = Math.min(tag.length - 1, text.length); len >= 1; len--) {
    if (text.endsWith(tag.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

/**
 * Extracts `<think>...</think>` blocks from a streamed token sequence.
 * Yields chunks tagged as either "thinking" or "content".
 * Handles tags split across multiple tokens by buffering partial matches.
 * Models that don't emit thinking tags pass through as pure content.
 */
export async function* extractThinking(
  tokens: AsyncIterable<string>,
): AsyncGenerator<ThinkingChunk> {
  let buffer = "";
  let state: "thinking" | "content" = "content";

  for await (const token of tokens) {
    buffer += token;

    while (buffer.length > 0) {
      const tag = state === "content" ? THINK_OPEN : THINK_CLOSE;
      const tagIndex = buffer.indexOf(tag);

      if (tagIndex !== -1) {
        const before = buffer.slice(0, tagIndex);
        if (before) {
          yield { type: state, text: before };
        }
        buffer = buffer.slice(tagIndex + tag.length);
        state = state === "content" ? "thinking" : "content";
      } else {
        const partialLen = findPartialTagLength(buffer, tag);
        if (partialLen > 0) {
          const safe = buffer.slice(0, -partialLen);
          if (safe) {
            yield { type: state, text: safe };
          }
          buffer = buffer.slice(-partialLen);
        } else {
          yield { type: state, text: buffer };
          buffer = "";
        }
        break;
      }
    }
  }

  if (buffer) {
    yield { type: state, text: buffer };
  }
}
