import { useCallback, useState } from "react";
import { newIdempotencyKey } from "../services/idempotency";

/**
 * Holds one key for as long as an order stays the same order.
 *
 * A key generated per click would be useless: the case worth protecting
 * against is a lost response, where the user sees a failure and presses Buy
 * again. That second press has to carry the *same* key, or the server has no
 * way to recognise it as the same intention and simply buys twice.
 *
 * So it rotates on exactly two things — the order changing, because that is a
 * different intention, and a confirmed success, because the next order is a
 * new one.
 */
export function useIdempotencyKey(order: string) {
  const [key, setKey] = useState(newIdempotencyKey);
  // Adjusted during render, the same pattern the quantity reset uses: no extra
  // pass, and no window where the key belongs to the previous order.
  const [lastOrder, setLastOrder] = useState(order);
  if (order !== lastOrder) {
    setLastOrder(order);
    setKey(newIdempotencyKey());
  }

  const rotate = useCallback(() => setKey(newIdempotencyKey()), []);
  return { key, rotate };
}
