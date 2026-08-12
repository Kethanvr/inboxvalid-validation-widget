import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/widget/index.ts"),
      name: "InboxValidBundle",
      formats: ["iife"],
      fileName: () => "inboxvalid.js",
    },
    minify: "esbuild",
    sourcemap: true,
  },
});
