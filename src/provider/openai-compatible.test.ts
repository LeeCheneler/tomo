import { describe, it, expect, vi, afterEach } from "vitest";
import type { Provider } from "../config/schema";
import { setupMsw, http, HttpResponse } from "../test-utils/msw";
import { createOpenAICompatibleClient } from "./openai-compatible";

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
    it("returns default context window", async () => {
      const client = createOpenAICompatibleClient(makeProvider());
      const result = await client.fetchContextWindow("llama3");

      expect(result).toBe(8192);
    });
  });

  describe("streamCompletion", () => {
    it("throws not yet implemented", async () => {
      const client = createOpenAICompatibleClient(makeProvider());

      await expect(
        client.streamCompletion({
          model: "llama3",
          messages: [{ role: "user", content: "hello" }],
        }),
      ).rejects.toThrow("streamCompletion not yet implemented");
    });
  });
});
