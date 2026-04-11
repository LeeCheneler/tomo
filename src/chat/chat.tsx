import { Box, Text } from "ink";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isCommand } from "../commands/is-command";
import type { ImageAttachment } from "../images/clipboard";
import { useMcp } from "../mcp/use-mcp";
import { isSkill, parseSkillInput } from "../skills/utils";
import type { SkillRegistry } from "../skills/registry";
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
import {
  buildToolCallInfos,
  executeToolCalls,
} from "../tools/execute-tool-calls";
import type { ToolRegistry } from "../tools/registry";
import type { ToolContext } from "../tools/types";
import { AskPrompt } from "../ui/ask-prompt";
import { AppHeader } from "../ui/app-header";
import { ConfirmPrompt } from "../ui/confirm-prompt";
import { DiffView } from "../ui/diff-view";
import { Indent } from "../ui/layout/indent";
import { LoadingIndicator } from "../ui/loading-indicator";
import { theme } from "../ui/theme";
import { version } from "../utils/version";
import type { AutocompleteItem } from "./autocomplete";
import { ChatInput } from "./chat-input";
import { ChatList, LiveAssistantMessage, LiveToolOutput } from "./chat-list";
import type { ChatMessage, ToolCallInfo } from "./message";
import { MessageHistory } from "./message-history";
import { openPager } from "./open-pager";
import { createPromptQueue } from "./prompt-queue";
import { renderMessagesForPager } from "./render-pager";
import { useCompletion } from "./use-completion";
import type { HistoryEntry } from "./use-history";
import { useHistory } from "./use-history";

/** Maximum number of nudge retries when the LLM returns an empty response. */
const MAX_EMPTY_RETRIES = 3;

/** Nudge message sent to the LLM when it returns an empty response. */
const EMPTY_NUDGE_CONTENT =
  "Your previous response was empty. Continue working on the task. If you need to use a tool, call it now. If you are done, summarize what was accomplished.";

/** Chat mode — typing input, browsing history, or a takeover screen. */
type ChatMode =
  | { kind: "input"; initialValue?: string; initialImages?: ImageAttachment[] }
  | { kind: "history" }
  | { kind: "takeover"; name: string; render: TakeoverRender };

/** Props for useChat. */
interface UseChatProps {
  commandRegistry?: CommandRegistry;
  skillRegistry: SkillRegistry;
  toolRegistry: ToolRegistry;
}

