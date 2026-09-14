import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../shared/config.js";
import { getDb } from "../db/schema.js";
import { initPackDrafts } from "../db/packDrafts.js";
import { v1 } from "./routes.js";

getDb();
initPackDrafts();

const app = new Hono();

app.use("*", cors());

app.get("/healthz", (c) => c.json({ ok: true, service: "runpin" }));

app.route("/v1", v1);

const webDist = resolve(process.cwd(), "web/dist");
if (existsSync(webDist)) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  app.get("*", serveStatic({ root: "./web/dist", path: "index.html" }));
} else {
  app.get("/", (c) =>
    c.html(
      `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
       <h1>Runpin API</h1>
       <p>Web UI not built yet. Run <code>npm run build:web</code> or use <code>/v1</code> API.</p>
       <p>Health: <a href="/healthz">/healthz</a></p>
       </body></html>`
    )
  );
}

const port = config.port();
console.log(`[api] listening on :${port}`);
serve({ fetch: app.fetch, port });
