import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOT_API_URL,
  HOT_REFRESH_MS,
  HOT_WS_PATH,
} from "../constants";

export type HotStock = {
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
};

export type HotChannelMode = "socket" | "poll" | "idle";

type HotPayload = {
  type?: string;
  at?: number;
  intervalMs?: number;
  source?: string;
  stocks?: HotStock[];
};

function mockHot(): HotStock[] {
  const seeds = [
    { symbol: "NVDA", company: "NVIDIA" },
    { symbol: "TSLA", company: "Tesla" },
    { symbol: "AMD", company: "AMD" },
    { symbol: "META", company: "Meta" },
    { symbol: "SHOP", company: "Shopify" },
    { symbol: "SPOT", company: "Spotify" },
    { symbol: "UBER", company: "Uber" },
    { symbol: "AVGO", company: "Broadcom" },
  ];
  return seeds.map((s, i) => ({
    ...s,
    price: 80 + i * 37 + Math.random() * 20,
    changePercent: 4.5 - i * 0.55 + Math.random() * 0.4,
  }));
}

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${HOT_WS_PATH}`;
}

export function useHotStocks() {
  const [stocks, setStocks] = useState<HotStock[]>([]);
  const [mode, setMode] = useState<HotChannelMode>("idle");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const applyPayload = useCallback((data: HotPayload) => {
    const list = Array.isArray(data.stocks) ? data.stocks : [];
    if (list.length) {
      setStocks(list);
      setUpdatedAt(typeof data.at === "number" ? data.at : Date.now());
      setError(null);
      return;
    }
    setStocks(mockHot());
    setUpdatedAt(Date.now());
  }, []);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(HOT_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HotPayload;
      applyPayload(data);
      setMode("poll");
    } catch {
      setStocks(mockHot());
      setUpdatedAt(Date.now());
      setMode("poll");
      setError("Hot feed offline — showing mock movers");
    }
  }, [applyPayload]);

  const startPoll = useCallback(() => {
    if (pollRef.current != null) return;
    void pollOnce();
    pollRef.current = window.setInterval(() => {
      void pollOnce();
    }, HOT_REFRESH_MS);
  }, [pollOnce]);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | null = null;

    // Persistent WS only in local Vite→BFF. Vercel has no long-lived socket.
    if (!import.meta.env.DEV) {
      startPoll();
      return () => {
        cancelled = true;
        stopPoll();
      };
    }

    const connectWs = () => {
      if (cancelled) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl());
      } catch {
        startPoll();
        return;
      }
      wsRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelled) return;
        stopPoll();
        setMode("socket");
        setError(null);
      });

      socket.addEventListener("message", (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as HotPayload;
          if (data.type === "hot" || Array.isArray(data.stocks)) {
            applyPayload(data);
            setMode("socket");
          }
        } catch {
          /* ignore bad frames */
        }
      });

      socket.addEventListener("close", () => {
        wsRef.current = null;
        if (cancelled) return;
        startPoll();
        reconnectTimer = window.setTimeout(connectWs, 15_000);
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    };

    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      stopPoll();
    };
  }, [applyPayload, startPoll, stopPoll]);

  return { stocks, mode, updatedAt, error, refreshMs: HOT_REFRESH_MS };
}
