import { defineConfig } from "tsup";

export default defineConfig({
  entry: { tomo: "src/index.tsx" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});
