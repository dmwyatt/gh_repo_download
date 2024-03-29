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
        downloader: resolve("./downloader/vite_assets/downloader.js"),
        download: resolve("./downloader/vite_assets/download.js"),
      },
    },
  },
  plugins: [wasm(), topLevelAwait()],
});
