import { McpAuthCancelledError } from "./errors";

/** Parameters describing an in-flight MCP OAuth authorization prompt. */
export interface McpAuthParams {
  /** Name of the MCP server that is driving the user through the flow. */
  serverName: string;
  /** Authorization URL the user should visit in their browser. */
  authUrl: string;
}

/** A pending auth prompt as rendered in the chat UI. */
export interface McpAuthPending extends McpAuthParams {
  /** Unique identifier, used to resolve or dismiss the entry. */
  id: string;
}

/** Handle returned from `push`, letting the producer await the user's response. */
export interface McpAuthPushHandle {
  /** Identifier of the pushed entry. */
  id: string;
  /**
   * Resolves with the authorization code when the user pastes a valid
   * callback URL into the modal. Rejects with `McpAuthCancelledError` when
   * the user cancels. Stays pending forever if the entry is dismissed
   * without being resolved or cancelled — callers that race this against
   * another source should drop their reference after the race settles.
   */
  pending: Promise<string>;
}

/** Store of pending MCP OAuth prompts, modelled on the chat prompt queue. */
export interface McpAuthStore {
  /** Pushes a new pending entry and returns the id plus a promise to await the result. */
  push(params: McpAuthParams): McpAuthPushHandle;
  /** Removes an entry from the queue without settling its pending promise. */
  dismiss(id: string): void;
  /**
   * Resolves the entry's pending promise with the authorization code
   * extracted from the pasted callback URL. No-op if the id is unknown.
   */
  resolveWithCode(id: string, code: string): void;
  /**
   * Rejects the entry's pending promise with `McpAuthCancelledError`. Used
   * when the user hits Esc on the modal.
   */
  cancel(id: string): void;
  /** Returns the front-of-queue entry, or null if empty. */
  peek(): McpAuthPending | null;
  /** Returns the current queue length. */
  size(): number;
  /** Subscribes to queue changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** Internal entry shape that also carries the promise's resolve/reject hooks. */
interface InternalEntry extends McpAuthPending {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
}

/** Creates a new in-memory MCP auth store. */
export function createMcpAuthStore(): McpAuthStore {
  const entries: InternalEntry[] = [];
  const listeners = new Set<() => void>();

  /** Notifies all subscribers that the queue changed. */
  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  /** Removes the entry with the given id and returns it, or undefined. */
  function takeEntry(id: string): InternalEntry | undefined {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) return undefined;
    const [entry] = entries.splice(index, 1);
    return entry;
  }

  return {
    push(params) {
      const id = crypto.randomUUID();
      let resolve!: (code: string) => void;
      let reject!: (error: Error) => void;
      const pending = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      entries.push({
        id,
        serverName: params.serverName,
        authUrl: params.authUrl,
        resolve,
        reject,
      });
      notify();
      return { id, pending };
    },

    dismiss(id) {
      const removed = takeEntry(id);
      if (removed) notify();
    },

    resolveWithCode(id, code) {
      const entry = takeEntry(id);
      if (!entry) return;
      entry.resolve(code);
      notify();
    },

    cancel(id) {
      const entry = takeEntry(id);
      if (!entry) return;
      entry.reject(new McpAuthCancelledError(entry.serverName));
      notify();
    },

    peek() {
      // Return the internal entry directly (not a fresh projection) so
      // `useSyncExternalStore` sees a stable snapshot reference and does
      // not re-render on every tick. `InternalEntry` is a subtype of
      // `McpAuthPending`, so the extra `resolve`/`reject` fields are
      // simply invisible to callers that use the declared type.
      return entries[0] ?? null;
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
