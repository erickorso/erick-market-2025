import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4010",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:4010",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
