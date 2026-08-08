import { useCallback, useState } from "react";
import type { EnrichedStock } from "../types";
import { useStockContext } from "../context/StockContext";
import { useUser } from "../context/UserContext";

type Options = {
  /** Changing this resets the quantity — e.g. opening a different symbol. */
  resetKey?: string | null;
};

/**
 * Buy-side state for a single stock: quantity, affordability, and the guarded
 * submit. Shared by the card and the detail modal so both stay in step.
 */
export function useTradePanel(
  stock: EnrichedStock | null,
  { resetKey }: Options = {},
) {
  const { buyStock, state } = useStockContext();
  const { isAuthenticated, login } = useUser();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  // Reset during render rather than in an effect: this is React's documented
  // way to adjust state when a prop changes, and it avoids the extra pass that
  // rendering the stale quantity first would cost.
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setQuantity(1);
  }

  const increment = useCallback(() => setQuantity((p) => p + 1), []);
  const decrement = useCallback(
    () => setQuantity((p) => Math.max(1, p - 1)),
    [],
  );

  const totalPrice = stock ? stock.price * quantity : 0;
  const canAfford = state.fund >= totalPrice;
  const locked = !isAuthenticated;

  const submit = useCallback(async () => {
    if (locked) {
      login();
      return;
    }
    if (!stock || busy || quantity <= 0 || !canAfford) return;
    setBusy(true);
    try {
      await buyStock(stock, quantity);
    } finally {
      setBusy(false);
    }
  }, [locked, login, stock, busy, quantity, canAfford, buyStock]);

  return {
    quantity,
    setQuantity,
    increment,
    decrement,
    totalPrice,
    canAfford,
    locked,
    busy,
    submit,
    /** Guests keep a clickable button — it routes them to login instead. */
    disabled: busy || (!locked && (!canAfford || quantity <= 0)),
  };
}
