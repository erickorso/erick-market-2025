import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "../../test/render";
import { expectNoA11yViolations } from "../../test/a11y";
import AuthPromptModal from "./AuthPromptModal";
import type { AuthPromptReason } from "../../context/AuthPromptContext";

const confirm = vi.hoisted(() => vi.fn());
const dismiss = vi.hoisted(() => vi.fn());
const prompt = vi.hoisted(() => ({
  reason: null as AuthPromptReason | null,
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ reason: prompt.reason, confirm, dismiss }),
}));

beforeEach(() => {
  confirm.mockReset();
  dismiss.mockReset();
  prompt.reason = "trade";
});

describe("when nothing is being asked", () => {
  it("renders nothing", () => {
    prompt.reason = null;
    const { container } = renderWithProviders(<AuthPromptModal />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("asking to sign in before trading", () => {
  it("explains why, rather than just redirecting", () => {
    renderWithProviders(<AuthPromptModal />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/virtual \$10,000 fund/i)).toBeInTheDocument();
  });

  it("offers both a way in and a way out", () => {
    renderWithProviders(<AuthPromptModal />);

    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("signs in only on confirmation", async () => {
    renderWithProviders(<AuthPromptModal />);

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("backs off when declined", async () => {
    renderWithProviders(<AuthPromptModal />);

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("asking to sign in before the league", () => {
  it("explains what the league needs an account for", () => {
    prompt.reason = "league";
    renderWithProviders(<AuthPromptModal />);

    expect(
      screen.getByText(/monthly league ranks players/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent(/sign in/i);
  });
});

describe("after a session ends", () => {
  beforeEach(() => {
    prompt.reason = "sessionExpired";
  });

  it("says the session ended rather than asking to sign in from scratch", () => {
    renderWithProviders(<AuthPromptModal />);

    expect(screen.getByRole("heading")).toHaveTextContent(/session ended/i);
    expect(
      screen.getByRole("button", { name: "Sign in again" }),
    ).toBeInTheDocument();
  });
});

describe("dismissal", () => {
  it("closes on Escape", async () => {
    renderWithProviders(<AuthPromptModal />);

    await userEvent.keyboard("{Escape}");
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click", async () => {
    renderWithProviders(<AuthPromptModal />);

    await userEvent.click(screen.getByRole("presentation"));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("stays open when the dialog itself is clicked", async () => {
    renderWithProviders(<AuthPromptModal />);

    await userEvent.click(screen.getByRole("dialog"));
    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe("accessibility", () => {
  it("is a modal dialog with a name and a description", async () => {
    renderWithProviders(<AuthPromptModal />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName();
    expect(dialog).toHaveAccessibleDescription();
  });

  it("takes focus when it opens", async () => {
    renderWithProviders(<AuthPromptModal />);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });

  it("has no axe violations", async () => {
    const { container } = renderWithProviders(<AuthPromptModal />);
    await expectNoA11yViolations(container);
  });
});
