/// <reference types="node" />
import { defineConfig } from "vite";

// Tauri expects a fixed port and never opens a browser tab.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Relative base so the same `dist/` works at "/" (Tauri, local preview)
  // and under "/repo-name/" (GitHub Pages). The manifest + SW use "./"
  // accordingly.
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri-side files are watched by cargo, ignore them in Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
