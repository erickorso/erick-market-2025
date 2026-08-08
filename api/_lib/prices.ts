/** Fetch last prices for symbols via Finnhub (server-side league MTM). */

type FinnhubQuote = { c?: number };

export async function fetchLivePrices(
  symbols: string[],
  apiKey: string | undefined,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [
    ...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean)),
  ];
  if (!apiKey || unique.length === 0) return out;

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as FinnhubQuote;
        const price = Number(data.c);
        if (Number.isFinite(price) && price > 0) out.set(symbol, price);
      } catch {
        /* skip symbol */
      }
    }),
  );
  return out;
}
