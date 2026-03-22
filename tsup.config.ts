import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
  entry: { tomo: "src/index.tsx" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  define: {
    TOMO_VERSION: JSON.stringify(version),
  },
  banner: {
    js: 'import { createRequire as __banner_cjsRequire__ } from "module"; const require = __banner_cjsRequire__(import.meta.url);',
  },
});
