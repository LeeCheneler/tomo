import { useMemo, useState } from "react";
import { isCommand } from "../commands/is-command";
import type {
  CommandRegistry,
  InvokeResult,
  TakeoverRender,
} from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import type { AutocompleteItem } from "./autocomplete";
import { ChatInput } from "./chat-input";
import { ChatList } from "./chat-list";
import type { ChatMessage } from "./message";
import { MessageHistory } from "./message-history";
import { useHistory } from "./use-history";

/** Chat mode — typing input, browsing history, or a takeover screen. */
type ChatMode =
  | { kind: "input"; initialValue?: string }
  | { kind: "history" }
  | { kind: "takeover"; name: string; render: TakeoverRender };

/** Props for useChat. */
interface UseChatProps {
  commandRegistry?: CommandRegistry;
}

/** Manages mode switching between input, history, and takeover screens. */
function useChat(props: UseChatProps) {
  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /** Appends a message to the chat list. */
  function appendMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

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

  /** Handles submitted input — dispatches commands or creates user messages. */
  async function handleMessage(message: string) {
    const commandRegistry = props.commandRegistry ?? createCommandRegistry();
    if (isCommand(message)) {
      handleInvokeResult(await commandRegistry.invoke(message));
      return;
    }

    appendMessage({ id: crypto.randomUUID(), role: "user", content: message });
    history.push(message);
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

  return {
    mode,
    history,
    messages,
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
}

/** Chat router — renders ChatInput, MessageHistory, or takeover content based on mode. */
export function Chat(props: ChatProps) {
  const {
    mode,
    history,
    messages,
    autocompleteItems,
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
    handleTakeoverDone,
  } = useChat({ commandRegistry: props.commandRegistry });

  if (mode.kind === "takeover") {
    return (
      <>
        <ChatList messages={messages} />
        {mode.render(handleTakeoverDone)}
      </>
    );
  }

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
        autocompleteItems={autocompleteItems}
      />
    </>
  );
}
