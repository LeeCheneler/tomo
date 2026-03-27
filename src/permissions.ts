import { resolve } from "node:path";
import type { ToolContext } from "./tools/types";

/** Tool names that support configurable permissions. */
export type ToolPermission = "read_file" | "write_file";

/** Permission config as stored in YAML. All fields optional — defaults fill gaps. */
export type PermissionsConfig = Partial<Record<ToolPermission, boolean>>;

/** Default permissions: read enabled, write disabled. */
export const DEFAULT_PERMISSIONS: Record<ToolPermission, boolean> = {
  read_file: true,
  write_file: false,
};

/** Merges stored permission config onto defaults. */
export function resolvePermissions(
  config?: PermissionsConfig,
): Record<ToolPermission, boolean> {
  return { ...DEFAULT_PERMISSIONS, ...config };
}

/** Returns true if the resolved file path is within the current working directory. */
export function isPathWithinCwd(filePath: string): boolean {
  const resolved = resolve(filePath);
  const cwd = process.cwd();
  return resolved === cwd || resolved.startsWith(`${cwd}/`);
}

/**
 * Shared guard: auto-approve if permission is granted and path is within cwd,
 * otherwise render a confirmation prompt and execute only on approval.
 */
export async function withFilePermission(opts: {
  context: ToolContext;
  permission: ToolPermission;
  filePath: string;
  execute: () => string | Promise<string>;
  renderConfirm: () => Promise<string>;
  denyMessage: string;
}): Promise<string> {
  const { context, permission, filePath, execute, renderConfirm, denyMessage } =
    opts;

  if (context.permissions[permission] && isPathWithinCwd(filePath)) {
    return execute();
  }

  const result = await renderConfirm();
  if (result !== "approved") return denyMessage;
  return execute();
}
