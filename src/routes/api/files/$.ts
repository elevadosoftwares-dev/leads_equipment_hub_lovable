import { createFileRoute } from "@tanstack/react-router";

const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

// Streams an uploaded file (see src/server/files.server.ts) to a signed-in user.
export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getSessionUser } = await import("@/server/auth.server");
        if (!(await getSessionUser())) return new Response("Unauthorized", { status: 401 });

        const { readFile } = await import("@/server/files.server");
        const file = params._splat ? await readFile(decodeURIComponent(params._splat)) : null;
        if (!file) return new Response("Not found", { status: 404 });

        // Only open known-safe types in the browser; anything else (HTML, SVG, ...) could run
        // script on this origin, so it is sent as a plain download.
        const type = file.content_type.toLowerCase();
        const inline = INLINE_TYPES.has(type);
        return new Response(new Uint8Array(file.data), {
          headers: {
            "content-type": inline ? type : "application/octet-stream",
            "content-length": String(file.data.length),
            "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
            "x-content-type-options": "nosniff",
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
