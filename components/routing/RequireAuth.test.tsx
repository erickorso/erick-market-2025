import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import RequireAuth, { protectedRoute } from "./RequireAuth";

const login = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  configured: true,
  isLoading: false,
  isAuthenticated: false,
  profileError: null as string | null,
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ ...user, login }),
}));

beforeEach(() => {
  login.mockReset();
  user.configured = true;
  user.isLoading = false;
  user.isAuthenticated = false;
  user.profileError = null;
});

const Secret = () => <p>account balance</p>;

describe("RequireAuth", () => {
  it("waits rather than flashing the login wall", () => {
    user.isLoading = true;
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("account balance")).not.toBeInTheDocument();
  });

  it("hides the page from guests", () => {
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    expect(screen.queryByText("account balance")).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent(/sign in/i);
  });

  it("offers login to guests", async () => {
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("says so when Auth0 is not configured at all", () => {
    user.configured = false;
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    expect(screen.getByText(/Auth0 env vars are missing/i)).toBeInTheDocument();
  });

  it("shows the route the guest was trying to reach", () => {
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
      { route: "/my-fund" },
    );

    expect(screen.getByText("/my-fund")).toBeInTheDocument();
  });

  it("renders the page once authenticated", () => {
    user.isAuthenticated = true;
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    expect(screen.getByText("account balance")).toBeInTheDocument();
  });

  it("surfaces a profile failure instead of the page", async () => {
    user.isAuthenticated = true;
    user.profileError = "Neon unreachable";
    renderWithProviders(
      <RequireAuth>
        <Secret />
      </RequireAuth>,
    );

    expect(screen.getByText("Neon unreachable")).toBeInTheDocument();
    expect(screen.queryByText("account balance")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(login).toHaveBeenCalled();
  });
});

describe("protectedRoute", () => {
  it("wraps an element in the same guard", () => {
    user.isAuthenticated = true;
    renderWithProviders(<>{protectedRoute(<Secret />)}</>);

    expect(screen.getByText("account balance")).toBeInTheDocument();
  });

  it("blocks the wrapped element for guests", () => {
    renderWithProviders(<>{protectedRoute(<Secret />)}</>);
    expect(screen.queryByText("account balance")).not.toBeInTheDocument();
  });
});
