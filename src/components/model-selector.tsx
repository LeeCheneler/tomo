import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelInfo } from "../provider/client";
import { fetchModels } from "../provider/client";

interface ProviderEntry {
  name: string;
  baseUrl: string;
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
          const models = await fetchModels(p.baseUrl);
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

  const [cursor, setCursor] = useState(0);
  const [initialised, setInitialised] = useState(false);

  // Set cursor to active model once results arrive
  useEffect(() => {
    if (!loading && !initialised && selectableIndices.length > 0) {
      setCursor(initialSelectable >= 0 ? initialSelectable : 0);
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

  if (loading) {
    return <Text dimColor>{"  Fetching models..."}</Text>;
  }

  if (selectableIndices.length === 0) {
    return <Text dimColor>{"  No models available."}</Text>;
  }

  const currentSelectableIdx = selectableIndices[cursor];

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {"  Select a model (↑↓ navigate, Enter select, Esc cancel):"}
      </Text>
      <Text> </Text>
      {rows.map((row, i) => {
        if (row.kind === "header") {
          const providerResult = results.find(
            (r) => r.provider === row.provider,
          );
          return (
            <Box key={`header-${row.provider}`} flexDirection="column">
              <Text dimColor bold>
                {"  "}
                {row.provider}
                {providerResult?.error
                  ? ` (error: ${providerResult.error})`
                  : ""}
              </Text>
            </Box>
          );
        }

        const isCursor = i === currentSelectableIdx;
        const isActive =
          row.provider === activeProvider && row.model === activeModel;
        const prefix = isCursor ? "❯" : " ";
        const suffix = isActive ? " (active)" : "";

        return (
          <Text
            key={`${row.provider}-${row.model}`}
            color={isCursor ? "cyan" : undefined}
          >
            {"    "}
            {prefix} {row.model}
            {suffix}
          </Text>
        );
      })}
    </Box>
  );
}
