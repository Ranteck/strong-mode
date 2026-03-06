import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  target: "node22",
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
