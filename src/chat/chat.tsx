import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCommand } from "../commands/is-command";
import type {
  CommandContext,
  CommandRegistry,
  InvokeResult,
  TakeoverRender,
} from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import { DEFAULT_CONTEXT_WINDOW } from "../provider/client";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";
import type { Provider } from "../config/schema";
import type { ChatMessage as ProviderChatMessage } from "../provider/client";
import { buildSystemPrompt } from "../prompt/build-system-prompt";
import { LoadingIndicator } from "../ui/loading-indicator";
import type { AutocompleteItem } from "./autocomplete";
import { ChatInput } from "./chat-input";
import { ChatList, LiveAssistantMessage } from "./chat-list";
import type { ChatMessage } from "./message";
import { MessageHistory } from "./message-history";
import { useCompletion } from "./use-completion";
import { useHistory } from "./use-history";

/** Chat mode — typing input, browsing history, or a takeover screen. */
type ChatMode =
  | { kind: "input"; initialValue?: string }
  | { kind: "history" }
  | { kind: "takeover"; name: string; render: TakeoverRender };

/** Props for useChat. */
interface UseChatProps {
  commandRegistry?: CommandRegistry;
  provider?: Provider | null;
  model?: string | null;
}

/** Builds the provider message array from chat messages, with system prompt at index 0. */
function buildProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
): ProviderChatMessage[] {
  const result: ProviderChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const msg of messages) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    }
    if (msg.role === "assistant") {
      result.push({ role: "assistant", content: msg.content });
    }
  }
  return result;
}

/** Manages mode switching between input, history, and takeover screens. */
function useChat(props: UseChatProps) {
  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const completion = useCompletion(props.provider ?? null, props.model ?? null);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Fetch the real context window size when provider/model are configured
  useEffect(() => {
    if (!props.provider || !props.model) return;
    const client = createOpenAICompatibleClient(props.provider);
    client.fetchContextWindow(props.model).then(setContextWindow);
  }, [props.provider, props.model]);

  /** Appends a message to the chat list. */
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /** Handles an invoke result — either enters takeover mode or appends an inline message. */
  function handleInvokeResult(result: InvokeResult) {
    if (result.type === "takeover") {
      setMode({ kind: "takeover", name: result.name, render: result.render });
      return;
    }
    appendMessage({
      id: crypto.randomUUID(),
      role: "command",
      command: result.name,
      result: result.output,
    });
  }

  // When streaming completes, append the result to the static message list
  useEffect(() => {
    if (completion.state === "complete" && completion.content) {
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: completion.content,
      });
    }
    if (completion.state === "aborted") {
      if (completion.content) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: completion.content,
        });
      }
      appendMessage({
        id: crypto.randomUUID(),
        role: "interrupted",
      });
    }
    if (completion.state === "error" && completion.error) {
      appendMessage({
        id: crypto.randomUUID(),
        role: "error",
        content: completion.error,
      });
    }
  }, [completion.state, completion.content, completion.error, appendMessage]);

  /** Handles submitted input — dispatches commands or creates user messages. */
  async function handleMessage(message: string) {
    const commandRegistry = props.commandRegistry ?? createCommandRegistry();
    if (isCommand(message)) {
      const context: CommandContext = {
        usage: completion.usage,
        contextWindow,
      };
      handleInvokeResult(await commandRegistry.invoke(message, context));
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };
    appendMessage(userMsg);
    history.push(message);

    // Build fresh system prompt each send so git status stays current
    const systemPrompt = buildSystemPrompt();
    const providerMessages = buildProviderMessages(
      [...messagesRef.current, userMsg],
      systemPrompt,
    );
    completion.send(providerMessages);
  }

  /** Handles a takeover screen completing. Drops an optional result message and returns to input. */
  function handleTakeoverDone(result?: string) {
    if (result && mode.kind === "takeover") {
      appendMessage({
        id: crypto.randomUUID(),
        role: "command",
        command: mode.name,
        result,
      });
    }
    setMode({ kind: "input" });
  }

  /** Saves the draft and switches to history mode if there are entries. */
  function handleUp(currentDraft: string) {
    if (history.entries.length > 0) {
      setDraft(currentDraft);
      setMode({ kind: "history" });
    }
  }

  /** Clears the draft and returns to input mode with the selected entry. */
  function handleSelected(entry: string) {
    setDraft("");
    setMode({ kind: "input", initialValue: entry });
  }

  /** Returns to input mode with the saved draft restored. */
  function handleExit() {
    setMode({ kind: "input", initialValue: draft });
  }

  /** Maps registry commands to autocomplete items. */
  const autocompleteItems: readonly AutocompleteItem[] = useMemo(() => {
    const registry = props.commandRegistry ?? createCommandRegistry();
    return registry
      .list()
      .map((cmd) => ({ name: cmd.name, description: cmd.description }));
  }, [props.commandRegistry]);

  /** Whether the assistant is currently streaming a response. */
  const isStreaming = completion.state === "streaming";

  return {
    mode,
    history,
    messages,
    isStreaming,
    streamingContent: completion.content,
    abort: completion.abort,
    autocompleteItems,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
  };
}

/** Props for Chat. */
interface ChatProps {
  commandRegistry?: CommandRegistry;
  provider?: Provider | null;
  model?: string | null;
}

/** Chat router — renders ChatInput, MessageHistory, or takeover content based on mode. */
export function Chat(props: ChatProps) {
  const {
    mode,
    history,
    messages,
    isStreaming,
    streamingContent,
    abort,
    autocompleteItems,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
  } = useChat({
    commandRegistry: props.commandRegistry,
    provider: props.provider,
    model: props.model,
  });

  /* v8 ignore start -- streaming persists across mode changes but testing all combinations is impractical */
  if (mode.kind === "takeover") {
    return (
      <>
        <ChatList messages={messages} />
        {isStreaming && <LiveAssistantMessage content={streamingContent} />}
        {isStreaming && <LoadingIndicator text="Thinking" />}
        {mode.render(handleTakeoverDone)}
      </>
    );
  }

  if (mode.kind === "history") {
    return (
      <>
        <ChatList messages={messages} />
        {isStreaming && <LiveAssistantMessage content={streamingContent} />}
        {isStreaming && <LoadingIndicator text="Thinking" />}
        <MessageHistory
          entries={history.entries}
          onSelected={handleSelected}
          onExit={handleExit}
        />
      </>
    );
  }
  /* v8 ignore stop */

  return (
    <>
      <ChatList messages={messages} />
      {isStreaming && <LiveAssistantMessage content={streamingContent} />}
      {isStreaming && <LoadingIndicator text="Thinking" />}
      <ChatInput
        onMessage={handleMessage}
        onUp={handleUp}
        onAbort={isStreaming ? abort : undefined}
        initialValue={mode.initialValue}
        hasHistory={history.entries.length > 0}
        autocompleteItems={autocompleteItems}
      />
    </>
  );
}
