import { execSync } from "node:child_process";
import React from "react";
import { CommandConfirm } from "../components/command-confirm";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

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
    const parsed = JSON.parse(args);
    const command: string = parsed.command ?? "";

    if (!command.trim()) {
      return "Error: no command provided";
    }

    const approved = await context.renderInteractive((onResult, onCancel) =>
      React.createElement(CommandConfirm, {
        command,
        onApprove: () => onResult("approved"),
        onDeny: () => onCancel(),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this command.";
    }

    try {
      const stdout = execSync(command, {
        encoding: "utf-8",
        timeout: DEFAULT_TIMEOUT_MS,
        stdio: ["pipe", "pipe", "pipe"],
        shell: "/bin/sh",
      });

      return formatResult(0, stdout, "");
    } catch (err) {
      if (isExecError(err)) {
        if (err.killed) {
          return `Command timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`;
        }
        return formatResult(
          err.status ?? 1,
          err.stdout?.toString() ?? "",
          err.stderr?.toString() ?? "",
        );
      }
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

function formatResult(
  exitCode: number,
  stdout: string,
  stderr: string,
): string {
  const parts = [`Exit code: ${exitCode}`];
  if (stdout.trim()) {
    parts.push(`\nstdout:\n${stdout.trim()}`);
  }
  if (stderr.trim()) {
    parts.push(`\nstderr:\n${stderr.trim()}`);
  }
  return parts.join("\n");
}

interface ExecError extends Error {
  status?: number;
  killed?: boolean;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
}

function isExecError(err: unknown): err is ExecError {
  return err instanceof Error && "status" in err;
}
