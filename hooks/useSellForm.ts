import { useCallback, useState } from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";

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

  const company = rawCompany ? decodeURIComponent(rawCompany) : "";
  const position = state.portfolio.find((item) => item.company === company);
  const listed = state.allStocks.find((s) => s.company === company);

  const maxQuantity = position?.quantity ?? 0;
  const currentPrice = listed?.price ?? 0;

  const submit = useCallback(async () => {
    setError("");
    if (quantity <= 0) {
      setError(t("qtyMustBePositive"));
      return false;
    }
    if (quantity > maxQuantity) {
      setError(t("canSellUpTo", { max: maxQuantity }));
      return false;
    }
    setBusy(true);
    try {
      await sellStock(company, quantity);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [quantity, maxQuantity, sellStock, company, t]);

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
