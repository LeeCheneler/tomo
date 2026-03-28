#!/usr/bin/env node

// MCP stdio server — reads newline-delimited JSON from stdin, writes to stdout.
// Tools: echo (returns input text), add (adds two numbers)

import { createInterface } from "readline";

const SERVER_INFO = { name: "mock-stdio-server", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "echo",
    description: "Echoes back the provided text",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo" } },
      required: ["text"],
    },
  },
  {
    name: "add",
    description: "Adds two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
];

function handleToolCall(name, args) {
  switch (name) {
    case "echo":
      return { content: [{ type: "text", text: args.text }], isError: false };
    case "add":
      return {
        content: [{ type: "text", text: String(args.a + args.b) }],
        isError: false,
      };
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

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  if (!line.trim()) return;

  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  // Notifications (no id) don't get a response
  if (msg.id === undefined) return;

  const result = handleRequest(msg);
  if (result !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, result });
  } else {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    });
  }
});
