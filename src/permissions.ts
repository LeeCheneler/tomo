import { resolve } from "node:path";

/** Tool names that support configurable permissions. */
export type ToolPermission = "read_file" | "write_file" | "edit_file";

/** Permission config as stored in YAML. All fields optional — defaults fill gaps. */
export type PermissionsConfig = Partial<Record<ToolPermission, boolean>>;

/** Default permissions: read enabled, write and edit disabled. */
export const DEFAULT_PERMISSIONS: Record<ToolPermission, boolean> = {
  read_file: true,
  write_file: false,
  edit_file: false,
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
