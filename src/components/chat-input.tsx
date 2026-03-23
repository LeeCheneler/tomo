import { useEffect, useState } from "react";
import chalk from "chalk";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { getAllCommands } from "../commands";
import {
  type AutocompleteProvider,
  useAutocomplete,
} from "../hooks/use-autocomplete";
import { getAllSkills } from "../skills";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  onEscape?: () => void;
  onTab?: () => void;
  contextPercent?: number | null;
}

const commandProvider: AutocompleteProvider = {
  prefix: "/",
  items: () =>
    getAllCommands().map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
    })),
};

const skillProvider: AutocompleteProvider = {
  prefix: "//",
  items: () =>
    getAllSkills().map((s) => ({
      name: s.name,
      description: s.description,
    })),
};

const defaultProviders: AutocompleteProvider[] = [
  commandProvider,
  skillProvider,
];

function findPrevWordBoundary(text: string, pos: number): number {
  let i = pos - 1;
  while (i > 0 && /\s/.test(text[i])) i--;
  while (i > 0 && !/\s/.test(text[i - 1])) i--;
  return Math.max(0, i);
}

function findNextWordBoundary(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && /\s/.test(text[i])) i++;
  while (i < text.length && !/\s/.test(text[i])) i++;
  return i;
}

/** Text input with cursor navigation, slash command autocomplete, and Ctrl+C confirmation. */
export function ChatInput({
  onSubmit,
  disabled,
  onEscape,
  onTab,
  contextPercent,
}: ChatInputProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout.columns || 80);
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [exitWarning, setExitWarning] = useState(false);

  useEffect(() => {
    const onResize = () => setColumns(stdout.columns || 80);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const autocomplete = useAutocomplete(defaultProviders, value, cursor);
  const { active: isAutocomplete, ghost, showGhost } = autocomplete;

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
        setCursor(0);
        return;
      }
      setExitWarning(true);
      return;
    }

    if (exitWarning) {
      setExitWarning(false);
    }

    if (key.escape) {
      onEscape?.();
      return;
    }

    if (key.tab) {
      onTab?.();
      return;
    }

    if (disabled) return;

    // Word-skip: Option/Alt+Arrow or Alt+B/F
    if (key.leftArrow && key.meta) {
      setCursor((c) => findPrevWordBoundary(value, c));
      return;
    }
    if (key.rightArrow && key.meta) {
      setCursor((c) => findNextWordBoundary(value, c));
      return;
    }
    if (input === "b" && key.meta) {
      setCursor((c) => findPrevWordBoundary(value, c));
      return;
    }
    if (input === "f" && key.meta) {
      setCursor((c) => findNextWordBoundary(value, c));
      return;
    }

    // Vertical cursor movement — autocomplete navigation or multi-line movement
    if (key.upArrow) {
      if (isAutocomplete && autocomplete.visibleEntries.length > 0) {
        autocomplete.moveUp();
        return;
      }
      const lineStart = value.lastIndexOf("\n", cursor - 1);
      if (lineStart >= 0) {
        const col = cursor - lineStart - 1;
        const prevLineStart =
          lineStart === 0 ? 0 : value.lastIndexOf("\n", lineStart - 1) + 1;
        const prevLineLength = lineStart - prevLineStart;
        setCursor(prevLineStart + Math.min(col, prevLineLength));
      }
      return;
    }
    if (key.downArrow) {
      if (isAutocomplete && autocomplete.visibleEntries.length > 0) {
        autocomplete.moveDown();
        return;
      }
      const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
      const col = cursor - lineStart;
      const nextLineBreak = value.indexOf("\n", cursor);
      if (nextLineBreak >= 0) {
        const nextLineStart = nextLineBreak + 1;
        const nextNextLineBreak = value.indexOf("\n", nextLineStart);
        const nextLineLength =
          nextNextLineBreak >= 0
            ? nextNextLineBreak - nextLineStart
            : value.length - nextLineStart;
        setCursor(nextLineStart + Math.min(col, nextLineLength));
      }
      return;
    }

    // Cursor navigation
    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
      return;
    }
    if (input === "a" && key.ctrl) {
      setCursor(0);
      return;
    }
    if (input === "e" && key.ctrl) {
      setCursor(value.length);
      return;
    }

    if (key.return) {
      if (key.shift) {
        setValue((v) => `${v.slice(0, cursor)}\n${v.slice(cursor)}`);
        setCursor((c) => c + 1);
      } else if (isAutocomplete && autocomplete.submitValue) {
        onSubmit(autocomplete.submitValue);
        setValue("");
        setCursor(0);
      } else if (value.trim()) {
        onSubmit(value);
        setValue("");
        setCursor(0);
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => c - 1);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v.slice(0, cursor) + input + v.slice(cursor));
      setCursor((c) => c + input.length);
    }
  });

  // Build input display as a single string so newlines render correctly
  const before = value.slice(0, cursor);
  const after = cursor < value.length ? value.slice(cursor + 1) : "";
  const prompt = chalk.dim(disabled ? "  " : "> ");

  let inputDisplay: string;
  if (disabled) {
    inputDisplay = value;
  } else {
    const charAtCursor = cursor < value.length ? value[cursor] : null;
    const cursorStr =
      charAtCursor === "\n"
        ? `${chalk.inverse(" ")}\n`
        : charAtCursor !== null
          ? chalk.inverse(charAtCursor)
          : showGhost
            ? chalk.inverse(ghost[0])
            : chalk.inverse(" ");
    inputDisplay = before + cursorStr + after;
    if (showGhost) {
      inputDisplay += chalk.dim(ghost.slice(1));
    }
  }

  const hasContext = contextPercent != null;
  const dividerColor =
    hasContext && contextPercent >= 90
      ? "red"
      : hasContext && contextPercent >= 80
        ? "yellow"
        : undefined;
  const dividerDim = !dividerColor;

  const contextLabel = hasContext
    ? ` ${Math.round(contextPercent)}% context `
    : "";
  const topLineWidth = columns - 2;
  const bottomLineWidth = Math.max(0, columns - 2 - contextLabel.length);

  return (
    <Box flexDirection="column">
      <Text dimColor={dividerDim} color={dividerColor}>
        {"─".repeat(topLineWidth)}
      </Text>
      <Text>
        {prompt}
        {inputDisplay}
      </Text>
      <Text dimColor={dividerDim} color={dividerColor}>
        {"─".repeat(bottomLineWidth)}
        {contextLabel}
      </Text>
      {isAutocomplete && autocomplete.visibleEntries.length > 0 ? (
        <Box flexDirection="column">
          {(() => {
            const maxName = Math.max(
              ...autocomplete.visibleEntries.map((e) => e.name.length),
            );
            return autocomplete.visibleEntries.map((entry, i) => {
              const selected = i === autocomplete.visibleSelectedIndex;
              const desc =
                entry.description.length > 50
                  ? `${entry.description.slice(0, 49)}…`
                  : entry.description;
              return (
                <Box key={entry.name}>
                  <Text bold color="cyan" dimColor={!selected}>
                    {"  "}
                    {entry.name.padEnd(maxName)}
                  </Text>
                  <Text dimColor>
                    {"  "}
                    {desc}
                  </Text>
                </Box>
              );
            });
          })()}
        </Box>
      ) : null}
      {exitWarning ? (
        <Text dimColor>{"  Ctrl+C again to close Tomo"}</Text>
      ) : null}
    </Box>
  );
}
