import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "https://yewffntzgrdgztrwtava.supabase.co";

  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlld2ZmbnR6Z3JkZ3p0cnd0YXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODcxNDUsImV4cCI6MjA4MzQ2MzE0NX0.Gugre6DaysctfwgBEIg_OQlgngDJqIl1l6ulwCUfgJE";

  // Release Sentry : SHA du commit courant, pour corréler erreurs et déploiements.
  let commitSha = process.env.VITE_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "";
  if (!commitSha) {
    try {
      commitSha = execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch (err) {
      void err; // build hors dépôt git — pas de release
    }
  }

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_COMMIT_SHA": JSON.stringify(commitSha),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    build: {
      minify: "esbuild",
      target: "es2020",
      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      sourcemap: mode === "development",
    },
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
  };
});
