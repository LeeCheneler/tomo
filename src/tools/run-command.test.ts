import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockToolContext } from "../test-utils/stub-context";
import { runCommandTool } from "./run-command";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockedSpawn = vi.mocked(spawn);

/**
 * Creates a mock child process that emits the given stdout/stderr then closes.
 * When `hang` is true, the process does not close on its own — it only emits
 * close (with code null) when kill() is called, simulating a timeout scenario.
 */
function createMockProcess(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  errorEvent?: Error;
  hang?: boolean;
}): ChildProcess {
  const stdoutStream = new EventEmitter();
  const stderrStream = new EventEmitter();
  const proc = Object.assign(new EventEmitter(), {
    stdout: stdoutStream,
    stderr: stderrStream,
    stdin: null,
    stdio: [null, stdoutStream, stderrStream, null, null],
    pid: 1234,
    kill: vi.fn(() => true),
    connected: false,
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: "",
  });

  if (opts.hang) {
    // Emit output but don't close — close only when killed
    proc.kill = vi.fn(() => {
      proc.emit("close", null);
      return true;
    });
    setImmediate(() => {
      if (opts.stdout) stdoutStream.emit("data", Buffer.from(opts.stdout));
      if (opts.stderr) stderrStream.emit("data", Buffer.from(opts.stderr));
    });
  } else {
    // Normal: emit output then close
    setImmediate(() => {
      if (opts.errorEvent) {
        proc.emit("error", opts.errorEvent);
        return;
      }
      if (opts.stdout) stdoutStream.emit("data", Buffer.from(opts.stdout));
      if (opts.stderr) stderrStream.emit("data", Buffer.from(opts.stderr));
      proc.emit("close", opts.exitCode ?? 0);
    });
  }

  // The EventEmitter + Object.assign satisfies ChildProcess for spawn mock purposes
  return proc satisfies EventEmitter as unknown as ChildProcess;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("runCommandTool", () => {
  it("has correct name and parameters", () => {
    expect(runCommandTool.name).toBe("run_command");
    expect(runCommandTool.parameters).toHaveProperty("properties");
    expect(runCommandTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the command argument", () => {
      expect(runCommandTool.formatCall({ command: "git status" })).toBe(
        "git status",
      );
    });

    it("returns empty string when command is missing", () => {
      expect(runCommandTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("runs a simple command and returns stdout", async () => {
      mockedSpawn.mockReturnValue(
        createMockProcess({ stdout: "hello\n", exitCode: 0 }),
      );

      const result = await runCommandTool.execute(
        { command: "echo hello" },
        mockToolContext({ allowedCommands: ["echo:*"] }),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("Exit code: 0");
      expect(result.output).toContain("stdout:\nhello\n");
      expect(mockedSpawn).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", "echo hello"],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    });

    it("returns error status for non-zero exit code", async () => {
      mockedSpawn.mockReturnValue(
        createMockProcess({ stderr: "not found\n", exitCode: 1 }),
      );

      const result = await runCommandTool.execute(
        { command: "false" },
        mockToolContext({ allowedCommands: ["false"] }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("Exit code: 1");
      expect(result.output).toContain("stderr:\nnot found\n");
    });

    it("includes both stdout and stderr when present", async () => {
      mockedSpawn.mockReturnValue(
        createMockProcess({
          stdout: "output\n",
          stderr: "warning\n",
          exitCode: 0,
        }),
      );

      const result = await runCommandTool.execute(
        { command: "cmd" },
        mockToolContext({ allowedCommands: ["cmd"] }),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("stdout:\noutput\n");
      expect(result.output).toContain("stderr:\nwarning\n");
    });

    it("handles spawn errors", async () => {
      mockedSpawn.mockReturnValue(
        createMockProcess({ errorEvent: new Error("spawn failed") }),
      );

      const result = await runCommandTool.execute(
        { command: "bogus" },
        mockToolContext({ allowedCommands: ["bogus"] }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("Exit code: unknown");
      expect(result.output).toContain("stderr:\nspawn failed");
    });

    it("reports timeout when command exceeds the timeout", async () => {
      vi.useFakeTimers();
      mockedSpawn.mockReturnValue(
        createMockProcess({ stdout: "partial\n", hang: true }),
      );

      const promise = runCommandTool.execute(
        { command: "sleep 999", timeout: 5 },
        mockToolContext({ allowedCommands: ["sleep:*"] }),
      );

      // Flush setImmediate so stdout is emitted, then advance past the timeout
      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;

      expect(result.status).toBe("error");
      expect(result.output).toContain("Command timed out after 5s");
      expect(result.output).toContain("Exit code: unknown");
      expect(result.output).toContain("stdout:\npartial\n");
      vi.useRealTimers();
    });

    it("kills the process when the abort signal fires", async () => {
      const proc = createMockProcess({ hang: true });
      mockedSpawn.mockReturnValue(proc);
      const controller = new AbortController();

      const promise = runCommandTool.execute(
        { command: "sleep 999" },
        mockToolContext({
          allowedCommands: ["sleep:*"],
          signal: controller.signal,
        }),
      );

      // Let setImmediate flush, then abort
      await new Promise((r) => setImmediate(r));
      controller.abort();

      const result = await promise;
      expect(result.output).toContain("Exit code: unknown");
    });

    it("calls onProgress with combined output", async () => {
      mockedSpawn.mockReturnValue(
        createMockProcess({ stdout: "line1\n", exitCode: 0 }),
      );
      const onProgress = vi.fn();

      await runCommandTool.execute(
        { command: "cmd" },
        mockToolContext({ allowedCommands: ["cmd"], onProgress }),
      );

      expect(onProgress).toHaveBeenCalledWith("line1\n");
    });

    describe("permissions", () => {
      it("auto-approves commands in the allowed list", async () => {
        mockedSpawn.mockReturnValue(
          createMockProcess({ stdout: "ok\n", exitCode: 0 }),
        );
        const confirm = vi.fn();

        await runCommandTool.execute(
          { command: "npm test" },
          mockToolContext({ allowedCommands: ["npm test"], confirm }),
        );

        expect(confirm).not.toHaveBeenCalled();
      });

      it("auto-approves commands matching a prefix pattern", async () => {
        mockedSpawn.mockReturnValue(
          createMockProcess({ stdout: "ok\n", exitCode: 0 }),
        );
        const confirm = vi.fn();

        await runCommandTool.execute(
          { command: "git diff --staged" },
          mockToolContext({ allowedCommands: ["git:*"], confirm }),
        );

        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for commands not in the allowed list", async () => {
        mockedSpawn.mockReturnValue(
          createMockProcess({ stdout: "ok\n", exitCode: 0 }),
        );
        const confirm = vi.fn(async () => true);

        await runCommandTool.execute(
          { command: "rm -rf /" },
          mockToolContext({ allowedCommands: ["git:*"], confirm }),
        );

        expect(confirm).toHaveBeenCalledWith("Run command: rm -rf /");
      });

      it("returns denied when user rejects", async () => {
        const confirm = vi.fn(async () => false);

        const result = await runCommandTool.execute(
          { command: "rm -rf /" },
          mockToolContext({ confirm }),
        );

        expect(result.status).toBe("denied");
        expect(mockedSpawn).not.toHaveBeenCalled();
      });

      it("always prompts for compound commands even if base is allowed", async () => {
        mockedSpawn.mockReturnValue(
          createMockProcess({ stdout: "ok\n", exitCode: 0 }),
        );
        const confirm = vi.fn(async () => true);

        await runCommandTool.execute(
          { command: "git add . && git commit" },
          mockToolContext({ allowedCommands: ["git:*"], confirm }),
        );

        expect(confirm).toHaveBeenCalledOnce();
      });

      it("always prompts for piped commands even if base is allowed", async () => {
        mockedSpawn.mockReturnValue(
          createMockProcess({ stdout: "ok\n", exitCode: 0 }),
        );
        const confirm = vi.fn(async () => true);

        await runCommandTool.execute(
          { command: "git log | head -5" },
          mockToolContext({ allowedCommands: ["git:*"], confirm }),
        );

        expect(confirm).toHaveBeenCalledOnce();
      });
    });
  });
});
