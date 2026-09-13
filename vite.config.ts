import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { version } from "./package.json";

// https://vite.dev/config/
export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(), // dynamic import avoids externalize-deps issue
    (await import("@tailwindcss/vite")).default(),
    viteStaticCopy({
      targets: [
        { src: "src/assets/*", dest: "assets" },
        { src: "src/assets/printer-maintenance.*", dest: "." }, // Copy icons to root for easier access
      ],
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
