import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["replicad-opencascadejs"],
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@react-three/fiber",
      "three",
      "comlink",
      "file-saver",
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/v1": "http://127.0.0.1:8787",
      "/health": "http://127.0.0.1:8787",
    },
  },
});
