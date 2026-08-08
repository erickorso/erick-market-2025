import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import RequirePlayer from "./RequirePlayer";

const league = vi.hoisted(() => ({
  player: null as { id: string; name: string } | null,
}));

vi.mock("../../context/LeagueContext", () => ({
  useLeague: () => league,
}));

beforeEach(() => {
  league.player = null;
});

const Board = () => <p>private board</p>;

describe("RequirePlayer", () => {
  it("hides the page until a league seat exists", () => {
    renderWithProviders(
      <RequirePlayer>
        <Board />
      </RequirePlayer>,
    );

    expect(screen.queryByText("private board")).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("points at the join flow", () => {
    renderWithProviders(
      <RequirePlayer>
        <Board />
      </RequirePlayer>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/league");
  });

  it("renders the page once a seat exists", () => {
    league.player = { id: "p1", name: "Erick" };
    renderWithProviders(
      <RequirePlayer>
        <Board />
      </RequirePlayer>,
    );

    expect(screen.getByText("private board")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
