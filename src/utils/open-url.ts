import { spawn } from "node:child_process";

/**
 * Launches the system browser pointed at the given URL via macOS `open`.
 *
 * Resolves once the launcher subprocess has been spawned — not when the
 * browser finishes loading the page. Rejects if the spawn itself fails (for
 * example if `open` is not on `PATH`, which would happen on a non-macOS
 * host). The child is detached and unref'd so it outlives this process's
 * current tick.
 */
export function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("open", [url], {
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
