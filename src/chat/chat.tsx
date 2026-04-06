import { Box, Text } from "ink";
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
import { executeToolCalls } from "../tools/execute-tool-calls";
import type { ToolRegistry } from "../tools/registry";
import type { ToolContext } from "../tools/types";
import { AskPrompt } from "../ui/ask-prompt";
import { AppHeader } from "../ui/app-header";
import { ConfirmPrompt } from "../ui/confirm-prompt";
import { DiffView } from "../ui/diff-view";
import { Indent } from "../ui/layout/indent";
import { LoadingIndicator } from "../ui/loading-indicator";
import { version } from "../utils/version";
import type { AutocompleteItem } from "./autocomplete";
import { ChatInput } from "./chat-input";
import { ChatList, LiveAssistantMessage, LiveToolOutput } from "./chat-list";
import type { ChatMessage } from "./message";
import { MessageHistory } from "./message-history";
import { useCompletion } from "./use-completion";
import { useHistory } from "./use-history";

/** Maximum number of nudge retries when the LLM returns an empty response. */
const MAX_EMPTY_RETRIES = 3;

/** Nudge message sent to the LLM when it returns an empty response. */
const EMPTY_NUDGE_CONTENT =
  "Your previous response was empty. Continue working on the task. If you need to use a tool, call it now. If you are done, summarize what was accomplished.";

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
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const completion = useCompletion(provider, model, contextWindow);
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    diff?: string;
  } | null>(null);
  const confirmResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const [pendingAsk, setPendingAsk] = useState<{
    question: string;
    options?: string[];
  } | null>(null);
  const askResolveRef = useRef<((answer: string | null) => void) | null>(null);
  const sessionPath = useRef(createSessionPath());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const permissionsRef = useRef(config.permissions);
  permissionsRef.current = config.permissions;
  const allowedCommandsRef = useRef(config.allowedCommands);
  allowedCommandsRef.current = config.allowedCommands;
  const [liveToolOutput, setLiveToolOutput] = useState<string | null>(null);
  const handledStateRef = useRef<string | null>(null);
  const emptyRetryRef = useRef(0);

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
  // Guard against duplicate handling: other deps (e.g. completion.send) can
  // change without a real state transition, so skip if we already handled this state.
  useEffect(() => {
    if (
      completion.state === "idle" ||
      completion.state === "streaming" ||
      completion.state === handledStateRef.current
    ) {
      return;
    }
    handledStateRef.current = completion.state;

    if (completion.state === "complete") {
      if (completion.toolCalls.length > 0) {
        // Execute tool calls and send results back for another completion round.
        // Reset handled state and empty retry counter so the next transition is processed.
        handledStateRef.current = null;
        emptyRetryRef.current = 0;
        (async () => {
          const registry = props.toolRegistry;
          const toolContext: ToolContext = {
            permissions: permissionsRef.current,
            allowedCommands: allowedCommandsRef.current,
            confirm: (message, options) =>
              new Promise<boolean>((resolve) => {
                confirmResolveRef.current = resolve;
                setPendingConfirm({ message, diff: options?.diff });
              }),
            ask: (question, options) =>
              new Promise<string | null>((resolve) => {
                askResolveRef.current = resolve;
                setPendingAsk({ question, options });
              }),
            onProgress: (output) => setLiveToolOutput(output),
            signal: new AbortController().signal,
          };

          const newMessages = await executeToolCalls(
            completion.toolCalls,
            completion.content,
            registry,
            toolContext,
            appendMessage,
          );
          setLiveToolOutput(null);

          const allMessages = [...messagesRef.current, ...newMessages];
          const systemPrompt = buildSystemPrompt();
          const providerMessages = buildProviderMessages(
            allMessages,
            systemPrompt,
          );
          completion.send({
            messages: providerMessages,
            tools: registry.getDefinitions(),
          });
        })();
        return;
      }

      // Nudge the LLM if it returned an empty response (no content, no tool calls).
      if (
        !completion.content.trim() &&
        emptyRetryRef.current < MAX_EMPTY_RETRIES
      ) {
        emptyRetryRef.current++;
        appendMessage({
          id: crypto.randomUUID(),
          role: "info",
          content: "Model returned an empty response, nudging to continue…",
        });
        handledStateRef.current = null;
        const systemPrompt = buildSystemPrompt();
        const providerMessages = buildProviderMessages(
          messagesRef.current,
          systemPrompt,
        );
        providerMessages.push({ role: "user", content: EMPTY_NUDGE_CONTENT });
        const defs = props.toolRegistry.getDefinitions();
        completion.send({
          messages: providerMessages,
          tools: defs.length > 0 ? defs : undefined,
        });
        return;
      }

      if (completion.content) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: completion.content,
        });
      } else {
        appendMessage({
          id: crypto.randomUUID(),
          role: "info",
          content:
            "Model returned empty responses after multiple attempts. Try sending another message.",
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
    handledStateRef.current = null;
    emptyRetryRef.current = 0;
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

  /** Resolves the pending confirm prompt and clears it. */
  function handleConfirmResult(approved: boolean) {
    confirmResolveRef.current?.(approved);
    confirmResolveRef.current = null;
    setPendingConfirm(null);
  }

  /** Resolves the pending ask prompt and clears it. */
  function handleAskResult(answer: string | null) {
    askResolveRef.current?.(answer);
    askResolveRef.current = null;
    setPendingAsk(null);
  }

  /** Whether the assistant is currently streaming a response. */
  const isStreaming = completion.state === "streaming";

  return {
    config,
    mode,
    history,
    messages,
    sessionKey,
    pendingConfirm,
    isStreaming,
    streamingContent: completion.content,
    liveToolOutput,
    abort: completion.abort,
    autocompleteItems,
    buildCommandContext,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
    handleConfirmResult,
    pendingAsk,
    handleAskResult,
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
    pendingConfirm,
    isStreaming,
    streamingContent,
    liveToolOutput,
    abort,
    autocompleteItems,
    buildCommandContext,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
    handleConfirmResult,
    pendingAsk,
    handleAskResult,
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
        {liveToolOutput && <LiveToolOutput output={liveToolOutput} />}
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
        {liveToolOutput && <LiveToolOutput output={liveToolOutput} />}
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
      {liveToolOutput && <LiveToolOutput output={liveToolOutput} />}
      {pendingConfirm && (
        <>
          {pendingConfirm.diff && (
            <Box paddingBottom={1}>
              <Indent>
                <DiffView output={pendingConfirm.diff} />
              </Indent>
            </Box>
          )}
          <Box paddingBottom={1}>
            <Indent>
              <Text dimColor>Awaiting approval</Text>
            </Indent>
          </Box>
          <ConfirmPrompt onResult={handleConfirmResult} />
        </>
      )}
      {pendingAsk && (
        <AskPrompt
          question={pendingAsk.question}
          options={pendingAsk.options}
          onResult={handleAskResult}
        />
      )}
      {!pendingConfirm && !pendingAsk && (
        <ChatInput
          onMessage={handleMessage}
          onUp={handleUp}
          onAbort={isStreaming ? abort : undefined}
          initialValue={mode.initialValue}
          hasHistory={history.entries.length > 0}
          autocompleteItems={autocompleteItems}
        />
      )}
    </>
  );
}
