import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { getAllCommands } from "../commands";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  onEscape?: () => void;
}

const MAX_SUGGESTIONS = 5;

/** Text input with Enter to submit, slash command autocomplete, and Escape to cancel. */
export function ChatInput({ onSubmit, disabled, onEscape }: ChatInputProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout.columns || 80);
  const [value, setValue] = useState("");
  const [exitWarning, setExitWarning] = useState(false);

  useEffect(() => {
    const onResize = () => setColumns(stdout.columns || 80);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const isAutocomplete = value.startsWith("/") && !value.includes(" ");
  const partial = isAutocomplete ? value.slice(1) : "";
  const matches = isAutocomplete
    ? getAllCommands()
        .filter((cmd) => cmd.name.startsWith(partial))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const topMatch = matches[0];
  const ghost =
    topMatch && partial.length > 0
      ? topMatch.name.slice(partial.length)
      : topMatch
        ? topMatch.name
        : "";

  useInput((input, key) => {
    const isCtrlC = input === "c" && key.ctrl;

    if (isCtrlC) {
      if (exitWarning) {
        exit();
        return;
      }
      if (disabled) {
        setExitWarning(true);
        return;
      }
      if (value) {
        setValue("");
        return;
      }
      setExitWarning(true);
      return;
    }

    // Any other input dismisses the exit warning
    if (exitWarning) {
      setExitWarning(false);
    }

    if (key.escape) {
      onEscape?.();
      return;
    }

    if (disabled) return;

    if (key.return) {
      if (key.shift) {
        setValue((v) => `${v}\n`);
      } else if (isAutocomplete && topMatch) {
        onSubmit(`/${topMatch.name}`);
        setValue("");
      } else if (value.trim()) {
        onSubmit(value);
        setValue("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{"─".repeat(columns - 2)}</Text>
      <Box>
        <Text dimColor>{disabled ? "  " : "> "}</Text>
        <Text>{value}</Text>
        {isAutocomplete && ghost ? <Text dimColor>{ghost}</Text> : null}
      </Box>
      <Text dimColor>{"─".repeat(columns - 2)}</Text>
      {isAutocomplete && matches.length > 0 ? (
        <Box flexDirection="column">
          {matches.map((cmd, i) => (
            <Text
              key={cmd.name}
              color={i === 0 ? "cyan" : undefined}
              dimColor={i !== 0}
            >
              {"  "}
              {`/${cmd.name}`} — {cmd.description}
            </Text>
          ))}
        </Box>
      ) : null}
      {exitWarning ? (
        <Text dimColor>{"  Ctrl+C again to close Tomo"}</Text>
      ) : null}
    </Box>
  );
}
