import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Provider } from "../config/schema";
import { setupMsw, http, HttpResponse } from "../test-utils/msw";
import { createOpenAICompatibleClient } from "./openai-compatible";

/**
 * Builds a fake HF hub cache containing a single snapshot for the given
 * model id and writes the supplied config.json body. Returns the cache
 * root so tests can point HF_HUB_CACHE at it.
 */
function makeHfCache(modelId: string, config: unknown): string {
  const cacheRoot = mkdtempSync(join(tmpdir(), "tomo-hf-"));
  const snapshotDir = join(
    cacheRoot,
    `models--${modelId.replace(/\//g, "--")}`,
    "snapshots",
    "abc123",
  );
  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(join(snapshotDir, "config.json"), JSON.stringify(config));
  return cacheRoot;
}

/** Creates a minimal provider config for testing. */
function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: "test",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    ...overrides,
  };
}

describe("createOpenAICompatibleClient", () => {
  const server = setupMsw();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("fetchModels", () => {
    it("fetches models from /v1/models", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.json({ data: [{ id: "llama3" }, { id: "mistral" }] }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const models = await client.fetchModels();

      expect(models).toEqual([{ id: "llama3" }, { id: "mistral" }]);
    });

    it("uses /v1/models for mlx", async () => {
      let requestUrl = "";
      server.use(
        http.get("http://127.0.0.1:8080/v1/models", (info) => {
          requestUrl = info.request.url;
          return HttpResponse.json({ data: [{ id: "mlx-community/llama" }] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "mlx",
          baseUrl: "http://127.0.0.1:8080",
        }),
      );
      const models = await client.fetchModels();

      expect(requestUrl).toBe("http://127.0.0.1:8080/v1/models");
      expect(models).toEqual([{ id: "mlx-community/llama" }]);
    });

    it("uses /v1/models/user for openrouter with api key", async () => {
      let requestUrl = "";
      server.use(
        http.get("https://openrouter.ai/api/v1/models/user", (info) => {
          requestUrl = info.request.url;
          return HttpResponse.json({ data: [{ id: "gpt-4" }] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
          apiKey: "sk-test",
        }),
      );
      await client.fetchModels();

      expect(requestUrl).toBe("https://openrouter.ai/api/v1/models/user");
    });

    it("uses /v1/models for openrouter without api key", async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "");
      let requestUrl = "";
      server.use(
        http.get("https://openrouter.ai/api/v1/models", (info) => {
          requestUrl = info.request.url;
          return HttpResponse.json({ data: [{ id: "gpt-4" }] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      await client.fetchModels();

      expect(requestUrl).toBe("https://openrouter.ai/api/v1/models");
    });

    it("includes authorization header when api key is set", async () => {
      let authHeader = "";
      server.use(
        http.get("http://localhost:11434/v1/models", (info) => {
          authHeader = info.request.headers.get("authorization") ?? "";
          return HttpResponse.json({ data: [] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({ apiKey: "sk-test" }),
      );
      await client.fetchModels();

      expect(authHeader).toBe("Bearer sk-test");
    });

    it("omits authorization header when no api key", async () => {
      let hasAuthHeader = false;
      server.use(
        http.get("http://localhost:11434/v1/models", (info) => {
          hasAuthHeader = info.request.headers.has("authorization");
          return HttpResponse.json({ data: [] });
        }),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      await client.fetchModels();

      expect(hasAuthHeader).toBe(false);
    });

    it("resolves api key from env var when not in config", async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "sk-from-env");
      let authHeader = "";
      server.use(
        http.get("https://openrouter.ai/api/v1/models/user", (info) => {
          authHeader = info.request.headers.get("authorization") ?? "";
          return HttpResponse.json({ data: [] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      await client.fetchModels();

      expect(authHeader).toBe("Bearer sk-from-env");
    });

    it("handles bare array response format", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.json([{ id: "model-a" }, { id: "model-b" }]),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const models = await client.fetchModels();

      expect(models).toEqual([{ id: "model-a" }, { id: "model-b" }]);
    });

    it("handles wrapped data array response format", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.json({ data: [{ id: "model-a" }] }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const models = await client.fetchModels();

      expect(models).toEqual([{ id: "model-a" }]);
    });

    it("returns empty array when data array is empty", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.json({ data: [] }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const models = await client.fetchModels();

      expect(models).toEqual([]);
    });

    it("returns empty array when response object has no data property", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.json({}),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const models = await client.fetchModels();

      expect(models).toEqual([]);
    });

    it("strips trailing slashes from base url", async () => {
      let requestUrl = "";
      server.use(
        http.get("http://localhost:11434/v1/models", (info) => {
          requestUrl = info.request.url;
          return HttpResponse.json({ data: [] });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({ baseUrl: "http://localhost:11434///" }),
      );
      await client.fetchModels();

      expect(requestUrl).toBe("http://localhost:11434/v1/models");
    });

    it("throws on connection failure", async () => {
      server.use(
        http.get("http://localhost:11434/v1/models", () =>
          HttpResponse.error(),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());

      await expect(client.fetchModels()).rejects.toThrow();
    });

    it("throws on http error with body", async () => {
      server.use(
        http.get(
          "http://localhost:11434/v1/models",
          () => new HttpResponse("Unauthorized", { status: 401 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());

      await expect(client.fetchModels()).rejects.toThrow(
        "Provider returned HTTP 401: Unauthorized",
      );
    });

    it("throws on http error without body", async () => {
      server.use(
        http.get(
          "http://localhost:11434/v1/models",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());

      await expect(client.fetchModels()).rejects.toThrow(
        "Provider returned HTTP 500",
      );
    });
  });

  describe("fetchContextWindow", () => {
    it("fetches context window from ollama /api/show", async () => {
      server.use(
        http.post("http://localhost:11434/api/show", () =>
          HttpResponse.json({
            model_info: {
              "llama.context_length": 131072,
            },
          }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");
      expect(result).toBe(131072);
    });

    it("handles different architecture prefixes in ollama response", async () => {
      server.use(
        http.post("http://localhost:11434/api/show", () =>
          HttpResponse.json({
            model_info: {
              "qwen2.context_length": 32768,
            },
          }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("qwen3:8b");
      expect(result).toBe(32768);
    });

    it("returns default when ollama /api/show fails", async () => {
      server.use(
        http.post(
          "http://localhost:11434/api/show",
          () => new HttpResponse(null, { status: 404 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");
      expect(result).toBe(8192);
    });

    it("returns default when ollama model_info has no context_length", async () => {
      server.use(
        http.post("http://localhost:11434/api/show", () =>
          HttpResponse.json({ model_info: { "llama.embedding_length": 4096 } }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");
      expect(result).toBe(8192);
    });

    it("returns default when ollama response has no model_info", async () => {
      server.use(
        http.post("http://localhost:11434/api/show", () =>
          HttpResponse.json({}),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");
      expect(result).toBe(8192);
    });

    it("reads mlx context window from HF cache max_position_embeddings", async () => {
      const cacheRoot = makeHfCache("mlx-community/llama", {
        max_position_embeddings: 131072,
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(131072);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it.each([
      ["max_sequence_length", 40960],
      ["seq_length", 16384],
      ["n_positions", 2048],
      ["sliding_window", 4096],
    ])("reads mlx context window from %s", async (field, value) => {
      const cacheRoot = makeHfCache("mlx-community/llama", { [field]: value });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(value);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("prefers max_position_embeddings over later fields", async () => {
      const cacheRoot = makeHfCache("mlx-community/llama", {
        max_position_embeddings: 131072,
        sliding_window: 4096,
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(131072);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("reads mlx context window from nested text_config for multimodal models", async () => {
      const cacheRoot = makeHfCache("mlx-community/gemma", {
        text_config: { max_position_embeddings: 65536 },
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/gemma");
        expect(result).toBe(65536);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("falls back to default when mlx HF cache entry is missing", async () => {
      const cacheRoot = mkdtempSync(join(tmpdir(), "tomo-hf-"));
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("falls back to default when mlx HF cache snapshots dir is empty", async () => {
      const cacheRoot = mkdtempSync(join(tmpdir(), "tomo-hf-"));
      mkdirSync(join(cacheRoot, "models--mlx-community--llama", "snapshots"), {
        recursive: true,
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("falls back to default when mlx HF config.json is malformed", async () => {
      const cacheRoot = mkdtempSync(join(tmpdir(), "tomo-hf-"));
      const snapshotDir = join(
        cacheRoot,
        "models--mlx-community--llama",
        "snapshots",
        "abc123",
      );
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, "config.json"), "{ not json");
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("falls back to default when mlx HF config has no context fields", async () => {
      const cacheRoot = makeHfCache("mlx-community/llama", {
        hidden_size: 4096,
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("uses HF_HOME/hub when HF_HUB_CACHE is unset", async () => {
      const hfHome = mkdtempSync(join(tmpdir(), "tomo-hf-home-"));
      const snapshotDir = join(
        hfHome,
        "hub",
        "models--mlx-community--llama",
        "snapshots",
        "abc123",
      );
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(
        join(snapshotDir, "config.json"),
        JSON.stringify({ max_position_embeddings: 8000 }),
      );
      vi.stubEnv("HF_HUB_CACHE", "");
      vi.stubEnv("HF_HOME", hfHome);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8000);
      } finally {
        rmSync(hfHome, { recursive: true, force: true });
      }
    });

    it("falls back to ~/.cache/huggingface/hub when no HF env vars are set", async () => {
      vi.stubEnv("HF_HUB_CACHE", "");
      vi.stubEnv("HF_HOME", "");
      const client = createOpenAICompatibleClient(
        makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
      );
      // Unique id guarantees no collision with a real cache entry; the path
      // won't exist, so this exercises the default-dir branch and returns 8192.
      const result = await client.fetchContextWindow(
        `tomo-test-nonexistent/model-${Date.now()}`,
      );
      expect(result).toBe(8192);
    });

    it("falls back to default when absolute mlx path has no config.json", async () => {
      const modelDir = mkdtempSync(join(tmpdir(), "tomo-mlx-empty-"));
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow(modelDir);
        expect(result).toBe(8192);
      } finally {
        rmSync(modelDir, { recursive: true, force: true });
      }
    });

    it("falls back to default when mlx HF config.json is a JSON scalar", async () => {
      // z.record requires an object; null/strings/numbers fail the top-level schema.
      const cacheRoot = mkdtempSync(join(tmpdir(), "tomo-hf-"));
      const snapshotDir = join(
        cacheRoot,
        "models--mlx-community--llama",
        "snapshots",
        "abc123",
      );
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, "config.json"), "null");
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("falls back to default when text_config has no context fields", async () => {
      const cacheRoot = makeHfCache("mlx-community/llama", {
        text_config: { hidden_size: 4096 },
      });
      vi.stubEnv("HF_HUB_CACHE", cacheRoot);
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow("mlx-community/llama");
        expect(result).toBe(8192);
      } finally {
        rmSync(cacheRoot, { recursive: true, force: true });
      }
    });

    it("reads mlx context window from an absolute local model path", async () => {
      const modelDir = mkdtempSync(join(tmpdir(), "tomo-mlx-model-"));
      writeFileSync(
        join(modelDir, "config.json"),
        JSON.stringify({ max_position_embeddings: 16384 }),
      );
      try {
        const client = createOpenAICompatibleClient(
          makeProvider({ type: "mlx", baseUrl: "http://127.0.0.1:8080" }),
        );
        const result = await client.fetchContextWindow(modelDir);
        expect(result).toBe(16384);
      } finally {
        rmSync(modelDir, { recursive: true, force: true });
      }
    });

    it("fetches context window from /v1/models for openrouter", async () => {
      server.use(
        http.get("https://openrouter.ai/api/v1/models", () =>
          HttpResponse.json({
            data: [{ id: "gpt-4", context_length: 128000 }],
          }),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(128000);
    });

    it("handles bare array response from /v1/models", async () => {
      server.use(
        http.get("https://openrouter.ai/api/v1/models", () =>
          HttpResponse.json([{ id: "gpt-4", context_length: 128000 }]),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(128000);
    });

    it("returns default when model has no context_length", async () => {
      server.use(
        http.get("https://openrouter.ai/api/v1/models", () =>
          HttpResponse.json({
            data: [{ id: "gpt-4" }],
          }),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(8192);
    });

    it("returns default when response fails schema validation", async () => {
      server.use(
        http.get("https://openrouter.ai/api/v1/models", () =>
          HttpResponse.json("not an object"),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(8192);
    });

    it("returns default when model not found in /v1/models", async () => {
      server.use(
        http.get("https://openrouter.ai/api/v1/models", () =>
          HttpResponse.json({ data: [{ id: "other-model" }] }),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(8192);
    });

    it("returns default when /v1/models fails", async () => {
      server.use(
        http.get(
          "https://openrouter.ai/api/v1/models",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
        }),
      );
      const result = await client.fetchContextWindow("gpt-4");
      expect(result).toBe(8192);
    });

    it("returns default on network error", async () => {
      server.use(
        http.post("http://localhost:11434/api/show", () =>
          HttpResponse.error(),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");
      expect(result).toBe(8192);
    });
  });

  describe("streamCompletion", () => {
    /** Builds an SSE response body from an array of data objects. */
    function sseBody(chunks: unknown[]): string {
      return (
        chunks.map((c) => `data: ${JSON.stringify(c)}`).join("\n\n") +
        "\n\ndata: [DONE]\n\n"
      );
    }

    /** Standard completion options for tests. */
    const COMPLETION_OPTIONS = {
      model: "llama3",
      messages: [{ role: "user" as const, content: "hello" }],
    };

    it("streams content tokens", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                { choices: [{ delta: { content: "Hello" } }] },
                { choices: [{ delta: { content: " world" } }] },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      const tokens: string[] = [];
      for await (const token of stream.content) {
        tokens.push(token);
      }
      expect(tokens).toEqual(["Hello", " world"]);
    });

    it("captures token usage", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                { choices: [{ delta: { content: "Hi" } }] },
                { usage: { prompt_tokens: 10, completion_tokens: 5 } },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      for await (const _ of stream.content) {
        // consume
      }
      expect(stream.getUsage()).toEqual({
        promptTokens: 10,
        completionTokens: 5,
      });
    });

    it("returns null usage when not provided", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([{ choices: [{ delta: { content: "Hi" } }] }]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      for await (const _ of stream.content) {
        // consume
      }
      expect(stream.getUsage()).toBeNull();
    });

    it("accumulates tool calls across chunks", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_1",
                            function: {
                              name: "readFile",
                              arguments: '{"path":',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            function: { arguments: '"test.ts"}' },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      for await (const _ of stream.content) {
        // consume
      }
      const calls = stream.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].id).toBe("call_1");
      expect(calls[0].function.name).toBe("readFile");
      expect(calls[0].function.arguments).toBe('{"path":"test.ts"}');
    });

    it("defaults missing tool call fields to empty strings", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [{ index: 0 }],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);
      for await (const _ of stream.content) {
        // consume
      }
      const calls = stream.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].id).toBe("");
      expect(calls[0].function.name).toBe("");
      expect(calls[0].function.arguments).toBe("");
    });

    it("updates id and name on subsequent tool call chunks", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [{ index: 0 }],
                      },
                    },
                  ],
                },
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_late",
                            function: { name: "lateName" },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);
      for await (const _ of stream.content) {
        // consume
      }
      const calls = stream.getToolCalls();
      expect(calls[0].id).toBe("call_late");
      expect(calls[0].function.name).toBe("lateName");
      expect(calls[0].function.arguments).toBe("");
    });

    it("sends authorization header when api key is set", async () => {
      let authHeader = "";
      server.use(
        http.post("http://localhost:11434/v1/chat/completions", (info) => {
          authHeader = info.request.headers.get("authorization") ?? "";
          return new HttpResponse(sseBody([]), {
            headers: { "Content-Type": "text/event-stream" },
          });
        }),
      );

      const client = createOpenAICompatibleClient(
        makeProvider({ apiKey: "sk-test" }),
      );
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);
      for await (const _ of stream.content) {
        // consume
      }
      expect(authHeader).toBe("Bearer sk-test");
    });

    it("includes max_tokens when provided", async () => {
      let requestBody: Record<string, unknown> = {};
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          async (info) => {
            requestBody = (await info.request.json()) as Record<
              string,
              unknown
            >;
            return new HttpResponse(sseBody([]), {
              headers: { "Content-Type": "text/event-stream" },
            });
          },
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion({
        ...COMPLETION_OPTIONS,
        maxTokens: 1024,
      });
      for await (const _ of stream.content) {
        // consume
      }
      expect(requestBody.max_tokens).toBe(1024);
    });

    it("includes tools when provided", async () => {
      let requestBody: Record<string, unknown> = {};
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          async (info) => {
            requestBody = (await info.request.json()) as Record<
              string,
              unknown
            >;
            return new HttpResponse(sseBody([]), {
              headers: { "Content-Type": "text/event-stream" },
            });
          },
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion({
        ...COMPLETION_OPTIONS,
        tools: [
          {
            type: "function",
            function: {
              name: "test",
              description: "test tool",
              parameters: {},
            },
          },
        ],
      });
      for await (const _ of stream.content) {
        // consume
      }
      expect(requestBody.tools).toHaveLength(1);
    });

    it("throws on HTTP error with body", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new HttpResponse("Bad Request", { status: 400 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      await expect(client.streamCompletion(COMPLETION_OPTIONS)).rejects.toThrow(
        "Provider returned HTTP 400: Bad Request",
      );
    });

    it("throws on HTTP error without body", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      await expect(client.streamCompletion(COMPLETION_OPTIONS)).rejects.toThrow(
        "Provider returned HTTP 500",
      );
    });

    it("throws on empty response body", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new HttpResponse(null, { status: 200 }),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      await expect(client.streamCompletion(COMPLETION_OPTIONS)).rejects.toThrow(
        "Provider returned an empty response body",
      );
    });

    it("throws on connection failure", async () => {
      server.use(
        http.post("http://localhost:11434/v1/chat/completions", () =>
          HttpResponse.error(),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      await expect(
        client.streamCompletion(COMPLETION_OPTIONS),
      ).rejects.toThrow();
    });

    it("skips chunks that fail schema validation", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              'data: "just a string"\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      const tokens: string[] = [];
      for await (const token of stream.content) {
        tokens.push(token);
      }
      expect(tokens).toEqual(["ok"]);
    });

    it("skips malformed JSON in SSE data", async () => {
      server.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              'data: not-json\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const client = createOpenAICompatibleClient(makeProvider());
      const stream = await client.streamCompletion(COMPLETION_OPTIONS);

      const tokens: string[] = [];
      for await (const token of stream.content) {
        tokens.push(token);
      }
      expect(tokens).toEqual(["ok"]);
    });
  });
});
