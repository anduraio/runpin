import type { Job } from "../shared/types.js";
import { config } from "../shared/config.js";
import { getPack } from "../packs/index.js";
import { initPackDrafts } from "../db/packDrafts.js";
import { sampleResultForPack } from "../packs/sampleResult.js";
import type { PackManifest } from "../packs/types.js";

export type HandlerContext = {
  job: Job;
  signal: AbortSignal;
  setProgress: (progress: unknown) => void;
};

export type Handler = (ctx: HandlerContext) => Promise<unknown>;

async function echoHandler(ctx: HandlerContext): Promise<unknown> {
  const payload = JSON.parse(ctx.job.payload);
  return payload;
}

async function postJson(
  url: string,
  body: unknown,
  signal: AbortSignal,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let responseBody: unknown = text;
  try {
    responseBody = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(
      `callback ${res.status} from ${url}: ${text.slice(0, 300) || "(empty body)"}`
    );
  }
  return { status: res.status, body: responseBody };
}

async function httpCallbackHandler(ctx: HandlerContext): Promise<unknown> {
  const payload = JSON.parse(ctx.job.payload) as {
    callback_url?: string;
    callback_bearer?: unknown;
    [key: string]: unknown;
  };
  const url = payload.callback_url;
  if (!url || typeof url !== "string") {
    throw new Error("http_callback requires payload.callback_url");
  }
  const headers: Record<string, string> = {};
  if (payload.callback_bearer === true) {
    headers.authorization = `Bearer ${config.apiKey()}`;
  }
  const { callback_url: _, callback_bearer: __, ...body } = payload;
  ctx.setProgress({ stage: "Calling callback URL", url });
  return postJson(url, body, ctx.signal, headers);
}

function stubHandler(name: string, youGet?: string): Handler {
  return async (ctx) => {
    ctx.setProgress({ stage: "stub", handler: name });
    return {
      stub: true,
      type: name,
      ...(youGet ? { you_get: youGet } : {}),
      received: JSON.parse(ctx.job.payload),
    };
  };
}

/**
 * Legacy job types kept runnable so old jobs and routines still finish.
 * The shelf templates are no longer installable — see src/shared/toolCatalog.ts.
 */
const LEGACY_STUBS: Record<string, string> = {
  "template.finder": "A list of new finds",
  "template.watcher": "An alert when it changes",
  "template.collector": "A list from many pages",
  "template.repeater": "The same job, on schedule",
  "template.brief": "One summary for the day",
  "template.compare": "A vs B differences",
  "template.filter": "Only items that fit",
  "template.delivery": "Results in email/Sheets/WA",
  // Aliases for even older enqueues
  "hunt.jobs": "A list of new finds",
  "hunt.icp": "A list of new finds",
  "hunt.linkedin": "A list of new finds",
  "notify.webhook": "Results in email/Sheets/WA",
};

const handlers: Record<string, Handler> = {
  echo: echoHandler,
  http_callback: httpCallbackHandler,
};

for (const [type, youGet] of Object.entries(LEGACY_STUBS)) {
  handlers[type] = stubHandler(type, youGet);
}

function samplePackHandler(pack: PackManifest): Handler {
  return async (ctx) => {
    ctx.setProgress({ stage: "Looking up sample results" });
    await new Promise((r) => setTimeout(r, 350));
    if (ctx.signal.aborted) {
      throw new Error("cancelled");
    }
    return sampleResultForPack(pack);
  };
}

export function getHandler(type: string): Handler | undefined {
  const builtin = handlers[type];
  if (builtin) return builtin;
  initPackDrafts();
  const pack = getPack(type);
  if (!pack) return undefined;
  return samplePackHandler(pack);
}

export function isAllowedJobType(type: string): boolean {
  if (handlers[type]) return true;
  initPackDrafts();
  return getPack(type) != null;
}

export function listHandlerTypes(): string[] {
  return Object.keys(handlers);
}
