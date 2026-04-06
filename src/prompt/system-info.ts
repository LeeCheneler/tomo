import { arch, platform, release, userInfo } from "node:os";
import { env } from "../utils/env";

/** Builds a system info header with OS, architecture, shell, user, and cwd. */
export function getSystemInfo(): string {
  const os = platform();
  const osRelease = release();
  const shell = env.getOptional("SHELL") ?? "unknown";
  const cwd = process.cwd();
  const username = userInfo().username;
  const now = new Date().toISOString();
  return `System: ${os} (${osRelease}), arch: ${arch()}, shell: ${shell}, user: ${username}, cwd: ${cwd}, date: ${now}`;
}
