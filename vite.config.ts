/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico"],
      manifest: false, // We use the static public/manifest.json
      workbox: {
        // Cache pages and assets with a network-first strategy
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 24h
            },
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
        ],
        // Pre-cache the app shell
        globPatterns: ["**/*.{js,css,html,ico,svg}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    // Enable minification
    minify: "esbuild",
    // Target modern browsers for smaller output
    target: "es2020",
    // Chunk splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dropdown-menu",
          ],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-pdf": ["jspdf"],
          "vendor-charts": ["recharts"],
          "vendor-editor": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-link",
            "@tiptap/extension-underline",
            "@tiptap/extension-text-align",
          ],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    // CSS code splitting
    cssCodeSplit: true,
    // Source maps only in dev
    sourcemap: mode === "development",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  // Optimize deps for faster dev startup
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "lucide-react",
      "date-fns",
      "clsx",
      "tailwind-merge",
    ],
  },
}));
