import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import { I18nProvider } from "../../context/I18nContext";
import { ThemeProvider } from "../../context/ThemeContext";

// The shell is a frame: stub what it frames so this stays a layout test.
vi.mock("../organisms/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));
vi.mock("../organisms/NoticeBanner", () => ({
  default: () => <div data-testid="notice" />,
}));
vi.mock("../organisms/HotSidebar", () => ({
  default: () => <aside data-testid="hot" />,
}));
vi.mock("../organisms/RankSidebar", () => ({
  default: () => <aside data-testid="rank" />,
}));
vi.mock("../organisms/AuthPromptModal", () => ({
  default: () => <div data-testid="auth-prompt" />,
}));
vi.mock("../organisms/StockDetailModal", () => ({
  default: () => <div data-testid="detail-modal" />,
}));
vi.mock("../../pages/HomePage", () => ({
  default: () => <h1>market</h1>,
}));
vi.mock("../../pages/LeaguePage", () => ({ default: () => <h1>league</h1> }));
vi.mock("../../pages/MyStocksPage", () => ({ default: () => <h1>stocks</h1> }));
vi.mock("../../pages/MyFundPage", () => ({ default: () => <h1>fund</h1> }));
vi.mock("../organisms/SellStockForm", () => ({
  default: () => <h1>sell</h1>,
}));
vi.mock("../routing/RequireAuth", () => ({
  protectedRoute: (el: React.ReactNode) => <>{el}</>,
}));

function renderShell(hash = "#/") {
  window.location.hash = hash;
  return render(
    <ThemeProvider>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  it("frames the app with header, both sidebars and the modal", () => {
    renderShell();

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("notice")).toBeInTheDocument();
    expect(screen.getByTestId("hot")).toBeInTheDocument();
    expect(screen.getByTestId("rank")).toBeInTheDocument();
    expect(screen.getByTestId("detail-modal")).toBeInTheDocument();
  });

  it("routes / to the market", () => {
    renderShell("#/");
    expect(screen.getByRole("heading", { name: "market" })).toBeInTheDocument();
  });

  it("routes the private pages", () => {
    renderShell("#/my-fund");
    expect(screen.getByRole("heading", { name: "fund" })).toBeInTheDocument();
  });

  it("sends an unknown route home rather than showing nothing", () => {
    renderShell("#/nope");
    expect(screen.getByRole("heading", { name: "market" })).toBeInTheDocument();
  });

  it("uses main and contentinfo landmarks", () => {
    renderShell();

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("footers the current year and the demo disclaimer", () => {
    renderShell();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(String(new Date().getFullYear()));
    expect(footer).toHaveTextContent(/not financial advice/i);
  });

  it("keeps a broken page from taking the frame down", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("../../pages/HomePage", () => ({
      default: () => {
        throw new Error("page exploded");
      },
    }));

    renderShell();
    // Sidebars and header survive regardless of what the centre column does.
    expect(screen.getByTestId("hot")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });
});