/** Manages mode switching between input, history, and takeover screens. */
function useChat(props: UseChatProps) {
  const { config } = useConfig();
  // Memoize provider to maintain a stable reference — .find() creates a new
  // object each render, which would cascade into useCompletion recreating its
  // send callback and re-triggering the completion effect on every render.
  const provider = useMemo(
    () =>
      config.providers.find((p) => p.name === config.activeProvider) ?? null,
    [config.providers, config.activeProvider],
  );
  const model = config.activeModel ?? null;

  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const completion = useCompletion(provider, model, contextWindow);
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());
  const promptQueueRef = useRef(createPromptQueue());
  const currentPrompt = useSyncExternalStore(
    promptQueueRef.current.subscribe,
    promptQueueRef.current.peek,
  );
  const sessionPath = useRef(createSessionPath());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const permissionsRef = useRef(config.permissions);
  permissionsRef.current = config.permissions;
  const allowedCommandsRef = useRef(config.allowedCommands);
  allowedCommandsRef.current = config.allowedCommands;
  const webSearchApiKeyRef = useRef(config.tools.webSearch.apiKey);
  webSearchApiKeyRef.current = config.tools.webSearch.apiKey;
  const contextWindowRef = useRef(contextWindow);
  contextWindowRef.current = contextWindow;
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCallInfo[]>([]);
  const [liveToolOutputs, setLiveToolOutputs] = useState<Map<string, string>>(
    () => new Map(),
  );
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

  // Owns the MCP server lifecycle for the chat session. Surfaces connection
  // failures as inline error messages so the user knows when a configured
  // server didn't come up.
  const handleMcpConnectionError = useCallback(
    (serverName: string, error: string) => {
      appendMessage({
        id: crypto.randomUUID(),
        role: "error",
        content: `MCP server "${serverName}" failed to connect: ${error}`,
      });
    },
    [appendMessage],
  );
  useMcp({
    toolRegistry: props.toolRegistry,
    onConnectionError: handleMcpConnectionError,
  });

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
        // A `complete` state with tool calls only fires after a successful
        // request, which means provider and model must have been set when
        // the request went out. If they've been cleared since (via a settings
        // change mid-flight), treat it as a soft error and stop.
        if (!provider || !model) {
          appendMessage({
            id: crypto.randomUUID(),
            role: "error",
            content: "Provider or model is no longer configured.",
          });
          return;
        }
        // Execute tool calls and send results back for another completion round.
        // Reset handled state and empty retry counter so the next transition is processed.
        handledStateRef.current = null;
        emptyRetryRef.current = 0;
        (async () => {
          const registry = props.toolRegistry;
          const queue = promptQueueRef.current;
          const toolContext: ToolContext = {
            permissions: permissionsRef.current,
            allowedCommands: allowedCommandsRef.current,
            webSearchApiKey: webSearchApiKeyRef.current,
            confirm: (message, options) =>
              queue.enqueueConfirm(message, options),
            ask: (question, options) => queue.enqueueAsk(question, options),
            signal: new AbortController().signal,
            provider,
            model,
            contextWindow: contextWindowRef.current,
            depth: 0,
          };

          // Show tool calls in the dynamic area while executing.
          setLiveToolCalls(buildToolCallInfos(completion.toolCalls, registry));

          /** Creates a scoped onProgress callback for each tool call. */
          const createOnProgress = (toolCallId: string) => (output: string) => {
            setLiveToolOutputs((prev) => new Map(prev).set(toolCallId, output));
          };

          /** Removes a tool call ID from the dynamic area state. */
          function removeLiveTool(toolCallId: string) {
            setLiveToolCalls((prev) =>
              prev.filter((tc) => tc.id !== toolCallId),
            );
            setLiveToolOutputs((prev) => {
              const next = new Map(prev);
              next.delete(toolCallId);
              return next;
            });
          }

          /** Hoists a completed tool from the dynamic area to Static. */
          const onToolComplete = (
            toolCallId: string,
            callMsg: ChatMessage,
            resultMsg: ChatMessage,
          ) => {
            appendMessage(callMsg);
            appendMessage(resultMsg);
            removeLiveTool(toolCallId);
          };

          const newMessages = await executeToolCalls(
            completion.toolCalls,
            completion.content,
            registry,
            toolContext,
            createOnProgress,
            onToolComplete,
          );

          // All tools are done — clear any remaining dynamic state.
          setLiveToolCalls([]);
          setLiveToolOutputs(new Map());

          // messagesRef isn't updated until the next render, so manually
          // compose the full history for the provider.
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
    provider,
    model,
  ]);

  /** Builds the current command context for handler and takeover commands. */
  function buildCommandContext(): CommandContext {
    return {
      usage: completion.usage,
      contextWindow,
      resetSession: () => {
        /* v8 ignore next -- terminal escape sequences don't run in test environments */
        if (process.stdout.isTTY) process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
        setMessages([]);
        sessionPath.current = createSessionPath();
        setSessionKey(crypto.randomUUID());
      },
      loadSession: (path) => {
        /* v8 ignore next -- terminal escape sequences don't run in test environments */
        if (process.stdout.isTTY) process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
        setMessages(readSessionMessages(path));
        sessionPath.current = path;
        setSessionKey(crypto.randomUUID());
      },
    };
  }

  /** Handles submitted input — dispatches commands, skills, or creates user messages. */
  async function handleMessage(message: string, images: ImageAttachment[]) {
    // Clear any stale `initialValue` left on mode by a history recall or
    // draft restore; otherwise it would re-hydrate the input if a prompt
    // overlay (ask/confirm) unmounted ChatInput and it then remounted.
    setMode({ kind: "input" });
    const commandRegistry = props.commandRegistry ?? createCommandRegistry();
    if (isCommand(message)) {
      const context = buildCommandContext();
      handleInvokeResult(await commandRegistry.invoke(message, context));
      return;
    }

    // Skill invocations emit a skill message (+ optional user message) instead
    // of a single combined user message, so the chat list renders them distinctly.
    if (isSkill(message)) {
      const parsed = parseSkillInput(message);
      const skill = props.skillRegistry.get(parsed.name);
      if (!skill) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "error",
          content: `Unknown skill: ${parsed.name}`,
        });
        return;
      }
      const skillContent = `<skill name="${skill.name}">\n${skill.content}\n</skill>`;
      appendMessage({
        id: crypto.randomUUID(),
        role: "skill",
        skillName: skill.name,
        content: skillContent,
      });
      if (parsed.userText) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "user",
          content: parsed.userText,
          images,
        });
      }
      history.push({ text: message, images });
      const systemPrompt = buildSystemPrompt();
      const providerMessages = buildProviderMessages(
        messagesRef.current,
        systemPrompt,
      );
      handledStateRef.current = null;
      emptyRetryRef.current = 0;
      completion.send({
        messages: providerMessages,
        tools: getToolDefinitions(),
      });
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      images,
    };
    appendMessage(userMsg);
    history.push({ text: message, images });

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
  function handleSelected(entry: HistoryEntry) {
    setDraft("");
    setMode({
      kind: "input",
      initialValue: entry.text,
      initialImages: entry.images,
    });
  }

  /** Returns to input mode with the saved draft restored. */
  function handleExit() {
    setMode({ kind: "input", initialValue: draft });
  }

  /** Maps registry commands to autocomplete items. */
  const commandAutocompleteItems: readonly AutocompleteItem[] = useMemo(() => {
    const registry = props.commandRegistry ?? createCommandRegistry();
    return registry.list().map((cmd) => ({
      key: cmd.name,
      name: cmd.name,
      description: cmd.description,
    }));
  }, [props.commandRegistry]);

  /** Maps skill registry to autocomplete items, tagging locals when clashes exist. */
  const skillAutocompleteItems: readonly AutocompleteItem[] = useMemo(() => {
    const registry = props.skillRegistry;
    return registry.list().map((skill) => {
      const desc =
        skill.description.length > 60
          ? `${skill.description.slice(0, 57)}...`
          : skill.description;
      return {
        key: `${skill.name}:${skill.source}`,
        name: skill.name,
        description: desc,
        tag:
          skill.source === "local" && registry.hasClash(skill.name)
            ? "(local)"
            : undefined,
      };
    });
  }, [props.skillRegistry]);

  /** Renders the current conversation and pipes it to the system pager. */
  function handlePager() {
    openPager(renderMessagesForPager(messagesRef.current));
  }

  /** Resolves the front confirm prompt and advances the queue. */
  function handleConfirmResult(approved: boolean) {
    promptQueueRef.current.resolveConfirm(approved);
  }

  /** Resolves the front ask prompt and advances the queue. */
  function handleAskResult(answer: string | null) {
    promptQueueRef.current.resolveAsk(answer);
  }

  /** Whether the assistant is currently streaming a response. */
  const isStreaming = completion.state === "streaming";

  return {
    config,
    mode,
    history,
    messages,
    sessionKey,
    currentPrompt,
    isStreaming,
    streamingContent: completion.content,
    liveToolCalls,
    liveToolOutputs,
    abort: completion.abort,
    commandAutocompleteItems,
    skillAutocompleteItems,
    buildCommandContext,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
    handleConfirmResult,
    handleAskResult,
    handlePager,
  };
}

