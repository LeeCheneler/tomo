import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Permissions } from "../config/schema";
import { checkFilePermission, isPathWithinCwd } from "./permissions";

describe("isPathWithinCwd", () => {
  it("returns true for a file inside cwd", () => {
    const filePath = resolve(process.cwd(), "src/foo.ts");
    expect(isPathWithinCwd(filePath)).toBe(true);
  });

  it("returns true for cwd itself", () => {
    expect(isPathWithinCwd(process.cwd())).toBe(true);
  });

  it("returns true for a relative path that resolves inside cwd", () => {
    expect(isPathWithinCwd("src/foo.ts")).toBe(true);
  });

  it("returns false for a path outside cwd", () => {
    expect(isPathWithinCwd("/etc/passwd")).toBe(false);
  });

  it("returns false for a parent directory", () => {
    expect(isPathWithinCwd("..")).toBe(false);
  });
});

describe("checkFilePermission", () => {
  /** Builds a Permissions object with all fields defaulted to false. */
  function perms(overrides: Partial<Permissions> = {}): Permissions {
    return {
      cwdReadFile: false,
      cwdWriteFile: false,
      cwdRemoveFile: false,
      globalReadFile: false,
      globalWriteFile: false,
      globalRemoveFile: false,
      ...overrides,
    };
  }

  /** A file path inside cwd. */
  const cwdFile = resolve(process.cwd(), "src/foo.ts");

  /** A file path outside cwd. */
  const globalFile = "/etc/passwd";

  describe("cwd read", () => {
    it("returns allowed when cwdReadFile is true", () => {
      expect(
        checkFilePermission(cwdFile, "read", perms({ cwdReadFile: true })),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when cwdReadFile is false", () => {
      expect(
        checkFilePermission(cwdFile, "read", perms({ cwdReadFile: false })),
      ).toBe("needs-confirmation");
    });
  });

  describe("cwd write", () => {
    it("returns allowed when cwdWriteFile is true", () => {
      expect(
        checkFilePermission(cwdFile, "write", perms({ cwdWriteFile: true })),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when cwdWriteFile is false", () => {
      expect(
        checkFilePermission(cwdFile, "write", perms({ cwdWriteFile: false })),
      ).toBe("needs-confirmation");
    });
  });

  describe("global read", () => {
    it("returns allowed when globalReadFile is true", () => {
      expect(
        checkFilePermission(
          globalFile,
          "read",
          perms({ globalReadFile: true }),
        ),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when globalReadFile is false", () => {
      expect(
        checkFilePermission(
          globalFile,
          "read",
          perms({ globalReadFile: false }),
        ),
      ).toBe("needs-confirmation");
    });
  });

  describe("global write", () => {
    it("returns allowed when globalWriteFile is true", () => {
      expect(
        checkFilePermission(
          globalFile,
          "write",
          perms({ globalWriteFile: true }),
        ),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when globalWriteFile is false", () => {
      expect(
        checkFilePermission(
          globalFile,
          "write",
          perms({ globalWriteFile: false }),
        ),
      ).toBe("needs-confirmation");
    });
  });

  describe("cwd remove", () => {
    it("returns allowed when cwdRemoveFile is true", () => {
      expect(
        checkFilePermission(cwdFile, "remove", perms({ cwdRemoveFile: true })),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when cwdRemoveFile is false", () => {
      expect(
        checkFilePermission(cwdFile, "remove", perms({ cwdRemoveFile: false })),
      ).toBe("needs-confirmation");
    });
  });

  describe("global remove", () => {
    it("returns allowed when globalRemoveFile is true", () => {
      expect(
        checkFilePermission(
          globalFile,
          "remove",
          perms({ globalRemoveFile: true }),
        ),
      ).toBe("allowed");
    });

    it("returns needs-confirmation when globalRemoveFile is false", () => {
      expect(
        checkFilePermission(
          globalFile,
          "remove",
          perms({ globalRemoveFile: false }),
        ),
      ).toBe("needs-confirmation");
    });
  });

  describe("undefined permissions", () => {
    it("treats undefined cwdWriteFile as needs-confirmation", () => {
      const p = { cwdReadFile: true } as Permissions;
      expect(checkFilePermission(cwdFile, "write", p)).toBe(
        "needs-confirmation",
      );
    });

    it("treats undefined globalReadFile as needs-confirmation", () => {
      const p = { cwdReadFile: true } as Permissions;
      expect(checkFilePermission(globalFile, "read", p)).toBe(
        "needs-confirmation",
      );
    });

    it("treats undefined cwdRemoveFile as needs-confirmation", () => {
      const p = { cwdReadFile: true } as Permissions;
      expect(checkFilePermission(cwdFile, "remove", p)).toBe(
        "needs-confirmation",
      );
    });

    it("treats undefined globalRemoveFile as needs-confirmation", () => {
      const p = { cwdReadFile: true } as Permissions;
      expect(checkFilePermission(globalFile, "remove", p)).toBe(
        "needs-confirmation",
      );
    });
  });
});
