import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          framework: ["react", "react-dom", "react-router-dom"],
          auth: ["@auth0/auth0-react", "jose"],
          charts: ["recharts"],
        },
      },
    },
  },
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
