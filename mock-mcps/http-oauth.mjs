#!/usr/bin/env node

// Mock OAuth-gated HTTP MCP server used by src/mcp/oauth.integration.test.ts.
//
// Implements the minimal subset of the MCP OAuth flow:
//
//   1. `POST /mcp` without Authorization → 401 + WWW-Authenticate header
//   2. `GET /.well-known/oauth-protected-resource` (RFC 9728)
//   3. `GET /.well-known/oauth-authorization-server` (RFC 8414)
//   4. `POST /register` (RFC 7591 DCR) — accepts any metadata, returns a
//      fixed client_id
//   5. `GET /authorize` — issues a code and redirects to the loopback
//      redirect_uri carrying `?code=...&state=...`
//   6. `POST /token` — exchanges the code for a bearer token
//   7. `POST /mcp` with a valid bearer → JSON-RPC server matching
//      `mock-mcps/http.mjs`
//
// The mock also supports a test-only header `x-force-401` so the
// mid-session reauth path can be exercised: any MCP request carrying that
// header returns 401 even with a valid bearer, letting the caller drive the
// retry loop.

import { createServer } from "http";

const PORT = Number(process.env.PORT || 9879);
const ISSUER = `http://localhost:${PORT}`;

const SERVER_INFO = { name: "mock-oauth-http-server", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "get_weather",
    description: "Returns fake weather data for a city",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
];

const VALID_TOKEN = "test-access-token";
const CLIENT_ID = "test-client-id";

/** Authorization codes issued by /authorize, mapped to their state value. */
const issuedCodes = new Map();

/** When true, the next /mcp request returns 401 and auto-clears the flag. */
let forceNext401 = false;

function jsonResponse(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleToolCall(name, args) {
  if (name === "get_weather") {
    return {
      content: [{ type: "text", text: `Weather in ${args.city}: 14°C` }],
      isError: false,
    };
  }
  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
}

function handleRpc(msg) {
  switch (msg.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return handleToolCall(msg.params.name, msg.params.arguments);
    default:
      return undefined;
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

async function handleMcpPost(req, res) {
  const auth = req.headers.authorization;
  if (forceNext401) {
    forceNext401 = false;
    res.writeHead(401, {
      "content-type": "application/json",
      "www-authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
    });
    res.end(JSON.stringify({ error: "forced" }));
    return;
  }
  if (auth !== `Bearer ${VALID_TOKEN}`) {
    res.writeHead(401, {
      "content-type": "application/json",
      "www-authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
    });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const body = await readBody(req);
  let msg;
  try {
    msg = JSON.parse(body);
  } catch {
    jsonResponse(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }

  // Notifications have no id — acknowledge with 204.
  if (msg.id === undefined) {
    res.writeHead(204);
    res.end();
    return;
  }

  const result = handleRpc(msg);
  if (result !== undefined) {
    jsonResponse(res, 200, { jsonrpc: "2.0", id: msg.id, result });
    return;
  }
  jsonResponse(res, 200, {
    jsonrpc: "2.0",
    id: msg.id,
    error: { code: -32601, message: `Method not found: ${msg.method}` },
  });
}

function handleProtectedResource(res) {
  jsonResponse(res, 200, {
    resource: ISSUER,
    authorization_servers: [ISSUER],
  });
}

function handleAuthServerMetadata(res) {
  jsonResponse(res, 200, {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    registration_endpoint: `${ISSUER}/register`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic"],
  });
}

async function handleRegister(req, res) {
  await readBody(req); // ignore the posted metadata — any input is accepted
  jsonResponse(res, 201, {
    client_id: CLIENT_ID,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: [],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}

function handleAuthorize(req, res) {
  const url = new URL(req.url, ISSUER);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "";
  if (!redirectUri) {
    res.writeHead(400);
    res.end("missing redirect_uri");
    return;
  }
  // Issue a fresh one-time code and redirect the user back to the client.
  const code = `code-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  issuedCodes.set(code, state);
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);
  res.writeHead(302, { location: target.toString() });
  res.end();
}

async function handleToken(req, res) {
  const body = await readBody(req);
  const params = new URLSearchParams(body);
  const grantType = params.get("grant_type");
  const code = params.get("code");
  if (grantType !== "authorization_code") {
    jsonResponse(res, 400, { error: "unsupported_grant_type" });
    return;
  }
  if (!code || !issuedCodes.has(code)) {
    jsonResponse(res, 400, { error: "invalid_grant" });
    return;
  }
  issuedCodes.delete(code);
  jsonResponse(res, 200, {
    access_token: VALID_TOKEN,
    token_type: "Bearer",
    expires_in: 3600,
  });
}

function handleForceNext401(res) {
  forceNext401 = true;
  jsonResponse(res, 200, { ok: true });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ISSUER);

  if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
    return handleProtectedResource(res);
  }
  if (req.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
    return handleAuthServerMetadata(res);
  }
  if (req.method === "POST" && url.pathname === "/register") {
    return handleRegister(req, res);
  }
  if (req.method === "GET" && url.pathname === "/authorize") {
    return handleAuthorize(req, res);
  }
  if (req.method === "POST" && url.pathname === "/token") {
    return handleToken(req, res);
  }
  if (req.method === "POST" && url.pathname === "/__force_next_401") {
    return handleForceNext401(res);
  }
  if (req.method === "POST" && (url.pathname === "/" || url.pathname === "/mcp")) {
    return handleMcpPost(req, res);
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Mock OAuth MCP HTTP server listening on ${ISSUER}`);
});
