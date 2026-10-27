// Local-only, self-contained React fixture; no Paperclip credentials are needed.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { outputFiles } = await build({
  absWorkingDir: root,
  entryPoints: ["tests/preview/index.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
});
const html = await readFile(new URL("../tests/preview/index.html", import.meta.url));
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } else if (req.url === "/preview.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    res.end(outputFiles[0].contents);
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(4178, "127.0.0.1", () => console.log("Language Pack test fixture: http://127.0.0.1:4178"));
