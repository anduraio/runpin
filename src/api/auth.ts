import { createHash } from "node:crypto";
import type { Context, Next } from "hono";
import { config } from "../shared/config.js";

export type AuthVars = {
  apiKey: string;
  apiKeyHash: string;
};

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export async function requireApiKey(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const key = match?.[1]?.trim();
  if (!key || key !== config.apiKey()) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("apiKey", key);
  c.set("apiKeyHash", hashApiKey(key));
  await next();
}
