import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const mediaIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // FFmpeg ships its own worker entry; prebundling it can break core imports in Vite.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  server: {
    host: "0.0.0.0",
    headers: mediaIsolationHeaders,
  },
  preview: {
    headers: mediaIsolationHeaders,
  },
});
