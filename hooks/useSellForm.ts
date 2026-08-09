import { useCallback, useRef, useState } from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import { useIdempotencyKey } from "./useIdempotencyKey";

/**
 * Resolves the position being sold and guards the quantity before hitting the
 * trade API. Returns `found: false` when the route points at something the
 * portfolio no longer holds.
 */
export function useSellForm(rawCompany: string | undefined) {
  const { state, sellStock } = useStockContext();
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref, not the state: two clicks in one tick both read the same rendered
  // `busy`, and the button's `disabled` only applies on the next render. The
  // ref is the only thing that has already changed by the second call.
  const inFlight = useRef(false);

  const company = rawCompany ? decodeURIComponent(rawCompany) : "";
  const position = state.portfolio.find((item) => item.company === company);
  const listed = state.allStocks.find((s) => s.company === company);

  const maxQuantity = position?.quantity ?? 0;
  const currentPrice = listed?.price ?? 0;

  // Same order, same key: a failed sell the user retries must not become two.
  const { key: idempotencyKey, rotate } = useIdempotencyKey(
    `${company}:${quantity}`,
  );

  const submit = useCallback(async () => {
    // Guarded here, not only by the button's `disabled`. That attribute only
    // takes effect on the next render, so a fast double-click can land two
    // sells before React repaints. The buy side has always had this check.
    if (inFlight.current) return false;
    setError("");
    if (quantity <= 0) {
      setError(t("qtyMustBePositive"));
      return false;
    }
    if (quantity > maxQuantity) {
      setError(t("canSellUpTo", { max: maxQuantity }));
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (!(await sellStock(company, quantity, idempotencyKey))) return false;
      rotate();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [quantity, maxQuantity, sellStock, company, t, idempotencyKey, rotate]);

  return {
    company,
    found: Boolean(position && listed),
    quantity,
    setQuantity,
    maxQuantity,
    currentPrice,
    totalValue: currentPrice * quantity,
    error,
    busy,
    submit,
  };
}
