import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    allowedHosts: ['eventos.karthikeyathota.page', '::', 'vultr.karthikeyathota.page'],
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        //target: "http://localhost:8000",
        target: "https://vultr.karthikeyathota.page",
	changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
