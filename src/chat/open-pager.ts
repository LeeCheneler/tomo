import { spawnSync } from "node:child_process";

/** Pager binaries that are safe to spawn. Anything else is treated as a no-op. */
const ALLOWED_PAGERS = new Set(["less", "more", "most", "bat", "cat"]);

/** Opens content in the system pager (less by default). No-op if PAGER is not allow-listed. */
export function openPager(content: string): void {
  const pager = process.env.PAGER || "less";
  if (!ALLOWED_PAGERS.has(pager)) {
    return;
  }
  spawnSync(pager, ["-R", "+G"], {
    input: content,
    stdio: ["pipe", "inherit", "inherit"],
  });
}
