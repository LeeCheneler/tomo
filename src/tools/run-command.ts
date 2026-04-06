import { spawn } from "node:child_process";
import { z } from "zod";
import { isCommandAllowed, isCompoundCommand } from "./command-safety";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Default command timeout in seconds. */
const DEFAULT_TIMEOUT_SECONDS = 30;

/** Zod schema for run_command arguments. */
const argsSchema = z.object({
  command: z.string().min(1, "no command provided"),
  timeout: z.number().positive().default(DEFAULT_TIMEOUT_SECONDS),
});

/** Result of a spawned process. */
interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Spawns a shell command and collects its output. */
function spawnCommand(
  command: string,
  timeoutMs: number,
  signal: AbortSignal,
  onProgress?: (output: string) => void,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn("/bin/sh", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let combined = "";
    let timedOut = false;

    const onAbort = () => proc.kill("SIGTERM");
    signal.addEventListener("abort", onAbort, { once: true });

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      combined += text;
      onProgress?.(combined);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      combined += text;
      onProgress?.(combined);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });

    proc.on("error", (error) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve({
        exitCode: null,
        stdout,
        stderr: error.message,
        timedOut: false,
      });
    });
  });
}

/** Formats the process result into a string for the LLM. */
function formatResult(result: RunResult, timeoutSeconds: number): string {
  const parts: string[] = [];

  if (result.timedOut) {
    parts.push(`Command timed out after ${timeoutSeconds}s`);
  }

  parts.push(`Exit code: ${result.exitCode ?? "unknown"}`);

  if (result.stdout) {
    parts.push(`stdout:\n${result.stdout}`);
  }

  if (result.stderr) {
    parts.push(`stderr:\n${result.stderr}`);
  }

  return parts.join("\n\n");
}

/** The run_command tool definition. */
export const runCommandTool: Tool = {
  name: "run_command",
  displayName: "Run Command",
  description: `Run a shell command and return its output.

- Commands run in /bin/sh in the current working directory.
- Use this for build commands, test runners, git operations, and general shell tasks.
- Do NOT use this for reading files (use read_file), searching files (use grep/glob), or writing files (use write_file/edit_file).
- Commands that match the user's allowed-commands list run without confirmation. All other commands require explicit approval.
- Compound commands (using &&, ||, ;, |, redirections) always require confirmation regardless of the allowed list.
- The timeout parameter is in seconds (default ${DEFAULT_TIMEOUT_SECONDS}s). Increase it for long-running commands like builds or test suites.`,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      timeout: {
        type: "number",
        description: `Timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS}). Increase for slow commands.`,
      },
    },
    required: ["command"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.command ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const command = parsed.command;
    const timeoutSeconds = parsed.timeout;

    // Compound commands always require confirmation
    const needsConfirmation =
      isCompoundCommand(command) ||
      !isCommandAllowed(command, context.allowedCommands);

    if (needsConfirmation) {
      const approved = await context.confirm(`Run command: ${command}`);
      if (!approved) {
        return denied("The user denied this command.");
      }
    }

    const result = await spawnCommand(
      command,
      timeoutSeconds * 1000,
      context.signal,
      context.onProgress,
    );

    const output = formatResult(result, timeoutSeconds);
    return result.exitCode === 0 ? ok(output) : err(output);
  },
};
