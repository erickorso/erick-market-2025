import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import { runVercelHandler } from "./vercelAdapter";
import quotesHandler from "../api/quotes";
import hotHandler from "../api/hot";
import detailHandler from "../api/detail";

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const PORT = Number(process.env.MARKET_API_PORT || 4010);
const HOT_INTERVAL_MS = 5 * 60_000;

/**
 * Dev runs the deployed handlers, not copies of them. Everything here is
 * routing and the WebSocket, which Vercel has no equivalent of.
 */
const routes: Array<[string, Parameters<typeof runVercelHandler>[0]]> = [
  ["/api/quotes", quotesHandler],
  ["/api/hot", hotHandler],
  ["/api/detail", detailHandler],
];

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = (req.url || "/").split("?")[0];
  const { handleAuthApi } = await import("./authRoutes");
  if (await handleAuthApi(req, res, pathname)) return;

  const route = routes.find(([prefix]) => pathname.startsWith(prefix));
  if (route) {
    try {
      await runVercelHandler(route[1], PORT)(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "handler failed",
        }),
      );
    }
    return;
  }

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "erick-market-api" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const wss = new WebSocketServer({ server, path: "/ws/hot" });
const clients = new Set<WebSocket>();
let lastHot: string | null = null;

/** Reads its own /api/hot rather than importing a payload builder: that import
 *  is what made a second copy of the hot logic necessary in the first place. */
async function refreshHot(broadcast: boolean) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/hot`);
    lastHot = await res.text();
    if (broadcast && lastHot) {
      for (const client of clients) {
        if (client.readyState === client.OPEN) client.send(lastHot);
      }
    }
  } catch (err) {
    console.warn(
      "[market-api] hot refresh failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

wss.on("connection", (socket) => {
  clients.add(socket);
  if (lastHot) {
    socket.send(lastHot);
  } else {
    void refreshHot(false).then(() => {
      if (lastHot && socket.readyState === socket.OPEN) socket.send(lastHot);
    });
  }
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[market-api] http://127.0.0.1:${PORT}/api/quotes?limit=10`);
  console.log(
    `[market-api] ws://127.0.0.1:${PORT}/ws/hot (every ${HOT_INTERVAL_MS / 60000}m)`,
  );
  if (!process.env.FINNHUB_API_KEY) {
    console.warn("[market-api] FINNHUB_API_KEY missing — /api/quotes will 503");
  }
  void refreshHot(false);
  setInterval(() => {
    void refreshHot(true);
  }, HOT_INTERVAL_MS);
});
