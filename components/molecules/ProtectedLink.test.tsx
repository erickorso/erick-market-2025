import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen } from "../../test/render";
import ProtectedLink from "./ProtectedLink";

const requestLogin = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ isAuthenticated: false }));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: user.isAuthenticated }),
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin }),
}));

/** Prints the current path so a test can prove navigation did or did not happen. */
const Where: React.FC = () => (
  <span data-testid="where">{useLocation().pathname}</span>
);

function renderLink() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={
          <>
            <ProtectedLink to="/league" reason="league">
              Full league
            </ProtectedLink>
            <Where />
          </>
        }
      />
      <Route path="/league" element={<Where />} />
    </Routes>,
  );
}

beforeEach(() => {
  requestLogin.mockReset();
  user.isAuthenticated = false;
});

describe("as a guest", () => {
  it("asks about signing in rather than navigating", async () => {
    renderLink();

    await userEvent.click(screen.getByText("Full league"));

    expect(requestLogin).toHaveBeenCalledWith("league");
    expect(screen.getByTestId("where")).toHaveTextContent("/");
  });

  // Keeping a real href is the point: middle-click, "open in new tab" and
  // assistive tech all still see a destination.
  it("still exposes the destination", () => {
    renderLink();

    expect(screen.getByText("Full league")).toHaveAttribute("href", "/league");
  });

  // A modified click means "give me a new tab" — intercepting it would open
  // the dialog in this tab while the browser opens the page in another.
  it("lets a ctrl-click through untouched", () => {
    renderLink();

    const link = screen.getByText("Full league");
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );

    expect(requestLogin).not.toHaveBeenCalled();
  });

  it("lets a meta-click through untouched", () => {
    renderLink();

    const link = screen.getByText("Full league");
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        metaKey: true,
      }),
    );

    expect(requestLogin).not.toHaveBeenCalled();
  });

  it("lets a shift-click through untouched", () => {
    renderLink();

    const link = screen.getByText("Full league");
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      }),
    );

    expect(requestLogin).not.toHaveBeenCalled();
  });
});

describe("when signed in", () => {
  it("navigates as an ordinary link", async () => {
    user.isAuthenticated = true;
    renderLink();

    await userEvent.click(screen.getByText("Full league"));

    expect(requestLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/league");
  });
});

describe("a caller's own onClick", () => {
  it("still runs", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ProtectedLink to="/league" reason="league" onClick={onClick}>
        Full league
      </ProtectedLink>,
    );

    await userEvent.click(screen.getByText("Full league"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(requestLogin).toHaveBeenCalledWith("league");
  });

  // If the caller already handled the click, the prompt would be a second,
  // unexpected reaction to one gesture.
  it("wins when it prevents the default", async () => {
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
    renderWithProviders(
      <ProtectedLink to="/league" reason="league" onClick={onClick}>
        Full league
      </ProtectedLink>,
    );

    await userEvent.click(screen.getByText("Full league"));

    expect(requestLogin).not.toHaveBeenCalled();
  });
});
