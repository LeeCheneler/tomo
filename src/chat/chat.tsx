import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCommand } from "../commands/is-command";
import type {
  CommandContext,
  CommandRegistry,
  InvokeResult,
  TakeoverRender,
} from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import { useConfig } from "../config/hook";
import type { ToolDefinition } from "../provider/client";
import { DEFAULT_CONTEXT_WINDOW } from "../provider/client";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";
import { buildProviderMessages } from "../provider/messages";
import { buildSystemPrompt } from "../prompt/build-system-prompt";
import {
  appendSessionMessage,
  createSessionPath,
  readSessionMessages,
} from "../session/session";
import type { ToolRegistry } from "../tools/registry";
import type { ToolContext } from "../tools/types";
import { parseToolArgs } from "../tools/types";
import { AppHeader } from "../ui/app-header";
import { LoadingIndicator } from "../ui/loading-indicator";
import { version } from "../utils/version";
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
  toolRegistry: ToolRegistry;
}

/** Manages mode switching between input, history, and takeover screens. */
function useChat(props: UseChatProps) {
  const { config } = useConfig();
  const provider =
    config.providers.find((p) => p.name === config.activeProvider) ?? null;
  const model = config.activeModel ?? null;

  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const completion = useCompletion(provider, model);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());
  const sessionPath = useRef(createSessionPath());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Fetch the real context window size when provider/model are configured
  useEffect(() => {
    if (!provider || !model) return;
    const client = createOpenAICompatibleClient(provider);
    client.fetchContextWindow(model).then(setContextWindow);
  }, [provider, model]);

  /** Appends a message to the chat list and writes it to the session file. */
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    appendSessionMessage(sessionPath.current, msg);
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

  /** Returns tool definitions from the registry, or undefined if none. */
  function getToolDefinitions(): ToolDefinition[] | undefined {
    const defs = props.toolRegistry.getDefinitions();
    return defs.length > 0 ? defs : undefined;
  }

  // When streaming completes, handle tool calls or append the final response.
  useEffect(() => {
    if (completion.state === "complete") {
      if (completion.toolCalls.length > 0) {
        // Execute tool calls and send results back for another completion round.
        (async () => {
          const registry = props.toolRegistry;
          const toolContext: ToolContext = {
            permissions: config.permissions,
            /* v8 ignore start -- placeholder until interactive confirm UI is built */
            confirm: async () => true,
            /* v8 ignore stop */
            signal: new AbortController().signal,
          };

          // Build messages locally since React state updates from appendMessage
          // won't be reflected in messagesRef until the next render.
          const newMessages: ChatMessage[] = [];

          const toolCallMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "tool-call",
            content: completion.content,
            toolCalls: completion.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              displayName:
                registry.get(tc.function.name)?.displayName ?? tc.function.name,
              arguments: tc.function.arguments,
            })),
          };
          appendMessage(toolCallMsg);
          newMessages.push(toolCallMsg);

          for (const tc of completion.toolCalls) {
            const tool = registry.get(tc.function.name);
            if (!tool) {
              const resultMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "tool-result",
                toolCallId: tc.id,
                toolName: tc.function.name,
                output: `Unknown tool: ${tc.function.name}`,
              };
              appendMessage(resultMsg);
              newMessages.push(resultMsg);
              continue;
            }

            let output: string;
            try {
              const parsed = parseToolArgs(
                tool.argsSchema,
                tc.function.arguments,
              );
              const result = await tool.execute(parsed, toolContext);
              output = result.output;
            } catch (e) {
              /* v8 ignore start -- non-Error throws are unlikely but handled */
              output = `Tool error: ${e instanceof Error ? e.message : "unknown error"}`;
              /* v8 ignore stop */
            }

            const resultMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "tool-result",
              toolCallId: tc.id,
              toolName: tc.function.name,
              output,
            };
            appendMessage(resultMsg);
            newMessages.push(resultMsg);
          }

          const allMessages = [...messagesRef.current, ...newMessages];
          const systemPrompt = buildSystemPrompt();
          const providerMessages = buildProviderMessages(
            allMessages,
            systemPrompt,
          );
          const defs = registry.getDefinitions();
          completion.send({
            messages: providerMessages,
            tools: defs.length > 0 ? defs : undefined,
          });
        })();
        return;
      }
      if (completion.content) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: completion.content,
        });
      }
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
  }, [
    completion.state,
    completion.content,
    completion.error,
    completion.toolCalls,
    completion.send,
    appendMessage,
    props.toolRegistry,
    config.permissions,
  ]);

  /** Builds the current command context for handler and takeover commands. */
  function buildCommandContext(): CommandContext {
    return {
      usage: completion.usage,
      contextWindow,
      resetSession: () => {
        process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
        setMessages([]);
        sessionPath.current = createSessionPath();
        setSessionKey(crypto.randomUUID());
      },
      loadSession: (path) => {
        process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
        setMessages(readSessionMessages(path));
        sessionPath.current = path;
        setSessionKey(crypto.randomUUID());
      },
    };
  }

  /** Handles submitted input — dispatches commands or creates user messages. */
  async function handleMessage(message: string) {
    const commandRegistry = props.commandRegistry ?? createCommandRegistry();
    if (isCommand(message)) {
      const context = buildCommandContext();
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
    completion.send({
      messages: providerMessages,
      tools: getToolDefinitions(),
    });
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
    config,
    mode,
    history,
    messages,
    sessionKey,
    isStreaming,
    streamingContent: completion.content,
    abort: completion.abort,
    autocompleteItems,
    buildCommandContext,
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
  toolRegistry: ToolRegistry;
}

/** Chat router — renders ChatInput, MessageHistory, or takeover content based on mode. */
export function Chat(props: ChatProps) {
  const {
    config,
    mode,
    history,
    messages,
    sessionKey,
    isStreaming,
    streamingContent,
    abort,
    autocompleteItems,
    buildCommandContext,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
  } = useChat({
    commandRegistry: props.commandRegistry,
    toolRegistry: props.toolRegistry,
  });

  /* v8 ignore start -- streaming persists across mode changes but testing all combinations is impractical */
  if (mode.kind === "takeover") {
    return (
      <>
        <ChatList
          key={sessionKey}
          messages={messages}
          header={
            <AppHeader
              version={version}
              model={config.activeModel}
              provider={config.activeProvider}
            />
          }
        />
        {isStreaming && <LiveAssistantMessage content={streamingContent} />}
        {isStreaming && <LoadingIndicator text="Thinking" />}
        {mode.render(handleTakeoverDone, buildCommandContext())}
      </>
    );
  }

  if (mode.kind === "history") {
    return (
      <>
        <ChatList
          key={sessionKey}
          messages={messages}
          header={
            <AppHeader
              version={version}
              model={config.activeModel}
              provider={config.activeProvider}
            />
          }
        />
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
      <ChatList
        key={sessionKey}
        messages={messages}
        header={
          <AppHeader
            version={version}
            model={config.activeModel}
            provider={config.activeProvider}
          />
        }
      />
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
