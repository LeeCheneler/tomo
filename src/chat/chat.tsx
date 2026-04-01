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
  const [draft, setDraft] = useState("");

  /** Pushes a message to history (called on submit). */
  function handleMessage(message: string) {
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
    handleMessage,
    handleUp,
    handleSelected,
    handleExit,
  };
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
      hasHistory={history.entries.length > 0}
    />
  );
}
