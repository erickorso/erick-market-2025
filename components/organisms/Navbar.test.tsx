import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import Navbar from "./Navbar";

const dispatch = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  displayName: "",
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ state: { searchTerm: "" }, dispatch }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({
    isAuthenticated: user.isAuthenticated,
    isLoading: user.isLoading,
    displayName: user.displayName,
    auth: { email: "trader@example.com" },
    login,
    logout,
  }),
}));

beforeEach(() => {
  dispatch.mockReset();
  login.mockReset();
  logout.mockReset();
  localStorage.clear();
  user.isAuthenticated = false;
  user.isLoading = false;
  user.displayName = "";
});

describe("as a guest", () => {
  it("shows only the public links", () => {
    renderWithProviders(<Navbar />);

    expect(screen.getByTestId("Home")).toBeInTheDocument();
    expect(screen.getByTestId("League")).toBeInTheDocument();
    expect(screen.queryByTestId("My_Stocks")).not.toBeInTheDocument();
    expect(screen.queryByTestId("My_Fund")).not.toBeInTheDocument();
  });

  it("offers login", async () => {
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(login).toHaveBeenCalledTimes(1);
  });
});

describe("when signed in", () => {
  beforeEach(() => {
    user.isAuthenticated = true;
    user.displayName = "Erick";
  });

  it("reveals the portfolio links", () => {
    renderWithProviders(<Navbar />);

    expect(screen.getByTestId("My_Stocks")).toBeInTheDocument();
    expect(screen.getByTestId("My_Fund")).toBeInTheDocument();
  });

  it("shows who is signed in", () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByText("Erick")).toBeInTheDocument();
  });

  it("falls back to the email when there is no display name", () => {
    user.displayName = "";
    renderWithProviders(<Navbar />);
    expect(screen.getByText("trader@example.com")).toBeInTheDocument();
  });

  it("offers logout", async () => {
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe("while the session is still resolving", () => {
  it("hides the auth button rather than flashing the wrong one", () => {
    user.isLoading = true;
    renderWithProviders(<Navbar />);

    expect(
      screen.queryByRole("button", { name: "Log in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out" }),
    ).not.toBeInTheDocument();
  });
});

describe("search", () => {
  it("publishes each keystroke to the catalog", async () => {
    renderWithProviders(<Navbar />);

    await userEvent.type(screen.getByTestId("search"), "AA");

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_SEARCH_TERM",
      payload: "A",
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("labels the field for screen readers", () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByTestId("search")).toHaveAccessibleName();
  });
});

describe("language", () => {
  it("switches the interface language", async () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByTestId("Home")).toHaveTextContent("Home");

    await userEvent.click(screen.getByRole("button", { name: /language/i }));
    expect(screen.getByTestId("Home")).toHaveTextContent("Inicio");
  });
});