/** Props for Chat. */
interface ChatProps {
  commandRegistry?: CommandRegistry;
  skillRegistry: SkillRegistry;
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
    currentPrompt,
    isStreaming,
    streamingContent,
    liveToolCalls,
    liveToolOutputs,
    abort,
    commandAutocompleteItems,
    skillAutocompleteItems,
    buildCommandContext,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
    handleConfirmResult,
    handleAskResult,
    handlePager,
  } = useChat({
    commandRegistry: props.commandRegistry,
    skillRegistry: props.skillRegistry,
    toolRegistry: props.toolRegistry,
  });

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
      {liveToolCalls.map((tc) => {
        const output = liveToolOutputs.get(tc.id);
        return (
          <Box key={tc.id} flexDirection="column">
            <Indent>
              <LoadingIndicator text={tc.displayName} color={theme.tool} />
              {tc.summary ? <Text dimColor> {tc.summary}</Text> : null}
            </Indent>
            {output !== undefined && <LiveToolOutput output={output} />}
          </Box>
        );
      })}
      {mode.kind === "takeover" &&
        mode.render(handleTakeoverDone, buildCommandContext())}
      {mode.kind === "history" && (
        <MessageHistory
          entries={history.entries}
          onSelected={handleSelected}
          onExit={handleExit}
        />
      )}
      {mode.kind === "input" && currentPrompt?.kind === "confirm" && (
        <>
          {currentPrompt.diff && (
            <Box paddingBottom={1}>
              <Indent>
                <DiffView output={currentPrompt.diff} />
              </Indent>
            </Box>
          )}
          <ConfirmPrompt
            key={currentPrompt.id}
            onResult={handleConfirmResult}
            label={currentPrompt.label ?? currentPrompt.message}
            detail={currentPrompt.detail}
          />
        </>
      )}
      {mode.kind === "input" && currentPrompt?.kind === "ask" && (
        <AskPrompt
          key={currentPrompt.id}
          question={currentPrompt.question}
          options={currentPrompt.options}
          onResult={handleAskResult}
        />
      )}
      {mode.kind === "input" && !currentPrompt && (
        <ChatInput
          onMessage={handleMessage}
          onUp={handleUp}
          onAbort={isStreaming ? abort : undefined}
          onPager={messages.length > 0 ? handlePager : undefined}
          initialValue={mode.initialValue}
          initialImages={mode.initialImages}
          hasHistory={history.entries.length > 0}
          commandAutocompleteItems={commandAutocompleteItems}
          skillAutocompleteItems={skillAutocompleteItems}
        />
      )}
    </>
  );
}
