# 9. Context window management

Date: 2026-03-21

## Status

Accepted

## Context

Every LLM API call is stateless — the full conversation history is resent on each request. As conversations grow, the request payload eventually exceeds the model's context window, causing provider errors or silent truncation. We needed a strategy for measuring, displaying, and managing context usage.

Key constraints:

- Tomo is local-first and model-agnostic — it connects to Ollama and any OpenAI-compatible endpoint
- Different models use different tokenizers, so exact client-side token counting would require model-specific tokenizer files
- Local models range from 4k to 256k+ context windows
- Users should understand their context usage without needing to think about tokens

## Decision

### Provider-reported token counts over client-side tokenization

We use `prompt_tokens` and `completion_tokens` from the provider's streaming response rather than counting tokens client-side. The completion request includes `stream_options: { include_usage: true }` and the final SSE chunk contains usage data.

This avoids the tokenizer mapping problem entirely — every provider reports exact counts for its own model. The tradeoff is that we can't know the token count *before* the first request, and truncation decisions are based on the previous request's counts (one step behind). In practice this is sufficient because conversations grow gradually.

Alternatives considered:

- **`@huggingface/tokenizers`** — loads exact tokenizer files per model from HuggingFace Hub. Accurate but adds complexity (model name → HuggingFace ID mapping, network fetch for tokenizer files, pre-1.0 library). Better suited if/when tomo needs pre-flight token counts.
- **Character-based estimation** (`chars / 4`) — simple but inaccurate across different model tokenizers. Not reliable enough for truncation decisions.

### Context window detection from Ollama's `/api/show`

For Ollama providers, we query the `/api/show` endpoint to detect the model's context window size from `model_info.<arch>.context_length`. Detection is dispatched by provider type — only Ollama-specific detection is attempted, other providers fall back to the default (4096). Results are cached per model.

A `contextWindow` config override on the provider takes precedence over detection, allowing users to set a value for non-Ollama providers or override incorrect detection.

### Fixed `maxTokens` reserve over percentage-based

The input budget for truncation is `contextWindow - maxTokens`, where `maxTokens` is the number of tokens reserved for the model's response. This is configurable globally (default 8192) and per-model.

We initially used a percentage-based reserve (25% of context window) but this wastes significant context on large windows — e.g. 66k tokens unused on a 264k window. A fixed reserve matches how most tools handle this and the `max_tokens` parameter is sent to the provider in the completion request, giving it explicit control over response length.

### Simple truncation over compaction

When the estimated input exceeds the budget, the oldest non-system messages are dropped. The system message is never removed and at least one non-system message is always kept. Full conversation history remains in the session file on disk.

We considered compaction (summarizing dropped messages via an LLM call) but decided against it for now. Compaction quality depends heavily on model capability — small local models (7B/8B) may produce summaries that lose important context or hallucinate. A bad summary actively misleads the model, which is worse than simply dropping old messages. Compaction makes more sense for cloud providers with stronger summarization capabilities and may be revisited in the future.

## Consequences

- Token usage stats are only available after the first provider response
- Truncation is reactive (based on the last request's token count), not predictive
- The `/context` command and input divider percentage give users visibility into their context usage
- Divider lines change colour at 80% (yellow) and 90% (red) as a progressive warning
- Adding support for new provider types requires implementing type-specific context window detection (or relying on config overrides)
- The `maxTokens` config field does double duty: it controls both the truncation budget and the `max_tokens` sent to the provider
