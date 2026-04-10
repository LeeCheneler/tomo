import { render as inkRender } from "ink-testing-library";
import type { ReactElement } from "react";
import { afterEach } from "vitest";
import { ConfigProvider, useConfig } from "../config/hook";
import type { Config } from "../config/schema";
import type { MockFsState } from "./mock-fs";
import { mockConfig } from "./mock-config";

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

/** Stdin wrapper that auto-flushes after each write. */
interface AsyncStdin {
  /** Writes data to stdin and waits for Ink to process it. */
  write: (data: string) => Promise<void>;
}

/** Config options for renderInk. Mirrors mockConfig's shape. */
export interface RenderInkConfig {
  global?: Partial<Config>;
  local?: Partial<Config>;
}

/** Return value of renderInk. Same as ink-testing-library's render but with async stdin.write. */
export interface InkRenderResult {
  stdin: AsyncStdin;
  lastFrame: () => string | undefined;
  frames: string[];
  rerender: (tree: ReactElement) => void;
  unmount: () => void;
  cleanup: () => void;
  /** Mock filesystem state. */
  fsState: MockFsState;
  /** Returns the current config from the React context. Useful for asserting reload() was called. */
  getConfig: () => Config;
  /** Triggers a config reload from the mock filesystem. Use after mutating `fsState`. */
  reloadConfig: () => Promise<void>;
}

/**
 * Wraps ink-testing-library's render with auto-flushing stdin and ConfigProvider.
 *
 * Every `stdin.write()` call automatically waits for Ink's input parser
 * and React re-renders to complete, eliminating manual `flushInkFrames()`
 * calls in tests.
 *
 * The tree is wrapped in a ConfigProvider backed by a mock filesystem.
 * Pass config overrides via the second argument to customise the config
 * for a specific test.
 *
 * Cleanup is automatic — an `afterEach` hook is registered that unmounts
 * the Ink instance and restores the mock filesystem. Tests do not need to
 * call cleanup() or fsState.restore() manually.
 */
export function renderInk(
  tree: ReactElement,
  config: RenderInkConfig = {},
): InkRenderResult {
  const fsState = mockConfig({
    global: config.global ?? {},
    ...(config.local && { local: config.local }),
  });

  // Captures the live config value and reload function from context on every render.
  // Initialized synchronously by ConfigCapture during inkRender, so always set before return.
  let capturedConfig: Config;
  let capturedReload: () => void;

  /** Invisible component that captures the current context config and reload fn. */
  function ConfigCapture() {
    const { config: currentConfig, reload } = useConfig();
    capturedConfig = currentConfig;
    capturedReload = reload;
    return null;
  }

  const result = inkRender(
    <ConfigProvider>
      {tree}
      <ConfigCapture />
    </ConfigProvider>,
  );
  const originalWrite = result.stdin.write;

  /* v8 ignore next 4 -- afterEach runs outside test scope so coverage never sees it */
  afterEach(() => {
    result.cleanup();
    fsState.restore();
  });

  return {
    lastFrame: result.lastFrame,
    frames: result.frames,
    rerender: result.rerender,
    unmount: result.unmount,
    cleanup: result.cleanup,
    fsState,
    getConfig: () => capturedConfig,
    async reloadConfig() {
      capturedReload();
      await flushInkFrames();
    },
    stdin: {
      async write(data: string) {
        originalWrite(data);
        await flushInkFrames();
      },
    },
  };
}
