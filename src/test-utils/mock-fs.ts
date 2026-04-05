import { vi } from "vitest";
// Namespace import required for vi.spyOn to work on ESM named exports
import * as fsUtils from "../utils/fs";

/** Virtual filesystem state. */
export interface MockFsState {
  /** Returns the content of a file in the virtual filesystem. */
  getFile: (path: string) => string | undefined;
  /** Returns all file paths in the virtual filesystem. */
  getPaths: () => string[];
  /** Restores all mocked fs functions. */
  restore: () => void;
}

/**
 * Creates a virtual filesystem by mocking utils/fs functions.
 * Tests can declare files as a plain object of path to content.
 * Writes are captured in memory and can be read back via getFile.
 */
export function mockFs(initialFiles: Record<string, string> = {}): MockFsState {
  const files = new Map(Object.entries(initialFiles));

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

  const ensureDirSpy = vi
    .spyOn(fsUtils, "ensureDir")
    .mockImplementation(() => {});

  return {
    getFile(path: string) {
      return files.get(path);
    },
    getPaths() {
      return [...files.keys()];
    },
    restore() {
      fileExistsSpy.mockRestore();
      readFileSpy.mockRestore();
      writeFileSpy.mockRestore();
      appendFileSpy.mockRestore();
      ensureDirSpy.mockRestore();
    },
  };
}
