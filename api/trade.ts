import { withAuth } from "./_lib/middleware.js";
import { executeTrade } from "./_lib/store.js";
import { parseTradeInput } from "./_lib/tradeValidation.js";

export default withAuth(async (req, res, { user }) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = (typeof req.body === "string"
    ? JSON.parse(req.body)
    : req.body) as Record<string, unknown>;

  const trade = parseTradeInput(body);
  const portfolio = await executeTrade({
    userId: user.id,
    ...trade,
  });
  res.status(200).json(portfolio);
});
