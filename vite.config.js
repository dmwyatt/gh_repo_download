import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/static/",
  build: {
    modulePreload: true,
    outDir: resolve("./downloader/vite_assets_dist/"),
    manifest: "manifest.json",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        downloader: resolve("./downloader/vite_assets/downloader.js"),
        download: resolve("./downloader/vite_assets/download.js"),
        app: resolve("./downloader/vite_assets/new/app.js"),
      },
    },
  },
  plugins: [wasm(), topLevelAwait()],
});
