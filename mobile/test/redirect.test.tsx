import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import AuthRedirect from "../app/redirect";
import { PrefsProvider } from "../lib/prefs";

// jest hoists mock factories above these, so the names it lets them touch
// must be prefixed `mock`.
const mockReplace = jest.fn();
const mockComplete = jest.fn(async () => true);
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../lib/auth", () => ({
  useAuth: () => ({ completeAuthCode: mockComplete }),
}));

const show = () =>
  render(
    <PrefsProvider>
      <AuthRedirect />
    </PrefsProvider>,
  );

beforeEach(() => {
  mockReplace.mockReset();
  mockComplete.mockReset().mockResolvedValue(true);
  mockParams = {};
});

/**
 * Three different things arrive at this one path, and the bug was treating
 * two of them as the third. A signed-out user was told their sign-in failed.
 */
describe("the auth callback", () => {
  it("exchanges a code and lands on the portfolio", async () => {
    mockParams = { code: "abc123" };
    show();

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith("abc123"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/portfolio"));
  });

  // Logout returns to this same URL. Without the marker it looks exactly like
  // a login that lost its code, which is what put "sign-in did not complete"
  // in front of someone who had just signed out on purpose.
  it("treats a logout return as a logout, not a failed login", async () => {
    mockParams = { event: "logout" };
    show();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(mockComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(/did not complete/i)).toBeNull();
  });

  // The other half: promptAsync and the deep link can both come back, and
  // whoever loses that race must not report a failure the user did not have.
  it("does not claim failure when the exchange reports it already happened", async () => {
    mockParams = { code: "abc123" };
    mockComplete.mockResolvedValue(true);
    show();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/portfolio"));
    expect(screen.queryByText(/did not complete/i)).toBeNull();
  });

  it("says so when Auth0 returns a real error", async () => {
    mockParams = {
      error: "access_denied",
      error_description: "User cancelled",
    };
    show();

    await waitFor(() =>
      expect(screen.getByText("User cancelled")).toBeTruthy(),
    );
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("says so when the exchange genuinely fails", async () => {
    mockParams = { code: "abc123" };
    mockComplete.mockResolvedValue(false);
    show();

    await waitFor(() =>
      expect(screen.getByText(/Could not finish signing in/i)).toBeTruthy(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
