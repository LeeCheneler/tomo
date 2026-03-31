import { useRef, useState } from "react";
import { useTextInput } from "../input/text";

/** Props for the useChatInput hook. */
export interface ChatInputHookOptions {
  /** Called when the user submits a message. */
  onMessage: (message: string) => void;
}

/** Return value of the useChatInput hook. */
export interface ChatInputHookResult {
  /** Current input value. */
  value: string;
  /** Handler for input value changes. */
  onChange: (value: string) => void;
  /** Handler for input submission. */
  onSubmit: (value: string) => void;
  /** Handler for up arrow at cursor boundary. */
  onUp: () => void;
  /** Handler for down arrow at cursor boundary. */
  onDown: () => void;
  /** Status text for the input border. */
  statusText: string;
  /** Current cursor position for rendering. */
  cursor: number;
}

/** Manages chat input state, submission, and history. */
export function useChatInput(
  options: ChatInputHookOptions,
): ChatInputHookResult {
  const [value, setValue] = useState("");
  // Ref keeps value fresh across batched React updates so submit
  // always sees the latest input even before re-render.
  const valueRef = useRef("");

  /** Updates value in both state (for rendering) and ref (for callbacks). */
  function handleChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
  }

  /** Submits the current value if non-empty, then clears the input. */
  function handleSubmit() {
    const current = valueRef.current;
    if (current.trim() === "") {
      return;
    }
    options.onMessage(current);
    valueRef.current = "";
    setValue("");
  }

  const { cursor } = useTextInput({
    value,
    onChange: handleChange,
    onSubmit: handleSubmit,
    lineMode: "multi",
  });

  return {
    value,
    onChange: handleChange,
    onSubmit: handleSubmit,
    onUp: () => {},
    onDown: () => {},
    statusText: "",
    cursor,
  };
}
