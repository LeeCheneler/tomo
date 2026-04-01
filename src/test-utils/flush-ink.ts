/**
 * Flushes Ink's pending input parser and React re-renders.
 *
 * Ink's input parser holds standalone escape bytes (`\x1b`) as "pending" and
 * flushes them via `setImmediate`. React then needs an additional tick to
 * commit the resulting state updates. This helper waits long enough for both
 * to complete so `lastFrame()` reflects the post-escape state.
 */
export async function flushInkFrames(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}
