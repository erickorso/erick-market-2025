import { withAuth } from "./_lib/middleware.js";
import { ensurePortfolio } from "./_lib/store.js";

export default withAuth(async (req, res, { user }) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const portfolio = await ensurePortfolio(user.id);
  res.status(200).json(portfolio);
});
