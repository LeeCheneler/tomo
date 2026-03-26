import chalk from "chalk";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useRef, useState } from "react";
import { getAllCommands } from "../commands";
import {
  type AutocompleteProvider,
  useAutocomplete,
} from "../hooks/use-autocomplete";
import {
  detectImagePath,
  type ImageAttachment,
  readClipboardImage,
} from "../images";
import { getAllSkills } from "../skills";

interface ChatInputProps {
  onSubmit: (text: string, clipboardImages?: ImageAttachment[]) => void;
  disabled?: boolean;
  hidden?: boolean;
  onEscape?: () => void;
  onTab?: () => void;
  contextPercent?: number | null;
  pendingMessage?: string | null;
  onCancelPending?: () => void;
  inputHistory?: string[];
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
  hidden,
  onEscape,
  onTab,
  contextPercent,
  pendingMessage,
  onCancelPending,
  inputHistory = [],
}: ChatInputProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout.columns || 80);
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef<string | null>(null);
  const [exitWarning, setExitWarning] = useState(false);
  const [clipboardImages, setClipboardImages] = useState<ImageAttachment[]>([]);
  const [imageNavActive, setImageNavActive] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // Refs track the real value/cursor across React batched updates (paste bursts).
  const valueRef = useRef(value);
  const cursorRef = useRef(cursor);
  valueRef.current = value;
  cursorRef.current = cursor;

  useEffect(() => {
    const onResize = () => setColumns(stdout.columns || 80);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const totalImages = clipboardImages.length;

  const autocomplete = useAutocomplete(defaultProviders, value, cursor);
  const { active: isAutocomplete, ghost, showGhost } = autocomplete;

  useInput(
    (input, key) => {
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
        if (value || clipboardImages.length > 0) {
          setValue("");
          setCursor(0);
          setClipboardImages([]);
          setImageNavActive(false);
          setSelectedImageIdx(0);
          return;
        }
        setExitWarning(true);
        return;
      }

      if (exitWarning) {
        setExitWarning(false);
      }

      // Image navigation mode — intercept keys before normal handling
      if (imageNavActive) {
        if (key.upArrow || key.escape) {
          setImageNavActive(false);
          return;
        }
        if (key.leftArrow) {
          setSelectedImageIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (key.rightArrow) {
          setSelectedImageIdx((i) => Math.min(totalImages - 1, i + 1));
          return;
        }
        if (key.delete || key.backspace) {
          setClipboardImages((prev) =>
            prev.filter((_, i) => i !== selectedImageIdx),
          );
          const newTotal = totalImages - 1;
          if (newTotal === 0) {
            setImageNavActive(false);
            setSelectedImageIdx(0);
          } else {
            setSelectedImageIdx((i) => Math.min(i, newTotal - 1));
          }
          return;
        }
        // Ignore all other keys in image nav mode
        return;
      }

      // Pending message shortcut — up arrow loads queued message into input
      if (pendingMessage && !value && key.upArrow) {
        onCancelPending?.();
        setValue(pendingMessage);
        setCursor(pendingMessage.length);
        // Set history index so the next up arrow skips past this entry.
        const lastIdx = inputHistory.lastIndexOf(pendingMessage);
        historyIndexRef.current = lastIdx >= 0 ? lastIdx : inputHistory.length;
        return;
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

      // Ctrl+V: paste image from system clipboard
      if (input === "v" && key.ctrl) {
        const img = readClipboardImage();
        if (img) {
          setClipboardImages((prev) => [...prev, img]);
        }
        return;
      }

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

      // Vertical cursor movement — autocomplete, multi-line, or input history
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
          return;
        }
        // On first line — go to start of line first, then recall history
        if (cursor > 0) {
          setCursor(0);
          return;
        }
        if (inputHistory.length > 0) {
          // Save current input as draft when first entering history
          if (historyIndexRef.current === -1) {
            draftRef.current = value;
          }
          const nextIdx =
            historyIndexRef.current === -1
              ? inputHistory.length - 1
              : Math.max(0, historyIndexRef.current - 1);
          historyIndexRef.current = nextIdx;
          setValue(inputHistory[nextIdx]);
          setCursor(inputHistory[nextIdx].length);
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
          return;
        }
        // On last line — go to end of line first, then history/image nav
        if (cursor < value.length) {
          setCursor(value.length);
          return;
        }
        if (historyIndexRef.current >= 0) {
          const nextIdx = historyIndexRef.current + 1;
          if (nextIdx >= inputHistory.length) {
            // Restore saved draft or clear input
            historyIndexRef.current = -1;
            const draft = draftRef.current ?? "";
            draftRef.current = null;
            setValue(draft);
            setCursor(draft.length);
          } else {
            historyIndexRef.current = nextIdx;
            setValue(inputHistory[nextIdx]);
            setCursor(inputHistory[nextIdx].length);
          }
          return;
        }
        if (totalImages > 0) {
          setImageNavActive(true);
          setSelectedImageIdx(0);
        }
        return;
      }

      // Cursor navigation
      if (key.leftArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.rightArrow) {
        if (isAutocomplete && autocomplete.submitValue && showGhost) {
          const accepted = `${autocomplete.submitValue} `;
          setValue(accepted);
          setCursor(accepted.length);
          return;
        }
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
          historyIndexRef.current = -1;
          draftRef.current = null;
          if (clipboardImages.length > 0) {
            onSubmit(autocomplete.submitValue, clipboardImages);
          } else {
            onSubmit(autocomplete.submitValue);
          }
          setValue("");
          setCursor(0);
          setClipboardImages([]);
        } else if (value.trim() || clipboardImages.length > 0) {
          historyIndexRef.current = -1;
          draftRef.current = null;
          if (clipboardImages.length > 0) {
            onSubmit(value, clipboardImages);
          } else {
            onSubmit(value);
          }
          setValue("");
          setCursor(0);
          setClipboardImages([]);
        }
        return;
      }

      // Delete previous word: Ctrl+Backspace, Option+Backspace, Ctrl+W
      // Ink maps \x08 (Ctrl+Backspace) to key.backspace, \x7f (regular Backspace)
      // to key.delete, and \x1b\x7f (Option+Backspace) to key.delete + key.meta.
      if (
        key.backspace ||
        (key.delete && (key.ctrl || key.meta)) ||
        (input === "w" && key.ctrl)
      ) {
        if (cursor > 0) {
          const boundary = findPrevWordBoundary(value, cursor);
          setValue((v) => v.slice(0, boundary) + v.slice(cursor));
          setCursor(boundary);
        }
        return;
      }

      if (key.delete) {
        if (cursor > 0) {
          setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
          setCursor((c) => c - 1);
        }
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        // Use refs to get the real accumulated value during paste bursts
        // (React batches setValue calls, so the closure `value` may be stale).
        const prev = valueRef.current;
        const cur = cursorRef.current;
        const newValue = prev.slice(0, cur) + input + prev.slice(cur);
        const newCursor = cur + input.length;

        // Auto-detect pasted image file paths (e.g. Cmd+V of a file from Finder)
        const detected = detectImagePath(newValue);
        if (detected) {
          const prefix = newValue.slice(0, detected.pathStart).trimEnd();
          setValue(prefix);
          setCursor(prefix.length);
          setClipboardImages((prev) => [...prev, detected.attachment]);
          valueRef.current = prefix;
          cursorRef.current = prefix.length;
        } else {
          setValue(newValue);
          setCursor(newCursor);
          valueRef.current = newValue;
          cursorRef.current = newCursor;
        }
      }
    },
    {
      isActive: !hidden,
    },
  );

  if (hidden) return null;

  // Build input display as a single string so newlines render correctly
  const before = value.slice(0, cursor);
  const after = cursor < value.length ? value.slice(cursor + 1) : "";
  const prompt = chalk.dim(disabled ? "  " : "> ");

  let inputDisplay: string;
  if (disabled) {
    inputDisplay = value;
  } else if (imageNavActive) {
    // No cursor highlight when navigating images
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

  // Build image tags for the bottom bar
  const maxVisible = 5;
  let imageDisplayStr = "";
  let imagePlainWidth = 0;

  if (totalImages > 0) {
    // Determine visible window
    let start = 0;
    let end = Math.min(totalImages, maxVisible);

    if (imageNavActive && selectedImageIdx >= end) {
      end = Math.min(totalImages, selectedImageIdx + 1);
      start = Math.max(0, end - maxVisible);
    }

    const showLeading = start > 0;
    const showTrailing = end < totalImages;

    const parts: string[] = [];
    imagePlainWidth = 2; // leading ──

    if (showLeading) {
      parts.push("...");
      imagePlainWidth += 3;
    }

    for (let i = start; i < end; i++) {
      const label = `[Img ${i + 1}]`;
      imagePlainWidth += label.length;
      parts.push(
        imageNavActive && i === selectedImageIdx
          ? chalk.bgWhite.black(label)
          : label,
      );
    }

    if (showTrailing) {
      parts.push("...");
      imagePlainWidth += 3;
    }

    imageDisplayStr = `──${parts.join("")}`;
  }

  const bottomLineWidth = Math.max(
    0,
    columns - 2 - imagePlainWidth - contextLabel.length,
  );

  // Hint text below the bottom bar
  let hintText: string | null = null;
  if (imageNavActive) {
    hintText = "  ↑ input  ←→ select  ⌫ remove";
  } else if (totalImages > 0 && !disabled) {
    hintText = "  ↓ images";
  }

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
        {imageDisplayStr}
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
      {hintText ? <Text dimColor>{hintText}</Text> : null}
      {exitWarning ? (
        <Text dimColor>{"  Ctrl+C again to close Tomo"}</Text>
      ) : null}
    </Box>
  );
}
