import { useState } from "react";
import { ChatInput } from "./chat-input";
import { MessageHistory } from "./message-history";
import { useHistory } from "./use-history";

/** Chat mode — either typing input or browsing history. */
type ChatMode = { kind: "input"; initialValue?: string } | { kind: "history" };

/** Manages mode switching between input and history. */
function useChat() {
  const history = useHistory();
  const [mode, setMode] = useState<ChatMode>({ kind: "input" });

  /** Pushes a message to history (called on submit). */
  function handleMessage(message: string) {
    history.push(message);
  }

  /** Switches to history mode if there are entries. */
  function handleUp() {
    if (history.entries.length > 0) {
      setMode({ kind: "history" });
    }
  }

  /** Returns to input mode with the selected entry for editing. */
  function handleSelected(entry: string) {
    setMode({ kind: "input", initialValue: entry });
  }

  /** Returns to input mode with empty input. */
  function handleExit() {
    setMode({ kind: "input" });
  }

  return { mode, history, handleMessage, handleUp, handleSelected, handleExit };
}

/** Chat router — renders ChatInput or MessageHistory based on mode. */
export function Chat() {
  const { mode, history, handleMessage, handleUp, handleSelected, handleExit } =
    useChat();

  if (mode.kind === "history") {
    return (
      <MessageHistory
        entries={history.entries}
        onSelected={handleSelected}
        onExit={handleExit}
      />
    );
  }

  return (
    <ChatInput
      onMessage={handleMessage}
      onUp={handleUp}
      initialValue={mode.initialValue}
    />
  );
}
