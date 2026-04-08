import type { ConfirmOptions } from "../tools/types";

/** A queued confirmation prompt. */
export interface ConfirmEntry {
  kind: "confirm";
  message: string;
  diff?: string;
  label?: string;
  detail?: string;
  resolve: (approved: boolean) => void;
}

/** A queued question prompt. */
export interface AskEntry {
  kind: "ask";
  question: string;
  options?: string[];
  resolve: (answer: string | null) => void;
}

/** A queued prompt entry — either a confirm or an ask. */
export type PromptEntry = ConfirmEntry | AskEntry;

/** Callback notified when the queue changes. */
type Listener = () => void;

/**
 * FIFO queue for user prompts (confirmations and questions).
 *
 * Multiple tool executions (including parallel tools and sub-agents)
 * can enqueue prompts concurrently. The UI pops the front entry, shows
 * it to the user, and resolves it before advancing to the next.
 */
export interface PromptQueue {
  /** Enqueues a confirm prompt. Returns a promise that resolves when the user responds. */
  enqueueConfirm: (
    message: string,
    options?: ConfirmOptions,
  ) => Promise<boolean>;
  /** Enqueues an ask prompt. Returns a promise that resolves when the user responds. */
  enqueueAsk: (question: string, options?: string[]) => Promise<string | null>;
  /** Returns the front-of-queue entry, or null if empty. */
  peek: () => PromptEntry | null;
  /** Resolves the front confirm entry and advances to the next. */
  resolveConfirm: (approved: boolean) => void;
  /** Resolves the front ask entry and advances to the next. */
  resolveAsk: (answer: string | null) => void;
  /** Returns the current queue length. */
  size: () => number;
  /** Subscribes to queue changes. Returns an unsubscribe function. */
  subscribe: (listener: Listener) => () => void;
}

/** Creates a new prompt queue. */
export function createPromptQueue(): PromptQueue {
  const entries: PromptEntry[] = [];
  const listeners = new Set<Listener>();

  /** Notifies all subscribers that the queue changed. */
  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    enqueueConfirm(message, options) {
      return new Promise<boolean>((resolve) => {
        entries.push({
          kind: "confirm",
          message,
          diff: options?.diff,
          label: options?.label,
          detail: options?.detail,
          resolve,
        });
        notify();
      });
    },

    enqueueAsk(question, options) {
      return new Promise<string | null>((resolve) => {
        entries.push({ kind: "ask", question, options, resolve });
        notify();
      });
    },

    peek() {
      return entries[0] ?? null;
    },

    resolveConfirm(approved) {
      const front = entries[0];
      if (!front || front.kind !== "confirm") return;
      entries.shift();
      front.resolve(approved);
      notify();
    },

    resolveAsk(answer) {
      const front = entries[0];
      if (!front || front.kind !== "ask") return;
      entries.shift();
      front.resolve(answer);
      notify();
    },

    size() {
      return entries.length;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
