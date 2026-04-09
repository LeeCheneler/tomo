import { Text, useInput } from "ink";
import { useRef, useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** A boolean toggle field. */
export interface ToggleFormField {
  type: "toggle";
  key: string;
  label: string;
  initialValue: boolean;
}

/** A single-line text input field. */
export interface TextFormField {
  type: "text";
  key: string;
  label: string;
  initialValue: string;
}

/** A select field that cycles through a list of string options. */
export interface SelectFormField {
  type: "select";
  key: string;
  label: string;
  options: readonly string[];
  initialValue: string;
}

/** A key-value record field. Edited via a sub-screen, opened with Tab. */
export interface KvFormField {
  type: "kv";
  key: string;
  label: string;
  initialValue: Record<string, string>;
}

/** A field in a form. Discriminate on `type`. */
export type FormField =
  | ToggleFormField
  | TextFormField
  | SelectFormField
  | KvFormField;

/** Values collected from form fields, keyed by field key. */
export type FormValues = Record<
  string,
  boolean | string | Record<string, string>
>;

/** Props for Form. */
export interface FormProps {
  /** Field definitions to render. */
  fields: readonly FormField[];
  /** Called with current values when the user presses Enter. */
  onSubmit: (values: FormValues) => void;
  /** Called when the user presses Escape. */
  onCancel: () => void;
  /** Called when the user presses Tab on a kv field, with the field key and the current values. */
  onOpenField?: (key: string, values: FormValues) => void;
  /** Color for the cursor indicator. Defaults to theme.brand. */
  color?: string;
}

/** Builds initial values from field definitions. */
function buildInitialValues(fields: readonly FormField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    values[field.key] = field.initialValue;
  }
  return values;
}

/** Manages form field navigation, values, and text editing. */
function useForm(props: FormProps) {
  const [cursor, setCursor] = useState(0);
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(props.fields),
  );
  const [textCursor, setTextCursor] = useState(() => {
    const first = props.fields[0];
    return first?.type === "text" ? first.initialValue.length : 0;
  });

  // Refs mirror state for immediate access in useInput callbacks,
  // avoiding stale closures during rapid sequential keypresses.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const textCursorRef = useRef(textCursor);
  textCursorRef.current = textCursor;

  /** Updates a single field value in both ref and state. */
  function updateValue(key: string, value: boolean | string) {
    const next = { ...valuesRef.current, [key]: value };
    valuesRef.current = next;
    setValues(next);
  }

  /** Updates the text cursor position in both ref and state. */
  function moveTextCursor(pos: number) {
    textCursorRef.current = pos;
    setTextCursor(pos);
  }

  useInput((input, key) => {
    if (props.fields.length === 0) return;

    if (key.escape) {
      props.onCancel();
      return;
    }

    if (key.return) {
      props.onSubmit(valuesRef.current);
      return;
    }

    if (key.upArrow) {
      const count = props.fields.length;
      setCursor((i) => {
        const next = (i - 1 + count) % count;
        const nextField = props.fields[next];
        if (nextField.type === "text") {
          const val = valuesRef.current[nextField.key] as string;
          moveTextCursor(val.length);
        }
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setCursor((i) => {
        const next = (i + 1) % props.fields.length;
        const nextField = props.fields[next];
        if (nextField.type === "text") {
          const val = valuesRef.current[nextField.key] as string;
          moveTextCursor(val.length);
        }
        return next;
      });
      return;
    }

    const field = props.fields[cursor];

    if (field.type === "toggle" && input === " ") {
      updateValue(field.key, !(valuesRef.current[field.key] as boolean));
      return;
    }

    if (field.type === "select") {
      const current = valuesRef.current[field.key] as string;
      const idx = field.options.indexOf(current);
      if (key.leftArrow) {
        const next = (idx - 1 + field.options.length) % field.options.length;
        updateValue(field.key, field.options[next]);
      }
      if (key.rightArrow) {
        const next = (idx + 1) % field.options.length;
        updateValue(field.key, field.options[next]);
      }
      return;
    }

    if (field.type === "kv") {
      if (key.tab) {
        props.onOpenField?.(field.key, valuesRef.current);
      }
      return;
    }

    const value = valuesRef.current[field.key] as string;
    const edit = processTextEdit(input, key, value, textCursorRef.current);
    if (edit) {
      if (edit.value !== value) {
        updateValue(field.key, edit.value);
      }
      moveTextCursor(edit.cursor);
    }
  });

  return { cursor, values, textCursor };
}

/** Generic form with navigable toggle, select, and text fields. */
export function Form(props: FormProps) {
  const { cursor, values, textCursor } = useForm(props);
  const color = props.color ?? theme.brand;

  return (
    <>
      {props.fields.map((field, i) => {
        const isSelected = i === cursor;

        if (field.type === "toggle") {
          const checked = values[field.key] as boolean;
          return (
            <Indent key={field.key}>
              <Text color={isSelected ? color : undefined}>
                {isSelected ? "❯" : " "}{" "}
              </Text>
              <Text dimColor>[</Text>
              {checked ? (
                <Text color={theme.success}>✓</Text>
              ) : (
                <Text dimColor> </Text>
              )}
              <Text dimColor>]</Text>
              <Text color={isSelected ? color : undefined}> {field.label}</Text>
            </Indent>
          );
        }

        if (field.type === "select") {
          const selected = values[field.key] as string;
          return (
            <Indent key={field.key}>
              <Text color={isSelected ? color : undefined}>
                {isSelected ? "❯" : " "}{" "}
              </Text>
              <Text color={isSelected ? color : undefined}>
                {field.label}:{" "}
              </Text>
              {field.options.map((option, oi) => {
                const isChecked = option === selected;
                return (
                  <Text key={option}>
                    {oi > 0 && "  "}
                    <Text dimColor>[</Text>
                    {isChecked ? (
                      <Text color={theme.success}>✓</Text>
                    ) : (
                      <Text dimColor> </Text>
                    )}
                    <Text dimColor>]</Text>
                    <Text color={isSelected ? color : undefined}>
                      {" "}
                      {option}
                    </Text>
                  </Text>
                );
              })}
            </Indent>
          );
        }

        if (field.type === "kv") {
          const entries = values[field.key] as Record<string, string>;
          const count = Object.keys(entries).length;
          const summary = count === 1 ? "1 entry" : `${count} entries`;
          return (
            <Indent key={field.key}>
              <Text color={isSelected ? color : undefined}>
                {isSelected ? "❯" : " "}{" "}
              </Text>
              <Text color={isSelected ? color : undefined}>
                {field.label}: {summary}
              </Text>
              <Text color={theme.key}> ›</Text>
            </Indent>
          );
        }

        const value = values[field.key] as string;

        if (isSelected) {
          const { before, at, after } = splitAtCursor(value, textCursor);
          return (
            <Indent key={field.key}>
              <Text color={color}>{"❯ "}</Text>
              <Text>{field.label}: </Text>
              <Text>
                {before}
                <Text inverse>{at}</Text>
                {after}
              </Text>
            </Indent>
          );
        }

        return (
          <Indent key={field.key}>
            <Text>
              {"  "}
              {field.label}: {value}
            </Text>
          </Indent>
        );
      })}
    </>
  );
}
