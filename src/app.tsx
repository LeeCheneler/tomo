import { useMemo } from "react";
import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { Box, Static, Text } from "ink";
import "./commands";
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import { Header } from "./components/header";
import { completePartialMarkdown, renderMarkdown } from "./components/markdown";
import type { DisplayMessage } from "./components/message-list";
import { Message } from "./components/message-list";
import { ThinkingIndicator } from "./components/thinking-indicator";
import { getActiveProvider, loadConfig } from "./config";
import { useChat } from "./hooks/use-chat";
import { loadInstructions } from "./instructions";
import { createSession } from "./session";
import { getAllTools, resolveToolAvailability } from "./tools";

const config = loadConfig();
const initialProvider = getActiveProvider(config);
const initialSession = createSession(initialProvider.name, config.activeModel);
const instructions = loadInstructions();

/** Build startup warnings for enabled tools that are misconfigured. */
function getToolWarnings(): string[] {
  const availability = resolveToolAvailability(config.tools);
  const warnings: string[] = [];
  for (const tool of getAllTools()) {
    if (availability[tool.name] && tool.warning) {
      const msg = tool.warning();
      if (msg) warnings.push(`${tool.name}: ${msg}`);
    }
  }
  return warnings;
}

const startupWarnings = getToolWarnings();

type StaticItem =
  | { type: "header"; id: string }
  | { type: "warning"; id: string; text: string }
  | (DisplayMessage & { type?: undefined });

interface AppProps {
  onRestart: () => void;
}

/** Root application component. Renders the chat UI and delegates state to useChat. */
export function App({ onRestart }: AppProps) {
  const chat = useChat(
    config,
    initialProvider,
    config.activeModel,
    initialSession,
    instructions,
    onRestart,
  );

  const headerItem = useMemo(
    (): StaticItem => ({ type: "header", id: "__header__" }),
    [],
  );
  const warningItems = useMemo(
    (): StaticItem[] =>
      startupWarnings.map((text, i) => ({
        type: "warning" as const,
        id: `__warning_${i}__`,
        text,
      })),
    [],
  );
  const staticItems: StaticItem[] = [
    headerItem,
    ...warningItems,
    ...chat.messages,
  ];

  const handleTab = () => {
    if (chat.messages.length === 0) return;
    const parts = chat.messages.map((msg) => {
      if (msg.role === "user") {
        return chalk.bgGray.white(msg.content);
      }
      if (msg.role === "assistant") {
        return msg.content ? renderMarkdown(msg.content) : "";
      }
      if (msg.role === "tool") {
        const lines = msg.content.split("\n");
        const header = lines[0] ?? "";
        const body = lines.slice(1).join("\n");
        return body ? `${header}\n${chalk.dim(body)}` : header;
      }
      return chalk.cyan(msg.content);
    });
    const content = parts.filter(Boolean).join("\n\n");
    const ALLOWED_PAGERS = new Set(["less", "more", "most", "bat", "cat"]);
    const pager = process.env.PAGER || "less";
    if (!ALLOWED_PAGERS.has(pager)) {
      return;
    }
    spawnSync(pager, ["-R", "+G"], {
      input: content,
      stdio: ["pipe", "inherit", "inherit"],
    });
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Static items={staticItems}>
        {(item) => {
          if (item.type === "header") {
            return (
              <Box key={item.id} flexDirection="column">
                <Header
                  model={chat.activeModel}
                  provider={chat.activeProvider.name}
                />
              </Box>
            );
          }
          if (item.type === "warning") {
            return (
              <Box key={item.id}>
                <Text color="yellow">{`  ⚠ ${item.text}`}</Text>
              </Box>
            );
          }
          return (
            <Box key={item.id} flexDirection="column" marginBottom={1}>
              <Message msg={item} />
            </Box>
          );
        }}
      </Static>

      {chat.streaming && chat.streamingContent ? (
        <Box flexDirection="column" marginBottom={1}>
          {chat.toolActive ? (
            <Text dimColor>{chat.streamingContent}</Text>
          ) : (
            <AssistantMessage>
              {completePartialMarkdown(chat.streamingContent)}
            </AssistantMessage>
          )}
        </Box>
      ) : null}

      {chat.error ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">{`Error: ${chat.error}`}</Text>
        </Box>
      ) : null}

      {chat.pendingMessage ? (
        <Box marginBottom={1}>
          <Text>
            <Text color="yellow" bold>
              {"Queued: "}
            </Text>
            <Text backgroundColor="gray" color="white">
              {chat.pendingMessage}
            </Text>
          </Text>
        </Box>
      ) : null}

      {chat.streaming && !chat.streamingContent && !chat.activeCommand ? (
        <ThinkingIndicator />
      ) : null}

      {chat.activeCommand}
      <ChatInput
        onSubmit={chat.submit}
        onEscape={chat.cancel}
        onTab={chat.messages.length > 0 ? handleTab : undefined}
        hidden={!!chat.activeCommand}
        contextPercent={
          chat.tokenUsage
            ? ((chat.tokenUsage.promptTokens +
                chat.tokenUsage.completionTokens) /
                chat.contextWindow) *
              100
            : null
        }
      />
    </Box>
  );
}
