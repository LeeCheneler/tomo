import { vi } from "vitest";
// Namespace import required for vi.spyOn to work on ESM named exports
import * as fsUtils from "../utils/fs";

/** Virtual filesystem state. */
export interface MockFsState {
  /** Returns the content of a file in the virtual filesystem. */
  getFile: (path: string) => string | undefined;
  /** Returns all file paths in the virtual filesystem. */
  getPaths: () => string[];
  /** Returns all explicitly tracked directory paths in the virtual filesystem. */
  getDirs: () => string[];
  /** Restores all mocked fs functions. */
  restore: () => void;
}

/**
 * Creates a virtual filesystem by mocking utils/fs functions.
 * Tests can declare files as a plain object of path to content, and optional
 * explicit empty directories as the second argument. Writes and removals are
 * captured in memory and can be read back via getFile/getDirs.
 */
export function mockFs(
  initialFiles: Record<string, string> = {},
  initialDirs: string[] = [],
): MockFsState {
  const files = new Map(Object.entries(initialFiles));
  const dirs = new Set<string>(initialDirs);

  /** Returns true if any file in the map is nested under the given directory path. */
  function hasChildren(dirPath: string): boolean {
    const prefix = `${dirPath}/`;
    return [...files.keys()].some((k) => k.startsWith(prefix));
  }

  /** Returns true if the path is a tracked directory (explicit or inferred from file prefixes). */
  function isDir(path: string): boolean {
    return dirs.has(path) || hasChildren(path);
  }

  const fileExistsSpy = vi
    .spyOn(fsUtils, "fileExists")
    .mockImplementation((path) => files.has(path));

  const readFileSpy = vi
    .spyOn(fsUtils, "readFile")
    .mockImplementation((path) => {
      const content = files.get(path);
      if (content === undefined) {
        const err = new Error(
          `ENOENT: no such file or directory, open '${path}'`,
        );
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      return content;
    });

  const writeFileSpy = vi
    .spyOn(fsUtils, "writeFile")
    .mockImplementation((path, data) => {
      files.set(path, data);
    });

  const appendFileSpy = vi
    .spyOn(fsUtils, "appendFile")
    .mockImplementation((path, data) => {
      files.set(path, (files.get(path) ?? "") + data);
    });

  const listDirSpy = vi
    .spyOn(fsUtils, "listDir")
    .mockImplementation((dirPath) => {
      const prefix = `${dirPath}/`;
      // Extract the first path segment after the prefix for each matching key,
      // returning both files and subdirectory names like real readdirSync.
      const entries = new Set<string>();
      for (const k of files.keys()) {
        if (!k.startsWith(prefix)) continue;
        const remainder = k.slice(prefix.length);
        const segment = remainder.split("/")[0];
        entries.add(segment);
      }
      return [...entries];
    });

  const isDirectorySpy = vi
    .spyOn(fsUtils, "isDirectory")
    .mockImplementation((path) => isDir(path));

  const ensureDirSpy = vi
    .spyOn(fsUtils, "ensureDir")
    .mockImplementation((path) => {
      dirs.add(path);
    });

  const removeFileSpy = vi
    .spyOn(fsUtils, "removeFile")
    .mockImplementation((path) => {
      if (!files.has(path)) {
        const err = new Error(
          `ENOENT: no such file or directory, unlink '${path}'`,
        );
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      files.delete(path);
    });

  const removeDirSpy = vi
    .spyOn(fsUtils, "removeDir")
    .mockImplementation((path, recursive) => {
      if (!isDir(path)) {
        const err = new Error(
          `ENOENT: no such file or directory, rmdir '${path}'`,
        );
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      if (!recursive && hasChildren(path)) {
        const err = new Error(
          `ENOTEMPTY: directory not empty, rmdir '${path}'`,
        );
        (err as NodeJS.ErrnoException).code = "ENOTEMPTY";
        throw err;
      }
      const prefix = `${path}/`;
      for (const k of [...files.keys()]) {
        if (k.startsWith(prefix)) files.delete(k);
      }
      dirs.delete(path);
      for (const d of [...dirs]) {
        if (d.startsWith(prefix)) dirs.delete(d);
      }
    });

  return {
    getFile(path: string) {
      return files.get(path);
    },
    getPaths() {
      return [...files.keys()];
    },
    getDirs() {
      return [...dirs];
    },
    restore() {
      fileExistsSpy.mockRestore();
      readFileSpy.mockRestore();
      writeFileSpy.mockRestore();
      appendFileSpy.mockRestore();
      listDirSpy.mockRestore();
      isDirectorySpy.mockRestore();
      ensureDirSpy.mockRestore();
      removeFileSpy.mockRestore();
      removeDirSpy.mockRestore();
    },
  };
}
