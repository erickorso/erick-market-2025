import { withAuth } from "./_lib/middleware.js";
import { executeTrade } from "./_lib/store.js";

export default withAuth(async (req, res, { user }) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = (typeof req.body === "string"
    ? JSON.parse(req.body)
    : req.body) as {
    side?: string;
    symbol?: string;
    company?: string;
    qty?: number;
    price?: number;
  };

  const side =
    body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
  if (!side || !body.symbol) {
    res.status(400).json({ error: "side and symbol required" });
    return;
  }

  const portfolio = await executeTrade({
    userId: user.id,
    side,
    symbol: body.symbol,
    company: body.company?.trim() || body.symbol,
    qty: Number(body.qty),
    price: Number(body.price),
  });
  res.status(200).json(portfolio);
});
