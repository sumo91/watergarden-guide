import { defineConfig } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function localSnapshots() {
  return {
    name: "local-scene-snapshots",
    configureServer(server) {
      server.middlewares.use("/__scene_capture", async (request, response) => {
        // This development-only endpoint accepts image bytes, never a filename.
        if (
          request.method !== "POST" ||
          request.headers.origin !== `http://${request.headers.host}` ||
          request.headers["content-type"] !== "image/png"
        ) {
          response.writeHead(400).end("Invalid image request");
          return;
        }
        try {
          const chunks = [];
          let length = 0;
          for await (const chunk of request) {
            length += chunk.length;
            if (length > 20 * 1024 * 1024) {
              response.writeHead(413).end("Image too large");
              return;
            }
            chunks.push(chunk);
          }
          const png = Buffer.concat(chunks);
          if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
            response.writeHead(400).end("PNG required");
            return;
          }
          const directory = path.join(server.config.root, "captures");
          const filename = `edge-of-water-${Date.now()}.png`;
          await mkdir(directory, { recursive: true });
          await writeFile(path.join(directory, filename), png, { flag: "wx" });
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({ url: `/captures/${filename}`, saved: true }),
          );
        } catch {
          response.writeHead(500).end("Unable to save snapshot");
        }
      });
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/watergarden-guide/" : "/",
  plugins: [localSnapshots()],
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ["three"] } },
    },
    // The rendering engine is downloaded once and cached independently.
    chunkSizeWarningLimit: 650,
  },
});
