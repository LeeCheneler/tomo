#!/usr/bin/env node

// MCP HTTP server — accepts JSON-RPC over POST on port 9876.
// Tools: get_weather (fake weather for a city), random_number (random int in range)

import { createServer } from "http";

const SERVER_INFO = { name: "mock-http-server", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";
const PORT = process.env.PORT || 9876;

const TOOLS = [
  {
    name: "get_weather",
    description: "Returns fake weather data for a city",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
  {
    name: "random_number",
    description: "Returns a random integer between min and max (inclusive)",
    inputSchema: {
      type: "object",
      properties: {
        min: { type: "number", description: "Minimum value" },
        max: { type: "number", description: "Maximum value" },
      },
      required: ["min", "max"],
    },
  },
];

const WEATHER_DATA = {
  london: { temp: 14, condition: "Overcast", humidity: 78 },
  tokyo: { temp: 22, condition: "Sunny", humidity: 55 },
  new_york: { temp: 18, condition: "Partly cloudy", humidity: 62 },
};

function handleToolCall(name, args) {
  switch (name) {
    case "get_weather": {
      const key = args.city.toLowerCase().replace(/\s+/g, "_");
      const weather = WEATHER_DATA[key] || {
        temp: 20,
        condition: "Clear",
        humidity: 50,
      };
      const text = `Weather in ${args.city}: ${weather.temp}°C, ${weather.condition}, ${weather.humidity}% humidity`;
      return { content: [{ type: "text", text }], isError: false };
    }
    case "random_number": {
      const val =
        Math.floor(Math.random() * (args.max - args.min + 1)) + args.min;
      return {
        content: [{ type: "text", text: String(val) }],
        isError: false,
      };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

function handleRequest(msg) {
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

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let msg;
    try {
      msg = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }),
      );
      return;
    }

    // Notifications (no id) — acknowledge with 204
    if (msg.id === undefined) {
      res.writeHead(204);
      res.end();
      return;
    }

    const result = handleRequest(msg);
    res.writeHead(200, { "Content-Type": "application/json" });

    if (result !== undefined) {
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
    } else {
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: `Method not found: ${msg.method}` },
        }),
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mock MCP HTTP server listening on http://localhost:${PORT}`);
});
