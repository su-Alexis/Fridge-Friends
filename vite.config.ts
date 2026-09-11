import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  // Relative URLs support both account sites and /repository/ project sites,
  // as well as a future native bundle, without a hardcoded repository name.
  base: "./",
  plugins: [
    react(),
    {
      name: "local-development-csp",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          if (command !== "serve") return html;
          // React Fast Refresh uses an inline preamble and a local WebSocket.
          // The production document keeps the strict policy in index.html.
          return html
            .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
            .replace(
              "connect-src 'none';",
              "connect-src 'self' ws://127.0.0.1:* ws://localhost:*;",
            );
        },
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    watch:
      process.env.CODEX_SANDBOX === "seatbelt"
        ? { useFsEvents: false, usePolling: true }
        : undefined,
  },
  preview: { host: "127.0.0.1" },
  build: { target: ["safari16.4", "chrome110"], sourcemap: false },
}));
