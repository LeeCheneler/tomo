import { render as inkRender } from "ink-testing-library";
import type { ReactElement } from "react";

/**
 * Flushes Ink's pending input parser and React re-renders.
 *
 * Ink's input parser holds standalone escape bytes (`\x1b`) as "pending" and
 * flushes them via `setImmediate`. React then needs an additional tick to
 * commit the resulting state updates. This helper waits long enough for both
 * to complete so `lastFrame()` reflects the post-escape state.
 */
async function flushInkFrames(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

/** Stdin wrapper that auto-flushes after each write. */
interface AsyncStdin {
  /** Writes data to stdin and waits for Ink to process it. */
  write: (data: string) => Promise<void>;
}

/** Return value of renderInk. Same as ink-testing-library's render but with async stdin.write. */
export interface InkRenderResult {
  stdin: AsyncStdin;
  lastFrame: () => string | undefined;
  frames: string[];
  rerender: (tree: ReactElement) => void;
  unmount: () => void;
  cleanup: () => void;
}

/**
 * Wraps ink-testing-library's render with auto-flushing stdin.
 *
 * Every `stdin.write()` call automatically waits for Ink's input parser
 * and React re-renders to complete, eliminating manual `flushInkFrames()`
 * calls in tests.
 */
export function renderInk(tree: ReactElement): InkRenderResult {
  const result = inkRender(tree);
  const originalWrite = result.stdin.write;

  return {
    lastFrame: result.lastFrame,
    frames: result.frames,
    rerender: result.rerender,
    unmount: result.unmount,
    cleanup: result.cleanup,
    stdin: {
      async write(data: string) {
        originalWrite(data);
        await flushInkFrames();
      },
    },
  };
}
