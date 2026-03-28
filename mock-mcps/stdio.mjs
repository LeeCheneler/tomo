#!/usr/bin/env node

// MCP stdio server — reads newline-delimited JSON from stdin, writes to stdout.
// Tools: get_time (current time in a timezone), coin_flip (flip a coin)

import { createInterface } from "readline";

const SERVER_INFO = { name: "mock-stdio-server", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "get_time",
    description: "Returns the current date and time in the specified timezone",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone identifier (e.g. America/New_York, Europe/London, Asia/Tokyo)",
        },
      },
      required: ["timezone"],
    },
  },
  {
    name: "coin_flip",
    description: "Flips a coin and returns heads or tails",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

function handleToolCall(name, args) {
  switch (name) {
    case "get_time": {
      try {
        const now = new Date();
        const formatted = now.toLocaleString("en-GB", {
          timeZone: args.timezone,
          dateStyle: "full",
          timeStyle: "long",
        });
        return {
          content: [
            { type: "text", text: `${formatted} (${args.timezone})` },
          ],
          isError: false,
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Unknown timezone: ${args.timezone}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "coin_flip": {
      const result = Math.random() < 0.5 ? "Heads" : "Tails";
      return {
        content: [{ type: "text", text: result }],
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
