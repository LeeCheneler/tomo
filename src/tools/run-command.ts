import { spawn } from "node:child_process";
import { createElement } from "react";
import { z } from "zod";
import { CommandConfirm } from "../components/command-confirm";
import { registerTool } from "./registry";
import { type ToolContext, parseToolArgs } from "./types";

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

registerTool({
  name: "run_command",
  description:
    "Run a CLI command. The user will be prompted to approve or deny before execution.",
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
  async execute(args: string, context: ToolContext): Promise<string> {
    const { command } = parseToolArgs(argsSchema, args);

    const approved = await context.renderInteractive((onResult, _onCancel) =>
      createElement(CommandConfirm, {
        command,
        onApprove: () => onResult("approved"),
        onDeny: () => onResult("denied"),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this command.";
    }

    const result = await spawnCommand(command, DEFAULT_TIMEOUT_MS, (output) => {
      context.reportProgress(`$ ${command}\n${output}`);
    });

    // Clear streaming content now that we have the final result
    context.reportProgress("");

    if (result.timedOut) {
      return `$ ${command}\nCommand timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`;
    }

    return formatResult(command, result.exitCode, result.stdout, result.stderr);
  },
});

function formatResult(
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): string {
  const parts = [`$ ${command}`, `Exit code: ${exitCode}`];
  if (stdout.trim()) {
    parts.push(`\nstdout:\n${stdout.trim()}`);
  }
  if (stderr.trim()) {
    parts.push(`\nstderr:\n${stderr.trim()}`);
  }
  return parts.join("\n");
}
