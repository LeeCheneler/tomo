import { spawn } from "node:child_process";
import { createElement } from "react";
import { z } from "zod";
import { isCommandAllowed, isCompoundCommand } from "../command-safety";
import { CommandConfirm } from "../components/command-confirm";
import { addAllowedCommand } from "../config";
import { registerTool } from "./registry";
import {
  denied,
  err,
  ok,
  parseToolArgs,
  type ToolContext,
  type ToolResult,
} from "./types";

const argsSchema = z.object({
  command: z.string().min(1, "no command provided"),
});

const DEFAULT_TIMEOUT_MS = 30_000;

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Runs a command via spawn, streaming output through onData as it arrives. */
function spawnCommand(
  command: string,
  timeout: number,
  onData: (accumulated: string) => void,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: "/bin/sh", stdio: "pipe" });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      onData(stdout);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout: "", stderr: err.message, timedOut });
    });
  });
}

async function runAndReport(
  command: string,
  context: ToolContext,
): Promise<ToolResult> {
  const result = await spawnCommand(command, DEFAULT_TIMEOUT_MS, (output) => {
    context.reportProgress(`$ ${command}\n${output}`);
  });

  context.reportProgress("");

  if (result.timedOut) {
    return err(
      `$ ${command}\nCommand timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`,
    );
  }

  return formatResult(command, result.exitCode, result.stdout, result.stderr);
}

async function promptAndRun(
  command: string,
  context: ToolContext,
): Promise<ToolResult> {
  const result = await context.renderInteractive((onResult, _onCancel) =>
    createElement(CommandConfirm, {
      command,
      onApprove: () => onResult("approved"),
      onApproveAlways: () => onResult("approved_always"),
      onDeny: () => onResult("denied"),
    }),
  );

  if (result === "denied") {
    return denied("The user denied this command.");
  }

  if (result === "approved_always") {
    addAllowedCommand(command);
  }

  return runAndReport(command, context);
}

registerTool({
  name: "run_command",
  displayName: "Run Command",
  description: `Execute a shell command via /bin/sh. Returns the exit code, stdout, and stderr.

- Commands time out after ${DEFAULT_TIMEOUT_MS / 1000} seconds.
- Do NOT use this for tasks that have dedicated tools:
  - Reading files → use read_file
  - Writing/editing files → use write_file or edit_file
  - Searching file names → use glob
  - Searching file contents → use grep
- Use this for: running tests, builds, linters, git commands, package managers, and other CLI operations.
- Commands may require user approval depending on the configured allow list.`,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
    },
    required: ["command"],
  },
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const { command } = parseToolArgs(argsSchema, args);

    // 1. Exact match — auto-approve
    // 2. Compound — skip prefix matching, prompt
    // 3. Prefix match (word:*) — auto-approve
    const compound = isCompoundCommand(command);
    if (
      isCommandAllowed(command, context.allowedCommands, {
        skipPrefix: compound,
      })
    ) {
      return runAndReport(command, context);
    }

    // 4. Prompt for everything else
    return promptAndRun(command, context);
  },
});

function formatResult(
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): ToolResult {
  const parts = [`$ ${command}`, `Exit code: ${exitCode}`];
  if (stdout.trim()) {
    parts.push(`\nstdout:\n${stdout.trim()}`);
  }
  if (stderr.trim()) {
    parts.push(`\nstderr:\n${stderr.trim()}`);
  }
  const output = parts.join("\n");
  return exitCode === 0 ? ok(output) : err(output);
}
