import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { fetchModels, type ModelInfo } from "../provider/client";
import { useListNavigation } from "../hooks/use-list-navigation";

interface ProviderEntry {
  name: string;
  baseUrl: string;
  type: string;
}

type Step =
  | "menu"
  | "selectType"
  | "enterUrl"
  | "enterApiKey"
  | "fetchingModels"
  | "selectModel"
  | "enterName"
  | "removeProvider";

interface NewProvider {
  type: string;
  baseUrl: string;
  apiKey?: string;
}

export interface ConfigureSelectorProps {
  providers: ProviderEntry[];
  activeProvider: string;
  onAddProvider: (
    provider: { name: string; type: string; baseUrl: string; apiKey?: string },
    model: string,
  ) => void;
  onRemoveProvider: (name: string) => void;
  onCancel: () => void;
}

const PROVIDER_TYPES = ["ollama", "opencode-zen", "openrouter"] as const;

const DEFAULT_URLS: Record<string, string> = {
  ollama: "http://localhost:11434",
  "opencode-zen": "https://opencode.ai/zen",
  openrouter: "https://openrouter.ai/api",
};

/** Interactive multi-step wizard for adding or removing providers. */
export function ConfigureSelector({
  providers,
  activeProvider,
  onAddProvider,
  onRemoveProvider,
  onCancel,
}: ConfigureSelectorProps) {
  const [step, setStep] = useState<Step>("menu");
  const [newProvider, setNewProvider] = useState<NewProvider>({
    type: "",
    baseUrl: "",
  });
  const [textValue, setTextValue] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");

  const MAX_VISIBLE = 5;
  const menuOptions = ["Add provider", "Remove provider"];

  const removableProviders = providers.filter((p) => p.name !== activeProvider);

  const filteredModels = modelFilter
    ? models.filter((m) =>
        m.id.toLowerCase().includes(modelFilter.toLowerCase()),
      )
    : models;

  // Compute item count based on current step
  const itemCount = (() => {
    switch (step) {
      case "menu":
        return menuOptions.length;
      case "selectType":
        return PROVIDER_TYPES.length;
      case "selectModel":
        return filteredModels.length;
      case "removeProvider":
        return removableProviders.length;
      default:
        return 0;
    }
  })();

  const { cursor, setCursor, windowStart, handleUp, handleDown } =
    useListNavigation(itemCount, {
      maxVisible: step === "selectModel" ? MAX_VISIBLE : undefined,
    });

  // Reset cursor and filter when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset cursor on step change
  useEffect(() => {
    setCursor(0);
    setModelFilter("");
  }, [step]);

  useInput((input, key) => {
    if (key.escape) {
      if (step === "menu") {
        onCancel();
      } else if (step === "selectModel" && modelFilter) {
        setModelFilter("");
        setCursor(0);
      } else {
        setStep("menu");
        setNewProvider({ type: "", baseUrl: "" });
        setTextValue("");
        setFetchError(null);
        setNameError(null);
      }
      return;
    }

    switch (step) {
      case "menu": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          if (cursor === 0) {
            setStep("selectType");
          } else {
            if (removableProviders.length === 0) return;
            setStep("removeProvider");
          }
        }
        break;
      }

      case "selectType": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          const type = PROVIDER_TYPES[cursor];
          setNewProvider({ type, baseUrl: "" });
          setTextValue(DEFAULT_URLS[type] ?? "");
          setStep("enterUrl");
        }
        break;
      }

      case "enterUrl": {
        if (key.return) {
          const url = textValue.trim();
          if (!url) return;
          setNewProvider((p) => ({ ...p, baseUrl: url }));
          if (newProvider.type !== "ollama") {
            setTextValue("");
            setStep("enterApiKey");
          } else {
            setStep("fetchingModels");
          }
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "enterApiKey": {
        if (key.return) {
          const apiKey = textValue.trim() || undefined;
          setNewProvider((p) => ({ ...p, apiKey }));
          setStep("fetchingModels");
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "fetchingModels": {
        // No input during fetch
        break;
      }

      case "selectModel": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return && filteredModels.length > 0) {
          const model = filteredModels[cursor];
          if (!model) return;
          setSelectedModelIdx(models.indexOf(model));
          setTextValue(newProvider.type);
          setNameError(null);
          setStep("enterName");
        } else if (key.backspace || key.delete) {
          setModelFilter((f) => {
            setCursor(0);
            return f.slice(0, -1);
          });
        } else if (input && !key.ctrl && !key.meta) {
          setModelFilter((f) => {
            setCursor(0);
            return f + input;
          });
        }
        break;
      }

      case "enterName": {
        if (key.return) {
          const name = textValue.trim();
          if (!name) return;
          if (providers.some((p) => p.name === name)) {
            setNameError(`Provider "${name}" already exists`);
            return;
          }
          const selectedModel = models[selectedModelIdx];
          if (!selectedModel) return;
          onAddProvider(
            {
              name,
              type: newProvider.type,
              baseUrl: newProvider.baseUrl,
              apiKey: newProvider.apiKey,
            },
            selectedModel.id,
          );
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
          setNameError(null);
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
          setNameError(null);
        }
        break;
      }

      case "removeProvider": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return && removableProviders.length > 0) {
          const provider = removableProviders[cursor];
          if (!provider) return;
          onRemoveProvider(provider.name);
        }
        break;
      }
    }
  });

  // Fetch models when entering the fetchingModels step
  useEffect(() => {
    if (step !== "fetchingModels") return;
    let cancelled = false;

    fetchModels(newProvider.baseUrl, newProvider.apiKey, newProvider.type)
      .then((result) => {
        if (cancelled) return;
        setModels(result);
        if (result.length === 0) {
          setFetchError("No models available from this provider");
        } else {
          setStep("selectModel");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [step, newProvider.baseUrl, newProvider.apiKey, newProvider.type]);

  switch (step) {
    case "menu":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Configure (↑↓ navigate, Enter select, Esc cancel):"}
          </Text>
          <Text> </Text>
          {menuOptions.map((option, i) => {
            const isCursor = i === cursor;
            const prefix = isCursor ? "❯" : " ";
            const disabled = i === 1 && removableProviders.length === 0;
            return (
              <Text
                key={option}
                color={isCursor && !disabled ? "cyan" : undefined}
                dimColor={disabled}
              >
                {"    "}
                {prefix} {option}
                {disabled ? " (no removable providers)" : ""}
              </Text>
            );
          })}
        </Box>
      );

    case "selectType":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Select provider type (↑↓ navigate, Enter select, Esc back):"}
          </Text>
          <Text> </Text>
          {PROVIDER_TYPES.map((type, i) => {
            const isCursor = i === cursor;
            const prefix = isCursor ? "❯" : " ";
            return (
              <Text key={type} color={isCursor ? "cyan" : undefined}>
                {"    "}
                {prefix} {type}
              </Text>
            );
          })}
        </Box>
      );

    case "enterUrl":
      return (
        <Box flexDirection="column">
          <Text dimColor>{"  Enter base URL (Enter confirm, Esc back):"}</Text>
          <Text> </Text>
          <Text>
            {"    "}
            {textValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "enterApiKey":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  Enter API key (Enter confirm, leave empty for env var, Esc back):"
            }
          </Text>
          <Text> </Text>
          <Text>
            {"    "}
            {"*".repeat(textValue.length)}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "fetchingModels":
      if (fetchError) {
        return (
          <Box flexDirection="column">
            <Text color="red">
              {"  Failed to fetch models: "}
              {fetchError}
            </Text>
            <Text dimColor>{"  Press Esc to go back."}</Text>
          </Box>
        );
      }
      return <Text dimColor>{"  Fetching models..."}</Text>;

    case "selectModel": {
      const visibleModels = filteredModels.slice(
        windowStart,
        windowStart + MAX_VISIBLE,
      );
      const remaining = filteredModels.length - MAX_VISIBLE;
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  Select a model (↑↓ navigate, type to filter, Enter select, Esc back):"
            }
          </Text>
          <Text> </Text>
          <Text>
            {"  Search: "}
            {modelFilter}
            <Text dimColor>█</Text>
            {modelFilter && (
              <Text dimColor>
                {` (${filteredModels.length} of ${models.length})`}
              </Text>
            )}
          </Text>
          <Text> </Text>
          {filteredModels.length === 0 && (
            <Text dimColor>{"    No models match your search."}</Text>
          )}
          {visibleModels.map((model, i) => {
            const actualIdx = windowStart + i;
            const isCursor = actualIdx === cursor;
            const prefix = isCursor ? "❯" : " ";
            return (
              <Text key={model.id} color={isCursor ? "cyan" : undefined}>
                {"    "}
                {prefix} {model.id}
              </Text>
            );
          })}
          {remaining > 0 && (
            <Text dimColor>
              {"    "}
              {`${remaining} more...`}
            </Text>
          )}
        </Box>
      );
    }

    case "enterName":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Enter a name for this provider (Enter confirm, Esc back):"}
          </Text>
          <Text> </Text>
          <Text>
            {"    "}
            {textValue}
            <Text dimColor>█</Text>
          </Text>
          {nameError && (
            <Text color="red">
              {"    "}
              {nameError}
            </Text>
          )}
        </Box>
      );

    case "removeProvider":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  Select provider to remove (↑↓ navigate, Enter select, Esc back):"
            }
          </Text>
          <Text> </Text>
          {providers.map((provider) => {
            const isActive = provider.name === activeProvider;
            const removableIdx = removableProviders.indexOf(provider);
            const isCursor = !isActive && removableIdx === cursor;
            const prefix = isCursor ? "❯" : " ";
            return (
              <Text
                key={provider.name}
                color={isCursor ? "cyan" : undefined}
                dimColor={isActive}
              >
                {"    "}
                {prefix} {provider.name}
                {isActive ? " (active)" : ""}{" "}
                <Text dimColor>
                  ({provider.type} — {provider.baseUrl})
                </Text>
              </Text>
            );
          })}
        </Box>
      );
  }
}
