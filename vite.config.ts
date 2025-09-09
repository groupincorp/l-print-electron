import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(), // dynamic import avoids externalize-deps issue
    (await import("@tailwindcss/vite")).default(),
    viteStaticCopy({
      targets: [{ src: "src/assets/*", dest: "assets" }],
    }),
  ],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
