import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { VendorHandlerSpec } from "../shared/vendorHandlers.js";
import type { Handler, HandlerContext } from "./index.js";

/**
 * Vendor handler execution — see docs/VENDOR-HANDLERS.md.
 *
 * The module is imported lazily on first claim and cached, so the API process
 * never loads customer code and a worker that has no vendor jobs never pays for
 * the import either.
 */

/** Progress a handler can report; mirrors the shape the UI renders. */
export type VendorJobProgress = {
  stage?: string;
  message?: string;
  percent?: number;
  [key: string]: unknown;
};

/** Everything a vendor handler gets. This is the public contract. */
export type VendorJobContext = {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  attempt: number;
  /** Aborted on cancel, timeout, or a lost lease. */
  signal: AbortSignal;
  /** Written to the job's progress blob (server-stamped with `at`). */
  setProgress: (progress: VendorJobProgress) => void;
};

export type VendorJobFn = (ctx: VendorJobContext) => Promise<unknown> | unknown;

/**
 * Thrown when the handler cannot be loaded or does not export a function —
 * operator config, not a transient fault, so the worker fails the job without
 * burning retries on it.
 */
export class VendorHandlerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorHandlerError";
  }
}

const modules = new Map<string, Promise<Record<string, unknown>>>();

function importVendorModule(
  specifier: string
): Promise<Record<string, unknown>> {
  const target =
    specifier.startsWith(".") || isAbsolute(specifier)
      ? pathToFileURL(resolve(process.cwd(), specifier)).href
      : specifier;
  return import(target) as Promise<Record<string, unknown>>;
}

/** Import (and cache) a handler module. Bare specifiers resolve from node_modules. */
export function loadVendorModule(
  specifier: string
): Promise<Record<string, unknown>> {
  const cached = modules.get(specifier);
  if (cached) return cached;

  const pending = importVendorModule(specifier);
  modules.set(specifier, pending);
  // Don't cache a failure: a bad path should report a clean error, not make
  // every later attempt replay a rejected promise.
  pending.catch(() => {
    if (modules.get(specifier) === pending) modules.delete(specifier);
  });
  return pending;
}

export function vendorHandler(spec: VendorHandlerSpec): Handler {
  return async (ctx: HandlerContext): Promise<unknown> => {
    let mod: Record<string, unknown>;
    try {
      mod = await loadVendorModule(spec.module);
    } catch (err) {
      throw new VendorHandlerError(
        `vendor handler "${spec.type}" could not load module "${spec.module}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const fn = mod[spec.export];
    if (typeof fn !== "function") {
      throw new VendorHandlerError(
        `vendor handler "${spec.type}": module "${spec.module}" has no "${spec.export}" export`
      );
    }

    return await (fn as VendorJobFn)({
      jobId: ctx.job.id,
      type: ctx.job.type,
      payload: JSON.parse(ctx.job.payload) as Record<string, unknown>,
      attempt: ctx.job.attempt,
      signal: ctx.signal,
      setProgress: ctx.setProgress,
    });
  };
}
