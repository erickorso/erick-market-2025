import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Lets the dev server run the real `api/` handlers.
 *
 * Local dev used to ship its own copy of quotes, hot and detail — several
 * hundred lines that could drift from the deployed ones without anything
 * failing, which is the worst kind of duplication: the one where the version
 * you test is not the version you ship. Vercel's request and response are the
 * Node ones with a handful of conveniences added, so a thin shim is enough to
 * run the same handlers here.
 */
export type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

export function runVercelHandler(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  port: number,
): NodeHandler {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const vreq = Object.assign(req, {
      query: Object.fromEntries(url.searchParams),
      cookies: {},
      body: await readBody(req),
    }) as unknown as VercelRequest;

    const vres = res as unknown as VercelResponse;
    vres.status = (code: number) => {
      res.statusCode = code;
      return vres;
    };
    vres.json = (payload: unknown) => {
      if (!res.headersSent) res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return vres;
    };
    vres.send = (payload: unknown) => {
      res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      return vres;
    };

    await handler(vreq, vres);
  };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
