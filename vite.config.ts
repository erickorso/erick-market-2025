import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const marketApiPort = process.env.MARKET_API_PORT || "4010";

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
        target: `http://127.0.0.1:${marketApiPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://127.0.0.1:${marketApiPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
