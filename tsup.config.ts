import { defineConfig } from "tsup";

export default defineConfig({
  entry: { tomo: "src/index.tsx" },
  outDir: "dist",
  format: "esm",
  bundle: true,
  noExternal: [/.*/],
});
