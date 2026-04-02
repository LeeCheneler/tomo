import { useState } from "react";
import { isCommand } from "../commands/is-command";
import type { CommandRegistry } from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import { ChatInput } from "./chat-input";
import { ChatList } from "./chat-list";
import type { ChatMessage } from "./message";
import { MessageHistory } from "./message-history";
import { useHistory } from "./use-history";

/** Chat mode — either typing input or browsing history. */
type ChatMode = { kind: "input"; initialValue?: string } | { kind: "history" };

/** Props for useChat. */
interface UseChatProps {
  commandRegistry?: CommandRegistry;
}

/** Manages mode switching between input and history. */
function useChat(props: UseChatProps) {
  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /** Appends a message to the chat list. */
  function appendMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  /** Handles submitted input — dispatches commands or creates user messages. */
  async function handleMessage(message: string) {
    const commandRegistry = props.commandRegistry ?? createCommandRegistry();
    if (isCommand(message)) {
      appendMessage(await commandRegistry.invoke(message));
      return;
    }

    appendMessage({ id: crypto.randomUUID(), role: "user", content: message });
    history.push(message);
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

  return {
    mode,
    history,
    messages,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
  };
}

/** Props for Chat. */
interface ChatProps {
  commandRegistry?: CommandRegistry;
}

/** Chat router — renders ChatInput or MessageHistory based on mode. */
export function Chat(props: ChatProps) {
  const {
    mode,
    history,
    messages,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
  } = useChat({ commandRegistry: props.commandRegistry });

  if (mode.kind === "history") {
    return (
      <>
        <ChatList messages={messages} />
        <MessageHistory
          entries={history.entries}
          onSelected={handleSelected}
          onExit={handleExit}
        />
      </>
    );
  }

  return (
    <>
      <ChatList messages={messages} />
      <ChatInput
        onMessage={handleMessage}
        onUp={handleUp}
        initialValue={mode.initialValue}
        hasHistory={history.entries.length > 0}
      />
    </>
  );
}
