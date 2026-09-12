import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, "electron/main.ts") } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, "electron/preload.ts") } },
  },
  renderer: {
    root: resolve(__dirname, "src"),
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, "src/index.html") } },
  },
});
