import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import RankSidebar from "./RankSidebar";

const refresh = vi.hoisted(() => vi.fn());
const requestLogin = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ isAuthenticated: false }));
const league = vi.hoisted(() => ({
  entries: [] as {
    playerId: string;
    name: string;
    equity: number;
    pnl: number;
    pnlPercent: number;
  }[],
  month: "2026-08",
  player: null as { id: string } | null,
  previousWinner: null as { name: string } | null,
}));

vi.mock("../../context/LeagueContext", () => ({
  useLeague: () => ({ ...league, refresh }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: user.isAuthenticated }),
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin }),
}));

function entry(id: string, name: string, pnlPercent: number) {
  return {
    playerId: id,
    name,
    equity: 10_000 + pnlPercent * 100,
    pnl: pnlPercent * 100,
    pnlPercent,
  };
}

beforeEach(() => {
  refresh.mockReset();
  requestLogin.mockReset();
  user.isAuthenticated = false;
  localStorage.clear();
  league.entries = [
    entry("p1", "Erick", 18.4),
    entry("p2", "Marta", 11.9),
    entry("p3", "Dani", -2.8),
  ];
  league.player = null;
  league.previousWinner = null;
});

describe("RankSidebar", () => {
  it("is a labelled landmark", () => {
    renderWithProviders(<RankSidebar />);
    expect(screen.getByRole("complementary")).toHaveAccessibleName();
  });

  it("ranks players in the order given", () => {
    renderWithProviders(<RankSidebar />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Erick");
    expect(items[2]).toHaveTextContent("Dani");
  });

  it("caps the board at ten", () => {
    league.entries = Array.from({ length: 15 }, (_, i) =>
      entry(`p${i}`, `Player ${i}`, i),
    );
    renderWithProviders(<RankSidebar />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("highlights the viewer's own row", () => {
    league.player = { id: "p2" };
    renderWithProviders(<RankSidebar />);

    const mine = screen.getByText("Marta").closest("div");
    expect(mine?.parentElement).toHaveClass("border-teal-500/50");
  });

  it("credits last month's winner above the board", () => {
    league.previousWinner = { name: "Ana" };
    renderWithProviders(<RankSidebar />);

    // Ana is not in this month's entries, so the only mention is the credit.
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("omits the credit in the first month, when there is no winner yet", () => {
    renderWithProviders(<RankSidebar />);
    expect(screen.queryByText(/last winner/i)).not.toBeInTheDocument();
  });

  it("invites the visitor to join when the board is empty", () => {
    league.entries = [];
    renderWithProviders(<RankSidebar />);

    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("links through to the full league", () => {
    renderWithProviders(<RankSidebar />);

    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/league")).toBe(true);
  });

  // Guests used to land on a bare "sign in to continue" page. The link now
  // asks first, and keeps its href so a new tab still works.
  it("asks a guest about signing in instead of following the link", async () => {
    renderWithProviders(<RankSidebar />);

    await userEvent.click(screen.getByText(/full league/i));

    expect(requestLogin).toHaveBeenCalledWith("league");
  });

  it("does not ask a signed-in player", async () => {
    user.isAuthenticated = true;
    renderWithProviders(<RankSidebar />);

    await userEvent.click(screen.getByText(/full league/i));

    expect(requestLogin).not.toHaveBeenCalled();
  });

  it("asks a guest from the empty-board invitation too", async () => {
    league.entries = [];
    renderWithProviders(<RankSidebar />);

    await userEvent.click(screen.getByText(/join/i));

    expect(requestLogin).toHaveBeenCalledWith("league");
  });

  it("collapses and remembers the choice", async () => {
    renderWithProviders(<RankSidebar />);

    await userEvent.click(screen.getByRole("button", { name: /collapse/i }));

    expect(screen.queryByText("Erick")).not.toBeInTheDocument();
    expect(localStorage.getItem("erick-market.rank-sidebar.collapsed")).toBe(
      "1",
    );
  });

  it("expands again", async () => {
    localStorage.setItem("erick-market.rank-sidebar.collapsed", "1");
    renderWithProviders(<RankSidebar />);
    expect(screen.queryByText("Erick")).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText("Erick")).toBeInTheDocument();
  });

  it("starts collapsed when that is the stored preference", () => {
    localStorage.setItem("erick-market.rank-sidebar.collapsed", "1");
    renderWithProviders(<RankSidebar />);

    expect(screen.queryByText("Erick")).not.toBeInTheDocument();
  });
});
