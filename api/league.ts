import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Monthly training league.
 * Shared mode when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Otherwise ephemeral (warm instance only) — clients also keep localStorage.
 */

type LeagueEntry = {
  playerId: string;
  name: string;
  month: string;
  equity: number;
  cash: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
  updatedAt: string;
  pinHash?: string;
};

type PlayerRow = { playerId: string; name: string; pinHash: string };

const memory = {
  players: new Map<string, PlayerRow>(),
  boards: new Map<string, LeagueEntry[]>(),
  archives: new Map<string, LeagueEntry[]>(),
};

function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

async function redis(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sortBoard(entries: LeagueEntry[]) {
  return [...entries]
    .map(({ pinHash: _p, ...rest }) => rest)
    .sort((a, b) => b.equity - a.equity);
}

async function getBoard(month: string): Promise<LeagueEntry[]> {
  if (redisConfigured()) {
    const raw = await redis(["GET", `league:board:${month}`]);
    if (typeof raw === "string" && raw) {
      return JSON.parse(raw) as LeagueEntry[];
    }
    return [];
  }
  return memory.boards.get(month) ?? [];
}

async function setBoard(month: string, entries: LeagueEntry[]) {
  const cleaned = sortBoard(entries);
  if (redisConfigured()) {
    await redis(["SET", `league:board:${month}`, JSON.stringify(cleaned)]);
  } else {
    memory.boards.set(month, cleaned);
  }
  return cleaned;
}

async function getArchive(month: string): Promise<LeagueEntry[]> {
  if (redisConfigured()) {
    const raw = await redis(["GET", `league:archive:${month}`]);
    if (typeof raw === "string" && raw) {
      return JSON.parse(raw) as LeagueEntry[];
    }
    return [];
  }
  return memory.archives.get(month) ?? [];
}

async function archiveMonth(month: string) {
  const board = await getBoard(month);
  if (!board.length) return board;
  if (redisConfigured()) {
    await redis(["SET", `league:archive:${month}`, JSON.stringify(board)]);
    await redis(["DEL", `league:board:${month}`]);
  } else {
    memory.archives.set(month, board);
    memory.boards.delete(month);
  }
  return board;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const mode = redisConfigured() ? "shared" : "ephemeral";

    if (req.method === "GET") {
      const month = String(req.query.month ?? "").trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: "month required YYYY-MM" });
        return;
      }
      const prev = previousMonth(month);
      // Soft-close previous month board into archive if still open
      const prevBoard = await getBoard(prev);
      if (prevBoard.length) {
        const existingArchive = await getArchive(prev);
        if (!existingArchive.length) await archiveMonth(prev);
      }
      const entries = sortBoard(await getBoard(month));
      const archived = sortBoard(await getArchive(prev));
      res.status(200).json({
        mode,
        month,
        entries,
        previousWinner: archived[0] ?? null,
        previousMonth: prev,
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }

    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
      action?: string;
      playerId?: string;
      name?: string;
      pinHash?: string;
      month?: string;
      equity?: number;
      cash?: number;
      invested?: number;
      pnl?: number;
      pnlPercent?: number;
    };

    if (body.action === "join") {
      const name = String(body.name ?? "").trim().slice(0, 24);
      const pinHash = String(body.pinHash ?? "");
      const playerId = String(body.playerId ?? "").slice(0, 64);
      if (name.length < 2 || pinHash.length < 16 || !playerId) {
        res.status(400).json({ error: "invalid join payload" });
        return;
      }
      const row: PlayerRow = { playerId, name, pinHash };
      if (redisConfigured()) {
        await redis(["SET", `league:player:${playerId}`, JSON.stringify(row)]);
      } else {
        memory.players.set(playerId, row);
      }
      res.status(200).json({ ok: true, playerId, name, mode });
      return;
    }

    if (body.action === "score") {
      const playerId = String(body.playerId ?? "");
      const pinHash = String(body.pinHash ?? "");
      const month = String(body.month ?? "");
      const name = String(body.name ?? "").trim().slice(0, 24);
      if (!playerId || !pinHash || !/^\d{4}-\d{2}$/.test(month) || !name) {
        res.status(400).json({ error: "invalid score payload" });
        return;
      }

      let player: PlayerRow | null = null;
      if (redisConfigured()) {
        const raw = await redis(["GET", `league:player:${playerId}`]);
        if (typeof raw === "string" && raw) player = JSON.parse(raw) as PlayerRow;
      } else {
        player = memory.players.get(playerId) ?? null;
      }
      if (player && player.pinHash !== pinHash) {
        res.status(401).json({ error: "invalid credentials" });
        return;
      }
      if (!player) {
        player = { playerId, name, pinHash };
        if (redisConfigured()) {
          await redis(["SET", `league:player:${playerId}`, JSON.stringify(player)]);
        } else {
          memory.players.set(playerId, player);
        }
      }

      const entry: LeagueEntry = {
        playerId,
        name: player.name,
        month,
        equity: Number(body.equity) || 0,
        cash: Number(body.cash) || 0,
        invested: Number(body.invested) || 0,
        pnl: Number(body.pnl) || 0,
        pnlPercent: Number(body.pnlPercent) || 0,
        updatedAt: new Date().toISOString(),
      };
      const board = await getBoard(month);
      const idx = board.findIndex((e) => e.playerId === playerId);
      if (idx >= 0) board[idx] = entry;
      else board.push(entry);
      const saved = await setBoard(month, board);
      res.status(200).json({ ok: true, mode, entries: saved });
      return;
    }

    if (body.action === "close-month") {
      const month = String(body.month ?? "");
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: "month required" });
        return;
      }
      const archived = await archiveMonth(month);
      res.status(200).json({
        ok: true,
        mode,
        month,
        winner: sortBoard(archived)[0] ?? null,
        entries: sortBoard(archived),
      });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "league failed",
    });
  }
}
