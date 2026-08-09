import { withAuth } from "./_lib/middleware.js";
import { executeTrade } from "./_lib/store.js";
import { parseTradeInput } from "./_lib/tradeValidation.js";
import {
  claim,
  parseIdempotencyKey,
  record,
  release,
} from "./_lib/idempotency.js";

export default withAuth(async (req, res, { user }) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = (
    typeof req.body === "string" ? JSON.parse(req.body) : req.body
  ) as Record<string, unknown>;

  const trade = parseTradeInput(body);
  const key = parseIdempotencyKey(
    req.headers["idempotency-key"] ?? body.idempotencyKey,
  );

  // Required, not optional. An endpoint that moves money and accepts requests
  // it cannot recognise as duplicates is one dropped connection away from
  // charging twice, and a header that is only honoured when present is a
  // guarantee nobody can rely on.
  if (!key) {
    res.status(400).json({
      error: "Idempotency-Key header is required",
      code: "idempotency_key_required",
    });
    return;
  }

  const claimed = await claim(user.id, key);
  if (claimed.replayed) {
    // Byte-for-byte the original answer: a replay must be indistinguishable
    // from the first call, or the client learns to treat it as a new event.
    res.setHeader("Idempotent-Replay", "true");
    res.status(200).json(claimed.response);
    return;
  }

  let portfolio;
  try {
    portfolio = await executeTrade({
      userId: user.id,
      ...trade,
      idempotencyKey: key,
    });
  } catch (err) {
    // Nothing was booked, so the key must not outlive the attempt — otherwise
    // a rejected trade strands the user on 409 for a decision they are allowed
    // to retake.
    await release(user.id, key);
    throw err;
  }

  await record(user.id, key, portfolio);
  res.status(200).json(portfolio);
});
