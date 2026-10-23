import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Make .env available as process.env to server code during `npm run dev`.
// (In production, `npm start` passes --env-file=.env to Node instead.)
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file - rely on the real environment.
}

export default defineConfig(({ command }) => ({
  server: { port: Number(process.env["PORT"] ?? 3000) },
  resolve: {
    tsconfigPaths: true, // the "@/..." import alias from tsconfig.json
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  // Pre-bundle React up front so the first page load in dev doesn't trigger a re-optimise.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Use src/server.ts (SSR error wrapper) as the server entry.
      server: { entry: "server" },
      // Fail the build if browser code ever imports anything from src/server/.
      importProtection: { behavior: "error", client: { files: ["**/server/**"] } },
    }),
    // Nitro packages the production build as a standalone Node server in .output/.
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
}));
