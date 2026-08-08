import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import NoticeBanner from "./NoticeBanner";
import type { Notice } from "../../types";

const dispatch = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ notice: null as Notice }));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ state: { notice: store.notice }, dispatch }),
}));

beforeEach(() => {
  dispatch.mockReset();
  store.notice = null;
});

describe("NoticeBanner", () => {
  it("renders nothing when there is no notice", () => {
    const { container } = renderWithProviders(<NoticeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the message politely", () => {
    store.notice = { type: "success", message: "Live market quotes." };
    renderWithProviders(<NoticeBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Live market quotes.");
  });

  it("colours by severity", () => {
    store.notice = { type: "error", message: "Buy failed" };
    const { container, rerender } = renderWithProviders(<NoticeBanner />);
    expect(container.innerHTML).toContain("bg-rose-900/90");

    store.notice = { type: "success", message: "Bought" };
    rerender(<NoticeBanner />);
    expect(container.innerHTML).toContain("bg-teal-900/90");

    store.notice = { type: "info", message: "Mock data" };
    rerender(<NoticeBanner />);
    expect(container.innerHTML).toContain("bg-slate-800/95");
  });

  it("can be dismissed", async () => {
    store.notice = { type: "info", message: "Mock data" };
    renderWithProviders(<NoticeBanner />);

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_NOTICE" });
  });

  it("lets clicks through everywhere except the banner itself", () => {
    store.notice = { type: "info", message: "Mock data" };
    renderWithProviders(<NoticeBanner />);

    // The overlay spans the header; only the pill should be interactive.
    expect(screen.getByRole("status")).toHaveClass("pointer-events-none");
  });
});
