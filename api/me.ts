import { withAuth } from "./_lib/middleware.js";
import { ensurePortfolio, updateDisplayName } from "./_lib/store.js";

export default withAuth(async (req, res, { user }) => {
  if (req.method === "GET") {
    const portfolio = await ensurePortfolio(user.id);
    res.status(200).json({ user, portfolio });
    return;
  }

  if (req.method === "POST") {
    const body = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as { displayName?: string };
    const updated =
      typeof body?.displayName === "string"
        ? await updateDisplayName(user.id, body.displayName)
        : user;
    const portfolio = await ensurePortfolio(updated.id);
    res.status(200).json({ user: updated, portfolio });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
});
