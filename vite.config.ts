import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
  base: mode === "github" ? "/scango/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "茜茜扫描",
        short_name: "茜茜扫描",
        description: "本地扫描、智能裁边、多页 PDF",
        theme_color: "#163feb",
        background_color: "#f5f7fb",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 16000000,
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 16000 },
}));
