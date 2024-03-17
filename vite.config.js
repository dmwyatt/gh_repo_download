import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/static/",
  build: {
    modulePreload: true,
    outDir: resolve("./staticfiles/"),
    assetsDir: "",
    manifest: "manifest.json",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve("./downloader/vite_assets/main.js"),
      },
    },
  },
  plugins: [wasm(), topLevelAwait()],
});
