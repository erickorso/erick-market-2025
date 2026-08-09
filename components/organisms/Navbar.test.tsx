import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import Navbar from "./Navbar";
import { UI } from "../../constants";

const dispatch = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ searchTerm: "" }));
const login = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
const requestLogin = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  displayName: "",
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({
    state: { searchTerm: store.searchTerm },
    dispatch,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
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

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin }),
}));

beforeEach(() => {
  dispatch.mockReset();
  navigate.mockReset();
  store.searchTerm = "";
  login.mockReset();
  logout.mockReset();
  requestLogin.mockReset();
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

  // The league needs an account, so the link used to land guests on a bare
  // "sign in to continue" wall. Now it asks first.
  it("asks about signing in instead of walking into the league guard", async () => {
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByTestId("League"));

    expect(requestLogin).toHaveBeenCalledWith("league");
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

  it("lets the league link through without asking", async () => {
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByTestId("League"));

    expect(requestLogin).not.toHaveBeenCalled();
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

  // Results only exist on the catalog. Searching from My Fund used to update
  // the term and then appear to do nothing.
  it("takes you to the catalog when you search from another page", async () => {
    renderWithProviders(<Navbar />, { route: "/my-fund" });

    await userEvent.type(screen.getByTestId("search"), "t");

    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("stays put when you are already on the catalog", async () => {
    renderWithProviders(<Navbar />, { route: "/" });

    await userEvent.type(screen.getByTestId("search"), "t");

    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not yank you away when you clear the box", async () => {
    store.searchTerm = "tesla";
    renderWithProviders(<Navbar />, { route: "/my-fund" });

    await userEvent.clear(screen.getByTestId("search"));

    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not navigate on whitespace alone", async () => {
    renderWithProviders(<Navbar />, { route: "/my-fund" });

    await userEvent.type(screen.getByTestId("search"), " ");

    expect(navigate).not.toHaveBeenCalled();
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

// The brand used to be hardcoded here while constants.ts held its own copy,
// which is how the header ended up saying something else than the URL.
describe("branding", () => {
  it("takes the name from the one place that defines it", () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole("link", { name: UI.NAV_TITLE })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
