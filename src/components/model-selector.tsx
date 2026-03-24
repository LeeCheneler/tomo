import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelInfo } from "../provider/client";
import { fetchModels, resolveApiKey } from "../provider/client";

interface ProviderEntry {
  name: string;
  baseUrl: string;
  type: string;
  apiKey?: string;
}

type Row =
  | { kind: "header"; provider: string }
  | { kind: "model"; provider: string; model: string };

interface ProviderResult {
  provider: string;
  models: ModelInfo[];
  error: string | null;
}

interface ModelSelectorProps {
  providers: ProviderEntry[];
  activeProvider: string;
  activeModel: string;
  onSelect: (provider: string, model: string) => void;
  onCancel: () => void;
}

/** Interactive model selector with arrow key navigation, grouped by provider. */
export function ModelSelector({
  providers,
  activeProvider,
  activeModel,
  onSelect,
  onCancel,
}: ModelSelectorProps) {
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      providers.map(async (p) => {
        try {
          const key = resolveApiKey(p.type, p.apiKey);
          const models = await fetchModels(p.baseUrl, key);
          return { provider: p.name, models, error: null };
        } catch (err) {
          return {
            provider: p.name,
            models: [],
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    ).then((all) => {
      setResults(all);
      setLoading(false);
    });
  }, [providers]);

  // Build flat row list from results
  const rows: Row[] = [];
  for (const r of results) {
    rows.push({ kind: "header", provider: r.provider });
    for (const m of r.models) {
      rows.push({ kind: "model", provider: r.provider, model: m.id });
    }
  }

  // Selectable indices (model rows only)
  const selectableIndices = rows
    .map((r, i) => (r.kind === "model" ? i : -1))
    .filter((i) => i >= 0);

  // Find the initial cursor position (active model on active provider)
  const initialSelectable = selectableIndices.findIndex((idx) => {
    const row = rows[idx];
    return (
      row?.kind === "model" &&
      row.provider === activeProvider &&
      row.model === activeModel
    );
  });

  const MAX_VISIBLE = 5;
  const [cursor, setCursor] = useState(0);
  const [initialised, setInitialised] = useState(false);
  const windowStartRef = useRef(0);

  // Set cursor to active model once results arrive
  useEffect(() => {
    if (!loading && !initialised && selectableIndices.length > 0) {
      const initial = initialSelectable >= 0 ? initialSelectable : 0;
      setCursor(initial);
      // Centre the window on the initial selection
      windowStartRef.current = Math.max(
        0,
        Math.min(
          initial - Math.floor(MAX_VISIBLE / 2),
          selectableIndices.length - MAX_VISIBLE,
        ),
      );
      setInitialised(true);
    }
  }, [loading, initialised, initialSelectable, selectableIndices.length]);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && selectableIndices.length > 0) {
      const idx = selectableIndices[cursor];
      if (idx === undefined) return;
      const row = rows[idx];
      if (row?.kind === "model") {
        onSelect(row.provider, row.model);
      }
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : selectableIndices.length - 1));
    }
    if (key.downArrow) {
      setCursor((c) => (c < selectableIndices.length - 1 ? c + 1 : 0));
    }
  });

  // Keep the scroll window around the cursor
  if (cursor < windowStartRef.current) {
    windowStartRef.current = cursor;
  } else if (cursor >= windowStartRef.current + MAX_VISIBLE) {
    windowStartRef.current = cursor - MAX_VISIBLE + 1;
  }
  windowStartRef.current = Math.min(
    windowStartRef.current,
    Math.max(0, selectableIndices.length - MAX_VISIBLE),
  );

  if (loading) {
    return <Text dimColor>{"  Fetching models..."}</Text>;
  }

  if (selectableIndices.length === 0) {
    return <Text dimColor>{"  No models available."}</Text>;
  }

  // Visible window of selectable model rows
  const visibleSelectables = selectableIndices.slice(
    windowStartRef.current,
    windowStartRef.current + MAX_VISIBLE,
  );
  const hasMore = selectableIndices.length > MAX_VISIBLE;

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {"  Select a model (↑↓ navigate, Enter select, Esc cancel):"}
      </Text>
      <Text> </Text>
      {visibleSelectables.map((rowIdx) => {
        const row = rows[rowIdx];
        if (!row || row.kind !== "model") return null;

        // Show provider header before the first model of each provider in the window
        const prevVisible =
          visibleSelectables[visibleSelectables.indexOf(rowIdx) - 1];
        const prevRow = prevVisible !== undefined ? rows[prevVisible] : null;
        const showHeader =
          !prevRow ||
          (prevRow.kind === "model" && prevRow.provider !== row.provider);

        const providerResult = results.find((r) => r.provider === row.provider);

        const isCursor = selectableIndices.indexOf(rowIdx) === cursor;
        const isActive =
          row.provider === activeProvider && row.model === activeModel;
        const prefix = isCursor ? "❯" : " ";
        const suffix = isActive ? " (active)" : "";

        return (
          <Box key={`${row.provider}-${row.model}`} flexDirection="column">
            {showHeader && (
              <Text dimColor bold>
                {"  "}
                {row.provider}
                {providerResult?.error
                  ? ` (error: ${providerResult.error})`
                  : ""}
              </Text>
            )}
            <Text color={isCursor ? "cyan" : undefined}>
              {"    "}
              {prefix} {row.model}
              {suffix}
            </Text>
          </Box>
        );
      })}
      {hasMore && (
        <Text dimColor>
          {"    "}
          {`${selectableIndices.length - MAX_VISIBLE} more...`}
        </Text>
      )}
    </Box>
  );
}
